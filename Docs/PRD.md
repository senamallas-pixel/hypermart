# HyperMart â€” Full Product & Implementation Reference

**Version:** 3.1  
**Date:** April 11, 2026  
**Status:** Implemented (Active Development)  
**Stack:** React 18 (JSX) Â· Vite 6 Â· Python Â· FastAPI 0.115 Â· SQLAlchemy 2 Â· SQLite Â· JWT (python-jose) Â· Gemini 2.0 Flash Â· Tailwind CSS 4 Â· React-Leaflet  
**Local Dev:** http://localhost:5173/  
**API Docs:** http://localhost:8000/docs (Swagger UI)  
**Repository:** https://github.com/senamallas-pixel/hypermart

---

## Table of Contents

**Part A â€” Product Requirements**
1. [Executive Summary](#1-executive-summary)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Authentication & Session Management](#4-authentication--session-management)
5. [System Architecture](#5-system-architecture)
6. [Feature Specifications](#6-feature-specifications)
7. [AI Features â€” Agentic RAG System](#7-ai-features--agentic-rag-system)
8. [Map & Location Features](#8-map--location-features)
9. [Subscription System](#9-subscription-system)
10. [Multi-Language Support](#10-multi-language-support)
11. [UI/UX Specifications](#11-uiux-specifications)
12. [Navigation & Routing](#12-navigation--routing)
13. [Error Handling & Edge Cases](#13-error-handling--edge-cases)
14. [Known Limitations & Backlog](#14-known-limitations--backlog)
15. [Acceptance Criteria Checklist](#15-acceptance-criteria-checklist)

**Part B â€” Implementation**
16. [Project Structure](#16-project-structure)
17. [Quick Start](#17-quick-start)
18. [Backend â€” database.py](#18-backend--databasepy)
19. [Backend â€” models.py](#19-backend--modelspy)
20. [Backend â€” schemas.py](#20-backend--schemaspy)
21. [Backend â€” main.py](#21-backend--mainpy)
22. [Backend â€” ai.py (Gemini)](#22-backend--aipy-gemini)
23. [Backend â€” seed.py](#23-backend--seedpy)
24. [Backend â€” requirements.txt](#24-backend--requirementstxt)
25. [Frontend â€” api/client.js](#25-frontend--apiclientjs)
26. [Frontend â€” context/AppContext.jsx](#26-frontend--contextappcontextjsx)
27. [Frontend â€” pages/Marketplace.jsx](#27-frontend--pagesmarketplacejsx)
28. [Frontend â€” pages/OwnerDashboard.jsx](#28-frontend--pagesownerdashboardjsx)
29. [Frontend â€” pages/AdminPanel.jsx](#29-frontend--pagesadminpaneljsx)
30. [Frontend â€” components/AIAssistant.jsx](#30-frontend--componentsaiassistantjsx)
31. [Frontend â€” App.jsx](#31-frontend--appjsx)
32. [Database Schema Reference](#32-database-schema-reference)
33. [Full API Reference](#33-full-api-reference)
34. [Order Status Pipeline](#34-order-status-pipeline)
35. [PRD â†’ Implementation Map](#35-prd--implementation-map)
36. [Production Checklist](#36-production-checklist)

---

# PART A â€” PRODUCT REQUIREMENTS

---

## 1. Executive Summary

HyperMart is a **hyperlocal marketplace web application** that bridges neighbourhood shop owners with customers in the same locality. The platform enables shop owners to go digital with zero technical overhead while giving customers a single, location-aware storefront to discover and order from nearby shops.

### Core Value Propositions

| Persona | Value |
|---------|-------|
| **Customer** | Discover, browse, and order from nearby shops in one app, filtered by locality and category |
| **Shop Owner** | Digital storefront, inventory control, order management, and AI-powered product tools with no setup friction |
| **Admin** | Full platform governance â€” shop approvals, user management, platform-wide oversight |

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
| Order placement steps | â‰¤ 3 taps from shop page to order confirmation |
| Admin approval turnaround | < 24 hours (process SLA, not technical) |
| Page load (LCP) | < 2.5 seconds on 4G |
| API reads per customer session | < 500 |

---

## 3. User Roles & Permissions

### Role Matrix

| Action | `customer` | `owner` | `admin` |
|--------|:---------:|:-------:|:-------:|
| Browse approved shops | âœ“ | âœ“ | âœ“ |
| Add to cart & place orders | âœ“ | âœ— | âœ— |
| View own order history | âœ“ | âœ— | âœ— |
| Register a shop | âœ— | âœ“ | âœ— |
| Manage own shop inventory | âœ— | âœ“ | âœ“ |
| Manage own shop orders | âœ— | âœ“ | âœ“ |
| Generate bills (POS) | âœ— | âœ“ | âœ“ |
| Use AI product tools | âœ— | âœ“ | âœ“ |
| Approve / suspend shops | âœ— | âœ— | âœ“ |
| Manage all users & roles | âœ— | âœ— | âœ“ |
| View platform-wide analytics | âœ— | âœ— | âœ“ |

### Role Assignment Flow

```
User signs in with Google
         â”‚
         â–¼
  users/{uid} exists?
    â”œâ”€â”€ NO  â†’ /role-selection
    â”‚         User picks: customer | owner
    â”‚         Write profile to DB
    â”‚         Redirect to role home
    â”‚
    â””â”€â”€ YES â†’ Read role from DB
              Admin override: senamallas@gmail.com â†’ force admin
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

- **Email + Password** â€” native credentials, no OAuth provider
- `POST /auth/register` â€” creates account, returns JWT + user object
- `POST /auth/login` â€” verifies credentials, returns JWT + user object
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

### Admin Override Rule

```python
# Applied server-side in get_current_user() dependency
ADMIN_EMAIL = "senamallas@gmail.com"
if user.email == ADMIN_EMAIL and user.role != UserRole.admin:
    user.role = UserRole.admin
    db.commit()
```

### Sign-Out

Clears `hypermart_token` from `sessionStorage` and resets `AppContext` state. Redirects to `/login`.

### Protected Route Rules

| Route | Auth Required | Allowed Roles |
|-------|:------------:|--------------|
| `/login` | No | â€” (sign-in / register page) |
| `/marketplace` | Yes | `customer`, `admin` |
| `/marketplace/orders` | Yes | `customer` |
| `/owner` | Yes | `owner`, `admin` |
| `/admin` | Yes | `admin` |
| `/profile` | Yes | `customer` |
| `/settings` | Yes | `customer` |
| `/orders` | Yes | `customer` |

---

## 5. System Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        Browser (SPA)                         â”‚
â”‚                                                              â”‚
â”‚   React 18 (JSX) Â· Vite 6 Â· Motion Â· Leaflet                â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”              â”‚
â”‚  â”‚ Customer  â”‚  â”‚   Owner    â”‚  â”‚   Admin    â”‚              â”‚
â”‚  â”‚Marketplaceâ”‚  â”‚ Dashboard  â”‚  â”‚   Panel    â”‚              â”‚
â”‚  â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜              â”‚
â”‚        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                      â”‚
â”‚                â”Œâ”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”                               â”‚
â”‚                â”‚  AppContext  â”‚  Auth Â· Cart Â· i18n          â”‚
â”‚                â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜                               â”‚
â”‚                api/client.js  (Axios Â· JWT Bearer)           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                         â”‚ HTTP / JSON  (port 8000)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚           Python / FastAPI  (All-in-one â€” port 8000)         â”‚
â”‚                                                              â”‚
â”‚  main.py       â† Auth, Users, Shops, Products, Orders,      â”‚
â”‚                  Analytics, File Upload, Walk-in POS         â”‚
â”‚  ai.py         â† AI routes  /ai/*  (mounted via router)     â”‚
â”‚  models.py     â† SQLAlchemy ORM (5 tables)                  â”‚
â”‚  schemas.py    â† Pydantic v2 request/response models        â”‚
â”‚  database.py   â† SQLite engine + WAL + session factory      â”‚
â”‚                                                              â”‚
â”‚  Swagger UI at GET /docs                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚ SQLAlchemy ORM             â”‚ httpx async
â”Œâ”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”              â”Œâ”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  SQLite DB  â”‚              â”‚  Google Gemini 2.0 Flash API    â”‚
â”‚ hypermart.dbâ”‚              â”‚  (AI suggestions, descriptions, â”‚
â”‚  5 tables   â”‚              â”‚   low-stock insights, chat)     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Single Python/FastAPI backend | All-in-one: REST API + AI routes + file serving in one process |
| SQLite + SQLAlchemy | Zero-infra local dev; swap to PostgreSQL via single `DATABASE_URL` env var |
| JWT (HS256, 30-day) | Stateless auth; token stored in `sessionStorage`, sent as Bearer header |
| Gemini via `httpx` (no SDK) | Lightweight; no google-generativeai dependency; API key kept server-side |
| HashRouter | GitHub Pages SPA routing â€” no server config needed |
| Cart in `useReducer` + localStorage | No external lib; single-shop constraint enforced in reducer |
| React-Leaflet map | Owner can pin shop location on a map when editing settings |

### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite + SQLAlchemy | Zero-infra local dev; swap to PostgreSQL via single env var for prod |
| FastAPI | Async, typed, auto-generates OpenAPI docs at `/docs` |
| HashRouter | GitHub Pages SPA routing â€” no server config needed |
| Gemini proxied through backend | API key stays server-side; rate limits enforced centrally |
| Cart in `useReducer` | No external lib needed; single-shop constraint enforced in reducer |

---

## 6. Feature Specifications

### 6.1 Sign-In / Register Page (`/login`)

Two-tab card (Sign In Â· Register). If already authenticated, redirects immediately to role home.

#### Sign In tab

| Element | Detail |
|---------|--------|
| Email input | `type="email"`, `autocomplete="email"` |
| Password input | Toggle show/hide eye icon |
| Submit | `POST /auth/login` â†’ JWT stored in `sessionStorage` |
| Demo buttons | One-click fill for Customer / Owner / Admin demo credentials |
| Error state | Inline error message below form |

#### Register tab

| Element | Detail |
|---------|--------|
| Full name | `display_name` |
| Email, phone (optional) | Standard inputs |
| Password | Min 6 chars |
| Role selector | Customer / Shop Owner cards |
| Submit | `POST /auth/register` â†’ JWT stored, redirect to role home |

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
- "View Shop" CTA â†’ navigates to `/marketplace/:shopId`

#### Shop Detail (`/marketplace/:shopId`)
- Responsive product grid: 2 cols â†’ 6 cols across breakpoints
- Product card: image, name, price, MRP (strikethrough), unit, Add button
- Quantity controls appear after first Add (min 1, remove at 0)

#### My Orders (`/marketplace/orders`)

| Column | Value |
|--------|-------|
| Order ID | Truncated doc ID |
| Shop name | Denormalized at order creation |
| Items summary | "3 items Â· â‚¹240" |
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

1. **Single-shop constraint** â€” adding from a different shop shows: "Your cart has items from [Shop A]. Clear and add from [Shop B]?"
2. Minimum quantity is 1; removing the last unit removes the item entirely
3. Cart total = Î£ (price Ã— quantity)

#### Place Order Flow

```typescript
// POST /orders
{
  shopId:          cart.shopId,
  items:           cart.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
  deliveryAddress: 'Default Address'   // TODO: user address flow
}
// On success: clearCart() â†’ success toast
```

---

### 6.5 Owner Dashboard (`/owner`)

Six-tab interface. Shop selector at top when owner has multiple shops. Subscription banner shown if subscription is not active.

#### Tab 1 â€” Overview

| Widget | Source |
|--------|--------|
| Today's Sales (â‚¹) | `GET /shops/{id}/analytics` â†’ `today_sales` |
| Orders Today | `today_orders` |
| Total Products | `total_products` |
| Low-Stock Alert count | `low_stock_items` (stock â‰¤ 5) |
| AI low-stock insight | `POST /ai/low-stock-insight` â€” narrative advice |

#### Tab 2 â€” Analytics

| Widget | Source |
|--------|--------|
| Daily Sales Bar Chart | `daily_sales` (last 7 days) |
| Category Revenue Pie Chart | `category_revenue` (delivered orders) |
| Top 10 Products Table | `top_products` by quantity sold |
| Monthly Revenue Chart | `monthly_revenue` (last 6 months) |
| Orders by Status | `orders_by_status` donut/badge breakdown |
| Daily Sales Calendar | Full month calendar with per-day revenue markers |
| AI Sales Forecast | `POST /ai/sales-forecast` â€” narrative 7-day outlook |

#### Tab 3 â€” Billing (In-Store POS)

1. Owner searches products by name (client-side filter)
2. Adds to bill with `+`/`-` quantity controls
3. Views line items, subtotals, grand total
4. **"Place Walk-in Order"** â†’ `POST /shops/{id}/walkin-order` â€” deducts stock, records order with status `delivered` + payment `paid`
5. **Print Invoice** â†’ opens `InvoiceModal` with formatted printable receipt

**Walk-in Order payload:**
```json
{
  "items": [{ "product_id": 5, "quantity": 2 }],
  "customer_name": "Walk-in Customer"
}
```

#### Tab 4 â€” Inventory

Product table columns: Image Â· Name Â· Description Â· Category Â· Price Â· MRP Â· Stock Â· Unit Â· Status Â· Actions

**Add/Edit Modal fields:** Name Â· AI-suggested name (debounced 400 ms) Â· AI-generated description (`âœ¨ AI Generate`) Â· Price Â· MRP Â· Stock Â· Unit Â· Category Â· Image URL / Upload Â· Status

AI name suggestions: `POST /ai/suggest-products` called after 400 ms when owner types â‰¥ 2 characters.
AI description: `POST /ai/generate-description` called on button click.
Image upload: `POST /upload` â€” stores file in `uploads/`, returns relative URL.

**Delete rule:** Blocked with HTTP 409 if product has active (non-terminal) orders.

#### Tab 5 â€” Orders

Order pipeline:

```
pending â†’ accepted â†’ ready â†’ out_for_delivery â†’ delivered
pending / accepted â†’ rejected (terminal)
```

| Status | Owner Action | Badge colour |
|--------|-------------|-------|
| `pending` | Accept / Reject | Amber |
| `accepted` | Mark Ready | Blue |
| `ready` | Mark Out for Delivery | Indigo |
| `out_for_delivery` | Mark Delivered | Purple |
| `delivered` | View invoice | Green |
| `rejected` | â€” | Red |

#### Tab 6 â€” Settings

- Edit shop name, address, category, location, timings, logo URL/upload
- **Leaflet map** (react-leaflet): owner clicks to pin exact lat/lng for the shop
- Subscription status card: plan amount (â‚¹10/month), status (pending / active / expired), expiry date
- **"Activate / Renew Subscription"** button â†’ `POST /subscriptions/activate` (mock payment, adds 30 days)

---

### 6.6 Admin Panel (`/admin`)

#### Shops Tab

Table: Shop Name Â· Owner Â· Category Â· Location Â· Status Â· Created Â· Actions

| Status | Actions |
|--------|---------|
| `pending` | Approve, Reject |
| `approved` | Suspend |
| `suspended` | Approve |

Filters: All / Pending / Approved / Suspended

#### Users Tab

Table: Name Â· Email Â· Role Â· Joined Â· Change Role (dropdown)

#### Analytics Tab

| Metric | Source |
|--------|--------|
| Total / Approved shops | `GET /analytics/platform` |
| Total users | platform analytics |
| Total orders | platform analytics |
| Delivered revenue | platform analytics |

---

### 6.7 Customer Profile (`/profile`)

| Section | Content |
|---------|---------|
| Avatar | Uploaded photo (served from `/uploads/`) or initial-letter fallback |
| Photo upload | `POST /upload` â†’ stored in `uploads/`, URL saved via `PATCH /users/me` |
| Name | Editable â†’ `PATCH /users/me` |
| Email | Display-only |
| Phone | Editable â†’ `PATCH /users/me` |
| Save | Updates DB and refreshes `currentUser` in `AppContext` |

---

### 6.8 Order History (`/orders`)

Dedicated page for customers to view all past orders with search and status filter.

| Element | Detail |
|---------|--------|
| Order list | Paginated, newest first â€” `GET /orders/me` |
| Search | Filter by order ID or shop name (client-side) |
| Status filter | All / pending / accepted / ready / out_for_delivery / delivered / rejected |
| Order card | Order ID Â· Shop name Â· Items summary Â· Total Â· Status badge Â· Date |
| Order detail modal | Full item list, delivery address, timestamps, **Print Invoice** button |
| Invoice modal | `InvoiceModal` component â€” printable, opens `window.open` print dialog |

---

### 6.9 Customer Settings (`/settings`)

Three-tab settings panel accessible to customers.

#### Password tab
- Current password + New password + Confirm fields
- `POST /users/me/change-password`
- Validates: new â‰¥ 8 chars, confirm match

#### Notifications tab
- Toggle preferences for email/SMS notifications (UI-only, not persisted to backend currently)

#### Account tab
- Sign-out confirmation dialog
- Account deletion placeholder (not yet wired to API)

---

## 7. AI Features

> **Status:** Implemented. AI routes are mounted directly in the FastAPI backend (`ai.py`) as a sub-router. `GEMINI_API_KEY` never reaches the browser.

---

### 7.0 Architecture

```
Browser
  â””â”€â–º POST /ai/chat  (FastAPI route â€” same server, port 8000)
            â”‚
            â–¼
     Python FastAPI  (ai.py â€” APIRouter mounted in main.py)
            â”‚
       httpx async client
            â”‚
            â–¼
     Google Gemini 2.0 Flash REST API
     (generativelanguage.googleapis.com)
            â”‚
            â–¼
     Text response â†’ returned to browser
```

**No Qdrant, no LangChain, no vector embeddings.** All AI calls are direct prompt â†’ Gemini 2.0 Flash â†’ response. The backend crafts role-appropriate system prompts and passes conversation history.

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

### 8.2 Nearby Shops API

`GET /shops/nearby?lat=&lng=&radius=` is available in `api/client.js` via `nearbyShops(lat, lng, radius)`. This helper is present for a future customer "Near Me" filter in the Marketplace; the endpoint is not yet surfaced in the Marketplace UI.

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
        raise HTTPException(402, "Active subscription required. Subscribe for ₹10/month.")
    if sub.expires_at and sub.expires_at < datetime.utcnow():
        sub.status = M.SubscriptionStatus.expired
        db.commit()
        raise HTTPException(402, "Your subscription has expired. Please renew for ₹10/month.")
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
- Dropdown shows: 🇺🇸 English / 🇮🇳 हिन्दी / 🇮🇳 తెలుగు
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

---

## 13. Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `VITE_API_URL` | `frontend/.env` | Backend base URL, e.g. `http://localhost:8000` |
| `JWT_SECRET` | backend OS env | JWT HS256 signing secret — **change in production** |
| `GEMINI_API_KEY` | backend OS env | Google AI Studio API key — AI features disabled if absent |
| `DATABASE_URL` | backend OS env | SQLite path (default: `sqlite:///./hypermart.db`). Swap for Postgres URL in production |
| `SQL_ECHO` | backend OS env | `true` to log all SQL queries — dev only |

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
