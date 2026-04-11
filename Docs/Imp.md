# HyperMart -- Implementation Reference

**Stack:** Python 3.12 . FastAPI . SQLAlchemy ORM . SQLite . Gemini AI . React 18 . Vite 6 . Tailwind CSS 4
**Version:** 3.0 | **Date:** April 11, 2026
**Auth:** Email + password, JWT HS256 (python-jose + passlib)

---

## Table of Contents

1.  [Architecture Overview](#1-architecture-overview)
2.  [Project Structure](#2-project-structure)
3.  [Quick Start](#3-quick-start)
4.  [Backend -- database.py](#4-backend--databasepy)
5.  [Backend -- models.py](#5-backend--modelspy)
6.  [Backend -- schemas.py](#6-backend--schemaspy)
7.  [Backend -- main.py](#7-backend--mainpy)
8.  [Backend -- ai.py](#8-backend--aipy)
9.  [Backend -- seed.py](#9-backend--seedpy)
10. [Backend -- requirements.txt](#10-backend--requirementstxt)
11. [Frontend -- api/client.js](#11-frontend--apiclientjs)
12. [Frontend -- context/AppContext.jsx](#12-frontend--contextappcontextjsx)
13. [Frontend -- App.jsx (auth + routing)](#13-frontend--appjsx-auth--routing)
14. [Frontend -- Pages & Components](#14-frontend--pages--components)
15. [Database Schema](#15-database-schema)
16. [API Reference](#16-api-reference)
17. [Order Status Pipeline](#17-order-status-pipeline)
18. [PRD --> Implementation Mapping](#18-prd--implementation-mapping)
19. [Production Checklist](#19-production-checklist)

---

## 1. Architecture Overview

```
+-------------------------------------------+
|         React 18  (Vite 6 SPA)            |
|                                           |
|  Marketplace . OwnerDashboard . Admin     |
|  CustomerProfile . OrderHistory . Settings|
|  AppContext (Auth + Cart + i18n)           |
|  api/client.js  (Axios + JWT Bearer)      |
+--------------------+----------------------+
                     | HTTP / JSON
+--------------------v----------------------+
|       FastAPI  (Python 3.12)              |
|                                           |
|  main.py      -- routes + business logic  |
|  ai.py        -- Gemini 2.0 Flash router  |
|  schemas.py   -- Pydantic v2 validation   |
|  models.py    -- SQLAlchemy ORM           |
|  database.py  -- SQLite engine + session  |
+--------------------+----------------------+
                     | SQLAlchemy ORM
+--------------------v----------------------+
|          SQLite  (hypermart.db)           |
|  users . shops . products                 |
|  orders . order_items . subscriptions     |
+-------------------------------------------+
```

| Concern | Implementation |
|---------|---------------|
| Database | SQLite via SQLAlchemy 2 ORM |
| Auth | Email + password, JWT HS256, 30-day tokens (`python-jose` + `passlib`) |
| Token storage | `sessionStorage` (browser); `Authorization: Bearer <token>` header |
| AI | Google Gemini 2.0 Flash via `httpx` (no LangChain, no Qdrant) |
| Validation | Pydantic v2 request/response schemas |
| Subscriptions | Owner subscription system at Rs.10/month (mock payment) |
| i18n | English, Hindi, Telugu -- `frontend/public/locales/{en,hi,te}/translation.json` |
| Styling | Tailwind CSS 4 utility classes |
| Animations | Framer Motion (`motion` package) |
| Maps | React-Leaflet (owner shop location pinning) |
| Icons | Lucide React |

---

## 2. Project Structure

```
hypermart/
+-- backend/
|   +-- database.py          -- SQLite engine, WAL, session factory
|   +-- models.py            -- ORM: User, Shop, Product, Order, OrderItem, Subscription
|   +-- schemas.py           -- Pydantic v2 request / response schemas
|   +-- main.py              -- FastAPI routes (auth, CRUD, analytics, walk-in POS, upload)
|   +-- ai.py                -- Gemini AI router (6 endpoints)
|   +-- seed.py              -- Dev seed data (5 users, 6 shops, 35+ products, orders)
|   +-- requirements.txt
|   +-- uploads/             -- Static uploaded files served at /uploads/*
+-- frontend/
    +-- public/
    |   +-- locales/
    |       +-- en/translation.json
    |       +-- hi/translation.json
    |       +-- te/translation.json
    +-- src/
        +-- api/
        |   +-- client.js            -- Axios REST client (JWT Bearer interceptor)
        +-- context/
        |   +-- AppContext.jsx        -- Auth + Cart + Language state
        +-- lib/
        |   +-- i18n.js              -- i18n init + setLanguage helper
        +-- hooks/
        |   +-- useTranslation.js
        |   +-- useLanguageChange.js
        +-- components/
        |   +-- AIChatWidget.jsx     -- Floating AI chat drawer
        |   +-- InvoiceModal.jsx     -- Printable invoice modal
        |   +-- DailySalesCalendar.jsx -- Monthly calendar with revenue markers
        |   +-- LanguageSelector.jsx -- Globe dropdown (en/hi/te)
        +-- pages/
        |   +-- Marketplace.jsx       -- Customer shop listing + cart + checkout
        |   +-- OwnerDashboard.jsx    -- 6-tab owner portal
        |   +-- AdminPanel.jsx        -- Shops / Users / Analytics / Subscriptions
        |   +-- CustomerProfile.jsx   -- Edit profile + photo upload
        |   +-- OrderHistory.jsx      -- Paginated orders + invoice print
        |   +-- CustomerSettings.jsx  -- Password change, notifications, sign out
        +-- App.jsx                   -- Router, auth guard, SignIn/Register, bottom nav
```

---

## 3. Quick Start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt

# Optional: set Gemini key for AI features
export GEMINI_API_KEY="your-google-ai-studio-key"

python seed.py                      # populate demo data
uvicorn main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev                         # http://localhost:5173
```

### Demo Accounts (after seed.py)

| Role | Email | Password | Phone |
|------|-------|----------|-------|
| Admin | senamallas@gmail.com | Admin@123 | +91-9000000001 |
| Owner | anand@example.com | Owner@123 | +91-9000000002 |
| Owner | priya@example.com | Owner@123 | +91-9000000003 |
| Customer | ravi@example.com | Customer@123 | +91-9000000004 |
| Customer | kavita@example.com | Customer@123 | +91-9000000005 |

---

## 4. Backend -- database.py

```python
"""
HyperMart -- Database Configuration
SQLite + SQLAlchemy with session factory and convenience helpers.
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from typing import Generator

from models import Base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./hypermart.db")

def _set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
)

if DATABASE_URL.startswith("sqlite"):
    event.listen(engine, "connect", _set_sqlite_pragma)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_tables() -> None:
    Base.metadata.create_all(bind=engine)

def drop_tables() -> None:
    Base.metadata.drop_all(bind=engine)

@contextmanager
def get_db_ctx() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## 5. Backend -- models.py

```python
"""
HyperMart -- SQLAlchemy ORM Models (SQLite)
"""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Integer, Float, DateTime,
    ForeignKey, Enum, Text
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

# -- Enum Types ----------------------------------------------------------------

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

class SubscriptionStatus(str, PyEnum):
    pending = "pending"
    active  = "active"
    expired = "expired"

# -- Models --------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    uid           = Column(String(128), unique=True, nullable=False, index=True)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    display_name  = Column(String(255), nullable=False)
    photo_url     = Column(String(1024), nullable=True)
    role          = Column(Enum(UserRole), nullable=False, default=UserRole.customer)
    phone         = Column(String(20), nullable=True)
    password_hash = Column(String(256), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shops        = relationship("Shop",         back_populates="owner",    cascade="all, delete-orphan")
    orders       = relationship("Order",        back_populates="customer", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="user",     uselist=False, cascade="all, delete-orphan")

class Shop(Base):
    __tablename__ = "shops"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    owner_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name          = Column(String(255), nullable=False)
    address       = Column(Text, nullable=False)
    category      = Column(Enum(ShopCategory), nullable=False)
    location_name = Column(Enum(ShopLocation), nullable=False, index=True)
    status        = Column(Enum(ShopStatus), nullable=False, default=ShopStatus.pending, index=True)
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

class Product(Base):
    __tablename__ = "products"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    shop_id     = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price       = Column(Float, nullable=False)
    mrp         = Column(Float, nullable=False)
    unit        = Column(String(50), nullable=False)
    category    = Column(Enum(ShopCategory), nullable=False)
    stock       = Column(Integer, nullable=False, default=0)
    image       = Column(String(1024), nullable=True)
    status      = Column(Enum(ProductStatus), nullable=False, default=ProductStatus.active, index=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    shop        = relationship("Shop", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")

class Order(Base):
    __tablename__ = "orders"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    shop_id          = Column(Integer, ForeignKey("shops.id", ondelete="RESTRICT"), nullable=False, index=True)
    shop_name        = Column(String(255), nullable=False)
    customer_id      = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    total            = Column(Float, nullable=False)
    status           = Column(Enum(OrderStatus), nullable=False, default=OrderStatus.pending, index=True)
    payment_status   = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.pending)
    delivery_address = Column(Text, nullable=False)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at       = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    shop     = relationship("Shop", back_populates="orders")
    customer = relationship("User", back_populates="orders")
    items    = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    order_id   = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    name       = Column(String(255), nullable=False)
    price      = Column(Float, nullable=False)
    quantity   = Column(Integer, nullable=False)

    order   = relationship("Order",   back_populates="items")
    product = relationship("Product", back_populates="order_items")

    @property
    def line_total(self) -> float:
        return round(self.price * self.quantity, 2)

class Subscription(Base):
    __tablename__ = "subscriptions"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    plan_amount  = Column(Float, nullable=False, default=10.0)
    status       = Column(Enum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.pending)
    starts_at    = Column(DateTime, nullable=True)
    expires_at   = Column(DateTime, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="subscription")
```

---

## 6. Backend -- schemas.py

```python
"""
HyperMart -- Pydantic v2 Schemas
"""

from datetime import datetime
from typing import Optional, List, ClassVar, Dict
from pydantic import BaseModel, EmailStr, field_validator, model_validator, computed_field

from models import (UserRole, ShopStatus, ShopCategory, ShopLocation,
                    ProductStatus, OrderStatus, PaymentStatus, SubscriptionStatus)


class OrmBase(BaseModel):
    model_config = {"from_attributes": True}

# -- User -----------------------------------------------------------------------

class UserCreate(BaseModel):
    uid:          str
    email:        EmailStr
    display_name: str
    photo_url:    Optional[str] = None
    role:         UserRole      = UserRole.customer
    phone:        Optional[str] = None

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

# -- Auth -----------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email:        EmailStr
    password:     str
    display_name: str
    phone:        Optional[str] = None
    role:         UserRole      = UserRole.customer

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("display_name")
    @classmethod
    def name_min_length(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v.strip()

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserOut

# -- Shop -----------------------------------------------------------------------

class ShopCreate(BaseModel):
    name:          str
    address:       str
    category:      ShopCategory
    location_name: ShopLocation
    logo:          Optional[str]   = None
    timings:       Optional[str]   = None
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

# -- Product --------------------------------------------------------------------

class ProductCreate(BaseModel):
    name:        str
    description: Optional[str] = None
    price:       float
    mrp:         float
    unit:        str
    category:    ShopCategory
    stock:       int           = 0
    image:       Optional[str] = None
    status:      ProductStatus = ProductStatus.active

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
    name:        Optional[str]           = None
    description: Optional[str]           = None
    price:       Optional[float]         = None
    mrp:         Optional[float]         = None
    unit:        Optional[str]           = None
    category:    Optional[ShopCategory]  = None
    stock:       Optional[int]           = None
    image:       Optional[str]           = None
    status:      Optional[ProductStatus] = None

class ProductOut(OrmBase):
    id:          int
    shop_id:     int
    name:        str
    description: Optional[str] = None
    price:       float
    mrp:         float
    unit:        str
    category:    ShopCategory
    stock:       int
    image:       Optional[str]
    status:      ProductStatus
    created_at:  datetime

# -- Orders ---------------------------------------------------------------------

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

class WalkinOrderCreate(BaseModel):
    items: List[OrderItemIn]

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

    @computed_field
    @property
    def line_total(self) -> float:
        return round(self.price * self.quantity, 2)

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

# -- Subscription ---------------------------------------------------------------

class SubscriptionOut(OrmBase):
    id:          int
    user_id:     int
    plan_amount: float
    status:      SubscriptionStatus
    starts_at:   Optional[datetime]
    expires_at:  Optional[datetime]
    created_at:  datetime

# -- Analytics ------------------------------------------------------------------

class PlatformAnalytics(BaseModel):
    total_shops:          int
    approved_shops:       int
    total_users:          int
    total_orders:         int
    delivered_revenue:    float
    active_subscriptions: int = 0

class LowStockItem(BaseModel):
    name:  str
    stock: int

class DailySale(BaseModel):
    day:     str
    revenue: float

class CategoryRevenue(BaseModel):
    category: str
    revenue:  float

class TopProduct(BaseModel):
    product_id:    int
    name:          str
    quantity_sold: int
    revenue:       float

class MonthlyRevenue(BaseModel):
    month:   str
    revenue: float

class ShopAnalytics(BaseModel):
    today_sales:      float
    today_orders:     int
    total_products:   int
    low_stock_items:  List[LowStockItem]
    daily_sales:      List[DailySale]
    category_revenue: List[CategoryRevenue]
    top_products:     List[TopProduct]
    monthly_revenue:  List[MonthlyRevenue]
    orders_by_status: Dict[str, int]

# -- Pagination -----------------------------------------------------------------

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

## 7. Backend -- main.py

> Full source. Key sections: Auth, Users, Subscriptions, Shops, Products, Orders, Analytics, File Upload, Walk-in POS.

```python
"""
HyperMart -- FastAPI Application
JWT auth, password hashing, subscription system, full CRUD.
"""

import os, uuid, shutil, pathlib
from datetime import datetime, date, timedelta
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, text
from jose import JWTError, jwt
from passlib.context import CryptContext

import models as M
import schemas as S
from database import get_db, create_tables
from ai import router as ai_router

# -- App -----------------------------------------------------------------------

app = FastAPI(title="HyperMart API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

UPLOAD_DIR = pathlib.Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.include_router(ai_router)

@app.on_event("startup")
def startup():
    create_tables()
    from database import engine
    with engine.connect() as conn:
        for stmt in ["ALTER TABLE products ADD COLUMN description TEXT"]:
            try:
                conn.execute(text(stmt)); conn.commit()
            except Exception:
                pass

# -- Security helpers -----------------------------------------------------------

SECRET_KEY           = os.getenv("JWT_SECRET", "hypermart-dev-secret-change-in-production")
ALGORITHM            = "HS256"
TOKEN_EXPIRY         = timedelta(days=30)
ADMIN_EMAIL          = "senamallas@gmail.com"
SUBSCRIPTION_AMOUNT  = 10.0   # Rs.10 per month

pwd_ctx  = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
security = HTTPBearer(auto_error=False)

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + TOKEN_EXPIRY
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# -- Auth dependencies ----------------------------------------------------------

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> M.User:
    if not credentials:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(credentials.credentials)
    user = db.get(M.User, int(payload["sub"]))
    if not user:
        raise HTTPException(401, "User not found")
    if user.email == ADMIN_EMAIL and user.role != M.UserRole.admin:
        user.role = M.UserRole.admin
        db.commit()
    return user

def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[M.User]:
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        return db.get(M.User, int(payload["sub"]))
    except HTTPException:
        return None

def require_role(*roles: M.UserRole):
    def _dep(current_user: M.User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return current_user
    return _dep

def _check_subscription(user: M.User, db: Session) -> None:
    if user.role != M.UserRole.owner:
        return
    sub = db.query(M.Subscription).filter(M.Subscription.user_id == user.id).first()
    if not sub or sub.status != M.SubscriptionStatus.active:
        raise HTTPException(402, "Active subscription required. Subscribe for Rs.10/month.")
    if sub.expires_at and sub.expires_at < datetime.utcnow():
        sub.status = M.SubscriptionStatus.expired
        db.commit()
        raise HTTPException(402, "Your subscription has expired. Please renew.")

# -- AUTH routes ----------------------------------------------------------------

@app.post("/auth/register", response_model=S.TokenOut, status_code=201)
def register(payload: S.RegisterRequest, db: Session = Depends(get_db)):
    if db.query(M.User).filter(M.User.email == str(payload.email)).first():
        raise HTTPException(400, "Email already registered")
    role = M.UserRole.admin if str(payload.email) == ADMIN_EMAIL else payload.role
    user = M.User(
        uid=str(uuid.uuid4()), email=str(payload.email),
        display_name=payload.display_name, phone=payload.phone,
        role=role, password_hash=hash_password(payload.password),
    )
    db.add(user); db.flush()
    if role == M.UserRole.owner:
        db.add(M.Subscription(user_id=user.id))
    db.commit(); db.refresh(user)
    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.post("/auth/login", response_model=S.TokenOut)
def login(payload: S.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(M.User).filter(M.User.email == str(payload.email)).first()
    if not user:
        raise HTTPException(401, "Invalid email or password")
    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    if user.email == ADMIN_EMAIL and user.role != M.UserRole.admin:
        user.role = M.UserRole.admin
    user.last_login = datetime.utcnow()
    db.commit(); db.refresh(user)
    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": user}

# -- USERS routes ---------------------------------------------------------------

@app.get("/users/me", response_model=S.UserOut)
def get_me(current_user: M.User = Depends(get_current_user)):
    return current_user

@app.patch("/users/me", response_model=S.UserOut)
def update_me(payload: S.UserUpdate, current_user: M.User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "role" and current_user.role != M.UserRole.admin:
            continue
        setattr(current_user, field, value)
    db.commit(); db.refresh(current_user)
    return current_user

@app.get("/users", response_model=List[S.UserOut])
def list_users(_: M.User = Depends(require_role(M.UserRole.admin)),
               db: Session = Depends(get_db)):
    return db.query(M.User).order_by(M.User.created_at.desc()).all()

@app.patch("/users/{user_id}/role", response_model=S.UserOut)
def change_user_role(user_id: int, payload: S.UserUpdate,
                     _: M.User = Depends(require_role(M.UserRole.admin)),
                     db: Session = Depends(get_db)):
    user = db.get(M.User, user_id)
    if not user: raise HTTPException(404, "User not found")
    if payload.role: user.role = payload.role
    db.commit(); db.refresh(user)
    return user

# -- SUBSCRIPTIONS routes -------------------------------------------------------

@app.get("/subscriptions/me", response_model=S.SubscriptionOut)
def get_my_subscription(
    current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
    db: Session = Depends(get_db)):
    sub = db.query(M.Subscription).filter(M.Subscription.user_id == current_user.id).first()
    if not sub: raise HTTPException(404, "No subscription found")
    if sub.expires_at and sub.expires_at < datetime.utcnow() and sub.status == M.SubscriptionStatus.active:
        sub.status = M.SubscriptionStatus.expired
        db.commit(); db.refresh(sub)
    return sub

@app.post("/subscriptions/activate", response_model=S.SubscriptionOut)
def activate_subscription(
    current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
    db: Session = Depends(get_db)):
    """Mock payment: activates or renews for 30 days (Rs.10)."""
    sub = db.query(M.Subscription).filter(M.Subscription.user_id == current_user.id).first()
    now = datetime.utcnow()
    if sub:
        base = sub.expires_at if (sub.expires_at and sub.expires_at > now) else now
        sub.starts_at = now
        sub.expires_at = base + timedelta(days=30)
        sub.status = M.SubscriptionStatus.active
        sub.plan_amount = SUBSCRIPTION_AMOUNT
    else:
        sub = M.Subscription(
            user_id=current_user.id, plan_amount=SUBSCRIPTION_AMOUNT,
            status=M.SubscriptionStatus.active,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
        db.add(sub)
    db.commit(); db.refresh(sub)
    return sub

@app.get("/subscriptions", response_model=List[S.SubscriptionOut])
def list_subscriptions(_: M.User = Depends(require_role(M.UserRole.admin)),
                       db: Session = Depends(get_db)):
    return db.query(M.Subscription).order_by(M.Subscription.created_at.desc()).all()

# -- SHOPS routes ---------------------------------------------------------------

@app.get("/shops", response_model=S.PaginatedShops)
def list_shops(location: Optional[M.ShopLocation] = None,
               category: Optional[M.ShopCategory] = None,
               status: Optional[M.ShopStatus] = None,
               search: Optional[str] = None,
               page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=500),
               current_user: Optional[M.User] = Depends(get_optional_user),
               db: Session = Depends(get_db)):
    q = db.query(M.Shop)
    is_admin = current_user and current_user.role == M.UserRole.admin
    if is_admin and status:
        q = q.filter(M.Shop.status == status)
    elif not is_admin:
        q = q.filter(M.Shop.status == M.ShopStatus.approved)
    if location: q = q.filter(M.Shop.location_name == location)
    if category: q = q.filter(M.Shop.category == category)
    if search:
        like = f"%{search}%"
        q = q.filter(M.Shop.name.ilike(like) | M.Shop.category.ilike(like))
    total = q.count()
    items = q.order_by(M.Shop.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}

@app.post("/shops", response_model=S.ShopOut, status_code=201)
def create_shop(payload: S.ShopCreate,
                current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
                db: Session = Depends(get_db)):
    if current_user.role == M.UserRole.owner:
        _check_subscription(current_user, db)
    shop = M.Shop(owner_id=current_user.id, **payload.model_dump())
    db.add(shop); db.commit(); db.refresh(shop)
    return shop

@app.get("/shops/{shop_id}", response_model=S.ShopOut)
def get_shop(shop_id: int, db: Session = Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    return shop

@app.patch("/shops/{shop_id}", response_model=S.ShopOut)
def update_shop(shop_id: int, payload: S.ShopUpdate,
                current_user: M.User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    is_owner = current_user.role == M.UserRole.owner and shop.owner_id == current_user.id
    is_admin = current_user.role == M.UserRole.admin
    if not (is_owner or is_admin): raise HTTPException(403, "Not authorised")
    update_data = payload.model_dump(exclude_none=True)
    if "status" in update_data and not is_admin: del update_data["status"]
    for field, value in update_data.items(): setattr(shop, field, value)
    db.commit(); db.refresh(shop)
    return shop

@app.patch("/shops/{shop_id}/status", response_model=S.ShopOut)
def update_shop_status(shop_id: int, payload: S.ShopStatusUpdate,
                       _: M.User = Depends(require_role(M.UserRole.admin)),
                       db: Session = Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    shop.status = payload.status
    db.commit(); db.refresh(shop)
    return shop

@app.delete("/shops/{shop_id}", status_code=204)
def delete_shop(shop_id: int,
                _: M.User = Depends(require_role(M.UserRole.admin)),
                db: Session = Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    db.delete(shop); db.commit()

@app.get("/owners/me/shops", response_model=List[S.ShopOut])
def get_my_shops(current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
                 db: Session = Depends(get_db)):
    return db.query(M.Shop).filter(M.Shop.owner_id == current_user.id).all()

# -- PRODUCTS routes ------------------------------------------------------------

@app.get("/shops/{shop_id}/products", response_model=List[S.ProductOut])
def list_products(shop_id: int, active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(M.Product).filter(M.Product.shop_id == shop_id)
    if active_only: q = q.filter(M.Product.status == M.ProductStatus.active)
    return q.order_by(M.Product.name).all()

@app.post("/shops/{shop_id}/products", response_model=S.ProductOut, status_code=201)
def create_product(shop_id: int, payload: S.ProductCreate,
                   current_user: M.User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    product = M.Product(shop_id=shop_id, **payload.model_dump())
    db.add(product); db.commit(); db.refresh(product)
    return product

@app.patch("/shops/{shop_id}/products/{product_id}", response_model=S.ProductOut)
def update_product(shop_id: int, product_id: int, payload: S.ProductUpdate,
                   current_user: M.User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    product = _get_product_or_404(db, shop_id, product_id)
    _assert_shop_ownership(product.shop, current_user)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    db.commit(); db.refresh(product)
    return product

@app.delete("/shops/{shop_id}/products/{product_id}", status_code=204)
def delete_product(shop_id: int, product_id: int,
                   current_user: M.User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    product = _get_product_or_404(db, shop_id, product_id)
    _assert_shop_ownership(product.shop, current_user)
    active_count = (
        db.query(M.OrderItem).join(M.Order)
        .filter(M.OrderItem.product_id == product_id,
                M.Order.status.notin_([M.OrderStatus.delivered, M.OrderStatus.rejected]))
        .count()
    )
    if active_count: raise HTTPException(409, "Product has active orders")
    db.delete(product); db.commit()

# -- ORDERS routes --------------------------------------------------------------

@app.post("/orders", response_model=S.OrderOut, status_code=201)
def place_order(payload: S.OrderCreate,
                current_user: M.User = Depends(require_role(M.UserRole.customer)),
                db: Session = Depends(get_db)):
    shop = db.get(M.Shop, payload.shop_id)
    if not shop or shop.status != M.ShopStatus.approved:
        raise HTTPException(404, "Shop not found or not available")
    order_items, total = [], 0.0
    for item_in in payload.items:
        product = db.get(M.Product, item_in.product_id)
        if not product or product.shop_id != shop.id:
            raise HTTPException(422, f"Product {item_in.product_id} not in this shop")
        if product.stock < item_in.quantity:
            raise HTTPException(422, f"Insufficient stock for '{product.name}'")
        order_items.append(M.OrderItem(
            product_id=product.id, name=product.name,
            price=product.price, quantity=item_in.quantity,
        ))
        total += product.price * item_in.quantity
        product.stock -= item_in.quantity
    order = M.Order(
        shop_id=shop.id, shop_name=shop.name, customer_id=current_user.id,
        items=order_items, total=round(total, 2),
        delivery_address=payload.delivery_address,
    )
    db.add(order); db.commit(); db.refresh(order)
    return order

@app.get("/orders/me", response_model=S.PaginatedOrders)
def get_my_orders(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
                  current_user: M.User = Depends(require_role(M.UserRole.customer)),
                  db: Session = Depends(get_db)):
    q = db.query(M.Order).filter(M.Order.customer_id == current_user.id)
    total = q.count()
    items = q.order_by(M.Order.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}

@app.get("/shops/{shop_id}/orders", response_model=S.PaginatedOrders)
def list_shop_orders(shop_id: int, page: int = Query(1, ge=1),
                     size: int = Query(20, ge=1, le=100),
                     current_user: M.User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    q = db.query(M.Order).filter(M.Order.shop_id == shop_id)
    total = q.count()
    items = q.order_by(M.Order.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}

@app.patch("/orders/{order_id}/status", response_model=S.OrderOut)
def update_order_status(order_id: int, payload: S.OrderStatusUpdate,
                        current_user: M.User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    order = db.get(M.Order, order_id)
    if not order: raise HTTPException(404, "Order not found")
    if current_user.role != M.UserRole.admin:
        shop = db.get(M.Shop, order.shop_id)
        if not shop or shop.owner_id != current_user.id:
            raise HTTPException(403, "Not authorised")
    try:
        S.OrderStatusUpdate.validate_transition(order.status, payload.status)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    order.status = payload.status
    order.updated_at = datetime.utcnow()
    db.commit(); db.refresh(order)
    return order

# -- ANALYTICS routes -----------------------------------------------------------

@app.get("/analytics/platform", response_model=S.PlatformAnalytics)
def platform_analytics(_: M.User = Depends(require_role(M.UserRole.admin)),
                       db: Session = Depends(get_db)):
    delivered_rev = (
        db.query(func.sum(M.Order.total))
        .filter(M.Order.status == M.OrderStatus.delivered).scalar() or 0.0
    )
    active_subs = db.query(M.Subscription).filter(
        M.Subscription.status == M.SubscriptionStatus.active).count()
    return {
        "total_shops":       db.query(M.Shop).count(),
        "approved_shops":    db.query(M.Shop).filter(M.Shop.status == M.ShopStatus.approved).count(),
        "total_users":       db.query(M.User).count(),
        "total_orders":      db.query(M.Order).count(),
        "delivered_revenue": round(delivered_rev, 2),
        "active_subscriptions": active_subs,
    }

@app.get("/shops/{shop_id}/analytics", response_model=S.ShopAnalytics)
def shop_analytics(shop_id: int,
                   current_user: M.User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    # ... (computes today_sales, today_orders, total_products, low_stock_items,
    #      daily_sales (7 days), category_revenue, top_products (top 10),
    #      monthly_revenue (6 months), orders_by_status)
    # See full implementation in backend/main.py
    ...

# -- FILE UPLOAD ----------------------------------------------------------------

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = pathlib.Path(file.filename or "image.bin").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        raise HTTPException(400, "Only image files allowed (jpg, png, gif, webp)")
    filename = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_DIR / filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"url": f"/uploads/{filename}"}

# -- WALK-IN POS ---------------------------------------------------------------

@app.post("/shops/{shop_id}/walkin-order", response_model=S.OrderOut, status_code=201)
def walkin_order(shop_id: int, payload: S.WalkinOrderCreate,
                 current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
                 db: Session = Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop: raise HTTPException(404, "Shop not found")
    if current_user.role == M.UserRole.owner and shop.owner_id != current_user.id:
        raise HTTPException(403, "Not authorised")
    order_items, total = [], 0.0
    for item_in in payload.items:
        product = db.get(M.Product, item_in.product_id)
        if not product or product.shop_id != shop_id:
            raise HTTPException(422, f"Product {item_in.product_id} not in this shop")
        if product.stock < item_in.quantity:
            raise HTTPException(422, f"Insufficient stock for '{product.name}'")
        order_items.append(M.OrderItem(
            product_id=product.id, name=product.name,
            price=product.price, quantity=item_in.quantity,
        ))
        total += product.price * item_in.quantity
        product.stock -= item_in.quantity
    order = M.Order(
        shop_id=shop.id, shop_name=shop.name, customer_id=current_user.id,
        items=order_items, total=round(total, 2),
        status=M.OrderStatus.delivered, payment_status=M.PaymentStatus.paid,
        delivery_address="In-Store (Walk-in)",
    )
    db.add(order); db.commit(); db.refresh(order)
    return order

# -- Private helpers ------------------------------------------------------------

def _get_product_or_404(db, shop_id, product_id):
    p = db.query(M.Product).filter(
        M.Product.id == product_id, M.Product.shop_id == shop_id).first()
    if not p: raise HTTPException(404, "Product not found")
    return p

def _assert_shop_ownership(shop, user):
    if user.role == M.UserRole.admin: return
    if user.role == M.UserRole.owner and shop.owner_id == user.id: return
    raise HTTPException(403, "Not authorised for this shop")
```

---

## 8. Backend -- ai.py

```python
"""
HyperMart -- Gemini AI Router
All AI calls are routed through here so GEMINI_API_KEY stays server-side.
Mounted in main.py: app.include_router(ai_router)
"""

import os, json, httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/ai", tags=["AI"])

GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta"
    "/models/gemini-2.0-flash:generateContent"
)
AI_AVAILABLE = bool(GEMINI_KEY)


async def call_gemini(prompt: str) -> str:
    if not AI_AVAILABLE:
        raise HTTPException(503, "Gemini API key not configured")
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{GEMINI_URL}?key={GEMINI_KEY}", json=payload)
        r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


# GET /ai/status
@router.get("/status")
def ai_status():
    return {"available": AI_AVAILABLE}


# POST /ai/suggest-products
class SuggestRequest(BaseModel):
    category:     str
    partial_name: str

@router.post("/suggest-products")
async def suggest_products(body: SuggestRequest) -> List[str]:
    prompt = (
        f"You are a product naming assistant for a hyperlocal grocery marketplace in India.\n"
        f"Category: {body.category}\n"
        f'Partial name typed: "{body.partial_name}"\n'
        f"Suggest 5 complete, realistic product names.\n"
        f"Respond ONLY with a JSON array of strings.\n"
        f'Example: ["Amul Butter 100g", "Britannia Bread 400g"]'
    )
    try:
        text = await call_gemini(prompt)
        text = text.replace("```json", "").replace("```", "").strip()
        return [s for s in json.loads(text) if isinstance(s, str)][:5]
    except Exception:
        return []


# POST /ai/generate-description
class DescribeRequest(BaseModel):
    name:     str
    category: str

@router.post("/generate-description")
async def generate_description(body: DescribeRequest) -> dict:
    prompt = (
        f'Write a single short sentence (max 15 words) describing "{body.name}" '
        f'for an online grocery store in the "{body.category}" category. '
        f"Respond with ONLY the description sentence."
    )
    try:
        text = await call_gemini(prompt)
        return {"description": text.rstrip(".")}
    except Exception:
        return {"description": ""}


# POST /ai/low-stock-insight
class LowStockRequest(BaseModel):
    shop_name:       str
    low_stock_items: List[str]

@router.post("/low-stock-insight")
async def low_stock_insight(body: LowStockRequest) -> dict:
    if not body.low_stock_items:
        return {"insight": ""}
    items_list = ", ".join(body.low_stock_items)
    prompt = (
        f'You are an inventory advisor for "{body.shop_name}".\n'
        f"Low stock items (<= 5 units): {items_list}.\n"
        f"Give 2--3 short sentences of restocking advice."
    )
    try:
        return {"insight": await call_gemini(prompt)}
    except Exception:
        return {"insight": ""}


# POST /ai/sales-forecast
class ForecastRequest(BaseModel):
    shop_id:   int
    days_back: int = 30

@router.post("/sales-forecast")
async def sales_forecast(body: ForecastRequest) -> dict:
    prompt = (
        f"You are a sales analyst for a small grocery shop (shop ID {body.shop_id}). "
        f"Write 2-3 sentences forecasting next 7 days. "
        f"Mention peak days and a category to stock up on."
    )
    try:
        text = await call_gemini(prompt)
        return {"insight": text, "forecast": [], "avg_daily_revenue": 0}
    except Exception:
        return {"insight": "", "forecast": [], "avg_daily_revenue": 0}


# POST /ai/chat
class ChatMessage(BaseModel):
    role:    str
    content: str

class ChatRequest(BaseModel):
    message: str
    role:    str = "customer"
    shop_id: Optional[int] = None
    history: List[ChatMessage] = []

@router.post("/chat")
async def ai_chat(body: ChatRequest) -> dict:
    role_context = {
        "customer": "You are HyperMart Assistant, a helpful shopping assistant...",
        "owner":    "You are HyperMart Business Assistant, an AI advisor for shop owners...",
        "admin":    "You are HyperMart Admin Assistant. Help with platform governance...",
    }.get(body.role, "You are a helpful assistant.")
    history_text = ""
    for msg in body.history[-10:]:
        prefix = "User" if msg.role == "user" else "Assistant"
        history_text += f"{prefix}: {msg.content}\n"
    shop_ctx = f" Managing shop ID {body.shop_id}." if body.shop_id else ""
    prompt = f"{role_context}{shop_ctx}\n\n{history_text}User: {body.message}\nAssistant:"
    try:
        reply = await call_gemini(prompt)
        return {"reply": reply, "tools_used": [], "sources": []}
    except Exception:
        return {"reply": "I'm having trouble connecting. Please try again shortly.",
                "tools_used": [], "sources": []}
```

---

## 9. Backend -- seed.py

Populates the database with demo users (hashed passwords), shops, products, subscriptions, and sample orders.

```bash
python seed.py            # upsert (safe to run multiple times)
python seed.py --reset    # drop all tables first, then seed fresh
```

**Demo accounts** -- see table in Section 3.

**Seed data includes:**
- 5 users (1 admin, 2 owners, 2 customers)
- 6 shops (3 owned by Anand, 3 by Priya; 1 pending status for Anand Household)
- 35+ products across grocery, dairy, bakery, vegetables, beverages, household
- Active subscriptions for both owners
- Sample orders with various statuses

---

## 10. Backend -- requirements.txt

```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
sqlalchemy>=2.0.36
pydantic[email]>=2.10.0
python-dotenv>=1.0.1
httpx>=0.28.0
python-jose[cryptography]>=3.3.0
passlib>=1.7.4
python-multipart>=0.0.12
pytest>=8.3.0
pytest-asyncio>=0.24.0
```

---

## 11. Frontend -- api/client.js

```javascript
// src/api/client.js -- Axios REST client (JWT Bearer auth)

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL;

export const api = axios.create({ baseURL: BASE_URL });

// Attach JWT Bearer token on every request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("hypermart_token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// -- Auth
export const register = (data) => api.post("/auth/register", data);
export const login    = (data) => api.post("/auth/login",    data);

// -- Users
export const getMe            = ()         => api.get("/users/me");
export const updateMe         = (data)     => api.patch("/users/me",        data);
export const changePassword   = (data)     => api.post("/users/me/change-password", data);
export const listUsers        = ()         => api.get("/users");
export const changeRole       = (id, role) => api.patch(`/users/${id}/role`, { role });

// -- Subscriptions
export const getMySubscription    = ()  => api.get("/subscriptions/me");
export const activateSubscription = ()  => api.post("/subscriptions/activate");
export const listSubscriptions    = ()  => api.get("/subscriptions");

// -- Shops
export const listShops        = (params = {}) => api.get("/shops", { params });
export const nearbyShops      = (lat, lng, radius = 2, params = {}) =>
  api.get("/shops/nearby", { params: { lat, lng, radius, ...params } });
export const createShop       = (data)        => api.post("/shops", data);
export const getShop          = (id)          => api.get(`/shops/${id}`);
export const updateShop       = (id, data)    => api.patch(`/shops/${id}`, data);
export const updateShopStatus = (id, status)  => api.patch(`/shops/${id}/status`, { status });
export const deleteShop       = (id)          => api.delete(`/shops/${id}`);
export const getMyShops       = ()            => api.get("/owners/me/shops");

// -- Products
export const listProducts  = (shopId, activeOnly = true) =>
  api.get(`/shops/${shopId}/products`, { params: { active_only: activeOnly } });
export const createProduct = (shopId, data)            => api.post(`/shops/${shopId}/products`, data);
export const updateProduct = (shopId, productId, data) => api.patch(`/shops/${shopId}/products/${productId}`, data);
export const deleteProduct = (shopId, productId)       => api.delete(`/shops/${shopId}/products/${productId}`);

// -- Orders
export const placeOrder        = (data)             => api.post("/orders", data);
export const placeWalkinOrder  = (shopId, data)     => api.post(`/shops/${shopId}/walkin-order`, data);
export const getMyOrders       = (page = 1)         => api.get("/orders/me", { params: { page } });
export const getShopOrders     = (shopId, page = 1) => api.get(`/shops/${shopId}/orders`, { params: { page } });
export const updateOrderStatus = (orderId, status)  => api.patch(`/orders/${orderId}/status`, { status });

// -- Analytics
export const getPlatformAnalytics = ()       => api.get("/analytics/platform");
export const getShopAnalytics     = (shopId) => api.get(`/shops/${shopId}/analytics`);

// -- File Upload
export const uploadFile = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// -- AI
export const getAIStatus         = ()                           => api.get("/ai/status");
export const suggestProducts     = (category, partial_name)     => api.post("/ai/suggest-products", { category, partial_name });
export const generateDescription = (name, category)             => api.post("/ai/generate-description", { name, category });
export const getLowStockInsight  = (shop_name, low_stock_items) => api.post("/ai/low-stock-insight", { shop_name, low_stock_items });
export const aiSalesForecast     = (shop_id)                    => api.post("/ai/sales-forecast", { shop_id });
export const aiChat              = (message, shop_id, role, history) =>
  api.post("/ai/chat", { message, shop_id, role, history });
```

---

## 12. Frontend -- context/AppContext.jsx

```javascript
// Global Auth + Cart + Language state

import { createContext, useContext, useReducer, useCallback, useEffect, useState } from "react";
import { getMe, getAIStatus } from "../api/client";
import { setLanguage as setI18nLanguage } from "../lib/i18n";

// -- Cart state (useReducer + localStorage persistence) --------

const CART_STORAGE_KEY = "hypermart_cart";
const cartInitial = { shopId: null, shopName: null, items: [] };

function loadCart()  { /* parse from localStorage or return cartInitial */ }
function saveCart(c) { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(c)); }

function cartReducer(state, action) {
  switch (action.type) {
    case "ADD":        // Single-shop constraint; merge quantity if duplicate
    case "REMOVE":     // Remove item; reset to initial if cart empty
    case "UPDATE_QTY": // Update quantity; remove if qty < 1
    case "CLEAR":      // Reset to cartInitial
    default: return state;
  }
}

// -- Auth state (useReducer) -----------------------------------

function authReducer(state, action) {
  switch (action.type) {
    case "SET_USER":   return { user: action.user, loading: false, error: null };
    case "CLEAR_USER": return { user: null,         loading: false, error: null };
    case "SET_ERROR":  return { ...state,            loading: false, error: action.error };
    default: return state;
  }
}

// -- Provider --------------------------------------------------

export function AppProvider({ children }) {
  const [auth, authDispatch] = useReducer(authReducer, { user: null, loading: true, error: null });
  const [cart, cartDispatch] = useReducer(cartReducer, null, loadCart);

  useEffect(() => { saveCart(cart); }, [cart]);

  const [search, setSearch] = useState("");
  const [activeLocation, setActiveLocationState] = useState(
    localStorage.getItem("hm_location") || "All"
  );
  const setActiveLocation = useCallback((loc) => {
    localStorage.setItem("hm_location", loc);
    setActiveLocationState(loc);
  }, []);

  // Restore JWT session on mount
  useEffect(() => {
    const token = sessionStorage.getItem("hypermart_token");
    if (!token) { authDispatch({ type: "CLEAR_USER" }); return; }
    getMe()
      .then(res => authDispatch({ type: "SET_USER", user: res.data }))
      .catch(() => {
        sessionStorage.removeItem("hypermart_token");
        authDispatch({ type: "CLEAR_USER" });
      });
  }, []);

  const signIn  = useCallback((token, userData) => {
    sessionStorage.setItem("hypermart_token", token);
    authDispatch({ type: "SET_USER", user: userData });
  }, []);
  const signOut = useCallback(() => {
    sessionStorage.removeItem("hypermart_token");
    authDispatch({ type: "CLEAR_USER" });
  }, []);

  // Cart helpers
  const addToCart      = useCallback((shopId, shopName, item) => cartDispatch({ type: "ADD", shopId, shopName, item }), []);
  const removeFromCart = useCallback((productId) => cartDispatch({ type: "REMOVE", productId }), []);
  const updateQuantity = useCallback((productId, qty) => cartDispatch({ type: "UPDATE_QTY", productId, qty }), []);
  const clearCart      = useCallback(() => cartDispatch({ type: "CLEAR" }), []);
  const cartItemCount  = cart.items.reduce((s, i) => s + i.quantity, 0);
  const cartTotal      = Math.round(cart.items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;

  // AI availability
  const [aiAvailable, setAiAvailable] = useState(false);
  useEffect(() => {
    getAIStatus()
      .then(res => setAiAvailable(Boolean(res.data?.available)))
      .catch(() => setAiAvailable(false));
  }, []);

  // Language / i18n
  const [language, setLanguageState] = useState(localStorage.getItem("hypermart_language") || "en");
  const setLanguage = useCallback((lang) => {
    setLanguageState(lang);
    setI18nLanguage(lang);
    localStorage.setItem("hypermart_language", lang);
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser: auth.user, authLoading: auth.loading, authError: auth.error,
      signIn, signOut, setCurrentUser,
      cart, cartItemCount, cartTotal, addToCart, removeFromCart, updateQuantity, clearCart,
      search, setSearch, activeLocation, setActiveLocation,
      aiAvailable, language, setLanguage,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
};
```

---

## 13. Frontend -- App.jsx (auth + routing)

**Key parts:**

```javascript
// Routes (HashRouter)
<Routes>
  <Route path="/login" element={<SignIn />} />
  <Route path="/marketplace" element={<RequireAuth><Marketplace /></RequireAuth>} />
  <Route path="/owner" element={<RequireAuth roles={["owner","admin"]}><OwnerDashboard /></RequireAuth>} />
  <Route path="/admin" element={<RequireAuth roles={["admin"]}><AdminPanel /></RequireAuth>} />
  <Route path="/profile" element={<RequireAuth><CustomerProfile /></RequireAuth>} />
  <Route path="/settings" element={<RequireAuth><CustomerSettings /></RequireAuth>} />
  <Route path="/orders" element={<RequireAuth roles={["customer"]}><OrderHistory /></RequireAuth>} />
  <Route path="*" element={<Navigate to="/login" replace />} />
</Routes>
```

**SignIn component:**
- Two tabs: Login | Register
- Login: email + password fields, show/hide toggle
- Register: name, email, phone (optional), password, role selector (Customer / Shop Owner)
- Demo credential buttons: Customer, Shop Owner, Admin -- one-click login
- On success: `signIn(token, user)` then navigate to role home

**RequireAuth guard:**
- Checks `sessionStorage` for token via `useApp().currentUser`
- Redirects unauthenticated to `/login`
- Redirects wrong role to their home page

**Bottom Navigation Bar:**
- Marketplace (all roles), Orders (customer), Owner Dashboard (owner), Admin Panel (admin)
- Profile, Settings, Sign Out
- LanguageSelector, AIChatWidget

---

## 14. Frontend -- Pages & Components

### Pages

| Page | File | Description |
|------|------|-------------|
| Marketplace | `pages/Marketplace.jsx` | Shop listing with location/category filters, search; click shop to view products; cart sidebar; checkout with delivery address |
| Owner Dashboard | `pages/OwnerDashboard.jsx` | 6 tabs: Overview, Analytics, Billing (Walk-in POS), Inventory, Orders, Settings. Leaflet map for shop location. AI product suggestions + descriptions. InvoiceModal. DailySalesCalendar |
| Admin Panel | `pages/AdminPanel.jsx` | 4 tabs: Shops (approve/suspend), Users (change role), Analytics (platform metrics), Subscriptions |
| Customer Profile | `pages/CustomerProfile.jsx` | Edit display_name, phone, photo_url (with file upload via `POST /upload`); `PATCH /users/me` |
| Order History | `pages/OrderHistory.jsx` | Paginated order list with search, status filter; detail modal; invoice print via InvoiceModal |
| Customer Settings | `pages/CustomerSettings.jsx` | Password change; notifications toggle; sign out + delete account (UI only) |
| Admin Profile Mgmt | `pages/AdminProfileManagement.jsx` | Admin user management |
| Owner Profile | `pages/OwnerProfile.jsx` | Owner profile page |
| User Profile View | `pages/UserProfileView.jsx` | Public user profile view |

### Components

| Component | File | Description |
|-----------|------|-------------|
| AIChatWidget | `components/AIChatWidget.jsx` | Floating chat button (bottom-right); opens drawer; role-aware chat via `POST /ai/chat`; typing indicator; message history in local state |
| InvoiceModal | `components/InvoiceModal.jsx` | Printable invoice modal; used in Order History and Owner Billing tab |
| DailySalesCalendar | `components/DailySalesCalendar.jsx` | Monthly calendar grid with per-day revenue markers; shown in Analytics tab |
| LanguageSelector | `components/LanguageSelector.jsx` | Globe icon dropdown: English / Hindi / Telugu; calls `setLanguage()` from AppContext |

---

## 15. Database Schema

```sql
-- Generated from SQLAlchemy models

CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    uid           VARCHAR(128) NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    display_name  VARCHAR(255) NOT NULL,
    photo_url     VARCHAR(1024),
    role          VARCHAR(8)  NOT NULL DEFAULT 'customer',  -- customer | owner | admin
    phone         VARCHAR(20),
    password_hash VARCHAR(256),
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login    DATETIME
);

CREATE TABLE shops (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    address       TEXT NOT NULL,
    category      VARCHAR(20) NOT NULL,   -- Grocery | Dairy | Vegetables & Fruits | ...
    location_name VARCHAR(20) NOT NULL,   -- Green Valley | Central Market | ...
    status        VARCHAR(10) NOT NULL DEFAULT 'pending',  -- pending | approved | suspended
    logo          VARCHAR(1024),
    timings       VARCHAR(100),
    lat           FLOAT,
    lng           FLOAT,
    rating        FLOAT NOT NULL DEFAULT 4.5,
    review_count  INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id     INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    price       FLOAT NOT NULL,
    mrp         FLOAT NOT NULL,
    unit        VARCHAR(50) NOT NULL,
    category    VARCHAR(20) NOT NULL,
    stock       INTEGER NOT NULL DEFAULT 0,
    image       VARCHAR(1024),
    status      VARCHAR(12) NOT NULL DEFAULT 'active',  -- active | out_of_stock
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id          INTEGER NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
    shop_name        VARCHAR(255) NOT NULL,
    customer_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total            FLOAT NOT NULL,
    status           VARCHAR(16) NOT NULL DEFAULT 'pending',
    payment_status   VARCHAR(8)  NOT NULL DEFAULT 'pending',  -- pending | paid
    delivery_address TEXT NOT NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME
);

CREATE TABLE order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    name       VARCHAR(255) NOT NULL,
    price      FLOAT NOT NULL,
    quantity   INTEGER NOT NULL
);

CREATE TABLE subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan_amount FLOAT NOT NULL DEFAULT 10.0,
    status      VARCHAR(8) NOT NULL DEFAULT 'pending',  -- pending | active | expired
    starts_at   DATETIME,
    expires_at  DATETIME,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 16. API Reference

### Auth

| Method | Endpoint | Auth | Request | Response |
|--------|----------|------|---------|----------|
| POST | `/auth/register` | None | `RegisterRequest` | `TokenOut` (201) |
| POST | `/auth/login` | None | `LoginRequest` | `TokenOut` |

### Users

| Method | Endpoint | Auth | Request | Response |
|--------|----------|------|---------|----------|
| GET | `/users/me` | Bearer | -- | `UserOut` |
| PATCH | `/users/me` | Bearer | `UserUpdate` | `UserOut` |
| GET | `/users` | Admin | -- | `UserOut[]` |
| PATCH | `/users/{id}/role` | Admin | `{role}` | `UserOut` |

### Subscriptions

| Method | Endpoint | Auth | Request | Response |
|--------|----------|------|---------|----------|
| GET | `/subscriptions/me` | Owner/Admin | -- | `SubscriptionOut` |
| POST | `/subscriptions/activate` | Owner/Admin | -- | `SubscriptionOut` |
| GET | `/subscriptions` | Admin | -- | `SubscriptionOut[]` |

### Shops

| Method | Endpoint | Auth | Request | Response |
|--------|----------|------|---------|----------|
| GET | `/shops` | Optional | `?location&category&status&search&page&size` | `PaginatedShops` |
| POST | `/shops` | Owner/Admin | `ShopCreate` | `ShopOut` (201) |
| GET | `/shops/{id}` | None | -- | `ShopOut` |
| PATCH | `/shops/{id}` | Owner/Admin | `ShopUpdate` | `ShopOut` |
| PATCH | `/shops/{id}/status` | Admin | `{status}` | `ShopOut` |
| DELETE | `/shops/{id}` | Admin | -- | 204 |
| GET | `/owners/me/shops` | Owner/Admin | -- | `ShopOut[]` |

### Products

| Method | Endpoint | Auth | Request | Response |
|--------|----------|------|---------|----------|
| GET | `/shops/{id}/products` | None | `?active_only` | `ProductOut[]` |
| POST | `/shops/{id}/products` | Owner | `ProductCreate` | `ProductOut` (201) |
| PATCH | `/shops/{id}/products/{pid}` | Owner | `ProductUpdate` | `ProductOut` |
| DELETE | `/shops/{id}/products/{pid}` | Owner | -- | 204 |

### Orders

| Method | Endpoint | Auth | Request | Response |
|--------|----------|------|---------|----------|
| POST | `/orders` | Customer | `OrderCreate` | `OrderOut` (201) |
| GET | `/orders/me` | Customer | `?page&size` | `PaginatedOrders` |
| GET | `/shops/{id}/orders` | Owner | `?page&size` | `PaginatedOrders` |
| PATCH | `/orders/{id}/status` | Owner/Admin | `{status}` | `OrderOut` |
| POST | `/shops/{id}/walkin-order` | Owner/Admin | `WalkinOrderCreate` | `OrderOut` (201) |

### Analytics

| Method | Endpoint | Auth | Response |
|--------|----------|------|----------|
| GET | `/analytics/platform` | Admin | `PlatformAnalytics` |
| GET | `/shops/{id}/analytics` | Owner | `ShopAnalytics` |

### File Upload

| Method | Endpoint | Auth | Request | Response |
|--------|----------|------|---------|----------|
| POST | `/upload` | None | `multipart/form-data` (file) | `{url: string}` |

### AI

| Method | Endpoint | Auth | Request | Response |
|--------|----------|------|---------|----------|
| GET | `/ai/status` | None | -- | `{available: bool}` |
| POST | `/ai/suggest-products` | None | `{category, partial_name}` | `string[]` |
| POST | `/ai/generate-description` | None | `{name, category}` | `{description}` |
| POST | `/ai/low-stock-insight` | None | `{shop_name, low_stock_items}` | `{insight}` |
| POST | `/ai/sales-forecast` | None | `{shop_id, days_back?}` | `{insight, forecast, avg_daily_revenue}` |
| POST | `/ai/chat` | None | `{message, role, shop_id?, history[]}` | `{reply, tools_used, sources}` |

---

## 17. Order Status Pipeline

```
  pending
    |
    +---> accepted ---> ready ---> out_for_delivery ---> delivered
    |
    +---> rejected
```

**Valid transitions (enforced by `OrderStatusUpdate.validate_transition`):**

| Current | Allowed Next |
|---------|-------------|
| pending | accepted, rejected |
| accepted | ready, rejected |
| ready | out_for_delivery |
| out_for_delivery | delivered |
| delivered | (terminal) |
| rejected | (terminal) |

**Walk-in orders** are created directly with `status=delivered`, `payment_status=paid`.

---

## 18. PRD --> Implementation Mapping

| PRD Section | Implementation |
|-------------|---------------|
| 4. Auth (JWT) | `main.py` -- register, login, create_access_token, decode_token, hash_password, verify_password |
| 5. Architecture | Single FastAPI app, ai.py router, SQLAlchemy ORM, SQLite |
| 6.1 Sign In | `App.jsx` -- SignIn component (Login + Register tabs) |
| 6.3 Marketplace | `pages/Marketplace.jsx` -- location/category filter, search, cart |
| 6.5 Owner Dashboard | `pages/OwnerDashboard.jsx` -- 6 tabs (Overview, Analytics, Billing, Inventory, Orders, Settings) |
| 6.6 Admin Panel | `pages/AdminPanel.jsx` -- Shops, Users, Analytics, Subscriptions tabs |
| 6.7 Customer Profile | `pages/CustomerProfile.jsx` -- edit profile + photo upload |
| 6.8 Order History | `pages/OrderHistory.jsx` -- paginated + search + invoice |
| 6.9 Customer Settings | `pages/CustomerSettings.jsx` -- password change |
| 7. AI Features | `ai.py` -- 6 endpoints (status, suggest, describe, low-stock, forecast, chat) |
| 8. Map | `OwnerDashboard.jsx` Settings tab -- Leaflet map picker |
| 9. Subscriptions | `main.py` -- /subscriptions/*, _check_subscription(), Subscription model |
| 10. Multi-language | `i18n.js`, `LanguageSelector.jsx`, `AppContext.jsx` language state |
| 11. Admin Panel | `pages/AdminPanel.jsx` |
| 12. Routing | `App.jsx` -- HashRouter, RequireAuth guard |

---

## 19. Production Checklist

| Item | Status | Notes |
|------|--------|-------|
| Change `JWT_SECRET` | Required | Set strong random secret in env |
| Set `GEMINI_API_KEY` | Required for AI | Google AI Studio key |
| Switch database | Required | SQLite -> PostgreSQL (change `DATABASE_URL`) |
| Enable HTTPS | Required | TLS termination at reverse proxy |
| Tighten CORS | Required | Replace `allow_origins=["*"]` with actual domain |
| Real payment gateway | Required | Replace mock `/subscriptions/activate` |
| Rate limiting | Recommended | Add slowapi or similar middleware |
| File upload size limit | Recommended | Currently no max size enforcement |
| Email verification | Recommended | Not implemented in v3.0 |
| Password reset flow | Recommended | Not implemented in v3.0 |
| Logging & monitoring | Recommended | Add structured logging, error tracking |
| Image CDN | Optional | Serve `/uploads/*` from CDN instead of static files |
| Redis sessions | Optional | For horizontal scaling |
| Test suite | Not started | pytest fixtures exist in requirements.txt |

---

*End of Implementation Reference -- HyperMart v3.0*
