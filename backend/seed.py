"""
HyperMart — Dev Seed Script
Populates database with demo users (with hashed passwords), shops, products,
subscriptions, and sample orders.

    python seed.py            — upsert (safe to run multiple times)
    python seed.py --reset    — drop all tables first, then seed fresh

Demo credentials (all roles):
  Admin    : senamallas@gmail.com   / Admin@123   | +91-9000000001
  Owner 1  : anand@example.com      / Owner@123   | +91-9000000002
  Owner 2  : priya@example.com      / Owner@123   | +91-9000000003
  Customer : ravi@example.com       / Customer@123| +91-9000000004
"""

import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load .env file before importing database
load_dotenv()

from passlib.context import CryptContext

from database import create_tables, drop_tables, get_db_ctx
from models import (
    User, Shop, Product, Order, OrderItem, Subscription,
    Supplier, PurchaseOrder, PurchaseOrderItem,
    ProductDiscount, OrderDiscount,
    UserRole, ShopStatus, ShopCategory, ShopLocation,
    OrderStatus, PaymentStatus, SubscriptionStatus,
    PurchaseOrderStatus, DiscountType, DiscountAmountType,
)

pwd_ctx = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


# ─────────────────────────────────────────────────────────────────────────────
# Seed data
# ─────────────────────────────────────────────────────────────────────────────

USERS = [
    dict(
        uid="admin-001", email="senamallas@gmail.com",
        display_name="Admin User",  role=UserRole.admin,
        phone="+91-9000000001",     password="Admin@123",
    ),
    dict(
        uid="owner-001", email="anand@example.com",
        display_name="Anand Kumar", role=UserRole.owner,
        phone="+91-9000000002",     password="Owner@123",
    ),
    dict(
        uid="owner-002", email="priya@example.com",
        display_name="Priya Sharma",role=UserRole.owner,
        phone="+91-9000000003",     password="Owner@123",
    ),
    dict(
        uid="cust-001",  email="ravi@example.com",
        display_name="Ravi Verma",  role=UserRole.customer,
        phone="+91-9000000004",     password="Customer@123",
    ),
    dict(
        uid="cust-002",  email="kavita@example.com",
        display_name="Kavita Singh",role=UserRole.customer,
        phone="+91-9000000005",     password="Customer@123",
    ),
]

SHOPS = [
    # Anand owns shops 0-1
    dict(owner_idx=1, name="Anand Groceries", category=ShopCategory.grocery,
         location_name=ShopLocation.green_valley, address="12, Main St, Green Valley",
         timings="8 AM – 10 PM", status=ShopStatus.approved, rating=4.6, review_count=28,
         logo="https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80"),
    dict(owner_idx=1, name="Anand Dairy Fresh", category=ShopCategory.dairy,
         location_name=ShopLocation.milk_lane, address="5, Milk Lane, Sector 4",
         timings="6 AM – 8 PM",  status=ShopStatus.approved, rating=4.8, review_count=44,
         logo="https://images.unsplash.com/photo-1563636619-e9107da5a163?w=400&q=80"),
    # Priya owns shops 2-4
    dict(owner_idx=2, name="Priya Bakery", category=ShopCategory.bakery,
         location_name=ShopLocation.central_market, address="27, Baker St, Central Market",
         timings="7 AM – 9 PM",  status=ShopStatus.approved, rating=4.7, review_count=16,
         logo="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80"),
    dict(owner_idx=2, name="Priya Vegetables", category=ShopCategory.vegetables,
         location_name=ShopLocation.green_valley, address="8, Veggie Row, Green Valley",
         timings="7 AM – 7 PM",  status=ShopStatus.approved, rating=4.5, review_count=19,
         logo="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80"),
    dict(owner_idx=2, name="Priya Beverages", category=ShopCategory.beverages,
         location_name=ShopLocation.food_plaza, address="3, Food Plaza, Block B",
         timings="9 AM – 11 PM", status=ShopStatus.approved, rating=4.4, review_count=8,
         logo="https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80"),
    dict(owner_idx=1, name="Anand Household", category=ShopCategory.household,
         location_name=ShopLocation.old_town, address="101, Old Town Bazaar",
         timings="9 AM – 8 PM",  status=ShopStatus.pending, rating=4.3, review_count=0,
         logo="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80"),
]

PRODUCTS = [
    # ── Anand Groceries (shop 0) ──────────────────────────────────
    dict(shop_idx=0, name="Basmati Rice (5 kg)",   category=ShopCategory.grocery,
         price=320, mrp=370, unit="5 kg bag", stock=50,
         image="https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80"),
    dict(shop_idx=0, name="Toor Dal (1 kg)",        category=ShopCategory.grocery,
         price=130, mrp=145, unit="1 kg",     stock=80,
         image="https://images.unsplash.com/photo-1585996853881-dad6643844b6?w=400&q=80"),
    dict(shop_idx=0, name="Sunflower Oil (1 L)",    category=ShopCategory.grocery,
         price=155, mrp=175, unit="1 L bottle", stock=30,
         image="https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80"),
    dict(shop_idx=0, name="Sugar (1 kg)",           category=ShopCategory.grocery,
         price=45,  mrp=50,  unit="1 kg",     stock=100,
         image="https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80"),
    dict(shop_idx=0, name="Wheat Flour (5 kg)",     category=ShopCategory.grocery,
         price=210, mrp=230, unit="5 kg bag", stock=60,
         image="https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80"),
    dict(shop_idx=0, name="Chana Dal (500 g)",      category=ShopCategory.grocery,
         price=65,  mrp=72,  unit="500 g",    stock=45,
         image="https://images.unsplash.com/photo-1585996853881-dad6643844b6?w=400&q=80"),
    dict(shop_idx=0, name="Mustard Oil (1 L)",      category=ShopCategory.grocery,
         price=175, mrp=195, unit="1 L bottle", stock=20,
         image="https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80"),
    dict(shop_idx=0, name="Salt (1 kg)",            category=ShopCategory.grocery,
         price=18,  mrp=20,  unit="1 kg",     stock=200,
         image="https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=400&q=80"),

    # ── Anand Dairy Fresh (shop 1) ────────────────────────────────
    dict(shop_idx=1, name="Full Cream Milk (1 L)",  category=ShopCategory.dairy,
         price=62,  mrp=65,  unit="1 L pouch", stock=120,
         image="https://images.unsplash.com/photo-1563636619-e9107da5a163?w=400&q=80"),
    dict(shop_idx=1, name="Paneer (200 g)",         category=ShopCategory.dairy,
         price=90,  mrp=100, unit="200 g pack", stock=40,
         image="https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=80"),
    dict(shop_idx=1, name="Butter (100 g)",         category=ShopCategory.dairy,
         price=55,  mrp=60,  unit="100 g",     stock=30,
         image="https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80"),
    dict(shop_idx=1, name="Fresh Curd (500 g)",     category=ShopCategory.dairy,
         price=40,  mrp=45,  unit="500 g",     stock=60,
         image="https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&q=80"),
    dict(shop_idx=1, name="Ghee (500 g)",           category=ShopCategory.dairy,
         price=280, mrp=320, unit="500 g jar", stock=15,
         image="https://images.unsplash.com/photo-1631125915902-d8abe9225ff2?w=400&q=80"),
    dict(shop_idx=1, name="Cheese Slices (200 g)",  category=ShopCategory.dairy,
         price=110, mrp=125, unit="200 g box", stock=25,
         image="https://images.unsplash.com/photo-1552767059-ce182ead6c1b?w=400&q=80"),

    # ── Priya Bakery (shop 2) ─────────────────────────────────────
    dict(shop_idx=2, name="Multigrain Bread",       category=ShopCategory.bakery,
         price=40,  mrp=45,  unit="400 g loaf", stock=25,
         image="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80"),
    dict(shop_idx=2, name="Butter Cookies (200 g)", category=ShopCategory.bakery,
         price=60,  mrp=70,  unit="200 g box", stock=15,
         image="https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80"),
    dict(shop_idx=2, name="Croissant (4 pcs)",      category=ShopCategory.bakery,
         price=90,  mrp=100, unit="4 pieces",  stock=20,
         image="https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80"),
    dict(shop_idx=2, name="Chocolate Cake (500 g)", category=ShopCategory.bakery,
         price=250, mrp=290, unit="500 g cake", stock=8,
         image="https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80"),
    dict(shop_idx=2, name="White Bread",            category=ShopCategory.bakery,
         price=30,  mrp=35,  unit="400 g loaf", stock=30,
         image="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80"),

    # ── Priya Vegetables (shop 3) ─────────────────────────────────
    dict(shop_idx=3, name="Tomatoes (1 kg)",        category=ShopCategory.vegetables,
         price=40,  mrp=50,  unit="1 kg",     stock=80,
         image="https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80"),
    dict(shop_idx=3, name="Onions (1 kg)",          category=ShopCategory.vegetables,
         price=35,  mrp=40,  unit="1 kg",     stock=100,
         image="https://images.unsplash.com/photo-1508747703725-719777637510?w=400&q=80"),
    dict(shop_idx=3, name="Potatoes (1 kg)",        category=ShopCategory.vegetables,
         price=30,  mrp=35,  unit="1 kg",     stock=120,
         image="https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80"),
    dict(shop_idx=3, name="Spinach (250 g)",        category=ShopCategory.vegetables,
         price=20,  mrp=25,  unit="250 g bunch", stock=50,
         image="https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&q=80"),
    dict(shop_idx=3, name="Capsicum (500 g)",       category=ShopCategory.vegetables,
         price=45,  mrp=55,  unit="500 g",    stock=40,
         image="https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&q=80"),
    dict(shop_idx=3, name="Carrots (500 g)",        category=ShopCategory.vegetables,
         price=25,  mrp=30,  unit="500 g",    stock=60,
         image="https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&q=80"),
    dict(shop_idx=3, name="Coriander Leaves (100 g)",category=ShopCategory.vegetables,
         price=15,  mrp=20,  unit="100 g bunch", stock=70,
         image="https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400&q=80"),

    # ── Priya Beverages (shop 4) ──────────────────────────────────
    dict(shop_idx=4, name="Mango Juice (1 L)",      category=ShopCategory.beverages,
         price=85,  mrp=95,  unit="1 L carton", stock=40,
         image="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&q=80"),
    dict(shop_idx=4, name="Mineral Water (1 L)",    category=ShopCategory.beverages,
         price=20,  mrp=20,  unit="1 L bottle", stock=200,
         image="https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80"),
    dict(shop_idx=4, name="Green Tea (25 bags)",    category=ShopCategory.beverages,
         price=120, mrp=140, unit="25 bags box", stock=30,
         image="https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80"),
    dict(shop_idx=4, name="Coca-Cola (2 L)",        category=ShopCategory.beverages,
         price=90,  mrp=95,  unit="2 L bottle", stock=50,
         image="https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80"),
    dict(shop_idx=4, name="Orange Juice (1 L)",     category=ShopCategory.beverages,
         price=80,  mrp=90,  unit="1 L carton", stock=35,
         image="https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80"),
]


# ─────────────────────────────────────────────────────────────────────────────
# Seed runner
# ─────────────────────────────────────────────────────────────────────────────

def run(reset: bool = False):
    if reset:
        drop_tables()
        print("  Tables dropped.")
    create_tables()

    with get_db_ctx() as db:
        # ── Users ──
        user_objs = []
        for u in USERS:
            u = dict(u)
            raw_pw = u.pop("password")
            obj = db.query(User).filter(User.uid == u["uid"]).first()
            if not obj:
                obj = User(**u, password_hash=pwd_ctx.hash(raw_pw))
            else:
                # Update phone + ensure password is set
                obj.phone = u.get("phone")
                if not obj.password_hash:
                    obj.password_hash = pwd_ctx.hash(raw_pw)
            db.add(obj)
            db.flush()
            user_objs.append(obj)

        # ── Subscriptions for owners (active) ──
        for owner_idx in [1, 2]:
            owner = user_objs[owner_idx]
            sub = db.query(Subscription).filter(Subscription.user_id == owner.id).first()
            now = datetime.utcnow()
            if not sub:
                sub = Subscription(
                    user_id=owner.id,
                    plan_amount=10.0,
                    status=SubscriptionStatus.active,
                    starts_at=now,
                    expires_at=now + timedelta(days=30),
                )
                db.add(sub)
            elif sub.status != SubscriptionStatus.active:
                sub.status     = SubscriptionStatus.active
                sub.starts_at  = now
                sub.expires_at = now + timedelta(days=30)
            db.flush()

        # ── Shops ──
        shop_objs = []
        for s in SHOPS:
            s = dict(s)
            owner = user_objs[s.pop("owner_idx")]
            obj = db.query(Shop).filter(Shop.name == s["name"]).first()
            if not obj:
                obj = Shop(owner_id=owner.id, **s)
            db.add(obj)
            db.flush()
            shop_objs.append(obj)

        # ── Products ──
        prod_objs = []
        for p in PRODUCTS:
            p = dict(p)
            shop = shop_objs[p.pop("shop_idx")]
            obj = db.query(Product).filter(
                Product.shop_id == shop.id, Product.name == p["name"]
            ).first()
            if not obj:
                obj = Product(shop_id=shop.id, **p)
            db.add(obj)
            db.flush()
            prod_objs.append(obj)

        # ── Sample orders (1 delivered, 1 pending) ──
        ravi = user_objs[3]
        if not db.query(Order).filter(Order.customer_id == ravi.id).first():
            rice = prod_objs[0]   # Basmati Rice
            dal  = prod_objs[1]   # Toor Dal
            milk = prod_objs[8]   # Full Cream Milk

            db.add(Order(
                shop_id=shop_objs[0].id, shop_name=shop_objs[0].name,
                customer_id=ravi.id,
                total=rice.price + dal.price,
                status=OrderStatus.delivered,
                payment_status=PaymentStatus.paid,
                delivery_address="42, Green Valley Road",
                created_at=datetime.utcnow() - timedelta(days=2),
                items=[
                    OrderItem(product_id=rice.id, name=rice.name, price=rice.price, quantity=1),
                    OrderItem(product_id=dal.id,  name=dal.name,  price=dal.price,  quantity=1),
                ],
            ))
            db.add(Order(
                shop_id=shop_objs[1].id, shop_name=shop_objs[1].name,
                customer_id=ravi.id,
                total=milk.price * 2,
                status=OrderStatus.accepted,
                payment_status=PaymentStatus.pending,
                delivery_address="42, Green Valley Road",
                created_at=datetime.utcnow() - timedelta(hours=3),
                items=[
                    OrderItem(product_id=milk.id, name=milk.name, price=milk.price, quantity=2),
                ],
            ))

        # ── Set low_stock_threshold and expiry_date on some products ──
        now = datetime.utcnow()
        for i, p in enumerate(prod_objs):
            p.low_stock_threshold = 10
            if i % 5 == 0:
                p.expiry_date = now + timedelta(days=15)  # expiring soon
            elif i % 7 == 0:
                p.expiry_date = now + timedelta(days=90)
            if i == 2:
                p.stock = 5  # low stock item
                p.low_stock_threshold = 10

        # ── Set delivery_radius, pincode, city, state on shops ──
        for i, shop in enumerate(shop_objs):
            shop.delivery_radius = 3.0 + i * 0.5
            shop.pincode = f"50000{i+1}"
            shop.city = "Hyderabad"
            shop.state = "Telangana"

        db.flush()

        # ── Suppliers ──
        suppliers_data = [
            dict(shop_idx=0, name="Metro Wholesale", contact_person="Raj Malhotra",
                 phone="+91-9800000001", email="metro@wholesale.com",
                 address="Industrial Area, Phase 2", gst_number="29AABCM1234A1Z1"),
            dict(shop_idx=0, name="Agro Fresh Supplies", contact_person="Suresh Patel",
                 phone="+91-9800000002", email="agro@fresh.com",
                 address="Farm Road, Sector 7", gst_number="29AABCA5678B2Z2"),
            dict(shop_idx=1, name="Nandini Dairy Co-op", contact_person="Lakshmi Devi",
                 phone="+91-9800000003", email="nandini@dairy.com",
                 address="Dairy Complex, Milk Lane", gst_number="29AABCN9012C3Z3"),
            dict(shop_idx=2, name="Flour Power Mills", contact_person="Amit Sharma",
                 phone="+91-9800000004", email="flour@power.com",
                 address="Mill Road, Old Town", gst_number="29AABCF3456D4Z4"),
        ]
        supplier_objs = []
        for s in suppliers_data:
            shop = shop_objs[s.pop("shop_idx")]
            existing = db.query(Supplier).filter(Supplier.shop_id == shop.id, Supplier.name == s["name"]).first()
            if not existing:
                existing = Supplier(shop_id=shop.id, **s)
                db.add(existing)
                db.flush()
            supplier_objs.append(existing)

        # ── Purchase Orders ──
        if not db.query(PurchaseOrder).first():
            po1 = PurchaseOrder(
                shop_id=shop_objs[0].id, supplier_id=supplier_objs[0].id,
                total_amount=15000.0, status=PurchaseOrderStatus.received,
                notes="Monthly stock replenishment",
                created_at=now - timedelta(days=5),
            )
            db.add(po1)
            db.flush()
            db.add(PurchaseOrderItem(purchase_order_id=po1.id, product_id=prod_objs[0].id,
                                     name="Basmati Rice (5 kg)", price=300, quantity=30))
            db.add(PurchaseOrderItem(purchase_order_id=po1.id, product_id=prod_objs[1].id,
                                     name="Toor Dal (1 kg)", price=120, quantity=50))

            po2 = PurchaseOrder(
                shop_id=shop_objs[1].id, supplier_id=supplier_objs[2].id,
                total_amount=8500.0, status=PurchaseOrderStatus.sent,
                notes="Weekly dairy restock",
                created_at=now - timedelta(days=1),
            )
            db.add(po2)
            db.flush()
            db.add(PurchaseOrderItem(purchase_order_id=po2.id, product_id=prod_objs[8].id,
                                     name="Full Cream Milk (1 L)", price=58, quantity=100))
            db.add(PurchaseOrderItem(purchase_order_id=po2.id, product_id=prod_objs[9].id,
                                     name="Paneer (200 g)", price=80, quantity=30))

        # ── Product Discounts ──
        if not db.query(ProductDiscount).first():
            # BOGO on Sugar for Anand Groceries
            db.add(ProductDiscount(
                shop_id=shop_objs[0].id, product_id=prod_objs[3].id,
                product_name="Sugar (1 kg)", type=DiscountType.bogo,
                buy_qty=2, get_qty=1, status="active",
                valid_till=now + timedelta(days=30),
            ))
            # Buy 3 Get 1 on Milk for Anand Dairy
            db.add(ProductDiscount(
                shop_id=shop_objs[1].id, product_id=prod_objs[8].id,
                product_name="Full Cream Milk (1 L)", type=DiscountType.buy_x_get_y,
                buy_qty=3, get_qty=1, status="active",
                valid_till=now + timedelta(days=15),
            ))
            # Bulk price on Bread for Priya Bakery
            db.add(ProductDiscount(
                shop_id=shop_objs[2].id, product_id=prod_objs[14].id,
                product_name="Multigrain Bread", type=DiscountType.bulk_price,
                buy_qty=3, bulk_price=100.0, status="active",
                valid_till=now + timedelta(days=20),
            ))
            # Individual 10% off on Tomatoes for Priya Vegetables
            db.add(ProductDiscount(
                shop_id=shop_objs[3].id, product_id=prod_objs[19].id,
                product_name="Tomatoes (1 kg)", type=DiscountType.individual,
                discount_value=10.0, status="active",
                valid_till=now + timedelta(days=10),
            ))

        # ── Order Discounts ──
        if not db.query(OrderDiscount).first():
            # 5% off on orders >= 500 for Anand Groceries
            db.add(OrderDiscount(
                shop_id=shop_objs[0].id, min_bill_value=500.0,
                discount_type=DiscountAmountType.percentage, discount_value=5.0,
                status="active", valid_till=now + timedelta(days=30),
            ))
            # Rs 50 off on orders >= 1000 for Anand Groceries
            db.add(OrderDiscount(
                shop_id=shop_objs[0].id, min_bill_value=1000.0,
                discount_type=DiscountAmountType.flat, discount_value=50.0,
                status="active", valid_till=now + timedelta(days=30),
            ))
            # 10% off on orders >= 300 for Priya Bakery
            db.add(OrderDiscount(
                shop_id=shop_objs[2].id, min_bill_value=300.0,
                discount_type=DiscountAmountType.percentage, discount_value=10.0,
                status="active", valid_till=now + timedelta(days=20),
            ))

        db.commit()

    print()
    print("Seed complete!")
    print()
    print("  Demo credentials:")
    print("  ---------------------------------------------------------")
    print("  Admin    : senamallas@gmail.com  / Admin@123    | +91-9000000001")
    print("  Owner 1  : anand@example.com     / Owner@123    | +91-9000000002")
    print("  Owner 2  : priya@example.com     / Owner@123    | +91-9000000003")
    print("  Customer : ravi@example.com      / Customer@123 | +91-9000000004")
    print("  Customer : kavita@example.com    / Customer@123 | +91-9000000005")
    print()
    print("  Subscription: Anand & Priya are ACTIVE (30 days from now, Rs 10/month)")
    print("  ---------------------------------------------------------")
    print()
    print("  New seed data:")
    print("  - 4 suppliers across 3 shops")
    print("  - 2 purchase orders with items")
    print("  - 4 product discounts (BOGO, Buy3Get1, Bulk, 10% off)")
    print("  - 3 order discounts (5% on 500+, Rs50 on 1000+, 10% on 300+)")
    print("  - Low stock / expiry dates set on select products")
    print("  ---------------------------------------------------------")


if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv
    run(reset=reset_flag)
