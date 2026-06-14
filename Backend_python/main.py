"""
HyperMart — FastAPI Application
JWT auth, password hashing, subscription system, full CRUD.
"""

import os
import csv
import io
import uuid
import secrets
import pathlib
import base64
from datetime import datetime, date, timedelta
from typing import Optional, List
from collections import defaultdict

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, text, Date
from jose import JWTError, jwt
from passlib.context import CryptContext
import cloudinary
import cloudinary.uploader

from dotenv import load_dotenv
load_dotenv()  # Load .env before ai.py reads OPENAI_API_KEY

import models as M
import schemas as S
from database import get_db, create_tables
from ai import router as ai_router

# ─────────────────────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="HyperMart API",
    description="Hyperlocal marketplace — Python / SQLAlchemy / SQLite backend",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Cloudinary uploads & AI router ──────────────────────────────────────────────
app.include_router(ai_router)


MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "5"))

CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
CLOUDINARY_FOLDER = os.getenv("CLOUDINARY_FOLDER", "hypermart")
CLOUDINARY_CONFIGURED = False

if CLOUDINARY_URL:
    cloudinary.config(cloudinary_url=CLOUDINARY_URL, secure=True)
    CLOUDINARY_CONFIGURED = True
elif CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True,
    )
    CLOUDINARY_CONFIGURED = True


@app.on_event("startup")
def startup():
    create_tables()
    # Runtime migration — safe to run against existing DBs
    from database import engine
    with engine.connect() as conn:
        for stmt in [
            "ALTER TABLE products ADD COLUMN description TEXT",
            # Phase 1 migrations — new columns on existing tables
            "ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER DEFAULT 10",
            "ALTER TABLE products ADD COLUMN expiry_date DATETIME",
            "ALTER TABLE shops ADD COLUMN delivery_radius FLOAT",
            "ALTER TABLE shops ADD COLUMN pincode VARCHAR(10)",
            "ALTER TABLE shops ADD COLUMN city VARCHAR(100)",
            "ALTER TABLE shops ADD COLUMN state VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN multi_location_enabled INTEGER DEFAULT 0",
            "ALTER TABLE orders ADD COLUMN subtotal FLOAT",
            "ALTER TABLE orders ADD COLUMN item_discounts FLOAT DEFAULT 0",
            "ALTER TABLE orders ADD COLUMN bill_discount FLOAT DEFAULT 0",
            "ALTER TABLE orders ADD COLUMN total_discount FLOAT DEFAULT 0",
            "ALTER TABLE orders ADD COLUMN order_type VARCHAR(20) DEFAULT 'online'",
            # Payment integration migrations
            "ALTER TABLE orders ADD COLUMN payment_method VARCHAR(20) DEFAULT 'cash'",
            "ALTER TABLE orders ADD COLUMN razorpay_order_id VARCHAR(255)",
            "ALTER TABLE orders ADD COLUMN razorpay_payment_id VARCHAR(255)",
            "ALTER TABLE shops ADD COLUMN upi_id VARCHAR(255)",
            "ALTER TABLE orders ADD COLUMN accepted_at DATETIME",
            "ALTER TABLE orders ADD COLUMN out_for_delivery_at DATETIME",
            "ALTER TABLE orders ADD COLUMN delivered_at DATETIME",
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass  # Column already exists


# ─────────────────────────────────────────────────────────────────────────────
# Database helpers
# ─────────────────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./hypermart.db")
IS_POSTGRESQL = DATABASE_URL.startswith("postgresql")

def get_date_func(column):
    """Get database-agnostic date extraction function"""
    if IS_POSTGRESQL:
        return func.cast(column, Date)
    return func.date(column)

def get_yearmonth_func(column):
    """Get database-agnostic year-month extraction function"""
    if IS_POSTGRESQL:
        return func.to_char(column, 'YYYY-MM')
    return func.strftime("%Y-%m", column)

# ─────────────────────────────────────────────────────────────────────────────
# Security helpers
# ─────────────────────────────────────────────────────────────────────────────

SECRET_KEY    = os.getenv("JWT_SECRET", "hypermart-dev-secret-change-in-production")
ALGORITHM     = "HS256"
TOKEN_EXPIRY  = timedelta(days=30)
ADMIN_EMAIL   = "senamallas@gmail.com"
SUBSCRIPTION_AMOUNT = 10.0  # ₹10 per month

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


# ─────────────────────────────────────────────────────────────────────────────
# Auth dependencies
# ─────────────────────────────────────────────────────────────────────────────

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> M.User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    user = db.get(M.User, int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Always enforce admin role for admin email
    if user.email == ADMIN_EMAIL and user.role != M.UserRole.admin:
        user.role = M.UserRole.admin
        db.commit()
    return user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[M.User]:
    """Returns user if authenticated, None otherwise — used for public endpoints."""
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
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return _dep


def _check_subscription(user: M.User, db: Session) -> None:
    """Raise 402 if owner's subscription is not active."""
    if user.role != M.UserRole.owner:
        return
    sub = db.query(M.Subscription).filter(M.Subscription.user_id == user.id).first()
    if not sub or sub.status != M.SubscriptionStatus.active:
        raise HTTPException(
            status_code=402,
            detail="Active subscription required. Subscribe for ₹10/month to manage shops."
        )
    if sub.expires_at and sub.expires_at < datetime.utcnow():
        sub.status = M.SubscriptionStatus.expired
        db.commit()
        raise HTTPException(
            status_code=402,
            detail="Your subscription has expired. Please renew for ₹10/month."
        )


# ═══════════════════════════════════════════════════════════════════
# AUTH — register / login
# ═══════════════════════════════════════════════════════════════════

@app.post("/auth/register", response_model=S.TokenOut, status_code=201)
def register(payload: S.RegisterRequest, db: Session = Depends(get_db)):
    """Create a new account and return a JWT token."""
    if db.query(M.User).filter(M.User.email == str(payload.email)).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    role = M.UserRole.admin if str(payload.email) == ADMIN_EMAIL else payload.role
    user = M.User(
        uid=str(uuid.uuid4()),
        email=str(payload.email),
        display_name=payload.display_name,
        phone=payload.phone,
        role=role,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()

    # Owners get a free 1-month active subscription on registration
    if role == M.UserRole.owner:
        now = datetime.utcnow()
        db.add(M.Subscription(
            user_id=user.id,
            status=M.SubscriptionStatus.active,
            starts_at=now,
            expires_at=now + timedelta(days=30),
        ))

    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.post("/auth/login", response_model=S.TokenOut)
def login(payload: S.LoginRequest, db: Session = Depends(get_db)):
    """Verify email + password and return a JWT token."""
    user = db.query(M.User).filter(M.User.email == str(payload.email)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Admin override
    if user.email == ADMIN_EMAIL and user.role != M.UserRole.admin:
        user.role = M.UserRole.admin
    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": user}


# ═══════════════════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════════════════

@app.get("/users/me", response_model=S.UserOut)
def get_me(current_user: M.User = Depends(get_current_user)):
    return current_user


@app.patch("/users/me", response_model=S.UserOut)
def update_me(
    payload: S.UserUpdate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "role" and current_user.role != M.UserRole.admin:
            continue
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@app.post("/users/me/change-password")
def change_password(
    payload: S.ChangePasswordRequest,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password."""
    if not current_user.password_hash or not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"detail": "Password changed successfully"}


@app.get("/users", response_model=List[S.UserOut])
def list_users(
    _: M.User = Depends(require_role(M.UserRole.admin)),
    db: Session = Depends(get_db),
):
    return db.query(M.User).order_by(M.User.created_at.desc()).all()


@app.patch("/users/{user_id}/role", response_model=S.UserOut)
def change_user_role(
    user_id: int,
    payload: S.UserUpdate,
    _: M.User = Depends(require_role(M.UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.get(M.User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if payload.role:
        user.role = payload.role
    db.commit()
    db.refresh(user)
    return user


@app.delete("/users/me", status_code=204)
def delete_my_account(
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete the current user's account and all associated data."""
    if current_user.role == M.UserRole.admin:
        raise HTTPException(400, "Admin accounts cannot be self-deleted")
    db.delete(current_user)
    db.commit()


@app.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    _: M.User = Depends(require_role(M.UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Admin: delete any user by ID."""
    user = db.get(M.User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    db.delete(user)
    db.commit()


# ═══════════════════════════════════════════════════════════════════
# SUBSCRIPTIONS
# ═══════════════════════════════════════════════════════════════════

@app.get("/subscriptions/me", response_model=S.SubscriptionOut)
def get_my_subscription(
    current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
    db: Session = Depends(get_db),
):
    sub = db.query(M.Subscription).filter(M.Subscription.user_id == current_user.id).first()
    if not sub:
        raise HTTPException(404, "No subscription found")
    # Auto-expire if past expiry
    if sub.expires_at and sub.expires_at < datetime.utcnow() and sub.status == M.SubscriptionStatus.active:
        sub.status = M.SubscriptionStatus.expired
        db.commit()
        db.refresh(sub)
    return sub


@app.post("/subscriptions/activate", response_model=S.SubscriptionOut)
def activate_subscription(
    current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
    db: Session = Depends(get_db),
):
    """
    Mock payment: activates or renews the owner subscription for 30 days (₹10).
    In production, integrate a real payment gateway before calling this.
    """
    sub = db.query(M.Subscription).filter(M.Subscription.user_id == current_user.id).first()
    now = datetime.utcnow()
    if sub:
        # Renew: extend from now (or existing expiry if still active)
        base = sub.expires_at if (sub.expires_at and sub.expires_at > now) else now
        sub.starts_at   = now
        sub.expires_at  = base + timedelta(days=30)
        sub.status      = M.SubscriptionStatus.active
        sub.plan_amount = SUBSCRIPTION_AMOUNT
    else:
        sub = M.Subscription(
            user_id=current_user.id,
            plan_amount=SUBSCRIPTION_AMOUNT,
            status=M.SubscriptionStatus.active,
            starts_at=now,
            expires_at=now + timedelta(days=30),
        )
        db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@app.get("/subscriptions", response_model=List[S.SubscriptionOut])
def list_subscriptions(
    _: M.User = Depends(require_role(M.UserRole.admin)),
    db: Session = Depends(get_db),
):
    return db.query(M.Subscription).order_by(M.Subscription.created_at.desc()).all()


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
    size:     int = Query(20, ge=1, le=500),
    current_user: Optional[M.User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    q = db.query(M.Shop)
    is_admin = current_user and current_user.role == M.UserRole.admin
    if is_admin and status:
        q = q.filter(M.Shop.status == status)
    elif not is_admin:
        q = q.filter(M.Shop.status == M.ShopStatus.approved)
    if location:
        q = q.filter(M.Shop.location_name == location)
    if category:
        q = q.filter(M.Shop.category == category)
    if search:
        like = f"%{search}%"
        from sqlalchemy import cast, String as SAString
        q = q.filter(M.Shop.name.ilike(like) | cast(M.Shop.category, SAString).ilike(like))
    total = q.count()
    items = q.order_by(M.Shop.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}


@app.get("/shops/nearby", response_model=List[S.ShopOut])
def nearby_shops(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius: float = Query(2.0, ge=0.1, le=50, description="Radius in km"),
    db: Session = Depends(get_db),
):
    """Return approved shops within a given radius (km) of a point.
    Uses a simple bounding-box filter + Haversine approximation for SQLite."""
    # ~1 degree latitude ≈ 111 km
    delta_lat = radius / 111.0
    delta_lng = radius / (111.0 * max(abs(float(lat)) * 0.0175, 0.01))  # rough cos(lat) correction
    shops = (
        db.query(M.Shop)
        .filter(
            M.Shop.status == M.ShopStatus.approved,
            M.Shop.lat.isnot(None),
            M.Shop.lng.isnot(None),
            M.Shop.lat.between(lat - delta_lat, lat + delta_lat),
            M.Shop.lng.between(lng - delta_lng, lng + delta_lng),
        )
        .all()
    )
    return shops


@app.post("/shops", response_model=S.ShopOut, status_code=201)
def create_shop(
    payload: S.ShopCreate,
    current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
    db: Session = Depends(get_db),
):
    if current_user.role == M.UserRole.owner:
        _check_subscription(current_user, db)
    shop = M.Shop(owner_id=current_user.id, **payload.model_dump())
    db.add(shop)
    db.commit()
    db.refresh(shop)
    return shop


@app.get("/shops/{shop_id}", response_model=S.ShopOut)
def get_shop(shop_id: int, db: Session = Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    return shop


@app.patch("/shops/{shop_id}", response_model=S.ShopOut)
def update_shop(
    shop_id: int,
    payload: S.ShopUpdate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
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
    shop_id: int,
    payload: S.ShopStatusUpdate,
    _: M.User = Depends(require_role(M.UserRole.admin)),
    db: Session = Depends(get_db),
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
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    db.delete(shop)
    db.commit()


@app.get("/owners/me/shops", response_model=List[S.ShopOut])
def get_my_shops(
    current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
    db: Session = Depends(get_db),
):
    return db.query(M.Shop).filter(M.Shop.owner_id == current_user.id).all()


# ═══════════════════════════════════════════════════════════════════
# PRODUCTS
# ═══════════════════════════════════════════════════════════════════

@app.get("/shops/{shop_id}/products", response_model=List[S.ProductOut])
def list_products(
    shop_id: int,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    q = db.query(M.Product).filter(M.Product.shop_id == shop_id)
    if active_only:
        q = q.filter(M.Product.status == M.ProductStatus.active)
    return q.order_by(M.Product.name).all()


@app.post("/shops/{shop_id}/products", response_model=S.ProductOut, status_code=201)
def create_product(
    shop_id: int,
    payload: S.ProductCreate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
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


@app.patch("/shops/{shop_id}/products/bulk-update")
def bulk_update_products(
    shop_id: int,
    payload: S.BulkStockAdjustment,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    updated = 0
    for item in payload.items:
        product = db.query(M.Product).filter(
            M.Product.id == item.product_id, M.Product.shop_id == shop_id
        ).first()
        if not product:
            continue
        if item.stock is not None:
            product.stock = item.stock
        if item.low_stock_threshold is not None:
            product.low_stock_threshold = item.low_stock_threshold
        if item.expiry_date is not None:
            if item.expiry_date == "":
                product.expiry_date = None
            else:
                try:
                    product.expiry_date = datetime.fromisoformat(item.expiry_date)
                except (ValueError, TypeError):
                    pass
        updated += 1
    db.commit()
    return {"updated": updated}


@app.patch("/shops/{shop_id}/products/{product_id}", response_model=S.ProductOut)
def update_product(
    shop_id: int,
    product_id: int,
    payload: S.ProductUpdate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
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
    shop_id: int,
    product_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = _get_product_or_404(db, shop_id, product_id)
    _assert_shop_ownership(product.shop, current_user)
    active_order_count = (
        db.query(M.OrderItem)
        .join(M.Order)
        .filter(
            M.OrderItem.product_id == product_id,
            M.Order.status.notin_([M.OrderStatus.delivered, M.OrderStatus.rejected]),
        )
        .count()
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
    db: Session = Depends(get_db),
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
        order_items.append(
            M.OrderItem(
                product_id=product.id,
                name=product.name,
                price=product.price,
                quantity=item_in.quantity,
            )
        )
        total += product.price * item_in.quantity
        product.stock -= item_in.quantity
    final_total = round(total - (payload.total_discount or 0), 2) if payload.total_discount else round(total, 2)
    pm = payload.payment_method.value if payload.payment_method else "cash"
    order = M.Order(
        shop_id=shop.id,
        shop_name=shop.name,
        customer_id=current_user.id,
        items=order_items,
        total=max(final_total, 0),
        subtotal=round(total, 2),
        item_discounts=payload.item_discounts or 0,
        bill_discount=payload.bill_discount or 0,
        total_discount=payload.total_discount or 0,
        order_type="online",
        payment_method=pm,
        payment_status=M.PaymentStatus.paid if pm == "cash" else M.PaymentStatus.pending,
        delivery_address=payload.delivery_address,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order



# ═══════════════════════════════════════════════════════════════════
# PUBLIC PAYMENT PAGE (for customer QR scan → auto-confirm)
# ═══════════════════════════════════════════════════════════════════

@app.get("/pay/{order_id}", response_class=HTMLResponse)
def payment_page(order_id: int, db: Session = Depends(get_db)):
    """Public payment page — customer scans QR, opens this, pays via UPI, confirms."""
    order = db.get(M.Order, order_id)
    if not order:
        return HTMLResponse("<html><body style='font-family:sans-serif;text-align:center;padding:60px'><h2>Order not found</h2></body></html>", 404)
    shop = db.get(M.Shop, order.shop_id)
    shop_name = shop.name if shop else "Shop"
    upi_id = shop.upi_id if shop else ""
    amount = order.total
    already_paid = order.payment_status == "paid"

    pa = upi_id.replace(" ", "")
    pn = shop_name.replace("&", "&amp;").replace('"', "&quot;")
    tn = f"Order {order_id}"
    upi_url = f"upi://pay?pa={pa}&pn={pn}&am={amount:.2f}&cu=INR&tn={tn}"

    html = f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pay ₹{amount:.2f} — {pn}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}}
.card{{background:#fff;border-radius:24px;padding:32px 28px;max-width:380px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.1)}}
.emoji{{font-size:40px;margin-bottom:12px}}
.shop{{color:#888;font-size:14px;font-weight:500}}
.amt{{font-size:52px;font-weight:800;color:#5A5A40;margin:12px 0 4px;letter-spacing:-1px}}
.orderid{{color:#aaa;font-size:13px;margin-bottom:20px}}
.pay-btn{{display:block;width:100%;padding:18px;background:#5A5A40;color:#fff;border:none;border-radius:16px;font-size:18px;font-weight:700;cursor:pointer;text-decoration:none;transition:transform .15s}}
.pay-btn:active{{transform:scale(.97)}}
.apps{{display:flex;gap:8px;justify-content:center;margin:16px 0}}
.apps span{{font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px}}
.pp{{background:#5f259f20;color:#5f259f}}.gp{{background:#13733320;color:#137333}}.pt{{background:#00BAF220;color:#00BAF2}}.any{{background:#0001;color:#999}}
.confirm-btn{{display:none;width:100%;padding:18px;background:#16a34a;color:#fff;border:none;border-radius:16px;font-size:18px;font-weight:700;cursor:pointer;margin-top:16px;animation:fadeIn .3s}}
.confirm-btn.show{{display:block}}
.hint{{color:#bbb;font-size:12px;margin-top:12px}}
.divider{{height:1px;background:#eee;margin:20px 0}}
.success-card{{animation:scaleIn .4s}}
.success-icon{{width:88px;height:88px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:48px}}
.success-amt{{font-size:44px;font-weight:800;color:#16a34a;margin:8px 0}}
.success-text{{color:#16a34a;font-size:20px;font-weight:700;margin-bottom:8px}}
.success-sub{{color:#888;font-size:13px}}
.already{{color:#16a34a;font-weight:600}}
@keyframes fadeIn{{from{{opacity:0;transform:translateY(8px)}}to{{opacity:1;transform:translateY(0)}}}}
@keyframes scaleIn{{from{{opacity:0;transform:scale(.9)}}to{{opacity:1;transform:scale(1)}}}}
.spinner{{display:none;width:24px;height:24px;border:3px solid #fff4;border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;margin:0 auto}}
.spinner.show{{display:block}}
@keyframes spin{{to{{transform:rotate(360deg)}}}}
</style></head>
<body>
<div class="card">
  <div id="payView" style="display:{'none' if already_paid else 'block'}">
    <div class="emoji">🛒</div>
    <p class="shop">{pn}</p>
    <p class="amt">₹{amount:.2f}</p>
    <p class="orderid">Order #{order_id}</p>
    <a href="{upi_url}" class="pay-btn" id="payBtn" onclick="onPayClick()">Pay with UPI</a>
    <div class="apps">
      <span class="pp">PhonePe</span><span class="gp">GPay</span><span class="pt">Paytm</span><span class="any">Any UPI</span>
    </div>
    <div class="divider"></div>
    <button class="confirm-btn" id="confirmBtn" onclick="confirmPay()">✓ Done — I've completed the payment</button>
    <div class="spinner" id="spinner"></div>
    <p class="hint" id="confirmHint" style="display:none">Tap above after you finish paying in your UPI app</p>
  </div>
  <div id="successView" style="display:{'block' if already_paid else 'none'}" class="success-card">
    <div class="success-icon">✅</div>
    <p class="success-text">Payment Successful!</p>
    <p class="success-amt">₹{amount:.2f}</p>
    <p class="success-sub">Order #{order_id} · {pn}</p>
    <p class="hint" style="margin-top:16px">You can close this page</p>
  </div>
</div>
<script>
let payClicked=false;
function onPayClick(){{
  payClicked=true;
  setTimeout(()=>{{
    document.getElementById('confirmBtn').classList.add('show');
    document.getElementById('confirmHint').style.display='block';
  }},2000);
}}
document.addEventListener('visibilitychange',()=>{{
  if(payClicked&&document.visibilityState==='visible'){{
    document.getElementById('confirmBtn').classList.add('show');
    document.getElementById('confirmHint').style.display='block';
  }}
}});
async function confirmPay(){{
  const btn=document.getElementById('confirmBtn');
  const sp=document.getElementById('spinner');
  btn.style.display='none'; sp.classList.add('show');
  try{{
    const r=await fetch('/pay/{order_id}/confirm',{{method:'POST',headers:{{'Content-Type':'application/json'}}}});
    if(r.ok){{
      document.getElementById('payView').style.display='none';
      document.getElementById('successView').style.display='block';
    }} else {{
      btn.style.display='block'; sp.classList.remove('show');
      alert('Something went wrong. Please try again.');
    }}
  }}catch(e){{
    btn.style.display='block'; sp.classList.remove('show');
    alert('Network error. Please try again.');
  }}
}}
</script>
</body></html>"""
    return HTMLResponse(html)


@app.post("/pay/{order_id}/confirm")
def confirm_payment_public(order_id: int, db: Session = Depends(get_db)):
    """Public endpoint — customer confirms they've paid via UPI."""
    order = db.get(M.Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if order.payment_status != "paid":
        order.payment_status = "paid"
        db.commit()
    return {"status": "ok", "order_id": order.id, "payment_status": "paid"}


@app.get("/orders/{order_id}/payment-status")
def get_order_payment_status(
    order_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check payment status of an order (for UPI polling)."""
    order = db.get(M.Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if order.customer_id != current_user.id:
        shop = db.get(M.Shop, order.shop_id)
        if not shop or shop.owner_id != current_user.id:
            raise HTTPException(403, "Not your order")
    return {"order_id": order.id, "payment_status": order.payment_status, "payment_method": order.payment_method}


@app.patch("/orders/{order_id}/payment-status")
def update_order_payment_status(
    order_id: int,
    payload: dict,
    current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Owner marks order payment as received."""
    order = db.get(M.Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    shop = db.get(M.Shop, order.shop_id)
    if not shop or (current_user.role == M.UserRole.owner and shop.owner_id != current_user.id):
        raise HTTPException(403, "Not authorised")
    new_status = payload.get("payment_status", "paid")
    order.payment_status = new_status
    db.commit()
    return {"order_id": order.id, "payment_status": order.payment_status}


@app.get("/orders/me", response_model=S.PaginatedOrders)
def get_my_orders(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: M.User = Depends(require_role(M.UserRole.customer)),
    db: Session = Depends(get_db),
):
    q = db.query(M.Order).filter(M.Order.customer_id == current_user.id)
    total = q.count()
    items = q.order_by(M.Order.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}


@app.get("/shops/{shop_id}/orders", response_model=S.PaginatedOrders)
def list_shop_orders(
    shop_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    order_type: Optional[str] = None,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    q = db.query(M.Order).filter(M.Order.shop_id == shop_id)
    if date_from:
        q = q.filter(func.date(M.Order.created_at) >= date_from)
    if date_to:
        q = q.filter(func.date(M.Order.created_at) <= date_to)
    if order_type and order_type != "all":
        q = q.filter(M.Order.order_type == order_type)
    total = q.count()
    items = q.order_by(M.Order.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}


@app.patch("/orders/{order_id}/status", response_model=S.OrderOut)
def update_order_status(
    order_id: int,
    payload: S.OrderStatusUpdate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
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
    now = datetime.utcnow()
    order.status = payload.status
    order.updated_at = now
    if payload.status == M.OrderStatus.accepted:
        order.accepted_at = now
    elif payload.status == M.OrderStatus.out_for_delivery:
        order.out_for_delivery_at = now
    elif payload.status == M.OrderStatus.delivered:
        order.delivered_at = now
    db.commit()
    db.refresh(order)
    return order


# ═══════════════════════════════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════════════════════════════

@app.get("/analytics/platform", response_model=S.PlatformAnalytics)
def platform_analytics(
    _: M.User = Depends(require_role(M.UserRole.admin)),
    db: Session = Depends(get_db),
):
    delivered_rev = (
        db.query(func.sum(M.Order.total))
        .filter(M.Order.status == M.OrderStatus.delivered)
        .scalar()
        or 0.0
    )
    total_rev = db.query(func.sum(M.Order.total)).scalar() or 0.0
    active_subs = db.query(M.Subscription).filter(M.Subscription.status == M.SubscriptionStatus.active).count()

    # Orders by status
    status_rows = db.query(M.Order.status, func.count(M.Order.id)).group_by(M.Order.status).all()
    orders_by_status = {
        str(s.value if hasattr(s, "value") else s): cnt
        for s, cnt in status_rows
    }

    # Shops by category
    cat_rows = db.query(M.Shop.category, func.count(M.Shop.id)).group_by(M.Shop.category).all()
    shops_by_category = {
        str(c.value if hasattr(c, "value") else c): cnt
        for c, cnt in cat_rows
    }

    # Top shops by revenue
    top_rows = (
        db.query(
            M.Order.shop_id,
            M.Order.shop_name,
            func.sum(M.Order.total).label("revenue"),
            func.count(M.Order.id).label("order_count"),
        )
        .filter(M.Order.status == M.OrderStatus.delivered)
        .group_by(M.Order.shop_id, M.Order.shop_name)
        .order_by(func.sum(M.Order.total).desc())
        .limit(10)
        .all()
    )
    top_shops = [
        {"shop_id": r.shop_id, "shop_name": r.shop_name,
         "revenue": round(float(r.revenue), 2), "order_count": r.order_count}
        for r in top_rows
    ]

    return {
        "total_shops":       db.query(M.Shop).count(),
        "approved_shops":    db.query(M.Shop).filter(M.Shop.status == M.ShopStatus.approved).count(),
        "pending_shops":     db.query(M.Shop).filter(M.Shop.status == M.ShopStatus.pending).count(),
        "total_users":       db.query(M.User).count(),
        "total_owners":      db.query(M.User).filter(M.User.role == M.UserRole.owner).count(),
        "total_orders":      db.query(M.Order).count(),
        "total_revenue":     round(total_rev, 2),
        "delivered_revenue": round(delivered_rev, 2),
        "active_subscriptions": active_subs,
        "orders_by_status":  orders_by_status,
        "shops_by_category": shops_by_category,
        "top_shops":         top_shops,
    }


@app.get("/shops/{shop_id}/analytics", response_model=S.ShopAnalytics)
def shop_analytics(
    shop_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)

    today_start    = datetime.combine(date.today(), datetime.min.time())
    seven_days_ago = (date.today() - timedelta(days=6)).isoformat()
    six_months_ago = datetime.utcnow() - timedelta(days=180)

    # Today's orders
    today_orders = (
        db.query(M.Order)
        .filter(and_(M.Order.shop_id == shop_id, M.Order.created_at >= today_start))
        .all()
    )
    # Low stock (≤ 5 units)
    low_stock = (
        db.query(M.Product.name, M.Product.stock)
        .filter(
            M.Product.shop_id == shop_id,
            M.Product.stock <= 5,
            M.Product.status == M.ProductStatus.active,
        )
        .all()
    )
    # Daily sales — last 7 days (gaps filled with 0)
    daily_rows = (
        db.query(
            get_date_func(M.Order.created_at).label("day"),
            func.sum(M.Order.total).label("revenue"),
        )
        .filter(
            M.Order.shop_id == shop_id,
            get_date_func(M.Order.created_at) >= seven_days_ago,
        )
        .group_by(get_date_func(M.Order.created_at)).order_by("day").all()
    )
    day_map = {r.day: round(float(r.revenue), 2) for r in daily_rows}
    daily_sales = [
        {
            "day": (date.today() - timedelta(days=i)).strftime("%a"),
            "revenue": day_map.get((date.today() - timedelta(days=i)).isoformat(), 0.0),
        }
        for i in range(6, -1, -1)
    ]
    # Category revenue (delivered orders)
    cat_rows = (
        db.query(
            M.Product.category.label("category"),
            func.sum(M.OrderItem.price * M.OrderItem.quantity).label("revenue"),
        )
        .join(M.OrderItem, M.OrderItem.product_id == M.Product.id)
        .join(M.Order, M.OrderItem.order_id == M.Order.id)
        .filter(
            M.Order.shop_id == shop_id,
            M.Order.status == M.OrderStatus.delivered,
        )
        .group_by(M.Product.category)
        .order_by(func.sum(M.OrderItem.price * M.OrderItem.quantity).desc())
        .all()
    )
    category_revenue = [
        {"category": str(r.category.value if hasattr(r.category, "value") else r.category),
         "revenue": round(float(r.revenue), 2)}
        for r in cat_rows
    ]
    # Top 10 products by quantity sold
    top_rows = (
        db.query(
            M.OrderItem.product_id,
            M.OrderItem.name,
            func.sum(M.OrderItem.quantity).label("quantity_sold"),
            func.sum(M.OrderItem.price * M.OrderItem.quantity).label("revenue"),
        )
        .join(M.Order, M.OrderItem.order_id == M.Order.id)
        .filter(M.Order.shop_id == shop_id)
        .group_by(M.OrderItem.product_id, M.OrderItem.name)
        .order_by(func.sum(M.OrderItem.quantity).desc())
        .limit(10).all()
    )
    top_products = [
        {"product_id": r.product_id, "name": r.name,
         "quantity_sold": int(r.quantity_sold), "revenue": round(float(r.revenue), 2)}
        for r in top_rows
    ]
    # Monthly revenue — last 6 months
    MONTH_ABBR = {
        "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
        "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
        "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
    }
    monthly_rows = (
        db.query(
            get_yearmonth_func(M.Order.created_at).label("ym"),
            func.sum(M.Order.total).label("revenue"),
        )
        .filter(
            M.Order.shop_id == shop_id,
            M.Order.created_at >= six_months_ago,
        )
        .group_by(get_yearmonth_func(M.Order.created_at))
        .order_by(get_yearmonth_func(M.Order.created_at))
        .all()
    )
    monthly_revenue = [
        {"month": MONTH_ABBR.get(r.ym.split("-")[1], r.ym) if r.ym else "N/A",
         "revenue": round(float(r.revenue), 2)}
        for r in monthly_rows
    ]
    # Orders by status
    status_rows = (
        db.query(M.Order.status, func.count(M.Order.id))
        .filter(M.Order.shop_id == shop_id)
        .group_by(M.Order.status).all()
    )
    orders_by_status = {
        str(s.value if hasattr(s, "value") else s): cnt
        for s, cnt in status_rows
    }

    # Monthly daily sales — every day of the current month, split by walk-in / online
    month_start = date.today().replace(day=1).isoformat()
    month_end   = date.today().isoformat()
    mds_rows = (
        db.query(
            get_date_func(M.Order.created_at).label("day"),
            M.Order.order_type,
            func.sum(M.Order.total).label("revenue"),
            func.count(M.Order.id).label("cnt"),
        )
        .filter(
            M.Order.shop_id == shop_id,
            get_date_func(M.Order.created_at) >= month_start,
            get_date_func(M.Order.created_at) <= month_end,
        )
        .group_by(get_date_func(M.Order.created_at), M.Order.order_type)
        .all()
    )
    mds_map = {}  # date_str -> {revenue, walk_in, online, orders}
    for r in mds_rows:
        d = r.day
        if d not in mds_map:
            mds_map[d] = {"date": d, "revenue": 0.0, "walk_in": 0.0, "online": 0.0, "orders": 0}
        rev = round(float(r.revenue or 0), 2)
        cnt = int(r.cnt or 0)
        mds_map[d]["revenue"] += rev
        mds_map[d]["orders"]  += cnt
        otype = r.order_type or "online"
        if otype == "walkin":
            mds_map[d]["walk_in"] += rev
        else:
            mds_map[d]["online"] += rev

    # Fill in every day of the current month up to today
    monthly_daily_sales = []
    cur = date.today().replace(day=1)
    while cur <= date.today():
        d_str = cur.isoformat()
        if d_str in mds_map:
            monthly_daily_sales.append(mds_map[d_str])
        else:
            monthly_daily_sales.append({"date": d_str, "revenue": 0.0, "walk_in": 0.0, "online": 0.0, "orders": 0})
        cur += timedelta(days=1)

    return {
        "today_sales":         round(sum(o.total for o in today_orders), 2),
        "today_orders":        len(today_orders),
        "total_products":      db.query(M.Product).filter(M.Product.shop_id == shop_id).count(),
        "low_stock_items":     [{"name": r.name, "stock": r.stock} for r in low_stock],
        "daily_sales":         daily_sales,
        "category_revenue":    category_revenue,
        "top_products":        top_products,
        "monthly_revenue":     monthly_revenue,
        "orders_by_status":    orders_by_status,
        "monthly_daily_sales": monthly_daily_sales,
    }


# ═══════════════════════════════════════════════════════════════════
# FILE UPLOAD
# ═══════════════════════════════════════════════════════════════════

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not CLOUDINARY_CONFIGURED:
        raise HTTPException(500, "Cloudinary is not configured on server")

    ext = pathlib.Path(file.filename or "image.bin").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        raise HTTPException(400, "Only image files are allowed (jpg, png, gif, webp)")

    # Read file and enforce size limit
    contents = await file.read()
    max_bytes = MAX_UPLOAD_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(413, f"File too large. Maximum size is {MAX_UPLOAD_MB}MB")

    mime_type = file.content_type or "application/octet-stream"
    data_uri = f"data:{mime_type};base64,{base64.b64encode(contents).decode('utf-8')}"

    try:
        uploaded = cloudinary.uploader.upload(
            data_uri,
            folder=CLOUDINARY_FOLDER,
            public_id=str(uuid.uuid4()),
            overwrite=False,
            resource_type="image",
        )
    except Exception as exc:
        raise HTTPException(500, f"Cloudinary upload failed: {exc}")

    return {"url": uploaded.get("secure_url")}


# ═══════════════════════════════════════════════════════════════════
# WALK-IN ORDER  (In-Store POS — placed by owner on behalf of customer)
# ═══════════════════════════════════════════════════════════════════

@app.post("/shops/{shop_id}/walkin-order", response_model=S.OrderOut, status_code=201)
def walkin_order(
    shop_id: int,
    payload: S.WalkinOrderCreate,
    current_user: M.User = Depends(require_role(M.UserRole.owner, M.UserRole.admin)),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    if current_user.role == M.UserRole.owner and shop.owner_id != current_user.id:
        raise HTTPException(403, "Not authorised for this shop")
    order_items, total = [], 0.0
    for item_in in payload.items:
        product = db.get(M.Product, item_in.product_id)
        if not product or product.shop_id != shop_id:
            raise HTTPException(422, f"Product {item_in.product_id} not found in this shop")
        if product.stock < item_in.quantity:
            raise HTTPException(422, f"Insufficient stock for '{product.name}'")
        order_items.append(M.OrderItem(
            product_id=product.id, name=product.name,
            price=product.price,   quantity=item_in.quantity,
        ))
        total += product.price * item_in.quantity
        product.stock -= item_in.quantity
    final_total = round(total - (payload.total_discount or 0), 2) if payload.total_discount else round(total, 2)
    pm = payload.payment_method.value if payload.payment_method else "cash"
    ps = payload.payment_status.value if payload.payment_status else "paid"
    order = M.Order(
        shop_id=shop.id,       shop_name=shop.name,
        customer_id=current_user.id,
        items=order_items,     total=max(final_total, 0),
        subtotal=round(total, 2),
        item_discounts=payload.item_discounts or 0,
        bill_discount=payload.bill_discount or 0,
        total_discount=payload.total_discount or 0,
        order_type="walkin",
        status=M.OrderStatus.delivered,
        payment_method=pm,
        payment_status=ps,
        delivery_address="In-Store (Walk-in)",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


# ═══════════════════════════════════════════════════════════════════
# REVIEWS
# ═══════════════════════════════════════════════════════════════════

@app.post("/shops/{shop_id}/reviews", response_model=S.ReviewOut, status_code=201)
def create_review(
    shop_id: int,
    payload: S.ReviewCreate,
    current_user: M.User = Depends(require_role(M.UserRole.customer)),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    existing = (
        db.query(M.Review)
        .filter(M.Review.shop_id == shop_id, M.Review.customer_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(400, "You have already reviewed this shop")
    review = M.Review(
        shop_id=shop_id,
        customer_id=current_user.id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    db.flush()
    # Update shop aggregate rating
    avg = db.query(func.avg(M.Review.rating)).filter(M.Review.shop_id == shop_id).scalar() or 0
    cnt = db.query(M.Review).filter(M.Review.shop_id == shop_id).count()
    shop.rating = round(float(avg), 1)
    shop.review_count = cnt
    db.commit()
    db.refresh(review)
    return {
        **{c.name: getattr(review, c.name) for c in review.__table__.columns},
        "customer_name": current_user.display_name,
    }


@app.get("/shops/{shop_id}/reviews", response_model=List[S.ReviewOut])
def list_reviews(shop_id: int, db: Session = Depends(get_db)):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    reviews = (
        db.query(M.Review)
        .filter(M.Review.shop_id == shop_id)
        .order_by(M.Review.created_at.desc())
        .all()
    )
    result = []
    for r in reviews:
        customer = db.get(M.User, r.customer_id)
        result.append({
            **{c.name: getattr(r, c.name) for c in r.__table__.columns},
            "customer_name": customer.display_name if customer else "Unknown",
        })
    return result


# ═══════════════════════════════════════════════════════════════════
# ORDER CANCELLATION
# ═══════════════════════════════════════════════════════════════════

@app.post("/orders/{order_id}/cancel", response_model=S.OrderOut)
def cancel_order(
    order_id: int,
    current_user: M.User = Depends(require_role(M.UserRole.customer)),
    db: Session = Depends(get_db),
):
    """Customer can cancel their own pending order."""
    order = db.get(M.Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if order.customer_id != current_user.id:
        raise HTTPException(403, "Not your order")
    if order.status != M.OrderStatus.pending:
        raise HTTPException(422, "Only pending orders can be cancelled")
    # Restore stock
    for item in order.items:
        product = db.get(M.Product, item.product_id)
        if product:
            product.stock += item.quantity
    order.status = M.OrderStatus.rejected
    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order


# ═══════════════════════════════════════════════════════════════════
# DATE-RANGE REPORTS + CSV EXPORT
# ═══════════════════════════════════════════════════════════════════

@app.get("/shops/{shop_id}/reports")
def shop_reports(
    shop_id: int,
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    if not date_from:
        date_from = date.today()
    if not date_to:
        date_to = date.today()

    orders = (
        db.query(M.Order)
        .filter(
            M.Order.shop_id == shop_id,
            M.Order.status == M.OrderStatus.delivered,
            func.date(M.Order.created_at) >= date_from.isoformat(),
            func.date(M.Order.created_at) <= date_to.isoformat(),
        )
        .all()
    )

    total_revenue = sum(o.total for o in orders)
    total_orders = len(orders)
    avg_order_value = round(total_revenue / total_orders, 2) if total_orders else 0

    # Calculate walk-in vs online breakdown
    walk_in_revenue = sum(o.total for o in orders if o.order_type == "walkin")
    online_revenue = sum(o.total for o in orders if o.order_type == "online")

    daily = defaultdict(float)
    category_rev = defaultdict(float)
    top_items = defaultdict(lambda: {"qty": 0, "revenue": 0.0})
    for o in orders:
        day = o.created_at.strftime("%Y-%m-%d")
        daily[day] += o.total
        for item in o.items:
            product = db.get(M.Product, item.product_id)
            cat = product.category.value if product else "Unknown"
            category_rev[cat] += item.price * item.quantity
            top_items[item.name]["qty"] += item.quantity
            top_items[item.name]["revenue"] += item.price * item.quantity

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "avg_order_value": avg_order_value,
        "walk_in_total": round(walk_in_revenue, 2),
        "online_total": round(online_revenue, 2),
        "daily_sales": [{"day": k, "revenue": round(v, 2)} for k, v in sorted(daily.items())],
        "category_revenue": [{"category": k, "revenue": round(v, 2)} for k, v in category_rev.items()],
        "top_products": sorted(
            [{"name": k, **v} for k, v in top_items.items()],
            key=lambda x: x["qty"], reverse=True
        )[:10],
    }


@app.get("/shops/{shop_id}/reports/csv")
def shop_reports_csv(
    shop_id: int,
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)

    orders = (
        db.query(M.Order)
        .filter(
            M.Order.shop_id == shop_id,
            M.Order.status == M.OrderStatus.delivered,
            func.date(M.Order.created_at) >= date_from.isoformat(),
            func.date(M.Order.created_at) <= date_to.isoformat(),
        )
        .all()
    )

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Order ID", "Date", "Items", "Total", "Payment Status"])
    for o in orders:
        items_str = " | ".join(f"{i.name} x{i.quantity}" for i in o.items)
        w.writerow([o.id, o.created_at.strftime("%d/%m/%Y"), items_str, o.total, o.payment_status.value])

    buf.seek(0)
    fname = f"hypermart-{shop_id}-{date_from}-{date_to}.csv"
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


# ═══════════════════════════════════════════════════════════════════
# PASSWORD RESET (dev: prints token to console)
# ═══════════════════════════════════════════════════════════════════

@app.post("/auth/forgot-password")
def forgot_password(payload: S.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(M.User).filter_by(email=str(payload.email)).first()
    if not user:
        return {"ok": True}  # Don't reveal if email exists
    token = secrets.token_urlsafe(32)
    db.add(M.PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=1),
    ))
    db.commit()
    # In dev, print to console. In prod, send email via SMTP/SendGrid.
    print(f"\n[PASSWORD RESET] Token for {user.email}: {token}\n")
    return {"ok": True}


@app.post("/auth/reset-password")
def reset_password(payload: S.ResetPasswordRequest, db: Session = Depends(get_db)):
    record = db.query(M.PasswordResetToken).filter_by(token=payload.token, used=0).first()
    if not record or record.expires_at < datetime.utcnow():
        raise HTTPException(400, "Invalid or expired reset token")
    user = db.get(M.User, record.user_id)
    if not user:
        raise HTTPException(400, "User not found")
    user.password_hash = hash_password(payload.new_password)
    record.used = 1
    db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════
# PRODUCT SEARCH (across all shops)
# ═══════════════════════════════════════════════════════════════════

@app.get("/products/search")
def search_products(
    q: str = Query(..., min_length=1),
    location: Optional[M.ShopLocation] = None,
    category: Optional[M.ShopCategory] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Search products across all approved shops."""
    query = (
        db.query(M.Product)
        .join(M.Shop, M.Product.shop_id == M.Shop.id)
        .filter(
            M.Shop.status == M.ShopStatus.approved,
            M.Product.status == M.ProductStatus.active,
            M.Product.name.ilike(f"%{q}%"),
        )
    )
    if location:
        query = query.filter(M.Shop.location_name == location)
    if category:
        query = query.filter(M.Product.category == category)
    total = query.count()
    products = query.order_by(M.Product.name).offset((page - 1) * size).limit(size).all()
    return {
        "items": [
            {
                "id": p.id, "shop_id": p.shop_id, "shop_name": p.shop.name,
                "name": p.name, "description": p.description,
                "price": p.price, "mrp": p.mrp, "unit": p.unit,
                "category": p.category.value, "stock": p.stock,
                "image": p.image, "status": p.status.value,
            }
            for p in products
        ],
        "total": total, "page": page, "size": size,
    }


# ═══════════════════════════════════════════════════════════════════
# SUPPLIERS
# ═══════════════════════════════════════════════════════════════════

@app.get("/shops/{shop_id}/suppliers", response_model=List[S.SupplierOut])
def list_suppliers(
    shop_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    return db.query(M.Supplier).filter(M.Supplier.shop_id == shop_id).order_by(M.Supplier.name).all()


@app.post("/shops/{shop_id}/suppliers", response_model=S.SupplierOut, status_code=201)
def create_supplier(
    shop_id: int,
    payload: S.SupplierCreate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    supplier = M.Supplier(shop_id=shop_id, **payload.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@app.patch("/shops/{shop_id}/suppliers/{supplier_id}", response_model=S.SupplierOut)
def update_supplier(
    shop_id: int, supplier_id: int,
    payload: S.SupplierUpdate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    supplier = db.query(M.Supplier).filter(M.Supplier.id == supplier_id, M.Supplier.shop_id == shop_id).first()
    if not supplier:
        raise HTTPException(404, "Supplier not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(supplier, field, value)
    db.commit()
    db.refresh(supplier)
    return supplier


@app.delete("/shops/{shop_id}/suppliers/{supplier_id}", status_code=204)
def delete_supplier(
    shop_id: int, supplier_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    supplier = db.query(M.Supplier).filter(M.Supplier.id == supplier_id, M.Supplier.shop_id == shop_id).first()
    if not supplier:
        raise HTTPException(404, "Supplier not found")
    db.delete(supplier)
    db.commit()


# ═══════════════════════════════════════════════════════════════════
# PURCHASE ORDERS
# ═══════════════════════════════════════════════════════════════════

@app.get("/shops/{shop_id}/purchase-orders", response_model=List[S.POOut])
def list_purchase_orders(
    shop_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    return (
        db.query(M.PurchaseOrder)
        .filter(M.PurchaseOrder.shop_id == shop_id)
        .order_by(M.PurchaseOrder.created_at.desc())
        .all()
    )


@app.post("/shops/{shop_id}/purchase-orders", response_model=S.POOut, status_code=201)
def create_purchase_order(
    shop_id: int,
    payload: S.POCreate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    supplier = db.query(M.Supplier).filter(M.Supplier.id == payload.supplier_id, M.Supplier.shop_id == shop_id).first()
    if not supplier:
        raise HTTPException(404, "Supplier not found")
    total = sum(item.price * item.quantity for item in payload.items)
    po = M.PurchaseOrder(
        shop_id=shop_id, supplier_id=payload.supplier_id,
        total_amount=round(total, 2), notes=payload.notes,
    )
    for item in payload.items:
        po.items.append(M.PurchaseOrderItem(
            product_id=item.product_id, name=item.name,
            price=item.price, quantity=item.quantity,
        ))
    db.add(po)
    db.commit()
    db.refresh(po)
    return po


@app.get("/shops/{shop_id}/purchase-orders/{po_id}", response_model=S.POOut)
def get_purchase_order(
    shop_id: int, po_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    po = db.query(M.PurchaseOrder).filter(M.PurchaseOrder.id == po_id, M.PurchaseOrder.shop_id == shop_id).first()
    if not po:
        raise HTTPException(404, "Purchase order not found")
    return po


@app.patch("/shops/{shop_id}/purchase-orders/{po_id}/status", response_model=S.POOut)
def update_po_status(
    shop_id: int, po_id: int,
    payload: S.POStatusUpdate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    po = db.query(M.PurchaseOrder).filter(M.PurchaseOrder.id == po_id, M.PurchaseOrder.shop_id == shop_id).first()
    if not po:
        raise HTTPException(404, "Purchase order not found")
    po.status = payload.status
    # Auto-increment stock when PO is received
    if payload.status == M.PurchaseOrderStatus.received:
        for po_item in po.items:
            product = db.get(M.Product, po_item.product_id)
            if product:
                product.stock += po_item.quantity
    db.commit()
    db.refresh(po)
    return po


# ═══════════════════════════════════════════════════════════════════
# PRODUCT DISCOUNTS
# ═══════════════════════════════════════════════════════════════════

@app.get("/shops/{shop_id}/product-discounts", response_model=List[S.ProductDiscountOut])
def list_product_discounts(
    shop_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    return (
        db.query(M.ProductDiscount)
        .filter(M.ProductDiscount.shop_id == shop_id)
        .order_by(M.ProductDiscount.created_at.desc())
        .all()
    )


@app.post("/shops/{shop_id}/product-discounts", response_model=S.ProductDiscountOut, status_code=201)
def create_product_discount(
    shop_id: int,
    payload: S.ProductDiscountCreate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    product = _get_product_or_404(db, shop_id, payload.product_id)
    discount = M.ProductDiscount(
        shop_id=shop_id,
        product_name=payload.product_name or product.name,
        **payload.model_dump(exclude={"product_name"}),
    )
    db.add(discount)
    db.commit()
    db.refresh(discount)
    return discount


@app.patch("/shops/{shop_id}/product-discounts/{discount_id}", response_model=S.ProductDiscountOut)
def update_product_discount(
    shop_id: int, discount_id: int,
    payload: S.ProductDiscountCreate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    discount = db.query(M.ProductDiscount).filter(
        M.ProductDiscount.id == discount_id, M.ProductDiscount.shop_id == shop_id
    ).first()
    if not discount:
        raise HTTPException(404, "Discount not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(discount, field, value)
    db.commit()
    db.refresh(discount)
    return discount


@app.delete("/shops/{shop_id}/product-discounts/{discount_id}", status_code=204)
def delete_product_discount(
    shop_id: int, discount_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    discount = db.query(M.ProductDiscount).filter(
        M.ProductDiscount.id == discount_id, M.ProductDiscount.shop_id == shop_id
    ).first()
    if not discount:
        raise HTTPException(404, "Discount not found")
    db.delete(discount)
    db.commit()


# ═══════════════════════════════════════════════════════════════════
# ORDER / BILL DISCOUNTS
# ═══════════════════════════════════════════════════════════════════

@app.get("/shops/{shop_id}/order-discounts", response_model=List[S.OrderDiscountOut])
def list_order_discounts(
    shop_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    return (
        db.query(M.OrderDiscount)
        .filter(M.OrderDiscount.shop_id == shop_id)
        .order_by(M.OrderDiscount.min_bill_value)
        .all()
    )


@app.post("/shops/{shop_id}/order-discounts", response_model=S.OrderDiscountOut, status_code=201)
def create_order_discount(
    shop_id: int,
    payload: S.OrderDiscountCreate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    discount = M.OrderDiscount(shop_id=shop_id, **payload.model_dump())
    db.add(discount)
    db.commit()
    db.refresh(discount)
    return discount


@app.patch("/shops/{shop_id}/order-discounts/{discount_id}", response_model=S.OrderDiscountOut)
def update_order_discount(
    shop_id: int, discount_id: int,
    payload: S.OrderDiscountCreate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    discount = db.query(M.OrderDiscount).filter(
        M.OrderDiscount.id == discount_id, M.OrderDiscount.shop_id == shop_id
    ).first()
    if not discount:
        raise HTTPException(404, "Discount not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(discount, field, value)
    db.commit()
    db.refresh(discount)
    return discount


@app.delete("/shops/{shop_id}/order-discounts/{discount_id}", status_code=204)
def delete_order_discount(
    shop_id: int, discount_id: int,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    discount = db.query(M.OrderDiscount).filter(
        M.OrderDiscount.id == discount_id, M.OrderDiscount.shop_id == shop_id
    ).first()
    if not discount:
        raise HTTPException(404, "Discount not found")
    db.delete(discount)
    db.commit()


# ═══════════════════════════════════════════════════════════════════
# COMBINED DISCOUNTS (public — for customer checkout)
# ═══════════════════════════════════════════════════════════════════

@app.get("/shops/{shop_id}/discounts")
def get_shop_discounts(shop_id: int, db: Session = Depends(get_db)):
    now = datetime.utcnow()
    product_discounts = (
        db.query(M.ProductDiscount)
        .filter(
            M.ProductDiscount.shop_id == shop_id,
            M.ProductDiscount.status == "active",
        )
        .all()
    )
    order_discounts = (
        db.query(M.OrderDiscount)
        .filter(
            M.OrderDiscount.shop_id == shop_id,
            M.OrderDiscount.status == "active",
        )
        .all()
    )
    # Filter expired
    pd_out = [S.ProductDiscountOut.model_validate(d) for d in product_discounts if not d.valid_till or d.valid_till > now]
    od_out = [S.OrderDiscountOut.model_validate(d) for d in order_discounts if not d.valid_till or d.valid_till > now]
    return {"product_discounts": pd_out, "order_discounts": od_out}


# ═══════════════════════════════════════════════════════════════════
# BULK STOCK ADJUSTMENT
# ═══════════════════════════════════════════════════════════════════



# ═══════════════════════════════════════════════════════════════════
# MULTI-LOCATION TOGGLE (admin only)
# ═══════════════════════════════════════════════════════════════════

@app.patch("/users/{user_id}/multi-location")
def toggle_multi_location(
    user_id: int,
    payload: S.MultiLocationUpdate,
    current_user: M.User = Depends(require_role(M.UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.get(M.User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.multi_location_enabled = payload.multi_location_enabled
    db.commit()
    db.refresh(user)
    return S.UserOut.model_validate(user)


# ═══════════════════════════════════════════════════════════════════
# PAYMENTS — Razorpay integration
# ═══════════════════════════════════════════════════════════════════


def _get_razorpay_keys():
    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    return key_id, key_secret


@app.post("/payments/create-order", response_model=S.RazorpayOrderOut)
def create_razorpay_order(
    payload: S.RazorpayOrderCreate,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Razorpay order for an existing HyperMart order."""
    key_id, key_secret = _get_razorpay_keys()
    if not key_id or not key_secret:
        raise HTTPException(503, "Razorpay is not configured on this server")

    order = db.get(M.Order, payload.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    # Allow owner for walk-in orders, customer for online orders
    if order.customer_id != current_user.id:
        # Check if current user is the shop owner (walk-in scenario)
        shop = db.get(M.Shop, order.shop_id)
        if not shop or shop.owner_id != current_user.id:
            raise HTTPException(403, "Not your order")
    if order.payment_status == M.PaymentStatus.paid:
        raise HTTPException(400, "Order is already paid")

    import razorpay
    client = razorpay.Client(auth=(key_id, key_secret))
    amount_paise = int(round(order.total * 100))
    rz_order = client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"order_{order.id}",
    })

    order.razorpay_order_id = rz_order["id"]
    order.payment_method = "razorpay"
    db.commit()

    return S.RazorpayOrderOut(
        razorpay_order_id=rz_order["id"],
        amount=amount_paise,
        currency="INR",
        key_id=key_id,
    )


@app.post("/payments/verify")
def verify_razorpay_payment(
    payload: S.RazorpayVerify,
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify Razorpay payment signature and mark order as paid."""
    _, key_secret = _get_razorpay_keys()
    if not key_secret:
        raise HTTPException(503, "Razorpay is not configured on this server")

    order = db.get(M.Order, payload.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    # Allow owner for walk-in orders, customer for online orders
    if order.customer_id != current_user.id:
        shop = db.get(M.Shop, order.shop_id)
        if not shop or shop.owner_id != current_user.id:
            raise HTTPException(403, "Not your order")

    import hmac, hashlib
    message = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
    expected = hmac.new(
        key_secret.encode(), message.encode(), hashlib.sha256
    ).hexdigest()

    if expected != payload.razorpay_signature:
        raise HTTPException(400, "Payment verification failed — invalid signature")

    order.razorpay_payment_id = payload.razorpay_payment_id
    order.payment_status = M.PaymentStatus.paid
    order.payment_method = "razorpay"
    db.commit()
    db.refresh(order)
    return {"status": "success", "order_id": order.id, "payment_status": "paid"}


@app.get("/shops/{shop_id}/upi")
def get_shop_upi(shop_id: int, db: Session = Depends(get_db)):
    """Public endpoint to get a shop's UPI ID for direct payment."""
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    return {"upi_id": shop.upi_id or "", "shop_name": shop.name}


# ── Private helpers ──────────────────────────────────────────────────────────

def _get_product_or_404(db, shop_id, product_id):
    p = (
        db.query(M.Product)
        .filter(M.Product.id == product_id, M.Product.shop_id == shop_id)
        .first()
    )
    if not p:
        raise HTTPException(404, "Product not found")
    return p


def _assert_shop_ownership(shop, user):
    if user.role == M.UserRole.admin:
        return
    if user.role == M.UserRole.owner and shop.owner_id == user.id:
        return
    raise HTTPException(403, "Not authorised for this shop")
