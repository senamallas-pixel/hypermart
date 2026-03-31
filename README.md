<div align="center">
<img width="1200" height="475" alt="HyperMart Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# HyperMart v2

**A neighbourhood marketplace — browse local shops, manage inventory, and place orders.**

🌐 **Live Demo (Firebase v1):** https://senamallas-pixel.github.io/hypermart/

</div>

---

## Overview

HyperMart v2 is a full-stack rebuild of the original Firebase app. It replaces the Firebase backend with a self-hosted **Python/FastAPI + SQLite** API while keeping the same UI design.

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite 6, Tailwind CSS v4, Motion, React Router v6 |
| Backend | Python 3, FastAPI, SQLAlchemy 2, SQLite, Pydantic v2 |
| Auth | Email-based (no passwords) — session stored in `localStorage` |

**Roles:** `customer` · `owner` · `admin`

---

## Project Structure

```
hypermart/
├── backend/            # FastAPI app
│   ├── main.py         # API routes
│   ├── models.py       # SQLAlchemy ORM models
│   ├── schemas.py      # Pydantic request/response schemas
│   ├── database.py     # DB engine & session
│   ├── seed.py         # Demo data seeder
│   └── requirements.txt
│
├── frontend/           # React + Vite app
│   ├── src/
│   │   ├── App.jsx         # Root shell, auth screens, nav
│   │   ├── context/        # AppContext (auth + cart + search state)
│   │   ├── api/            # Axios client wrappers
│   │   └── pages/          # Marketplace, OwnerDashboard, AdminPanel
│   └── package.json
│
├── src/                # Original Firebase app (v1)
├── assets/             # GitHub Pages build output (v1)
└── Docs/               # PRD and notes
```

---

## Getting Started

### Prerequisites

- **Python 3.11+** (3.14 supported — uses `>=` version pins)
- **Node.js 18+**

---

### 1. Backend

```bash
cd backend

# Create & activate a virtual environment (recommended)
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

# Seed demo data (creates hypermart.db)
python seed.py

# Start the API server
uvicorn main:app --reload --port 8000
```

API runs at **http://localhost:8000** — interactive docs at http://localhost:8000/docs

#### Demo accounts (created by `seed.py`)

| Role | Email | UID |
|------|-------|-----|
| Admin | senamallas@gmail.com | admin-001 |
| Owner | anand@example.com | owner-001 |
| Owner | priya@example.com | owner-002 |
| Customer | customer1@example.com | cust-001 |

---

### 2. Frontend

```bash
cd frontend

npm install

# Create the env file
echo VITE_API_URL=http://localhost:8000 > .env

npm run dev
```

Frontend runs at **http://localhost:5173/** (or next available port).

---

## Features

### Customer
- Browse approved shops by location and category
- Search shops by name or category (header search bar)
- Add products to cart and place orders
- View order history

### Shop Owner
- Register a shop (pending admin approval)
- Manage inventory (add / edit / toggle products)
- View and update order statuses
- Billing system for in-store sales

### Admin
- Approve or reject shop registrations
- View all users and orders across the platform
- Promote users to admin role

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/login` | Sign in or register a new user |
| `GET` | `/auth/me` | Get current user profile |
| `GET` | `/shops` | List approved shops (filterable by location/category) |
| `POST` | `/shops` | Register a new shop |
| `GET` | `/products` | List products for a shop |
| `POST` | `/products` | Add a product |
| `PATCH` | `/products/{id}` | Update a product |
| `POST` | `/orders` | Place an order |
| `GET` | `/orders/my` | Customer's own orders |
| `GET` | `/admin/shops` | Admin: all shops |
| `GET` | `/admin/users` | Admin: all users |

Full interactive docs: http://localhost:8000/docs

---

## Development Notes

- **Python 3.14 compatibility:** `requirements.txt` uses `>=` version pins (not `==`) to avoid wheel compilation issues with newer Python versions.
- **Tailwind CSS v4:** Uses `@import "tailwindcss"` with `@tailwindcss/vite` — no `tailwind.config.js` needed.
- **Location filtering:** Changing the location in the top nav header automatically re-fetches shops from the API.
- The `assets/` directory (v1 GitHub Pages build) is intentionally committed and not ignored.
