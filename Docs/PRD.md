# HyperMart — Full Product Requirements Document

**Version:** 3.1
**Date:** April 11, 2026
**Status:** Implemented (Active Development)
**Stack:** React 18 (JSX) · Vite 6 · Python · FastAPI 0.115 · SQLAlchemy 2 · SQLite · JWT (python-jose) · Gemini 2.0 Flash · Tailwind CSS 4 · React-Leaflet
**Local Dev:** http://localhost:5173/
**API Docs:** http://localhost:8000/docs (Swagger UI)
**Repository:** https://github.com/senamallas-pixel/hypermart

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Authentication & Session Management](#4-authentication--session-management)
5. [System Architecture](#5-system-architecture)
6. [Feature Specifications](#6-feature-specifications)
7. [AI Features — Gemini Integration](#7-ai-features--gemini-integration)
8. [Map & Geolocation](#8-map--geolocation)
9. [Subscription System](#9-subscription-system)
10. [Multi-Language Support](#10-multi-language-support)
11. [Admin Panel](#11-admin-panel)
12. [Navigation & Routing](#12-navigation--routing)
13. [UI/UX Specifications](#13-uiux-specifications)
14. [Environment Variables](#14-environment-variables)
15. [Error Handling & Edge Cases](#15-error-handling--edge-cases)
16. [Known Limitations & Backlog](#16-known-limitations--backlog)
17. [Acceptance Criteria Checklist](#17-acceptance-criteria-checklist)

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
User registers via email + password
         │
         ▼
  Role chosen at registration time
    ├── customer → redirect to /marketplace
    ├── owner   → redirect to /owner (pending Subscription auto-created)
    └── admin   → auto-assigned if email === senamallas@gmail.com
```

### Admin Override Rule

```python
# Applied server-side in get_current_user() dependency
ADMIN_EMAIL = "senamallas@gmail.com"
if user.email == ADMIN_EMAIL and user.role != UserRole.admin:
    user.role = UserRole.admin
    db.commit()
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

- **Email + Password** — native credentials, no OAuth provider
- `POST /auth/register` — creates account, returns JWT + user object
- `POST /auth/login` — verifies credentials, returns JWT + user object
- Tokens are HS256 JWTs signed server-side, valid for **30 days**
- Token stored in `sessionStorage` (`hypermart_token`) and attached as `Authorization: Bearer <token>` on all API requests via an Axios interceptor
- On app mount, `GET /users/me` is called to restore the session from a stored token

### Auth Flow

```javascript
// 1. Login
const res = await api.post('/auth/login', { email, password });
sessionStorage.setItem('hypermart_token', res.data.access_token);
setCurrentUser(res.data.user);
navigate(roleHome(res.data.user.role));

// 2. Register (role chosen at registration time)
const res = await api.post('/auth/register', {
  display_name, email, password,
  phone,            // optional
  role,             // 'customer' | 'owner' (admin auto-assigned by email)
});
signIn(res.data.access_token, res.data.user);
navigate(roleHome(res.data.user.role));

// 3. Session restore on page reload
const token = sessionStorage.getItem('hypermart_token');
if (token) {
  const res = await api.get('/users/me');   // token auto-injected
  setCurrentUser(res.data);
}
```

### Sign-Out

Clears `hypermart_token` from `sessionStorage` and resets `AppContext` state. Redirects to `/login`.

### Protected Route Rules

| Route | Auth Required | Allowed Roles |
|-------|:------------:|--------------|
| `/login` | No | — (sign-in / register page) |
| `/marketplace` | Yes | all authenticated users |
| `/owner` | Yes | `owner`, `admin` |
| `/admin` | Yes | `admin` |
| `/profile` | Yes | all authenticated users |
| `/settings` | Yes | all authenticated users |
| `/orders` | Yes | `customer` |

---

## 5. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                         │
│                                                              │
│   React 18 (JSX) · Vite 6 · Motion · Leaflet                │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐              │
│  │ Customer  │  │   Owner    │  │   Admin    │              │
│  │Marketplace│  │ Dashboard  │  │   Panel    │              │
│  └─────┬─────┘  └─────┬──────┘  └─────┬──────┘              │
│        └──────────────┼───────────────┘                      │
│                ┌──────▼──────┐                               │
│                │  AppContext  │  Auth · Cart · i18n          │
│                └──────┬──────┘                               │
│                api/client.js  (Axios · JWT Bearer)           │
└────────────────────────┼─────────────────────────────────────┘
                         │ HTTP / JSON  (port 8000)
┌────────────────────────▼─────────────────────────────────────┐
│           Python / FastAPI  (All-in-one — port 8000)         │
│                                                              │
│  main.py       ← Auth, Users, Shops, Products, Orders,      │
│                  Analytics, File Upload, Walk-in POS         │
│  ai.py         ← AI routes  /ai/*  (mounted via router)     │
│  models.py     ← SQLAlchemy ORM (6 tables)                  │
│  schemas.py    ← Pydantic v2 request/response models        │
│  database.py   ← SQLite engine + WAL + session factory      │
│                                                              │
│  Swagger UI at GET /docs                                     │
└──────┬───────────────────────────────┬───────────────────────┘
       │ SQLAlchemy ORM             │ httpx async
┌──────▼─────────────┐        ┌──────▼──────────────────────────┐
│  SQLite DB         │        │  Google Gemini 2.0 Flash API    │
│  hypermart.db      │        │  (AI suggestions, descriptions, │
│  6 tables          │        │   low-stock insights, chat)     │
└────────────────────┘        └─────────────────────────────────┘
```

### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Single Python/FastAPI backend | All-in-one: REST API + AI routes + file serving in one process |
| SQLite + SQLAlchemy | Zero-infra local dev; swap to PostgreSQL via single `DATABASE_URL` env var |
| JWT (HS256, 30-day) | Stateless auth; token stored in `sessionStorage`, sent as Bearer header |
| Gemini via `httpx` (no SDK) | Lightweight; no google-generativeai dependency; API key kept server-side |
| HashRouter | GitHub Pages SPA routing — no server config needed |
| Cart in `useReducer` + localStorage | No external lib; single-shop constraint enforced in reducer |
| React-Leaflet map | Owner can pin shop location on a map when editing settings |

---

## 6. Feature Specifications

### 6.1 Sign-In / Register Page (`/login`)

Two-tab card (Sign In · Register). If already authenticated, redirects immediately to role home.

#### Sign In tab

| Element | Detail |
|---------|--------|
| Email input | `type="email"`, `autocomplete="email"` |
| Password input | Toggle show/hide eye icon |
| Submit | `POST /auth/login` → JWT stored in `sessionStorage` |
| Demo buttons | One-click fill for Customer / Owner / Admin demo credentials |
| Error state | Inline error message below form |

#### Register tab

| Element | Detail |
|---------|--------|
| Full name | `display_name` |
| Email, phone (optional) | Standard inputs |
| Password | Min 6 chars |
| Role selector | Customer / Shop Owner cards |
| Submit | `POST /auth/register` → JWT stored, redirect to role home |

**Demo credentials** (auto-populated by demo buttons):

| Role | Email | Password |
|------|-------|----------|
| Customer | `ravi@example.com` | `Customer@123` |
| Shop Owner | `anand@example.com` | `Owner@123` |
| Admin | `senamallas@gmail.com` | `Admin@123` |

---

### 6.2 Role Home Redirects

Role is chosen at registration and stored in the database. No separate role-selection step.

| Role | Default Route |
|------|--------------|
| `customer` | `/marketplace` |
| `owner` | `/owner` |
| `admin` | `/admin` |

---

### 6.3 Marketplace (`/marketplace`)

#### Location Filter
- Dropdown with: All, Green Valley, Central Market, Food Plaza, Milk Lane, Old Town
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
- "View Shop" CTA → opens product view within the Marketplace page (internal state, not a separate route)

#### Shop Detail (inline within Marketplace)
- Responsive product grid: 2 cols → 6 cols across breakpoints
- Product card: image, name, price, MRP (strikethrough), unit, Add button
- Quantity controls appear after first Add (min 1, remove at 0)

---

### 6.4 Cart

#### Cart State Structure

```typescript
interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  image?: string;
}

interface CartState {
  shopId: number | null;
  shopName: string | null;
  items: CartItem[];
}
```

#### Business Rules

1. **Single-shop constraint** — adding from a different shop shows: "Your cart has items from [Shop A]. Clear and add from [Shop B]?"
2. Minimum quantity is 1; removing the last unit removes the item entirely
3. Cart total = Σ (price × quantity)

#### Place Order Flow

```javascript
// POST /orders
{
  shop_id:          cart.shopId,
  items:            cart.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
  delivery_address: 'Default Address'   // TODO: user address flow
}
// On success: clearCart() → success toast
```

---

### 6.5 Owner Dashboard (`/owner`)

Six-tab interface. Shop selector at top when owner has multiple shops. Subscription banner shown if subscription is not active.

#### Tab 1 — Overview

| Widget | Source |
|--------|--------|
| Today's Sales (₹) | `GET /shops/{id}/analytics` → `today_sales` |
| Orders Today | `today_orders` |
| Total Products | `total_products` |
| Low-Stock Alert count | `low_stock_items` (stock ≤ 5) |
| AI low-stock insight | `POST /ai/low-stock-insight` — narrative advice |

#### Tab 2 — Analytics

| Widget | Source |
|--------|--------|
| Daily Sales Bar Chart | `daily_sales` (last 7 days) |
| Category Revenue Pie Chart | `category_revenue` (delivered orders) |
| Top 10 Products Table | `top_products` by quantity sold |
| Monthly Revenue Chart | `monthly_revenue` (last 6 months) |
| Orders by Status | `orders_by_status` donut/badge breakdown |
| Daily Sales Calendar | Full month calendar with per-day revenue markers |
| AI Sales Forecast | `POST /ai/sales-forecast` — narrative 7-day outlook |

#### Tab 3 — Billing (In-Store POS)

1. Owner searches products by name (client-side filter)
2. Adds to bill with `+`/`-` quantity controls
3. Views line items, subtotals, grand total
4. **"Place Walk-in Order"** → `POST /shops/{id}/walkin-order` — deducts stock, records order with status `delivered` + payment `paid`
5. **Print Invoice** → opens `InvoiceModal` with formatted printable receipt

**Walk-in Order payload:**
```json
{
  "items": [{ "product_id": 5, "quantity": 2 }]
}
```

#### Tab 4 — Inventory

Product table columns: Image · Name · Description · Category · Price · MRP · Stock · Unit · Status · Actions

**Add/Edit Modal fields:** Name · AI-suggested name (debounced 400 ms) · AI-generated description (`✨ AI Generate`) · Price · MRP · Stock · Unit · Category · Image URL / Upload · Status

AI name suggestions: `POST /ai/suggest-products` called after 400 ms when owner types ≥ 2 characters.
AI description: `POST /ai/generate-description` called on button click.
Image upload: `POST /upload` — stores file in `uploads/`, returns relative URL.

**Delete rule:** Blocked with HTTP 409 if product has active (non-terminal) orders.

#### Tab 5 — Orders

Order pipeline:

```
pending → accepted → ready → out_for_delivery → delivered
pending / accepted → rejected (terminal)
```

| Status | Owner Action | Badge colour |
|--------|-------------|-------|
| `pending` | Accept / Reject | Amber |
| `accepted` | Mark Ready | Blue |
| `ready` | Mark Out for Delivery | Indigo |
| `out_for_delivery` | Mark Delivered | Purple |
| `delivered` | View invoice | Green |
| `rejected` | — | Red |

#### Tab 6 — Settings

- Edit shop name, address, category, location, timings, logo URL/upload
- **Leaflet map** (react-leaflet): owner clicks to pin exact lat/lng for the shop
- Subscription status card: plan amount (₹10/month), status (pending / active / expired), expiry date
- **"Activate / Renew Subscription"** button → `POST /subscriptions/activate` (mock payment, adds 30 days)

---

### 6.6 Admin Panel (`/admin`)

See [Section 11](#11-admin-panel) for full spec.

---

### 6.7 Customer Profile (`/profile`)

| Section | Content |
|---------|---------|
| Avatar | Uploaded photo (served from `/uploads/`) or initial-letter fallback |
| Photo upload | `POST /upload` → stored in `uploads/`, URL saved via `PATCH /users/me` |
| Name | Editable → `PATCH /users/me` |
| Email | Display-only |
| Phone | Editable → `PATCH /users/me` |
| Save | Updates DB and refreshes `currentUser` in `AppContext` |

---

### 6.8 Order History (`/orders`)

Dedicated page for customers to view all past orders with search and status filter.

| Element | Detail |
|---------|--------|
| Order list | Paginated, newest first — `GET /orders/me` |
| Search | Filter by order ID or shop name (client-side) |
| Status filter | All / pending / accepted / ready / out_for_delivery / delivered / rejected |
| Order card | Order ID · Shop name · Items summary · Total · Status badge · Date |
| Order detail modal | Full item list, delivery address, timestamps, **Print Invoice** button |
| Invoice modal | `InvoiceModal` component — printable, opens `window.open` print dialog |

---

### 6.9 Customer Settings (`/settings`)

Three-section settings panel accessible to customers.

#### Password section
- Current password + New password + Confirm fields
- `POST /users/me/change-password`
- Validates: new ≥ 6 chars, confirm match

#### Notifications section
- Toggle preferences for email/SMS notifications (UI-only, not persisted to backend currently)

#### Account section
- Sign-out confirmation dialog
- Account deletion placeholder (not yet wired to API)

---

### 6.10 Additional Pages

| Page | Route | Description |
|------|-------|-------------|
| Admin Profile Management | via Admin Panel | Admin user management features |
| Owner Profile | via Owner Dashboard | Owner profile editing page |
| User Profile View | — | Public user profile view |

---

## 7. AI Features — Gemini Integration

> **Status:** Implemented. AI routes are mounted directly in the FastAPI backend (`ai.py`) as a sub-router. `GEMINI_API_KEY` never reaches the browser.

---

### 7.0 Architecture

```
Browser
  └─► POST /ai/chat  (FastAPI route — same server, port 8000)
            │
            ▼
     Python FastAPI  (ai.py — APIRouter mounted in main.py)
            │
       httpx async client
            │
            ▼
     Google Gemini 2.0 Flash REST API
     (generativelanguage.googleapis.com)
            │
            ▼
     Text response → returned to browser
```

**No Qdrant, no LangChain, no vector embeddings.** All AI calls are direct prompt → Gemini 2.0 Flash → response. The backend crafts role-appropriate system prompts and passes conversation history.

---

### 7.1 AI Endpoints

All AI routes are mounted at `/ai/*` via `app.include_router(ai_router)` in `main.py`.

| Endpoint | Trigger | Input | Output |
|----------|---------|-------|--------|
| `GET /ai/status` | Frontend mount | — | `{available: bool}` |
| `POST /ai/suggest-products` | Owner types ≥ 2 chars in product name (400 ms debounce) | `{category, partial_name}` | `string[]` — up to 5 names |
| `POST /ai/generate-description` | Owner clicks ✨ in product modal | `{name, category}` | `{description: string}` |
| `POST /ai/low-stock-insight` | Overview tab, low stock items present | `{shop_name, low_stock_items}` | `{insight: string}` |
| `POST /ai/sales-forecast` | Analytics tab | `{shop_id, days_back?}` | `{insight: string}` |
| `POST /ai/chat` | AI chat widget (all roles) | `{message, role, shop_id?, history[]}` | `{reply: string}` |

---

### 7.2 Chat Endpoint — Role-Aware Personas

The `/ai/chat` endpoint selects a system prompt based on `role`:

| Role | Persona |
|------|---------|
| `customer` | HyperMart Assistant — helps find products, compare shops |
| `owner` | HyperMart Business Assistant — inventory, pricing, sales advice |
| `admin` | HyperMart Admin Assistant — platform governance, analytics |

Conversation history (last 10 turns) is forwarded as `"User: …\nAssistant: …"` blocks.

---

### 7.3 AIChatWidget Component

Floating chat button (`bottom-right`) visible to all authenticated users. Opens a chat drawer with:
- Scrolling message list with role-aware bubble styling
- Text input + send button
- Typing indicator (3 animated dots) while Gemini responds
- History kept in local component state (cleared on unmount)

---

### 7.4 Graceful Degradation

| Failure mode | Handling |
|-------------|----------|
| `GEMINI_API_KEY` not set | `GET /ai/status → {available: false}` — all AI UI elements hidden |
| Gemini rate limit (429) | AI endpoints return empty array / empty string; no crash |
| Malformed JSON from Gemini | Return empty array; no crash |
| Network error | UI falls back silently; owner can still type freely |

---

## 8. Map & Geolocation

**Status:** Implemented (v3.0)

### 8.1 Owner Shop Location Pinning

Owners set their shop's physical coordinates in the **Settings** tab of the Owner Dashboard using an interactive Leaflet map.

**Component stack (react-leaflet):**
```
MapContainer
TileLayer  (OpenStreetMap tiles)
Marker + DraggableMarker
useMapEvents — onClick to capture lat/lng
```

**Flow:**
1. Settings tab renders a `MapContainer` centred on existing `shop.lat`/`shop.lng` (or India centre as default)
2. Owner clicks the map → `lat`/`lng` state updated in `OwnerDashboard`
3. On save → included in `PATCH /shops/{id}` payload

**Backend fields:** `Shop.lat: Float` (nullable), `Shop.lng: Float` (nullable)

---

### 8.2 Nearby Shops (Future)

The `nearbyShops(lat, lng, radius)` helper exists in `api/client.js` for a future customer "Near Me" filter. The backend endpoint is not yet implemented — this is a **backlog item**.

---

## 9. Subscription System

**Status:** Implemented (v3.0)

### 9.1 Overview

| Detail | Value |
|--------|-------|
| Price | ₹10 / month |
| Period | 30 days from activation |
| Payment | Mock — no real gateway |
| Required for | `POST /shops` by owner |

### 9.2 Subscription States

```python
class SubscriptionStatus(str, PyEnum):
    pending = "pending"   # auto-created at owner registration; no payment yet
    active  = "active"    # payment confirmed; within expiry window
    expired = "expired"   # past expires_at; renewal required
```

### 9.3 Lifecycle

1. Owner registers → a `pending` `Subscription` row is auto-created in `POST /auth/register`
2. Owner opens the **Billing** tab → clicks **Subscribe (₹10/month)** button → calls `POST /subscriptions/activate`
   - `starts_at = now`, `expires_at = now + 30 days`, `status = active`
   - If already active: extends from the current `expires_at` (stackable renewal)
3. On every call to `POST /shops`, `_check_subscription()` is invoked:
   - Missing or `pending` → **HTTP 402**
   - `expired` (past `expires_at`) → status set to `expired`, **HTTP 402**
4. Owner sees a subscription status banner in the Billing tab with expiry date

### 9.4 Subscription Enforcement (backend)

```python
def _check_subscription(user: M.User, db: Session) -> None:
    """Raise 402 if owner's subscription is not active."""
    if user.role != M.UserRole.owner:
        return
    sub = db.query(M.Subscription).filter(M.Subscription.user_id == user.id).first()
    if not sub or sub.status != M.SubscriptionStatus.active:
        raise HTTPException(402, "Active subscription required. Subscribe for Rs.10/month.")
    if sub.expires_at and sub.expires_at < datetime.utcnow():
        sub.status = M.SubscriptionStatus.expired
        db.commit()
        raise HTTPException(402, "Your subscription has expired. Please renew.")
```

### 9.5 Admin Subscription View

`GET /subscriptions` (admin-only) returns all `Subscription` rows with user details. Visible in the Admin Panel subscriptions tab.

---

## 10. Multi-Language Support

**Status:** Implemented (v3.0)

### 10.1 Languages

| Code | Language | Script |
|------|----------|--------|
| `en` | English | Latin |
| `hi` | Hindi | Devanagari (हिन्दी) |
| `te` | Telugu | Telugu (తెలుగు) |

### 10.2 Implementation

**i18n library:** `frontend/src/lib/i18n.js`
- `initI18n()` — initialises with stored language from `localStorage` (key: `hypermart_language`)
- `setLanguage(lang)` — changes active language and reloads translations

**Translation files:** `frontend/public/locales/{en,hi,te}/translation.json`

**LanguageSelector component** (`src/components/LanguageSelector.jsx`):
- Globe icon button in app header, visible to all authenticated users
- Dropdown shows: English / हिन्दी / తెలుగు
- Calls `setLanguage(code)` from `AppContext`

**AppContext integration:**
```javascript
const [language, setLanguageState] = useState(
  localStorage.getItem('hypermart_language') || 'en'
);
const setLanguage = (lang) => {
  setLanguageState(lang);
  setI18nLanguage(lang);
  localStorage.setItem('hypermart_language', lang);
};
```

---

## 11. Admin Panel

**Status:** Implemented (v3.0)

| Tab | Description |
|-----|-------------|
| Shops | List all shops (any status); approve / suspend → `PATCH /shops/{id}/status` |
| Users | List all users; change role → `PATCH /users/{id}/role` |
| Analytics | Platform metrics from `GET /analytics/platform` — shops, users, orders, revenue, active subscriptions |
| Subscriptions | View all subscription rows via `GET /subscriptions` |

Admin account: `senamallas@gmail.com` — auto-promoted to `admin` role on every login.

---

## 12. Navigation & Routing

**Router:** React `HashRouter` (avoids Vite dev-server path issues)

| Route | Component | Guard |
|-------|-----------|-------|
| `/login` | `SignIn` (Login + Register tabs) | Public; redirects when authenticated |
| `/marketplace` | `Marketplace` | Any authenticated user |
| `/owner` | `OwnerDashboard` | `owner` or `admin` |
| `/admin` | `AdminPanel` | `admin` only |
| `/profile` | `CustomerProfile` | Any authenticated user |
| `/settings` | `CustomerSettings` | Any authenticated user |
| `/orders` | `OrderHistory` | `customer` role |

**Auth guard:** `RequireAuth` checks `sessionStorage.getItem("hypermart_token")`.
Unauthenticated → redirect to `/login`.
Wrong role → redirect to role home page.

**Bottom Navigation Bar:**
- Marketplace (all roles), Orders (customer), Owner Dashboard (owner), Admin Panel (admin)
- Profile, Settings, Sign Out
- LanguageSelector, AIChatWidget

---

## 13. UI/UX Specifications

### 13.1 Design System

| Aspect | Implementation |
|--------|---------------|
| Styling framework | Tailwind CSS 4 utility classes |
| Animations | Framer Motion (`motion` package) |
| Icons | Lucide React |
| Maps | React-Leaflet (OpenStreetMap tiles) |
| Responsive breakpoints | Mobile-first; 2-col → 6-col product grids across breakpoints |

### 13.2 Visual Patterns

- **Cards:** Used for shop listings, products, stats widgets, and order summaries
- **Tabs:** Owner Dashboard (6 tabs), Admin Panel (4 tabs), SignIn (2 tabs)
- **Modals:** Product add/edit, order detail, invoice print, cart checkout
- **Badges:** Colour-coded status indicators for orders and shops
- **Toasts:** Success/error notifications for actions (order placed, product saved, etc.)
- **Floating action:** AI chat widget bottom-right corner

### 13.3 Mobile Considerations

- Bottom navigation bar for primary navigation
- Horizontal scrollable category chips
- Touch-friendly quantity controls (+/- buttons)
- Full-width cards on mobile, grid on desktop

---

## 14. Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `VITE_API_URL` | `frontend/.env` | Backend base URL, e.g. `http://localhost:8000` |
| `JWT_SECRET` | backend OS env | JWT HS256 signing secret — **change in production** |
| `GEMINI_API_KEY` | backend OS env | Google AI Studio API key — AI features disabled if absent |
| `DATABASE_URL` | backend OS env | SQLite path (default: `sqlite:///./hypermart.db`). Swap for Postgres URL in production |
| `SQL_ECHO` | backend OS env | `true` to log all SQL queries — dev only |

---

## 15. Error Handling & Edge Cases

### 15.1 Backend Error Responses

| HTTP Code | Scenario |
|-----------|----------|
| 400 | Duplicate email on registration; invalid file type on upload |
| 401 | Missing/expired JWT; invalid credentials on login |
| 402 | Owner subscription missing, pending, or expired |
| 403 | Insufficient role permissions; shop ownership mismatch |
| 404 | Resource not found (shop, product, order, user, subscription) |
| 409 | Delete product with active (non-terminal) orders |
| 422 | Validation failure (Pydantic); invalid order status transition; product not in shop; insufficient stock |
| 503 | Gemini API key not configured |

### 15.2 Frontend Error Handling

- **Auth errors (401):** Clear token, redirect to `/login`
- **Subscription errors (402):** Show subscription activation banner on Owner Dashboard
- **Network errors:** Toast notification with retry suggestion
- **AI unavailable:** All AI UI elements hidden when `GET /ai/status` returns `{available: false}`

### 15.3 Edge Cases

| Case | Handling |
|------|---------|
| Cart from different shop | Confirm dialog: "Clear cart and switch?" |
| Stock insufficient at checkout | HTTP 422 with product name in error message |
| Owner with expired subscription tries to create shop | HTTP 402; subscription auto-marked as expired |
| Concurrent order status updates | Last-write-wins (no optimistic locking in v3.1) |

---

## 16. Known Limitations & Backlog

### Current Limitations (v3.1)

| Limitation | Notes |
|------------|-------|
| No email verification | Registration accepts any email format without confirmation |
| No password reset flow | Users cannot recover forgotten passwords |
| No real payment gateway | Subscription activation is a mock (instant, no payment) |
| Notifications UI-only | Toggle preferences not persisted to backend |
| No nearby shops endpoint | `nearbyShops` client helper exists but backend endpoint missing |
| No `POST /users/me/change-password` endpoint | Frontend references it but backend does not implement it |
| No image size limit | File upload has no max size enforcement |
| Walk-in orders use owner as customer | Walk-in orders record the owner's user ID as customer |
| Account deletion | UI placeholder only, not wired to API |
| No test suite | pytest listed in requirements but no tests written |

### Backlog (Future Versions)

- Nearby Shops API (`GET /shops/nearby?lat=&lng=&radius=`) — distance-based filtering for customers
- Password change backend endpoint (`POST /users/me/change-password`)
- Real payment gateway integration (Razorpay / Stripe)
- Email verification + password reset flow
- Push notifications / SMS alerts for order status changes
- Customer delivery address management (save multiple addresses)
- Shop ratings & reviews by customers
- Product search across all shops
- Order cancellation by customer (before acceptance)
- Redis sessions for horizontal scaling

---

## 17. Acceptance Criteria Checklist

| # | Criteria | Status |
|---|----------|--------|
| 1 | Customer can register, login, browse shops, add to cart, place order | ✓ |
| 2 | Owner can register, activate subscription, create shop, add products | ✓ |
| 3 | Owner can manage orders through full status pipeline | ✓ |
| 4 | Owner can use AI product suggestions and descriptions | ✓ |
| 5 | Owner can create walk-in (POS) orders with invoice printing | ✓ |
| 6 | Owner can pin shop location on Leaflet map | ✓ |
| 7 | Admin can approve/suspend shops and manage user roles | ✓ |
| 8 | Admin can view platform-wide analytics and subscriptions | ✓ |
| 9 | AI chat widget works for all roles with role-aware personas | ✓ |
| 10 | Multi-language support (en/hi/te) with persistent preference | ✓ |
| 11 | JWT auth with 30-day tokens and session restore on reload | ✓ |
| 12 | Single-shop cart constraint enforced | ✓ |
| 13 | Order status transitions enforced with valid-transition checks | ✓ |
| 14 | Product deletion blocked when active orders exist | ✓ |
| 15 | Demo seed data with 5 users, 6 shops, 35+ products | ✓ |
| 16 | Swagger UI accessible at `/docs` | ✓ |
| 17 | App works with HashRouter (GitHub Pages compatible) | ✓ |
| 18 | Graceful AI degradation when Gemini key absent | ✓ |

---

## Part B — Implementation Reference

Complete source code listings for all backend and frontend files are maintained in **[Imp.md](./Imp.md)**.

`Imp.md` covers:
- `backend/database.py`, `models.py`, `schemas.py`, `main.py`, `ai.py`, `seed.py`, `requirements.txt`
- `frontend/src/api/client.js`, `context/AppContext.jsx`, `App.jsx`
- All page and component source files
- Database schema (SQL DDL)
- Full API reference with request/response shapes
- Order status pipeline
- Demo credentials and production checklist

---

*End of PRD — HyperMart v3.1*
