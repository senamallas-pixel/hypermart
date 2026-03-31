"""
HyperMart — Dev Seed Script
Populates SQLite with demo users, shops, products, and orders.
Run: python seed.py
"""

from datetime import datetime, timedelta
from database import create_tables, get_db_ctx
from models import User, Shop, Product, Order, OrderItem
from models import UserRole, ShopStatus, ShopCategory, ShopLocation
from models import OrderStatus, PaymentStatus

USERS = [
    dict(uid="admin-001", email="senamallas@gmail.com",  display_name="Admin User",   role=UserRole.admin),
    dict(uid="owner-001", email="anand@example.com",     display_name="Anand Kumar",  role=UserRole.owner),
    dict(uid="owner-002", email="priya@example.com",     display_name="Priya Sharma", role=UserRole.owner),
    dict(uid="cust-001",  email="customer1@example.com", display_name="Ravi Verma",   role=UserRole.customer),
]

SHOPS = [
    dict(owner_idx=1, name="Anand Groceries",   category=ShopCategory.grocery,
         location_name=ShopLocation.green_valley,   address="12, Main St, Green Valley",
         timings="8 AM – 10 PM", status=ShopStatus.approved,
         logo="https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80"),
    dict(owner_idx=1, name="Anand Dairy Fresh",  category=ShopCategory.dairy,
         location_name=ShopLocation.milk_lane,       address="5, Milk Lane, Sector 4",
         timings="6 AM – 8 PM",  status=ShopStatus.approved,
         logo="https://images.unsplash.com/photo-1563636619-e9107da5a163?w=400&q=80"),
    dict(owner_idx=2, name="Priya Bakery",       category=ShopCategory.bakery,
         location_name=ShopLocation.central_market,  address="27, Baker St, Central Market",
         timings="7 AM – 9 PM",  status=ShopStatus.pending,
         logo="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80"),
    dict(owner_idx=2, name="Priya Vegetables",   category=ShopCategory.vegetables,
         location_name=ShopLocation.green_valley,   address="8, Veggie Row, Green Valley",
         timings="7 AM – 7 PM",  status=ShopStatus.approved,
         logo="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80"),
]

PRODUCTS = [
    dict(shop_idx=0, name="Basmati Rice (5 kg)", category=ShopCategory.grocery,
         price=320, mrp=370, unit="5kg bag", stock=50,
         image="https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80"),
    dict(shop_idx=0, name="Toor Dal (1 kg)",     category=ShopCategory.grocery,
         price=130, mrp=145, unit="1kg",     stock=80,
         image="https://images.unsplash.com/photo-1585996853881-dad6643844b6?w=400&q=80"),
    dict(shop_idx=0, name="Sunflower Oil (1L)",  category=ShopCategory.grocery,
         price=155, mrp=175, unit="1L bottle", stock=30,
         image="https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80"),
    dict(shop_idx=0, name="Sugar (1 kg)",        category=ShopCategory.grocery,
         price=45,  mrp=50,  unit="1kg",     stock=100,
         image="https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400&q=80"),
    dict(shop_idx=1, name="Full Cream Milk (1L)",category=ShopCategory.dairy,
         price=62,  mrp=65,  unit="1L pouch", stock=120,
         image="https://images.unsplash.com/photo-1563636619-e9107da5a163?w=400&q=80"),
    dict(shop_idx=1, name="Paneer (200g)",       category=ShopCategory.dairy,
         price=90,  mrp=100, unit="200g pack",stock=40,
         image="https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=80"),
    dict(shop_idx=1, name="Butter (100g)",       category=ShopCategory.dairy,
         price=55,  mrp=60,  unit="100g",     stock=3,
         image="https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80"),
    dict(shop_idx=1, name="Fresh Curd (500g)",   category=ShopCategory.dairy,
         price=40,  mrp=45,  unit="500g",     stock=60,
         image="https://images.unsplash.com/photo-1485962391905-dc37bc33e58b?w=400&q=80"),
    dict(shop_idx=2, name="Multigrain Bread",    category=ShopCategory.bakery,
         price=40,  mrp=45,  unit="400g loaf",stock=25,
         image="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80"),
    dict(shop_idx=2, name="Butter Cookies",      category=ShopCategory.bakery,
         price=60,  mrp=70,  unit="200g box", stock=15,
         image="https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80"),
    dict(shop_idx=3, name="Tomatoes (1 kg)",     category=ShopCategory.vegetables,
         price=40,  mrp=50,  unit="1kg",      stock=80,
         image="https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80"),
    dict(shop_idx=3, name="Onions (1 kg)",       category=ShopCategory.vegetables,
         price=35,  mrp=40,  unit="1kg",      stock=100,
         image="https://images.unsplash.com/photo-1508747703725-719777637510?w=400&q=80"),
    dict(shop_idx=3, name="Potatoes (1 kg)",     category=ShopCategory.vegetables,
         price=30,  mrp=35,  unit="1kg",      stock=120,
         image="https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80"),
]


def run():
    create_tables()
    with get_db_ctx() as db:
        user_objs = []
        for u in USERS:
            obj = db.query(User).filter(User.uid == u["uid"]).first()
            if not obj:
                obj = User(**u)
            db.add(obj)
            db.flush()
            user_objs.append(obj)

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

        # Seed a sample order for the customer
        if not db.query(Order).filter(Order.customer_id == user_objs[3].id).first():
            rice = prod_objs[0]
            dal  = prod_objs[1]
            order = Order(
                shop_id=shop_objs[0].id,
                shop_name=shop_objs[0].name,
                customer_id=user_objs[3].id,
                total=rice.price + dal.price,
                status=OrderStatus.delivered,
                payment_status=PaymentStatus.paid,
                delivery_address="42, Green Valley Road",
                created_at=datetime.utcnow() - timedelta(days=1),
                items=[
                    OrderItem(
                        product_id=rice.id,
                        name=rice.name,
                        price=rice.price,
                        quantity=1,
                    ),
                    OrderItem(
                        product_id=dal.id,
                        name=dal.name,
                        price=dal.price,
                        quantity=1,
                    ),
                ],
            )
            db.add(order)

    print("✅  Seed complete")
    print("   Admin    → email: senamallas@gmail.com  | uid: admin-001")
    print("   Owner    → email: anand@example.com     | uid: owner-001")
    print("   Owner    → email: priya@example.com     | uid: owner-002")
    print("   Customer → email: customer1@example.com | uid: cust-001")


if __name__ == "__main__":
    run()
