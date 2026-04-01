"use strict";
/**
 * HyperMart — Express / better-sqlite3 / JWT backend
 * Drop-in replacement for the Python FastAPI server.
 * All routes, auth logic, and business rules are faithfully ported.
 *
 * Start:  node index.js
 * Dev:    node --watch index.js
 */

require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const db         = require("./db");

const app  = express();
const PORT = process.env.PORT || 8000;

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const SECRET_KEY          = process.env.JWT_SECRET || "hypermart-dev-secret-change-in-production";
const TOKEN_EXPIRY        = "30d";
const ADMIN_EMAIL         = "senamallas@gmail.com";
const SUBSCRIPTION_AMOUNT = 10.0;

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// Enums (for validation)
// ─────────────────────────────────────────────────────────────────────────────

const USER_ROLES    = ["customer", "owner", "admin"];
const SHOP_STATUSES = ["pending", "approved", "suspended"];
const SHOP_CATS     = ["Grocery", "Dairy", "Vegetables & Fruits", "Meat", "Bakery & Snacks", "Beverages", "Household", "Personal Care"];
const SHOP_LOCS     = ["Green Valley", "Central Market", "Food Plaza", "Milk Lane", "Old Town"];
const PROD_STATUSES = ["active", "out_of_stock"];
const ORDER_STATUSES = ["pending", "accepted", "ready", "out_for_delivery", "delivered", "rejected"];
const PAYMENT_STATUSES = ["pending", "paid"];
const SUB_STATUSES  = ["pending", "active", "expired"];

const ORDER_TRANSITIONS = {
  pending:          ["accepted", "rejected"],
  accepted:         ["ready", "rejected"],
  ready:            ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered:        [],
  rejected:         [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────────

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hashed) {
  return bcrypt.compareSync(plain, hashed);
}

function createAccessToken(userId) {
  return jwt.sign({ sub: String(userId) }, SECRET_KEY, { expiresIn: TOKEN_EXPIRY });
}

function decodeToken(token) {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────────────────────────────────────

function getUser(req) {
  const header = req.headers["authorization"] || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload) return null;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(payload.sub));
  if (!user) return null;
  // Always enforce admin for admin email
  if (user.email === ADMIN_EMAIL && user.role !== "admin") {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
    user.role = "admin";
  }
  return user;
}

function requireAuth(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ detail: "Not authenticated" });
  req.user = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ detail: "Not authenticated" });
    if (!roles.includes(user.role)) return res.status(403).json({ detail: "Insufficient permissions" });
    req.user = user;
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Business-rule helpers
// ─────────────────────────────────────────────────────────────────────────────

function checkSubscription(user, res) {
  if (user.role !== "owner") return true;
  const sub = db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(user.id);
  if (!sub || sub.status !== "active") {
    res.status(402).json({ detail: "Active subscription required. Subscribe for ₹10/month to manage shops." });
    return false;
  }
  if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
    db.prepare("UPDATE subscriptions SET status = 'expired' WHERE id = ?").run(sub.id);
    res.status(402).json({ detail: "Your subscription has expired. Please renew for ₹10/month." });
    return false;
  }
  return true;
}

function assertShopOwnership(shop, user, res) {
  if (user.role === "admin") return true;
  if (user.role === "owner" && shop.owner_id === user.id) return true;
  res.status(403).json({ detail: "Not authorised for this shop" });
  return false;
}

function serializeUser(u) {
  return {
    id:           u.id,
    uid:          u.uid,
    email:        u.email,
    display_name: u.display_name,
    photo_url:    u.photo_url || null,
    role:         u.role,
    phone:        u.phone || null,
    address:      u.address || null,
    created_at:   u.created_at,
    last_login:   u.last_login || null,
  };
}

function serializeShop(s) {
  return {
    id:            s.id,
    owner_id:      s.owner_id,
    name:          s.name,
    address:       s.address,
    category:      s.category,
    location_name: s.location_name,
    status:        s.status,
    logo:          s.logo || null,
    timings:       s.timings || null,
    lat:           s.lat ?? null,
    lng:           s.lng ?? null,
    rating:        s.rating,
    review_count:  s.review_count,
    created_at:    s.created_at,
  };
}

function serializeProduct(p) {
  return {
    id:         p.id,
    shop_id:    p.shop_id,
    name:       p.name,
    price:      p.price,
    mrp:        p.mrp,
    unit:       p.unit,
    category:   p.category,
    stock:      p.stock,
    image:      p.image || null,
    status:     p.status,
    created_at: p.created_at,
  };
}

function serializeOrderItem(i) {
  return {
    id:         i.id,
    product_id: i.product_id,
    name:       i.name,
    price:      i.price,
    quantity:   i.quantity,
    line_total: Math.round(i.price * i.quantity * 100) / 100,
  };
}

function serializeOrder(o) {
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(o.id);
  return {
    id:               o.id,
    shop_id:          o.shop_id,
    shop_name:        o.shop_name,
    customer_id:      o.customer_id,
    items:            items.map(serializeOrderItem),
    total:            o.total,
    status:           o.status,
    payment_status:   o.payment_status,
    delivery_address: o.delivery_address,
    created_at:       o.created_at,
    updated_at:       o.updated_at || null,
  };
}

function serializeSubscription(s) {
  return {
    id:          s.id,
    user_id:     s.user_id,
    plan_amount: s.plan_amount,
    status:      s.status,
    starts_at:   s.starts_at || null,
    expires_at:  s.expires_at || null,
    created_at:  s.created_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

// POST /auth/register
app.post("/auth/register", (req, res) => {
  const { email, password, display_name, phone, role } = req.body;
  if (!email || !password || !display_name) {
    return res.status(422).json({ detail: "email, password, and display_name are required" });
  }
  if (password.length < 6) {
    return res.status(422).json({ detail: "Password must be at least 6 characters" });
  }
  if (display_name.trim().length < 2) {
    return res.status(422).json({ detail: "Name must be at least 2 characters" });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    return res.status(400).json({ detail: "Email already registered" });
  }
  const assignedRole = email === ADMIN_EMAIL ? "admin" : (USER_ROLES.includes(role) ? role : "customer");
  const uid = uuidv4();
  const result = db.prepare(
    "INSERT INTO users (uid, email, display_name, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(uid, email, display_name.trim(), phone || null, assignedRole, hashPassword(password));

  const userId = result.lastInsertRowid;

  if (assignedRole === "owner") {
    db.prepare("INSERT INTO subscriptions (user_id) VALUES (?)").run(userId);
  }

  const user  = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  const token = createAccessToken(user.id);
  return res.status(201).json({ access_token: token, token_type: "bearer", user: serializeUser(user) });
});

// POST /auth/login
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(422).json({ detail: "email and password are required" });
  }
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ detail: "Invalid email or password" });
  }
  if (user.email === ADMIN_EMAIL && user.role !== "admin") {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
    user.role = "admin";
  }
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(now, user.id);
  user.last_login = now;
  const token = createAccessToken(user.id);
  return res.json({ access_token: token, token_type: "bearer", user: serializeUser(user) });
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

// GET /users/me
app.get("/users/me", requireAuth, (req, res) => {
  res.json(serializeUser(req.user));
});

// PATCH /users/me
app.patch("/users/me", requireAuth, (req, res) => {
  const { display_name, photo_url, role, phone, address } = req.body;
  const u = req.user;
  const updates = {};
  if (display_name !== undefined) updates.display_name = display_name;
  if (photo_url    !== undefined) updates.photo_url    = photo_url;
  if (phone        !== undefined) updates.phone        = phone;
  if (address      !== undefined) updates.address      = address;
  if (role !== undefined && u.role === "admin") updates.role = role;

  if (Object.keys(updates).length) {
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(", ");
    db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...Object.values(updates), u.id);
  }
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(u.id);
  res.json(serializeUser(updated));
});

// POST /users/me/change-password
app.post("/users/me/change-password", requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(422).json({ detail: "current_password and new_password are required" });
  }
  if (new_password.length < 6) {
    return res.status(422).json({ detail: "New password must be at least 6 characters" });
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user.password_hash || !verifyPassword(current_password, user.password_hash)) {
    return res.status(401).json({ detail: "Current password is incorrect" });
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(new_password), user.id);
  res.json({ message: "Password changed successfully" });
});

// GET /users  (admin only)
app.get("/users", requireRole("admin"), (req, res) => {
  const users = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  res.json(users.map(serializeUser));
});

// PATCH /users/:id/role  (admin only)
app.patch("/users/:id/role", requireRole("admin"), (req, res) => {
  const userId = Number(req.params.id);
  const user   = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ detail: "User not found" });
  const { role } = req.body;
  if (role && USER_ROLES.includes(role)) {
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
  }
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  res.json(serializeUser(updated));
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

// GET /subscriptions/me
app.get("/subscriptions/me", requireRole("owner", "admin"), (req, res) => {
  let sub = db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(req.user.id);
  if (!sub) return res.status(404).json({ detail: "No subscription found" });
  if (sub.expires_at && new Date(sub.expires_at) < new Date() && sub.status === "active") {
    db.prepare("UPDATE subscriptions SET status = 'expired' WHERE id = ?").run(sub.id);
    sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(sub.id);
  }
  res.json(serializeSubscription(sub));
});

// POST /subscriptions/activate
app.post("/subscriptions/activate", requireRole("owner", "admin"), (req, res) => {
  const now   = new Date();
  const nowIso = now.toISOString();
  let sub = db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(req.user.id);

  if (sub) {
    const base = (sub.expires_at && new Date(sub.expires_at) > now)
      ? new Date(sub.expires_at)
      : now;
    const expiresAt = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      "UPDATE subscriptions SET status = 'active', starts_at = ?, expires_at = ?, plan_amount = ? WHERE id = ?"
    ).run(nowIso, expiresAt, SUBSCRIPTION_AMOUNT, sub.id);
    sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(sub.id);
  } else {
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const r = db.prepare(
      "INSERT INTO subscriptions (user_id, plan_amount, status, starts_at, expires_at) VALUES (?, ?, 'active', ?, ?)"
    ).run(req.user.id, SUBSCRIPTION_AMOUNT, nowIso, expiresAt);
    sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(r.lastInsertRowid);
  }
  res.json(serializeSubscription(sub));
});

// GET /subscriptions  (admin only)
app.get("/subscriptions", requireRole("admin"), (req, res) => {
  const subs = db.prepare("SELECT * FROM subscriptions ORDER BY created_at DESC").all();
  res.json(subs.map(serializeSubscription));
});

// ─────────────────────────────────────────────────────────────────────────────
// SHOPS
// ─────────────────────────────────────────────────────────────────────────────

// GET /shops
app.get("/shops", (req, res) => {
  const user     = getUser(req);
  const isAdmin  = user && user.role === "admin";
  const { location, category, status, search, page = 1, size = 20 } = req.query;

  let sql    = "SELECT * FROM shops WHERE 1=1";
  const args = [];

  if (isAdmin && status) {
    sql += " AND status = ?"; args.push(status);
  } else if (!isAdmin) {
    sql += " AND status = 'approved'";
  }
  if (location) { sql += " AND location_name = ?"; args.push(location); }
  if (category) { sql += " AND category = ?";      args.push(category); }
  if (search) {
    sql += " AND (name LIKE ? OR category LIKE ?)";
    args.push(`%${search}%`, `%${search}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM (${sql})`).get(...args).c;
  const p = Math.max(1, Number(page));
  const s = Math.min(500, Math.max(1, Number(size)));
  const items = db.prepare(`${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, s, (p - 1) * s);
  res.json({ items: items.map(serializeShop), total, page: p, size: s });
});

// POST /shops
app.post("/shops", requireRole("owner", "admin"), (req, res) => {
  if (!checkSubscription(req.user, res)) return;
  const { name, address, category, location_name, logo, timings, lat, lng } = req.body;
  if (!name || !address || !category || !location_name) {
    return res.status(422).json({ detail: "name, address, category, and location_name are required" });
  }
  if (name.trim().length < 3) return res.status(422).json({ detail: "Shop name must be at least 3 characters" });
  if (!SHOP_CATS.includes(category))  return res.status(422).json({ detail: "Invalid category" });
  if (!SHOP_LOCS.includes(location_name)) return res.status(422).json({ detail: "Invalid location" });

  const r = db.prepare(
    "INSERT INTO shops (owner_id, name, address, category, location_name, logo, timings, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(req.user.id, name.trim(), address, category, location_name, logo || null, timings || null, lat ?? null, lng ?? null);
  const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(serializeShop(shop));
});

// GET /shops/:id
app.get("/shops/:id", (req, res) => {
  const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(Number(req.params.id));
  if (!shop) return res.status(404).json({ detail: "Shop not found" });
  res.json(serializeShop(shop));
});

// PATCH /shops/:id
app.patch("/shops/:id", requireAuth, (req, res) => {
  const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(Number(req.params.id));
  if (!shop) return res.status(404).json({ detail: "Shop not found" });
  if (!assertShopOwnership(shop, req.user, res)) return;

  const allowed = ["name", "address", "category", "location_name", "logo", "timings", "lat", "lng"];
  if (req.user.role === "admin") allowed.push("status");
  const updates = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (Object.keys(updates).length) {
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(", ");
    db.prepare(`UPDATE shops SET ${sets} WHERE id = ?`).run(...Object.values(updates), shop.id);
  }
  const updated = db.prepare("SELECT * FROM shops WHERE id = ?").get(shop.id);
  res.json(serializeShop(updated));
});

// PATCH /shops/:id/status  (admin only)
app.patch("/shops/:id/status", requireRole("admin"), (req, res) => {
  const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(Number(req.params.id));
  if (!shop) return res.status(404).json({ detail: "Shop not found" });
  const { status } = req.body;
  if (!SHOP_STATUSES.includes(status)) return res.status(422).json({ detail: "Invalid status" });
  db.prepare("UPDATE shops SET status = ? WHERE id = ?").run(status, shop.id);
  const updated = db.prepare("SELECT * FROM shops WHERE id = ?").get(shop.id);
  res.json(serializeShop(updated));
});

// DELETE /shops/:id  (admin only)
app.delete("/shops/:id", requireRole("admin"), (req, res) => {
  const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(Number(req.params.id));
  if (!shop) return res.status(404).json({ detail: "Shop not found" });
  db.prepare("DELETE FROM shops WHERE id = ?").run(shop.id);
  res.status(204).end();
});

// GET /owners/me/shops
app.get("/owners/me/shops", requireRole("owner", "admin"), (req, res) => {
  const shops = db.prepare("SELECT * FROM shops WHERE owner_id = ?").all(req.user.id);
  res.json(shops.map(serializeShop));
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /shops/:shopId/products
app.get("/shops/:shopId/products", (req, res) => {
  const shopId    = Number(req.params.shopId);
  const activeOnly = req.query.active_only !== "false";
  let sql  = "SELECT * FROM products WHERE shop_id = ?";
  const args = [shopId];
  if (activeOnly) { sql += " AND status = 'active'"; }
  const products = db.prepare(`${sql} ORDER BY name`).all(...args);
  res.json(products.map(serializeProduct));
});

// POST /shops/:shopId/products
app.post("/shops/:shopId/products", requireAuth, (req, res) => {
  const shopId = Number(req.params.shopId);
  const shop   = db.prepare("SELECT * FROM shops WHERE id = ?").get(shopId);
  if (!shop) return res.status(404).json({ detail: "Shop not found" });
  if (!assertShopOwnership(shop, req.user, res)) return;

  const { name, price, mrp, unit, category, stock = 0, image, status = "active" } = req.body;
  if (!name || price === undefined || mrp === undefined || !unit || !category) {
    return res.status(422).json({ detail: "name, price, mrp, unit, and category are required" });
  }
  if (price <= 0 || mrp <= 0) return res.status(422).json({ detail: "Price must be greater than zero" });
  if (mrp < price)            return res.status(422).json({ detail: "MRP must be >= selling price" });
  if (stock < 0)              return res.status(422).json({ detail: "Stock cannot be negative" });

  const r = db.prepare(
    "INSERT INTO products (shop_id, name, price, mrp, unit, category, stock, image, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(shopId, name, price, mrp, unit, category, stock, image || null, status);
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(serializeProduct(product));
});

// PATCH /shops/:shopId/products/:productId
app.patch("/shops/:shopId/products/:productId", requireAuth, (req, res) => {
  const shopId    = Number(req.params.shopId);
  const productId = Number(req.params.productId);
  const product   = db.prepare("SELECT * FROM products WHERE id = ? AND shop_id = ?").get(productId, shopId);
  if (!product) return res.status(404).json({ detail: "Product not found" });
  const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(shopId);
  if (!assertShopOwnership(shop, req.user, res)) return;

  const allowed = ["name", "price", "mrp", "unit", "category", "stock", "image", "status"];
  const updates = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (Object.keys(updates).length) {
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(", ");
    db.prepare(`UPDATE products SET ${sets} WHERE id = ?`).run(...Object.values(updates), productId);
  }
  const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
  res.json(serializeProduct(updated));
});

// DELETE /shops/:shopId/products/:productId
app.delete("/shops/:shopId/products/:productId", requireAuth, (req, res) => {
  const shopId    = Number(req.params.shopId);
  const productId = Number(req.params.productId);
  const product   = db.prepare("SELECT * FROM products WHERE id = ? AND shop_id = ?").get(productId, shopId);
  if (!product) return res.status(404).json({ detail: "Product not found" });
  const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(shopId);
  if (!assertShopOwnership(shop, req.user, res)) return;

  const activeOrders = db.prepare(`
    SELECT COUNT(*) as c FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.product_id = ?
      AND o.status NOT IN ('delivered', 'rejected')
  `).get(productId).c;
  if (activeOrders) return res.status(409).json({ detail: "Product has active orders — cannot delete" });

  db.prepare("DELETE FROM products WHERE id = ?").run(productId);
  res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────────────────

// POST /orders
app.post("/orders", requireRole("customer"), (req, res) => {
  const { shop_id, items, delivery_address = "Default Address" } = req.body;
  if (!shop_id || !items || !items.length) {
    return res.status(422).json({ detail: "shop_id and at least one item are required" });
  }
  const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(shop_id);
  if (!shop || shop.status !== "approved") {
    return res.status(404).json({ detail: "Shop not found or not available" });
  }

  const placeOrderTx = db.transaction(() => {
    const orderItems = [];
    let total = 0;
    for (const item of items) {
      if (!item.product_id || item.quantity < 1) {
        throw Object.assign(new Error("Invalid item"), { status: 422 });
      }
      const product = db.prepare("SELECT * FROM products WHERE id = ?").get(item.product_id);
      if (!product || product.shop_id !== shop.id) {
        throw Object.assign(new Error(`Product ${item.product_id} not found in this shop`), { status: 422 });
      }
      if (product.stock < item.quantity) {
        throw Object.assign(new Error(`Insufficient stock for '${product.name}'`), { status: 422 });
      }
      orderItems.push({ product, quantity: item.quantity });
      total += product.price * item.quantity;
      db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(item.quantity, product.id);
    }

    const total_rounded = Math.round(total * 100) / 100;
    const r = db.prepare(
      "INSERT INTO orders (shop_id, shop_name, customer_id, total, delivery_address) VALUES (?, ?, ?, ?, ?)"
    ).run(shop.id, shop.name, req.user.id, total_rounded, delivery_address);
    const orderId = r.lastInsertRowid;

    for (const { product, quantity } of orderItems) {
      db.prepare(
        "INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)"
      ).run(orderId, product.id, product.name, product.price, quantity);
    }

    return db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  });

  try {
    const order = placeOrderTx();
    res.status(201).json(serializeOrder(order));
  } catch (err) {
    res.status(err.status || 500).json({ detail: err.message });
  }
});

// GET /orders/me
app.get("/orders/me", requireRole("customer"), (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const size  = Math.min(100, Math.max(1, Number(req.query.size || 20)));
  const total = db.prepare("SELECT COUNT(*) as c FROM orders WHERE customer_id = ?").get(req.user.id).c;
  const orders = db.prepare(
    "SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(req.user.id, size, (page - 1) * size);
  res.json({ items: orders.map(serializeOrder), total, page, size });
});

// GET /shops/:shopId/orders
app.get("/shops/:shopId/orders", requireAuth, (req, res) => {
  const shopId = Number(req.params.shopId);
  const shop   = db.prepare("SELECT * FROM shops WHERE id = ?").get(shopId);
  if (!shop) return res.status(404).json({ detail: "Shop not found" });
  if (!assertShopOwnership(shop, req.user, res)) return;

  const page  = Math.max(1, Number(req.query.page || 1));
  const size  = Math.min(100, Math.max(1, Number(req.query.size || 20)));
  const total = db.prepare("SELECT COUNT(*) as c FROM orders WHERE shop_id = ?").get(shopId).c;
  const orders = db.prepare(
    "SELECT * FROM orders WHERE shop_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(shopId, size, (page - 1) * size);
  res.json({ items: orders.map(serializeOrder), total, page, size });
});

// PATCH /orders/:id/status
app.patch("/orders/:id/status", requireAuth, (req, res) => {
  const orderId = Number(req.params.id);
  const order   = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) return res.status(404).json({ detail: "Order not found" });

  if (req.user.role !== "admin") {
    const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(order.shop_id);
    if (!shop || shop.owner_id !== req.user.id) {
      return res.status(403).json({ detail: "Not authorised to update this order" });
    }
  }

  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(422).json({ detail: "Invalid status value" });
  }
  const allowed = ORDER_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    return res.status(422).json({
      detail: `Cannot transition from '${order.status}' to '${status}'. Allowed: ${allowed.join(", ") || "none"}`
    });
  }

  const updatedAt = new Date().toISOString();
  db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, updatedAt, orderId);
  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  res.json(serializeOrder(updated));
});

// ─────────────────────────────────────────────────────────────────────────────
// WALK-IN / POS BILLING
// ─────────────────────────────────────────────────────────────────────────────

// POST /shops/:shopId/walkin-order  (owner creates order for walk-in customer)
app.post("/shops/:shopId/walkin-order", requireRole("owner"), (req, res) => {
  const shopId = Number(req.params.shopId);
  const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(shopId);
  if (!shop) return res.status(404).json({ detail: "Shop not found" });
  if (!assertShopOwnership(shop, req.user, res)) return;
  if (shop.status !== "approved") {
    return res.status(403).json({ detail: "Shop must be approved to create orders" });
  }

  const { items, customer_name = "Walk-in Customer", payment_status = "paid" } = req.body;
  if (!items || !items.length) {
    return res.status(422).json({ detail: "At least one item is required" });
  }
  if (!["paid", "pending"].includes(payment_status)) {
    return res.status(422).json({ detail: "payment_status must be 'paid' or 'pending'" });
  }

  const placeTx = db.transaction(() => {
    const orderItems = [];
    let total = 0;
    for (const item of items) {
      if (!item.product_id || item.quantity < 1) {
        throw Object.assign(new Error("Invalid item"), { status: 422 });
      }
      const product = db.prepare("SELECT * FROM products WHERE id = ?").get(item.product_id);
      if (!product || product.shop_id !== shop.id) {
        throw Object.assign(new Error(`Product ${item.product_id} not found in this shop`), { status: 422 });
      }
      if (product.stock < item.quantity) {
        throw Object.assign(new Error(`Insufficient stock for '${product.name}'`), { status: 422 });
      }
      orderItems.push({ product, quantity: item.quantity });
      total += product.price * item.quantity;
      db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(item.quantity, product.id);
    }

    const total_rounded = Math.round(total * 100) / 100;
    const r = db.prepare(
      "INSERT INTO orders (shop_id, shop_name, customer_id, total, status, payment_status, delivery_address) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(shop.id, shop.name, req.user.id, total_rounded, "delivered", payment_status, "Walk-in: " + customer_name);
    const orderId = r.lastInsertRowid;

    for (const { product, quantity } of orderItems) {
      db.prepare(
        "INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)"
      ).run(orderId, product.id, product.name, product.price, quantity);
    }

    return db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  });

  try {
    const order = placeTx();
    res.status(201).json(serializeOrder(order));
  } catch (err) {
    res.status(err.status || 500).json({ detail: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

// GET /analytics/platform  (admin only)
app.get("/analytics/platform", requireRole("admin"), (req, res) => {
  const deliveredRev = db.prepare(
    "SELECT COALESCE(SUM(total), 0) as rev FROM orders WHERE status = 'delivered'"
  ).get().rev;
  const activeSubs = db.prepare(
    "SELECT COUNT(*) as c FROM subscriptions WHERE status = 'active'"
  ).get().c;
  res.json({
    total_shops:          db.prepare("SELECT COUNT(*) as c FROM shops").get().c,
    approved_shops:       db.prepare("SELECT COUNT(*) as c FROM shops WHERE status = 'approved'").get().c,
    total_users:          db.prepare("SELECT COUNT(*) as c FROM users").get().c,
    total_orders:         db.prepare("SELECT COUNT(*) as c FROM orders").get().c,
    delivered_revenue:    Math.round(deliveredRev * 100) / 100,
    active_subscriptions: activeSubs,
  });
});

// GET /shops/:shopId/analytics
app.get("/shops/:shopId/analytics", requireAuth, (req, res) => {
  const shopId = Number(req.params.shopId);
  const shop   = db.prepare("SELECT * FROM shops WHERE id = ?").get(shopId);
  if (!shop) return res.status(404).json({ detail: "Shop not found" });
  if (!assertShopOwnership(shop, req.user, res)) return;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayOrders = db.prepare(
    "SELECT * FROM orders WHERE shop_id = ? AND created_at >= ?"
  ).all(shopId, todayStart.toISOString());

  const lowStock = db.prepare(
    "SELECT name, stock FROM products WHERE shop_id = ? AND stock <= 5 AND status = 'active'"
  ).all(shopId);

  const todaySales = todayOrders.reduce((sum, o) => sum + o.total, 0);

  // ── Daily sales for last 7 days ──
  const dailySales = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d); dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd   = new Date(d); dayEnd.setUTCHours(23, 59, 59, 999);
    const row = db.prepare(
      "SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders FROM orders WHERE shop_id = ? AND created_at >= ? AND created_at <= ?"
    ).get(shopId, dayStart.toISOString(), dayEnd.toISOString());
    dailySales.push({
      date: dayStart.toISOString().slice(0, 10),
      day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: Math.round(row.revenue * 100) / 100,
      orders: row.orders,
    });
  }

  // ── Revenue by category ──
  const categoryRevenue = db.prepare(`
    SELECT p.category, COALESCE(SUM(oi.price * oi.quantity), 0) as revenue, SUM(oi.quantity) as qty
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.shop_id = ?
    GROUP BY p.category
    ORDER BY revenue DESC
  `).all(shopId);

  // ── Top selling products (with revenue) ──
  const topProducts = db.prepare(`
    SELECT oi.product_id, oi.name, SUM(oi.quantity) as quantity_sold, 
           ROUND(SUM(oi.price * oi.quantity), 2) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.shop_id = ?
    GROUP BY oi.product_id
    ORDER BY quantity_sold DESC
    LIMIT 10
  `).all(shopId);

  // ── Orders by status ──
  const statusRows = db.prepare(
    "SELECT status, COUNT(*) as count FROM orders WHERE shop_id = ? GROUP BY status"
  ).all(shopId);
  const ordersByStatus = {};
  statusRows.forEach(r => { ordersByStatus[r.status] = r.count; });

  // ── Monthly revenue (last 6 months) ──
  const monthlyRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const row = db.prepare(
      "SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders FROM orders WHERE shop_id = ? AND created_at >= ? AND created_at <= ?"
    ).get(shopId, mStart.toISOString(), mEnd.toISOString());
    monthlyRevenue.push({
      month: mStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      revenue: Math.round(row.revenue * 100) / 100,
      orders: row.orders,
    });
  }

  // ── Total all-time metrics ──
  const allTime = db.prepare(
    "SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders FROM orders WHERE shop_id = ?"
  ).get(shopId);

  const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setUTCHours(0, 0, 0, 0);
  const ordersThisMonth = db.prepare(
    "SELECT COUNT(*) as c FROM orders WHERE shop_id = ? AND created_at >= ?"
  ).get(shopId, thisMonthStart.toISOString()).c;

  res.json({
    today_sales:      Math.round(todaySales * 100) / 100,
    today_orders:     todayOrders.length,
    total_products:   db.prepare("SELECT COUNT(*) as c FROM products WHERE shop_id = ?").get(shopId).c,
    low_stock_items:  lowStock,
    total_revenue:    Math.round(allTime.revenue * 100) / 100,
    total_orders:     allTime.orders,
    orders_this_month: ordersThisMonth,
    daily_sales:      dailySales,
    category_revenue: categoryRevenue,
    top_products:     topProducts,
    orders_by_status: ordersByStatus,
    monthly_revenue:  monthlyRevenue,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

async function startServer() {
  await db.init();
  app.listen(PORT, () => {
    console.log(`\nHyperMart API (Node.js) running on http://localhost:${PORT}`);
    console.log("  POST /auth/register  POST /auth/login");
    console.log("  GET  /shops          GET  /shops/:id");
    console.log("  POST /orders         GET  /orders/me");
    console.log("  GET  /analytics/platform\n");
  });
}

startServer().catch(err => { console.error("Failed to start server:", err); process.exit(1); });
