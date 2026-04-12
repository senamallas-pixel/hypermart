# HyperMart 🛒

A multi-vendor hyperlocal grocery marketplace connecting neighbourhood shops with local customers. Web + Android with AI-powered shopping assistant.

[![Frontend](https://img.shields.io/badge/Frontend-Live-brightgreen)](https://frontend-phi-five-15.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Live-blue)](https://hypermart-ukg0.onrender.com)
[![API Docs](https://img.shields.io/badge/API-Swagger-orange)](https://hypermart-ukg0.onrender.com/docs)
[![Android CI](https://github.com/senamallas-pixel/hypermart/actions/workflows/android-ci.yml/badge.svg)](https://github.com/senamallas-pixel/hypermart/actions/workflows/android-ci.yml)

---

## Deployed Applications

| Service | URL | Status |
|---------|-----|--------|
| **Frontend (Web)** | [frontend-phi-five-15.vercel.app](https://frontend-phi-five-15.vercel.app) | Live on Vercel |
| **Backend (API)** | [hypermart-ukg0.onrender.com](https://hypermart-ukg0.onrender.com) | Live on Render |
| **API Documentation** | [hypermart-ukg0.onrender.com/docs](https://hypermart-ukg0.onrender.com/docs) | Swagger UI |
| **Android App** | EAS Build (Internal Distribution) | Available |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Docs/PRD.md](Docs/PRD.md) | Product requirements v4.0 — features, architecture, acceptance criteria |
| [Docs/Imp.md](Docs/Imp.md) | Implementation reference — API, schema, order pipeline |
| [CLAUDE.md](CLAUDE.md) | Development workflow guide |

---

## Tech Stack

### Frontend (Web)
- React 18 + Vite 6 + Tailwind CSS 4
- React-Leaflet (maps), Framer Motion (animations), Lucide React (icons)
- GlobalSearch component, Razorpay JS SDK, i18n (EN/HI/TE)

### Frontend (Android)
- Expo SDK 54 + React Native 0.81.5
- React Navigation 7 (bottom tabs + native stack)
- Ionicons, expo-image-picker, expo-location, expo-secure-store
- react-native-webview (Razorpay checkout)

### Backend (Python)
- FastAPI 0.115 + SQLAlchemy 2 + SQLite/PostgreSQL
- JWT auth (python-jose), Cloudinary (images)
- OpenAI GPT-4o-mini with function calling (10 real-time DB tools)

### Backend (Node.js — drop-in alternative)
- Express 4 + sql.js (WASM SQLite)

---

## Key Features

### Customers
- Global product search across all shops (real-time API)
- Location-based shop discovery with map view
- Cart with product + order discount calculations
- Razorpay / UPI / Cash on Delivery payments
- Order tracking with status pipeline + invoice/receipt
- Order cancellation, shop reviews
- AI chat assistant with real-time product lookup

### Shop Owners
- Digital storefront with logo upload
- Inventory management with AI product suggestions + descriptions
- Walk-in POS billing with product search, quantity stepper, UPI QR
- Quick-add products directly from billing search
- AI-powered low-stock restock advice (real inventory data)
- AI sales forecast (real revenue/order data)
- Order management through full status pipeline
- Discount management (product + order level)
- Supplier management

### Admins
- Shop approval workflow
- User management with role assignments
- Platform-wide analytics
- AI assistant with platform stats tools

### AI (OpenAI GPT-4o-mini with Function Calling)

10 tools that query the database in real-time:

| Tool | What it does |
|------|-------------|
| `search_products` | Search by name/category/keyword across all shops |
| `get_popular_products` | Best sellers by actual sales volume |
| `get_all_products` | Browse products with category filter |
| `get_shop_products` | Full inventory for a specific shop |
| `get_shop_info` | Shop details, rating, location, status |
| `list_shops` | Available shops with filters |
| `get_sales_summary` | Revenue, orders, top products (N days) |
| `get_low_stock_items` | Products below stock threshold |
| `get_order_status` | Order details, items, payment info |
| `get_platform_stats` | Total shops, users, orders, revenue |

Role-based quick prompts: customers see product/shop suggestions, owners see sales/inventory prompts, admins see platform stats prompts.

---

## Local Development

### Prerequisites
- Node.js 20+
- Python 3.12+

### Frontend (Web)
```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev          # http://localhost:5173
```

### Backend (Python)
```bash
cd backend
pip install -r requirements.txt
python seed.py --reset                    # Seed demo data
python -m uvicorn main:app --reload       # http://localhost:8000
```

### Backend (Node.js)
```bash
cd backend-node
npm install
npm run seed:reset
npm run dev          # http://localhost:8000
```

### Android
```bash
cd frontend_android
npm install
npx expo start --android
```

---

## Demo Credentials

After seeding:

| Role | Email | Password |
|------|-------|----------|
| Customer | ravi@example.com | Customer@123 |
| Shop Owner | anand@example.com | Owner@123 |
| Admin | senamallas@gmail.com | Admin@123 |

---

## CI/CD

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `android-ci.yml` | Push/PR touching `frontend_android/` | Install, run 108 unit tests, validate Expo config |
| `android-release.yml` | Tag `v*` / manual | EAS cloud build, APK artifact, GitHub Release |
| `deploy-frontend.yml` | Push to main touching `frontend/` | Vercel production deploy |
| `deploy-backend.yml` | Push to main touching `backend/` | Render deploy hook |

---

## Environment Variables

### Backend
```bash
JWT_SECRET=your-secret-key
OPENAI_API_KEY=your-openai-key       # AI features (optional)
OPENAI_MODEL=gpt-4o-mini             # Default model
RAZORPAY_KEY_ID=rzp_test_...         # Payment (optional)
RAZORPAY_KEY_SECRET=...
DATABASE_URL=sqlite:///./hypermart.db # Or PostgreSQL URL
CLOUDINARY_CLOUD_NAME=...            # Image uploads
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Frontend (Web)
```bash
VITE_API_URL=http://localhost:8000
VITE_RAZORPAY_KEY_ID=rzp_test_...
```

---

## Testing

```bash
# Android unit tests (108 tests)
cd frontend_android && npm test

# Backend API (Swagger)
open http://localhost:8000/docs
```

---

## Internationalization

Three languages: English (`en`), Hindi (`hi`), Telugu (`te`)
Translation files: `frontend/public/locales/{lang}/translation.json`
LanguageSelector component in app header (both web and Android)

---

## Project Structure

```
hypermart/
  frontend/              React 18 + Vite 6 SPA
    src/
      api/client.js      Axios client with JWT interceptor
      components/        GlobalSearch, AIChatWidget, InvoiceModal, etc.
      context/           AppContext (auth, cart, i18n, search)
      pages/             Marketplace, OwnerDashboard, AdminPanel, etc.
  frontend_android/      Expo SDK 54 React Native app
    src/
      api/client.js      Axios client (mirrors web)
      components/        AIChatWidget, InvoiceModal, StatCard, etc.
      screens/           customer/, owner/, admin/, auth/
      navigation/        CustomerTabs, OwnerTabs, AdminTabs
    __tests__/           Unit tests (utils, api, cartReducer)
  backend/               Python FastAPI
    main.py              All routes (~1800 lines)
    ai.py                AI router with OpenAI function calling
    models.py            SQLAlchemy ORM models
    schemas.py           Pydantic v2 schemas
    database.py          SQLite engine + migrations
    seed.py              Demo data seeder
  backend-node/          Express drop-in alternative
  Docs/                  PRD.md, Imp.md
  .github/workflows/     CI/CD pipelines
```

---

## Contributors

- **Lead Developer:** @peddapetavenkatesh
- **GitHub:** [@senamallas-pixel](https://github.com/senamallas-pixel)

---

**Version:** 4.0 | **Last Updated:** April 12, 2026
