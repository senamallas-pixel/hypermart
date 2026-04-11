"""
HyperMart — OpenAI ChatGPT AI Router
All AI calls are routed through here so OPENAI_API_KEY stays server-side.
Mounted in main.py: app.include_router(ai_router)
"""

import os
import json
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/ai", tags=["AI"])

OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
AI_AVAILABLE = bool(OPENAI_KEY)


async def call_openai(prompt: str, system: str = "") -> str:
    """Send a prompt to OpenAI ChatGPT and return the response text."""
    if not AI_AVAILABLE:
        raise HTTPException(503, "OpenAI API key not configured")
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    payload = {
        "model": OPENAI_MODEL,
        "messages": messages,
        "max_tokens": 512,
        "temperature": 0.7,
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
    Called after a 400 ms debounce when the owner types >= 2 chars.
    """
    prompt = (
        f"Category: {body.category}\n"
        f'Partial name typed: "{body.partial_name}"\n'
        f"Suggest 5 complete, realistic product names that a neighbourhood shop in India "
        f"would sell in this category.\n"
        f"Respond ONLY with a JSON array of strings — no markdown, no explanation.\n"
        f'Example: ["Amul Butter 100g", "Britannia Bread 400g"]'
    )
    system = (
        "You are a product naming assistant for a hyperlocal grocery marketplace in India. "
        "Respond only with valid JSON arrays."
    )
    try:
        text = await call_openai(prompt, system)
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
    Called when the owner clicks 'AI Generate' in the product modal.
    """
    prompt = (
        f'Write a single short sentence (max 15 words) describing "{body.name}" '
        f'for an online grocery store in the "{body.category}" category. '
        f"Be factual and friendly. "
        f"Respond with ONLY the description sentence — no quotes, no punctuation at the end."
    )
    try:
        text = await call_openai(prompt)
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
        f"The following products are running low (<= 5 units): {items_list}.\n"
        f"Give 2-3 short, practical sentences of advice on restocking priorities "
        f"and what to order first. Be concise and specific to these items."
    )
    system = (
        f'You are an inventory advisor for a small neighbourhood shop called "{body.shop_name}".'
    )
    try:
        text = await call_openai(prompt, system)
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
    Simple ChatGPT-based narrative sales forecast for a shop.
    Returns a short insight paragraph.
    """
    prompt = (
        f"Based on typical neighbourhood grocery shopping patterns in India, "
        f"write 2-3 sentences forecasting sales trends for the next 7 days. "
        f"Mention peak days and suggest a category to stock up on. Be specific and concise."
    )
    system = (
        f"You are a sales analyst for a small hyperlocal grocery shop (shop ID {body.shop_id})."
    )
    try:
        text = await call_openai(prompt, system)
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
    formatting_rules = (
        "\n\nFormatting rules: Keep answers concise (under 150 words). "
        "Use **bold** for key terms. Use numbered lists (1. 2. 3.) or bullet points (- item) "
        "for multiple items. Use short paragraphs. Never use tables or code blocks. "
        "Do not repeat the question back. Get straight to the answer."
    )
    system_prompt = {
        "customer": (
            "You are HyperMart Assistant, a friendly shopping helper for a hyperlocal "
            "grocery marketplace in India. Help customers find products, compare shops, "
            "and get shopping advice. Use Rs for prices. Be warm and helpful."
        ),
        "owner": (
            "You are HyperMart Business Assistant, an AI advisor for shop owners on "
            "the HyperMart platform. Help with inventory, pricing, sales trends, and "
            "business growth tips for small Indian neighbourhood shops."
        ),
        "admin": (
            "You are HyperMart Admin Assistant. Help with platform governance, "
            "shop approvals, user management, and analytics interpretation."
        ),
    }.get(body.role, "You are a helpful assistant for the HyperMart marketplace.")
    system_prompt += formatting_rules

    if body.shop_id:
        system_prompt += f" The user is currently managing shop ID {body.shop_id}."

    # Build OpenAI messages array from history (last 10 turns)
    messages = [{"role": "system", "content": system_prompt}]
    for msg in body.history[-10:]:
        messages.append({
            "role": "user" if msg.role == "user" else "assistant",
            "content": msg.content,
        })
    messages.append({"role": "user", "content": body.message})

    if not AI_AVAILABLE:
        return {
            "reply": "AI is not configured. Please set OPENAI_API_KEY.",
            "tools_used": [],
            "sources": [],
        }

    payload = {
        "model": OPENAI_MODEL,
        "messages": messages,
        "max_tokens": 512,
        "temperature": 0.7,
    }
    try:
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
        reply = r.json()["choices"][0]["message"]["content"].strip()
        return {"reply": reply, "tools_used": [], "sources": []}
    except Exception:
        return {
            "reply": "I'm having trouble connecting right now. Please try again shortly.",
            "tools_used": [],
            "sources": [],
        }
