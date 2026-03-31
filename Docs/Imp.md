# HyperMart — Implementation Reference

**Stack:** Python · FastAPI · SQLAlchemy ORM · SQLite · React JS  
**Version:** 2.0 | **Date:** March 27, 2026  
**Replaces:** Firebase Firestore + Firebase Auth with a self-hosted REST backend

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Quick Start](#3-quick-start)
4. [Backend — database.py](#4-backend--databasepy)
5. [Backend — models.py](#5-backend--modelspy)
6. [Backend — schemas.py](#6-backend--schemaspy)
7. [Backend — main.py](#7-backend--mainpy)
8. [Backend — seed.py](#8-backend--seedpy)
9. [Backend — requirements.txt](#9-backend--requirementstxt)
10. [Frontend — api/client.js](#10-frontend--apiclientjs)
11. [Frontend — context/AppContext.jsx](#11-frontend--contextappcontextjsx)
12. [Frontend — pages/Marketplace.jsx](#12-frontend--pagesmarketplacejsx)
13. [Frontend — pages/OwnerDashboard.jsx](#13-frontend--pagesownerdashboardjsx)
14. [Frontend — pages/AdminPanel.jsx](#14-frontend--pagesadminpaneljsx)
15. [Frontend — App.jsx](#15-frontend--appjsx)
16. [Database Schema](#16-database-schema)
17. [API Reference](#17-api-reference)
18. [Order Status Pipeline](#18-order-status-pipeline)
19. [PRD → Implementation Mapping](#19-prd--implementation-mapping)
20. [Production Checklist](#20-production-checklist)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────┐
│           React JS (Vite SPA)            │
│                                          │
│  Marketplace · OwnerDashboard · Admin    │
│  AppContext (Auth + Cart useReducer)     │
│  api/client.js  (Axios REST client)     │
└─────────────────┬───────────────────────┘
                  │ HTTP / JSON
┌─────────────────▼───────────────────────┐
│        FastAPI  (Python 3.12)            │
│                                          │
│  main.py   ← routes + business logic    │
│  schemas.py ← Pydantic v2 validation    │
│  models.py  ← SQLAlchemy ORM            │
│  database.py ← SQLite engine + session  │
└─────────────────┬───────────────────────┘
                  │ SQLAlchemy ORM
┌─────────────────▼───────────────────────┐
│           SQLite  (hypermart.db)         │
│  users · shops · products               │
│  orders · order_items                   │
└─────────────────────────────────────────┘
```

**Key differences from Firebase version:**

| Concern | Firebase (original) | This implementation |
|---|---|---|
| Database | Cloud Firestore (NoSQL) | SQLite via SQLAlchemy ORM |
| Real-time | `onSnapshot` listeners | REST polling (add SSE later) |
| Auth | Firebase Auth + Google | UID param → swap for JWT |
| Validation | Client-side + security rules | Pydantic v2 + SQLAlchemy |
| Queries | Composite Firestore indexes | SQL WHERE + ORDER BY |
| Transactions | Firestore batched writes | SQLAlchemy session commit |

---

## 2. Project Structure

```
hypermart/
├── backend/
│   ├── database.py          ← SQLite engine, WAL, session factory
│   ├── models.py            ← ORM: User, Shop, Product, Order, OrderItem
│   ├── schemas.py           ← Pydantic v2 request / response schemas
│   ├── main.py              ← FastAPI routes (all CRUD + analytics)
│   ├── seed.py              ← Dev seed data
│   └── requirements.txt
└── frontend/
    └── src/
        ├── api/
        │   └── client.js            ← Axios REST client
        ├── context/
        │   └── AppContext.jsx        ← Auth + Cart state (useReducer)
        ├── pages/
        │   ├── Marketplace.jsx       ← Customer shop listing
        │   ├── OwnerDashboard.jsx    ← Overview · Inventory · Orders tabs
        │   └── AdminPanel.jsx        ← Shops · Users · Analytics tabs
        └── App.jsx                   ← Router + auth guard + bottom nav
```

---

## 3. Quick Start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python seed.py                      # populate demo data
uvicorn main:app --reload --port 8000
```

Swagger UI → http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" >> .env
npm run dev                         # → http://localhost:5173
```

### Demo Accounts (after seed.py)

| Role | Email | UID |
|---|---|---|
| Admin | senamallas@gmail.com | admin-001 |
| Owner | anand@example.com | owner-001 |
| Owner | priya@example.com | owner-002 |
| Customer | customer1@example.com | cust-001 |

---

## 4. Backend — database.py

```python
"""
HyperMart — Database Configuration
SQLite + SQLAlchemy with session factory and convenience helpers.
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from typing import Generator

from models import Base

# ── Config ────────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./hypermart.db")

# SQLite performance pragmas
def _set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


# ── Engine ────────────────────────────────────────────────────────────────────

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},   # needed for SQLite + FastAPI
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
)

if DATABASE_URL.startswith("sqlite"):
    event.listen(engine, "connect", _set_sqlite_pragma)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── Helpers ───────────────────────────────────────────────────────────────────

def create_tables() -> None:
    """Create all tables (idempotent — safe to call on startup)."""
    Base.metadata.create_all(bind=engine)


def drop_tables() -> None:
    """Drop all tables — only for tests / dev resets."""
    Base.metadata.drop_all(bind=engine)


@contextmanager
def get_db_ctx() -> Generator[Session, None, None]:
    """Context-manager session for scripts and CLI usage."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# FastAPI dependency
def get_db() -> Generator[Session, None, None]:
    """Yield a DB session per request; auto-close on teardown."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## 5. Backend — models.py

```python
"""
HyperMart — SQLAlchemy ORM Models (SQLite)
Mirrors the Firestore schema from the PRD, adapted for a relational DB.
"""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Enum, Text, JSON
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


# ── Enum Types ────────────────────────────────────────────────────────────────

class UserRole(str, PyEnum):
    customer = "customer"
    owner    = "owner"
    admin    = "admin"


class ShopStatus(str, PyEnum):
    pending   = "pending"
    approved  = "approved"
    suspended = "suspended"


class ShopCategory(str, PyEnum):
    grocery       = "Grocery"
    dairy         = "Dairy"
    vegetables    = "Vegetables & Fruits"
    meat          = "Meat"
    bakery        = "Bakery & Snacks"
    beverages     = "Beverages"
    household     = "Household"
    personal_care = "Personal Care"


class ShopLocation(str, PyEnum):
    green_valley   = "Green Valley"
    central_market = "Central Market"
    food_plaza     = "Food Plaza"
    milk_lane      = "Milk Lane"
    old_town       = "Old Town"


class ProductStatus(str, PyEnum):
    active       = "active"
    out_of_stock = "out_of_stock"


class OrderStatus(str, PyEnum):
    pending          = "pending"
    accepted         = "accepted"
    ready            = "ready"
    out_for_delivery = "out_for_delivery"
    delivered        = "delivered"
    rejected         = "rejected"


class PaymentStatus(str, PyEnum):
    pending = "pending"
    paid    = "paid"


# ── Models ────────────────────────────────────────────────────────────────────

class User(Base):
    """Platform user — customer, shop owner, or admin."""
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    uid          = Column(String(128), unique=True, nullable=False, index=True,
                          comment="Firebase Auth UID or local UUID")
    email        = Column(String(255), unique=True, nullable=False, index=True)
    display_name = Column(String(255), nullable=False)
    photo_url    = Column(String(1024), nullable=True)
    role         = Column(Enum(UserRole), nullable=False, default=UserRole.customer)
    phone        = Column(String(20), nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shops  = relationship("Shop",  back_populates="owner",    cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="customer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email} [{self.role}]>"


class Shop(Base):
    """A neighbourhood shop registered by an owner."""
    __tablename__ = "shops"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    owner_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name          = Column(String(255), nullable=False)
    address       = Column(Text, nullable=False)
    category      = Column(Enum(ShopCategory), nullable=False)
    location_name = Column(Enum(ShopLocation), nullable=False, index=True)
    status        = Column(Enum(ShopStatus), nullable=False,
                           default=ShopStatus.pending, index=True)
    logo          = Column(String(1024), nullable=True)
    timings       = Column(String(100), nullable=True)
    lat           = Column(Float, nullable=True)
    lng           = Column(Float, nullable=True)
    rating        = Column(Float, nullable=False, default=4.5)
    review_count  = Column(Integer, nullable=False, default=0)
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner    = relationship("User",    back_populates="shops")
    products = relationship("Product", back_populates="shop", cascade="all, delete-orphan")
    orders   = relationship("Order",   back_populates="shop")

    def __repr__(self):
        return f"<Shop '{self.name}' [{self.status}]>"


class Product(Base):
    """A product listed inside a shop's inventory."""
    __tablename__ = "products"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    shop_id    = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    name       = Column(String(255), nullable=False)
    price      = Column(Float, nullable=False, comment="Selling price in INR")
    mrp        = Column(Float, nullable=False, comment="Max retail price; mrp >= price")
    unit       = Column(String(50), nullable=False, comment="e.g. kg, 500ml, pcs")
    category   = Column(Enum(ShopCategory), nullable=False)
    stock      = Column(Integer, nullable=False, default=0)
    image      = Column(String(1024), nullable=True)
    status     = Column(Enum(ProductStatus), nullable=False,
                        default=ProductStatus.active, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    shop        = relationship("Shop", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")

    def __repr__(self):
        return f"<Product '{self.name}' ₹{self.price}>"


class Order(Base):
    """A customer order placed for a specific shop."""
    __tablename__ = "orders"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    shop_id          = Column(Integer, ForeignKey("shops.id", ondelete="RESTRICT"),
                              nullable=False, index=True)
    shop_name        = Column(String(255), nullable=False, comment="Denormalised snapshot")
    customer_id      = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"),
                              nullable=False, index=True)
    total            = Column(Float, nullable=False)
    status           = Column(Enum(OrderStatus), nullable=False,
                              default=OrderStatus.pending, index=True)
    payment_status   = Column(Enum(PaymentStatus), nullable=False,
                              default=PaymentStatus.pending)
    delivery_address = Column(Text, nullable=False)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at       = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    shop     = relationship("Shop", back_populates="orders")
    customer = relationship("User", back_populates="orders")
    items    = relationship("OrderItem", back_populates="order",
                            cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Order #{self.id} [{self.status}] ₹{self.total}>"


class OrderItem(Base):
    """A single line item within an order (price snapshot at order time)."""
    __tablename__ = "order_items"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    order_id   = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"),
                        nullable=False)
    name       = Column(String(255), nullable=False,
                        comment="Snapshot of product name at order time")
    price      = Column(Float, nullable=False,
                        comment="Snapshot of price at order time")
    quantity   = Column(Integer, nullable=False)

    order   = relationship("Order",   back_populates="items")
    product = relationship("Product", back_populates="order_items")

    @property
    def line_total(self) -> float:
        return round(self.price * self.quantity, 2)

    def __repr__(self):
        return f"<OrderItem {self.name} x{self.quantity}>"
```

---

## 6. Backend — schemas.py

```python
"""
HyperMart — Pydantic v2 Schemas
Request / response models for every API endpoint.
"""

from datetime import datetime
from typing import Optional, List, ClassVar, Dict, Set
from pydantic import BaseModel, EmailStr, field_validator, model_validator

from models import UserRole, ShopStatus, ShopCategory, ShopLocation
from models import ProductStatus, OrderStatus, PaymentStatus


# ── Shared ────────────────────────────────────────────────────────────────────

class OrmBase(BaseModel):
    model_config = {"from_attributes": True}


# ── User ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    uid:          str
    email:        EmailStr
    display_name: str
    photo_url:    Optional[str]  = None
    role:         UserRole       = UserRole.customer
    phone:        Optional[str]  = None


class UserUpdate(BaseModel):
    display_name: Optional[str]      = None
    photo_url:    Optional[str]      = None
    role:         Optional[UserRole] = None
    phone:        Optional[str]      = None


class UserOut(OrmBase):
    id:           int
    uid:          str
    email:        str
    display_name: str
    photo_url:    Optional[str]
    role:         UserRole
    phone:        Optional[str]
    created_at:   datetime
    last_login:   Optional[datetime]


# ── Shop ──────────────────────────────────────────────────────────────────────

class ShopCreate(BaseModel):
    name:          str
    address:       str
    category:      ShopCategory
    location_name: ShopLocation
    logo:          Optional[str] = None
    timings:       Optional[str] = None
    lat:           Optional[float] = None
    lng:           Optional[float] = None

    @field_validator("name")
    @classmethod
    def name_min_length(cls, v: str) -> str:
        if len(v.strip()) < 3:
            raise ValueError("Shop name must be at least 3 characters")
        return v.strip()


class ShopUpdate(BaseModel):
    name:          Optional[str]          = None
    address:       Optional[str]          = None
    category:      Optional[ShopCategory] = None
    location_name: Optional[ShopLocation] = None
    logo:          Optional[str]          = None
    timings:       Optional[str]          = None
    status:        Optional[ShopStatus]   = None
    lat:           Optional[float]        = None
    lng:           Optional[float]        = None


class ShopOut(OrmBase):
    id:            int
    owner_id:      int
    name:          str
    address:       str
    category:      ShopCategory
    location_name: ShopLocation
    status:        ShopStatus
    logo:          Optional[str]
    timings:       Optional[str]
    lat:           Optional[float]
    lng:           Optional[float]
    rating:        float
    review_count:  int
    created_at:    datetime


class ShopStatusUpdate(BaseModel):
    status: ShopStatus


# ── Product ───────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name:     str
    price:    float
    mrp:      float
    unit:     str
    category: ShopCategory
    stock:    int           = 0
    image:    Optional[str] = None
    status:   ProductStatus = ProductStatus.active

    @field_validator("price", "mrp")
    @classmethod
    def positive_price(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Price must be greater than zero")
        return v

    @model_validator(mode="after")
    def mrp_gte_price(self) -> "ProductCreate":
        if self.mrp < self.price:
            raise ValueError("MRP must be >= selling price")
        return self

    @field_validator("stock")
    @classmethod
    def non_negative_stock(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Stock cannot be negative")
        return v


class ProductUpdate(BaseModel):
    name:     Optional[str]           = None
    price:    Optional[float]         = None
    mrp:      Optional[float]         = None
    unit:     Optional[str]           = None
    category: Optional[ShopCategory]  = None
    stock:    Optional[int]           = None
    image:    Optional[str]           = None
    status:   Optional[ProductStatus] = None


class ProductOut(OrmBase):
    id:         int
    shop_id:    int
    name:       str
    price:      float
    mrp:        float
    unit:       str
    category:   ShopCategory
    stock:      int
    image:      Optional[str]
    status:     ProductStatus
    created_at: datetime


# ── Orders ────────────────────────────────────────────────────────────────────

class OrderItemIn(BaseModel):
    product_id: int
    quantity:   int

    @field_validator("quantity")
    @classmethod
    def positive_qty(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Quantity must be at least 1")
        return v


class OrderCreate(BaseModel):
    shop_id:          int
    items:            List[OrderItemIn]
    delivery_address: str = "Default Address"

    @field_validator("items")
    @classmethod
    def non_empty_items(cls, v: list) -> list:
        if not v:
            raise ValueError("Order must contain at least one item")
        return v


class OrderItemOut(OrmBase):
    id:         int
    product_id: int
    name:       str
    price:      float
    quantity:   int
    line_total: float


class OrderOut(OrmBase):
    id:               int
    shop_id:          int
    shop_name:        str
    customer_id:      int
    items:            List[OrderItemOut]
    total:            float
    status:           OrderStatus
    payment_status:   PaymentStatus
    delivery_address: str
    created_at:       datetime
    updated_at:       Optional[datetime]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus

    VALID_TRANSITIONS: ClassVar[Dict] = {
        OrderStatus.pending:          {OrderStatus.accepted, OrderStatus.rejected},
        OrderStatus.accepted:         {OrderStatus.ready,    OrderStatus.rejected},
        OrderStatus.ready:            {OrderStatus.out_for_delivery},
        OrderStatus.out_for_delivery: {OrderStatus.delivered},
        OrderStatus.delivered:        set(),
        OrderStatus.rejected:         set(),
    }

    @classmethod
    def validate_transition(cls, current: OrderStatus, next_: OrderStatus) -> None:
        allowed = cls.VALID_TRANSITIONS.get(current, set())
        if next_ not in allowed:
            raise ValueError(
                f"Cannot transition from '{current}' to '{next_}'. "
                f"Allowed: {[s.value for s in allowed]}"
            )


# ── Analytics ─────────────────────────────────────────────────────────────────

class PlatformAnalytics(BaseModel):
    total_shops:       int
    approved_shops:    int
    total_users:       int
    total_orders:      int
    delivered_revenue: float


class ShopAnalytics(BaseModel):
    today_sales:     float
    today_orders:    int
    total_products:  int
    low_stock_items: List[str]   # product names with stock <= 5


# ── Pagination ────────────────────────────────────────────────────────────────

class PaginatedShops(BaseModel):
    items: List[ShopOut]
    total: int
    page:  int
    size:  int


class PaginatedOrders(BaseModel):
    items: List[OrderOut]
    total: int
    page:  int
    size:  int
```

---

## 7. Backend — main.py

```python
"""
HyperMart — FastAPI Application
Full CRUD API replacing Firebase Firestore with SQLite + SQLAlchemy.
"""

from datetime import datetime, date
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

import models as M
import schemas as S
from database import get_db, create_tables

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="HyperMart API",
    description="Hyperlocal marketplace — Python / SQLAlchemy / SQLite backend",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    create_tables()


# ── Auth helpers (simplified — replace with real JWT in production) ───────────

ADMIN_EMAIL = "senamallas@gmail.com"

def get_current_user(uid: str = Query(...), db: Session = Depends(get_db)) -> M.User:
    user = db.query(M.User).filter(M.User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Admin override rule from PRD
    if user.email == ADMIN_EMAIL and user.role != M.UserRole.admin:
        user.role = M.UserRole.admin
        db.commit()
    return user

def require_role(*roles: M.UserRole):
    def _dep(current_user: M.User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return _dep


# ═══════════════════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════════════════

@app.post("/users", response_model=S.UserOut, status_code=201)
def create_user(payload: S.UserCreate, db: Session = Depends(get_db)):
    if db.query(M.User).filter(M.User.uid == payload.uid).first():
        raise HTTPException(400, "User already exists")
    user = M.User(**payload.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/users/me", response_model=S.UserOut)
def get_me(current_user: M.User = Depends(get_current_user)):
    return current_user


@app.patch("/users/me", response_model=S.UserOut)
def update_me(
    payload: S.UserUpdate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "role" and current_user.role != M.UserRole.admin:
            continue
        setattr(current_user, field, value)
    current_user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return current_user


@app.get("/users", response_model=List[S.UserOut])
def list_users(
    _: M.User = Depends(require_role(M.UserRole.admin)),
    db: Session = Depends(get_db)
):
    return db.query(M.User).order_by(M.User.created_at.desc()).all()


@app.patch("/users/{user_id}/role", response_model=S.UserOut)
def change_user_role(
    user_id: int,
    payload: S.UserUpdate,
    _: M.User = Depends(require_role(M.UserRole.admin)),
    db: Session = Depends(get_db)
):
    user = db.get(M.User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if payload.role:
        user.role = payload.role
    db.commit()
    db.refresh(user)
    return user


# ═══════════════════════════════════════════════════════════════════
# SHOPS
# ═══════════════════════════════════════════════════════════════════

@app.get("/shops", response_model=S.PaginatedShops)
def list_shops(
    location: Optional[M.ShopLocation] = None,
    category: Optional[M.ShopCategory] = None,
    status:   Optional[M.ShopStatus]   = None,
    search:   Optional[str]            = None,
    page:     int = Query(1, ge=1),
    size:     int = Query(20, ge=1, le=100),
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(M.Shop)
    if current_user.role != M.UserRole.admin:
        q = q.filter(M.Shop.status == M.ShopStatus.approved)
    elif status:
        q = q.filter(M.Shop.status == status)
    if location:
        q = q.filter(M.Shop.location_name == location)
    if category:
        q = q.filter(M.Shop.category == category)
    if search:
        like = f"%{search}%"
        q = q.filter(M.Shop.name.ilike(like) | M.Shop.category.ilike(like))
    total = q.count()
    items = q.order_by(M.Shop.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}


@app.post("/shops", response_model=S.ShopOut, status_code=201)
def create_shop(
    payload: S.ShopCreate,
    current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
    db: Session = Depends(get_db)
):
    shop = M.Shop(owner_id=current_user.id, **payload.model_dump())
    db.add(shop)
    db.commit()
    db.refresh(shop)
    return shop


@app.get("/shops/{shop_id}", response_model=S.ShopOut)
def get_shop(shop_id: int, _: M.User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    return shop


@app.patch("/shops/{shop_id}", response_model=S.ShopOut)
def update_shop(
    shop_id: int, payload: S.ShopUpdate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    is_owner = current_user.role == M.UserRole.owner and shop.owner_id == current_user.id
    is_admin = current_user.role == M.UserRole.admin
    if not (is_owner or is_admin):
        raise HTTPException(403, "Not authorised to edit this shop")
    update_data = payload.model_dump(exclude_none=True)
    if "status" in update_data and not is_admin:
        del update_data["status"]
    for field, value in update_data.items():
        setattr(shop, field, value)
    db.commit()
    db.refresh(shop)
    return shop


@app.patch("/shops/{shop_id}/status", response_model=S.ShopOut)
def update_shop_status(
    shop_id: int, payload: S.ShopStatusUpdate,
    _: M.User = Depends(require_role(M.UserRole.admin)),
    db: Session = Depends(get_db)
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    shop.status = payload.status
    db.commit()
    db.refresh(shop)
    return shop


@app.delete("/shops/{shop_id}", status_code=204)
def delete_shop(
    shop_id: int,
    _: M.User = Depends(require_role(M.UserRole.admin)),
    db: Session = Depends(get_db)
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    db.delete(shop)
    db.commit()


@app.get("/owners/me/shops", response_model=List[S.ShopOut])
def get_my_shops(
    current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
    db: Session = Depends(get_db)
):
    return db.query(M.Shop).filter(M.Shop.owner_id == current_user.id).all()


# ═══════════════════════════════════════════════════════════════════
# PRODUCTS
# ═══════════════════════════════════════════════════════════════════

@app.get("/shops/{shop_id}/products", response_model=List[S.ProductOut])
def list_products(
    shop_id: int, active_only: bool = True,
    _: M.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(M.Product).filter(M.Product.shop_id == shop_id)
    if active_only:
        q = q.filter(M.Product.status == M.ProductStatus.active)
    return q.order_by(M.Product.name).all()


@app.post("/shops/{shop_id}/products", response_model=S.ProductOut, status_code=201)
def create_product(
    shop_id: int, payload: S.ProductCreate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    product = M.Product(shop_id=shop_id, **payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@app.patch("/shops/{shop_id}/products/{product_id}", response_model=S.ProductOut)
def update_product(
    shop_id: int, product_id: int, payload: S.ProductUpdate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = _get_product_or_404(db, shop_id, product_id)
    _assert_shop_ownership(product.shop, current_user)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@app.delete("/shops/{shop_id}/products/{product_id}", status_code=204)
def delete_product(
    shop_id: int, product_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = _get_product_or_404(db, shop_id, product_id)
    _assert_shop_ownership(product.shop, current_user)
    active_order_count = (
        db.query(M.OrderItem).join(M.Order)
          .filter(
              M.OrderItem.product_id == product_id,
              M.Order.status.notin_([M.OrderStatus.delivered, M.OrderStatus.rejected])
          ).count()
    )
    if active_order_count:
        raise HTTPException(409, "Product has active orders — cannot delete")
    db.delete(product)
    db.commit()


# ═══════════════════════════════════════════════════════════════════
# ORDERS
# ═══════════════════════════════════════════════════════════════════

@app.post("/orders", response_model=S.OrderOut, status_code=201)
def place_order(
    payload: S.OrderCreate,
    current_user: M.User = Depends(require_role(M.UserRole.customer)),
    db: Session = Depends(get_db)
):
    shop = db.get(M.Shop, payload.shop_id)
    if not shop or shop.status != M.ShopStatus.approved:
        raise HTTPException(404, "Shop not found or not available")
    order_items, total = [], 0.0
    for item_in in payload.items:
        product = db.get(M.Product, item_in.product_id)
        if not product or product.shop_id != shop.id:
            raise HTTPException(422, f"Product {item_in.product_id} not found in this shop")
        if product.stock < item_in.quantity:
            raise HTTPException(422, f"Insufficient stock for '{product.name}'")
        order_items.append(M.OrderItem(
            product_id=product.id, name=product.name,
            price=product.price, quantity=item_in.quantity,
        ))
        total += product.price * item_in.quantity
        product.stock -= item_in.quantity
    order = M.Order(
        shop_id=shop.id, shop_name=shop.name,
        customer_id=current_user.id, items=order_items,
        total=round(total, 2), delivery_address=payload.delivery_address,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@app.get("/orders/me", response_model=S.PaginatedOrders)
def get_my_orders(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    current_user: M.User = Depends(require_role(M.UserRole.customer)),
    db: Session = Depends(get_db)
):
    q = db.query(M.Order).filter(M.Order.customer_id == current_user.id)
    total = q.count()
    items = q.order_by(M.Order.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}


@app.get("/shops/{shop_id}/orders", response_model=S.PaginatedOrders)
def list_shop_orders(
    shop_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    q = db.query(M.Order).filter(M.Order.shop_id == shop_id)
    total = q.count()
    items = q.order_by(M.Order.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}


@app.patch("/orders/{order_id}/status", response_model=S.OrderOut)
def update_order_status(
    order_id: int, payload: S.OrderStatusUpdate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.get(M.Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if current_user.role != M.UserRole.admin:
        shop = db.get(M.Shop, order.shop_id)
        if not shop or shop.owner_id != current_user.id:
            raise HTTPException(403, "Not authorised to update this order")
    try:
        S.OrderStatusUpdate.validate_transition(order.status, payload.status)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    order.status = payload.status
    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order


# ═══════════════════════════════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════════════════════════════

@app.get("/analytics/platform", response_model=S.PlatformAnalytics)
def platform_analytics(
    _: M.User = Depends(require_role(M.UserRole.admin)),
    db: Session = Depends(get_db)
):
    delivered_rev = db.query(func.sum(M.Order.total)).filter(
        M.Order.status == M.OrderStatus.delivered
    ).scalar() or 0.0
    return {
        "total_shops":       db.query(M.Shop).count(),
        "approved_shops":    db.query(M.Shop).filter(M.Shop.status == M.ShopStatus.approved).count(),
        "total_users":       db.query(M.User).count(),
        "total_orders":      db.query(M.Order).count(),
        "delivered_revenue": round(delivered_rev, 2),
    }


@app.get("/shops/{shop_id}/analytics", response_model=S.ShopAnalytics)
def shop_analytics(
    shop_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_orders = db.query(M.Order).filter(
        and_(M.Order.shop_id == shop_id, M.Order.created_at >= today_start)
    ).all()
    low_stock = db.query(M.Product.name).filter(
        M.Product.shop_id == shop_id,
        M.Product.stock   <= 5,
        M.Product.status  == M.ProductStatus.active
    ).all()
    return {
        "today_sales":    round(sum(o.total for o in today_orders), 2),
        "today_orders":   len(today_orders),
        "total_products": db.query(M.Product).filter(M.Product.shop_id == shop_id).count(),
        "low_stock_items": [r.name for r in low_stock],
    }


# ── Private helpers ───────────────────────────────────────────────

def _get_product_or_404(db, shop_id, product_id):
    p = db.query(M.Product).filter(
        M.Product.id == product_id, M.Product.shop_id == shop_id
    ).first()
    if not p:
        raise HTTPException(404, "Product not found")
    return p

def _assert_shop_ownership(shop, user):
    if user.role == M.UserRole.admin:
        return
    if user.role == M.UserRole.owner and shop.owner_id == user.id:
        return
    raise HTTPException(403, "Not authorised for this shop")
```

---

## 8. Backend — seed.py

```python
"""
HyperMart — Dev Seed Script
Populates SQLite with demo users, shops, products, and orders.
Run: python seed.py
"""

from datetime import datetime, timedelta
from database import create_tables, get_db_ctx
from models import User, Shop, Product, Order, OrderItem
from models import UserRole, ShopStatus, ShopCategory, ShopLocation
from models import ProductStatus, OrderStatus, PaymentStatus

USERS = [
    dict(uid="admin-001", email="senamallas@gmail.com", display_name="Admin User",  role=UserRole.admin),
    dict(uid="owner-001", email="anand@example.com",    display_name="Anand Kumar", role=UserRole.owner),
    dict(uid="owner-002", email="priya@example.com",    display_name="Priya Sharma",role=UserRole.owner),
    dict(uid="cust-001",  email="customer1@example.com",display_name="Ravi Verma",  role=UserRole.customer),
]

SHOPS = [
    dict(owner_idx=1, name="Anand Groceries",  category=ShopCategory.grocery,
         location_name=ShopLocation.green_valley,   address="12, Main St, Green Valley",
         timings="8 AM – 10 PM", status=ShopStatus.approved),
    dict(owner_idx=1, name="Anand Dairy Fresh", category=ShopCategory.dairy,
         location_name=ShopLocation.milk_lane,      address="5, Milk Lane, Sector 4",
         timings="6 AM – 8 PM",  status=ShopStatus.approved),
    dict(owner_idx=2, name="Priya Bakery",      category=ShopCategory.bakery,
         location_name=ShopLocation.central_market, address="27, Baker St, Central Market",
         timings="7 AM – 9 PM",  status=ShopStatus.pending),
]

PRODUCTS = [
    dict(shop_idx=0, name="Basmati Rice (5 kg)", category=ShopCategory.grocery,
         price=320, mrp=370, unit="5kg bag", stock=50),
    dict(shop_idx=0, name="Toor Dal (1 kg)",     category=ShopCategory.grocery,
         price=130, mrp=145, unit="1kg",     stock=80),
    dict(shop_idx=0, name="Sunflower Oil (1L)",   category=ShopCategory.grocery,
         price=155, mrp=175, unit="1L bottle",stock=30),
    dict(shop_idx=1, name="Full Cream Milk (1L)", category=ShopCategory.dairy,
         price=62,  mrp=65,  unit="1L pouch", stock=120),
    dict(shop_idx=1, name="Paneer (200g)",        category=ShopCategory.dairy,
         price=90,  mrp=100, unit="200g pack",stock=40),
    dict(shop_idx=1, name="Butter (100g)",        category=ShopCategory.dairy,
         price=55,  mrp=60,  unit="100g",     stock=3),   # low stock demo
    dict(shop_idx=2, name="Multigrain Bread",     category=ShopCategory.bakery,
         price=40,  mrp=45,  unit="400g loaf",stock=25),
]

def run():
    create_tables()
    with get_db_ctx() as db:
        user_objs = []
        for u in USERS:
            obj = db.query(User).filter(User.uid == u["uid"]).first() or User(**u)
            db.add(obj); db.flush(); user_objs.append(obj)
        shop_objs = []
        for s in SHOPS:
            owner = user_objs[s.pop("owner_idx")]
            obj = db.query(Shop).filter(Shop.name == s["name"]).first() or Shop(owner_id=owner.id, **s)
            db.add(obj); db.flush(); shop_objs.append(obj)
        prod_objs = []
        for p in PRODUCTS:
            shop = shop_objs[p.pop("shop_idx")]
            obj = db.query(Product).filter(Product.shop_id == shop.id, Product.name == p["name"]).first()
            if not obj:
                obj = Product(shop_id=shop.id, **p)
            db.add(obj); db.flush(); prod_objs.append(obj)
        if not db.query(Order).filter(Order.customer_id == user_objs[3].id).first():
            rice, dal = prod_objs[0], prod_objs[1]
            db.add(Order(
                shop_id=shop_objs[0].id, shop_name=shop_objs[0].name,
                customer_id=user_objs[3].id,
                total=rice.price * 2 + dal.price,
                status=OrderStatus.accepted, payment_status=PaymentStatus.pending,
                delivery_address="Plot 4, Green Valley Colony",
                created_at=datetime.utcnow() - timedelta(hours=2),
                items=[
                    OrderItem(product_id=rice.id, name=rice.name, price=rice.price, quantity=2),
                    OrderItem(product_id=dal.id,  name=dal.name,  price=dal.price,  quantity=1),
                ]
            ))
    print("✅  Seed complete — Admin: senamallas@gmail.com | Customer: customer1@example.com")

if __name__ == "__main__":
    run()
```

---

## 9. Backend — requirements.txt

```
fastapi==0.115.6
uvicorn[standard]==0.32.1
sqlalchemy==2.0.36
pydantic[email]==2.10.3
python-dotenv==1.0.1
httpx==0.28.1
pytest==8.3.4
pytest-asyncio==0.24.0
```

---

## 10. Frontend — api/client.js

```javascript
// src/api/client.js
// HyperMart — Axios API client
// Replaces all Firebase Firestore reads/writes with REST calls.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE_URL });

// Attach current user UID as query param.
// Production: swap for Authorization: Bearer <JWT>
api.interceptors.request.use((config) => {
  const uid = localStorage.getItem('hypermart_uid');
  if (uid) config.params = { ...(config.params || {}), uid };
  return config;
});

// ── Users ─────────────────────────────────────────────────────────

export const createUser = (data)         => api.post('/users', data);
export const getMe      = ()             => api.get('/users/me');
export const updateMe   = (data)         => api.patch('/users/me', data);
export const listUsers  = ()             => api.get('/users');
export const changeRole = (id, role)     => api.patch(`/users/${id}/role`, { role });

// ── Shops ─────────────────────────────────────────────────────────

// params: { location, category, status, search, page, size }
export const listShops        = (params = {}) => api.get('/shops', { params });
export const createShop       = (data)        => api.post('/shops', data);
export const getShop          = (id)          => api.get(`/shops/${id}`);
export const updateShop       = (id, data)    => api.patch(`/shops/${id}`, data);
export const updateShopStatus = (id, status)  => api.patch(`/shops/${id}/status`, { status });
export const deleteShop       = (id)          => api.delete(`/shops/${id}`);
export const getMyShops       = ()            => api.get('/owners/me/shops');

// ── Products ──────────────────────────────────────────────────────

export const listProducts  = (shopId, activeOnly = true) =>
  api.get(`/shops/${shopId}/products`, { params: { active_only: activeOnly } });
export const createProduct = (shopId, data)            => api.post(`/shops/${shopId}/products`, data);
export const updateProduct = (shopId, productId, data) => api.patch(`/shops/${shopId}/products/${productId}`, data);
export const deleteProduct = (shopId, productId)       => api.delete(`/shops/${shopId}/products/${productId}`);

// ── Orders ────────────────────────────────────────────────────────

export const placeOrder        = (data)            => api.post('/orders', data);
export const getMyOrders       = (page = 1)        => api.get('/orders/me', { params: { page } });
export const getShopOrders     = (shopId, page = 1)=> api.get(`/shops/${shopId}/orders`, { params: { page } });
export const updateOrderStatus = (orderId, status) => api.patch(`/orders/${orderId}/status`, { status });

// ── Analytics ─────────────────────────────────────────────────────

export const getPlatformAnalytics = ()       => api.get('/analytics/platform');
export const getShopAnalytics     = (shopId) => api.get(`/shops/${shopId}/analytics`);
```

---

## 11. Frontend — context/AppContext.jsx

```jsx
// src/context/AppContext.jsx
// Global state: Auth + Cart — replaces Firebase Auth + Firestore listeners.

import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { getMe } from '../api/client';

// ── Cart Reducer ──────────────────────────────────────────────────

const cartInitial = { shopId: null, shopName: null, items: [] };

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const { shopId, shopName, item } = action;
      if (state.shopId && state.shopId !== shopId) return state; // different shop — caller must confirm
      const existing = state.items.find(i => i.productId === item.productId);
      const items = existing
        ? state.items.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i)
        : [...state.items, { ...item, quantity: 1 }];
      return { shopId, shopName, items };
    }
    case 'REMOVE': {
      const items = state.items.filter(i => i.productId !== action.productId);
      return items.length ? { ...state, items } : cartInitial;
    }
    case 'UPDATE_QTY': {
      if (action.qty < 1) {
        const items = state.items.filter(i => i.productId !== action.productId);
        return items.length ? { ...state, items } : cartInitial;
      }
      return { ...state, items: state.items.map(i =>
        i.productId === action.productId ? { ...i, quantity: action.qty } : i) };
    }
    case 'CLEAR':   return cartInitial;
    default:        return state;
  }
}

// ── Auth Reducer ──────────────────────────────────────────────────

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':    return { user: action.user,  loading: false, error: null };
    case 'CLEAR_USER':  return { user: null,          loading: false, error: null };
    case 'SET_ERROR':   return { ...state,            loading: false, error: action.error };
    default:            return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [auth, authDispatch] = useReducer(authReducer, { user: null, loading: true, error: null });
  const [cart, cartDispatch] = useReducer(cartReducer, cartInitial);

  // Restore session from stored UID on mount
  useEffect(() => {
    const uid = localStorage.getItem('hypermart_uid');
    if (!uid) { authDispatch({ type: 'CLEAR_USER' }); return; }
    getMe()
      .then(res => authDispatch({ type: 'SET_USER', user: res.data }))
      .catch(() => { localStorage.removeItem('hypermart_uid'); authDispatch({ type: 'CLEAR_USER' }); });
  }, []);

  const signIn  = useCallback((userData) => {
    localStorage.setItem('hypermart_uid', userData.uid);
    authDispatch({ type: 'SET_USER', user: userData });
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('hypermart_uid');
    authDispatch({ type: 'CLEAR_USER' });
    cartDispatch({ type: 'CLEAR' });
  }, []);

  const addToCart      = useCallback((shopId, shopName, item) => cartDispatch({ type: 'ADD', shopId, shopName, item }), []);
  const removeFromCart = useCallback((productId) => cartDispatch({ type: 'REMOVE', productId }), []);
  const updateQuantity = useCallback((productId, qty) => cartDispatch({ type: 'UPDATE_QTY', productId, qty }), []);
  const clearCart      = useCallback(() => cartDispatch({ type: 'CLEAR' }), []);

  const cartItemCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  const cartTotal     = Math.round(cart.items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;

  return (
    <AppContext.Provider value={{
      currentUser: auth.user, authLoading: auth.loading, authError: auth.error,
      signIn, signOut,
      cart, cartItemCount, cartTotal,
      addToCart, removeFromCart, updateQuantity, clearCart,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
};
```

---

## 12. Frontend — pages/Marketplace.jsx

```jsx
// src/pages/Marketplace.jsx
// Customer shop listing with location / category / search filters.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listShops } from '../api/client';
import { useApp } from '../context/AppContext';

const LOCATIONS  = ['Green Valley','Central Market','Food Plaza','Milk Lane','Old Town'];
const CATEGORIES = ['All','Grocery','Dairy','Vegetables & Fruits','Meat','Bakery & Snacks','Beverages','Household','Personal Care'];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
      <div className="h-16 w-16 rounded-full bg-gray-200 mb-3" />
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
    </div>
  );
}

function ShopCard({ shop, onClick }) {
  return (
    <div onClick={() => onClick(shop.id)}
         className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md
                    transition-all cursor-pointer p-4 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {shop.logo
          ? <img src={shop.logo} alt={shop.name} className="h-14 w-14 rounded-full object-cover" />
          : <div className="h-14 w-14 rounded-full bg-indigo-50 flex items-center justify-center
                            text-2xl font-bold text-indigo-400">{shop.name[0]}</div>
        }
        <div>
          <p className="font-semibold text-gray-900 leading-tight">{shop.name}</p>
          <span className="text-xs text-gray-400">{shop.category}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 line-clamp-2">{shop.address}</p>
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
        <span className="text-xs text-amber-500 font-medium">★ {shop.rating.toFixed(1)}</span>
        {shop.timings && <span className="text-xs text-gray-400">{shop.timings}</span>}
        <button className="text-xs bg-indigo-500 text-white px-3 py-1 rounded-full hover:bg-indigo-600">
          View Shop
        </button>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const navigate   = useNavigate();
  const { currentUser } = useApp();
  const savedLoc   = localStorage.getItem('hm_location') || LOCATIONS[0];
  const [location, setLocation]   = useState(savedLoc);
  const [category, setCategory]   = useState('All');
  const [search,   setSearch]     = useState('');
  const [shops,    setShops]      = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState(null);
  const [debounced,setDebounced]  = useState('');

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { localStorage.setItem('hm_location', location); }, [location]);

  const fetchShops = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await listShops({ location, size: 100 });
      setShops(res.data.items);
    } catch { setError('Failed to load shops. Please try again.'); }
    finally { setLoading(false); }
  }, [location]);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  const filtered = useMemo(() => shops.filter(s => {
    const matchCat    = category === 'All' || s.category === category;
    const q           = debounced.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    return matchCat && matchSearch;
  }), [shops, category, debounced]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100 px-4 py-3 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-2">HyperMart</h1>
        <select value={location} onChange={e => setLocation(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          {LOCATIONS.map(l => <option key={l}>{l}</option>)}
        </select>
        <input type="search" placeholder="Search shops…" value={search} onChange={e => setSearch(e.target.value)}
               className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
                    className={`flex-shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${
                      category === c ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-200'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <main className="px-4 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-500">
            <p className="mb-3">{error}</p>
            <button onClick={fetchShops} className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🏪</p>
            <p className="font-medium">No shops found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map(shop => <ShopCard key={shop.id} shop={shop} onClick={id => navigate(`/marketplace/${id}`)} />)}
          </div>
        )}
      </main>
    </div>
  );
}
```

---

## 13. Frontend — pages/OwnerDashboard.jsx

> See full source in `/frontend/src/pages/OwnerDashboard.jsx`. Key structure:

```
OwnerDashboard
├── Shop selector dropdown (getMyShops)
├── Pending approval banner
├── Tab bar: Overview · Inventory · Orders
│
├── OverviewTab        ← getShopAnalytics → StatCards + LowStockAlert
├── InventoryTab       ← listProducts, createProduct, updateProduct, deleteProduct
│   └── Add/Edit Modal (name, category, price, mrp, stock, unit, image, status)
└── OrdersTab          ← getShopOrders, updateOrderStatus
    └── Order cards with Advance / Reject buttons

Status pipeline enforced:
  pending → accepted → ready → out_for_delivery → delivered
  pending / accepted → rejected
```

---

## 14. Frontend — pages/AdminPanel.jsx

> See full source in `/frontend/src/pages/AdminPanel.jsx`. Key structure:

```
AdminPanel
├── Tab bar: Shops · Users · Analytics
│
├── ShopsTab     ← listShops (all statuses), updateShopStatus
│   ├── Filter chips: All · Pending · Approved · Suspended
│   └── Actions: Approve · Reject · Suspend · Reinstate
│
├── UsersTab     ← listUsers, changeRole
│   └── Role dropdown per row (customer / owner / admin)
│
└── AnalyticsTab ← getPlatformAnalytics
    └── Stat cards: shops, approved, users, orders, revenue
```

---

## 15. Frontend — App.jsx

```jsx
// src/App.jsx
// Root: HashRouter + RequireAuth guard + role-home redirects + bottom nav.

import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Marketplace    from './pages/Marketplace';
import OwnerDashboard from './pages/OwnerDashboard';
import AdminPanel     from './pages/AdminPanel';

function RequireAuth({ children, roles }) {
  const { currentUser, authLoading } = useApp();
  if (authLoading) return <div className="flex items-center justify-center min-h-screen">
    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>;
  if (!currentUser) return <Navigate to="/" replace />;
  if (roles && !roles.includes(currentUser.role)) return <Navigate to="/" replace />;
  return children;
}

function BottomNav() {
  const { currentUser, cartItemCount } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!currentUser || currentUser.role === 'admin') return null;

  const links = currentUser.role === 'owner'
    ? [{ icon:'📊', label:'Stats',  path:'/owner?tab=overview'  },
       { icon:'📦', label:'Stock',  path:'/owner?tab=inventory' },
       { icon:'🗒', label:'Orders', path:'/owner?tab=orders'    }]
    : [{ icon:'🏪', label:'Shop',    path:'/marketplace' },
       { icon:'🛒', label:'Cart',    path:'/cart', badge: cartItemCount },
       { icon:'👤', label:'Profile', path:'/profile' }];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 z-40 shadow-lg">
      {links.map(l => (
        <button key={l.path} onClick={() => navigate(l.path)}
                className={`flex flex-col items-center gap-0.5 px-4 py-1 relative transition-colors ${
                  pathname.startsWith(l.path.split('?')[0]) ? 'text-indigo-500' : 'text-gray-400'}`}>
          <span className="text-xl">{l.icon}</span>
          <span className="text-xs">{l.label}</span>
          {l.badge > 0 && (
            <span className="absolute top-0 right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {l.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

function AppRoutes() {
  const { currentUser } = useApp();
  const roleHome = currentUser?.role === 'admin' ? '/admin'
                 : currentUser?.role === 'owner' ? '/owner'
                 : '/marketplace';
  return (
    <>
      <Routes>
        <Route path="/"            element={currentUser ? <Navigate to={roleHome} /> : <SignIn />} />
        <Route path="/marketplace" element={<RequireAuth roles={['customer','admin']}><Marketplace /></RequireAuth>} />
        <Route path="/owner"       element={<RequireAuth roles={['owner','admin']}><OwnerDashboard /></RequireAuth>} />
        <Route path="/admin"       element={<RequireAuth roles={['admin']}><AdminPanel /></RequireAuth>} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProvider>
  );
}
```

---

## 16. Database Schema

```
users
├── id            INTEGER PK
├── uid           VARCHAR(128) UNIQUE   ← Firebase UID or local UUID
├── email         VARCHAR(255) UNIQUE
├── display_name  VARCHAR(255)
├── photo_url     VARCHAR(1024) NULL
├── role          ENUM(customer|owner|admin)
├── phone         VARCHAR(20) NULL
├── created_at    DATETIME
└── last_login    DATETIME

shops
├── id            INTEGER PK
├── owner_id      FK → users.id  CASCADE DELETE
├── name          VARCHAR(255)
├── address       TEXT
├── category      ENUM(8 values)
├── location_name ENUM(5 values) INDEX
├── status        ENUM(pending|approved|suspended) INDEX
├── logo          VARCHAR(1024) NULL
├── timings       VARCHAR(100) NULL
├── lat / lng     FLOAT NULL
├── rating        FLOAT DEFAULT 4.5
├── review_count  INTEGER DEFAULT 0
└── created_at    DATETIME

products
├── id         INTEGER PK
├── shop_id    FK → shops.id  CASCADE DELETE  INDEX
├── name       VARCHAR(255)
├── price      FLOAT   ← selling price in INR
├── mrp        FLOAT   ← mrp >= price always
├── unit       VARCHAR(50)
├── category   ENUM(8 values)
├── stock      INTEGER >= 0
├── image      VARCHAR(1024) NULL
├── status     ENUM(active|out_of_stock) INDEX
└── created_at DATETIME

orders
├── id               INTEGER PK
├── shop_id          FK → shops.id    RESTRICT  INDEX
├── shop_name        VARCHAR(255)     ← denormalised snapshot
├── customer_id      FK → users.id   RESTRICT  INDEX
├── total            FLOAT
├── status           ENUM(6 values)  INDEX
├── payment_status   ENUM(pending|paid)
├── delivery_address TEXT
├── created_at       DATETIME
└── updated_at       DATETIME NULL

order_items
├── id         INTEGER PK
├── order_id   FK → orders.id   CASCADE DELETE  INDEX
├── product_id FK → products.id RESTRICT
├── name       VARCHAR(255)  ← snapshot at order time
├── price      FLOAT         ← snapshot at order time
└── quantity   INTEGER
```

**Indexes created automatically by SQLAlchemy:**

| Table | Indexed columns | Maps to PRD Firestore index |
|---|---|---|
| `shops` | `location_name`, `status` | shops: status + locationName |
| `products` | `shop_id`, `status` | products: shopId + status |
| `orders` | `customer_id`, `created_at` | orders: customerId + createdAt DESC |
| `orders` | `shop_id`, `created_at` | orders: shopId + createdAt DESC |

---

## 17. API Reference

All requests: pass `?uid=<user_uid>` (swap for `Authorization: Bearer <JWT>` in production).

### Users

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/users` | Public | Create user profile |
| GET | `/users/me` | Any | Get own profile |
| PATCH | `/users/me` | Any | Update name / phone |
| GET | `/users` | Admin | List all users |
| PATCH | `/users/{id}/role` | Admin | Change user role |

### Shops

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/shops` | Any | List shops (location, category, status, search, page, size) |
| POST | `/shops` | Owner | Register shop → status: pending |
| GET | `/shops/{id}` | Any | Get shop |
| PATCH | `/shops/{id}` | Owner / Admin | Update shop fields |
| PATCH | `/shops/{id}/status` | Admin | Approve / suspend |
| DELETE | `/shops/{id}` | Admin | Delete shop |
| GET | `/owners/me/shops` | Owner | My shops |

### Products

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/shops/{id}/products` | Any | List products (`active_only` param) |
| POST | `/shops/{id}/products` | Owner | Add product |
| PATCH | `/shops/{id}/products/{pid}` | Owner | Edit product |
| DELETE | `/shops/{id}/products/{pid}` | Owner | Delete (blocked if active orders) |

### Orders

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/orders` | Customer | Place order (decrements stock) |
| GET | `/orders/me` | Customer | Order history |
| GET | `/shops/{id}/orders` | Owner | Shop orders |
| PATCH | `/orders/{id}/status` | Owner | Advance status |

### Analytics

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/analytics/platform` | Admin | Total shops, users, orders, revenue |
| GET | `/shops/{id}/analytics` | Owner | Today's sales, orders, low-stock |

---

## 18. Order Status Pipeline

```
         ┌─────────┐
         │ pending │
         └────┬────┘
      ┌───────┴────────┐
      ▼                ▼
 ┌──────────┐     ┌──────────┐
 │ accepted │     │ rejected │ (terminal)
 └────┬─────┘     └──────────┘
      │
      ▼
  ┌───────┐
  │ ready │
  └───┬───┘
      │
      ▼
┌─────────────────┐
│ out_for_delivery│
└────────┬────────┘
         │
         ▼
    ┌───────────┐
    │ delivered │ (terminal)
    └───────────┘
```

Invalid transitions return HTTP 422 with the list of allowed next states.

---

## 19. PRD → Implementation Mapping

| PRD Section | Implementation |
|---|---|
| §3 Role Matrix | `require_role()` FastAPI dependency + `RequireAuth` React component |
| §3 Admin Override | `get_current_user()` — checks `ADMIN_EMAIL` on every request |
| §4 Auth Flow | `AppContext.signIn/signOut` + `localStorage` UID persistence |
| §4 First-time User | `POST /users` called after Google sign-in if profile missing |
| §6.1 Sign-In | `SignIn` component in `App.jsx` |
| §6.3 Marketplace | `Marketplace.jsx` — location filter via API, category/search client-side |
| §6.3.5 Shop query | `GET /shops?location=X&status=approved` |
| §6.4 Cart | `cartReducer` in `AppContext` — single-shop constraint enforced in ADD case |
| §6.4 Place Order | `POST /orders` — stock decremented atomically in same transaction |
| §6.5 Owner Dashboard | `OwnerDashboard.jsx` — 3 tabs wired to 6 API endpoints |
| §6.5.4 Order Pipeline | `PATCH /orders/{id}/status` + `OrderStatusUpdate.validate_transition()` |
| §6.6 Admin Panel | `AdminPanel.jsx` — 3 tabs: shop approvals, user roles, analytics |
| §7 Firestore Schema | `models.py` — all 5 collections → relational tables |
| §8 Security Rules | FastAPI role checks + `_assert_shop_ownership()` helper |
| §15 Delete blocked | `DELETE /products/{id}` checks active orders before allowing delete |
| §16 Cart persistence | Still in-memory (localStorage upgrade is next backlog item) |

---

## 20. Production Checklist

- [ ] Replace `?uid=` with `Authorization: Bearer <JWT>` (`python-jose` + `passlib`)
- [ ] Add Google OAuth2 callback endpoint to issue JWTs
- [ ] Set `DATABASE_URL=postgresql://...` for production (SQLAlchemy is DB-agnostic)
- [ ] Set `SQL_ECHO=false` in prod environment
- [ ] Set `VITE_API_URL` to the deployed backend origin
- [ ] Add rate limiting (`slowapi`)
- [ ] Add HTTPS (nginx / Caddy reverse proxy)
- [ ] Wire Firebase Storage for product image uploads (PRD §16 item 4)
- [ ] Implement delivery address flow (PRD §16 item 1)
- [ ] Add Razorpay / Stripe payment gateway (PRD §16 item 2)
- [ ] Add SSE or WebSocket for real-time order status (replaces `onSnapshot`)
- [ ] Persist cart to `localStorage` or user profile endpoint

---

*HyperMart Implementation Reference — v2.0 — March 27, 2026*