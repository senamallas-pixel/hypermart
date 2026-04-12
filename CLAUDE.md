# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HyperMart is a multi-vendor hyperlocal grocery marketplace with **Web** (React SPA) and **Android** (Expo/React Native) frontends communicating via REST/JSON with a Python FastAPI backend. OpenAI GPT-4o-mini powers AI features via function calling with 10 real-time database tools.

Three user roles: **Customer** (browse/search/order/pay), **Owner** (manage shop/inventory/billing/AI insights), **Admin** (platform governance).

## Development Commands

### Frontend — Web (`frontend/`)
```bash
cd frontend && npm install
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # Production build to dist/
```
Requires `VITE_API_URL=http://localhost:8000` in `frontend/.env`.

### Frontend — Android (`frontend_android/`)
```bash
cd frontend_android && npm install
npx expo start --android   # Expo dev server
npm test                    # Run 108 unit tests
```

### Backend — Python (`backend/`)
```bash
cd backend && pip install -r requirements.txt
python -m uvicorn main:app --reload   # FastAPI on http://localhost:8000
python seed.py --reset                # Seed database with demo data
```
Requires env vars: `JWT_SECRET`, `OPENAI_API_KEY` (optional for AI), `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (optional for payments).

### Backend — Node.js (`backend-node/`)
```bash
cd backend-node && npm install
npm run dev          # Express on http://localhost:8000
npm run seed:reset   # Seed database
```

### Demo Credentials (after seeding)
- Customer: `ravi@example.com` / `Customer@123`
- Owner: `anand@example.com` / `Owner@123`
- Admin: `senamallas@gmail.com` / `Admin@123`

## Architecture

```
frontend/           React 18 + Vite 6 SPA (Tailwind CSS 4, HashRouter)
    src/api/client.js       Axios client with JWT Bearer interceptor
    src/context/AppContext   Auth + cart + i18n + search + targetShopId
    src/components/         GlobalSearch, AIChatWidget, InvoiceModal, etc.
    src/pages/              Marketplace, OwnerDashboard, AdminPanel, etc.

frontend_android/   Expo SDK 54 + React Native 0.81.5
    src/api/client.js       Axios client (mirrors web)
    src/screens/            customer/, owner/, admin/, auth/
    src/components/         AIChatWidget, InvoiceModal, StatCard, etc.
    src/navigation/         CustomerTabs, OwnerTabs, AdminTabs
    __tests__/              utils.test.js, api.test.js, cartReducer.test.js

backend/            Python 3.12 + FastAPI + SQLAlchemy 2 + SQLite
    main.py                 All routes and business logic (~1800 lines)
    ai.py                   OpenAI GPT with function calling (10 DB tools)
    models.py               SQLAlchemy ORM models
    schemas.py              Pydantic v2 request/response schemas
    database.py             SQLite engine, session factory, startup migrations

backend-node/       Express 4 + sql.js — drop-in alternative
```

### Key Patterns
- **State persistence**: Cart in `localStorage`, auth token in `sessionStorage` (web) / `expo-secure-store` (Android).
- **Auth flow**: Register/login → JWT HS256 (30-day) → Axios interceptor attaches `Authorization: Bearer`.
- **Admin auto-assignment**: `senamallas@gmail.com` force-assigned `admin` role.
- **AI function calling**: Chat endpoint sends tool definitions to OpenAI, executes DB queries when tools are called, returns data-informed responses with `tools_used[]` and `sources[]`.
- **Category enum mapping**: SQLite stores enum keys (`vegetables`), not values (`Vegetables & Fruits`). `_resolve_category()` in `ai.py` maps user keywords to enum members.
- **Razorpay**: Web uses JS SDK; Android uses WebView-based checkout with `postMessage` callback.
- **Global search**: `GlobalSearch.jsx` (web) calls `searchProducts` + `listShops` APIs; `MarketplaceScreen.js` (Android) calls `searchProducts`.

### API Route Groups
- `/auth/*` — register, login, forgot-password, reset-password
- `/users/*` — profile CRUD, role management, change-password, delete account
- `/shops/*` — shop CRUD, nearby search, status, UPI
- `/shops/{id}/products/*` — product CRUD, bulk-update
- `/products/search` — global product search across all shops
- `/orders/*` — create, list, status updates, cancel
- `/payments/*` — Razorpay create-order, verify
- `/shops/{id}/suppliers/*`, `/shops/{id}/purchase-orders/*` — supply chain
- `/shops/{id}/product-discounts/*`, `/shops/{id}/order-discounts/*` — discount rules
- `/analytics/*`, `/shops/{id}/analytics` — platform and shop analytics
- `/ai/*` — chat (with tools), suggest-products, generate-description, low-stock-insight, sales-forecast
- `/subscriptions/*` — owner subscription management

### AI Tools (function calling in `/ai/chat`)
10 tools: `search_products`, `get_popular_products`, `get_all_products`, `get_shop_products`, `get_shop_info`, `list_shops`, `get_sales_summary`, `get_low_stock_items`, `get_order_status`, `get_platform_stats`. Tools are role-filtered. Up to 3 tool rounds per message.

## CI/CD

- `.github/workflows/android-ci.yml` — tests on push/PR to `frontend_android/`
- `.github/workflows/android-release.yml` — EAS build on tag `v*`
- `.github/workflows/deploy-frontend.yml` — Vercel deploy on push to `frontend/`
- `.github/workflows/deploy-backend.yml` — Render deploy on push to `backend/`

## Documentation

- [Docs/PRD.md](Docs/PRD.md) — Full product requirements document (v4.0)
- [Docs/Imp.md](Docs/Imp.md) — Implementation reference with architecture, schema, API reference
