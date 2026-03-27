# HyperMart — Product Requirements Document

**Version:** 1.0  
**Date:** March 27, 2026  
**Live URL:** https://senamallas-pixel.github.io/hypermart/  
**Repo:** https://github.com/senamallas-pixel/hypermart

---

## 1. Overview

HyperMart is a hyperlocal marketplace web application that connects neighbourhood shop owners with customers in the same locality. Customers can browse approved shops by category and location, add products to a cart, and place orders. Shop owners manage their inventory, orders, and billing from a dedicated dashboard. An admin panel controls shop approvals and platform governance.

---

## 2. Goals

- Let local shop owners go digital with zero technical effort
- Let customers discover and order from nearby shops by locality
- Provide real-time order and inventory tracking
- Support AI-assisted features via Gemini API

---

## 3. User Roles

| Role | Description |
|------|-------------|
| `customer` | Browse marketplace, add to cart, place orders, view order history |
| `owner` | Register shops, manage inventory, process orders, generate bills |
| `admin` | Approve/suspend shops, manage all users and platform data |

- New users pick their role on first login (role-selection screen)
- `senamallas@gmail.com` is auto-promoted to `admin` on sign-in
- Role is stored in Firestore `users/{uid}`

---

## 4. Authentication

- **Provider:** Google Sign-In via Firebase Auth (`signInWithPopup`)
- **Session:** Managed by `onAuthStateChanged` listener
- **Profile storage:** Firestore `users` collection
- **No email/password auth** — Google only

---

## 5. Core Features

### 5.1 Marketplace (Customer View)

| Feature | Details |
|---------|---------|
| Location filter | Dropdown with 5 fixed localities: Green Valley, Central Market, Food Plaza, Milk Lane, Old Town |
| Category filter | Sticky horizontal scroll: Grocery, Dairy, Vegetables & Fruits, Meat, Bakery & Snacks, Beverages, Household, Personal Care |
| Shop search | Text search across shop name and category |
| Shop cards | Logo, name, rating, address, category badge, timings |
| Shop listing | Filtered by `status == 'approved'` and `locationName` match |
| Product browsing | Real-time Firestore snapshot, grid layout (2–6 cols) |
| Add to cart | Per-shop cart with quantity controls |
| Place order | Creates Firestore document in `orders` collection |
| My Orders | Customer order history with status tracking |

### 5.2 Cart

- Global cart state in `App.tsx` (in-memory, per session)
- Cart is scoped to one shop at a time for order placement
- Cart modal shows item breakdown, quantities, total, place order CTA
- Global cart view accessible from bottom nav

### 5.3 Owner Dashboard

| Tab | Features |
|-----|----------|
| Overview | Today's sales (₹), order count, product count, quick actions |
| Inventory | Add/edit/delete products with price, MRP, stock, unit, category, image |
| Orders | Incoming orders with status pipeline: pending → accepted → ready → out_for_delivery → delivered / rejected |
| Billing | In-store POS: search products, build bill, generate receipt |

- Owner can register multiple shops (multi-location support)
- Shop registration requires admin approval before going live
- Pending shops show a status banner

### 5.4 Admin Panel

- View all registered shops with status controls (approve / suspend)
- View all users and their roles
- Platform-level data management

### 5.5 AI Features (Gemini)

- `GoogleGenAI` integrated with `GEMINI_API_KEY` env variable
- Used for AI-assisted features within the app (product suggestions, etc.)
- **Note:** API key must be set in environment for AI features to function on deployed build

---

## 6. Data Models

### `users/{uid}`
```ts
{
  uid: string
  email: string
  role: 'admin' | 'owner' | 'customer'
  displayName: string
  photoURL?: string
  phone?: string
  createdAt: string
}
```

### `shops/{id}`
```ts
{
  ownerId: string
  name: string
  address: string
  category: string
  status: 'pending' | 'approved' | 'suspended'
  logo?: string
  timings?: string
  locationName: string
  location?: { lat: number; lng: number }
  rating?: number
  reviewCount?: number
  createdAt: string
}
```

### `products/{id}`
```ts
{
  shopId: string
  name: string
  price: number
  mrp: number
  unit: string
  category: string
  stock: number
  image?: string
  status: 'active' | 'out_of_stock'
  createdAt: string
}
```

### `orders/{id}`
```ts
{
  shopId: string
  customerId: string
  items: { productId, name, price, quantity }[]
  total: number
  status: 'pending' | 'accepted' | 'ready' | 'out_for_delivery' | 'delivered' | 'rejected'
  paymentStatus: 'pending' | 'paid'
  deliveryAddress: string
  createdAt: string
}
```

---

## 7. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5 |
| Framework | Vite 6 + Next.js-style SPA |
| Styling | Tailwind CSS 4 |
| Animation | Motion (Framer Motion) |
| Icons | Lucide React |
| Backend/DB | Firebase Firestore (real-time) |
| Auth | Firebase Auth (Google) |
| AI | Google Gemini API (`@google/genai`) |
| Server | Express.js (dev + prod SSR fallback) |
| Deployment | GitHub Pages (static, `gh-pages` branch) |

---

## 8. Navigation Structure

```
/ (App)
├── /marketplace        — Shop browsing (default for customers)
├── /role-selection     — First-time user role picker
├── /owner              — Owner dashboard (tabs: Overview, Inventory, Orders, Billing)
├── /admin              — Admin panel
├── /cart               — Cart view
└── /profile            — User profile
```

Bottom mobile nav:
- **Customer:** Shop | Cart | Profile
- **Owner:** Stats | Stock | Orders

---

## 9. Deployment

| Target | URL |
|--------|-----|
| GitHub Pages | https://senamallas-pixel.github.io/hypermart/ |
| Local dev | http://localhost:3000 |

**Deploy command:**
```bash
npm run deploy     # builds Vite → pushes dist/ to gh-pages branch
```

**GitHub Pages source:** `main` branch, `/` root (built files committed to root)

**Environment variables required:**
```
GEMINI_API_KEY=your_key_here
APP_URL=https://senamallas-pixel.github.io/hypermart/
```

---

## 10. Known Limitations & Future Work

| Item | Status |
|------|--------|
| Delivery address | Hardcoded as "Default Address" — needs user address flow |
| Payment | `paymentStatus` tracked but no payment gateway integrated |
| Cart persistence | In-memory only — lost on page refresh |
| Product images | URL-based — no file upload storage (Firebase Storage not wired) |
| Real-time ratings | Static fallback `4.5` — no review/rating submission |
| Phone/SMS | Icon shown but no WhatsApp/call integration |
| AI features | Gemini key must be set manually in production env |
| Mobile PWA | Not configured — no service worker or manifest |
