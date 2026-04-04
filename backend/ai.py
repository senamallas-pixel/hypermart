"""
HyperMart — Gemini AI Router
All AI calls are routed through here so GEMINI_API_KEY stays server-side.
Mounted in main.py: app.include_router(ai_router)
"""

import os
import json
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/ai", tags=["AI"])

GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta"
    "/models/gemini-2.0-flash:generateContent"
)
AI_AVAILABLE = bool(GEMINI_KEY)


async def call_gemini(prompt: str) -> str:
    """Send a prompt to Gemini 2.0 Flash and return the response text."""
    if not AI_AVAILABLE:
        raise HTTPException(503, "Gemini API key not configured")
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{GEMINI_URL}?key={GEMINI_KEY}", json=payload)
        r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


# ── GET /ai/status ────────────────────────────────────────────────────────────

@router.get("/status")
def ai_status():
    """Frontend checks this on mount to show/hide AI UI elements."""
    return {"available": AI_AVAILABLE}


# ── POST /ai/suggest-products ─────────────────────────────────────────────────

class SuggestRequest(BaseModel):
    category:     str
    partial_name: str


@router.post("/suggest-products")
async def suggest_products(body: SuggestRequest) -> List[str]:
    """
    Returns up to 5 product name suggestions.
    Called after a 400 ms debounce when the owner types ≥ 2 chars.
    """
    prompt = (
        f"You are a product naming assistant for a hyperlocal grocery marketplace in India.\n"
        f"Category: {body.category}\n"
        f'Partial name typed: "{body.partial_name}"\n'
        f"Suggest 5 complete, realistic product names that a neighbourhood shop in India "
        f"would sell in this category.\n"
        f"Respond ONLY with a JSON array of strings — no markdown, no explanation.\n"
        f'Example: ["Amul Butter 100g", "Britannia Bread 400g"]'
    )
    try:
        text = await call_gemini(prompt)
        text = text.replace("```json", "").replace("```", "").strip()
        suggestions = json.loads(text)
        return [s for s in suggestions if isinstance(s, str)][:5]
    except Exception:
        return []   # Fail silently — UI falls back to plain text input


# ── POST /ai/generate-description ────────────────────────────────────────────

class DescribeRequest(BaseModel):
    name:     str
    category: str


@router.post("/generate-description")
async def generate_description(body: DescribeRequest) -> dict:
    """
    Returns a single-sentence product description.
    Called when the owner clicks '✨ AI Generate' in the product modal.
    """
    prompt = (
        f'Write a single short sentence (max 15 words) describing "{body.name}" '
        f'for an online grocery store in the "{body.category}" category. '
        f"Be factual and friendly. "
        f"Respond with ONLY the description sentence — no quotes, no punctuation at the end."
    )
    try:
        text = await call_gemini(prompt)
        return {"description": text.rstrip(".")}
    except Exception:
        return {"description": ""}


# ── POST /ai/low-stock-insight ────────────────────────────────────────────────

class LowStockRequest(BaseModel):
    shop_name:       str
    low_stock_items: List[str]


@router.post("/low-stock-insight")
async def low_stock_insight(body: LowStockRequest) -> dict:
    """
    Returns 2-3 sentences of restocking advice for the owner.
    Shown as an insight card in the Low Stock Alerts panel.
    """
    if not body.low_stock_items:
        return {"insight": ""}
    items_list = ", ".join(body.low_stock_items)
    prompt = (
        f'You are an inventory advisor for a small neighbourhood shop called "{body.shop_name}".\n'
        f"The following products are running low (≤ 5 units): {items_list}.\n"
        f"Give 2–3 short, practical sentences of advice on restocking priorities "
        f"and what to order first. Be concise and specific to these items."
    )
    try:
        text = await call_gemini(prompt)
        return {"insight": text}
    except Exception:
        return {"insight": ""}


# ── POST /ai/sales-forecast ───────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    shop_id:   int
    days_back: int = 30


@router.post("/sales-forecast")
async def sales_forecast(body: ForecastRequest) -> dict:
    """
    Simple Gemini-based narrative sales forecast for a shop.
    Returns a short insight paragraph.
    """
    prompt = (
        f"You are a sales analyst for a small hyperlocal grocery shop (shop ID {body.shop_id}). "
        f"Based on typical neighbourhood grocery shopping patterns in India, "
        f"write 2-3 sentences forecasting sales trends for the next 7 days. "
        f"Mention peak days and suggest a category to stock up on. Be specific and concise."
    )
    try:
        text = await call_gemini(prompt)
        return {"insight": text, "forecast": [], "avg_daily_revenue": 0}
    except Exception:
        return {"insight": "", "forecast": [], "avg_daily_revenue": 0}


# ── POST /ai/chat ─────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role:    str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    role:    str = "customer"          # customer | owner | admin
    shop_id: Optional[int] = None
    history: List[ChatMessage] = []

@router.post("/chat")
async def ai_chat(body: ChatRequest) -> dict:
    """
    Conversational AI endpoint. Keeps a rolling history for context.
    Tailors its persona based on the caller's role.
    """
    role_context = {
        "customer": (
            "You are HyperMart Assistant, a helpful shopping assistant for a hyperlocal "
            "marketplace in India. Help customers find products, compare shops, and get "
            "shopping advice. Be friendly, concise, and use ₹ for prices."
        ),
        "owner": (
            "You are HyperMart Business Assistant, an AI advisor for shop owners. "
            "Help with inventory decisions, pricing strategies, sales trends, and "
            "business growth tips relevant to small Indian neighbourhood shops."
        ),
        "admin": (
            "You are HyperMart Admin Assistant. Help with platform governance, "
            "shop approval decisions, user management issues, and analytics interpretation."
        ),
    }.get(body.role, "You are a helpful assistant for the HyperMart marketplace.")

    # Build conversation history (last 10 turns)
    history_text = ""
    for msg in body.history[-10:]:
        prefix = "User" if msg.role == "user" else "Assistant"
        history_text += f"{prefix}: {msg.content}\n"

    shop_context = f" The user is currently managing shop ID {body.shop_id}." if body.shop_id else ""

    prompt = (
        f"{role_context}{shop_context}\n\n"
        f"{history_text}"
        f"User: {body.message}\n"
        f"Assistant:"
    )
    try:
        reply = await call_gemini(prompt)
        return {"reply": reply, "tools_used": [], "sources": []}
    except Exception as e:
        return {"reply": "I'm having trouble connecting right now. Please try again shortly.", "tools_used": [], "sources": []}
