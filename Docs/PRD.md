# HyperMart — Full Product & Implementation Reference

**Version:** 3.0  
**Date:** April 5, 2026  
**Status:** Implemented (Active Development)  
**Stack:** React 19 (JSX) · Vite 6 · Node.js · Express · sql.js (SQLite) · JWT · Python · FastAPI · Gemini 2.0 Flash · Qdrant · LangChain · OpenAPI 3.1  
**Local Dev:** http://localhost:5174/hypermart-v2/  
**Repository:** https://github.com/senamallas-pixel/hypermart

---

## Table of Contents

**Part A — Product Requirements**
1. [Executive Summary](#1-executive-summary)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Authentication & Session Management](#4-authentication--session-management)
5. [System Architecture](#5-system-architecture)
6. [Feature Specifications](#6-feature-specifications)
7. [AI Features — Agentic RAG System](#7-ai-features--agentic-rag-system)
8. [Map & Location Features](#8-map--location-features)
9. [Subscription System](#9-subscription-system)
10. [Multi-Language Support](#10-multi-language-support)
11. [UI/UX Specifications](#11-uiux-specifications)
12. [Navigation & Routing](#12-navigation--routing)
13. [Error Handling & Edge Cases](#13-error-handling--edge-cases)
14. [Known Limitations & Backlog](#14-known-limitations--backlog)
15. [Acceptance Criteria Checklist](#15-acceptance-criteria-checklist)

**Part B — Implementation**
16. [Project Structure](#16-project-structure)
17. [Quick Start](#17-quick-start)
18. [Backend — database.py](#18-backend--databasepy)
19. [Backend — models.py](#19-backend--modelspy)
20. [Backend — schemas.py](#20-backend--schemaspy)
21. [Backend — main.py](#21-backend--mainpy)
22. [Backend — ai.py (Gemini)](#22-backend--aipy-gemini)
23. [Backend — seed.py](#23-backend--seedpy)
24. [Backend — requirements.txt](#24-backend--requirementstxt)
25. [Frontend — api/client.js](#25-frontend--apiclientjs)
26. [Frontend — context/AppContext.jsx](#26-frontend--contextappcontextjsx)
27. [Frontend — pages/Marketplace.jsx](#27-frontend--pagesmarketplacejsx)
28. [Frontend — pages/OwnerDashboard.jsx](#28-frontend--pagesownerdashboardjsx)
29. [Frontend — pages/AdminPanel.jsx](#29-frontend--pagesadminpaneljsx)
30. [Frontend — components/AIAssistant.jsx](#30-frontend--componentsaiassistantjsx)
31. [Frontend — App.jsx](#31-frontend--appjsx)
32. [Database Schema Reference](#32-database-schema-reference)
33. [Full API Reference](#33-full-api-reference)
34. [Order Status Pipeline](#34-order-status-pipeline)
35. [PRD → Implementation Map](#35-prd--implementation-map)
36. [Production Checklist](#36-production-checklist)

---

# PART A — PRODUCT REQUIREMENTS

---

## 1. Executive Summary

HyperMart is a **hyperlocal marketplace web application** that bridges neighbourhood shop owners with customers in the same locality. The platform enables shop owners to go digital with zero technical overhead while giving customers a single, location-aware storefront to discover and order from nearby shops.

### Core Value Propositions

| Persona | Value |
|---------|-------|
| **Customer** | Discover, browse, and order from nearby shops in one app, filtered by locality and category |
| **Shop Owner** | Digital storefront, inventory control, order management, and AI-powered product tools with no setup friction |
| **Admin** | Full platform governance — shop approvals, user management, platform-wide oversight |

---

## 2. Goals & Success Metrics

### Product Goals

- Enable local shop owners to go digital with zero technical effort
- Let customers discover and order from nearby shops filtered by locality
- Provide real-time order and inventory tracking
- Offer AI-assisted product suggestions and shop insights via Gemini API

### Key Metrics (Target at Launch)

| Metric | Target |
|--------|--------|
| Shop onboarding time | < 5 minutes from registration to pending approval |
| Order placement steps | ≤ 3 taps from shop page to order confirmation |
| Admin approval turnaround | < 24 hours (process SLA, not technical) |
| Page load (LCP) | < 2.5 seconds on 4G |
| API reads per customer session | < 500 |

---

## 3. User Roles & Permissions

### Role Matrix

| Action | `customer` | `owner` | `admin` |
|--------|:---------:|:-------:|:-------:|
| Browse approved shops | ✓ | ✓ | ✓ |
| Add to cart & place orders | ✓ | ✗ | ✗ |
| View own order history | ✓ | ✗ | ✗ |
| Register a shop | ✗ | ✓ | ✗ |
| Manage own shop inventory | ✗ | ✓ | ✓ |
| Manage own shop orders | ✗ | ✓ | ✓ |
| Generate bills (POS) | ✗ | ✓ | ✓ |
| Use AI product tools | ✗ | ✓ | ✓ |
| Approve / suspend shops | ✗ | ✗ | ✓ |
| Manage all users & roles | ✗ | ✗ | ✓ |
| View platform-wide analytics | ✗ | ✗ | ✓ |

### Role Assignment Flow

```
User signs in with Google
         │
         ▼
  users/{uid} exists?
    ├── NO  → /role-selection
    │         User picks: customer | owner
    │         Write profile to DB
    │         Redirect to role home
    │
    └── YES → Read role from DB
              Admin override: senamallas@gmail.com → force admin
              Redirect to role home
```

### Admin Override Rule

```typescript
// Applied on every auth state check
if (user.email === 'senamallas@gmail.com' && role !== 'admin') {
  await updateUserRole(user.uid, 'admin');
  role = 'admin';
}
```

### Role Home Redirects

| Role | Default Route |
|------|--------------|
| `customer` | `/marketplace` |
| `owner` | `/owner` |
| `admin` | `/admin` |

---

## 4. Authentication & Session Management

### Provider

- **Google Sign-In only** via Firebase Auth (`signInWithPopup` + `GoogleAuthProvider`)
- No email/password, phone, or other OAuth providers

### Auth Flow

```typescript
// 1. Sign-in trigger
const provider = new GoogleAuthProvider();
await signInWithPopup(getAuth(), provider);

// 2. Global session listener
onAuthStateChanged(auth, async (firebaseUser) => {
  if (!firebaseUser) { navigate('/'); return; }

  const profile = await fetchUserProfile(firebaseUser.uid);

  if (!profile) {
    navigate('/role-selection');
    return;
  }

  let { role } = profile;

  // Admin override
  if (firebaseUser.email === 'senamallas@gmail.com' && role !== 'admin') {
    await patchUserRole(firebaseUser.uid, 'admin');
    role = 'admin';
  }

  setCurrentUser({ ...firebaseUser, role });
  navigate(roleHomeMap[role]);
});
```

### First-Time User Profile

```typescript
// Written on role-selection submit → POST /users
{
  uid:         firebaseUser.uid,
  email:       firebaseUser.email,
  displayName: firebaseUser.displayName,
  photoURL:    firebaseUser.photoURL ?? null,
  role:        selectedRole,       // 'customer' | 'owner'
  phone:       null,
  createdAt:   new Date().toISOString(),
  lastLoginAt: new Date().toISOString()
}
```

### Protected Route Rules

| Route | Auth Required | Allowed Roles |
|-------|:------------:|--------------|
| `/` | No | — (sign-in page) |
| `/role-selection` | Yes | New users (no role yet) |
| `/marketplace` | Yes | `customer`, `admin` |
| `/owner` | Yes | `owner`, `admin` |
| `/admin` | Yes | `admin` |
| `/cart` | Yes | `customer` |
| `/profile` | Yes | All |

---

## 5. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                         │
│                                                              │
│   React 19 (JSX) · Vite 6 · Framer Motion · Leaflet         │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐              │
│  │ Customer  │  │   Owner    │  │   Admin    │              │
│  │Marketplace│  │ Dashboard  │  │   Panel    │              │
│  └─────┬─────┘  └─────┬──────┘  └─────┬──────┘              │
│        └──────────────┼───────────────┘                      │
│                ┌──────▼──────┐                               │
│                │  AppContext  │  Auth · Cart · Locale        │
│                └──────┬──────┘                               │
│                api/client.js  (Axios · JWT bearer)           │
└────────────────────────┼─────────────────────────────────────┘
                         │ REST / JSON
┌────────────────────────▼─────────────────────────────────────┐
│             Node.js / Express  (Primary API — port 8000)     │
│   index.js · db.js (sql.js / SQLite) · JWT auth · multer     │
│   OpenAPI 3.1 spec auto-generated at  GET /openapi.json      │
└──────┬────────────────────────────────────┬──────────────────┘
       │ SQL (sql.js)                        │ HTTP proxy
┌──────▼──────┐              ┌──────────────▼──────────────────┐
│  SQLite DB  │              │   Python / FastAPI  (AI Service) │
│ hypermart.db│              │   ai_service/main.py  :8001      │
└─────────────┘              │                                  │
                             │  ┌────────────────────────────┐  │
                             │  │  LangChain Agentic Engine  │  │
                             │  │  Planner → Tool Router     │  │
                             │  │  → Executor → Synthesiser  │  │
                             │  └──────────┬─────────────────┘  │
                             │             │                     │
                             │  ┌──────────▼──────┐  ┌────────┐ │
                             │  │  Qdrant          │  │Gemini  │ │
                             │  │  Vector Store    │  │2.0Flash│ │
                             │  │  (embeddings)    │  │  API   │ │
                             │  └─────────────────┘  └────────┘ │
                             └──────────────────────────────────┘
```

### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite + SQLAlchemy | Zero-infra local dev; swap to PostgreSQL via single env var for prod |
| FastAPI | Async, typed, auto-generates OpenAPI docs at `/docs` |
| HashRouter | GitHub Pages SPA routing — no server config needed |
| Gemini proxied through backend | API key stays server-side; rate limits enforced centrally |
| Cart in `useReducer` | No external lib needed; single-shop constraint enforced in reducer |

---

## 6. Feature Specifications

### 6.1 Sign-In Page (`/`)

| Element | Detail |
|---------|--------|
| Logo + tagline | HyperMart branding |
| "Sign in with Google" button | Triggers `signInWithPopup` |
| Loading state | Spinner while auth resolves |
| Error state | Toast if sign-in fails |

**Behaviour:** If already signed in, redirect immediately to role home. On success, check backend profile and route accordingly.

---

### 6.2 Role Selection (`/role-selection`)

| Element | Detail |
|---------|--------|
| Role cards | "I'm a Customer" / "I'm a Shop Owner" |
| Selection | Single-select, highlighted on pick |
| CTA | "Continue" — disabled until role selected |
| Submit | `POST /users` → redirect to role home |

**Rules:** Cannot access any other route until role is set. Back navigation signs the user out.

---

### 6.3 Marketplace (`/marketplace`)

#### Location Filter
- Dropdown with: Green Valley, Central Market, Food Plaza, Milk Lane, Old Town
- Default: first option or last selected (persisted in `localStorage`)
- Triggers `GET /shops?location=X` API call

#### Category Filter
- Horizontally scrollable chip bar (sticky on scroll)
- Categories: All, Grocery, Dairy, Vegetables & Fruits, Meat, Bakery & Snacks, Beverages, Household, Personal Care
- Client-side filter over loaded shop list

#### Search
- Text input, 300ms debounce
- Client-side filter on `name` and `category` fields

#### Shop Card
- Logo (fallback: initial letter avatar)
- Shop name, category badge, rating, address, timings
- "View Shop" CTA → navigates to `/marketplace/:shopId`

#### Shop Detail (`/marketplace/:shopId`)
- Responsive product grid: 2 cols → 6 cols across breakpoints
- Product card: image, name, price, MRP (strikethrough), unit, Add button
- Quantity controls appear after first Add (min 1, remove at 0)

#### My Orders (`/marketplace/orders`)

| Column | Value |
|--------|-------|
| Order ID | Truncated doc ID |
| Shop name | Denormalized at order creation |
| Items summary | "3 items · ₹240" |
| Status badge | Colour-coded pipeline status |
| Date | `createdAt` formatted |

---

### 6.4 Cart

#### Cart State Structure

```typescript
interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  image?: string;
}

interface CartState {
  shopId: string | null;
  shopName: string | null;
  items: CartItem[];
}
```

#### Business Rules

1. **Single-shop constraint** — adding from a different shop shows: "Your cart has items from [Shop A]. Clear and add from [Shop B]?"
2. Minimum quantity is 1; removing the last unit removes the item entirely
3. Cart total = Σ (price × quantity)

#### Place Order Flow

```typescript
// POST /orders
{
  shopId:          cart.shopId,
  items:           cart.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
  deliveryAddress: 'Default Address'   // TODO: user address flow
}
// On success: clearCart() → success toast
```

---

### 6.5 Owner Dashboard (`/owner`)

Tab-based. Shop selector at top when owner has multiple shops.

#### Overview Tab

| Widget | Source |
|--------|--------|
| Today's Sales (₹) | `GET /shops/{id}/analytics` → `today_sales` |
| Orders Today | `today_orders` |
| Total Products | `total_products` |
| Low-Stock Alert | `low_stock_items` (stock ≤ 5) |

#### Inventory Tab

Product table columns: Image · Name · Category · Price · MRP · Stock · Unit · Status · Actions

**Add/Edit Modal fields:** Name · Category · Price · MRP · Stock · Unit · Image URL · Status

**Delete rule:** Blocked if product has active (non-terminal) orders.

#### Orders Tab

Order pipeline:

```
pending → accepted → ready → out_for_delivery → delivered
pending / accepted → rejected (terminal)
```

| Status | Owner Action | Badge |
|--------|-------------|-------|
| `pending` | Accept / Reject | Amber |
| `accepted` | Mark Ready | Blue |
| `ready` | Mark Out for Delivery | Indigo |
| `out_for_delivery` | Mark Delivered | Purple |
| `delivered` | — | Green |
| `rejected` | — | Red |

#### Billing Tab (In-Store POS)

1. Search products by name (client-side)
2. Add to bill with quantity controls
3. View line items, subtotals, grand total
4. "Generate Receipt" → `window.print()` or clipboard copy

**Receipt format:**
```
-------------------------------------------
             [Shop Name]
             [Address]
-------------------------------------------
Item                     Qty      Total
Milk (1L)                  2       ₹80
Bread (400g)               1       ₹35
-------------------------------------------
                    Grand Total:   ₹115
-------------------------------------------
Date: 05 Apr 2026          Time: 14:32
```

---

### 6.6 Admin Panel (`/admin`)

#### Shops Tab

Table: Shop Name · Owner · Category · Location · Status · Created · Actions

| Status | Actions |
|--------|---------|
| `pending` | Approve, Reject |
| `approved` | Suspend |
| `suspended` | Approve |

Filters: All / Pending / Approved / Suspended

#### Users Tab

Table: Name · Email · Role · Joined · Change Role (dropdown)

#### Analytics Tab

| Metric | Source |
|--------|--------|
| Total / Approved shops | `GET /analytics/platform` |
| Total users | platform analytics |
| Total orders | platform analytics |
| Delivered revenue | platform analytics |

---

### 6.7 Profile (`/profile`)

| Section | Content |
|---------|---------|
| Avatar | Google `photoURL` |
| Name & Email | Firebase Auth profile |
| Role badge | Current role |
| Phone | Editable → `PATCH /users/me` |
| Sign Out | Clears session → `/` |

---

## 7. AI Features — Agentic RAG System

> **Status:** Active development. Python FastAPI microservice (`ai_service/`) runs alongside the Node.js primary API. All AI routes are proxied through Node (`/api/ai/*` → `http://localhost:8001`). `GEMINI_API_KEY` never reaches the browser.

---

### 7.0 Architecture Overview

```
Browser
  └─► POST /api/ai/chat  (Node proxy)
            │
            ▼
     Python FastAPI  :8001
            │
     ┌──────▼────────────────────────────────────────┐
     │          LangChain Agentic Engine              │
     │                                                │
     │  1. Intent Planner  (Gemini 2.0 Flash)         │
     │       ↓ decides which tools to call            │
     │  2. Tool Router                                │
     │       ├─ rag_search(query)       → Qdrant      │
     │       ├─ get_shop_analytics(id)  → SQLite      │
     │       ├─ get_inventory(shop_id)  → SQLite      │
     │       ├─ get_order_summary(id)   → SQLite      │
     │       ├─ suggest_products(cat)   → Gemini      │
     │       └─ generate_description()  → Gemini      │
     │  3. Executor  — runs selected tools in order   │
     │  4. Synthesiser (Gemini 2.0 Flash)             │
     │       ↓ merges tool results + RAG context      │
     │  5. Response to client                         │
     └────────────────────────────────────────────────┘
            │                        │
     ┌──────▼──────┐        ┌────────▼────────┐
     │  Qdrant      │        │  Gemini 2.0     │
     │  (qdrant_db/)│        │  Flash API      │
     │  collections │        │  (generation +  │
     │  + payloads  │        │   embeddings)   │
     └──────────────┘        └─────────────────┘
```

---

### 7.1 OpenAPI 3.1 Specification

The AI service exposes a machine-readable OpenAPI 3.1 spec at `GET http://localhost:8001/openapi.json` (auto-generated by FastAPI). Key endpoints:

```yaml
openapi: "3.1.0"
info:
  title: HyperMart AI Service
  version: "1.0.0"
paths:
  /ai/status:
    get:
      summary: Check AI availability
      responses:
        "200":
          content:
            application/json:
              schema:
                properties:
                  available: { type: boolean }
                  vector_db: { type: boolean }
                  agent:     { type: boolean }

  /ai/chat:
    post:
      summary: Agentic conversational AI — main entry point
      requestBody:
        content:
          application/json:
            schema:
              properties:
                message:  { type: string }
                shop_id:  { type: integer, nullable: true }
                role:     { type: string, enum: [customer, owner, admin] }
                history:  { type: array, items: { type: object } }
      responses:
        "200":
          content:
            application/json:
              schema:
                properties:
                  reply:       { type: string }
                  tools_used:  { type: array, items: { type: string } }
                  sources:     { type: array, items: { type: string } }

  /ai/suggest-products:
    post:
      summary: Autocomplete product names (RAG-enhanced)
      requestBody:
        content:
          application/json:
            schema:
              properties:
                category:     { type: string }
                partial_name: { type: string }
      responses:
        "200":
          content:
            application/json:
              schema:
                type: array
                items: { type: string }

  /ai/generate-description:
    post:
      summary: Generate a product description
      requestBody:
        content:
          application/json:
            schema:
              properties:
                name:     { type: string }
                category: { type: string }

  /ai/low-stock-insight:
    post:
      summary: Actionable restock advice for shop owner
      requestBody:
        content:
          application/json:
            schema:
              properties:
                shop_id:         { type: integer }
                shop_name:       { type: string }
                low_stock_items: { type: array, items: { type: string } }

  /ai/index-shop:
    post:
      summary: Index / re-index a shop's products into Qdrant
      requestBody:
        content:
          application/json:
            schema:
              properties:
                shop_id: { type: integer }

  /ai/sales-forecast:
    post:
      summary: 7-day sales forecast for a shop
      requestBody:
        content:
          application/json:
            schema:
              properties:
                shop_id:     { type: integer }
                days_back:   { type: integer, default: 30 }
```

---

### 7.2 Vector Database — Qdrant

#### Purpose

Qdrant is the **retrieval layer** of the RAG pipeline. It stores dense vector embeddings of:
- All product names + descriptions + categories per shop
- Shop metadata (name, location, timings, category)
- Historical Q&A pairs (for few-shot priming)
- Admin knowledge base articles (policies, help docs)

Qdrant is run locally as a Docker container (`qdrant/qdrant`) persisting data to `./qdrant_storage`. In production it is hosted on Qdrant Cloud.

#### Collection Schema

Qdrant uses **collections**. Each point has:
- `id` — deterministic integer hash of the document key
- `vector` — 768-dim float array (Gemini `text-embedding-004`)
- `payload` — JSON metadata (filterable)

| Collection | Document text | Payload fields | Embedding model |
|-----------|--------------|---------------|-----------------|
| `products` | `"{name} — {description} ({category}, ₹{price}/{unit})"` | `shop_id, product_id, category, price, stock, text` | `models/text-embedding-004` |
| `shops` | `"{name}: {category} shop at {address}, {location_name}. Open {timings}."` | `shop_id, lat, lng, rating, is_open, text` | `models/text-embedding-004` |
| `knowledge_base` | Admin-authored FAQ / policy articles | `topic, role, text` | `models/text-embedding-004` |
| `chat_history` | `"Q: {q}\nA: {a}"` | `session_id, role, timestamp, text` | `models/text-embedding-004` |

#### Indexing Triggers

| Event | Action |
|-------|--------|
| `POST /shops` (approved) | `index-shop` called automatically |
| `POST /products`, `PATCH /products/:id` | Upsert product point into Qdrant |
| `DELETE /products/:id` | Delete point from Qdrant by `product_id` filter |
| Admin publishes KB article | Insert into `knowledge_base` collection |
| Nightly cron (02:00) | Full re-index all active shops |

#### Docker Setup

```bash
# Start Qdrant locally (persistent storage)
docker run -d --name qdrant \
  -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant

# REST UI available at http://localhost:6333/dashboard
```

#### Python Implementation

```python
# ai_service/vector_store.py
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    Filter, FieldCondition, MatchValue,
)
import google.generativeai as genai
import hashlib, os

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

QDRANT_URL  = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_KEY  = os.getenv("QDRANT_API_KEY", "")   # required for Qdrant Cloud
VECTOR_SIZE = 768   # Gemini text-embedding-004 output dimension

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_KEY or None)

COLLECTIONS = ["products", "shops", "knowledge_base", "chat_history"]


def ensure_collections():
    """Create collections if they don't exist yet."""
    existing = {c.name for c in client.get_collections().collections}
    for name in COLLECTIONS:
        if name not in existing:
            client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(
                    size=VECTOR_SIZE, distance=Distance.COSINE
                ),
            )

ensure_collections()


def _int_id(key: str) -> int:
    """Deterministic integer ID from a string key (Qdrant requires int or UUID)."""
    return int(hashlib.md5(key.encode()).hexdigest(), 16) % (2**63)


def embed(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts using Gemini text-embedding-004."""
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=texts,
        task_type="retrieval_document",
    )
    return result["embedding"]


def upsert_products(shop_id: int, products: list[dict]):
    texts, points = [], []
    for p in products:
        text = (f"{p['name']} — {p.get('description', '')} "
                f"({p['category']}, ₹{p['price']}/{p['unit']})")
        texts.append(text)
    vectors = embed(texts)
    for p, vec, text in zip(products, vectors, texts):
        points.append(PointStruct(
            id=_int_id(f"prod_{p['id']}"),
            vector=vec,
            payload={
                "text":       text,
                "shop_id":    shop_id,
                "product_id": p["id"],
                "category":   p["category"],
                "price":      p["price"],
                "stock":      p["stock"],
            },
        ))
    client.upsert(collection_name="products", points=points)


def delete_product(product_id: int):
    client.delete(
        collection_name="products",
        points_selector=Filter(
            must=[FieldCondition(
                key="product_id", match=MatchValue(value=product_id)
            )]
        ),
    )


def search_products(
    query: str,
    shop_id: int | None = None,
    n_results: int = 5,
) -> list[dict]:
    q_vec = embed([query])[0]
    f     = Filter(must=[FieldCondition(
                key="shop_id", match=MatchValue(value=shop_id)
            )]) if shop_id else None
    hits = client.search(
        collection_name="products",
        query_vector=q_vec,
        query_filter=f,
        limit=n_results,
        with_payload=True,
    )
    return [{"doc": h.payload["text"], "meta": h.payload, "score": h.score}
            for h in hits]


def search_shops(query: str, n_results: int = 5) -> list[dict]:
    q_vec = embed([query])[0]
    hits  = client.search(
        collection_name="shops",
        query_vector=q_vec,
        limit=n_results,
        with_payload=True,
    )
    return [{"doc": h.payload["text"], "meta": h.payload, "score": h.score}
            for h in hits]
```

---

### 7.3 RAG Pipeline

Every agentic response follows a **Retrieve → Augment → Generate** loop:

```
User query
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  1. RETRIEVE                                                │
│     a. Embed query  →  Qdrant semantic search               │
│     b. Pull top-K documents (products / shops / KB)         │
│     c. Filter by role + shop_id scope                       │
│     d. Re-rank by cosine similarity × recency              │
└──────────────────────────┬──────────────────────────────────┘
                           │  retrieved context (≤ 3000 tokens)
┌──────────────────────────▼──────────────────────────────────┐
│  2. AUGMENT                                                 │
│     Build system prompt with:                               │
│       - Role persona (customer / owner / admin)             │
│       - Retrieved product/shop context                      │
│       - Live data from SQLite (analytics, orders)           │
│       - Chat history (last 6 turns)                         │
└──────────────────────────┬──────────────────────────────────┘
                           │  enriched prompt
┌──────────────────────────▼──────────────────────────────────┐
│  3. GENERATE                                                │
│     Gemini 2.0 Flash generates final response               │
│     Structured output enforced via response_schema          │
│     Sources cited from Qdrant payload metadata              │
└─────────────────────────────────────────────────────────────┘
```

#### Python Implementation

```python
# ai_service/rag.py
from .vector_store import search_products, search_shops
from .db_client import get_shop_analytics, get_recent_orders
import google.generativeai as genai

SYSTEM_PROMPTS = {
    "customer": """You are HyperMart AI, a friendly shopping assistant.
Help customers find products across nearby shops, compare prices, and track orders.
Always suggest relevant products from the context provided.
Respond in the same language the customer uses.""",

    "owner": """You are HyperMart Business AI, an expert retail advisor.
Help shop owners with inventory decisions, pricing strategy, and order management.
Use the provided analytics data to give specific, actionable advice.
Be concise and numbers-driven.""",

    "admin": """You are HyperMart Admin AI.
Help platform administrators monitor shops, resolve issues, and analyse trends.
You have access to all shop and user data. Be precise and factual.""",
}


async def rag_respond(
    message: str,
    role: str,
    shop_id: int | None,
    history: list[dict],
) -> dict:
    # 1. Retrieve
    product_hits = search_products(message, shop_id=shop_id, n_results=5)
    shop_hits    = search_shops(message, n_results=3)
    sources = [h["meta"] for h in product_hits + shop_hits]

    context_blocks = []
    if product_hits:
        context_blocks.append("RELEVANT PRODUCTS:\n" +
            "\n".join(f"- {h['doc']}" for h in product_hits))
    if shop_hits:
        context_blocks.append("RELEVANT SHOPS:\n" +
            "\n".join(f"- {h['doc']}" for h in shop_hits))

    # Live analytics for owner
    if role == "owner" and shop_id:
        analytics = await get_shop_analytics(shop_id)
        context_blocks.append(
            f"LIVE ANALYTICS: Today sales ₹{analytics['today_sales']}, "
            f"orders {analytics['today_orders']}, "
            f"low-stock products: {analytics['low_stock_items']}"
        )

    # 2. Augment
    system = SYSTEM_PROMPTS.get(role, SYSTEM_PROMPTS["customer"])
    if context_blocks:
        system += "\n\nCONTEXT (from knowledge base):\n" + "\n\n".join(context_blocks)

    # 3. Generate
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=system,
    )
    chat = model.start_chat(history=[
        {"role": m["role"], "parts": [m["content"]]} for m in history[-6:]
    ])
    response = await chat.send_message_async(message)

    return {
        "reply":      response.text,
        "tools_used": ["rag_search"],
        "sources":    [s.get("product_id") or s.get("shop_id") for s in sources],
    }
```

---

### 7.4 Agentic AI — Tool-Calling Engine

For complex multi-step queries (e.g. *"Which of my products should I restock before the weekend and what's the predicted demand?"*), the system uses a **LangChain ReAct agent** that plans and executes a sequence of tools before synthesising a final answer.

#### Tool Registry

| Tool name | Description | Input | Output |
|-----------|-------------|-------|--------|
| `rag_search` | Semantic search over Qdrant | `query: str, shop_id?` | Top-K docs + scores |
| `get_shop_analytics` | Live sales/orders/stock from SQLite | `shop_id: int` | Analytics dict |
| `get_inventory` | Full product list for a shop | `shop_id: int` | List of products |
| `get_order_summary` | Recent order pipeline | `shop_id: int, days?: int` | Order counts by status |
| `search_nearby_shops` | Find shops near a coordinate | `lat, lng, radius_km` | List of shops |
| `suggest_products` | Gemini product name suggestions | `category, partial_name` | List[str] |
| `generate_description` | Gemini product description | `name, category` | str |
| `sales_forecast` | 7-day demand forecast | `shop_id, product_ids?` | Forecast dict |
| `get_knowledge_base` | Search admin KB articles | `query: str` | List[str] |

#### Python Implementation

```python
# ai_service/agent.py
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain.tools import tool
from langchain import hub
from .vector_store import search_products, search_shops
from .db_client import (
    get_shop_analytics, get_inventory,
    get_order_summary, search_nearby_shops_db,
)
from .forecaster import forecast_sales
import os

llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    google_api_key=os.environ["GEMINI_API_KEY"],
    temperature=0.3,
)

# ── Tool definitions ──────────────────────────────────────────────────────────

@tool
def rag_search(query: str, shop_id: int = 0) -> str:
    """Search products and shops by semantic similarity. Use for any
    product discovery, price comparison, or shop finding query."""
    p = search_products(query, shop_id=shop_id or None, n_results=5)
    s = search_shops(query, n_results=3)
    results = [f"{r['doc']} (score {r['score']:.2f})" for r in p + s]
    return "\n".join(results) if results else "No results found."


@tool
def get_shop_analytics_tool(shop_id: int) -> str:
    """Get live analytics for a shop: today's sales, orders, low-stock items."""
    import asyncio
    data = asyncio.run(get_shop_analytics(shop_id))
    return str(data)


@tool
def get_inventory_tool(shop_id: int) -> str:
    """Get full product inventory for a shop including stock levels and prices."""
    import asyncio
    products = asyncio.run(get_inventory(shop_id))
    lines = [f"{p['name']}: stock={p['stock']}, price=₹{p['price']}" for p in products]
    return "\n".join(lines)


@tool
def forecast_tool(shop_id: int) -> str:
    """Generate a 7-day sales forecast for the top products in a shop."""
    return str(forecast_sales(shop_id))


ALL_TOOLS = [
    rag_search,
    get_shop_analytics_tool,
    get_inventory_tool,
    forecast_tool,
]

# ── Agent factory ─────────────────────────────────────────────────────────────

prompt = hub.pull("hwchase17/react")

def build_agent(role: str = "owner") -> AgentExecutor:
    persona = (
        "You are HyperMart Business AI helping a shop owner." if role == "owner"
        else "You are HyperMart AI helping a customer find products."
    )
    agent = create_react_agent(llm, ALL_TOOLS, prompt)
    return AgentExecutor(
        agent=agent,
        tools=ALL_TOOLS,
        verbose=True,
        max_iterations=6,
        handle_parsing_errors=True,
        return_intermediate_steps=True,
    )


async def agent_respond(message: str, role: str, shop_id: int | None) -> dict:
    executor = build_agent(role)
    enriched = message
    if shop_id:
        enriched = f"[Context: shop_id={shop_id}]\n{message}"
    result = await executor.ainvoke({"input": enriched})
    tools_used = [
        step[0].tool
        for step in result.get("intermediate_steps", [])
    ]
    return {
        "reply":      result["output"],
        "tools_used": tools_used,
        "sources":    [],
    }
```

---

### 7.5 Chat Endpoint — Router Logic

The `/ai/chat` endpoint automatically decides whether to use the **RAG pipeline** (fast, 1–2s) or the **Agentic engine** (powerful, 3–8s) based on query complexity:

```python
# ai_service/main.py  (excerpt)
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from .rag import rag_respond
from .agent import agent_respond
import re

app = FastAPI(title="HyperMart AI Service", version="1.0.0")

# Keywords that trigger the agentic engine
AGENTIC_PATTERNS = re.compile(
    r"forecast|predict|restock|compare|analyse|analyze|strategy"
    r"|should i|what should|how many|when will|best time",
    re.IGNORECASE,
)


class ChatRequest(BaseModel):
    message:  str
    shop_id:  int | None = None
    role:     str        = "customer"
    history:  list[dict] = []


@app.post("/ai/chat")
async def chat(body: ChatRequest):
    if AGENTIC_PATTERNS.search(body.message):
        return await agent_respond(body.message, body.role, body.shop_id)
    return await rag_respond(body.message, body.role, body.shop_id, body.history)
```

---

### 7.6 Simple AI Endpoints (non-agentic)

These lightweight endpoints remain as direct Gemini calls (no RAG needed):

| Endpoint | Trigger | Input | Output |
|----------|---------|-------|--------|
| `POST /ai/suggest-products` | Owner types ≥ 2 chars in product name | `{category, partial_name}` | `string[]` — 5 names |
| `POST /ai/generate-description` | Owner clicks ✨ in product modal | `{name, category}` | `{description: string}` |
| `POST /ai/low-stock-insight` | Owner Overview tab, low stock present | `{shop_id, shop_name, low_stock_items}` | `{insight: string}` |
| `POST /ai/sales-forecast` | Owner Analytics tab | `{shop_id, days_back?}` | `{forecast: object}` |
| `POST /ai/index-shop` | After shop approval / product save | `{shop_id}` | `{indexed: int}` |
| `GET  /ai/status` | Frontend mount check | — | `{available, vector_db, agent}` |

---

### 7.7 Sales Forecast (Agentic Tool)

```python
# ai_service/forecaster.py
import sqlite3, json
from pathlib import Path

DB_PATH = Path("../backend-node/hypermart.db")

def forecast_sales(shop_id: int, days_back: int = 30) -> dict:
    """
    Simple moving-average forecast over the last `days_back` days.
    Returns predicted daily revenue and top product demand for next 7 days.
    """
    # Pull daily order totals from SQLite
    con = sqlite3.connect(DB_PATH)
    rows = con.execute("""
        SELECT date(created_at) as day, SUM(total) as revenue, COUNT(*) as orders
        FROM orders
        WHERE shop_id = ? AND status = 'delivered'
          AND created_at >= date('now', ? || ' days')
        GROUP BY day ORDER BY day
    """, (shop_id, f"-{days_back}")).fetchall()
    con.close()

    if not rows:
        return {"error": "No delivered orders in period"}

    daily_rev = [r[1] for r in rows]
    avg_daily = sum(daily_rev) / len(daily_rev)
    forecast  = [{"day": f"+{i+1}d", "predicted_revenue": round(avg_daily, 2)}
                 for i in range(7)]
    return {
        "avg_daily_revenue": round(avg_daily, 2),
        "data_points":       len(rows),
        "next_7_days":       forecast,
    }
```

---

### 7.8 Python AI Service — Directory Structure

```
ai_service/
├── main.py           # FastAPI app, /ai/* routes, chat router
├── rag.py            # RAG pipeline (retrieve → augment → generate)
├── agent.py          # LangChain ReAct agent + tool definitions
├── vector_store.py   # Qdrant client, embed(), upsert, search, delete
├── db_client.py      # Async SQLite reads (analytics, inventory, orders)
├── forecaster.py     # Moving-average sales forecast tool
├── requirements.txt  # Python dependencies
└── qdrant_storage/   # Qdrant persistent storage volume (gitignored)
```

#### `ai_service/requirements.txt`

```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
google-generativeai>=0.7.0
qdrant-client>=1.9.0
langchain>=0.2.0
langchain-google-genai>=1.0.0
aiofiles>=23.2.0
httpx>=0.27.0
pydantic>=2.7.0
aiosqlite>=0.20.0
```

#### Start command

```bash
cd ai_service
uvicorn main:app --port 8001 --reload
```

---

### 7.9 Frontend Integration

#### API client additions (`api/client.js`)

```js
// AI chat
export const aiChat = (message, shopId, role, history) =>
  api.post('/api/ai/chat', { message, shop_id: shopId, role, history });

// Product suggestions (debounced, 400ms)
export const aiSuggestProducts = (category, partialName) =>
  api.post('/api/ai/suggest-products', { category, partial_name: partialName });

// Generate description
export const aiGenerateDescription = (name, category) =>
  api.post('/api/ai/generate-description', { name, category });

// Low-stock insight
export const aiLowStockInsight = (shopId, shopName, items) =>
  api.post('/api/ai/low-stock-insight',
    { shop_id: shopId, shop_name: shopName, low_stock_items: items });

// Sales forecast
export const aiSalesForecast = (shopId) =>
  api.post('/api/ai/sales-forecast', { shop_id: shopId });
```

#### AI Chat Widget — placement

| Page | Widget | Role |
|------|--------|------|
| Marketplace | Floating bubble (bottom-right) | `customer` |
| OwnerDashboard | Side panel (slide-in) | `owner` |
| AdminPanel | Embedded in Analytics tab | `admin` |

#### AI Chat Widget behaviour

- Maintains 10-message rolling history in component state
- `shop_id` auto-injected from context when on owner/admin pages
- Shows tool attribution badge (e.g. `🔍 searched products · 📊 analytics`)
- Sources: product names linked to shop product page
- Typing indicator during streaming
- Graceful fallback: if `/ai/status` returns `{available: false}`, widget is hidden entirely

---

### 7.10 Graceful Degradation

| Failure mode | Handling |
|-------------|----------|
| `GEMINI_API_KEY` not set | `/ai/status → {available: false}` — all AI UI hidden |
| Qdrant not reachable | Falls back to direct Gemini (no retrieval context) |
| LangChain agent timeout (>10s) | Falls back to RAG pipeline |
| RAG returns 0 results | Gemini answers from parametric knowledge only |
| Gemini rate limit | 429 → toast "AI temporarily unavailable"; queue retry in 60s |
| Malformed JSON from Gemini | Return empty array / empty string; no crash |
| ai_service unreachable | Node proxy returns `503`; frontend shows retry button |

---

## 8. Map & Location Features

> **Status:** Planned (v3.1). Schema columns (`lat`, `lng`) already exist in the `shops` table.

### 8.1 Shop Location Pin

- Owners can set their shop's GPS coordinates during registration or in shop settings
- Input: latitude/longitude text fields OR a map picker (Leaflet.js + OpenStreetMap)
- Stored in `shops.lat` and `shops.lng`

### 8.2 Nearby Shops (Customer)

- Optional "Near Me" toggle in the Marketplace header
- On activation: browser `navigator.geolocation` → `GET /shops?lat=X&lng=Y&radius=2000`
- Backend computes Haversine distance and returns shops within radius (default 2 km)
- Results sorted by distance ascending

### 8.3 Shop Map View

- Toggle between card grid and map view on the Marketplace page
- Uses Leaflet.js (free, no API key) with OpenStreetMap tiles
- Marker click opens a mini shop card; "View Shop" navigates to shop detail

### 8.4 Delivery Address Map

- Customer can drop a pin on a map to set their delivery address
- Coordinates stored on the order; displayed as a map link to the owner

---

## 9. Subscription System

> **Status:** Planned (v3.2). Database column `subscription_tier` already reserved.

### 9.1 Tiers

| Tier | Price | Features |
|------|-------|---------|
| `free` | ₹0/month | 1 shop, 50 products, basic analytics |
| `pro` | ₹499/month | 3 shops, unlimited products, AI features, priority approval |
| `enterprise` | ₹1499/month | Unlimited shops, white-label receipts, dedicated support |

### 9.2 Enforcement Points

- Shop registration: blocked at limit for `free` tier
- Product creation: blocked at 50 for `free` tier
- AI endpoints: require `pro` or `enterprise` (checked in `ai.py` before Gemini call)
- Analytics export: `pro`+ only

### 9.3 Payment Integration

- Razorpay order created server-side → frontend opens Razorpay checkout
- On payment success webhook: update `users.subscription_tier` + `subscription_expires_at`
- Failed renewals: downgrade to `free` after 7-day grace period

---

## 10. Multi-Language Support

> **Status:** Planned (v3.3). English only in current build.

### 10.1 Target Languages

English (default) · Hindi · Telugu · Tamil · Kannada

### 10.2 Implementation Plan

- `i18next` + `react-i18next` for React
- Translation files at `src/locales/{lang}/common.json`
- Language selector in Profile page → saved to `users.preferred_language`
- RTL support not required for initial languages

### 10.3 Key Strings to Translate

- All UI labels, buttons, and navigation items
- Status badge labels
- Toast messages
- Error messages
- Receipt header/footer

---

## 11. UI/UX Specifications

### Design Tokens

| Token | Value |
|-------|-------|
| Primary | `#6366F1` Indigo 500 |
| Success | `#22C55E` Green 500 |
| Warning | `#F59E0B` Amber 500 |
| Danger | `#EF4444` Red 500 |
| Background | `#F9FAFB` Gray 50 |
| Surface | `#FFFFFF` |
| Border | `#E5E7EB` Gray 200 |
| Font | Inter, System UI fallback |
| Card radius | `0.75rem` |
| Input radius | `0.375rem` |

### Responsive Product Grid

| Breakpoint | Min Width | Columns |
|-----------|----------|---------|
| Default | 0 | 2 |
| `sm` | 640px | 3 |
| `md` | 768px | 4 |
| `lg` | 1024px | 5 |
| `xl` | 1280px | 6 |

### Component Behaviour Standards

| Component | Behaviour |
|-----------|-----------|
| Skeleton loaders | Show on all async loads; min 300ms |
| Toast notifications | Top-right, auto-dismiss 3s, max 3 stacked |
| Modals | Focus trap, close on Escape + backdrop click |
| Empty states | Illustration + contextual CTA |
| Error states | Inline message + retry button |
| Loading buttons | Spinner replaces icon; disabled during request |

### Animations (Framer Motion)

| Trigger | Animation |
|---------|-----------|
| Page transition | Fade + slide, 150ms ease-out |
| Cart item add | Scale bounce |
| Modal open/close | Scale + opacity |
| Status badge change | Colour crossfade |
| Skeleton → content | Fade in |

---

## 12. Navigation & Routing

### Route Map

```
/ (App Root)
├── /                       Sign-In (public)
├── /role-selection         Role picker (auth, no role yet)
├── /marketplace            Shop listing (customer, admin)
│   ├── /:shopId            Shop detail + product grid
│   └── /orders             Customer order history
├── /owner                  Owner dashboard
│   └── ?tab=overview|inventory|orders|billing
├── /admin                  Admin panel
│   └── ?tab=shops|users|analytics
├── /cart                   Cart (customer)
└── /profile                Profile (all roles)
```

### Bottom Navigation

**Customer:** 🏪 Shop → 🛒 Cart (badge) → 👤 Profile

**Owner:** 📊 Stats → 📦 Stock → 🗒 Orders

**Admin:** Top nav only (no bottom nav)

---

## 13. Error Handling & Edge Cases

### Auth Errors

| Scenario | Handling |
|----------|---------|
| Sign-in popup blocked | Toast: "Enable popups and try again" |
| Network offline during auth | Toast: "No internet connection" |
| User closes popup | Silently reset loading state |
| Token expired mid-session | Redirect to sign-in |

### API / Firestore Errors

| Scenario | Handling |
|----------|---------|
| 403 Permission denied | Toast: "You don't have access to this resource" |
| 404 Not found | Redirect to parent view with message |
| Order placement fails | Error toast; cart preserved for retry |
| Network error on mutation | Retry once; then show error toast |

### Cart Edge Cases

| Scenario | Handling |
|----------|---------|
| Add item from different shop | Confirmation modal before clearing cart |
| Product stock → 0 mid-cart | Warn on placement; block if stock = 0 |
| Order write fails | Toast; cart intact for retry |

### Owner Edge Cases

| Scenario | Handling |
|----------|---------|
| Shop still pending | Approval banner; not visible in marketplace |
| Delete product with active orders | Block with message |
| All products out of stock | Warning card on Overview tab |
| No shops registered | "Register your first shop" prompt card |

### AI Edge Cases

| Scenario | Handling |
|----------|---------|
| Key not configured | `GET /ai/status` returns `{available: false}`; all AI UI hidden |
| Gemini API timeout | Silently hide suggestions; no error shown to user |
| Malformed JSON from Gemini | Return empty array; no crash |
| Rate limit hit | Toast: "AI suggestions temporarily unavailable" |

---

## 14. Known Limitations & Backlog

| # | Item | State | Priority |
|---|------|-------|---------|
| 1 | Delivery address | Hardcoded "Default Address" | High |
| 2 | Payment gateway | `paymentStatus` tracked; Razorpay not wired | High |
| 3 | Cart persistence | In-memory; lost on refresh | Medium |
| 4 | Product image upload | URL-only; Storage not wired | Medium |
| 5 | Review & rating system | Static 4.5; no submissions | Medium |
| 6 | Map & GPS | Schema ready; Leaflet not wired | Medium |
| 7 | Subscription system | Schema reserved; not enforced | Medium |
| 8 | Multi-language | English only | Low |
| 9 | WhatsApp / call | Icon shown; no action | Low |
| 10 | PWA | No service worker or manifest | Low |
| 11 | Push notifications | Not implemented | Low |
| 12 | Delivery partner role | Not implemented | Low |

---

## 15. Acceptance Criteria Checklist

### Authentication
- [ ] Google Sign-In works on Chrome, Safari, Firefox (desktop + mobile)
- [ ] First-time users always land on `/role-selection`
- [ ] `senamallas@gmail.com` always gets `admin` role
- [ ] Signed-out users cannot access any protected route
- [ ] Sign-out clears session and redirects to `/`

### Marketplace
- [ ] Location dropdown triggers API call filtered by `locationName`
- [ ] Category chips filter client-side
- [ ] Search debounces 300ms and filters name + category
- [ ] Only `approved` shops visible to customers
- [ ] Product grid is 2–6 columns responsive
- [ ] Quantity controls: min 1, remove at 0
- [ ] Order history shows colour-coded status badges

### Cart
- [ ] Cart badge updates in real time
- [ ] Cross-shop add triggers confirmation modal
- [ ] Place Order creates correct DB record and decrements stock
- [ ] Cart clears after successful placement
- [ ] Empty cart shows CTA

### Owner Dashboard
- [ ] Overview shows today's sales, orders, products
- [ ] Inventory CRUD (add/edit/delete) works
- [ ] New shop registration creates `status: pending` document
- [ ] Pending shop shows banner; not in marketplace
- [ ] Order pipeline moves in sequence (no skipping)
- [ ] Billing: product search, add to bill, receipt generation

### Admin Panel
- [ ] All shops listed with status filter
- [ ] Approve/suspend updates immediately
- [ ] Users listed with role change dropdown

### AI Features
- [ ] Suggestion dropdown appears after 2 chars with 400ms debounce
- [ ] "✨ Generate Description" fills description field
- [ ] Low-stock insight card appears when items ≤ 5 units
- [ ] All AI UI hidden when `GEMINI_API_KEY` missing — no errors

### General Quality
- [ ] All listeners / subscriptions cleaned up on unmount
- [ ] Skeleton loaders on every async fetch
- [ ] Error toasts on all failed writes
- [ ] Fully navigable on 375px mobile viewport
- [ ] No console errors in production build
- [ ] CI deploys on every push to `main`

---

# PART B — IMPLEMENTATION

---

## 16. Project Structure

```
hypermart/
├── backend/
│   ├── database.py          ← SQLite engine + WAL + session factory
│   ├── models.py            ← ORM: User, Shop, Product, Order, OrderItem
│   ├── schemas.py           ← Pydantic v2 request/response models
│   ├── main.py              ← FastAPI routes (CRUD + analytics)
│   ├── ai.py                ← Gemini AI proxy endpoints
│   ├── seed.py              ← Dev seed data
│   └── requirements.txt
└── frontend/
    └── src/
        ├── api/
        │   └── client.js              ← Axios REST + AI client
        ├── context/
        │   └── AppContext.jsx         ← Auth + Cart useReducer
        ├── components/
        │   └── AIAssistant.jsx        ← Reusable AI hook + UI components
        ├── pages/
        │   ├── Marketplace.jsx        ← Customer shop listing
        │   ├── OwnerDashboard.jsx     ← Tabs + AI-powered inventory
        │   └── AdminPanel.jsx         ← Shops · Users · Analytics
        └── App.jsx                    ← Router + auth guard + bottom nav
```

---

## 17. Quick Start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Create .env
echo "DATABASE_URL=sqlite:///./hypermart.db" >> .env
echo "GEMINI_API_KEY=your_key_here"          >> .env

python seed.py                          # populate demo data
uvicorn main:app --reload --port 8000   # → http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" >> .env
npm run dev     # → http://localhost:5174
```

### Demo Accounts (after seed.py)

| Role | Email | UID |
|------|-------|-----|
| Admin | senamallas@gmail.com | admin-001 |
| Owner | anand@example.com | owner-001 |
| Customer | customer1@example.com | cust-001 |

---

## 18. Backend — database.py

```python
"""
HyperMart — Database Configuration
SQLite + SQLAlchemy with session factory and WAL mode.
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from typing import Generator
from models import Base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./hypermart.db")

def _set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
)

if DATABASE_URL.startswith("sqlite"):
    event.listen(engine, "connect", _set_sqlite_pragma)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_tables() -> None:
    Base.metadata.create_all(bind=engine)

def drop_tables() -> None:
    Base.metadata.drop_all(bind=engine)

@contextmanager
def get_db_ctx() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## 19. Backend — models.py

```python
"""
HyperMart — SQLAlchemy ORM Models (SQLite)
5 tables: users · shops · products · orders · order_items
"""

from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

# ── Enums ──────────────────────────────────────────────────────────

class UserRole(str, PyEnum):
    customer = "customer"
    owner    = "owner"
    admin    = "admin"

class ShopStatus(str, PyEnum):
    pending   = "pending"
    approved  = "approved"
    suspended = "suspended"

class ShopCategory(str, PyEnum):
    grocery       = "Grocery"
    dairy         = "Dairy"
    vegetables    = "Vegetables & Fruits"
    meat          = "Meat"
    bakery        = "Bakery & Snacks"
    beverages     = "Beverages"
    household     = "Household"
    personal_care = "Personal Care"

class ShopLocation(str, PyEnum):
    green_valley   = "Green Valley"
    central_market = "Central Market"
    food_plaza     = "Food Plaza"
    milk_lane      = "Milk Lane"
    old_town       = "Old Town"

class ProductStatus(str, PyEnum):
    active       = "active"
    out_of_stock = "out_of_stock"

class OrderStatus(str, PyEnum):
    pending          = "pending"
    accepted         = "accepted"
    ready            = "ready"
    out_for_delivery = "out_for_delivery"
    delivered        = "delivered"
    rejected         = "rejected"

class PaymentStatus(str, PyEnum):
    pending = "pending"
    paid    = "paid"

# ── Models ─────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    uid          = Column(String(128), unique=True, nullable=False, index=True)
    email        = Column(String(255), unique=True, nullable=False, index=True)
    display_name = Column(String(255), nullable=False)
    photo_url    = Column(String(1024), nullable=True)
    role         = Column(Enum(UserRole), nullable=False, default=UserRole.customer)
    phone        = Column(String(20), nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    shops  = relationship("Shop",  back_populates="owner",    cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="customer", cascade="all, delete-orphan")

class Shop(Base):
    __tablename__ = "shops"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    owner_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name          = Column(String(255), nullable=False)
    address       = Column(Text, nullable=False)
    category      = Column(Enum(ShopCategory), nullable=False)
    location_name = Column(Enum(ShopLocation), nullable=False, index=True)
    status        = Column(Enum(ShopStatus), nullable=False, default=ShopStatus.pending, index=True)
    logo          = Column(String(1024), nullable=True)
    timings       = Column(String(100), nullable=True)
    lat           = Column(Float, nullable=True)   # reserved for §8 Map features
    lng           = Column(Float, nullable=True)
    rating        = Column(Float, nullable=False, default=4.5)
    review_count  = Column(Integer, nullable=False, default=0)
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)
    owner    = relationship("User",    back_populates="shops")
    products = relationship("Product", back_populates="shop", cascade="all, delete-orphan")
    orders   = relationship("Order",   back_populates="shop")

class Product(Base):
    __tablename__ = "products"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    shop_id    = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    name       = Column(String(255), nullable=False)
    price      = Column(Float, nullable=False)
    mrp        = Column(Float, nullable=False)
    unit       = Column(String(50), nullable=False)
    category   = Column(Enum(ShopCategory), nullable=False)
    stock      = Column(Integer, nullable=False, default=0)
    image      = Column(String(1024), nullable=True)
    status     = Column(Enum(ProductStatus), nullable=False, default=ProductStatus.active, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    shop        = relationship("Shop", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")

class Order(Base):
    __tablename__ = "orders"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    shop_id          = Column(Integer, ForeignKey("shops.id",  ondelete="RESTRICT"), nullable=False, index=True)
    shop_name        = Column(String(255), nullable=False)
    customer_id      = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    total            = Column(Float, nullable=False)
    status           = Column(Enum(OrderStatus), nullable=False, default=OrderStatus.pending, index=True)
    payment_status   = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.pending)
    delivery_address = Column(Text, nullable=False)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at       = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    shop     = relationship("Shop", back_populates="orders")
    customer = relationship("User", back_populates="orders")
    items    = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    order_id   = Column(Integer, ForeignKey("orders.id",   ondelete="CASCADE"),  nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    name       = Column(String(255), nullable=False)   # snapshot
    price      = Column(Float, nullable=False)          # snapshot
    quantity   = Column(Integer, nullable=False)
    order   = relationship("Order",   back_populates="items")
    product = relationship("Product", back_populates="order_items")

    @property
    def line_total(self) -> float:
        return round(self.price * self.quantity, 2)
```

---

## 20. Backend — schemas.py

```python
"""
HyperMart — Pydantic v2 Schemas
Validation for all request/response bodies.
"""

from datetime import datetime
from typing import Optional, List, ClassVar, Dict
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from models import UserRole, ShopStatus, ShopCategory, ShopLocation
from models import ProductStatus, OrderStatus, PaymentStatus

class OrmBase(BaseModel):
    model_config = {"from_attributes": True}

# ── User ────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    uid: str;  email: EmailStr;  display_name: str
    photo_url: Optional[str] = None
    role:      UserRole       = UserRole.customer
    phone:     Optional[str] = None

class UserUpdate(BaseModel):
    display_name: Optional[str]      = None
    photo_url:    Optional[str]      = None
    role:         Optional[UserRole] = None
    phone:        Optional[str]      = None

class UserOut(OrmBase):
    id: int;  uid: str;  email: str;  display_name: str
    photo_url: Optional[str];  role: UserRole;  phone: Optional[str]
    created_at: datetime;  last_login: Optional[datetime]

# ── Shop ────────────────────────────────────────────────────────────

class ShopCreate(BaseModel):
    name: str;  address: str;  category: ShopCategory;  location_name: ShopLocation
    logo: Optional[str] = None;  timings: Optional[str] = None
    lat:  Optional[float] = None;  lng: Optional[float] = None

    @field_validator("name")
    @classmethod
    def name_min_length(cls, v: str) -> str:
        if len(v.strip()) < 3:
            raise ValueError("Shop name must be at least 3 characters")
        return v.strip()

class ShopUpdate(BaseModel):
    name:          Optional[str]          = None
    address:       Optional[str]          = None
    category:      Optional[ShopCategory] = None
    location_name: Optional[ShopLocation] = None
    logo:          Optional[str]          = None
    timings:       Optional[str]          = None
    status:        Optional[ShopStatus]   = None
    lat:           Optional[float]        = None
    lng:           Optional[float]        = None

class ShopOut(OrmBase):
    id: int;  owner_id: int;  name: str;  address: str
    category: ShopCategory;  location_name: ShopLocation;  status: ShopStatus
    logo: Optional[str];  timings: Optional[str]
    lat: Optional[float];  lng: Optional[float]
    rating: float;  review_count: int;  created_at: datetime

class ShopStatusUpdate(BaseModel):
    status: ShopStatus

# ── Product ─────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str;  price: float;  mrp: float;  unit: str
    category: ShopCategory;  stock: int = 0
    image:  Optional[str]  = None
    status: ProductStatus  = ProductStatus.active

    @field_validator("price", "mrp")
    @classmethod
    def positive_price(cls, v):
        if v <= 0: raise ValueError("Price must be > 0")
        return v

    @model_validator(mode="after")
    def mrp_gte_price(self):
        if self.mrp < self.price: raise ValueError("MRP must be >= price")
        return self

    @field_validator("stock")
    @classmethod
    def non_negative_stock(cls, v):
        if v < 0: raise ValueError("Stock cannot be negative")
        return v

class ProductUpdate(BaseModel):
    name:     Optional[str]           = None
    price:    Optional[float]         = None
    mrp:      Optional[float]         = None
    unit:     Optional[str]           = None
    category: Optional[ShopCategory]  = None
    stock:    Optional[int]           = None
    image:    Optional[str]           = None
    status:   Optional[ProductStatus] = None

class ProductOut(OrmBase):
    id: int;  shop_id: int;  name: str;  price: float;  mrp: float
    unit: str;  category: ShopCategory;  stock: int
    image: Optional[str];  status: ProductStatus;  created_at: datetime

# ── Orders ──────────────────────────────────────────────────────────

class OrderItemIn(BaseModel):
    product_id: int;  quantity: int
    @field_validator("quantity")
    @classmethod
    def positive_qty(cls, v):
        if v < 1: raise ValueError("Quantity must be ≥ 1")
        return v

class OrderCreate(BaseModel):
    shop_id: int;  items: List[OrderItemIn]
    delivery_address: str = "Default Address"
    @field_validator("items")
    @classmethod
    def non_empty(cls, v):
        if not v: raise ValueError("Order must have at least one item")
        return v

class OrderItemOut(OrmBase):
    id: int;  product_id: int;  name: str;  price: float
    quantity: int;  line_total: float

class OrderOut(OrmBase):
    id: int;  shop_id: int;  shop_name: str;  customer_id: int
    items: List[OrderItemOut];  total: float;  status: OrderStatus
    payment_status: PaymentStatus;  delivery_address: str
    created_at: datetime;  updated_at: Optional[datetime]

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

    VALID_TRANSITIONS: ClassVar[Dict] = {
        OrderStatus.pending:          {OrderStatus.accepted, OrderStatus.rejected},
        OrderStatus.accepted:         {OrderStatus.ready,    OrderStatus.rejected},
        OrderStatus.ready:            {OrderStatus.out_for_delivery},
        OrderStatus.out_for_delivery: {OrderStatus.delivered},
        OrderStatus.delivered:        set(),
        OrderStatus.rejected:         set(),
    }

    @classmethod
    def validate_transition(cls, current: OrderStatus, next_: OrderStatus) -> None:
        allowed = cls.VALID_TRANSITIONS.get(current, set())
        if next_ not in allowed:
            raise ValueError(
                f"Cannot transition '{current}' → '{next_}'. "
                f"Allowed: {[s.value for s in allowed]}"
            )

# ── Analytics ────────────────────────────────────────────────────────

class PlatformAnalytics(BaseModel):
    total_shops: int;  approved_shops: int;  total_users: int
    total_orders: int;  delivered_revenue: float

class ShopAnalytics(BaseModel):
    today_sales: float;  today_orders: int
    total_products: int;  low_stock_items: List[str]

class PaginatedShops(BaseModel):
    items: List[ShopOut];  total: int;  page: int;  size: int

class PaginatedOrders(BaseModel):
    items: List[OrderOut];  total: int;  page: int;  size: int
```

---

## 21. Backend — main.py

```python
"""
HyperMart — FastAPI Application
Full CRUD: users · shops · products · orders · analytics
AI routes are in ai.py and mounted here.
"""

from datetime import datetime, date
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import models as M, schemas as S
from database import get_db, create_tables
from ai import router as ai_router

app = FastAPI(title="HyperMart API", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://localhost:5174","http://localhost:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)
app.include_router(ai_router)   # mounts /ai/* endpoints

@app.on_event("startup")
def startup(): create_tables()

ADMIN_EMAIL = "senamallas@gmail.com"

# ── Auth helpers ──────────────────────────────────────────────────────────────

def get_current_user(uid: str = Query(...), db: Session = Depends(get_db)) -> M.User:
    user = db.query(M.User).filter(M.User.uid == uid).first()
    if not user: raise HTTPException(401, "User not found")
    if user.email == ADMIN_EMAIL and user.role != M.UserRole.admin:
        user.role = M.UserRole.admin; db.commit()
    return user

def require_role(*roles):
    def _dep(u: M.User = Depends(get_current_user)):
        if u.role not in roles: raise HTTPException(403, "Insufficient permissions")
        return u
    return _dep

# ── Users ─────────────────────────────────────────────────────────────────────

@app.post("/users", response_model=S.UserOut, status_code=201)
def create_user(payload: S.UserCreate, db: Session = Depends(get_db)):
    if db.query(M.User).filter(M.User.uid == payload.uid).first():
        raise HTTPException(400, "User already exists")
    user = M.User(**payload.model_dump()); db.add(user); db.commit(); db.refresh(user)
    return user

@app.get("/users/me", response_model=S.UserOut)
def get_me(u: M.User = Depends(get_current_user)): return u

@app.patch("/users/me", response_model=S.UserOut)
def update_me(payload: S.UserUpdate, u: M.User = Depends(get_current_user), db: Session = Depends(get_db)):
    for f, v in payload.model_dump(exclude_none=True).items():
        if f == "role" and u.role != M.UserRole.admin: continue
        setattr(u, f, v)
    u.last_login = datetime.utcnow(); db.commit(); db.refresh(u); return u

@app.get("/users", response_model=List[S.UserOut])
def list_users(_: M.User = Depends(require_role(M.UserRole.admin)), db: Session = Depends(get_db)):
    return db.query(M.User).order_by(M.User.created_at.desc()).all()

@app.patch("/users/{user_id}/role", response_model=S.UserOut)
def change_role(user_id: int, payload: S.UserUpdate,
                _: M.User = Depends(require_role(M.UserRole.admin)), db: Session = Depends(get_db)):
    user = db.get(M.User, user_id)
    if not user: raise HTTPException(404, "User not found")
    if payload.role: user.role = payload.role
    db.commit(); db.refresh(user); return user

# ── Shops ─────────────────────────────────────────────────────────────────────

@app.get("/shops", response_model=S.PaginatedShops)
def list_shops(location: Optional[M.ShopLocation]=None, category: Optional[M.ShopCategory]=None,
               status: Optional[M.ShopStatus]=None, search: Optional[str]=None,
               page: int=Query(1,ge=1), size: int=Query(20,ge=1,le=100),
               current_user: M.User=Depends(get_current_user), db: Session=Depends(get_db)):
    q = db.query(M.Shop)
    if current_user.role != M.UserRole.admin:
        q = q.filter(M.Shop.status == M.ShopStatus.approved)
    elif status: q = q.filter(M.Shop.status == status)
    if location: q = q.filter(M.Shop.location_name == location)
    if category: q = q.filter(M.Shop.category == category)
    if search:
        like = f"%{search}%"
        q = q.filter(M.Shop.name.ilike(like) | M.Shop.category.ilike(like))
    total = q.count()
    items = q.order_by(M.Shop.created_at.desc()).offset((page-1)*size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}

@app.post("/shops", response_model=S.ShopOut, status_code=201)
def create_shop(payload: S.ShopCreate,
                u: M.User=Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
                db: Session=Depends(get_db)):
    shop = M.Shop(owner_id=u.id, **payload.model_dump())
    db.add(shop); db.commit(); db.refresh(shop); return shop

@app.get("/shops/{shop_id}", response_model=S.ShopOut)
def get_shop(shop_id: int, _: M.User=Depends(get_current_user), db: Session=Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    return shop

@app.patch("/shops/{shop_id}", response_model=S.ShopOut)
def update_shop(shop_id: int, payload: S.ShopUpdate,
                u: M.User=Depends(get_current_user), db: Session=Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    _assert_ownership(shop, u)
    data = payload.model_dump(exclude_none=True)
    if "status" in data and u.role != M.UserRole.admin: del data["status"]
    for f, v in data.items(): setattr(shop, f, v)
    db.commit(); db.refresh(shop); return shop

@app.patch("/shops/{shop_id}/status", response_model=S.ShopOut)
def set_shop_status(shop_id: int, payload: S.ShopStatusUpdate,
                    _: M.User=Depends(require_role(M.UserRole.admin)), db: Session=Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    shop.status = payload.status; db.commit(); db.refresh(shop); return shop

@app.delete("/shops/{shop_id}", status_code=204)
def delete_shop(shop_id: int, _: M.User=Depends(require_role(M.UserRole.admin)), db: Session=Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    db.delete(shop); db.commit()

@app.get("/owners/me/shops", response_model=List[S.ShopOut])
def my_shops(u: M.User=Depends(require_role(M.UserRole.owner, M.UserRole.admin)), db: Session=Depends(get_db)):
    return db.query(M.Shop).filter(M.Shop.owner_id == u.id).all()

# ── Products ──────────────────────────────────────────────────────────────────

@app.get("/shops/{shop_id}/products", response_model=List[S.ProductOut])
def list_products(shop_id: int, active_only: bool=True,
                  _: M.User=Depends(get_current_user), db: Session=Depends(get_db)):
    q = db.query(M.Product).filter(M.Product.shop_id == shop_id)
    if active_only: q = q.filter(M.Product.status == M.ProductStatus.active)
    return q.order_by(M.Product.name).all()

@app.post("/shops/{shop_id}/products", response_model=S.ProductOut, status_code=201)
def create_product(shop_id: int, payload: S.ProductCreate,
                   u: M.User=Depends(get_current_user), db: Session=Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    _assert_ownership(shop, u)
    p = M.Product(shop_id=shop_id, **payload.model_dump())
    db.add(p); db.commit(); db.refresh(p); return p

@app.patch("/shops/{shop_id}/products/{product_id}", response_model=S.ProductOut)
def update_product(shop_id: int, product_id: int, payload: S.ProductUpdate,
                   u: M.User=Depends(get_current_user), db: Session=Depends(get_db)):
    p = _product_or_404(db, shop_id, product_id)
    _assert_ownership(p.shop, u)
    for f, v in payload.model_dump(exclude_none=True).items(): setattr(p, f, v)
    db.commit(); db.refresh(p); return p

@app.delete("/shops/{shop_id}/products/{product_id}", status_code=204)
def delete_product(shop_id: int, product_id: int,
                   u: M.User=Depends(get_current_user), db: Session=Depends(get_db)):
    p = _product_or_404(db, shop_id, product_id)
    _assert_ownership(p.shop, u)
    active = (db.query(M.OrderItem).join(M.Order)
                .filter(M.OrderItem.product_id == product_id,
                        M.Order.status.notin_([M.OrderStatus.delivered, M.OrderStatus.rejected]))
                .count())
    if active: raise HTTPException(409, "Product has active orders — cannot delete")
    db.delete(p); db.commit()

# ── Orders ────────────────────────────────────────────────────────────────────

@app.post("/orders", response_model=S.OrderOut, status_code=201)
def place_order(payload: S.OrderCreate,
                u: M.User=Depends(require_role(M.UserRole.customer)), db: Session=Depends(get_db)):
    shop = db.get(M.Shop, payload.shop_id)
    if not shop or shop.status != M.ShopStatus.approved:
        raise HTTPException(404, "Shop not found or not available")
    order_items, total = [], 0.0
    for item_in in payload.items:
        p = db.get(M.Product, item_in.product_id)
        if not p or p.shop_id != shop.id: raise HTTPException(422, f"Product {item_in.product_id} not in this shop")
        if p.stock < item_in.quantity: raise HTTPException(422, f"Insufficient stock for '{p.name}'")
        order_items.append(M.OrderItem(product_id=p.id, name=p.name, price=p.price, quantity=item_in.quantity))
        total += p.price * item_in.quantity
        p.stock -= item_in.quantity
    order = M.Order(shop_id=shop.id, shop_name=shop.name, customer_id=u.id,
                    items=order_items, total=round(total,2), delivery_address=payload.delivery_address)
    db.add(order); db.commit(); db.refresh(order); return order

@app.get("/orders/me", response_model=S.PaginatedOrders)
def my_orders(page: int=Query(1,ge=1), size: int=Query(20,ge=1,le=100),
              u: M.User=Depends(require_role(M.UserRole.customer)), db: Session=Depends(get_db)):
    q = db.query(M.Order).filter(M.Order.customer_id == u.id)
    total = q.count()
    items = q.order_by(M.Order.created_at.desc()).offset((page-1)*size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}

@app.get("/shops/{shop_id}/orders", response_model=S.PaginatedOrders)
def shop_orders(shop_id: int, page: int=Query(1,ge=1), size: int=Query(20,ge=1,le=100),
                u: M.User=Depends(get_current_user), db: Session=Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    _assert_ownership(shop, u)
    q = db.query(M.Order).filter(M.Order.shop_id == shop_id)
    total = q.count()
    items = q.order_by(M.Order.created_at.desc()).offset((page-1)*size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}

@app.patch("/orders/{order_id}/status", response_model=S.OrderOut)
def update_order_status(order_id: int, payload: S.OrderStatusUpdate,
                        u: M.User=Depends(get_current_user), db: Session=Depends(get_db)):
    order = db.get(M.Order, order_id)
    if not order: raise HTTPException(404, "Order not found")
    if u.role != M.UserRole.admin:
        shop = db.get(M.Shop, order.shop_id)
        if not shop or shop.owner_id != u.id: raise HTTPException(403, "Not authorised")
    try: S.OrderStatusUpdate.validate_transition(order.status, payload.status)
    except ValueError as e: raise HTTPException(422, str(e))
    order.status = payload.status; order.updated_at = datetime.utcnow()
    db.commit(); db.refresh(order); return order

# ── Analytics ─────────────────────────────────────────────────────────────────

@app.get("/analytics/platform", response_model=S.PlatformAnalytics)
def platform_analytics(_: M.User=Depends(require_role(M.UserRole.admin)), db: Session=Depends(get_db)):
    rev = db.query(func.sum(M.Order.total)).filter(M.Order.status==M.OrderStatus.delivered).scalar() or 0.0
    return {"total_shops": db.query(M.Shop).count(),
            "approved_shops": db.query(M.Shop).filter(M.Shop.status==M.ShopStatus.approved).count(),
            "total_users": db.query(M.User).count(),
            "total_orders": db.query(M.Order).count(),
            "delivered_revenue": round(rev, 2)}

@app.get("/shops/{shop_id}/analytics", response_model=S.ShopAnalytics)
def shop_analytics(shop_id: int, u: M.User=Depends(get_current_user), db: Session=Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    _assert_ownership(shop, u)
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_orders = db.query(M.Order).filter(and_(M.Order.shop_id==shop_id, M.Order.created_at>=today_start)).all()
    low = db.query(M.Product.name).filter(M.Product.shop_id==shop_id, M.Product.stock<=5,
                                          M.Product.status==M.ProductStatus.active).all()
    return {"today_sales": round(sum(o.total for o in today_orders), 2),
            "today_orders": len(today_orders),
            "total_products": db.query(M.Product).filter(M.Product.shop_id==shop_id).count(),
            "low_stock_items": [r.name for r in low]}

# ── Private helpers ───────────────────────────────────────────────────────────

def _product_or_404(db, shop_id, product_id):
    p = db.query(M.Product).filter(M.Product.id==product_id, M.Product.shop_id==shop_id).first()
    if not p: raise HTTPException(404, "Product not found")
    return p

def _assert_ownership(shop, user):
    if user.role == M.UserRole.admin: return
    if user.role == M.UserRole.owner and shop.owner_id == user.id: return
    raise HTTPException(403, "Not authorised for this shop")
```

---

## 22. Backend — ai.py (Gemini)

```python
"""
HyperMart — Gemini AI Proxy
All AI calls routed through here so GEMINI_API_KEY stays server-side.
Mount in main.py: app.include_router(ai_router)
"""

import os, json, httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/ai", tags=["AI"])

GEMINI_KEY   = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL   = ("https://generativelanguage.googleapis.com/v1beta"
                "/models/gemini-2.0-flash:generateContent")
AI_AVAILABLE = bool(GEMINI_KEY)


async def call_gemini(prompt: str) -> str:
    """Send a prompt to Gemini and return the response text."""
    if not AI_AVAILABLE:
        raise HTTPException(503, "Gemini API key not configured")
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f"{GEMINI_URL}?key={GEMINI_KEY}", json=payload)
        r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


# ── /ai/status ────────────────────────────────────────────────────────────────

@router.get("/status")
def ai_status():
    """Frontend checks this on mount to show/hide AI UI elements."""
    return {"available": AI_AVAILABLE}


# ── /ai/suggest-products ──────────────────────────────────────────────────────

class SuggestRequest(BaseModel):
    category:     str
    partial_name: str

@router.post("/suggest-products")
async def suggest_products(body: SuggestRequest) -> List[str]:
    """
    Returns up to 5 product name suggestions.
    Called after 400ms debounce when owner types ≥ 2 chars.
    """
    prompt = (
        f"You are a product naming assistant for a hyperlocal grocery marketplace in India.\n"
        f"Category: {body.category}\n"
        f"Partial name typed: \"{body.partial_name}\"\n"
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
        return []   # Fail silently — UI falls back to normal input


# ── /ai/generate-description ──────────────────────────────────────────────────

class DescribeRequest(BaseModel):
    name:     str
    category: str

@router.post("/generate-description")
async def generate_description(body: DescribeRequest) -> dict:
    """
    Returns a single-sentence product description.
    Called when owner clicks '✨ Generate Description' in product modal.
    """
    prompt = (
        f"Write a single short sentence (max 15 words) describing \"{body.name}\" "
        f"for an online grocery store in the \"{body.category}\" category. "
        f"Be factual and friendly. "
        f"Respond with ONLY the description sentence — no quotes, no punctuation at the end."
    )
    try:
        text = await call_gemini(prompt)
        return {"description": text}
    except Exception:
        return {"description": ""}


# ── /ai/low-stock-insight ─────────────────────────────────────────────────────

class LowStockRequest(BaseModel):
    shop_name:       str
    low_stock_items: List[str]

@router.post("/low-stock-insight")
async def low_stock_insight(body: LowStockRequest) -> dict:
    """
    Returns 2-3 sentences of restocking advice.
    Shown as a collapsible insight card on the Owner Overview tab.
    """
    if not body.low_stock_items:
        return {"insight": ""}
    items_list = ", ".join(body.low_stock_items)
    prompt = (
        f"You are an inventory advisor for a small neighbourhood shop called \"{body.shop_name}\".\n"
        f"The following products are running low (≤ 5 units): {items_list}.\n"
        f"Give 2–3 short, practical sentences of advice on restocking priorities "
        f"and what to order first. Be concise and specific to these items."
    )
    try:
        text = await call_gemini(prompt)
        return {"insight": text}
    except Exception:
        return {"insight": ""}
```

---

## 23. Backend — seed.py

```python
"""
HyperMart — Dev Seed Script
Run: python seed.py
"""

from datetime import datetime, timedelta
from database import create_tables, get_db_ctx
from models import (User, Shop, Product, Order, OrderItem,
                    UserRole, ShopStatus, ShopCategory, ShopLocation,
                    OrderStatus, PaymentStatus)

def run():
    create_tables()
    with get_db_ctx() as db:

        # Users
        users_data = [
            dict(uid="admin-001", email="senamallas@gmail.com", display_name="Admin", role=UserRole.admin),
            dict(uid="owner-001", email="anand@example.com",    display_name="Anand Kumar", role=UserRole.owner),
            dict(uid="owner-002", email="priya@example.com",    display_name="Priya Sharma", role=UserRole.owner),
            dict(uid="cust-001",  email="customer1@example.com",display_name="Ravi Verma",  role=UserRole.customer),
        ]
        users = []
        for d in users_data:
            u = db.query(User).filter(User.uid == d["uid"]).first() or User(**d)
            db.add(u); db.flush(); users.append(u)

        # Shops
        shops_data = [
            dict(owner=users[1], name="Anand Groceries",   category=ShopCategory.grocery,
                 location_name=ShopLocation.green_valley,   address="12, Main St, Green Valley",
                 timings="8 AM – 10 PM", status=ShopStatus.approved),
            dict(owner=users[1], name="Anand Dairy Fresh",  category=ShopCategory.dairy,
                 location_name=ShopLocation.milk_lane,      address="5, Milk Lane, Sector 4",
                 timings="6 AM – 8 PM",  status=ShopStatus.approved),
            dict(owner=users[2], name="Priya Bakery",       category=ShopCategory.bakery,
                 location_name=ShopLocation.central_market, address="27, Baker St",
                 timings="7 AM – 9 PM",  status=ShopStatus.pending),
        ]
        shops = []
        for d in shops_data:
            owner = d.pop("owner")
            s = db.query(Shop).filter(Shop.name == d["name"]).first() or Shop(owner_id=owner.id, **d)
            db.add(s); db.flush(); shops.append(s)

        # Products
        prods_data = [
            dict(shop=shops[0], name="Basmati Rice (5 kg)", category=ShopCategory.grocery, price=320, mrp=370, unit="5kg", stock=50),
            dict(shop=shops[0], name="Toor Dal (1 kg)",     category=ShopCategory.grocery, price=130, mrp=145, unit="1kg", stock=80),
            dict(shop=shops[0], name="Sunflower Oil (1L)",  category=ShopCategory.grocery, price=155, mrp=175, unit="1L",  stock=30),
            dict(shop=shops[1], name="Full Cream Milk (1L)",category=ShopCategory.dairy,   price=62,  mrp=65,  unit="1L",  stock=120),
            dict(shop=shops[1], name="Paneer (200g)",       category=ShopCategory.dairy,   price=90,  mrp=100, unit="200g",stock=40),
            dict(shop=shops[1], name="Butter (100g)",       category=ShopCategory.dairy,   price=55,  mrp=60,  unit="100g",stock=3),  # low stock
            dict(shop=shops[2], name="Multigrain Bread",    category=ShopCategory.bakery,  price=40,  mrp=45,  unit="loaf",stock=25),
        ]
        prods = []
        for d in prods_data:
            shop = d.pop("shop")
            p = db.query(Product).filter(Product.shop_id==shop.id, Product.name==d["name"]).first() \
                or Product(shop_id=shop.id, **d)
            db.add(p); db.flush(); prods.append(p)

        # Sample order
        if not db.query(Order).filter(Order.customer_id==users[3].id).first():
            rice, dal = prods[0], prods[1]
            db.add(Order(
                shop_id=shops[0].id, shop_name=shops[0].name,
                customer_id=users[3].id,
                total=rice.price*2 + dal.price,
                status=OrderStatus.accepted, payment_status=PaymentStatus.pending,
                delivery_address="Plot 4, Green Valley Colony",
                created_at=datetime.utcnow() - timedelta(hours=2),
                items=[
                    OrderItem(product_id=rice.id, name=rice.name, price=rice.price, quantity=2),
                    OrderItem(product_id=dal.id,  name=dal.name,  price=dal.price,  quantity=1),
                ]
            ))

    print("✅  Seed complete.")
    print("   Admin   : senamallas@gmail.com  (uid: admin-001)")
    print("   Owner   : anand@example.com     (uid: owner-001)")
    print("   Customer: customer1@example.com (uid: cust-001)")

if __name__ == "__main__":
    run()
```

---

## 24. Backend — requirements.txt

```
fastapi==0.115.6
uvicorn[standard]==0.32.1
sqlalchemy==2.0.36
pydantic[email]==2.10.3
httpx==0.28.1
python-dotenv==1.0.1
pytest==8.3.4
pytest-asyncio==0.24.0
```

---

## 25. Frontend — api/client.js

```javascript
// src/api/client.js
// Axios REST client — replaces all Firebase Firestore SDK calls.
// AI endpoints added for Gemini features.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: BASE_URL });

// Attach UID as query param. Swap for Authorization: Bearer <JWT> in production.
api.interceptors.request.use((config) => {
  const uid = localStorage.getItem('hypermart_uid');
  if (uid) config.params = { ...(config.params || {}), uid };
  return config;
});

// ── Users ─────────────────────────────────────────────────────────────────────
export const createUser = (data)      => api.post('/users', data);
export const getMe      = ()          => api.get('/users/me');
export const updateMe   = (data)      => api.patch('/users/me', data);
export const listUsers  = ()          => api.get('/users');
export const changeRole = (id, role)  => api.patch(`/users/${id}/role`, { role });

// ── Shops ─────────────────────────────────────────────────────────────────────
// params: { location, category, status, search, page, size }
export const listShops        = (params={})      => api.get('/shops', { params });
export const createShop       = (data)           => api.post('/shops', data);
export const getShop          = (id)             => api.get(`/shops/${id}`);
export const updateShop       = (id, data)       => api.patch(`/shops/${id}`, data);
export const updateShopStatus = (id, status)     => api.patch(`/shops/${id}/status`, { status });
export const deleteShop       = (id)             => api.delete(`/shops/${id}`);
export const getMyShops       = ()               => api.get('/owners/me/shops');

// ── Products ──────────────────────────────────────────────────────────────────
export const listProducts  = (shopId, activeOnly=true) =>
  api.get(`/shops/${shopId}/products`, { params: { active_only: activeOnly } });
export const createProduct = (shopId, data)            => api.post(`/shops/${shopId}/products`, data);
export const updateProduct = (shopId, pid, data)       => api.patch(`/shops/${shopId}/products/${pid}`, data);
export const deleteProduct = (shopId, pid)             => api.delete(`/shops/${shopId}/products/${pid}`);

// ── Orders ────────────────────────────────────────────────────────────────────
export const placeOrder        = (data)            => api.post('/orders', data);
export const getMyOrders       = (page=1)          => api.get('/orders/me', { params: { page } });
export const getShopOrders     = (shopId, page=1)  => api.get(`/shops/${shopId}/orders`, { params: { page } });
export const updateOrderStatus = (orderId, status) => api.patch(`/orders/${orderId}/status`, { status });

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getPlatformAnalytics = ()       => api.get('/analytics/platform');
export const getShopAnalytics     = (shopId) => api.get(`/shops/${shopId}/analytics`);

// ── AI (Gemini) ───────────────────────────────────────────────────────────────
export const getAIStatus          = ()                          => api.get('/ai/status');
export const suggestProducts      = (category, partial_name)   => api.post('/ai/suggest-products',   { category, partial_name });
export const generateDescription  = (name, category)           => api.post('/ai/generate-description', { name, category });
export const getLowStockInsight   = (shop_name, low_stock_items) => api.post('/ai/low-stock-insight', { shop_name, low_stock_items });
```

---

## 26. Frontend — context/AppContext.jsx

```jsx
// src/context/AppContext.jsx
// Global state: Auth + Cart + AI availability.

import { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';
import { getMe, getAIStatus } from '../api/client';

// ── Cart Reducer ──────────────────────────────────────────────────────────────

const cartInitial = { shopId: null, shopName: null, items: [] };

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const { shopId, shopName, item } = action;
      if (state.shopId && state.shopId !== shopId) return state;
      const existing = state.items.find(i => i.productId === item.productId);
      const items = existing
        ? state.items.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i)
        : [...state.items, { ...item, quantity: 1 }];
      return { shopId, shopName, items };
    }
    case 'REMOVE': {
      const items = state.items.filter(i => i.productId !== action.productId);
      return items.length ? { ...state, items } : cartInitial;
    }
    case 'UPDATE_QTY': {
      if (action.qty < 1) {
        const items = state.items.filter(i => i.productId !== action.productId);
        return items.length ? { ...state, items } : cartInitial;
      }
      return { ...state, items: state.items.map(i =>
        i.productId === action.productId ? { ...i, quantity: action.qty } : i) };
    }
    case 'CLEAR':  return cartInitial;
    default:       return state;
  }
}

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':   return { user: action.user, loading: false, error: null };
    case 'CLEAR_USER': return { user: null,         loading: false, error: null };
    default:           return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [auth, authDispatch] = useReducer(authReducer, { user: null, loading: true, error: null });
  const [cart, cartDispatch] = useReducer(cartReducer, cartInitial);
  const [aiAvailable, setAiAvailable] = useState(false);

  // Restore session + check AI availability
  useEffect(() => {
    const uid = localStorage.getItem('hypermart_uid');
    if (!uid) { authDispatch({ type: 'CLEAR_USER' }); return; }
    getMe()
      .then(res => authDispatch({ type: 'SET_USER', user: res.data }))
      .catch(() => { localStorage.removeItem('hypermart_uid'); authDispatch({ type: 'CLEAR_USER' }); });
  }, []);

  useEffect(() => {
    getAIStatus()
      .then(res => setAiAvailable(res.data.available))
      .catch(() => setAiAvailable(false));
  }, []);

  const signIn  = useCallback((userData) => {
    localStorage.setItem('hypermart_uid', userData.uid);
    authDispatch({ type: 'SET_USER', user: userData });
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('hypermart_uid');
    authDispatch({ type: 'CLEAR_USER' });
    cartDispatch({ type: 'CLEAR' });
  }, []);

  const addToCart      = useCallback((shopId, shopName, item) =>
    cartDispatch({ type: 'ADD', shopId, shopName, item }), []);
  const removeFromCart = useCallback((productId) =>
    cartDispatch({ type: 'REMOVE', productId }), []);
  const updateQuantity = useCallback((productId, qty) =>
    cartDispatch({ type: 'UPDATE_QTY', productId, qty }), []);
  const clearCart      = useCallback(() => cartDispatch({ type: 'CLEAR' }), []);

  const cartItemCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  const cartTotal     = Math.round(cart.items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;

  return (
    <AppContext.Provider value={{
      currentUser: auth.user, authLoading: auth.loading,
      signIn, signOut,
      cart, cartItemCount, cartTotal,
      addToCart, removeFromCart, updateQuantity, clearCart,
      aiAvailable,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
};
```

---

## 27. Frontend — pages/Marketplace.jsx

```jsx
// src/pages/Marketplace.jsx
// Customer shop listing: location API filter + category/search client-side.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listShops } from '../api/client';
import { useApp } from '../context/AppContext';

const LOCATIONS  = ['Green Valley','Central Market','Food Plaza','Milk Lane','Old Town'];
const CATEGORIES = ['All','Grocery','Dairy','Vegetables & Fruits','Meat',
                    'Bakery & Snacks','Beverages','Household','Personal Care'];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
      <div className="h-14 w-14 rounded-full bg-gray-200 mb-3" />
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
    </div>
  );
}

function ShopCard({ shop, onClick }) {
  return (
    <div onClick={() => onClick(shop.id)}
         className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md
                    transition-all cursor-pointer p-4 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {shop.logo
          ? <img src={shop.logo} alt={shop.name}
                 className="h-14 w-14 rounded-full object-cover border border-gray-100" />
          : <div className="h-14 w-14 rounded-full bg-indigo-50 flex items-center justify-center
                            text-2xl font-bold text-indigo-400">{shop.name[0]}</div>
        }
        <div>
          <p className="font-semibold text-gray-900 leading-tight">{shop.name}</p>
          <span className="text-xs text-gray-400">{shop.category}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 line-clamp-2">{shop.address}</p>
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
        <span className="text-xs text-amber-500 font-medium">★ {shop.rating.toFixed(1)}</span>
        {shop.timings && <span className="text-xs text-gray-400">{shop.timings}</span>}
        <button className="text-xs bg-indigo-500 text-white px-3 py-1 rounded-full hover:bg-indigo-600">
          View Shop
        </button>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [location,  setLocation]  = useState(localStorage.getItem('hm_location') || LOCATIONS[0]);
  const [category,  setCategory]  = useState('All');
  const [search,    setSearch]    = useState('');
  const [debounced, setDebounced] = useState('');
  const [shops,     setShops]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { localStorage.setItem('hm_location', location); }, [location]);

  const fetchShops = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await listShops({ location, size: 100 });
      setShops(res.data.items);
    } catch { setError('Failed to load shops. Please try again.'); }
    finally  { setLoading(false); }
  }, [location]);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  const filtered = useMemo(() => shops.filter(s => {
    const matchCat    = category === 'All' || s.category === category;
    const q           = debounced.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    return matchCat && matchSearch;
  }), [shops, category, debounced]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100 px-4 py-3 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-2">HyperMart</h1>
        <select value={location} onChange={e => setLocation(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2
                           focus:outline-none focus:ring-2 focus:ring-indigo-300">
          {LOCATIONS.map(l => <option key={l}>{l}</option>)}
        </select>
        <input type="search" placeholder="Search shops…" value={search} onChange={e => setSearch(e.target.value)}
               className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2
                          focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
                    className={`flex-shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${
                      category === c
                        ? 'bg-indigo-500 text-white border-indigo-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                    }`}>{c}</button>
          ))}
        </div>
      </div>

      <main className="px-4 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({length: 8}).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-500">
            <p className="mb-3">{error}</p>
            <button onClick={fetchShops} className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🏪</p>
            <p className="font-medium">No shops found</p>
            <p className="text-sm">Try a different location or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map(shop => (
              <ShopCard key={shop.id} shop={shop} onClick={id => navigate(`/marketplace/${id}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

---

## 28. Frontend — pages/OwnerDashboard.jsx

```jsx
// src/pages/OwnerDashboard.jsx
// Tabs: Overview (analytics + AI insight) · Inventory (AI suggestions) · Orders · Billing

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getMyShops, createShop, getShopAnalytics, listProducts,
         createProduct, updateProduct, deleteProduct,
         getShopOrders, updateOrderStatus } from '../api/client';
import { suggestProducts, generateDescription, getLowStockInsight } from '../api/client';

const CATEGORIES = ['Grocery','Dairy','Vegetables & Fruits','Meat',
                    'Bakery & Snacks','Beverages','Household','Personal Care'];
const LOCATIONS  = ['Green Valley','Central Market','Food Plaza','Milk Lane','Old Town'];
const STATUS_NEXT = {
  pending:'accepted', accepted:'ready', ready:'out_for_delivery', out_for_delivery:'delivered'
};
const STATUS_COLORS = {
  pending:'bg-amber-100 text-amber-700', accepted:'bg-blue-100 text-blue-700',
  ready:'bg-indigo-100 text-indigo-700', out_for_delivery:'bg-purple-100 text-purple-700',
  delivered:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700',
};

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ shopId, shopName, aiAvailable }) {
  const [data,    setData]    = useState(null);
  const [insight, setInsight] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    getShopAnalytics(shopId).then(r => {
      setData(r.data);
      // Fetch AI insight if available and there are low-stock items
      if (aiAvailable && r.data.low_stock_items.length > 0) {
        setLoadingInsight(true);
        getLowStockInsight(shopName, r.data.low_stock_items)
          .then(res => setInsight(res.data.insight))
          .catch(() => {})
          .finally(() => setLoadingInsight(false));
      }
    }).catch(() => {});
  }, [shopId, shopName, aiAvailable]);

  if (!data) return <p className="text-gray-400 text-sm p-4">Loading…</p>;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label:'Today\'s Sales', value:`₹${data.today_sales}`, icon:'💰' },
          { label:'Orders Today',   value:data.today_orders,      icon:'📦' },
          { label:'Total Products', value:data.total_products,    icon:'🛒' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <span className="text-3xl">{c.icon}</span>
            <div>
              <p className="text-xs text-gray-400">{c.label}</p>
              <p className="text-xl font-bold text-gray-800">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Low stock alert */}
      {data.low_stock_items.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ Low Stock Alert</p>
          <ul className="text-sm text-amber-700 list-disc list-inside space-y-1 mb-3">
            {data.low_stock_items.map(name => <li key={name}>{name}</li>)}
          </ul>

          {/* AI insight card */}
          {aiAvailable && (
            loadingInsight
              ? <p className="text-xs text-amber-600 italic">✨ Generating AI insight…</p>
              : insight
                ? <div className="bg-white border border-amber-100 rounded-lg p-3 mt-2">
                    <p className="text-xs font-semibold text-indigo-600 mb-1">✨ AI Insight</p>
                    <p className="text-sm text-gray-700">{insight}</p>
                  </div>
                : null
          )}
        </div>
      )}
    </div>
  );
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────

function InventoryTab({ shopId, aiAvailable }) {
  const [products,     setProducts]     = useState([]);
  const [showModal,    setShowModal]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [form,         setForm]         = useState({
    name:'', category:'Grocery', price:'', mrp:'', unit:'', stock:'', image:'', status:'active'
  });
  const [suggestions,  setSuggestions]  = useState([]);
  const [suggestOpen,  setSuggestOpen]  = useState(false);
  const [genLoading,   setGenLoading]   = useState(false);
  const [description,  setDescription]  = useState('');

  const load = useCallback(() => {
    listProducts(shopId, false).then(r => setProducts(r.data)).catch(() => {});
  }, [shopId]);

  useEffect(() => { if (shopId) load(); }, [shopId, load]);

  // AI: product name suggestions (debounced 400ms)
  useEffect(() => {
    if (!aiAvailable || form.name.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      suggestProducts(form.category, form.name)
        .then(r => { setSuggestions(r.data); setSuggestOpen(true); })
        .catch(() => setSuggestions([]));
    }, 400);
    return () => clearTimeout(t);
  }, [form.name, form.category, aiAvailable]);

  // AI: generate description
  const handleGenDesc = async () => {
    if (!form.name || !aiAvailable) return;
    setGenLoading(true);
    try {
      const r = await generateDescription(form.name, form.category);
      setDescription(r.data.description);
    } catch {}
    finally { setGenLoading(false); }
  };

  const openAdd  = () => {
    setEditing(null);
    setForm({ name:'', category:'Grocery', price:'', mrp:'', unit:'', stock:'', image:'', status:'active' });
    setDescription(''); setSuggestions([]); setShowModal(true);
  };
  const openEdit = p => {
    setEditing(p);
    setForm({ name:p.name, category:p.category, price:p.price, mrp:p.mrp,
              unit:p.unit, stock:p.stock, image:p.image||'', status:p.status });
    setDescription(''); setSuggestions([]); setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, price:+form.price, mrp:+form.mrp, stock:+form.stock };
    try {
      if (editing) await updateProduct(shopId, editing.id, payload);
      else         await createProduct(shopId, payload);
      setShowModal(false); load();
    } catch (err) { alert(err.response?.data?.detail || 'Save failed'); }
  };

  const handleDelete = async p => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try { await deleteProduct(shopId, p.id); load(); }
    catch (err) { alert(err.response?.data?.detail || 'Cannot delete'); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="font-semibold text-gray-700">{products.length} Products</p>
        <button onClick={openAdd}
                className="bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-600">
          + Add Product
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              {['Name','Category','Price','MRP','Stock','Unit','Status',''].map(h => (
                <th key={h} className="py-2 px-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 px-2 font-medium text-gray-800">{p.name}</td>
                <td className="py-2 px-2 text-gray-500">{p.category}</td>
                <td className="py-2 px-2">₹{p.price}</td>
                <td className="py-2 px-2 text-gray-400 line-through">₹{p.mrp}</td>
                <td className="py-2 px-2">{p.stock}</td>
                <td className="py-2 px-2 text-gray-500">{p.unit}</td>
                <td className="py-2 px-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.status==='active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>{p.status}</span>
                </td>
                <td className="py-2 px-2 flex gap-2">
                  <button onClick={() => openEdit(p)} className="text-indigo-500 hover:underline text-xs">Edit</button>
                  <button onClick={() => handleDelete(p)} className="text-red-500 hover:underline text-xs">Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
             onClick={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">{editing ? 'Edit Product' : 'Add Product'}</h3>

            {/* Name field with AI suggestions */}
            <div className="relative">
              <label className="text-xs text-gray-500">Name</label>
              <input type="text" value={form.name} required
                     onChange={e => { setForm(f=>({...f,name:e.target.value})); setSuggestOpen(true); }}
                     onBlur={() => setTimeout(() => setSuggestOpen(false), 200)}
                     className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5
                                focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              {/* Suggestion dropdown */}
              {aiAvailable && suggestOpen && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
                  <p className="text-xs text-indigo-500 px-3 pt-2 pb-1 font-medium">✨ AI Suggestions</p>
                  {suggestions.map(s => (
                    <button key={s} type="button"
                            onMouseDown={() => { setForm(f=>({...f,name:s})); setSuggestOpen(false); }}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-gray-500">Category</label>
              <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* AI description generator */}
            {aiAvailable && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-500">AI Description (optional)</label>
                  <button type="button" onClick={handleGenDesc} disabled={!form.name || genLoading}
                          className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-50">
                    {genLoading ? '⏳ Generating…' : '✨ Generate'}
                  </button>
                </div>
                <input type="text" value={description}
                       onChange={e => setDescription(e.target.value)}
                       placeholder="AI will fill this in…"
                       className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5
                                  focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            )}

            {/* Other fields */}
            {[
              {label:'Price (₹)', key:'price', type:'number'},
              {label:'MRP (₹)',   key:'mrp',   type:'number'},
              {label:'Stock',     key:'stock',  type:'number'},
              {label:'Unit',      key:'unit',   type:'text'},
              {label:'Image URL', key:'image',  type:'url'},
            ].map(({label, key, type}) => (
              <div key={key}>
                <label className="text-xs text-gray-500">{label}</label>
                <input type={type} value={form[key]}
                       onChange={e => setForm(f=>({...f,[key]:e.target.value}))}
                       required={['price','mrp','stock','unit'].includes(key)}
                       className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5
                                  focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            ))}

            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5">
                <option value="active">Active</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)}
                      className="flex-1 border border-gray-200 rounded-lg py-2 text-sm">Cancel</button>
              <button type="submit"
                      className="flex-1 bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-600">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

function OrdersTab({ shopId }) {
  const [orders, setOrders] = useState([]);
  const load = useCallback(() => {
    getShopOrders(shopId).then(r => setOrders(r.data.items)).catch(() => {});
  }, [shopId]);
  useEffect(() => { if (shopId) load(); }, [shopId, load]);

  const advance = async (orderId, current) => {
    const next = STATUS_NEXT[current];
    if (!next) return;
    try { await updateOrderStatus(orderId, next); load(); }
    catch (err) { alert(err.response?.data?.detail || 'Update failed'); }
  };
  const reject = async orderId => {
    try { await updateOrderStatus(orderId, 'rejected'); load(); }
    catch (err) { alert(err.response?.data?.detail || 'Reject failed'); }
  };

  if (!orders.length) return <p className="text-center text-gray-400 py-12">No orders yet.</p>;

  return (
    <div className="space-y-3">
      {orders.map(o => (
        <div key={o.id} className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-medium text-gray-800">Order #{o.id}</p>
              <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleString()}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status]||''}`}>
              {o.status.replace('_',' ')}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{o.items.map(i=>`${i.name} × ${i.quantity}`).join(', ')}</p>
          <p className="font-semibold text-gray-800 mb-3">₹{o.total}</p>
          <div className="flex gap-2">
            {STATUS_NEXT[o.status] && (
              <button onClick={() => advance(o.id, o.status)}
                      className="text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600">
                Mark {STATUS_NEXT[o.status].replace('_',' ')}
              </button>
            )}
            {['pending','accepted'].includes(o.status) && (
              <button onClick={() => reject(o.id)}
                      className="text-xs border border-red-300 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50">
                Reject
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

const TABS = [
  {key:'overview',  label:'📊 Overview'},
  {key:'inventory', label:'📦 Inventory'},
  {key:'orders',    label:'🗒 Orders'},
];

export default function OwnerDashboard() {
  const { aiAvailable } = useApp();
  const [tab,          setTab]          = useState('overview');
  const [shops,        setShops]        = useState([]);
  const [activeShopId, setActiveShopId] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({
    name:'', category:'Grocery', location_name:'Green Valley', address:'', timings:'', logo:''
  });

  useEffect(() => {
    getMyShops().then(r => {
      setShops(r.data);
      if (r.data.length) setActiveShopId(r.data[0].id);
    }).catch(() => {});
  }, []);

  const handleRegister = async e => {
    e.preventDefault();
    try {
      const res = await createShop(regForm);
      setShops(s => [...s, res.data]);
      setActiveShopId(res.data.id);
      setShowRegister(false);
    } catch (err) { alert(err.response?.data?.detail || 'Registration failed'); }
  };

  const activeShop = shops.find(s => s.id === activeShopId);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100 px-4 py-3">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl font-bold text-gray-900">
            Owner Dashboard
            {aiAvailable && <span className="ml-2 text-xs text-indigo-400 font-normal">✨ AI on</span>}
          </h1>
          <button onClick={() => setShowRegister(true)}
                  className="text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-full hover:bg-indigo-600">
            + Register Shop
          </button>
        </div>
        {shops.length > 0 && (
          <select value={activeShopId||''} onChange={e => setActiveShopId(+e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2
                             focus:outline-none focus:ring-2 focus:ring-indigo-300">
            {shops.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
          </select>
        )}
        {activeShop?.status === 'pending' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-2">
            ⏳ Your shop is pending admin approval.
          </div>
        )}
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex-1 text-xs py-2 rounded-lg transition-colors ${
                      tab===t.key ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                    }`}>{t.label}</button>
          ))}
        </div>
      </div>

      <main className="px-4 pt-4">
        {shops.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-3">🏪</p>
            <p className="font-medium mb-1">No shops yet</p>
            <button onClick={() => setShowRegister(true)}
                    className="text-sm bg-indigo-500 text-white px-4 py-2 rounded-lg mt-2">
              Register your first shop
            </button>
          </div>
        ) : activeShopId && (
          <>
            {tab==='overview'  && <OverviewTab  shopId={activeShopId} shopName={activeShop?.name||''} aiAvailable={aiAvailable} />}
            {tab==='inventory' && <InventoryTab shopId={activeShopId} aiAvailable={aiAvailable} />}
            {tab==='orders'    && <OrdersTab    shopId={activeShopId} />}
          </>
        )}
      </main>

      {/* Register Shop Modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
             onClick={() => setShowRegister(false)}>
          <form onSubmit={handleRegister} onClick={e => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3 shadow-xl">
            <h3 className="font-bold text-lg">Register New Shop</h3>
            {[
              {label:'Shop Name',key:'name',type:'text',required:true},
              {label:'Address',  key:'address',type:'text',required:true},
              {label:'Timings',  key:'timings',type:'text',required:false},
              {label:'Logo URL', key:'logo',   type:'url', required:false},
            ].map(({label,key,type,required}) => (
              <div key={key}>
                <label className="text-xs text-gray-500">{label}</label>
                <input type={type} value={regForm[key]} required={required}
                       onChange={e => setRegForm(f=>({...f,[key]:e.target.value}))}
                       className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5
                                  focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-500">Category</label>
              <select value={regForm.category} onChange={e => setRegForm(f=>({...f,category:e.target.value}))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Location</label>
              <select value={regForm.location_name} onChange={e => setRegForm(f=>({...f,location_name:e.target.value}))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5">
                {LOCATIONS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowRegister(false)}
                      className="flex-1 border border-gray-200 rounded-lg py-2 text-sm">Cancel</button>
              <button type="submit"
                      className="flex-1 bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-600">
                Register
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
```

---

## 29. Frontend — pages/AdminPanel.jsx

```jsx
// src/pages/AdminPanel.jsx — Shops · Users · Analytics tabs.

import { useState, useEffect, useCallback } from 'react';
import { listShops, updateShopStatus, listUsers, changeRole, getPlatformAnalytics } from '../api/client';

const STATUS_COLORS = {
  approved:'bg-green-100 text-green-700', pending:'bg-amber-100 text-amber-700',
  suspended:'bg-red-100 text-red-700',
};

function ShopsTab() {
  const [shops,   setShops]   = useState([]);
  const [filter,  setFilter]  = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter, size: 200 } : { size: 200 };
      const res = await listShops(params);
      setShops(res.data.items);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handle = async (shopId, status) => {
    try { await updateShopStatus(shopId, status); load(); }
    catch (err) { alert(err.response?.data?.detail || 'Action failed'); }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {['all','pending','approved','suspended'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    filter===s ? 'bg-indigo-500 text-white border-indigo-500'
                               : 'bg-white text-gray-600 border-gray-200'}`}>
            {s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>
      {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                {['Shop','Category','Location','Status','Created','Actions'].map(h => (
                  <th key={h} className="py-2 px-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shops.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium text-gray-800">{s.name}</td>
                  <td className="py-2 px-2 text-gray-500">{s.category}</td>
                  <td className="py-2 px-2 text-gray-500">{s.location_name}</td>
                  <td className="py-2 px-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status]}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-gray-400 text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="py-2 px-2 flex gap-1 flex-wrap">
                    {s.status==='pending'   && <button onClick={() => handle(s.id,'approved')}  className="text-xs bg-green-500 text-white px-2 py-1 rounded">Approve</button>}
                    {s.status==='pending'   && <button onClick={() => handle(s.id,'suspended')} className="text-xs bg-red-500   text-white px-2 py-1 rounded">Reject</button>}
                    {s.status==='approved'  && <button onClick={() => handle(s.id,'suspended')} className="text-xs bg-amber-500 text-white px-2 py-1 rounded">Suspend</button>}
                    {s.status==='suspended' && <button onClick={() => handle(s.id,'approved')}  className="text-xs bg-green-500 text-white px-2 py-1 rounded">Reinstate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shops.length && <p className="text-center text-gray-400 py-8">No shops found.</p>}
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const load = useCallback(() => { listUsers().then(r => setUsers(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  const handleRole = async (userId, role) => {
    try { await changeRole(userId, role); load(); }
    catch (err) { alert(err.response?.data?.detail || 'Role change failed'); }
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
            {['Name','Email','Role','Joined','Change Role'].map(h => (
              <th key={h} className="py-2 px-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 px-2 font-medium text-gray-800">{u.display_name}</td>
              <td className="py-2 px-2 text-gray-500">{u.email}</td>
              <td className="py-2 px-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  u.role==='admin' ? 'bg-purple-100 text-purple-700' :
                  u.role==='owner' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                  {u.role}
                </span>
              </td>
              <td className="py-2 px-2 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
              <td className="py-2 px-2">
                <select defaultValue={u.role} onChange={e => handleRole(u.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none">
                  <option value="customer">customer</option>
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsTab() {
  const [data, setData] = useState(null);
  useEffect(() => { getPlatformAnalytics().then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <p className="text-gray-400 text-sm">Loading…</p>;
  const cards = [
    {label:'Total Shops',       value:data.total_shops,       icon:'🏪'},
    {label:'Approved Shops',    value:data.approved_shops,    icon:'✅'},
    {label:'Total Users',       value:data.total_users,       icon:'👥'},
    {label:'Total Orders',      value:data.total_orders,      icon:'📦'},
    {label:'Delivered Revenue', value:`₹${data.delivered_revenue}`, icon:'💰'},
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <span className="text-3xl">{c.icon}</span>
          <div>
            <p className="text-xs text-gray-400">{c.label}</p>
            <p className="text-xl font-bold text-gray-800">{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const TABS = [{key:'shops',label:'🏪 Shops'},{key:'users',label:'👥 Users'},{key:'analytics',label:'📊 Analytics'}];

export default function AdminPanel() {
  const [tab, setTab] = useState('shops');
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Admin Panel</h1>
        <div className="flex gap-2">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
                    className={`text-sm px-4 py-2 rounded-lg ${
                      tab===t.key ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <main className="px-6 py-6">
        {tab==='shops'     && <ShopsTab />}
        {tab==='users'     && <UsersTab />}
        {tab==='analytics' && <AnalyticsTab />}
      </main>
    </div>
  );
}
```

---

## 30. Frontend — components/AIAssistant.jsx

```jsx
// src/components/AIAssistant.jsx
// Reusable hook + UI components for AI features.
// Import individually in pages that need AI.

import { useState, useEffect } from 'react';
import { suggestProducts, generateDescription } from '../api/client';

/**
 * Hook: useProductSuggestions
 * Returns AI product name suggestions with 400ms debounce.
 * Falls back silently if AI is unavailable.
 */
export function useProductSuggestions(name, category, enabled) {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!enabled || name.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      suggestProducts(category, name)
        .then(r => setSuggestions(r.data))
        .catch(() => setSuggestions([]));
    }, 400);
    return () => clearTimeout(t);
  }, [name, category, enabled]);

  return { suggestions, clearSuggestions: () => setSuggestions([]) };
}

/**
 * Component: SuggestionDropdown
 * Renders beneath a text input when suggestions are available.
 */
export function SuggestionDropdown({ suggestions, onSelect }) {
  if (!suggestions.length) return null;
  return (
    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1">
      <p className="text-xs text-indigo-500 px-3 pt-2 pb-1 font-medium">✨ AI Suggestions</p>
      {suggestions.map(s => (
        <button key={s} type="button" onMouseDown={() => onSelect(s)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 transition-colors last:rounded-b-lg">
          {s}
        </button>
      ))}
    </div>
  );
}

/**
 * Component: GenerateDescriptionButton
 * Button that calls /ai/generate-description and fills a field.
 */
export function GenerateDescriptionButton({ productName, category, onResult, disabled }) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!productName) return;
    setLoading(true);
    try {
      const r = await generateDescription(productName, category);
      onResult(r.data.description);
    } catch {}
    finally { setLoading(false); }
  };

  return (
    <button type="button" onClick={handle} disabled={disabled || loading || !productName}
            className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-40 transition-colors">
      {loading ? '⏳ Generating…' : '✨ Generate'}
    </button>
  );
}

/**
 * Component: LowStockInsightCard
 * Collapsible card shown on Overview tab when low-stock items exist.
 */
export function LowStockInsightCard({ insight, loading }) {
  const [open, setOpen] = useState(true);
  if (!insight && !loading) return null;
  return (
    <div className="bg-white border border-indigo-100 rounded-xl mt-3">
      <button type="button" onClick={() => setOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-indigo-700">
        <span>✨ AI Restocking Insight</span>
        <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-gray-700">
          {loading
            ? <p className="text-gray-400 italic">Analysing stock levels…</p>
            : <p>{insight}</p>
          }
        </div>
      )}
    </div>
  );
}
```

---

## 31. Frontend — App.jsx

```jsx
// src/App.jsx
// Root: HashRouter + RequireAuth + role-home redirects + bottom nav.

import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Marketplace    from './pages/Marketplace';
import OwnerDashboard from './pages/OwnerDashboard';
import AdminPanel     from './pages/AdminPanel';

function SignIn() {
  const { signIn } = useApp();
  const navigate   = useNavigate();

  // Wire up real Google Sign-In here.
  // On success: POST /users (if first-time) then signIn(userProfile).
  const handleFakeSignIn = () => {
    const fakeUser = { id:1, uid:'cust-001', email:'customer1@example.com',
                       display_name:'Demo Customer', role:'customer' };
    signIn(fakeUser);
    navigate('/marketplace');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center w-80">
        <p className="text-4xl mb-4">🛒</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">HyperMart</h1>
        <p className="text-sm text-gray-500 mb-8">Your neighbourhood marketplace</p>
        <button onClick={handleFakeSignIn}
                className="w-full bg-indigo-500 text-white py-3 rounded-xl font-medium
                           hover:bg-indigo-600 transition-colors">
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

function RequireAuth({ children, roles }) {
  const { currentUser, authLoading } = useApp();
  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!currentUser) return <Navigate to="/" replace />;
  if (roles && !roles.includes(currentUser.role)) return <Navigate to="/" replace />;
  return children;
}

function BottomNav() {
  const { currentUser, cartItemCount } = useApp();
  const navigate   = useNavigate();
  const { pathname } = useLocation();
  if (!currentUser || currentUser.role === 'admin') return null;

  const customerLinks = [
    { icon:'🏪', label:'Shop',    path:'/marketplace' },
    { icon:'🛒', label:'Cart',    path:'/cart', badge: cartItemCount },
    { icon:'👤', label:'Profile', path:'/profile' },
  ];
  const ownerLinks = [
    { icon:'📊', label:'Stats',  path:'/owner?tab=overview'  },
    { icon:'📦', label:'Stock',  path:'/owner?tab=inventory' },
    { icon:'🗒', label:'Orders', path:'/owner?tab=orders'    },
  ];
  const links = currentUser.role === 'owner' ? ownerLinks : customerLinks;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100
                    flex justify-around py-2 z-40 shadow-lg">
      {links.map(l => (
        <button key={l.path} onClick={() => navigate(l.path)}
                className={`flex flex-col items-center gap-0.5 px-4 py-1 relative transition-colors ${
                  pathname.startsWith(l.path.split('?')[0]) ? 'text-indigo-500' : 'text-gray-400'}`}>
          <span className="text-xl">{l.icon}</span>
          <span className="text-xs">{l.label}</span>
          {l.badge > 0 && (
            <span className="absolute top-0 right-2 bg-red-500 text-white text-xs rounded-full
                             w-4 h-4 flex items-center justify-center">{l.badge}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

function AppRoutes() {
  const { currentUser } = useApp();
  const roleHome = currentUser?.role === 'admin' ? '/admin'
                 : currentUser?.role === 'owner' ? '/owner'
                 : '/marketplace';
  return (
    <>
      <Routes>
        <Route path="/"            element={currentUser ? <Navigate to={roleHome} /> : <SignIn />} />
        <Route path="/marketplace" element={<RequireAuth roles={['customer','admin']}><Marketplace /></RequireAuth>} />
        <Route path="/owner"       element={<RequireAuth roles={['owner','admin']}><OwnerDashboard /></RequireAuth>} />
        <Route path="/admin"       element={<RequireAuth roles={['admin']}><AdminPanel /></RequireAuth>} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProvider>
  );
}
```

---

## 32. Database Schema Reference

```
users
├── id            INTEGER PK
├── uid           VARCHAR(128) UNIQUE INDEX   ← Google UID / local UUID
├── email         VARCHAR(255) UNIQUE INDEX
├── display_name  VARCHAR(255)
├── photo_url     VARCHAR(1024) NULL
├── role          ENUM(customer|owner|admin)
├── phone         VARCHAR(20) NULL
├── created_at    DATETIME
└── last_login    DATETIME

shops
├── id            INTEGER PK
├── owner_id      FK→users.id  CASCADE DELETE
├── name          VARCHAR(255)
├── address       TEXT
├── category      ENUM(8 values)
├── location_name ENUM(5 values) INDEX
├── status        ENUM(pending|approved|suspended) INDEX
├── logo          VARCHAR(1024) NULL
├── timings       VARCHAR(100) NULL
├── lat           FLOAT NULL   ← §8 Map: reserved
├── lng           FLOAT NULL   ← §8 Map: reserved
├── rating        FLOAT DEFAULT 4.5
├── review_count  INTEGER DEFAULT 0
└── created_at    DATETIME

products
├── id         INTEGER PK
├── shop_id    FK→shops.id   CASCADE DELETE  INDEX
├── name       VARCHAR(255)
├── price      FLOAT   ← selling price INR
├── mrp        FLOAT   ← always ≥ price (Pydantic enforced)
├── unit       VARCHAR(50)
├── category   ENUM(8 values)
├── stock      INTEGER ≥ 0
├── image      VARCHAR(1024) NULL
├── status     ENUM(active|out_of_stock) INDEX
└── created_at DATETIME

orders
├── id               INTEGER PK
├── shop_id          FK→shops.id  RESTRICT  INDEX
├── shop_name        VARCHAR(255)  ← denormalised snapshot
├── customer_id      FK→users.id  RESTRICT  INDEX
├── total            FLOAT
├── status           ENUM(6 values) INDEX
├── payment_status   ENUM(pending|paid)
├── delivery_address TEXT
├── created_at       DATETIME
└── updated_at       DATETIME NULL

order_items
├── id         INTEGER PK
├── order_id   FK→orders.id   CASCADE DELETE  INDEX
├── product_id FK→products.id RESTRICT
├── name       VARCHAR(255)  ← name snapshot
├── price      FLOAT         ← price snapshot
└── quantity   INTEGER
```

---

## 33. Full API Reference

Pass `?uid=<user_uid>` on every request. Replace with `Authorization: Bearer <JWT>` in production.

### Users

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/users` | Public | Create user profile |
| GET | `/users/me` | Any | Own profile |
| PATCH | `/users/me` | Any | Update name / phone |
| GET | `/users` | Admin | List all users |
| PATCH | `/users/{id}/role` | Admin | Change role |

### Shops

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/shops` | Any | List shops (location, category, status, search, page, size) |
| POST | `/shops` | Owner | Register shop → `status: pending` |
| GET | `/shops/{id}` | Any | Get shop |
| PATCH | `/shops/{id}` | Owner / Admin | Update shop fields |
| PATCH | `/shops/{id}/status` | Admin | Approve / suspend |
| DELETE | `/shops/{id}` | Admin | Delete shop |
| GET | `/owners/me/shops` | Owner | My shops |

### Products

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/shops/{id}/products` | Any | List products (`active_only` param) |
| POST | `/shops/{id}/products` | Owner | Add product |
| PATCH | `/shops/{id}/products/{pid}` | Owner | Edit product |
| DELETE | `/shops/{id}/products/{pid}` | Owner | Delete (blocked if active orders) |

### Orders

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/orders` | Customer | Place order (decrements stock) |
| GET | `/orders/me` | Customer | Order history (paginated) |
| GET | `/shops/{id}/orders` | Owner | Shop orders (paginated) |
| PATCH | `/orders/{id}/status` | Owner | Advance status |

### Analytics

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/analytics/platform` | Admin | Platform-wide stats |
| GET | `/shops/{id}/analytics` | Owner | Today's sales + low-stock |

### AI (Gemini)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/ai/status` | Any | `{ available: bool }` |
| POST | `/ai/suggest-products` | Owner | 5 product name suggestions |
| POST | `/ai/generate-description` | Owner | 1-sentence product description |
| POST | `/ai/low-stock-insight` | Owner | 2–3 sentence restocking advice |

---

## 34. Order Status Pipeline

```
          ┌──────────┐
          │ pending  │
          └─────┬────┘
       ┌─────── ┴ ────────┐
       ▼                   ▼
 ┌──────────┐        ┌──────────┐
 │ accepted │        │ rejected │ (terminal)
 └─────┬────┘        └──────────┘
       │
       ▼
   ┌───────┐
   │ ready │
   └───┬───┘
       │
       ▼
┌──────────────────┐
│ out_for_delivery │
└─────────┬────────┘
          │
          ▼
    ┌───────────┐
    │ delivered │ (terminal)
    └───────────┘
```

Invalid transitions → HTTP 422 with allowed states listed.

---

## 35. PRD → Implementation Map

| PRD Section | File / Function |
|-------------|----------------|
| §3 Role Matrix | `require_role()` in `main.py` + `RequireAuth` in `App.jsx` |
| §3 Admin Override | `get_current_user()` in `main.py` — checks on every request |
| §4 Auth Flow | `AppContext.signIn/signOut` + `localStorage` UID |
| §4 First-time user | `POST /users` on role-selection submit |
| §6.3 Marketplace | `Marketplace.jsx` — location via API, category/search client-side |
| §6.4 Cart | `cartReducer` in `AppContext` — single-shop constraint in ADD case |
| §6.4 Place Order | `POST /orders` — stock decremented atomically |
| §6.5.1 Shop registration | `POST /shops` → `status: pending` |
| §6.5.2 Overview tab | `GET /shops/{id}/analytics` → `OverviewTab` |
| §6.5.3 Inventory tab | `InventoryTab` in `OwnerDashboard.jsx` |
| §6.5.4 Order pipeline | `PATCH /orders/{id}/status` + `OrderStatusUpdate.validate_transition()` |
| §6.6 Admin panel | `AdminPanel.jsx` — 3 tabs wired to API |
| §7 AI suggestions | `ai.py /suggest-products` + `useProductSuggestions` hook |
| §7 AI description | `ai.py /generate-description` + `GenerateDescriptionButton` |
| §7 AI low-stock | `ai.py /low-stock-insight` + `LowStockInsightCard` |
| §7 Graceful degradation | `GET /ai/status` → `aiAvailable` in `AppContext` |
| §8 Map columns | `shops.lat`, `shops.lng` in `models.py` (reserved) |
| §11 Design tokens | Tailwind classes matching PRD color values |
| §13 Delete blocked | `DELETE /products/{id}` — checks active orders |

---

## 36. Production Checklist

### Security & Auth
- [ ] Replace `?uid=` with JWT (`python-jose` + `passlib`)
- [ ] Add Google OAuth2 callback to issue JWTs
- [ ] Move `GEMINI_API_KEY` validation to startup check with clear error message
- [ ] Add per-user AI rate limiting (e.g. 20 requests/hour for `free` tier)

### Infrastructure
- [ ] Set `DATABASE_URL=postgresql://...` (SQLAlchemy is DB-agnostic)
- [ ] Set `SQL_ECHO=false` in production
- [ ] Add HTTPS via nginx / Caddy reverse proxy
- [ ] Add rate limiting on API (`slowapi`)
- [ ] Set `VITE_API_URL` to deployed backend URL

### Feature Backlog (§14)
- [ ] Delivery address flow — user saves addresses → sent with `POST /orders`
- [ ] Razorpay payment gateway — server-side order, frontend checkout, webhook
- [ ] Firebase Storage for product images
- [ ] Map integration — Leaflet.js + `shops.lat/lng` already in schema
- [ ] Subscription enforcement — tier check before shop/product creation and AI calls
- [ ] Cart persistence — `localStorage` or `PATCH /users/me` cart field
- [ ] PWA — service worker + web manifest
- [ ] i18n — `react-i18next` with language selector in Profile

---

*HyperMart v3.0 — Full Product & Implementation Reference — April 5, 2026*  
*Maintained by the HyperMart engineering team.*