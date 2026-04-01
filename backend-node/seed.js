"use strict";
/**
 * HyperMart — Node.js Seed Script
 *
 *   node seed.js           — upsert (safe to run multiple times)
 *   node seed.js --reset   — drop all tables first, then seed fresh
 *
 * Demo credentials:
 *   Admin    : senamallas@gmail.com  / Admin@123    | +91-9000000001
 *   Owner 1  : anand@example.com     / Owner@123    | +91-9000000002
 *   Owner 2  : priya@example.com     / Owner@123    | +91-9000000003
 *   Customer : ravi@example.com      / Customer@123 | +91-9000000004
 *   Customer : kavita@example.com    / Customer@123 | +91-9000000005
 */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");

const RESET = process.argv.includes("--reset");

// ── Helpers ──────────────────────────────────────────────────────────────────

function hash(plain) {
  return bcrypt.hashSync(plain, 10);
}

function daysFromNow(n) {
  return new Date(Date.now() + n * 86400000).toISOString();
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function hoursAgo(n) {
  return new Date(Date.now() - n * 3600000).toISOString();
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const USERS = [
  { uid: "admin-001", email: "senamallas@gmail.com", display_name: "Admin User",    role: "admin",    phone: "+91-9000000001", password: "Admin@123"    },
  { uid: "owner-001", email: "anand@example.com",    display_name: "Anand Kumar",   role: "owner",    phone: "+91-9000000002", password: "Owner@123"    },
  { uid: "owner-002", email: "priya@example.com",    display_name: "Priya Sharma",  role: "owner",    phone: "+91-9000000003", password: "Owner@123"    },
  { uid: "cust-001",  email: "ravi@example.com",     display_name: "Ravi Verma",    role: "customer", phone: "+91-9000000004", password: "Customer@123" },
  { uid: "cust-002",  email: "kavita@example.com",   display_name: "Kavita Singh",  role: "customer", phone: "+91-9000000005", password: "Customer@123" },
];

const SHOPS = [
  { owner_idx: 1, name: "Anand Groceries",   category: "Grocery",             location_name: "Green Valley",   address: "12, Main St, Green Valley",      timings: "8 AM – 10 PM", status: "approved", rating: 4.6, review_count: 28, logo: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80"  },
  { owner_idx: 1, name: "Anand Dairy Fresh", category: "Dairy",               location_name: "Milk Lane",      address: "5, Milk Lane, Sector 4",         timings: "6 AM – 8 PM",  status: "approved", rating: 4.8, review_count: 44, logo: "https://images.unsplash.com/photo-1563636619-e9107da5a163?w=400&q=80"  },
  { owner_idx: 2, name: "Priya Bakery",      category: "Bakery & Snacks",     location_name: "Central Market", address: "27, Baker St, Central Market",   timings: "7 AM – 9 PM",  status: "approved", rating: 4.7, review_count: 16, logo: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80" },
  { owner_idx: 2, name: "Priya Vegetables",  category: "Vegetables & Fruits", location_name: "Green Valley",   address: "8, Veggie Row, Green Valley",    timings: "7 AM – 7 PM",  status: "approved", rating: 4.5, review_count: 19, logo: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80"  },
  { owner_idx: 2, name: "Priya Beverages",   category: "Beverages",           location_name: "Food Plaza",     address: "3, Food Plaza, Block B",         timings: "9 AM – 11 PM", status: "approved", rating: 4.4, review_count: 8,  logo: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80"  },
  { owner_idx: 1, name: "Anand Household",   category: "Household",           location_name: "Old Town",       address: "101, Old Town Bazaar",           timings: "9 AM – 8 PM",  status: "pending",  rating: 4.3, review_count: 0,  logo: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80"  },
];

const PRODUCTS = [
  // Anand Groceries (shop 0)
  { shop_idx: 0, name: "Basmati Rice (5 kg)",   category: "Grocery",             price: 320, mrp: 370, unit: "5 kg bag",    stock: 50,  image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80" },
  { shop_idx: 0, name: "Toor Dal (1 kg)",        category: "Grocery",             price: 130, mrp: 145, unit: "1 kg",        stock: 80,  image: "https://images.unsplash.com/photo-1585996853881-dad6643844b6?w=400&q=80" },
  { shop_idx: 0, name: "Sunflower Oil (1 L)",    category: "Grocery",             price: 155, mrp: 175, unit: "1 L bottle",  stock: 30,  image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80" },
  { shop_idx: 0, name: "Sugar (1 kg)",           category: "Grocery",             price: 45,  mrp: 50,  unit: "1 kg",        stock: 100, image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80" },
  { shop_idx: 0, name: "Wheat Flour (5 kg)",     category: "Grocery",             price: 210, mrp: 230, unit: "5 kg bag",    stock: 60,  image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80" },
  { shop_idx: 0, name: "Chana Dal (500 g)",      category: "Grocery",             price: 65,  mrp: 72,  unit: "500 g",       stock: 45,  image: "https://images.unsplash.com/photo-1585996853881-dad6643844b6?w=400&q=80" },
  { shop_idx: 0, name: "Mustard Oil (1 L)",      category: "Grocery",             price: 175, mrp: 195, unit: "1 L bottle",  stock: 20,  image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80" },
  { shop_idx: 0, name: "Salt (1 kg)",            category: "Grocery",             price: 18,  mrp: 20,  unit: "1 kg",        stock: 200, image: "https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=400&q=80" },
  // Anand Dairy Fresh (shop 1)
  { shop_idx: 1, name: "Full Cream Milk (1 L)",  category: "Dairy",               price: 62,  mrp: 65,  unit: "1 L pouch",   stock: 120, image: "https://images.unsplash.com/photo-1563636619-e9107da5a163?w=400&q=80"  },
  { shop_idx: 1, name: "Paneer (200 g)",         category: "Dairy",               price: 90,  mrp: 100, unit: "200 g pack",  stock: 40,  image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=80" },
  { shop_idx: 1, name: "Butter (100 g)",         category: "Dairy",               price: 55,  mrp: 60,  unit: "100 g",       stock: 30,  image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80" },
  { shop_idx: 1, name: "Fresh Curd (500 g)",     category: "Dairy",               price: 40,  mrp: 45,  unit: "500 g",       stock: 60,  image: "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&q=80" },
  { shop_idx: 1, name: "Ghee (500 g)",           category: "Dairy",               price: 280, mrp: 320, unit: "500 g jar",   stock: 15,  image: "https://images.unsplash.com/photo-1631125915902-d8abe9225ff2?w=400&q=80" },
  { shop_idx: 1, name: "Cheese Slices (200 g)",  category: "Dairy",               price: 110, mrp: 125, unit: "200 g box",   stock: 25,  image: "https://images.unsplash.com/photo-1552767059-ce182ead6c1b?w=400&q=80"  },
  // Priya Bakery (shop 2)
  { shop_idx: 2, name: "Multigrain Bread",       category: "Bakery & Snacks",     price: 40,  mrp: 45,  unit: "400 g loaf",  stock: 25,  image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80" },
  { shop_idx: 2, name: "Butter Cookies (200 g)", category: "Bakery & Snacks",     price: 60,  mrp: 70,  unit: "200 g box",   stock: 15,  image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80"  },
  { shop_idx: 2, name: "Croissant (4 pcs)",      category: "Bakery & Snacks",     price: 90,  mrp: 100, unit: "4 pieces",    stock: 20,  image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80"  },
  { shop_idx: 2, name: "Chocolate Cake (500 g)", category: "Bakery & Snacks",     price: 250, mrp: 290, unit: "500 g cake",  stock: 8,   image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80" },
  { shop_idx: 2, name: "White Bread",            category: "Bakery & Snacks",     price: 30,  mrp: 35,  unit: "400 g loaf",  stock: 30,  image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80" },
  // Priya Vegetables (shop 3)
  { shop_idx: 3, name: "Tomatoes (1 kg)",        category: "Vegetables & Fruits", price: 40,  mrp: 50,  unit: "1 kg",        stock: 80,  image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80" },
  { shop_idx: 3, name: "Onions (1 kg)",          category: "Vegetables & Fruits", price: 35,  mrp: 40,  unit: "1 kg",        stock: 100, image: "https://images.unsplash.com/photo-1508747703725-719777637510?w=400&q=80" },
  { shop_idx: 3, name: "Potatoes (1 kg)",        category: "Vegetables & Fruits", price: 30,  mrp: 35,  unit: "1 kg",        stock: 120, image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80" },
  { shop_idx: 3, name: "Spinach (250 g)",        category: "Vegetables & Fruits", price: 20,  mrp: 25,  unit: "250 g bunch", stock: 50,  image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&q=80" },
  { shop_idx: 3, name: "Capsicum (500 g)",       category: "Vegetables & Fruits", price: 45,  mrp: 55,  unit: "500 g",       stock: 40,  image: "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&q=80"  },
  { shop_idx: 3, name: "Carrots (500 g)",        category: "Vegetables & Fruits", price: 25,  mrp: 30,  unit: "500 g",       stock: 60,  image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&q=80" },
  { shop_idx: 3, name: "Coriander Leaves (100 g)",category: "Vegetables & Fruits",price: 15,  mrp: 20,  unit: "100 g bunch", stock: 70,  image: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400&q=80" },
  // Priya Beverages (shop 4)
  { shop_idx: 4, name: "Mango Juice (1 L)",      category: "Beverages",           price: 85,  mrp: 95,  unit: "1 L carton",  stock: 40,  image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&q=80"  },
  { shop_idx: 4, name: "Mineral Water (1 L)",    category: "Beverages",           price: 20,  mrp: 20,  unit: "1 L bottle",  stock: 200, image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80"  },
  { shop_idx: 4, name: "Green Tea (25 bags)",    category: "Beverages",           price: 120, mrp: 140, unit: "25 bags box", stock: 30,  image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80"  },
  { shop_idx: 4, name: "Coca-Cola (2 L)",        category: "Beverages",           price: 90,  mrp: 95,  unit: "2 L bottle",  stock: 50,  image: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80"  },
  { shop_idx: 4, name: "Orange Juice (1 L)",     category: "Beverages",           price: 80,  mrp: 90,  unit: "1 L carton",  stock: 35,  image: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80" },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function run() {
  await db.init();

  if (RESET) {
    db.dropAll();
    db.createSchema();
    console.log("  Tables dropped and recreated.");
  }

  const seedTx = db.transaction(() => {
    // ── Users ──
    const userObjs = [];
    for (const u of USERS) {
      let obj = db.prepare("SELECT * FROM users WHERE uid = ?").get(u.uid);
      if (!obj) {
        const r = db.prepare(
          "INSERT INTO users (uid, email, display_name, role, phone, password_hash) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(u.uid, u.email, u.display_name, u.role, u.phone, hash(u.password));
        obj = db.prepare("SELECT * FROM users WHERE id = ?").get(r.lastInsertRowid);
      } else {
        db.prepare("UPDATE users SET phone = ?, password_hash = COALESCE(password_hash, ?) WHERE id = ?")
          .run(u.phone, hash(u.password), obj.id);
        obj = db.prepare("SELECT * FROM users WHERE id = ?").get(obj.id);
      }
      userObjs.push(obj);
    }

    // ── Subscriptions for owners ──
    for (const ownerIdx of [1, 2]) {
      const owner = userObjs[ownerIdx];
      const sub   = db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(owner.id);
      const now   = new Date().toISOString();
      const exp   = daysFromNow(30);
      if (!sub) {
        db.prepare(
          "INSERT INTO subscriptions (user_id, plan_amount, status, starts_at, expires_at) VALUES (?, 10.0, 'active', ?, ?)"
        ).run(owner.id, now, exp);
      } else if (sub.status !== "active") {
        db.prepare("UPDATE subscriptions SET status = 'active', starts_at = ?, expires_at = ? WHERE id = ?")
          .run(now, exp, sub.id);
      }
    }

    // ── Shops ──
    const shopObjs = [];
    for (const s of SHOPS) {
      let obj = db.prepare("SELECT * FROM shops WHERE name = ?").get(s.name);
      if (!obj) {
        const owner = userObjs[s.owner_idx];
        const r = db.prepare(
          "INSERT INTO shops (owner_id, name, address, category, location_name, status, logo, timings, rating, review_count) VALUES (?,?,?,?,?,?,?,?,?,?)"
        ).run(owner.id, s.name, s.address, s.category, s.location_name, s.status, s.logo, s.timings, s.rating, s.review_count);
        obj = db.prepare("SELECT * FROM shops WHERE id = ?").get(r.lastInsertRowid);
      }
      shopObjs.push(obj);
    }

    // ── Products ──
    const prodObjs = [];
    for (const p of PRODUCTS) {
      const shop = shopObjs[p.shop_idx];
      let obj = db.prepare("SELECT * FROM products WHERE shop_id = ? AND name = ?").get(shop.id, p.name);
      if (!obj) {
        const r = db.prepare(
          "INSERT INTO products (shop_id, name, price, mrp, unit, category, stock, image) VALUES (?,?,?,?,?,?,?,?)"
        ).run(shop.id, p.name, p.price, p.mrp, p.unit, p.category, p.stock, p.image);
        obj = db.prepare("SELECT * FROM products WHERE id = ?").get(r.lastInsertRowid);
      }
      prodObjs.push(obj);
    }

    // ── Sample orders for Ravi ──
    const ravi = userObjs[3];
    const hasOrders = db.prepare("SELECT id FROM orders WHERE customer_id = ?").get(ravi.id);
    if (!hasOrders) {
      const rice  = prodObjs[0]; // Basmati Rice
      const dal   = prodObjs[1]; // Toor Dal
      const milk  = prodObjs[8]; // Full Cream Milk

      // Order 1 — delivered
      const o1 = db.prepare(
        "INSERT INTO orders (shop_id, shop_name, customer_id, total, status, payment_status, delivery_address, created_at) VALUES (?,?,?,?,?,?,?,?)"
      ).run(shopObjs[0].id, shopObjs[0].name, ravi.id, rice.price + dal.price, "delivered", "paid", "42, Green Valley Road", daysAgo(2));
      db.prepare("INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?,?,?,?,?)").run(o1.lastInsertRowid, rice.id, rice.name, rice.price, 1);
      db.prepare("INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?,?,?,?,?)").run(o1.lastInsertRowid, dal.id,  dal.name,  dal.price,  1);

      // Order 2 — accepted
      const o2 = db.prepare(
        "INSERT INTO orders (shop_id, shop_name, customer_id, total, status, payment_status, delivery_address, created_at) VALUES (?,?,?,?,?,?,?,?)"
      ).run(shopObjs[1].id, shopObjs[1].name, ravi.id, milk.price * 2, "accepted", "pending", "42, Green Valley Road", hoursAgo(3));
      db.prepare("INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?,?,?,?,?)").run(o2.lastInsertRowid, milk.id, milk.name, milk.price, 2);
    }
  });

  seedTx();

  console.log("\nSeed complete!");
  console.log("\n  Demo credentials:");
  console.log("  ─────────────────────────────────────────────────────────");
  console.log("  Admin    : senamallas@gmail.com  / Admin@123    | +91-9000000001");
  console.log("  Owner 1  : anand@example.com     / Owner@123    | +91-9000000002");
  console.log("  Owner 2  : priya@example.com     / Owner@123    | +91-9000000003");
  console.log("  Customer : ravi@example.com      / Customer@123 | +91-9000000004");
  console.log("  Customer : kavita@example.com    / Customer@123 | +91-9000000005");
  console.log("\n  Subscriptions: Anand & Priya are ACTIVE (30 days from now, ₹10/month)");
  console.log("  ─────────────────────────────────────────────────────────\n");
}

run().catch(err => { console.error(err); process.exit(1); });
