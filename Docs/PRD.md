# HyperMart — Full Product Requirements Document

**Version:** 4.0
**Date:** April 12, 2026
**Status:** Implemented (Active Development)
**Stack:** React 18 (JSX) · Vite 6 · React Native / Expo SDK 54 · Python · FastAPI 0.115 · SQLAlchemy 2 · SQLite · JWT (python-jose) · OpenAI GPT-4o-mini · Tailwind CSS 4 · React-Leaflet · Razorpay
**Platforms:** Web SPA (localhost:5173) · Android (Expo)
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
7. [AI Features — OpenAI Function Calling](#7-ai-features--openai-function-calling)
8. [Map & Geolocation](#8-map--geolocation)
9. [Payment Integration](#9-payment-integration)
10. [Subscription System](#10-subscription-system)
11. [Multi-Language Support](#11-multi-language-support)
12. [Admin Panel](#12-admin-panel)
13. [Mobile App (Expo / Android)](#13-mobile-app-expo--android)
14. [CI/CD Pipeline](#14-cicd-pipeline)
15. [Navigation & Routing](#15-navigation--routing)
16. [UI/UX Specifications](#16-uiux-specifications)
17. [Environment Variables](#17-environment-variables)
18. [Error Handling & Edge Cases](#18-error-handling--edge-cases)
19. [Known Limitations & Backlog](#19-known-limitations--backlog)
20. [Acceptance Criteria Checklist](#20-acceptance-criteria-checklist)

---

## 1. Executive Summary

HyperMart is a **hyperlocal marketplace** (Web + Android) that bridges neighbourhood shop owners with customers in the same locality. The platform enables shop owners to go digital with zero technical overhead while giving customers a single, location-aware storefront to discover and order from nearby shops.

### Core Value Propositions

| Persona | Value |
|---------|-------|
| **Customer** | Discover, browse, and order from nearby shops; global product search; Razorpay/UPI/COD payments; AI-powered shopping assistant |
| **Shop Owner** | Digital storefront, inventory control, walk-in POS billing with UPI QR, AI-powered product/sales tools, order management |
| **Admin** | Full platform governance — shop approvals, user management, platform-wide analytics |

---

## 2. Goals & Success Metrics

### Product Goals

- Enable local shop owners to go digital with zero technical effort
- Let customers discover and order from nearby shops filtered by locality
- Provide real-time order and inventory tracking
- Offer AI-assisted features via OpenAI GPT with real-time database tool calling
- Support both web and native Android experiences

### Key Metrics (Target at Launch)

| Metric | Target |
|--------|--------|
| Shop onboarding time | < 5 minutes from registration to pending approval |
| Order placement steps | ≤ 3 taps from shop page to order confirmation |
| Admin approval turnaround | < 24 hours (process SLA) |
| Page load (LCP) | < 2.5 seconds on 4G |
| API reads per customer session | < 500 |

---

## 3. User Roles & Permissions

### Role Matrix

| Action | `customer` | `owner` | `admin` |
|--------|:---------:|:-------:|:-------:|
| Browse approved shops | ✓ | ✓ | ✓ |
| Global product search | ✓ | ✓ | ✓ |
| Add to cart & place orders | ✓ | ✗ | ✗ |
| Pay via Razorpay / UPI / COD | ✓ | ✗ | ✗ |
| View own order history + invoices | ✓ | ✗ | ✗ |
| Cancel orders (before acceptance) | ✓ | ✗ | ✗ |
| Submit shop reviews | ✓ | ✗ | ✗ |
| Register a shop | ✗ | ✓ | ✗ |
| Manage own shop inventory | ✗ | ✓ | ✓ |
| Manage own shop orders | ✗ | ✓ | ✓ |
| Walk-in POS billing with UPI QR | ✗ | ✓ | ✓ |
| Quick-add products from billing | ✗ | ✓ | ✓ |
| Use AI product/sales tools | ✗ | ✓ | ✓ |
| Approve / suspend shops | ✗ | ✗ | ✓ |
| Manage all users & roles | ✗ | ✗ | ✓ |
| View platform-wide analytics | ✗ | ✗ | ✓ |

### Admin Override Rule

```python
ADMIN_EMAIL = "senamallas@gmail.com"
if user.email == ADMIN_EMAIL and user.role != UserRole.admin:
    user.role = UserRole.admin
    db.commit()
```

---

## 4. Authentication & Session Management

- **Email + Password** — native credentials, no OAuth
- JWT HS256 tokens, 30-day expiry
- Web: token in `sessionStorage`; Android: token in `expo-secure-store`
- Axios interceptor attaches `Authorization: Bearer` header
- Forgot password flow: `POST /auth/forgot-password` + `POST /auth/reset-password`

**Demo credentials** (after seeding):

| Role | Email | Password |
|------|-------|----------|
| Customer | `ravi@example.com` | `Customer@123` |
| Shop Owner | `anand@example.com` | `Owner@123` |
| Admin | `senamallas@gmail.com` | `Admin@123` |

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Web Browser (SPA)                             │
│   React 18 · Vite 6 · Motion · Leaflet · Tailwind CSS 4        │
│   GlobalSearch · AIChatWidget · InvoiceModal · Razorpay JS      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│               Android (Expo SDK 54)                              │
│   React Native · Expo · Ionicons · react-native-webview         │
│   AIChatWidget · InvoiceModal · Razorpay WebView                │
└───────────────────────────┬─────────────────────────────────────┘
                            │  HTTP / JSON (port 8000)
┌───────────────────────────▼─────────────────────────────────────┐
│           Python / FastAPI  (All-in-one — port 8000)             │
│                                                                  │
│  main.py       ← Auth, Users, Shops, Products, Orders,          │
│                  Analytics, Payments, File Upload, Walk-in POS   │
│  ai.py         ← AI routes /ai/* with OpenAI function calling   │
│  models.py     ← SQLAlchemy ORM models                          │
│  schemas.py    ← Pydantic v2 request/response schemas           │
│  database.py   ← SQLite engine + WAL + session factory          │
└──────┬────────────────────────────────┬─────────────────────────┘
       │ SQLAlchemy ORM               │ httpx async
┌──────▼─────────────┐        ┌───────▼──────────────────────────┐
│  SQLite DB         │        │  OpenAI GPT-4o-mini API          │
│  hypermart.db      │        │  (function calling with 10 tools │
└────────────────────┘        │   for real-time DB queries)      │
                              └──────────────────────────────────┘
```

### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Single Python/FastAPI backend | REST API + AI routes + file serving in one process |
| SQLite + SQLAlchemy | Zero-infra local dev; swap to PostgreSQL via `DATABASE_URL` |
| OpenAI GPT with function calling | AI can query real DB data (products, orders, sales) via tools |
| Razorpay (Web JS + Android WebView) | Standard checkout on web; WebView-based on Android |
| Expo SDK 54 (React Native) | Cross-platform Android with managed workflow |
| GitHub Actions CI | Automated tests + Expo EAS cloud builds |

---

## 6. Feature Specifications

### 6.1 Global Product Search

Available on both web and Android. Searches across ALL shops in real-time.

**Web:** `GlobalSearch.jsx` component in the top nav bar
- Debounced API calls (350ms) to `GET /products/search` and `GET /shops?search=`
- Dropdown overlay with **Products** section (image, name, shop, price) and **Shops** section
- Recent searches persisted in localStorage; trending category chips
- Clicking a result navigates to that shop on the Marketplace page

**Android:** Inline search in `MarketplaceScreen`
- Debounced API calls (400ms) to `GET /products/search`
- Dropdown below search bar with product results (image, name, shop, price)
- Tapping a product navigates to the shop detail screen

### 6.2 Marketplace

**Features (both platforms):**
- Location filter (All, Green Valley, Central Market, Food Plaza, Milk Lane, Old Town)
- Category filter chips (Grocery, Dairy, Vegetables & Fruits, etc.)
- Shop cards with logo, rating, delivery radius, category badge
- Product detail with discount badges, low-stock warnings, out-of-stock dimming
- Cart with single-shop constraint, quantity controls

### 6.3 Cart & Checkout

**Payment methods:**

| Method | Web | Android |
|--------|-----|---------|
| Cash on Delivery | ✓ | ✓ |
| Razorpay (Online) | ✓ (JS SDK) | ✓ (WebView) |
| UPI (QR + App) | ✓ (QR modal) | ✓ (QR + Linking) |

**Discount calculations (both platforms):**
- Product discounts: percentage off when min quantity met
- Order discounts: percentage or flat amount when min bill amount met
- Bill summary shows itemized savings breakdown

### 6.4 Order History

- Status pipeline: `pending → accepted → ready → out_for_delivery → delivered`
- Cancel orders (before acceptance)
- **Invoice/Receipt modal** — formatted receipt with HyperMart branding, item table, totals (web: printable; Android: modal)
- Status filter tabs with badge counts

### 6.5 Owner Dashboard

Six-tab interface: Overview · Products · Orders · Billing · Reports · Settings

**Overview:**
- Analytics cards (orders, revenue, products, low stock)
- Shop profile card with logo upload (ImagePicker)
- AI restock advice card (triggers `POST /ai/low-stock-insight` with real DB data)

**Billing (Walk-in POS):**
- Product search-and-select dropdown (search by name, shows price/stock)
- Quick-add product: if product not found, inline form to create it on the spot
- Quantity stepper (+/-) per item
- Bill summary with item totals
- Payment: Cash / UPI (with QR code modal) / Card
- UPI QR shows shop's UPI ID with bill amount embedded

**Reports:**
- AI Sales Forecast card (triggers `POST /ai/sales-forecast` with real order/revenue data)
- Date-range report loading with stats cards

### 6.6 Shop Reviews

Customers can view and submit reviews (rating + comment) for shops. Reviews display with star ratings and avatar initials.

---

## 7. AI Features — OpenAI Function Calling

> **Provider:** OpenAI GPT-4o-mini via `httpx` async (no SDK). `OPENAI_API_KEY` stays server-side.

### 7.1 Architecture

```
Browser / App
  └─► POST /ai/chat  (with message, role, history)
            │
            ▼
     FastAPI (ai.py) ──► OpenAI API (with tools definition)
            │                    │
            │              ◄─── tool_calls (e.g. search_products)
            │
     execute_tool() ──► SQLite DB (real-time query)
            │
            ▼
     Tool result sent back to OpenAI
            │
            ▼
     Final response ──► returned to browser/app
```

### 7.2 AI Tools (Function Calling)

10 tools available, filtered by role:

| Tool | Description | Roles |
|------|-------------|-------|
| `search_products` | Search by name/category/keyword across all shops | All |
| `get_popular_products` | Top sellers by actual sales volume | Customer, Owner, Admin |
| `get_all_products` | Browse all products, optional category filter | Customer, Owner |
| `get_shop_products` | Full inventory for a specific shop | Owner |
| `get_shop_info` | Shop details: name, rating, location, status | All |
| `list_shops` | Available shops with location/category filter | Customer, Admin |
| `get_sales_summary` | Revenue, orders, top products for a shop (N days) | Owner |
| `get_low_stock_items` | Products below stock threshold | Owner |
| `get_order_status` | Order details: status, items, payment | All |
| `get_platform_stats` | Total shops, users, orders, revenue | Admin |

**Category keyword mapping:** Handles natural language ("fruits" → Vegetables & Fruits, "snacks" → Bakery & Snacks, etc.)

Up to 3 tool rounds per message. Response includes `tools_used[]` and `sources[]`.

### 7.3 Other AI Endpoints

| Endpoint | Trigger | Enhanced with DB data |
|----------|---------|----------------------|
| `POST /ai/suggest-products` | Owner types ≥2 chars | Yes — avoids suggesting existing inventory |
| `POST /ai/generate-description` | Owner clicks AI Generate | No — pure prompt |
| `POST /ai/low-stock-insight` | Owner dashboard | Yes — auto-queries stock + recent sales |
| `POST /ai/sales-forecast` | Reports tab | Yes — uses real daily revenue/orders/top products |

### 7.4 Role-Based Quick Prompts

Chat widget shows context-aware suggestion chips:

| Customer | Owner | Admin |
|----------|-------|-------|
| Popular products | Sales this week | Platform stats |
| Shops near me | Low stock alert | Pending shops |
| Dairy recommendations | Top sellers | Revenue overview |
| Track order | Pricing tips | User activity |

### 7.5 Graceful Degradation

| Failure | Handling |
|---------|----------|
| `OPENAI_API_KEY` not set | `GET /ai/status → {available: false}` — all AI UI hidden |
| API rate limit / error | Endpoints return empty response; no crash |
| Tool execution error | Returns error string; AI explains the issue |

---

## 8. Map & Geolocation

**Nearby Shops** — `GET /shops/nearby?lat=&lng=&radius=` implemented with bounding-box + Haversine approximation. Web frontend renders shops on interactive Leaflet map.

**Owner Shop Location Pinning** — Interactive Leaflet map in Settings tab. Click to set lat/lng.

---

## 9. Payment Integration

### 9.1 Razorpay

**Web:** Razorpay checkout.js loaded in `index.html`. Flow: `placeOrder` → `createRazorpayOrder` → `Razorpay.open()` → `verifyRazorpayPayment`.

**Android:** WebView-based checkout. HTML template with Razorpay JS SDK rendered in `react-native-webview`. `postMessage` callback for success/failure/dismiss.

**Backend endpoints:**
- `POST /payments/create-order` — creates Razorpay order
- `POST /payments/verify` — verifies payment signature

### 9.2 UPI

**Customer checkout:** QR code generated via `api.qrserver.com` with `upi://pay` deep link. "Open UPI App" button uses `Linking.openURL`.

**Owner walk-in billing:** UPI QR modal shows shop's UPI ID + bill amount. "Customer Paid — Record Sale" button.

---

## 10. Subscription System

- ₹10/month, 30-day period, mock payment
- States: `pending → active → expired`
- `POST /subscriptions/activate` — activates or extends
- Required for `POST /shops` — HTTP 402 if not active

---

## 11. Multi-Language Support

Three languages: English (`en`), Hindi (`hi`), Telugu (`te`).
Translation files: `public/locales/{en,hi,te}/translation.json` (~186 keys each).
LanguageSelector component in app header.

---

## 12. Admin Panel

| Tab | Description |
|-----|-------------|
| Shops | Approve / suspend shops |
| Users | Change roles, enable multi-location |
| Analytics | Platform metrics from `GET /analytics/platform` |
| Subscriptions | View all subscription rows |

---

## 13. Mobile App (Expo / Android)

### 13.1 Stack

| Technology | Version |
|-----------|---------|
| Expo SDK | 54 |
| React Native | 0.81.5 |
| React | 19.1.0 |
| Navigation | React Navigation 7 (bottom tabs + native stack) |
| Icons | @expo/vector-icons (Ionicons) |
| Image Picker | expo-image-picker |
| Location | expo-location |
| Secure Storage | expo-secure-store |
| WebView | react-native-webview (Razorpay checkout) |

### 13.2 Screen Structure

```
AuthStack
  ├── SignInScreen (login + register tabs)
  └── ForgotPasswordScreen

CustomerTabs
  ├── Marketplace (MarketplaceScreen → ShopDetailScreen → CartScreen)
  ├── Orders (OrderHistoryScreen + InvoiceModal)
  ├── Profile (CustomerProfileScreen)
  └── Settings (CustomerSettingsScreen)

OwnerTabs
  ├── Dashboard (OwnerDashboardScreen — 6 tabs)
  └── Profile (OwnerProfileScreen)

AdminTabs
  └── Panel (AdminPanelScreen)
```

### 13.3 Feature Parity with Web

| Feature | Web | Android |
|---------|-----|---------|
| Global product search | ✓ GlobalSearch component | ✓ MarketplaceScreen dropdown |
| Razorpay payment | ✓ JS SDK | ✓ WebView checkout |
| UPI payment | ✓ QR modal | ✓ QR + Linking |
| Invoice/receipt | ✓ Printable modal | ✓ InvoiceModal component |
| Cart discounts | ✓ Full calculation | ✓ Full calculation |
| AI chat widget | ✓ Floating panel | ✓ Bottom sheet modal |
| Shop reviews | ✓ View + submit | ✓ View + submit |
| Order cancellation | ✓ | ✓ |
| Walk-in POS billing | ✓ | ✓ (search/select + UPI QR) |
| Quick-add product from billing | ✓ Inline form | ✓ Inline form |
| AI low-stock insight | ✓ | ✓ |
| AI sales forecast | ✓ | ✓ |
| Role-based quick prompts | ✓ | ✓ |

### 13.4 Tests

Unit tests in `frontend_android/__tests__/`:
- `utils.test.js` — fixImageUrl, normalizeList, calcCartTotal, buildUPIUri, walkinBillTotal, canShowUPIQR, order transitions
- `api.test.js` — all API endpoint URL assertions
- `cartReducer.test.js` — ADD, REMOVE, UPDATE_QTY, CLEAR actions

---

## 14. CI/CD Pipeline

### GitHub Actions Workflows

| Workflow | Trigger | Steps |
|----------|---------|-------|
| `android-ci.yml` | Push to main / PR touching `frontend_android/**` | `npm ci` → `npm test --ci --coverage` → `expo config` validation |
| `android-release.yml` | Tag `v*` / manual dispatch | EAS cloud build → download APK → upload artifact → GitHub Release |
| `deploy-frontend.yml` | Push to main touching `frontend/**` | Vercel build + deploy |
| `deploy-backend.yml` | Push to main touching `backend/**` | Render deploy hook |

`.npmrc` in `frontend_android/` sets `legacy-peer-deps=true` to resolve peer dependency conflicts.

---

## 15. Navigation & Routing

**Web:** React HashRouter

| Route | Component | Guard |
|-------|-----------|-------|
| `/login` | SignIn | Public |
| `/marketplace` | Marketplace | Authenticated |
| `/owner` | OwnerDashboard | `owner` or `admin` |
| `/admin` | AdminPanel | `admin` |
| `/profile` | CustomerProfile | Authenticated |
| `/settings` | CustomerSettings | Authenticated |
| `/orders` | OrderHistory | `customer` |

**Android:** React Navigation bottom tabs + native stack (see Section 13.2)

---

## 16. UI/UX Specifications

### Web

| Aspect | Implementation |
|--------|---------------|
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion |
| Icons | Lucide React |
| Maps | React-Leaflet |

### Android

| Aspect | Implementation |
|--------|---------------|
| Styling | React Native inline styles with theme constants (Colors, BorderRadius, Spacing, Shadow) |
| Icons | Ionicons via @expo/vector-icons |
| Navigation | Bottom tabs + native stack |

---

## 17. Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `VITE_API_URL` | `frontend/.env` | Backend URL for web SPA |
| `EXPO_PUBLIC_API_URL` | `frontend_android/.env` | Backend URL for Android app |
| `JWT_SECRET` | backend env | JWT HS256 signing secret |
| `OPENAI_API_KEY` | backend env | OpenAI API key — AI features disabled if absent |
| `OPENAI_MODEL` | backend env | Model ID (default: `gpt-4o-mini`) |
| `RAZORPAY_KEY_ID` | backend env | Razorpay public key |
| `RAZORPAY_KEY_SECRET` | backend env | Razorpay secret key |
| `DATABASE_URL` | backend env | SQLite path (swap for Postgres in production) |
| `VITE_RAZORPAY_KEY_ID` | `frontend/.env.example` | Razorpay test key for web |

---

## 18. Error Handling & Edge Cases

| HTTP Code | Scenario |
|-----------|----------|
| 400 | Duplicate email; invalid file type |
| 401 | Missing/expired JWT |
| 402 | Subscription missing or expired |
| 403 | Insufficient role permissions |
| 404 | Resource not found |
| 409 | Delete product with active orders |
| 422 | Validation failure; invalid status transition; insufficient stock |
| 503 | OpenAI API key not configured |

---

## 19. Known Limitations & Backlog

### Current Limitations (v4.0)

| Limitation | Notes |
|------------|-------|
| No email verification | Registration accepts any email without confirmation |
| Subscription is mock payment | No real payment gateway for subscriptions |
| Notifications UI-only | Toggle preferences not persisted to backend |
| No image size limit | File upload has no max size enforcement |
| Walk-in orders use owner as customer | Walk-in orders record owner's user ID |

### Backlog (Future)

- Email verification + OTP flow
- Real subscription payment (Razorpay recurring)
- Push notifications / SMS for order status
- Customer delivery address management
- Redis sessions for horizontal scaling
- Product image gallery (multiple images)

---

## 20. Acceptance Criteria Checklist

| # | Criteria | Status |
|---|----------|--------|
| 1 | Customer can register, login, browse shops, add to cart, place order | ✓ |
| 2 | Customer can search products globally across all shops | ✓ |
| 3 | Customer can pay via Razorpay, UPI, or COD | ✓ |
| 4 | Customer can view order history with invoices | ✓ |
| 5 | Customer can cancel orders before acceptance | ✓ |
| 6 | Customer can submit shop reviews | ✓ |
| 7 | Cart applies product + order discounts with savings breakdown | ✓ |
| 8 | Owner can register, activate subscription, create shop, add products | ✓ |
| 9 | Owner can manage orders through full status pipeline | ✓ |
| 10 | Owner walk-in POS billing with product search, UPI QR, quick-add | ✓ |
| 11 | Owner can use AI product suggestions, descriptions, restock advice | ✓ |
| 12 | Owner can view AI sales forecast based on real data | ✓ |
| 13 | Owner can pin shop location on Leaflet map | ✓ |
| 14 | Owner can upload shop logo via ImagePicker | ✓ |
| 15 | Admin can approve/suspend shops and manage user roles | ✓ |
| 16 | Admin can view platform-wide analytics and subscriptions | ✓ |
| 17 | AI chat uses OpenAI function calling with 10 real-time DB tools | ✓ |
| 18 | AI chat shows role-based quick prompts and tool usage badges | ✓ |
| 19 | Multi-language support (en/hi/te) with persistent preference | ✓ |
| 20 | Android app with full feature parity via Expo SDK 54 | ✓ |
| 21 | GitHub Actions CI for Android (tests + EAS build) | ✓ |
| 22 | Forgot password / reset password flow | ✓ |
| 23 | Nearby shops API with distance-based filtering | ✓ |
| 24 | Password change endpoint | ✓ |
| 25 | Account deletion | ✓ |
| 26 | Swagger UI accessible at `/docs` | ✓ |
| 27 | Graceful AI degradation when API key absent | ✓ |

---

*End of PRD — HyperMart v4.0*
