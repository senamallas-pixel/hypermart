"""
HyperMart — FastAPI Application
JWT auth, password hashing, subscription system, full CRUD.
"""

import os
import csv
import io
import uuid
import shutil
import secrets
import pathlib
from datetime import datetime, date, timedelta
from typing import Optional, List
from collections import defaultdict

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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

# ── Static uploads & AI router ──────────────────────────────────────────────────
UPLOAD_DIR = pathlib.Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.include_router(ai_router)


MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "5"))


@app.on_event("startup")
def startup():
    create_tables()
    # Runtime migration — safe to run against existing DBs
    from database import engine
    with engine.connect() as conn:
        for stmt in [
            "ALTER TABLE products ADD COLUMN description TEXT",
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass  # Column already exists


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

    # Owners get a pending subscription record automatically
    if role == M.UserRole.owner:
        db.add(M.Subscription(user_id=user.id))

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
        q = q.filter(M.Shop.name.ilike(like) | M.Shop.category.ilike(like))
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
    order = M.Order(
        shop_id=shop.id,
        shop_name=shop.name,
        customer_id=current_user.id,
        items=order_items,
        total=round(total, 2),
        delivery_address=payload.delivery_address,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


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
    current_user: M.User = Depends(get_current_user),
    db: Session = Depends(get_db),
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
            func.date(M.Order.created_at).label("day"),
            func.sum(M.Order.total).label("revenue"),
        )
        .filter(
            M.Order.shop_id == shop_id,
            func.date(M.Order.created_at) >= seven_days_ago,
        )
        .group_by("day").order_by("day").all()
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
            func.strftime("%Y-%m", M.Order.created_at).label("ym"),
            func.sum(M.Order.total).label("revenue"),
        )
        .filter(
            M.Order.shop_id == shop_id,
            M.Order.created_at >= six_months_ago,
        )
        .group_by(func.strftime("%Y-%m", M.Order.created_at))
        .order_by(func.strftime("%Y-%m", M.Order.created_at))
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

    return {
        "today_sales":      round(sum(o.total for o in today_orders), 2),
        "today_orders":     len(today_orders),
        "total_products":   db.query(M.Product).filter(M.Product.shop_id == shop_id).count(),
        "low_stock_items":  [{"name": r.name, "stock": r.stock} for r in low_stock],
        "daily_sales":      daily_sales,
        "category_revenue": category_revenue,
        "top_products":     top_products,
        "monthly_revenue":  monthly_revenue,
        "orders_by_status": orders_by_status,
    }


# ═══════════════════════════════════════════════════════════════════
# FILE UPLOAD
# ═══════════════════════════════════════════════════════════════════

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = pathlib.Path(file.filename or "image.bin").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        raise HTTPException(400, "Only image files are allowed (jpg, png, gif, webp)")
    # Read file and enforce size limit
    contents = await file.read()
    max_bytes = MAX_UPLOAD_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(413, f"File too large. Maximum size is {MAX_UPLOAD_MB}MB")
    filename = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_DIR / filename
    with dest.open("wb") as f:
        f.write(contents)
    return {"url": f"/uploads/{filename}"}


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
    order = M.Order(
        shop_id=shop.id,       shop_name=shop.name,
        customer_id=current_user.id,
        items=order_items,     total=round(total, 2),
        status=M.OrderStatus.delivered,
        payment_status=M.PaymentStatus.paid,
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
