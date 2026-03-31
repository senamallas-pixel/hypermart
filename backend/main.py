"""
HyperMart — FastAPI Application
Full CRUD API for the SQLite + SQLAlchemy backend.
"""

import uuid
from datetime import datetime, date
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, Query
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    create_tables()


# ── Auth helpers ──────────────────────────────────────────────────────────────

ADMIN_EMAIL = "senamallas@gmail.com"


def get_current_user(uid: str = Query(...), db: Session = Depends(get_db)) -> M.User:
    user = db.query(M.User).filter(M.User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
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
# AUTH
# ═══════════════════════════════════════════════════════════════════

@app.post("/auth/login", response_model=S.UserOut)
def login(payload: S.LoginRequest, db: Session = Depends(get_db)):
    """
    Look up user by email. If not found and display_name + role are provided,
    create a new account. Used by the frontend instead of Firebase Auth.
    """
    user = db.query(M.User).filter(M.User.email == payload.email).first()
    if user:
        # Admin override on every login
        if user.email == ADMIN_EMAIL and user.role != M.UserRole.admin:
            user.role = M.UserRole.admin
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)
        return user
    # New user — require name and role
    if not payload.display_name or not payload.role:
        raise HTTPException(
            status_code=404,
            detail="User not found. Provide display_name and role to register."
        )
    role = M.UserRole.admin if payload.email == ADMIN_EMAIL else (payload.role or M.UserRole.customer)
    new_user = M.User(
        uid=str(uuid.uuid4()),
        email=str(payload.email),
        display_name=payload.display_name,
        role=role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


# ═══════════════════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════════════════

@app.post("/users", response_model=S.UserOut, status_code=201)
def create_user(payload: S.UserCreate, db: Session = Depends(get_db)):
    if db.query(M.User).filter(M.User.uid == payload.uid).first():
        raise HTTPException(400, "User already exists")
    if db.query(M.User).filter(M.User.email == str(payload.email)).first():
        raise HTTPException(400, "Email already registered")
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
    db: Session = Depends(get_db),
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
    db: Session = Depends(get_db),
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
    db: Session = Depends(get_db),
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
    _: M.User = Depends(get_current_user),
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
    db: Session = Depends(get_db),
):
    shop = db.get(M.Shop, shop_id)
    if not shop:
        raise HTTPException(404, "Shop not found")
    _assert_shop_ownership(shop, current_user)
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_orders = (
        db.query(M.Order)
        .filter(and_(M.Order.shop_id == shop_id, M.Order.created_at >= today_start))
        .all()
    )
    low_stock = (
        db.query(M.Product.name)
        .filter(
            M.Product.shop_id == shop_id,
            M.Product.stock <= 5,
            M.Product.status == M.ProductStatus.active,
        )
        .all()
    )
    return {
        "today_sales":     round(sum(o.total for o in today_orders), 2),
        "today_orders":    len(today_orders),
        "total_products":  db.query(M.Product).filter(M.Product.shop_id == shop_id).count(),
        "low_stock_items": [r.name for r in low_stock],
    }


# ── Private helpers ─────────────────────────────────────────────────────────

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
