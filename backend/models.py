"""
HyperMart — SQLAlchemy ORM Models (SQLite)
"""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Integer, Float, DateTime,
    ForeignKey, Enum, Text
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


class SubscriptionStatus(str, PyEnum):
    pending = "pending"
    active  = "active"
    expired = "expired"


# ── Models ────────────────────────────────────────────────────────────────────

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

    def __repr__(self):
        return f"<User {self.email} [{self.role}]>"


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

    def __repr__(self):
        return f"<Shop '{self.name}' [{self.status}]>"


class Product(Base):
    __tablename__ = "products"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    shop_id     = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price       = Column(Float, nullable=False)
    mrp        = Column(Float, nullable=False)
    unit       = Column(String(50), nullable=False)
    category   = Column(Enum(ShopCategory), nullable=False)
    stock      = Column(Integer, nullable=False, default=0)
    image      = Column(String(1024), nullable=True)
    status     = Column(Enum(ProductStatus), nullable=False, default=ProductStatus.active, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    shop        = relationship("Shop", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")

    def __repr__(self):
        return f"<Product '{self.name}' ₹{self.price}>"


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

    def __repr__(self):
        return f"<Order #{self.id} [{self.status}] ₹{self.total}>"


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

    def __repr__(self):
        return f"<OrderItem {self.name} x{self.quantity}>"


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

    def __repr__(self):
        return f"<Subscription user={self.user_id} status={self.status}>"


class Review(Base):
    __tablename__ = "reviews"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    shop_id     = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating      = Column(Integer, nullable=False)
    comment     = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    shop     = relationship("Shop",  backref="reviews")
    customer = relationship("User",  backref="reviews")

    def __repr__(self):
        return f"<Review shop={self.shop_id} rating={self.rating}>"


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token      = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used       = Column(Integer, default=0)

    def __repr__(self):
        return f"<PasswordResetToken user={self.user_id}>"
