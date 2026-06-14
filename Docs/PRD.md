# HyperShopIndia — Full Product Requirements Document

**Version:** 5.0
**Date:** June 14, 2026
**Status:** Live in Production
**Live URL:** https://hypershopindia.com  ·  **API:** https://hypershopindia.com/api
**Stack (deployed):** React 18 (JSX) · Vite 6 · Tailwind CSS 4 · React-Leaflet · Razorpay · **PHP 8 + MySQL (MariaDB)** on Hostinger shared hosting · JWT (native HS256) · **OpenRouter / OpenAI GPT-4o-mini** · Hostinger SMTP email
**Reference backends (feature-parity alternatives):** Python FastAPI + SQLAlchemy · Node.js Express + sql.js
**Platforms:** Web SPA (production) · Android (Expo SDK 54)
**Repository:** https://github.com/senamallas-pixel/hypermart

> **Brand note:** the product is branded **HyperShopIndia**. (Some internal code identifiers and the repo name retain the original `hypermart` slug.)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Authentication & Session Management](#4-authentication--session-management)
5. [System Architecture](#5-system-architecture)
6. [Feature Specifications](#6-feature-specifications)
7. [AI Features — OpenRouter / OpenAI Function Calling](#7-ai-features--openrouter--openai-function-calling)
8. [Notifications & Email](#8-notifications--email)
9. [Map & Geolocation](#9-map--geolocation)
10. [Payment Integration](#10-payment-integration)
11. [Subscription System](#11-subscription-system)
12. [Multi-Language Support](#12-multi-language-support)
13. [Admin Panel](#13-admin-panel)
14. [Mobile App (Expo / Android)](#14-mobile-app-expo--android)
15. [Deployment (Hostinger)](#15-deployment-hostinger)
16. [CI/CD Pipeline](#16-cicd-pipeline)
17. [Navigation & Routing](#17-navigation--routing)
18. [UI/UX Specifications](#18-uiux-specifications)
19. [Environment Variables](#19-environment-variables)
20. [Error Handling & Edge Cases](#20-error-handling--edge-cases)
21. [Known Limitations & Backlog](#21-known-limitations--backlog)
22. [Acceptance Criteria Checklist](#22-acceptance-criteria-checklist)
23. [Data Models Reference](#23-data-models-reference)

---

## 1. Executive Summary

HyperShopIndia is a **hyperlocal marketplace** (Web + Android) that connects neighbourhood shop owners with customers in the same locality. Shop owners go digital with zero technical overhead; customers get a single, location-aware storefront to discover and order from nearby shops.

The production deployment runs on **Hostinger shared hosting** — a static React SPA served at the domain root and a **dependency-free PHP 8 + MySQL** API at `/api`. The Python (FastAPI) and Node (Express) backends are maintained as **feature-parity alternatives** and share the same REST contract.

### Core Value Propositions

| Persona | Value |
|---------|-------|
| **Customer** | Discover, browse, and order from nearby shops; global product search; category Explore page; Razorpay/UPI/COD payments; AI shopping assistant; in-app + email notifications |
| **Shop Owner** | Digital storefront, inventory control, walk-in POS billing with UPI QR, AI product/sales tools, order management, new-order alerts (bell + email) |
| **Admin** | Full platform governance — shop management, user management, platform-wide analytics |

---

## 2. Goals & Success Metrics

### Product Goals

- Enable local shop owners to go digital with zero technical effort.
- Let customers discover and order from nearby shops filtered by locality.
- Provide real-time order/inventory tracking and notifications.
- Offer AI-assisted features via an LLM (OpenRouter/OpenAI) with real-time database tool calling.
- Run entirely on low-cost shared hosting (PHP + MySQL), with web and Android experiences.

### Key Metrics (Target at Launch)

| Metric | Target |
|--------|--------|
| Shop onboarding time | < 5 minutes from registration to live shop (auto-approved) |
| Order placement steps | ≤ 3 taps from shop page to order confirmation |
| Page load (LCP) | < 2.5 seconds on 4G |
| API reads per customer session | < 500 |
| Notification delivery | In-app immediately; email within seconds (if SMTP configured) |

---

## 3. User Roles & Permissions

### Role Matrix

| Action | `customer` | `owner` | `admin` |
|--------|:---------:|:-------:|:-------:|
| Browse approved shops | ✓ | ✓ | ✓ |
| Global product search + Explore categories | ✓ | ✓ | ✓ |
| Add to cart & place orders | ✓ | ✗ | ✗ |
| Pay via Razorpay / UPI / COD | ✓ | ✗ | ✗ |
| View own order history + invoices | ✓ | ✗ | ✗ |
| Cancel orders (before acceptance) | ✓ | ✗ | ✗ |
| Submit shop reviews | ✓ | ✗ | ✗ |
| Register a shop (goes live immediately) | ✗ | ✓ | ✗ |
| Manage own shop inventory / orders | ✗ | ✓ | ✓ |
| Walk-in POS billing with UPI QR | ✗ | ✓ | ✓ |
| Use AI product/sales tools | ✗ | ✓ | ✓ |
| Approve / suspend shops | ✗ | ✗ | ✓ |
| Manage all users & roles | ✗ | ✗ | ✓ |
| View platform-wide analytics | ✗ | ✗ | ✓ |
| In-app + email notifications | ✓ | ✓ | ✓ |

### Admin Override Rule

The email `senamallas@gmail.com` is always forced to the `admin` role on register/login.

---

## 4. Authentication & Session Management

- **Email + Password** — native credentials, no OAuth.
- **JWT HS256**, 30-day expiry. PHP backend implements JWT natively (no library); payload `{"sub": "<user_id>", "exp": <unix>}`.
- **Passwords**: PHP backend uses bcrypt (`password_hash`); the Python reference uses passlib `pbkdf2_sha256`. (Production runs on a fresh MySQL DB seeded with bcrypt hashes.)
- Web: token in `sessionStorage` (`hypermart_token`); Android: `expo-secure-store`.
- Axios interceptor attaches `Authorization: Bearer`.
- Forgot/reset password: `POST /auth/forgot-password` + `POST /auth/reset-password`.
- **Login alert**: every login creates a "New sign-in" notification (in-app + email) including **device** (parsed User-Agent) and **location** (IP geolocation via ip-api.com).

**Demo credentials** (after seeding):

| Role | Email | Password |
|------|-------|----------|
| Customer | `ravi@example.com` | `Customer@123` |
| Shop Owner | `anand@example.com` | `Owner@123` |
| Admin | `senamallas@gmail.com` | `Admin@123` |

---

## 5. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│   Web Browser (SPA)  —  https://hypershopindia.com                │
│   React 18 · Vite 6 · Motion · Leaflet · Tailwind 4               │
│   GlobalSearch · Explore · NotificationBell · AIChatWidget        │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│   Android (Expo SDK 54)       │                                    │
│   React Native · AIChatWidget · InvoiceModal · Razorpay WebView    │
└──────────────────────────────┬───────────────────────────────────┘
                               │  HTTPS / JSON   (/api)
┌──────────────────────────────▼───────────────────────────────────┐
│   PHP 8 API  (Hostinger shared hosting — public_html/api)         │
│   index.php (front controller) + .htaccess router                 │
│   src/: Database(PDO) · Auth(JWT) · Router · Present · Enums       │
│         Mailer(SMTP) · Notifier · AiTools · Validation            │
│   src/controllers/: Auth, User, Subscription, Shop, Product,      │
│         Order, Payment, Analytics, Supplier, PurchaseOrder,        │
│         Discount, Upload, Ai, Notification                         │
└──────┬──────────────────┬──────────────────┬─────────────────────┘
       │ PDO / MySQL       │ cURL             │ cURL
┌──────▼──────────┐  ┌─────▼───────────┐ ┌────▼──────────────────────┐
│ MySQL (MariaDB) │  │ OpenRouter /    │ │ SMTP (smtp.hostinger.com) │
│ shop data +     │  │ OpenAI GPT-4o-  │ │ noreply@hypershopindia.com│
│ notifications   │  │ mini (10 tools) │ └───────────────────────────┘
└─────────────────┘  └─────────────────┘
   Local uploads → public_html/api/uploads/  (served at /api/uploads)
```

### Backends (three, one REST contract)

| Backend | Path | Stack | Role |
|---------|------|-------|------|
| **PHP** | `Backend_php/` | PHP 8 + PDO/MySQL, zero deps | **Deployed** on Hostinger |
| Python | `Backend_python/` | FastAPI + SQLAlchemy + SQLite/Postgres | Reference / alternative |
| Node | `backend-node/` | Express + sql.js | Reference / alternative |

All three implement the same endpoints, JSON shapes, notifications, SMTP email, OpenRouter AI, local uploads, and auto-approve behavior.

### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| PHP 8 + MySQL deployed backend | Runs on inexpensive Hostinger shared hosting (no Node/Python server needed) |
| Zero-dependency PHP (no Composer) | JWT/HMAC/SMTP via native PHP + cURL; deploy by file upload |
| Static SPA at root + PHP API at `/api` | Single domain; same-origin API calls |
| Enum keys stored, values exchanged | DB stores `vegetables`/`green_valley`; API/UI use `Vegetables & Fruits`/`Green Valley` |
| OpenRouter or OpenAI (provider-agnostic) | `OPENROUTER_API_KEY` switches base URL; falls back to OpenAI |
| Local filesystem uploads | Images stored under `public_html/api/uploads/`, served statically |

---

## 6. Feature Specifications

### 6.1 Global Product Search

Available on web and Android; searches across ALL shops in real-time.

**Web:** `GlobalSearch.jsx`
- Debounced calls (350ms) to `GET /products/search` and `GET /shops?search=`.
- Focus shows **Trending** chips; typing shows **Products** + **Shops** results; recent searches in localStorage.
- **Responsive placement:** on desktop the search lives in the sticky header; on mobile it is a full-width bar in the hero, **also sticky** (header → search → categories all pin on scroll).
- Clicking a result navigates to that shop on the marketplace.

**Android:** inline search in `MarketplaceScreen` (debounced 400ms).

### 6.2 Marketplace

- Location filter (All, Green Valley, Central Market, Food Plaza, Milk Lane, Old Town) with **GPS "Use Current Location"** (browser Geolocation + Nominatim reverse geocoding) and strict location filtering ("No Shops Near You" empty state).
- Sticky category-pill bar (Grocery, Dairy, Vegetables & Fruits, …).
- Shop cards with logo, rating, delivery radius, category badge.
- Product detail with discount badges, low-stock warnings, out-of-stock dimming.
- Cart with single-shop constraint, quantity controls, real-time discount calculation.

### 6.3 Explore (All Categories)

Dedicated `/explore` page (the **Explore** tab, centre of the mobile bottom nav). Mirrors a Blinkit-style "All Categories" browser:
- Grouped sections (Grocery & Kitchen, Snacks & Drinks, Household & Personal Care).
- Category cards (image + label) in a 4-column mobile grid.
- Tapping a category opens the marketplace filtered to that category.

### 6.4 Cart & Checkout

| Method | Web | Android |
|--------|-----|---------|
| Cash on Delivery | ✓ | ✓ |
| Razorpay (Online) | ✓ (JS SDK) | ✓ (WebView) |
| UPI (QR + App) | ✓ (QR modal) | ✓ (QR + Linking) |

Discounts (both platforms): product discounts (BOGO, buy_x_get_y, bulk_price, individual %/flat) + order discounts (percentage/flat on min bill); itemized savings breakdown.

### 6.5 Order History

- Status pipeline: `pending → accepted → ready → out_for_delivery → delivered` (or `rejected`).
- Cancel before acceptance (restores stock).
- Invoice/Receipt modal with HyperShopIndia branding.
- Each transition fires a notification (in-app + email) to the customer.

### 6.6 Owner Dashboard

Six-tab interface: Overview · Inventory · Orders · Billing · Reports · Settings.

- **Overview**: analytics cards, shop profile + logo upload, AI restock advice (`POST /ai/low-stock-insight`).
- **Inventory** (Catalog, Stock, Stock Adjustment, Bulk Discount, Credit/Suppliers, Trash/Purchase Orders) with pagination.
- **Billing (Walk-in POS)**: product search with autocomplete, quick-add product, quantity steppers, bill summary, Cash/UPI(QR)/Card, `order_type=walkin`.
- **Reports**: AI sales forecast (`POST /ai/sales-forecast`), date-range report (Today/7/30/Custom), Daily Sales Calendar with walk-in vs online split, CSV export.
- New orders, cancellations, reviews, and shop approval changes all notify the owner (bell + email).

### 6.7 Shop Reviews / Discounts / Suppliers & POs

Unchanged in behavior — reviews (rating + comment), product/order discounts, suppliers CRUD, and purchase orders (`draft → sent → received → cancelled`, stock auto-increments on "received"). A new review now notifies the shop owner.

### 6.8 Shop Approval (changed)

New shops are **auto-approved on creation** (`status = approved`) so the owner's shop and products are immediately live and searchable. Admins can still suspend/approve shops (which notifies the owner). *(Previously new shops started `pending`.)*

### 6.9 File Uploads (changed)

`POST /upload` saves images to the **local filesystem** at `public_html/api/uploads/` and returns a relative `/uploads/<uuid>.<ext>` URL (the frontend prepends `VITE_API_URL` → `https://hypershopindia.com/api/uploads/…`). Validates extension (jpg/jpeg/png/gif/webp) and `MAX_UPLOAD_MB`. *(Previously Cloudinary; Cloudinary remains an optional fallback in the Python backend.)*

---

## 7. AI Features — OpenRouter / OpenAI Function Calling

> **Provider:** provider-agnostic. If `OPENROUTER_API_KEY` is set, calls `https://openrouter.ai/api/v1/chat/completions` with model `openai/gpt-4o-mini` and OpenRouter attribution headers; otherwise falls back to OpenAI. The key stays server-side. Production uses **OpenRouter**.

### 7.1 AI Tools (Function Calling)

10 role-filtered tools (same as before): `search_products`, `get_popular_products`, `get_all_products`, `get_shop_products`, `get_shop_info`, `list_shops`, `get_sales_summary` (now includes per-product **revenue**), `get_low_stock_items`, `get_order_status`, `get_platform_stats`. Up to 3 tool rounds per message; response includes `tools_used[]` and `sources[]`. Category keyword mapping handles natural language.

### 7.2 Other AI Endpoints

| Endpoint | Trigger | DB-enhanced |
|----------|---------|-------------|
| `POST /ai/suggest-products` | Owner types ≥2 chars | Yes |
| `POST /ai/generate-description` | Owner clicks AI Generate | No |
| `POST /ai/low-stock-insight` | Owner dashboard | Yes |
| `POST /ai/sales-forecast` | Reports tab | Yes |
| `GET /ai/status` | Frontend gate | — (`{available: bool}`) |

### 7.3 Chat Widget

Floating assistant (web + Android) with role-based quick-prompt chips and tool-usage badges. The compact product format uses real prices from tool data (never a literal placeholder).

### 7.4 Graceful Degradation

If no AI key is set, `GET /ai/status → {available:false}` and AI UI is hidden; API/tool errors return safe fallback messages, never crashing the request.

---

## 8. Notifications & Email

A unified notification system: every significant event creates an **in-app notification** (header bell) **and** sends an **email** (via Hostinger SMTP).

### 8.1 Events

| Event | Recipient |
|-------|-----------|
| Order placed | Customer (confirmation) + shop Owner (new-order alert) |
| Order status change | Customer |
| Order cancelled | Shop Owner |
| Shop approved / suspended | Shop Owner |
| New review | Shop Owner |
| Account created | New user (welcome) |
| New sign-in (login) | User — includes device + location + IP |

### 8.2 In-App (bell)

- `NotificationBell` in the header with an unread-count badge; polls unread count every 30s.
- Dropdown lists notifications (newest first), "Mark all read", click-to-read.
- **Clicking a notification navigates** to the relevant page (orders → `/orders`, owner events → `/owner`, login → `/settings`, welcome → `/marketplace`); items show a `›` affordance.
- The bell, user menu, and location dropdown are **mutually exclusive** (opening one closes the others).

### 8.3 Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /notifications/me?limit=30` | List user's notifications + `unread_count` |
| `GET /notifications/me/unread-count` | Unread count |
| `PATCH /notifications/{id}/read` | Mark one read (404 if not the caller's) |
| `POST /notifications/read-all` | Mark all read |

### 8.4 Email (SMTP)

- Sent via `smtp.hostinger.com:465` (SSL) from `noreply@hypershopindia.com`.
- PHP: native socket SMTP client (`Mailer`); Python: stdlib `smtplib`; Node: `nodemailer`.
- Configured via `SMTP_*` env vars; **graceful no-op** if unset (app still works; in-app notifications still recorded).

---

## 9. Map & Geolocation

- **Nearby Shops** — `GET /shops/nearby?lat=&lng=&radius=` (bounding-box + Haversine). Leaflet map on web.
- **Owner location pinning** — interactive Leaflet map in Settings.
- **Customer GPS detection** — header location dropdown "Use Current Location" (browser Geolocation + Nominatim), strict location filtering. The location dropdown is mobile-responsive (fits the viewport).

---

## 10. Payment Integration

### Razorpay
- **Web:** checkout.js. Flow: `placeOrder → createRazorpayOrder → Razorpay.open() → verifyRazorpayPayment`.
- **Android:** WebView checkout with `postMessage` callback.
- Backend: `POST /payments/create-order` (cURL to Razorpay in PHP), `POST /payments/verify` (HMAC-SHA256 signature check).

### UPI
- Customer checkout: `upi://pay` QR + "Open UPI App".
- Owner walk-in: UPI QR with shop UPI ID + amount; public `GET /pay/{order_id}` HTML page + `POST /pay/{order_id}/confirm`.

---

## 11. Subscription System

₹10/month, 30-day period, mock payment. States `pending → active → expired`. `POST /subscriptions/activate` activates/extends. Owners get a free active month on registration; `POST /shops` requires an active subscription for owners (HTTP 402 otherwise).

---

## 12. Multi-Language Support

Three languages: English (`en`), Hindi (`hi`), Telugu (`te`). Translation files in `frontend/public/locales/{en,hi,te}/translation.json`. **The language switcher moved into the user dropdown menu** (a collapsible "Language" item under Orders) — it is no longer a standalone header button.

---

## 13. Admin Panel

| Tab | Description |
|-----|-------------|
| Shops | Approve / suspend shops (notifies owner) |
| Users | Change roles, enable multi-location |
| Analytics | Platform metrics from `GET /analytics/platform` |
| Subscriptions | View all subscription rows |

---

## 14. Mobile App (Expo / Android)

### 14.1 Stack
Expo SDK 54 · React Native 0.81.5 · React 19 · React Navigation 7 · Ionicons · expo-image-picker · expo-location · expo-secure-store · react-native-webview.

### 14.2 Screens
AuthStack (SignIn, ForgotPassword) · CustomerTabs (Marketplace → ShopDetail → Cart, Orders, Profile, Settings) · OwnerTabs (Dashboard, Profile) · AdminTabs (Panel).

### 14.3 Parity
Global search, Razorpay, UPI, invoices, cart discounts, AI chat, reviews, order cancellation, walk-in POS, AI insights/forecast, role-based prompts.

> **Note:** the Android app currently retains the original branding and some pre-rebrand strings; the notification-link and rebrand changes were applied to the **web app** first. Bringing the Android app to full parity (rebrand + in-app notifications + navigation) is in the backlog.

### 14.4 Tests
`frontend_android/__tests__/`: `utils.test.js`, `api.test.js`, `cartReducer.test.js`.

---

## 15. Deployment (Hostinger)

The whole stack runs on a single **Hostinger Premium shared hosting** account.

| Layer | Location | Served at |
|-------|----------|-----------|
| Frontend (static React build) | `domains/hypershopindia.com/public_html/` | `https://hypershopindia.com` |
| PHP API | `domains/hypershopindia.com/public_html/api/` | `https://hypershopindia.com/api` |
| Image uploads | `…/public_html/api/uploads/` | `https://hypershopindia.com/api/uploads/…` |
| MySQL database | hPanel → Databases (`u529915367_hyper`) | `localhost` from PHP; `srv672.hstgr.io` for remote/CI |
| Email | hPanel → Emails (`noreply@hypershopindia.com`) | `smtp.hostinger.com:465` |

- The frontend uses `HashRouter` (no server rewrites needed); a `.htaccess` forces HTTPS, sets `DirectoryIndex index.html`, gzips, and caches hashed assets.
- The API `.htaccess` routes all requests to `index.php`, passes the `Authorization` header, and denies direct access to `src/`, `.env`, and `*.sql`.
- Server `.env` (in `public_html/api/`) holds DB creds, `JWT_SECRET`, `OPENROUTER_API_KEY`, and `SMTP_*`; it is never overwritten by deploys.
- An **end-to-end Playwright suite** (`e2e/`) validates login, marketplace, shop creation + image upload, notifications, and the AI flow against production.

> **Reference setup:** see `Docs/HOSTINGER_CICD.md` and `Backend_php/README.md`.

---

## 16. CI/CD Pipeline

### GitHub Actions Workflows

| Workflow | Trigger | Steps |
|----------|---------|-------|
| `deploy-hostinger-frontend.yml` | Push to `main` touching `frontend/**` | `npm ci` → `vite build` → FTPS upload `dist/` → `public_html/` (excludes `api/`) |
| `deploy-hostinger-php.yml` | Push touching `Backend_php/**` | `php -l` lint → FTPS upload `Backend_php/` → `public_html/api/` (excludes `.env`, `uploads/`) |
| `deploy-hostinger-db.yml` | Manual (`workflow_dispatch`) | Connect via **Remote MySQL** → run `schema.sql` (idempotent); optional reseed via token-guarded `seed.php` |
| `android-ci.yml` | Push/PR touching `frontend_android/**` | `npm ci` → tests → expo config validation |
| `android-release.yml` | Tag `v*` | EAS cloud build → APK artifact / GitHub Release |

The legacy Vercel (`deploy-frontend.yml`) and Render (`deploy-backend.yml`) workflows were **removed** in favour of Hostinger. Required GitHub secrets are documented in `Docs/HOSTINGER_CICD.md`.

---

## 17. Navigation & Routing

**Web:** React HashRouter

| Route | Component | Guard |
|-------|-----------|-------|
| `/login` | SignIn | Public |
| `/marketplace` | Marketplace | Public |
| `/explore` | Explore (All Categories) | Public |
| `/cart` | CartPage | Authenticated |
| `/owner` | OwnerDashboard | `owner` or `admin` |
| `/admin` | AdminPanel | `admin` |
| `/profile` | CustomerProfile | Authenticated |
| `/settings` | CustomerSettings | Authenticated |
| `/orders` | OrderHistory | `customer` |

**Mobile bottom nav (5 tabs):** Shop · Orders · **Explore** (centre) · Cart · Profile/Login.

The header (logo, search, location, notification bell, user menu) and the category bar are **sticky** on scroll across all sizes.

---

## 18. UI/UX Specifications

### Web
| Aspect | Implementation |
|--------|---------------|
| Styling | Tailwind CSS 4 (`overflow-x: clip` to keep sticky working) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Maps | React-Leaflet |

### Android
React Native inline styles with theme constants; Ionicons; bottom tabs + native stack.

---

## 19. Environment Variables

### Frontend (`frontend/.env.production`)
| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | API base — `https://hypershopindia.com/api` |
| `VITE_RAZORPAY_KEY_ID` | Razorpay public key |
| `VITE_APP_NAME` | App name (HyperShopIndia) |

### Backend (`Backend_php/.env`, server-side)
| Variable | Purpose |
|----------|---------|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASS` | MySQL connection (`DB_HOST=localhost` on server) |
| `JWT_SECRET` | JWT HS256 signing secret |
| `OPENROUTER_API_KEY` | OpenRouter key (preferred); `OPENAI_API_KEY` as fallback |
| `OPENAI_MODEL` | Model id (default `openai/gpt-4o-mini` for OpenRouter) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_FROM_NAME` | Hostinger email |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay |
| `MAX_UPLOAD_MB` | Upload size cap (default 5) |
| `SEED_TOKEN` | Guards `seed.php` when run over HTTP |

`EXPO_PUBLIC_API_URL` configures the Android app.

---

## 20. Error Handling & Edge Cases

| HTTP Code | Scenario |
|-----------|----------|
| 400 | Duplicate email; invalid file type; already-paid order |
| 401 | Missing/expired JWT |
| 402 | Subscription missing or expired |
| 403 | Insufficient role permissions; not your order/shop |
| 404 | Resource not found |
| 409 | Delete product with active orders |
| 413 | Upload exceeds `MAX_UPLOAD_MB` |
| 422 | Validation failure; invalid status transition; insufficient stock |
| 500/502/503 | Server error; upstream (Razorpay) failure; AI provider not configured/unavailable |

Email and AI are best-effort: SMTP/AI failures are logged and never block the request.

---

## 21. Known Limitations & Backlog

### Current Limitations (v5.0)

| Limitation | Notes |
|------------|-------|
| No email verification | Registration accepts any email without confirmation |
| Subscription is mock payment | No real gateway for subscription billing |
| New shops auto-approved | Admin pre-approval gate removed (admins can still suspend) |
| Login emails on every sign-in | No "new device only" throttling yet |
| Android app pre-rebrand | Rebrand + in-app notifications not yet ported to Android |
| Render free-tier note (legacy) | No longer used; backend is on Hostinger |

### Backlog (Future)

- Email verification + OTP flow.
- Real subscription payment (Razorpay recurring).
- WhatsApp notifications (Notifier is the integration point — pick a Business API provider).
- Throttle login alerts to new devices/locations.
- Android parity: rebrand, notification bell + deep links.
- Customer delivery-address management; product image galleries.
- Restore optional admin pre-approval as a configurable setting.

---

## 22. Acceptance Criteria Checklist

| # | Criteria | Status |
|---|----------|--------|
| 1 | Customer can register, login, browse, add to cart, place order | ✓ |
| 2 | Global product search across all shops | ✓ |
| 3 | Pay via Razorpay, UPI, or COD | ✓ |
| 4 | Order history with invoices | ✓ |
| 5 | Cancel orders before acceptance | ✓ |
| 6 | Submit shop reviews | ✓ |
| 7 | Cart applies product + order discounts with savings breakdown | ✓ |
| 8 | Owner can register, activate subscription, create shop (auto-approved), add products | ✓ |
| 9 | Owner manages orders through full status pipeline | ✓ |
| 10 | Owner walk-in POS with product search, UPI QR, quick-add | ✓ |
| 11 | Owner AI product suggestions, descriptions, restock advice | ✓ |
| 12 | Owner AI sales forecast on real data | ✓ |
| 13 | Owner pins shop location on Leaflet map | ✓ |
| 14 | Owner uploads shop logo (stored on Hostinger filesystem) | ✓ |
| 15 | Admin approves/suspends shops and manages roles | ✓ |
| 16 | Admin views platform analytics + subscriptions | ✓ |
| 17 | AI chat via OpenRouter/OpenAI with 10 real-time DB tools | ✓ |
| 18 | AI chat shows role-based prompts + tool badges; real prices (no placeholder) | ✓ |
| 19 | Multi-language (en/hi/te); switcher in user menu | ✓ |
| 20 | Android app feature parity (Expo SDK 54) | ✓ (rebrand/notifs pending) |
| 21 | Android CI (tests + EAS build) | ✓ |
| 22 | Forgot/reset password | ✓ |
| 23 | Nearby shops API with distance filtering | ✓ |
| 24 | Password change + account deletion | ✓ |
| 25 | Graceful AI degradation when key absent | ✓ |
| 26 | GPS location detection + strict shop filtering + empty state | ✓ |
| 27 | Pagination (Catalog/Stock) + selectable report calendar + walk-in/online split | ✓ |
| 28 | Suppliers CRUD + Purchase Order workflow | ✓ |
| 29 | Bulk discount manager (BOGO, buy_x_get_y, bulk price, individual) | ✓ |
| 30 | **In-app notification bell** (unread count, mark-read, deep links) | ✓ |
| 31 | **Email notifications** for orders/status/reviews/shop/login/welcome | ✓ |
| 32 | **Login alert** with device + location | ✓ |
| 33 | **Explore (All Categories)** page + centre bottom-nav tab | ✓ |
| 34 | **Local filesystem image uploads** (`/api/uploads`) | ✓ |
| 35 | **PHP + MySQL backend deployed on Hostinger** with CI/CD | ✓ |
| 36 | Three feature-parity backends (PHP, Python, Node) | ✓ |
| 37 | Sticky header/search/categories; mutually-exclusive header menus | ✓ |
| 38 | Production e2e Playwright suite | ✓ |

---

## 23. Data Models Reference

### 23.1 Core Models (14 total)

| Model | Key Fields |
|-------|-----------|
| `User` | uid, email, role, password_hash, multi_location_enabled, phone, last_login |
| `Shop` | owner_id, name, category, location_name, status (default **approved**), lat/lng, upi_id, delivery_radius, rating, review_count |
| `Product` | shop_id, name, price, mrp, stock, low_stock_threshold, expiry_date, image, status |
| `Order` | shop_id, customer_id, total, subtotal, item_discounts, bill_discount, order_type, status, payment_status, payment_method, razorpay_*, delivery_address, accepted_at, out_for_delivery_at, delivered_at |
| `OrderItem` | order_id, product_id, name, price, quantity |
| `Subscription` | user_id, plan_amount, status, starts_at, expires_at |
| `Review` | shop_id, customer_id, rating, comment |
| `PasswordResetToken` | user_id, token, expires_at, used |
| `Supplier` | shop_id, name, contact_person, phone, email, gst_number |
| `PurchaseOrder` | shop_id, supplier_id, total_amount, status, notes |
| `PurchaseOrderItem` | purchase_order_id, product_id, name, price, quantity |
| `ProductDiscount` | shop_id, product_id, type, buy_qty, get_qty, bulk_price, discount_value, discount_amount_type, valid_till |
| `OrderDiscount` | shop_id, min_bill_value, discount_type, discount_value, valid_till |
| **`Notification`** | **user_id, type, title, message, order_id, is_read, created_at** |

### 23.2 Enums

| Enum | Values |
|------|--------|
| `UserRole` | customer, owner, admin |
| `ShopStatus` | pending, approved, suspended |
| `ShopCategory` | Grocery, Dairy, Vegetables & Fruits, Meat, Bakery & Snacks, Beverages, Household, Personal Care |
| `ShopLocation` | Green Valley, Central Market, Food Plaza, Milk Lane, Old Town |
| `ProductStatus` | active, out_of_stock |
| `OrderStatus` | pending, accepted, ready, out_for_delivery, delivered, rejected |
| `PaymentStatus` | pending, paid |
| `PaymentMethod` | cash, upi, razorpay, online |
| `SubscriptionStatus` | pending, active, expired |
| `PurchaseOrderStatus` | draft, sent, received, cancelled |
| `DiscountType` | bogo, buy_x_get_y, bulk_price, individual |
| `DiscountAmountType` | percentage, flat |
| `NotificationType` (values) | order_placed, new_order, order_status, order_cancelled, shop_status, review, welcome, login |

> Enum storage: `ShopCategory` and `ShopLocation` are persisted as **keys** (`vegetables`, `green_valley`) and exchanged over the API as **display values** (`Vegetables & Fruits`, `Green Valley`).

---

*End of PRD — HyperShopIndia v5.0*
