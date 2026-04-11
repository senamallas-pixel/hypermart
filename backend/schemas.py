"""
HyperMart — Pydantic v2 Schemas
"""

from datetime import datetime
from typing import Optional, List, ClassVar, Dict
from pydantic import BaseModel, EmailStr, field_validator, model_validator, computed_field

from models import UserRole, ShopStatus, ShopCategory, ShopLocation
from models import ProductStatus, OrderStatus, PaymentStatus, SubscriptionStatus
from models import PurchaseOrderStatus, DiscountType, DiscountAmountType


class OrmBase(BaseModel):
    model_config = {"from_attributes": True}


# ── User ──────────────────────────────────────────────────────────────────────

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
    id:                     int
    uid:                    str
    email:                  str
    display_name:           str
    photo_url:              Optional[str]
    role:                   UserRole
    phone:                  Optional[str]
    multi_location_enabled: int = 0
    created_at:             datetime
    last_login:             Optional[datetime]


# ── Auth ──────────────────────────────────────────────────────────────────────

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


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("New password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserOut


# ── Shop ──────────────────────────────────────────────────────────────────────

class ShopCreate(BaseModel):
    name:            str
    address:         str
    category:        ShopCategory
    location_name:   ShopLocation
    logo:            Optional[str]   = None
    timings:         Optional[str]   = None
    lat:             Optional[float] = None
    lng:             Optional[float] = None
    delivery_radius: Optional[float] = None
    pincode:         Optional[str]   = None
    city:            Optional[str]   = None
    state:           Optional[str]   = None

    @field_validator("name")
    @classmethod
    def name_min_length(cls, v: str) -> str:
        if len(v.strip()) < 3:
            raise ValueError("Shop name must be at least 3 characters")
        return v.strip()


class ShopUpdate(BaseModel):
    name:            Optional[str]          = None
    address:         Optional[str]          = None
    category:        Optional[ShopCategory] = None
    location_name:   Optional[ShopLocation] = None
    logo:            Optional[str]          = None
    timings:         Optional[str]          = None
    status:          Optional[ShopStatus]   = None
    lat:             Optional[float]        = None
    lng:             Optional[float]        = None
    delivery_radius: Optional[float]        = None
    pincode:         Optional[str]          = None
    city:            Optional[str]          = None
    state:           Optional[str]          = None


class ShopOut(OrmBase):
    id:              int
    owner_id:        int
    name:            str
    address:         str
    category:        ShopCategory
    location_name:   ShopLocation
    status:          ShopStatus
    logo:            Optional[str]
    timings:         Optional[str]
    lat:             Optional[float]
    lng:             Optional[float]
    rating:          float
    review_count:    int
    delivery_radius: Optional[float] = None
    pincode:         Optional[str]   = None
    city:            Optional[str]   = None
    state:           Optional[str]   = None
    created_at:      datetime


class ShopStatusUpdate(BaseModel):
    status: ShopStatus


# ── Product ───────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name:                str
    description:         Optional[str]      = None
    price:               float
    mrp:                 float
    unit:                str
    category:            ShopCategory
    stock:               int                = 0
    low_stock_threshold: int                = 10
    expiry_date:         Optional[datetime] = None
    image:               Optional[str]      = None
    status:              ProductStatus      = ProductStatus.active

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
    name:                Optional[str]           = None
    description:         Optional[str]           = None
    price:               Optional[float]         = None
    mrp:                 Optional[float]         = None
    unit:                Optional[str]           = None
    category:            Optional[ShopCategory]  = None
    stock:               Optional[int]           = None
    low_stock_threshold: Optional[int]           = None
    expiry_date:         Optional[datetime]      = None
    image:               Optional[str]           = None
    status:              Optional[ProductStatus] = None


class ProductOut(OrmBase):
    id:                  int
    shop_id:             int
    name:                str
    description:         Optional[str]      = None
    price:               float
    mrp:                 float
    unit:                str
    category:            ShopCategory
    stock:               int
    low_stock_threshold: int                = 10
    expiry_date:         Optional[datetime] = None
    image:               Optional[str]
    status:              ProductStatus
    created_at:          datetime


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
    delivery_address: str             = "Default Address"
    subtotal:         Optional[float] = None
    item_discounts:   Optional[float] = None
    bill_discount:    Optional[float] = None
    total_discount:   Optional[float] = None

    @field_validator("items")
    @classmethod
    def non_empty_items(cls, v: list) -> list:
        if not v:
            raise ValueError("Order must contain at least one item")
        return v


class WalkinOrderCreate(BaseModel):
    items:          List[OrderItemIn]
    subtotal:       Optional[float] = None
    item_discounts: Optional[float] = None
    bill_discount:  Optional[float] = None
    total_discount: Optional[float] = None

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
    subtotal:         Optional[float] = None
    item_discounts:   Optional[float] = None
    bill_discount:    Optional[float] = None
    total_discount:   Optional[float] = None
    order_type:       Optional[str]   = "online"
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
    total_shops:          int
    approved_shops:       int
    pending_shops:        int = 0
    total_users:          int
    total_owners:         int = 0
    total_orders:         int
    total_revenue:        float = 0.0
    delivered_revenue:    float
    active_subscriptions: int = 0
    orders_by_status:     Dict[str, int] = {}
    shops_by_category:    Dict[str, int] = {}
    top_shops:            List[Dict] = []


# ── Analytics sub-schemas ─────────────────────────────────────────────────────

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


class MonthlyDailySale(BaseModel):
    date:    str
    revenue: float
    walk_in: float
    online:  float
    orders:  int


class ShopAnalytics(BaseModel):
    today_sales:         float
    today_orders:        int
    total_products:      int
    low_stock_items:     List[LowStockItem]
    daily_sales:         List[DailySale]
    category_revenue:    List[CategoryRevenue]
    top_products:        List[TopProduct]
    monthly_revenue:     List[MonthlyRevenue]
    orders_by_status:    Dict[str, int]
    monthly_daily_sales: List[MonthlyDailySale] = []


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


# ── Subscription ──────────────────────────────────────────────────────────────

class SubscriptionOut(OrmBase):
    id:          int
    user_id:     int
    plan_amount: float
    status:      SubscriptionStatus
    starts_at:   Optional[datetime]
    expires_at:  Optional[datetime]
    created_at:  datetime


# ── Reviews ──────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    rating:  int
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def valid_rating(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return v


class ReviewOut(OrmBase):
    id:            int
    shop_id:       int
    customer_id:   int
    customer_name: str = ""
    rating:        int
    comment:       Optional[str]
    created_at:    datetime


# ── Password Reset ───────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


# ── Suppliers ────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name:           str
    contact_person: Optional[str] = None
    phone:          Optional[str] = None
    email:          Optional[str] = None
    address:        Optional[str] = None
    gst_number:     Optional[str] = None


class SupplierUpdate(BaseModel):
    name:           Optional[str] = None
    contact_person: Optional[str] = None
    phone:          Optional[str] = None
    email:          Optional[str] = None
    address:        Optional[str] = None
    gst_number:     Optional[str] = None


class SupplierOut(OrmBase):
    id:             int
    shop_id:        int
    name:           str
    contact_person: Optional[str] = None
    phone:          Optional[str] = None
    email:          Optional[str] = None
    address:        Optional[str] = None
    gst_number:     Optional[str] = None
    created_at:     datetime


# ── Purchase Orders ──────────────────────────────────────────────────

class POItemIn(BaseModel):
    product_id: int
    name:       str
    price:      float
    quantity:   int


class POCreate(BaseModel):
    supplier_id: int
    items:       List[POItemIn]
    notes:       Optional[str] = None


class POItemOut(OrmBase):
    id:         int
    product_id: int
    name:       str
    price:      float
    quantity:   int


class POOut(OrmBase):
    id:           int
    shop_id:      int
    supplier_id:  int
    total_amount: float
    status:       PurchaseOrderStatus
    notes:        Optional[str] = None
    items:        List[POItemOut] = []
    created_at:   datetime


class POStatusUpdate(BaseModel):
    status: PurchaseOrderStatus


# ── Discounts ────────────────────────────────────────────────────────

class ProductDiscountCreate(BaseModel):
    product_id:     int
    product_name:   Optional[str]      = None
    type:           DiscountType
    buy_qty:        Optional[int]      = None
    get_qty:        Optional[int]      = None
    bulk_price:     Optional[float]    = None
    discount_value: Optional[float]    = None
    valid_till:     Optional[datetime] = None


class ProductDiscountOut(OrmBase):
    id:             int
    shop_id:        int
    product_id:     int
    product_name:   Optional[str] = None
    type:           DiscountType
    buy_qty:        Optional[int]   = None
    get_qty:        Optional[int]   = None
    bulk_price:     Optional[float] = None
    discount_value: Optional[float] = None
    status:         str
    valid_till:     Optional[datetime] = None
    created_at:     datetime


class OrderDiscountCreate(BaseModel):
    min_bill_value: float
    discount_type:  DiscountAmountType = DiscountAmountType.percentage
    discount_value: float
    valid_till:     Optional[datetime] = None


class OrderDiscountOut(OrmBase):
    id:             int
    shop_id:        int
    min_bill_value: float
    discount_type:  DiscountAmountType
    discount_value: float
    status:         str
    valid_till:     Optional[datetime] = None
    created_at:     datetime


# ── Bulk Stock Adjustment ────────────────────────────────────────────

class StockAdjustmentItem(BaseModel):
    product_id:          int
    stock:               Optional[int] = None
    low_stock_threshold: Optional[int] = None
    expiry_date:         Optional[str] = None   # date string "YYYY-MM-DD", "" to clear


class BulkStockAdjustment(BaseModel):
    items: List[StockAdjustmentItem]


# ── Multi-location ──────────────────────────────────────────────────

class MultiLocationUpdate(BaseModel):
    multi_location_enabled: int
