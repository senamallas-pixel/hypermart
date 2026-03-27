# HyperMart — End-to-End Product Requirements Document

**Version:** 2.0  
**Date:** March 27, 2026  
**Status:** Development-Ready  
**Live URL:** https://senamallas-pixel.github.io/hypermart/  
**Repository:** https://github.com/senamallas-pixel/hypermart

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Authentication & Session Management](#4-authentication--session-management)
5. [System Architecture](#5-system-architecture)
6. [Feature Specifications](#6-feature-specifications)
7. [Data Models & Firestore Schema](#7-data-models--firestore-schema)
8. [Firestore Security Rules](#8-firestore-security-rules)
9. [Navigation & Routing](#9-navigation--routing)
10. [UI/UX Specifications](#10-uiux-specifications)
11. [State Management](#11-state-management)
12. [Tech Stack & Dependencies](#12-tech-stack--dependencies)
13. [Environment & Configuration](#13-environment--configuration)
14. [Deployment & CI/CD](#14-deployment--cicd)
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
| **Shop Owner** | Digital storefront, inventory control, and order management with no setup friction |
| **Admin** | Full platform governance — shop approvals, user management, platform-wide oversight |

---

## 2. Goals & Success Metrics

### Product Goals

- Enable local shop owners to go digital with zero technical effort
- Let customers discover and order from nearby shops filtered by locality
- Provide real-time order and inventory tracking via Firestore live listeners
- Offer AI-assisted product suggestions and shop insights via Gemini API

### Key Metrics (Target at Launch)

| Metric | Target |
|--------|--------|
| Shop onboarding time | < 5 minutes from registration to pending approval |
| Order placement steps | <= 3 taps from shop page to order confirmation |
| Admin approval turnaround | < 24 hours (process SLA, not technical) |
| Page load (LCP) | < 2.5 seconds on 4G |
| Firebase reads per customer session | < 500 reads |

---

## 3. User Roles & Permissions

### Role Matrix

| Action | `customer` | `owner` | `admin` |
|--------|:---------:|:-------:|:-------:|
| Browse approved shops | YES | YES | YES |
| Add to cart & place orders | YES | NO | NO |
| View own order history | YES | NO | NO |
| Register a shop | NO | YES | NO |
| Manage own shop inventory | NO | YES | YES |
| Manage own shop orders | NO | YES | YES |
| Generate bills (POS) | NO | YES | YES |
| Approve / suspend shops | NO | NO | YES |
| Manage all users & roles | NO | NO | YES |
| View platform-wide analytics | NO | NO | YES |

### Role Assignment Flow

```
User signs in with Google
         |
         v
  Firestore users/{uid} exists?
    |-- NO  --> /role-selection
    |           User picks: customer | owner
    |           Write role to Firestore
    |           Redirect to role home
    |
    +-- YES --> Read role from Firestore
                Check admin override (senamallas@gmail.com -> force admin)
                Redirect to role home
```

### Admin Override Rule

```typescript
// Applied inside onAuthStateChanged after profile fetch
if (user.email === 'senamallas@gmail.com') {
  await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
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

- **Google Sign-In only** via Firebase Auth (`signInWithPopup` + `GoogleAuthProvider`)
- No email/password, phone, or other OAuth providers

### Auth Flow Implementation

```typescript
// 1. Sign-in trigger
const provider = new GoogleAuthProvider();
await signInWithPopup(getAuth(), provider);

// 2. Global session listener — mount once in App.tsx
onAuthStateChanged(auth, async (firebaseUser) => {
  if (!firebaseUser) {
    navigate('/');        // Sign-in page
    return;
  }

  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    navigate('/role-selection');   // First-time user
    return;
  }

  let { role } = snap.data();

  // Admin override
  if (firebaseUser.email === 'senamallas@gmail.com' && role !== 'admin') {
    await updateDoc(ref, { role: 'admin' });
    role = 'admin';
  }

  setCurrentUser({ ...firebaseUser, role });
  navigate(roleHomeMap[role]);
});
```

### First-Time User Profile Document

```typescript
// Written to users/{uid} on role-selection submit
{
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  displayName: firebaseUser.displayName,
  photoURL: firebaseUser.photoURL ?? null,
  role: selectedRole,              // 'customer' | 'owner'
  phone: null,
  createdAt: serverTimestamp(),
  lastLoginAt: serverTimestamp()
}
```

### Protected Route Rules

| Route | Auth Required | Allowed Roles |
|-------|:------------:|--------------|
| `/` | No | — (sign-in page) |
| `/role-selection` | Yes | New users only |
| `/marketplace` | Yes | `customer`, `admin` |
| `/owner` | Yes | `owner`, `admin` |
| `/admin` | Yes | `admin` |
| `/cart` | Yes | `customer` |
| `/profile` | Yes | All roles |

---

## 5. System Architecture

```
+-----------------------------------------------------+
|                    CLIENT (Browser)                  |
|                                                      |
|   React 19 + TypeScript 5   (Vite 6 SPA)            |
|   +------------+  +----------+  +----------------+  |
|   |  Customer  |  |  Owner   |  |  Admin Panel   |  |
|   |    View    |  | Dashboard|  |                |  |
|   +------+-----+  +----+-----+  +------+---------+  |
|          +-------------+----------------+           |
|                        |                            |
|         +--------------v--------------+             |
|         |   Global App State          |             |
|         |  (Auth + Cart + Role)       |             |
|         +--------------+--------------+             |
+------------------------+----------------------------+
                         |
          +--------------+--------------+
          |              |              |
    +-----v----+   +-----v----+   +----v--------+
    | Firebase |   | Firebase |   | Gemini API  |
    |   Auth   |   |Firestore |   |  (Google)   |
    +----------+   +----------+   +-------------+
```

### Data Flow

1. **Auth** — `onAuthStateChanged` feeds into global `AuthContext`
2. **Reads** — `onSnapshot` listeners for real-time collections (shops, products, orders)
3. **Writes** — `setDoc` / `addDoc` / `updateDoc` for mutations
4. **AI** — `GoogleGenAI` client calls Gemini API with `VITE_GEMINI_API_KEY`

---

## 6. Feature Specifications

---

### 6.1 Sign-In Page (`/`)

**Purpose:** Entry point for all users.

| Element | Detail |
|---------|--------|
| Logo + tagline | HyperMart branding |
| "Sign in with Google" button | Triggers `signInWithPopup` |
| Loading state | Spinner while auth resolves |
| Error state | Toast if sign-in fails |

**Behaviour:**
- If already signed in, redirect immediately to role home (skip sign-in page)
- On success, check Firestore profile and route accordingly

---

### 6.2 Role Selection (`/role-selection`)

**Purpose:** One-time screen for first-time users.

| Element | Detail |
|---------|--------|
| Role cards | Two cards: "I'm a Customer" and "I'm a Shop Owner" |
| Selection | Single-select, highlighted on pick |
| CTA | "Continue" — disabled until role selected |
| Submit | Writes profile to Firestore, then redirects |

**Validation:**
- User cannot access any other route until role is set
- Back navigation from this screen should sign the user out

---

### 6.3 Marketplace (`/marketplace`) — Customer View

#### 6.3.1 Location Filter

| Property | Value |
|----------|-------|
| Type | Dropdown / chip selector |
| Options | Green Valley, Central Market, Food Plaza, Milk Lane, Old Town |
| Default | First option or last selected (persist in `localStorage`) |
| Behaviour | Filters Firestore query by `locationName` field |

#### 6.3.2 Category Filter

| Property | Value |
|----------|-------|
| Type | Horizontally scrollable chip bar (sticky on scroll) |
| Categories | Grocery, Dairy, Vegetables & Fruits, Meat, Bakery & Snacks, Beverages, Household, Personal Care |
| Default | "All" (no category filter) |
| Behaviour | Client-side filter over loaded shop list |

#### 6.3.3 Shop Search

| Property | Value |
|----------|-------|
| Type | Text input |
| Scope | Client-side filter over loaded shop list |
| Fields searched | `name`, `category` |
| Debounce | 300ms |

#### 6.3.4 Shop Card

Each card must display:
- Shop logo (fallback: placeholder icon)
- Shop name
- Rating (static `4.5` until review system is live)
- Address
- Category badge
- Opening timings
- "View Shop" CTA

#### 6.3.5 Shop Listing Query

```typescript
const q = query(
  collection(db, 'shops'),
  where('status', '==', 'approved'),
  where('locationName', '==', selectedLocation)
);
onSnapshot(q, (snap) => { /* update state */ });
```

#### 6.3.6 Shop Detail / Product Browsing

When a customer taps a shop card, navigate to `/marketplace/:shopId`.

```typescript
const q = query(
  collection(db, 'products'),
  where('shopId', '==', shopId),
  where('status', '==', 'active')
);
onSnapshot(q, (snap) => { /* update state */ });
```

- Display products in a **responsive grid** (2 cols mobile to 6 cols desktop)
- Each product card: image, name, price, MRP (strikethrough if MRP > price), unit, "Add" button
- Quantity controls (minus/plus) appear after first "Add"

#### 6.3.7 My Orders (Customer)

Route: `/marketplace/orders` or as a tab in profile.

| Column | Value |
|--------|-------|
| Order ID | Truncated Firestore doc ID |
| Shop name | Denormalized at order creation |
| Items summary | "3 items · ₹240" |
| Status badge | Colour-coded pipeline status |
| Date | `createdAt` formatted |

Query:
```typescript
query(
  collection(db, 'orders'),
  where('customerId', '==', uid),
  orderBy('createdAt', 'desc')
)
```

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

1. **Single-shop constraint** — cart can only hold items from one shop at a time. Adding from a different shop shows a confirmation modal: "Your cart has items from [Shop A]. Clear cart and add from [Shop B]?"
2. Minimum quantity is 1. Removing the last unit removes the item entirely.
3. Cart total = sum of (item.price × item.quantity)

#### Cart Modal / View

| Element | Detail |
|---------|--------|
| Item list | Name, quantity controls, line total |
| Subtotal | Running total |
| "Place Order" CTA | Active only if cart has 1 or more items |
| Empty state | Illustration + "Browse Shops" link |

#### Place Order Flow

```typescript
const orderDoc = {
  shopId: cart.shopId,
  shopName: cart.shopName,        // denormalized
  customerId: currentUser.uid,
  items: cart.items.map(i => ({
    productId: i.productId,
    name: i.name,
    price: i.price,
    quantity: i.quantity
  })),
  total: cartTotal,
  status: 'pending',
  paymentStatus: 'pending',
  deliveryAddress: 'Default Address',   // TODO: user address flow
  createdAt: serverTimestamp()
};

await addDoc(collection(db, 'orders'), orderDoc);
clearCart();
showSuccessToast('Order placed successfully!');
```

---

### 6.5 Owner Dashboard (`/owner`)

The dashboard is tab-based. Owner may manage multiple shops; a shop selector sits at the top.

#### 6.5.1 Shop Registration

Triggered via "Register New Shop" CTA.

| Field | Type | Validation |
|-------|------|-----------|
| Shop Name | Text | Required, min 3 chars |
| Category | Select | One of the 8 categories |
| Location | Select | One of the 5 localities |
| Address | Textarea | Required |
| Timings | Text | e.g. "9 AM – 9 PM" |
| Logo URL | Text | Optional, valid URL |

On submit:
```typescript
await addDoc(collection(db, 'shops'), {
  ownerId: currentUser.uid,
  name, category, locationName, address, timings,
  logo: logo || null,
  status: 'pending',
  rating: 4.5,
  reviewCount: 0,
  createdAt: serverTimestamp()
});
```

**Pending state UX:** Show a banner "Your shop is pending admin approval" until `status === 'approved'`.

#### 6.5.2 Overview Tab

| Widget | Data Source |
|--------|------------|
| Today's Sales (₹) | Sum of `orders.total` where `shopId == activeShop` and `createdAt >= today 00:00` |
| Order Count Today | Count of above orders |
| Total Products | Count of `products` where `shopId == activeShop` |
| Quick Actions | Register Shop, Add Product, View Orders buttons |

#### 6.5.3 Inventory Tab

**Product List columns:** Image, Name, Category, Price, MRP, Stock, Unit, Status, Actions.

**Add / Edit Product Modal:**

| Field | Type | Validation |
|-------|------|-----------|
| Name | Text | Required |
| Category | Select | One of the 8 categories |
| Price (₹) | Number | Required, > 0 |
| MRP (₹) | Number | Required, >= Price |
| Stock | Number | Required, >= 0 |
| Unit | Text | e.g. "kg", "pcs", "500ml" |
| Image URL | Text | Optional, valid URL |
| Status | Toggle | active / out_of_stock |

**Delete:** Show confirmation modal before Firestore delete. Block if product has active orders.

#### 6.5.4 Orders Tab

**Order Pipeline:**

```
pending --> accepted --> ready --> out_for_delivery --> delivered
                                                   +--> rejected (from pending or accepted only)
```

| Status | Owner Action | Badge Colour |
|--------|-------------|-------------|
| `pending` | Accept / Reject | Yellow |
| `accepted` | Mark Ready | Blue |
| `ready` | Mark Out for Delivery | Indigo |
| `out_for_delivery` | Mark Delivered | Purple |
| `delivered` | — (terminal) | Green |
| `rejected` | — (terminal) | Red |

Status update:
```typescript
await updateDoc(doc(db, 'orders', orderId), {
  status: nextStatus,
  updatedAt: serverTimestamp()
});
```

#### 6.5.5 Billing Tab (In-Store POS)

**Flow:**
1. Search products by name (client-side filter from loaded product list)
2. Add products to bill using the same quantity control UX as the customer cart
3. View bill breakdown: items, quantities, subtotals, grand total
4. "Generate Receipt" triggers print or clipboard copy

**Receipt Format:**
```
-------------------------------------------
             [Shop Name]
             [Address]
-------------------------------------------
Item                     Qty      Total
Milk (1L)                  2       ₹80
Bread (400g)               1       ₹35
-------------------------------------------
                    Grand Total:   ₹115
-------------------------------------------
Date: 27 Mar 2026          Time: 14:32
```

Receipt actions: `window.print()` or copy to clipboard.

---

### 6.6 Admin Panel (`/admin`)

#### 6.6.1 Shops Management

**Table Columns:** Shop Name, Owner ID, Category, Location, Status, Created At, Actions.

**Status Controls:**

| Current Status | Available Actions |
|---------------|------------------|
| `pending` | Approve, Reject |
| `approved` | Suspend |
| `suspended` | Approve |

```typescript
await updateDoc(doc(db, 'shops', shopId), { status: newStatus });
```

**Filters:** By status (All / Pending / Approved / Suspended), by location.

#### 6.6.2 Users Management

**Table Columns:** Display Name, Email, Role, Created At, Actions.

**Actions:** Change role via dropdown (customer / owner / admin). View orders for customers, view shops for owners.

#### 6.6.3 Platform Analytics

| Metric | Query |
|--------|-------|
| Total shops | Count of `shops` collection |
| Approved shops | Count where `status == 'approved'` |
| Total users | Count of `users` collection |
| Total orders | Count of `orders` collection |
| Delivered revenue | Sum of `orders.total` where `status == 'delivered'` |

---

### 6.7 Profile (`/profile`)

| Section | Content |
|---------|---------|
| Avatar | `photoURL` from Google |
| Name & Email | From Firebase Auth profile |
| Role badge | Current role display |
| Phone | Editable field — writes to `users/{uid}.phone` |
| Sign Out | `signOut(auth)` then redirect to `/` |

---

### 6.8 AI Features (Gemini)

| Feature | Trigger | Behaviour |
|---------|---------|-----------|
| Product name suggestions | Owner types partial name in inventory form | Show 5 suggested product names for the selected category |
| Description generator | Owner clicks "Generate Description" button | Write a 1-sentence product description for [name] in [category] |
| Low-stock alert insight | Overview tab load | Analyse stock levels and list items likely to run out |

**Client Setup:**

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const result = await ai.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: prompt
});
```

**Graceful degradation:** If `VITE_GEMINI_API_KEY` is not set or the API call fails, hide all AI UI elements. No broken states or console errors.

---

## 7. Data Models & Firestore Schema

### Collection: `users`

```typescript
interface UserDoc {
  uid: string;                          // Firebase Auth UID (also the doc ID)
  email: string;
  displayName: string;
  photoURL: string | null;
  role: 'admin' | 'owner' | 'customer';
  phone: string | null;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}
```

### Collection: `shops`

```typescript
interface ShopDoc {
  ownerId: string;                      // ref: users/{uid}
  name: string;
  address: string;
  category: ShopCategory;
  locationName: ShopLocation;
  status: 'pending' | 'approved' | 'suspended';
  logo: string | null;                  // URL
  timings: string | null;               // e.g. "9 AM – 9 PM"
  location: { lat: number; lng: number } | null;
  rating: number;                       // default 4.5
  reviewCount: number;                  // default 0
  createdAt: Timestamp;
}

type ShopCategory =
  | 'Grocery' | 'Dairy' | 'Vegetables & Fruits'
  | 'Meat' | 'Bakery & Snacks' | 'Beverages'
  | 'Household' | 'Personal Care';

type ShopLocation =
  | 'Green Valley' | 'Central Market'
  | 'Food Plaza' | 'Milk Lane' | 'Old Town';
```

### Collection: `products`

```typescript
interface ProductDoc {
  shopId: string;                       // ref: shops/{id}
  name: string;
  price: number;                        // selling price in INR
  mrp: number;                          // max retail price; mrp >= price
  unit: string;                         // e.g. "kg", "500ml", "pcs"
  category: ShopCategory;
  stock: number;                        // units in stock
  image: string | null;                 // URL
  status: 'active' | 'out_of_stock';
  createdAt: Timestamp;
}
```

### Collection: `orders`

```typescript
interface OrderDoc {
  shopId: string;                       // ref: shops/{id}
  shopName: string;                     // denormalized
  customerId: string;                   // ref: users/{uid}
  items: OrderItem[];
  total: number;                        // INR
  status: OrderStatus;
  paymentStatus: 'pending' | 'paid';
  deliveryAddress: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

interface OrderItem {
  productId: string;
  name: string;                         // denormalized snapshot
  price: number;                        // price at time of order
  quantity: number;
}

type OrderStatus =
  | 'pending' | 'accepted' | 'ready'
  | 'out_for_delivery' | 'delivered' | 'rejected';
```

### Required Firestore Composite Indexes

| Collection | Fields Indexed | Purpose |
|-----------|---------------|---------|
| `shops` | `status` ASC, `locationName` ASC | Marketplace listing query |
| `products` | `shopId` ASC, `status` ASC | Product browsing query |
| `orders` | `customerId` ASC, `createdAt` DESC | Customer order history |
| `orders` | `shopId` ASC, `createdAt` DESC | Owner order list |

---

## 8. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function getRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function isAdmin() {
      return isSignedIn() && getRole() == 'admin';
    }

    function isOwner() {
      return isSignedIn() && getRole() == 'owner';
    }

    function isCustomer() {
      return isSignedIn() && getRole() == 'customer';
    }

    // Users
    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isAdmin());
      allow create: if request.auth.uid == uid;
      allow update: if request.auth.uid == uid || isAdmin();
      allow delete: if isAdmin();
    }

    // Shops
    match /shops/{shopId} {
      allow read: if isSignedIn();
      allow create: if isOwner();
      allow update: if isAdmin() ||
        (isOwner() && resource.data.ownerId == request.auth.uid);
      allow delete: if isAdmin();
    }

    // Products
    match /products/{productId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isAdmin() ||
        (isOwner() &&
          get(/databases/$(database)/documents/shops/$(resource.data.shopId))
            .data.ownerId == request.auth.uid);
    }

    // Orders
    match /orders/{orderId} {
      allow read: if isSignedIn() && (
        resource.data.customerId == request.auth.uid ||
        get(/databases/$(database)/documents/shops/$(resource.data.shopId))
          .data.ownerId == request.auth.uid ||
        isAdmin()
      );
      allow create: if isCustomer();
      allow update: if isAdmin() ||
        (isOwner() &&
          get(/databases/$(database)/documents/shops/$(resource.data.shopId))
            .data.ownerId == request.auth.uid);
      allow delete: if isAdmin();
    }
  }
}
```

---

## 9. Navigation & Routing

### Route Map

```
/ (App Root)
|
+-- /                      --> SignIn page (public)
+-- /role-selection        --> Role picker (auth required, no role yet)
|
+-- /marketplace           --> Shop listing (customer)
|   +-- /:shopId           --> Shop detail + product grid
|   +-- /orders            --> Customer order history
|
+-- /owner                 --> Owner dashboard
|   +-- ?tab=overview      --> Overview tab (default)
|   +-- ?tab=inventory     --> Inventory management
|   +-- ?tab=orders        --> Order pipeline
|   +-- ?tab=billing       --> POS / billing
|
+-- /admin                 --> Admin panel
|   +-- ?tab=shops         --> Shop approvals (default)
|   +-- ?tab=users         --> User management
|   +-- ?tab=analytics     --> Platform analytics
|
+-- /cart                  --> Cart full-page view (customer)
+-- /profile               --> User profile (all roles)
```

### Bottom Navigation Bar

**Customer:**

| Icon | Label | Route | Badge |
|------|-------|-------|-------|
| Store | Shop | `/marketplace` | — |
| ShoppingCart | Cart | `/cart` | Item count |
| User | Profile | `/profile` | — |

**Owner:**

| Icon | Label | Route |
|------|-------|-------|
| BarChart2 | Stats | `/owner?tab=overview` |
| Package | Stock | `/owner?tab=inventory` |
| ClipboardList | Orders | `/owner?tab=orders` |

**Admin:** Top navigation bar only (no bottom nav).

---

## 10. UI/UX Specifications

### Design Tokens

| Token | Value |
|-------|-------|
| Primary | `#6366F1` Indigo 500 |
| Success | `#22C55E` Green 500 |
| Warning | `#F59E0B` Amber 500 |
| Danger | `#EF4444` Red 500 |
| Background | `#F9FAFB` Gray 50 |
| Surface | `#FFFFFF` |
| Border | `#E5E7EB` Gray 200 |
| Font | Inter, System UI fallback |
| Radius (cards) | `0.75rem` |
| Radius (inputs) | `0.375rem` |

### Responsive Grid (Product Listing)

| Breakpoint | Min Width | Columns |
|-----------|----------|---------|
| Default | 0px | 2 |
| `sm` | 640px | 3 |
| `md` | 768px | 4 |
| `lg` | 1024px | 5 |
| `xl` | 1280px | 6 |

### Component Behaviour Standards

| Component | Behaviour |
|-----------|-----------|
| Skeleton loaders | Show on all async loads; minimum 300ms display |
| Toast notifications | Top-right, auto-dismiss at 3s, max 3 stacked |
| Modals | Focus trap, close on Escape key and backdrop click |
| Empty states | Illustration + contextual CTA |
| Error states | Inline message + retry button |
| Loading buttons | Spinner replaces icon; button disabled during request |

### Animations (Framer Motion)

| Trigger | Animation |
|---------|-----------|
| Page transition | Fade + slide, 150ms ease-out |
| Cart item add | Scale bounce |
| Modal open/close | Scale + opacity |
| Status badge change | Colour crossfade |
| Skeleton to content | Fade in |

---

## 11. State Management

### Global State Shape

```typescript
interface AppState {
  // Auth
  currentUser: FirebaseUser | null;
  userProfile: UserDoc | null;
  authLoading: boolean;

  // Cart
  cart: CartState;
  addToCart: (shopId: string, shopName: string, item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  clearCart: () => void;
  cartItemCount: number;
  cartTotal: number;
}
```

### Local State by Component

| Component | Key Local State |
|-----------|----------------|
| `Marketplace` | `shops[]`, `selectedLocation`, `selectedCategory`, `searchQuery` |
| `ShopDetail` | `products[]`, `loading` |
| `OwnerDashboard` | `activeShopId`, `activeTab`, `orders[]`, `products[]` |
| `AdminPanel` | `allShops[]`, `allUsers[]`, `activeTab` |
| `BillingTab` | `billItems[]`, `productSearch` |
| `CartModal` | `isOpen` (lifted to parent) |

### Firestore Listener Rules

- Attach `onSnapshot` in `useEffect`; return the unsubscribe function for cleanup
- Never attach more than one listener per collection per mounted component
- Re-query when key dependencies change (e.g., `activeShopId`, `selectedLocation`)

---

## 12. Tech Stack & Dependencies

### Core

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19 |
| Language | TypeScript | 5 |
| Build Tool | Vite | 6 |
| Styling | Tailwind CSS | 4 |
| Animation | Framer Motion | Latest |
| Icons | Lucide React | Latest |

### Backend / Services

| Service | Package | Purpose |
|---------|---------|---------|
| Firebase Auth | `firebase/auth` | Google Sign-In, session |
| Cloud Firestore | `firebase/firestore` | Real-time database |
| Google Gemini | `@google/genai` | AI features |

### Dev Tooling

| Tool | Purpose |
|------|---------|
| ESLint | Linting |
| Prettier | Code formatting |
| Express.js | Dev server + SSR fallback |
| `gh-pages` | GitHub Pages deployment |

### Key `package.json` Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .ts,.tsx",
    "deploy": "npm run build && gh-pages -d dist"
  }
}
```

---

## 13. Environment & Configuration

### `.env` File

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GEMINI_API_KEY=
VITE_APP_URL=https://senamallas-pixel.github.io/hypermart/
```

All client-side variables must be prefixed with `VITE_` for Vite to expose them to the browser bundle.

### Firebase Initialization

```typescript
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
```

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/hypermart/',      // Required for GitHub Pages sub-path deployment
  server: { port: 3000 }
});
```

---

## 14. Deployment & CI/CD

### Environments

| Environment | URL | Source |
|------------|-----|--------|
| Production | https://senamallas-pixel.github.io/hypermart/ | `gh-pages` branch |
| Local Dev | http://localhost:3000 | `main` branch, Vite dev server |

### Manual Deploy

```bash
# 1. Fill in .env
# 2. Install dependencies
npm install

# 3. Build + push to gh-pages
npm run deploy
```

### GitHub Pages SPA Routing Fix

GitHub Pages returns `404.html` for deep links. Use hash-based routing in the router:

```typescript
// src/router.tsx
import { createHashRouter } from 'react-router-dom';

export const router = createHashRouter([
  { path: '/', element: <SignIn /> },
  { path: '/marketplace', element: <Marketplace /> },
  // ...
]);
```

### Recommended GitHub Actions CI

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_GEMINI_API_KEY: ${{ secrets.VITE_GEMINI_API_KEY }}
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## 15. Error Handling & Edge Cases

### Auth Errors

| Scenario | Handling |
|----------|---------|
| Sign-in popup blocked | Toast: "Enable popups in your browser and try again" |
| Network offline during auth | Toast: "No internet connection. Please try again." |
| User closes popup | Silently reset loading state, no error shown |
| Auth token expired mid-session | `onAuthStateChanged` fires null, redirect to sign-in |

### Firestore Errors

| Scenario | Handling |
|----------|---------|
| Permission denied | Toast: "You don't have access to this resource" |
| Document not found | Redirect to parent view with a not-found message |
| Write fails on order placement | Show error toast, keep cart intact for retry |
| Network error on mutation | Retry once automatically; then show error toast |

### Cart Edge Cases

| Scenario | Handling |
|----------|---------|
| Add item from different shop | Confirmation modal before clearing cart |
| Product stock changes to 0 mid-cart | Warn on order placement, block if stock === 0 |
| Order write fails | Error toast; cart preserved for retry |

### Owner Edge Cases

| Scenario | Handling |
|----------|---------|
| Shop still pending | Banner on dashboard; shop not shown in marketplace |
| Delete product with active orders | Block delete with message "Product has active orders" |
| All products out of stock | Warning card on Overview tab |
| No shops registered yet | Prompt card: "Register your first shop" |

---

## 16. Known Limitations & Backlog

| # | Item | Current State | Priority |
|---|------|--------------|---------|
| 1 | Delivery address | Hardcoded `"Default Address"` | High |
| 2 | Payment gateway | `paymentStatus` tracked; no gateway | High |
| 3 | Cart persistence | In-memory only; lost on refresh | Medium |
| 4 | Product image upload | URL-only; Firebase Storage not wired | Medium |
| 5 | Review & rating system | Static `4.5` fallback; no submissions | Medium |
| 6 | WhatsApp / call integration | Icon displayed; no action | Low |
| 7 | Mobile PWA | No service worker or web manifest | Low |
| 8 | Push notifications | Not implemented | Low |
| 9 | Real-time GPS tracking | No delivery tracking map | Low |
| 10 | Multi-language support | English only | Low |

### Suggested v2 Roadmap

- **Address book** — customer saves multiple delivery addresses with map pin
- **Razorpay / Stripe** — payment gateway with UPI, card, and wallet support
- **Firebase Storage** — product image file uploads with compression
- **Review & rating system** — post-delivery rating flow for customers
- **PWA + Push notifications** — installable app with order status alerts
- **Delivery partner role** — fourth user role with live GPS order tracking

---

## 17. Acceptance Criteria Checklist

### Authentication

- [ ] Google Sign-In works on Chrome, Safari, Firefox (desktop + mobile)
- [ ] First-time users always land on `/role-selection` and cannot bypass it
- [ ] `senamallas@gmail.com` is always assigned `admin` role on every sign-in
- [ ] Signed-out users cannot access any protected route
- [ ] Sign-out clears session and redirects to `/`

### Marketplace

- [ ] Location dropdown filters shops by `locationName` via Firestore query
- [ ] Category chip bar filters shops client-side by `category`
- [ ] Search input filters by name and category with 300ms debounce
- [ ] Only `status === 'approved'` shops are visible
- [ ] Product grid is responsive across all breakpoints (2 to 6 columns)
- [ ] Quantity controls work correctly (min 1, remove at 0)
- [ ] My Orders shows history with colour-coded status badges

### Cart

- [ ] Cart item count badge updates in real time on bottom nav
- [ ] Adding item from a different shop triggers a confirmation modal
- [ ] Place Order creates a correctly structured Firestore document
- [ ] Cart clears after successful order placement
- [ ] Empty cart shows illustration + Browse Shops CTA

### Owner Dashboard

- [ ] Overview tab shows today's sales total, order count, and product count
- [ ] Inventory tab: add, edit, and delete products work correctly
- [ ] New shop registration creates a `status: 'pending'` document
- [ ] Pending shop shows approval banner and is not visible in marketplace
- [ ] Order pipeline moves through all statuses in sequence (no skipping)
- [ ] Billing tab: product search, add to bill, and receipt generation all work

### Admin Panel

- [ ] All shops are listed with status filter (All / Pending / Approved / Suspended)
- [ ] Approve and suspend actions update Firestore and reflect immediately
- [ ] All users are listed with their current role
- [ ] Role change via dropdown updates `users/{uid}` immediately

### AI Features

- [ ] Product name suggestions appear in the inventory name field
- [ ] Description generator fills the description field on button click
- [ ] If `VITE_GEMINI_API_KEY` is missing, all AI UI elements are hidden with no errors

### General Quality

- [ ] All Firestore `onSnapshot` listeners are unsubscribed on component unmount
- [ ] Skeleton loaders appear on every async data fetch
- [ ] Error toasts appear on all failed Firestore writes
- [ ] App is fully navigable and usable on a 375px wide mobile viewport
- [ ] No console errors or warnings in the production build
- [ ] GitHub Actions CI pipeline deploys successfully on every push to `main`

---

*Maintained by the HyperMart engineering team. Increment version and update date on every significant change.*