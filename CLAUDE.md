# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HyperMart is a multi-vendor hyperlocal grocery marketplace. React 18 SPA frontend communicates via REST/JSON with a Python FastAPI backend (primary) or a Node.js Express backend (alternative drop-in). SQLite is the database for both backends. Google Gemini 2.0 Flash powers AI features (product suggestions, sales forecasts, chat).

Three user roles: **Customer** (browse/order), **Owner** (manage shop/inventory), **Admin** (platform governance).

## Development Commands

### Frontend (`frontend/`)
```bash
cd frontend && npm install
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # Production build to dist/
npm run preview      # Preview production build
```
Requires `VITE_API_URL=http://localhost:8000` in `frontend/.env`.

### Backend — Python (`backend/`)
```bash
cd backend && pip install -r requirements.txt
python -m uvicorn main:app --reload   # FastAPI on http://localhost:8000
python seed.py --reset                # Seed database with demo data
```
Requires `.env` with: `JWT_SECRET`, `DATABASE_PATH`, `GEMINI_API_KEY` (optional for AI features).

### Backend — Node.js (`backend-node/`)
```bash
cd backend-node && npm install
npm run dev          # Express on http://localhost:8000 (with --watch)
npm run seed:reset   # Seed database
```
Routes mirror the Python backend — frontend works unchanged with either.

### Demo Credentials (after seeding)
- Customer: `ravi@example.com` / `Customer@123`
- Owner: `anand@example.com` / `Owner@123`
- Admin: `senamallas@gmail.com` / `Admin@123`

## Architecture

```
frontend/  →  React 18 + Vite 6 SPA (Tailwind CSS 4, HashRouter)
    src/api/client.js      Axios client with JWT Bearer interceptor
    src/context/AppContext  Auth + cart + i18n + search state (React Context, no Redux)
    src/pages/              Route-level components (Marketplace, OwnerDashboard, AdminPanel, etc.)
    src/components/         Shared UI components
    src/hooks/              useTranslation, useLanguageChange
    src/lib/i18n.js         Lightweight i18n (loads from public/locales/{en,hi,te}/)

backend/   →  Python 3.12 + FastAPI + SQLAlchemy 2 + SQLite
    main.py                All routes and business logic (~1770 lines, monolithic)
    models.py              SQLAlchemy ORM models (User, Shop, Product, Order, etc.)
    schemas.py             Pydantic v2 request/response schemas
    ai.py                  Gemini 2.0 Flash integration via raw httpx
    database.py            SQLite engine, session factory, startup migrations

backend-node/  →  Express 4 + sql.js (WASM SQLite) — drop-in alternative
```

### Key Patterns
- **State persistence**: Cart in `localStorage`, auth token in `sessionStorage`, language preference in `localStorage`.
- **Auth flow**: Register/login → JWT HS256 (30-day expiry) → stored in sessionStorage → Axios interceptor attaches `Authorization: Bearer` header.
- **Admin auto-assignment**: Email `senamallas@gmail.com` is force-assigned the `admin` role.
- **Role-based routing**: Login redirects to `/marketplace` (customer), `/owner` (owner), `/admin` (admin). Routes are guarded by role checks in `App.jsx`.
- **Database migrations**: Applied at startup in `database.py` via ALTER TABLE statements (no migration framework).
- **API base**: All backend endpoints live under `http://localhost:8000` with no `/api` prefix.

### API Route Groups
- `/auth/*` — register, login, forgot-password, reset-password
- `/users/*` — profile CRUD, role management
- `/shops/*` — shop CRUD, nearby search, status
- `/shops/{id}/products/*` — product CRUD, bulk-update
- `/orders/*` — create, list, status updates, cancel
- `/shops/{id}/suppliers/*`, `/shops/{id}/purchase-orders/*` — supply chain
- `/shops/{id}/product-discounts/*`, `/shops/{id}/order-discounts/*` — discount rules
- `/analytics/*`, `/shops/{id}/analytics` — platform and shop analytics
- `/ai/*` — chat, suggest-products, generate-description, low-stock-insight, sales-forecast
- `/subscriptions/*` — owner subscription management

FastAPI auto-generates Swagger docs at `http://localhost:8000/docs`.

## Internationalization

Three languages: English (`en`), Hindi (`hi`), Telugu (`te`). Translation files are JSON in `frontend/public/locales/{lang}/translation.json` (~186 keys each). The custom i18n system uses dot-notation keys (e.g., `common.appName`) resolved via `useTranslation()` hook.

## Documentation

- [Docs/PRD.md](Docs/PRD.md) — Full product requirements document (v3.1)
- [Docs/Imp.md](Docs/Imp.md) — Implementation reference with architecture, schema, API reference, and order status pipeline
