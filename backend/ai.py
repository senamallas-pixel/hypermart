"""
HyperMart — AI Router (OpenAI GPT)
Enhanced with real DB context for smarter, data-driven AI responses.
Mounted in main.py: app.include_router(ai_router)
"""

import os
import json
import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
import models as M

router = APIRouter(prefix="/ai", tags=["AI"])

OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
AI_AVAILABLE = bool(OPENAI_KEY)


async def call_openai(prompt: str, system: str = "", max_tokens: int = 512, temperature: float = 0.7) -> str:
    """Send a prompt to OpenAI and return the response text."""
    if not AI_AVAILABLE:
        raise HTTPException(503, "OpenAI API key not configured")
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    payload = {
        "model": OPENAI_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            OPENAI_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {OPENAI_KEY}",
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


# ── GET /ai/status ────────────────────────────────────────────────────────────

@router.get("/status")
def ai_status():
    return {"available": AI_AVAILABLE}


# ── POST /ai/suggest-products ─────────────────────────────────────────────────

class SuggestRequest(BaseModel):
    category: str
    partial_name: str


@router.post("/suggest-products")
async def suggest_products(body: SuggestRequest, db: Session = Depends(get_db)) -> List[str]:
    """Returns up to 5 product name suggestions, informed by existing inventory."""
    # Fetch existing products in this category to avoid duplicates
    existing = db.query(M.Product.name).filter(
        M.Product.category.ilike(f"%{body.category}%"),
        M.Product.status == M.ProductStatus.active,
    ).limit(20).all()
    existing_names = [p.name for p in existing]

    prompt = (
        f"Category: {body.category}\n"
        f'Partial name typed: "{body.partial_name}"\n'
        f"Already in inventory: {', '.join(existing_names[:10]) if existing_names else 'none yet'}\n"
        f"Suggest 5 complete, realistic product names that a neighbourhood shop in India "
        f"would sell in this category. Avoid duplicating existing products.\n"
        f"Respond ONLY with a JSON array of strings — no markdown, no explanation.\n"
        f'Example: ["Amul Butter 100g", "Britannia Bread 400g"]'
    )
    system = (
        "You are a product naming assistant for a hyperlocal grocery marketplace in India. "
        "Respond only with valid JSON arrays."
    )
    try:
        text = await call_openai(prompt, system, max_tokens=200, temperature=0.8)
        text = text.replace("```json", "").replace("```", "").strip()
        suggestions = json.loads(text)
        return [s for s in suggestions if isinstance(s, str)][:5]
    except Exception:
        return []


# ── POST /ai/generate-description ────────────────────────────────────────────

class DescribeRequest(BaseModel):
    name: str
    category: str


@router.post("/generate-description")
async def generate_description(body: DescribeRequest) -> dict:
    prompt = (
        f'Write a single short sentence (max 15 words) describing "{body.name}" '
        f'for an online grocery store in the "{body.category}" category. '
        f"Be factual and friendly. "
        f"Respond with ONLY the description sentence — no quotes, no punctuation at the end."
    )
    try:
        text = await call_openai(prompt, max_tokens=60, temperature=0.6)
        return {"description": text.rstrip(".")}
    except Exception:
        return {"description": ""}


# ── POST /ai/low-stock-insight ────────────────────────────────────────────────

class LowStockRequest(BaseModel):
    shop_id: Optional[int] = None
    shop_name: Optional[str] = None
    low_stock_items: Optional[List[str]] = None


@router.post("/low-stock-insight")
async def low_stock_insight(body: LowStockRequest, db: Session = Depends(get_db)) -> dict:
    """Returns restocking advice. Auto-queries DB if shop_id is provided."""
    shop_name = body.shop_name or "your shop"
    low_items = body.low_stock_items or []

    # Auto-fetch low stock from DB if shop_id provided
    if body.shop_id and not low_items:
        shop = db.query(M.Shop).filter(M.Shop.id == body.shop_id).first()
        if shop:
            shop_name = shop.name
        low_prods = db.query(M.Product).filter(
            M.Product.shop_id == body.shop_id,
            M.Product.status == M.ProductStatus.active,
            M.Product.stock <= M.Product.low_stock_threshold,
        ).all()
        low_items = [f"{p.name} ({p.stock} left, threshold {p.low_stock_threshold})" for p in low_prods]

    if not low_items:
        return {"insight": "All products are well-stocked. No restocking needed right now."}

    # Check recent sales to identify fast-moving items
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_sales = []
    if body.shop_id:
        sales = (
            db.query(M.OrderItem.name, func.sum(M.OrderItem.quantity).label("qty"))
            .join(M.Order, M.OrderItem.order_id == M.Order.id)
            .filter(M.Order.shop_id == body.shop_id, M.Order.created_at >= week_ago)
            .group_by(M.OrderItem.name)
            .order_by(func.sum(M.OrderItem.quantity).desc())
            .limit(5).all()
        )
        recent_sales = [f"{s.name}: {s.qty} sold this week" for s in sales]

    items_list = "\n".join(f"  - {item}" for item in low_items)
    prompt = (
        f"Low stock products:\n{items_list}\n\n"
        + (f"Recent top sellers (last 7 days):\n" + "\n".join(f"  - {s}" for s in recent_sales) + "\n\n" if recent_sales else "")
        + "Give 2-3 short, practical sentences of advice on restocking priorities. "
        "Prioritize fast-selling items that are running low. Be specific to these items."
    )
    system = f'You are an inventory advisor for a small neighbourhood shop called "{shop_name}" in India.'
    try:
        text = await call_openai(prompt, system, max_tokens=200)
        return {"insight": text, "low_stock_count": len(low_items)}
    except Exception:
        return {"insight": "", "low_stock_count": len(low_items)}


# ── POST /ai/sales-forecast ───────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    shop_id: int
    days_back: int = 30


@router.post("/sales-forecast")
async def sales_forecast(body: ForecastRequest, db: Session = Depends(get_db)) -> dict:
    """Data-driven sales forecast using actual order history."""
    shop = db.query(M.Shop).filter(M.Shop.id == body.shop_id).first()
    shop_name = shop.name if shop else f"Shop #{body.shop_id}"
    shop_category = shop.category.value if shop else "General"

    cutoff = datetime.utcnow() - timedelta(days=body.days_back)

    # Daily revenue for the period
    daily_revenue = (
        db.query(
            func.date(M.Order.created_at).label("day"),
            func.sum(M.Order.total).label("revenue"),
            func.count(M.Order.id).label("order_count"),
        )
        .filter(M.Order.shop_id == body.shop_id, M.Order.created_at >= cutoff,
                M.Order.status != M.OrderStatus.rejected)
        .group_by(func.date(M.Order.created_at))
        .order_by(func.date(M.Order.created_at))
        .all()
    )

    # Top products by quantity
    top_products = (
        db.query(M.OrderItem.name, func.sum(M.OrderItem.quantity).label("qty"),
                 func.sum(M.OrderItem.price * M.OrderItem.quantity).label("rev"))
        .join(M.Order, M.OrderItem.order_id == M.Order.id)
        .filter(M.Order.shop_id == body.shop_id, M.Order.created_at >= cutoff)
        .group_by(M.OrderItem.name)
        .order_by(func.sum(M.OrderItem.quantity).desc())
        .limit(5).all()
    )

    # Build data summary for AI
    total_revenue = sum(d.revenue for d in daily_revenue) if daily_revenue else 0
    total_orders = sum(d.order_count for d in daily_revenue) if daily_revenue else 0
    active_days = len(daily_revenue)
    avg_daily = total_revenue / active_days if active_days else 0

    daily_data = ", ".join(f"{d.day}: ₹{d.revenue:.0f} ({d.order_count} orders)" for d in daily_revenue[-14:])
    top_prods = ", ".join(f"{p.name} ({p.qty} units, ₹{p.rev:.0f})" for p in top_products)

    prompt = (
        f"Shop: {shop_name} ({shop_category} category)\n"
        f"Period: Last {body.days_back} days\n"
        f"Total revenue: ₹{total_revenue:.0f} | Total orders: {total_orders} | Active days: {active_days}\n"
        f"Avg daily revenue: ₹{avg_daily:.0f}\n"
        f"Daily breakdown (recent 14 days): {daily_data or 'No sales data yet'}\n"
        f"Top products: {top_prods or 'No data yet'}\n\n"
        f"Based on this REAL data, write 3-4 sentences:\n"
        f"1. Summarize the sales trend (growing/stable/declining)\n"
        f"2. Identify peak days or patterns\n"
        f"3. Forecast next 7 days and suggest what to stock up on\n"
        f"Be specific with numbers from the data. If no data, say so honestly."
    )
    system = f'You are a data-driven sales analyst for "{shop_name}", a {shop_category} shop in India.'
    try:
        text = await call_openai(prompt, system, max_tokens=300)
        return {
            "insight": text,
            "avg_daily_revenue": round(avg_daily, 2),
            "total_revenue": round(total_revenue, 2),
            "total_orders": total_orders,
            "top_products": [{"name": p.name, "qty": p.qty, "revenue": round(p.rev, 2)} for p in top_products],
        }
    except Exception:
        return {
            "insight": "",
            "avg_daily_revenue": round(avg_daily, 2),
            "total_revenue": round(total_revenue, 2),
            "total_orders": total_orders,
            "top_products": [],
        }


# ── POST /ai/chat — with OpenAI function calling (tools) ─────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    role: str = "customer"
    shop_id: Optional[int] = None
    history: List[ChatMessage] = []


# ── Tool definitions for OpenAI function calling ──────────────────────────────

CHAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Search for products across all shops by name, category, or keyword. Matches against product name, category name, and description. Returns matching products with price, stock, and shop info.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Product name, category, or keyword to search (e.g. 'milk', 'fruits', 'snacks', 'rice')"},
                    "category": {"type": "string", "description": "Optional exact category filter: Grocery, Dairy, Vegetables & Fruits, Meat, Bakery & Snacks, Beverages, Household, Personal Care"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_shop_products",
            "description": "Get product list and inventory for a specific shop. Shows prices, stock levels, and categories.",
            "parameters": {
                "type": "object",
                "properties": {
                    "shop_id": {"type": "integer", "description": "Shop ID"},
                },
                "required": ["shop_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_shop_info",
            "description": "Get details about a specific shop including name, category, location, rating, delivery radius, and open/closed status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "shop_id": {"type": "integer", "description": "Shop ID"},
                },
                "required": ["shop_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_shops",
            "description": "List available shops on the platform. Can filter by location or category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "Optional location filter"},
                    "category": {"type": "string", "description": "Optional category filter"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sales_summary",
            "description": "Get sales analytics for a shop: revenue, order count, top products, daily trends. Only for shop owners.",
            "parameters": {
                "type": "object",
                "properties": {
                    "shop_id": {"type": "integer", "description": "Shop ID"},
                    "days": {"type": "integer", "description": "Number of days to look back (default 7)"},
                },
                "required": ["shop_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_low_stock_items",
            "description": "Get list of products that are low on stock for a shop. Only for shop owners.",
            "parameters": {
                "type": "object",
                "properties": {
                    "shop_id": {"type": "integer", "description": "Shop ID"},
                },
                "required": ["shop_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_order_status",
            "description": "Check the status of an order by order ID. Returns status, items, total, and payment info.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer", "description": "Order ID to look up"},
                },
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_platform_stats",
            "description": "Get platform-wide statistics: total shops, users, orders, revenue. Only for admins.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_popular_products",
            "description": "Get the most popular/trending/best-selling products based on actual recent sales data. Use this when the user asks for popular, trending, best-selling, or recommended products.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Look back period in days (default 30)"},
                    "category": {"type": "string", "description": "Optional category filter"},
                    "limit": {"type": "integer", "description": "Max results (default 10)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_all_products",
            "description": "Get all available products across all shops, optionally filtered by category. Use when user wants to browse or asks 'what do you have'. Returns products with prices and stock.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "Optional category: Grocery, Dairy, Vegetables & Fruits, Meat, Bakery & Snacks, Beverages, Household, Personal Care"},
                },
            },
        },
    },
]


def _resolve_category(text: str):
    """Map a user-facing keyword to the ShopCategory enum member."""
    if not text:
        return None
    KEYWORD_MAP = {
        "fruit": M.ShopCategory.vegetables, "fruits": M.ShopCategory.vegetables,
        "vegetable": M.ShopCategory.vegetables, "vegetables": M.ShopCategory.vegetables,
        "veggie": M.ShopCategory.vegetables, "veggies": M.ShopCategory.vegetables,
        "dairy": M.ShopCategory.dairy, "milk": M.ShopCategory.dairy,
        "grocery": M.ShopCategory.grocery, "groceries": M.ShopCategory.grocery,
        "bakery": M.ShopCategory.bakery, "bread": M.ShopCategory.bakery,
        "snacks": M.ShopCategory.bakery, "cake": M.ShopCategory.bakery,
        "beverages": M.ShopCategory.beverages, "drinks": M.ShopCategory.beverages,
        "juice": M.ShopCategory.beverages, "tea": M.ShopCategory.beverages,
        "coffee": M.ShopCategory.beverages,
        "meat": M.ShopCategory.meat, "chicken": M.ShopCategory.meat, "fish": M.ShopCategory.meat,
        "household": M.ShopCategory.household, "cleaning": M.ShopCategory.household,
        "personal": M.ShopCategory.personal_care, "personal care": M.ShopCategory.personal_care,
    }
    return KEYWORD_MAP.get(text.lower().strip())


def execute_tool(name: str, args: dict, db: Session) -> str:
    """Execute a tool call and return the result as a string."""
    try:
        if name == "search_products":
            query = args.get("query", "")
            cat = args.get("category")
            from sqlalchemy import cast, String as SAString, or_

            q = db.query(M.Product).join(M.Shop).filter(
                M.Shop.status == M.ShopStatus.approved,
                M.Product.status == M.ProductStatus.active,
            )

            like = f"%{query}%"
            matched_cat = _resolve_category(query)
            conditions = [M.Product.name.ilike(like)]
            if matched_cat:
                conditions.append(M.Product.category == matched_cat)
            q = q.filter(or_(*conditions))

            if cat:
                cat_enum = _resolve_category(cat)
                if cat_enum:
                    q = q.filter(M.Product.category == cat_enum)

            products = q.order_by(M.Product.name).limit(12).all()
            if not products:
                return f"No products found matching '{query}'. Try 'milk', 'rice', 'vegetables', 'dairy', 'snacks'."
            lines = []
            for p in products:
                stock_label = f"In stock ({p.stock})" if p.stock and p.stock > 0 else "Out of stock"
                lines.append(f"- **{p.name}** — ₹{p.price}/{p.unit} | {stock_label} | Shop: {p.shop.name} (ID:{p.shop_id})")
            return f"Found {len(products)} products:\n" + "\n".join(lines)

        elif name == "get_shop_products":
            shop_id = args.get("shop_id")
            products = db.query(M.Product).filter(
                M.Product.shop_id == shop_id, M.Product.status == M.ProductStatus.active
            ).order_by(M.Product.name).limit(30).all()
            if not products:
                return f"No active products found for shop #{shop_id}."
            lines = [f"- {p.name}: ₹{p.price}/{p.unit} | Stock: {p.stock}" for p in products]
            return f"{len(products)} products in shop #{shop_id}:\n" + "\n".join(lines)

        elif name == "get_shop_info":
            shop_id = args.get("shop_id")
            s = db.query(M.Shop).filter(M.Shop.id == shop_id).first()
            if not s:
                return f"Shop #{shop_id} not found."
            return (
                f"**{s.name}** ({s.category.value})\n"
                f"Location: {s.location_name.value} | Address: {s.address or 'N/A'}\n"
                f"Rating: {s.rating or 'N/A'} ({s.review_count or 0} reviews)\n"
                f"Status: {'Open' if s.is_open else 'Closed'} | Delivery: {s.delivery_radius or 'N/A'} km\n"
                f"UPI: {'Yes' if s.upi_id else 'No'}"
            )

        elif name == "list_shops":
            location = args.get("location")
            category = args.get("category")
            q = db.query(M.Shop).filter(M.Shop.status == M.ShopStatus.approved)
            if location:
                q = q.filter(M.Shop.location_name.ilike(f"%{location}%"))
            if category:
                from sqlalchemy import cast, String as SAString
                q = q.filter(cast(M.Shop.category, SAString).ilike(f"%{category}%"))
            shops = q.limit(15).all()
            if not shops:
                return "No shops found matching your criteria."
            lines = [f"- **{s.name}** (ID:{s.id}) — {s.category.value}, {s.location_name.value} | Rating: {s.rating or 'N/A'}" for s in shops]
            return f"{len(shops)} shops:\n" + "\n".join(lines)

        elif name == "get_sales_summary":
            shop_id = args.get("shop_id")
            days = args.get("days", 7)
            cutoff = datetime.utcnow() - timedelta(days=days)
            orders = db.query(M.Order).filter(
                M.Order.shop_id == shop_id, M.Order.created_at >= cutoff,
                M.Order.status != M.OrderStatus.rejected,
            ).all()
            total_rev = sum(o.total for o in orders)
            top = (
                db.query(M.OrderItem.name, func.sum(M.OrderItem.quantity).label("qty"))
                .join(M.Order).filter(M.Order.shop_id == shop_id, M.Order.created_at >= cutoff)
                .group_by(M.OrderItem.name).order_by(func.sum(M.OrderItem.quantity).desc()).limit(5).all()
            )
            top_str = ", ".join(f"{t.name} ({t.qty} sold)" for t in top) or "None"
            return (
                f"Last {days} days for shop #{shop_id}:\n"
                f"- Orders: {len(orders)} | Revenue: ₹{total_rev:.0f}\n"
                f"- Avg order: ₹{total_rev / len(orders):.0f}\n" if orders else f"- Avg order: ₹0\n"
                f"- Top products: {top_str}"
            )

        elif name == "get_low_stock_items":
            shop_id = args.get("shop_id")
            low = db.query(M.Product).filter(
                M.Product.shop_id == shop_id, M.Product.status == M.ProductStatus.active,
                M.Product.stock <= M.Product.low_stock_threshold,
            ).all()
            if not low:
                return f"All products in shop #{shop_id} are well-stocked."
            lines = [f"- **{p.name}**: {p.stock} left (threshold: {p.low_stock_threshold})" for p in low]
            return f"{len(low)} low-stock items:\n" + "\n".join(lines)

        elif name == "get_order_status":
            order_id = args.get("order_id")
            order = db.query(M.Order).filter(M.Order.id == order_id).first()
            if not order:
                return f"Order #{order_id} not found."
            items_str = ", ".join(f"{i.name} x{i.quantity}" for i in order.items)
            return (
                f"Order #{order.id} — **{order.status.value}**\n"
                f"Shop: {order.shop_name} | Total: ₹{order.total}\n"
                f"Payment: {order.payment_method or 'cash'} ({order.payment_status.value})\n"
                f"Items: {items_str}\n"
                f"Placed: {order.created_at.strftime('%d %b %Y, %I:%M %p')}"
            )

        elif name == "get_platform_stats":
            total_shops = db.query(func.count(M.Shop.id)).scalar()
            approved = db.query(func.count(M.Shop.id)).filter(M.Shop.status == M.ShopStatus.approved).scalar()
            pending = db.query(func.count(M.Shop.id)).filter(M.Shop.status == M.ShopStatus.pending).scalar()
            total_users = db.query(func.count(M.User.id)).scalar()
            total_orders = db.query(func.count(M.Order.id)).scalar()
            total_rev = db.query(func.sum(M.Order.total)).scalar() or 0
            return (
                f"Platform stats:\n"
                f"- Shops: {total_shops} ({approved} approved, {pending} pending)\n"
                f"- Users: {total_users}\n"
                f"- Orders: {total_orders} | Total revenue: ₹{total_rev:.0f}"
            )

        elif name == "get_popular_products":
            days = args.get("days", 30)
            cat = args.get("category")
            limit = args.get("limit", 10)
            cutoff = datetime.utcnow() - timedelta(days=days)
            q = (
                db.query(
                    M.OrderItem.name,
                    M.OrderItem.price,
                    func.sum(M.OrderItem.quantity).label("total_sold"),
                    M.Product.stock,
                    M.Product.unit,
                    M.Product.shop_id,
                    M.Shop.name.label("shop_name"),
                )
                .join(M.Order, M.OrderItem.order_id == M.Order.id)
                .outerjoin(M.Product, M.OrderItem.product_id == M.Product.id)
                .outerjoin(M.Shop, M.Order.shop_id == M.Shop.id)
                .filter(M.Order.created_at >= cutoff, M.Order.status != M.OrderStatus.rejected)
            )
            if cat:
                cat_enum = _resolve_category(cat)
                if cat_enum:
                    q = q.filter(M.Product.category == cat_enum)
            popular = (
                q.group_by(M.OrderItem.name, M.OrderItem.price, M.Product.stock, M.Product.unit, M.Product.shop_id, M.Shop.name)
                .order_by(func.sum(M.OrderItem.quantity).desc())
                .limit(limit).all()
            )
            if not popular:
                # Fallback: show available products if no sales data
                prods = db.query(M.Product).join(M.Shop).filter(
                    M.Shop.status == M.ShopStatus.approved, M.Product.status == M.ProductStatus.active
                ).limit(limit).all()
                if not prods:
                    return "No products or sales data available yet."
                lines = [f"- **{p.name}** — ₹{p.price}/{p.unit} | Stock: {p.stock} | {p.shop.name}" for p in prods]
                return f"No sales data yet, but here are {len(prods)} available products:\n" + "\n".join(lines)
            lines = []
            for p in popular:
                stock_str = f"Stock: {p.stock}" if p.stock is not None else ""
                lines.append(f"- **{p.name}** — ₹{p.price}/{p.unit or 'unit'} | {p.total_sold} sold | {p.shop_name} {stock_str}")
            return f"Top {len(popular)} products (last {days} days by sales):\n" + "\n".join(lines)

        elif name == "get_all_products":
            cat = args.get("category")
            q = db.query(M.Product).join(M.Shop).filter(
                M.Shop.status == M.ShopStatus.approved,
                M.Product.status == M.ProductStatus.active,
            )
            if cat:
                cat_enum = _resolve_category(cat)
                if cat_enum:
                    q = q.filter(M.Product.category == cat_enum)
            products = q.order_by(M.Product.name).limit(20).all()
            if not products:
                return f"No products found{' in ' + cat if cat else ''}."
            lines = [f"- **{p.name}** — ₹{p.price}/{p.unit} | Stock: {p.stock} | {p.shop.name}" for p in products]
            return f"{len(products)} products{' in ' + cat if cat else ''}:\n" + "\n".join(lines)

        return f"Unknown tool: {name}"
    except Exception as e:
        return f"Tool error: {str(e)}"


@router.post("/chat")
async def ai_chat(body: ChatRequest, db: Session = Depends(get_db)) -> dict:
    """Conversational AI with OpenAI function calling for real-time data."""
    formatting_rules = (
        "\n\nFormatting rules: Keep answers concise (under 150 words). "
        "Use **bold** for key terms. Use numbered lists or bullet points for multiple items. "
        "Use short paragraphs. Never use tables or code blocks. Get straight to the answer."
    )

    system_prompt = {
        "customer": (
            "You are HyperMart Assistant, a friendly shopping helper for a hyperlocal "
            "grocery marketplace in India. Help customers find products, compare shops, "
            "track orders, and get shopping advice. Use ₹ for prices. Be warm and helpful. "
            "USE THE TOOLS to look up real-time product availability, prices, and shop info — "
            "never guess prices or stock levels."
        ),
        "owner": (
            "You are HyperMart Business Assistant for shop owners. Help with inventory, "
            "pricing, sales analysis, and growth tips. USE THE TOOLS to fetch real sales data, "
            "stock levels, and order info — give advice based on actual numbers, not guesses."
        ),
        "admin": (
            "You are HyperMart Admin Assistant. Help with platform governance, approvals, "
            "and analytics. USE THE TOOLS to get real platform stats and shop data."
        ),
    }.get(body.role, "You are a helpful assistant for the HyperMart marketplace.")
    system_prompt += formatting_rules

    if body.shop_id:
        system_prompt += f"\nThe user is currently on shop ID {body.shop_id}."

    messages = [{"role": "system", "content": system_prompt}]
    for msg in body.history[-10:]:
        messages.append({"role": "user" if msg.role == "user" else "assistant", "content": msg.content})
    messages.append({"role": "user", "content": body.message})

    if not AI_AVAILABLE:
        return {"reply": "AI is not configured. Please set OPENAI_API_KEY.", "tools_used": [], "sources": []}

    # Filter tools by role
    role_tools = {
        "customer": ["search_products", "get_popular_products", "get_all_products", "get_shop_info", "list_shops", "get_order_status"],
        "owner":    ["search_products", "get_popular_products", "get_all_products", "get_shop_products", "get_shop_info", "get_sales_summary", "get_low_stock_items", "get_order_status"],
        "admin":    ["list_shops", "get_shop_info", "get_platform_stats", "get_order_status", "search_products", "get_popular_products"],
    }
    allowed = role_tools.get(body.role, ["search_products", "get_popular_products", "list_shops"])
    tools = [t for t in CHAT_TOOLS if t["function"]["name"] in allowed]

    tools_used = []
    sources = []
    MAX_TOOL_ROUNDS = 3

    try:
        for _ in range(MAX_TOOL_ROUNDS + 1):
            payload = {
                "model": OPENAI_MODEL,
                "messages": messages,
                "max_tokens": 512,
                "temperature": 0.7,
                "tools": tools,
                "tool_choice": "auto",
            }
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    OPENAI_URL,
                    json=payload,
                    headers={"Authorization": f"Bearer {OPENAI_KEY}", "Content-Type": "application/json"},
                )
                r.raise_for_status()

            choice = r.json()["choices"][0]
            msg = choice["message"]

            # If the model wants to call tools
            if msg.get("tool_calls"):
                messages.append(msg)  # append assistant message with tool_calls
                for tc in msg["tool_calls"]:
                    fn_name = tc["function"]["name"]
                    fn_args = json.loads(tc["function"]["arguments"])
                    result = execute_tool(fn_name, fn_args, db)
                    tools_used.append(fn_name)
                    sources.append({"tool": fn_name, "args": fn_args, "summary": result[:100]})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": result,
                    })
                continue  # loop back for the model to process tool results

            # No tool calls — final response
            reply = msg.get("content", "").strip()
            return {"reply": reply, "tools_used": tools_used, "sources": sources}

        # Exhausted rounds
        return {"reply": "I gathered some information but couldn't complete the analysis. Please try again.", "tools_used": tools_used, "sources": sources}

    except Exception:
        return {"reply": "I'm having trouble connecting right now. Please try again shortly.", "tools_used": [], "sources": []}
