<div align="center">
<img width="1200" height="475" alt="HyperMart Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# HyperMart v2

**A neighbourhood marketplace — browse local shops, manage inventory, and place orders.**

🌐 **Live Demo (Firebase v1):** https://senamallas-pixel.github.io/hypermart/

</div>

---

## Overview

HyperMart v2 is a full-stack rebuild of the original Firebase app. It ships **two interchangeable backends** — a Python/FastAPI server and a Node.js/Express server — both backed by SQLite and speaking the same REST API.

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite 6, Tailwind CSS v4, Motion, React Router v6 |
| Backend (Python) | Python 3, FastAPI, SQLAlchemy 2, SQLite, Pydantic v2 |
| Backend (Node.js) | Node.js 18+, Express 4, sql.js (SQLite WASM), JWT, bcryptjs |
| Auth | Email + password — JWT Bearer token stored in `localStorage` |

**Roles:** `customer` · `owner` · `admin`

---

## Project Structure

```
hypermart/
├── backend/              # Python / FastAPI server
│   ├── main.py           # API routes
│   ├── models.py         # SQLAlchemy ORM models
│   ├── schemas.py        # Pydantic request/response schemas
│   ├── database.py       # DB engine & session
│   ├── seed.py           # Demo data seeder
│   └── requirements.txt
│
├── backend-node/         # Node.js / Express server (drop-in replacement)
│   ├── index.js          # All routes, auth, business logic
│   ├── db.js             # sql.js SQLite wrapper (better-sqlite3 compatible API)
│   ├── seed.js           # Demo data seeder (node seed.js / node seed.js --reset)
│   ├── package.json
│   └── uploads/          # Uploaded images (served at /uploads/*)
│
├── frontend/             # React + Vite SPA
│   ├── src/
│   │   ├── App.jsx           # Root shell, auth screens, navigation
│   │   ├── context/          # AppContext (auth + cart + search state)
│   │   ├── api/              # Axios client (client.js)
│   │   ├── components/       # DailySalesCalendar, InvoiceModal, LanguageSelector
│   │   ├── hooks/            # useLanguageChange, useTranslation
│   │   ├── lib/              # i18n setup
│   │   └── pages/            # Marketplace, OwnerDashboard, AdminPanel, …
│   ├── public/locales/       # i18n translations (en / hi / te)
│   └── package.json
│
├── src/                  # Original Firebase app (v1)
├── assets/               # GitHub Pages build output (v1)
└── Docs/                 # PRD and notes
```

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- **Python 3.11+** (only needed for the Python backend)

---

### 1a. Backend — Node.js (recommended)

```bash
cd backend-node

npm install

# Seed demo data (creates hypermart.db)
node seed.js

# Optional: wipe and re-seed from scratch
node seed.js --reset

# Start the API server
node index.js

# Development (auto-restarts on file changes)
node --watch index.js
```

API runs at **http://localhost:8000**

#### Environment variables (`backend-node/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | HTTP port |
| `JWT_SECRET` | `hypermart-dev-secret-change-in-production` | JWT signing secret |
| `DATABASE_PATH` | `./hypermart.db` | SQLite file path |

---

### 1b. Backend — Python (alternative)

```bash
cd backend

python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

python seed.py

uvicorn main:app --reload --port 8000
```

Interactive docs available at http://localhost:8000/docs

---

### 2. Frontend

```bash
cd frontend

npm install

# Create the env file pointing at whichever backend you started
echo VITE_API_URL=http://localhost:8000 > .env

npm run dev
```

Frontend runs at **http://localhost:5174/**

---

## Demo Accounts

Created by `seed.js` / `seed.py`:

| Role | Email | Password | Phone |
|------|-------|----------|-------|
| Admin | senamallas@gmail.com | `Admin@123` | +91-9000000001 |
| Owner | anand@example.com | `Owner@123` | +91-9000000002 |
| Owner | priya@example.com | `Owner@123` | +91-9000000003 |
| Customer | ravi@example.com | `Customer@123` | +91-9000000004 |
| Customer | kavita@example.com | `Customer@123` | +91-9000000005 |

---

## Features

### Customer
- Browse approved shops filtered by location and category
- Search shops by name or category via the header search bar
- Find nearby shops by GPS coordinates (Haversine radius search)
- Add products to cart and place online orders
- View order history with full item breakdown

### Shop Owner
- Register a shop (pending admin approval)
- Active subscription required (₹10 / month) to manage shops
- Manage inventory — add, edit, and toggle products
- Walk-in / POS billing to record in-store sales
- View and advance order statuses through the fulfilment pipeline
- Shop-level analytics: today's sales, 7-day revenue chart, low-stock alerts
- Set shop open/closed status, operating schedule, and unavailable dates
- Upload shop logo and product images

### Admin
- Approve, suspend, or delete shop registrations
- View and manage all users, promote to admin role
- Manage and view all subscriptions
- Platform-wide analytics: total shops, users, orders, revenue, active subscriptions

### Multi-language UI
- Translations for **English**, **Hindi (हिंदी)**, and **Telugu (తెలుగు)**
- Language selector component with `react-i18next`

---

## Database Schema (Node.js backend)

```
users          id, uid, email, display_name, photo_url, role, phone, address, password_hash, created_at, last_login
shops          id, owner_id, name, address, category, location_name, status, logo, timings, lat, lng,
               rating, review_count, is_open, schedule (JSON), unavailable_dates (JSON), created_at
products       id, shop_id, name, price, mrp, unit, category, stock, image, status, created_at
orders         id, shop_id, shop_name, customer_id, total, status, payment_status,
               delivery_address, order_type, created_at, updated_at
order_items    id, order_id, product_id, name, price, quantity
subscriptions  id, user_id, plan_amount, status, starts_at, expires_at, created_at
```

**Shop categories:** Grocery · Dairy · Vegetables & Fruits · Meat · Bakery & Snacks · Beverages · Household · Personal Care

**Shop locations:** Green Valley · Central Market · Food Plaza · Milk Lane · Old Town

**Order status pipeline:**

```
pending → accepted → ready → out_for_delivery → delivered
        ↘ rejected          ↗
```

---

## API Reference

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | — | Register a new user |
| `POST` | `/auth/login` | — | Sign in, returns JWT |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/users/me` | Any | Get current user |
| `PATCH` | `/users/me` | Any | Update profile (name, photo, phone, address) |
| `POST` | `/users/me/change-password` | Any | Change password |
| `GET` | `/users` | Admin | List all users |
| `PATCH` | `/users/:id/role` | Admin | Change a user's role |

### Subscriptions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/subscriptions/me` | Owner/Admin | Get own subscription |
| `POST` | `/subscriptions/activate` | Owner/Admin | Activate or renew (30 days, ₹10) |
| `GET` | `/subscriptions` | Admin | List all subscriptions |

### Shops

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/shops` | — | List approved shops (query: `location`, `category`, `search`, `status`, `page`, `size`) |
| `POST` | `/shops` | Owner/Admin | Register a new shop |
| `GET` | `/shops/nearby` | — | Haversine radius search (query: `lat`, `lng`, `radius`, `category`, `search`) |
| `GET` | `/shops/:id` | — | Get single shop |
| `PATCH` | `/shops/:id` | Owner/Admin | Update shop details |
| `PATCH` | `/shops/:id/status` | Admin | Approve / suspend shop |
| `DELETE` | `/shops/:id` | Admin | Delete shop |
| `GET` | `/owners/me/shops` | Owner/Admin | List own shops |

### Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/shops/:shopId/products` | — | List products (`active_only` default true) |
| `POST` | `/shops/:shopId/products` | Owner/Admin | Add product |
| `PATCH` | `/shops/:shopId/products/:productId` | Owner/Admin | Update product |
| `DELETE` | `/shops/:shopId/products/:productId` | Owner/Admin | Delete product (blocked if active orders) |

### Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/orders` | Customer | Place an online order (deducts stock) |
| `GET` | `/orders/me` | Customer | Paginated order history |
| `GET` | `/shops/:shopId/orders` | Owner/Admin | Paginated shop orders |
| `PATCH` | `/orders/:id/status` | Owner/Admin | Advance order through the pipeline |
| `POST` | `/shops/:shopId/walkin-order` | Owner | Record a POS / walk-in sale |

### Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/analytics/platform` | Admin | Platform totals: shops, users, orders, revenue, active subscriptions |
| `GET` | `/shops/:shopId/analytics` | Owner/Admin | Today's sales, 7-day chart, walk-in breakdown, low-stock list |

### File Upload

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/upload` | Any | Upload image (JPEG / PNG / GIF / WebP, max 5 MB) — returns `{ url }` |

Uploaded files are served statically at `/uploads/<filename>`.

---

## Frontend Pages

| Page | Route | Role |
|------|-------|------|
| `Marketplace` | `/marketplace` | Customer |
| `OrderHistory` | `/orders` | Customer |
| `CustomerProfile` | `/profile` | Customer |
| `CustomerSettings` | `/settings` | Customer |
| `OwnerDashboard` | `/owner` | Owner |
| `OwnerProfile` | `/owner/profile` | Owner |
| `AdminPanel` | `/admin` | Admin |
| `AdminProfileManagement` | `/admin/profiles` | Admin |
| `UserProfileView` | `/users/:id` | Admin |

**Shared components:** `DailySalesCalendar` · `InvoiceModal` · `LanguageSelector`

---

## Development Notes

- **Node.js backend uses sql.js (WASM SQLite)** — no native binaries required; works on any platform without compilation.
- **JWT tokens expire after 30 days.** The admin email (`senamallas@gmail.com`) is always promoted to `admin` role on login.
- **Subscription gate:** owners must have an `active` subscription to create or manage shops (₹10 / month, activatable via `POST /subscriptions/activate`).
- **Stock is decremented atomically** inside a transaction when an order is placed; deletion of a product is blocked if it has active (non-delivered, non-rejected) orders.
- **Tailwind CSS v4:** uses `@import "tailwindcss"` with `@tailwindcss/vite` — no `tailwind.config.js` needed.
- **i18n:** translations live in `frontend/public/locales/{en,hi,te}/translation.json`.
- The `assets/` directory (v1 GitHub Pages build) is intentionally committed and not ignored.
