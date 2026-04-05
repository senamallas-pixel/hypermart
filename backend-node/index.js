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
const multer     = require("multer");
const path       = require("path");
const fs         = require("fs");
const db         = require("./db");

const app  = express();
const PORT = process.env.PORT || 8000;

// ─────────────────────────────────────────────────────────────────────────────
// File upload setup (multer)
// ─────────────────────────────────────────────────────────────────────────────

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"));
  },
});

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
app.use("/uploads", express.static(UPLOADS_DIR));

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
    id:               s.id,
    owner_id:         s.owner_id,
    name:             s.name,
    address:          s.address,
    category:         s.category,
    location_name:    s.location_name,
    status:           s.status,
    logo:             s.logo || null,
    timings:          s.timings || null,
    lat:              s.lat ?? null,
    lng:              s.lng ?? null,
    rating:           s.rating,
    review_count:     s.review_count,
    is_open:          s.is_open ?? 1,
    schedule:         s.schedule ? JSON.parse(s.schedule) : null,
    unavailable_dates: s.unavailable_dates ? JSON.parse(s.unavailable_dates) : [],
    created_at:       s.created_at,
  };
}

function serializeProduct(p) {
  return {
    id:          p.id,
    shop_id:     p.shop_id,
    name:        p.name,
    description: p.description || null,
    price:       p.price,
    mrp:         p.mrp,
    unit:        p.unit,
    category:    p.category,
    stock:       p.stock,
    image:       p.image || null,
    status:      p.status,
    created_at:  p.created_at,
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

// GET /users/:id  (admin only, or self)
app.get("/users/:id", requireAuth, (req, res) => {
  const userId = Number(req.params.id);
  if (req.user.role !== "admin" && req.user.id !== userId) {
    return res.status(403).json({ detail: "Insufficient permissions" });
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ detail: "User not found" });
  res.json(serializeUser(user));
});

// DELETE /users/:id  (admin only)
app.delete("/users/:id", requireRole("admin"), (req, res) => {
  const userId = Number(req.params.id);
  const user   = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ detail: "User not found" });
  if (user.email === ADMIN_EMAIL) {
    return res.status(403).json({ detail: "Cannot delete the primary admin account" });
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  res.status(204).end();
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

// GET /shops/nearby  — find shops within a radius using Haversine formula
// IMPORTANT: must be defined before /shops/:id to avoid route collision
app.get("/shops/nearby", (req, res) => {
  const { lat, lng, radius = 2, category, search } = req.query;
  if (!lat || !lng) return res.status(422).json({ detail: "lat and lng query parameters are required" });
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const maxKm   = parseFloat(radius);
  if (isNaN(userLat) || isNaN(userLng) || isNaN(maxKm)) {
    return res.status(422).json({ detail: "lat, lng, and radius must be valid numbers" });
  }

  let sql = "SELECT * FROM shops WHERE status = 'approved' AND lat IS NOT NULL AND lng IS NOT NULL";
  const args = [];
  if (category) { sql += " AND category = ?"; args.push(category); }
  if (search) { sql += " AND (name LIKE ? OR category LIKE ?)"; args.push(`%${search}%`, `%${search}%`); }

  const allShops = db.prepare(sql).all(...args);

  // Haversine distance in km
  const toRad = deg => deg * Math.PI / 180;
  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const nearby = allShops
    .map(s => {
      const dist = haversine(userLat, userLng, s.lat, s.lng);
      return { ...serializeShop(s), distance_km: Math.round(dist * 100) / 100 };
    })
    .filter(s => s.distance_km <= maxKm)
    .sort((a, b) => a.distance_km - b.distance_km);

  res.json({ items: nearby, total: nearby.length, radius_km: maxKm, center: { lat: userLat, lng: userLng } });
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

  const allowed = ["name", "address", "category", "location_name", "logo", "timings", "lat", "lng", "is_open", "schedule", "unavailable_dates"];
  if (req.user.role === "admin") allowed.push("status");
  const updates = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      // JSON-stringify objects for storage
      if ((k === "schedule" || k === "unavailable_dates") && typeof req.body[k] === "object") {
        updates[k] = JSON.stringify(req.body[k]);
      } else {
        updates[k] = req.body[k];
      }
    }
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

  const { name, description, price, mrp, unit, category, stock = 0, image, status = "active" } = req.body;
  if (!name || price === undefined || mrp === undefined || !unit || !category) {
    return res.status(422).json({ detail: "name, price, mrp, unit, and category are required" });
  }
  if (price <= 0 || mrp <= 0) return res.status(422).json({ detail: "Price must be greater than zero" });
  if (mrp < price)            return res.status(422).json({ detail: "MRP must be >= selling price" });
  if (stock < 0)              return res.status(422).json({ detail: "Stock cannot be negative" });

  const r = db.prepare(
    "INSERT INTO products (shop_id, name, description, price, mrp, unit, category, stock, image, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(shopId, name, description || null, price, mrp, unit, category, stock, image || null, status);
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

  const allowed = ["name", "description", "price", "mrp", "unit", "category", "stock", "image", "status"];
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
      "INSERT INTO orders (shop_id, shop_name, customer_id, total, delivery_address, order_type) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(shop.id, shop.name, req.user.id, total_rounded, delivery_address, "online");
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

// POST /shops/:shopId/walkin-order  (owner or admin creates order for walk-in customer)
app.post("/shops/:shopId/walkin-order", requireRole("owner", "admin"), (req, res) => {
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
      "INSERT INTO orders (shop_id, shop_name, customer_id, total, status, payment_status, delivery_address, order_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(shop.id, shop.name, req.user.id, total_rounded, "delivered", payment_status, "Walk-in: " + customer_name, "walk_in");
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
    
    // Get total sales for the day
    const row = db.prepare(
      "SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders FROM orders WHERE shop_id = ? AND created_at >= ? AND created_at <= ?"
    ).get(shopId, dayStart.toISOString(), dayEnd.toISOString());
    
    // Get walk-in sales for the day
    const walkInRow = db.prepare(
      "SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE shop_id = ? AND order_type = 'walk_in' AND created_at >= ? AND created_at <= ?"
    ).get(shopId, dayStart.toISOString(), dayEnd.toISOString());
    
    // Get online sales for the day
    const onlineRow = db.prepare(
      "SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE shop_id = ? AND order_type = 'online' AND created_at >= ? AND created_at <= ?"
    ).get(shopId, dayStart.toISOString(), dayEnd.toISOString());
    
    dailySales.push({
      date: dayStart.toISOString().slice(0, 10),
      day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: Math.round(row.revenue * 100) / 100,
      walk_in: Math.round(walkInRow.revenue * 100) / 100,
      online: Math.round(onlineRow.revenue * 100) / 100,
      orders: row.orders,
    });
  }

  // ── Daily sales for current month (for calendar view) ──
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  
  const monthlyDailySales = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const dayStart = new Date(d); dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd   = new Date(d); dayEnd.setUTCHours(23, 59, 59, 999);
    
    // Get total sales for the day
    const row = db.prepare(
      "SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders FROM orders WHERE shop_id = ? AND created_at >= ? AND created_at <= ?"
    ).get(shopId, dayStart.toISOString(), dayEnd.toISOString());
    
    // Get walk-in sales for the day
    const walkInRow = db.prepare(
      "SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE shop_id = ? AND order_type = 'walk_in' AND created_at >= ? AND created_at <= ?"
    ).get(shopId, dayStart.toISOString(), dayEnd.toISOString());
    
    // Get online sales for the day
    const onlineRow = db.prepare(
      "SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE shop_id = ? AND order_type = 'online' AND created_at >= ? AND created_at <= ?"
    ).get(shopId, dayStart.toISOString(), dayEnd.toISOString());
    
    monthlyDailySales.push({
      date: dayStart.toISOString().slice(0, 10),
      day: day,
      dayName: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: Math.round(row.revenue * 100) / 100,
      walk_in: Math.round(walkInRow.revenue * 100) / 100,
      online: Math.round(onlineRow.revenue * 100) / 100,
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
    monthly_daily_sales: monthlyDailySales,
    category_revenue: categoryRevenue,
    top_products:     topProducts,
    orders_by_status: ordersByStatus,
    monthly_revenue:  monthlyRevenue,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FILE UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

// POST /upload  — upload a single image file, returns { url: "/uploads/<filename>" }
app.post("/upload", requireAuth, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ detail: "File too large. Maximum size is 5 MB." });
      }
      return res.status(400).json({ detail: err.message });
    }
    if (err) {
      return res.status(400).json({ detail: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ detail: "No file provided" });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AI ENDPOINTS (Gemini 2.0 Flash)
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL     = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error("Gemini API key not configured");
  const resp = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Gemini error ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.candidates[0].content.parts[0].text.trim();
}

// GET /ai/status
app.get("/ai/status", (_req, res) => {
  res.json({ available: Boolean(GEMINI_API_KEY) });
});

// POST /ai/suggest-products
app.post("/ai/suggest-products", async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(503).json({ detail: "AI service not configured" });
  const { category = "Grocery", partial_name = "" } = req.body;
  if (!partial_name.trim()) return res.status(422).json({ detail: "partial_name is required" });
  try {
    const prompt =
      `You are a product naming assistant for an Indian grocery/retail store.\n` +
      `Category: ${category}\n` +
      `Partial name: "${partial_name}"\n` +
      `Suggest 5 complete, realistic product names that match this category and start with or relate to "${partial_name}".\n` +
      `Each name should be specific (include brand, weight, or variety if appropriate).\n` +
      `Respond ONLY with a JSON array of 5 strings. No explanation, no markdown.`;
    const raw   = await callGemini(prompt);
    const match = raw.match(/\[[\s\S]*\]/);
    const suggestions = match ? JSON.parse(match[0]) : [];
    res.json({ suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 5) : [] });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /ai/generate-description
app.post("/ai/generate-description", async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(503).json({ detail: "AI service not configured" });
  const { name, category } = req.body;
  if (!name || !category) return res.status(422).json({ detail: "name and category are required" });
  try {
    const prompt =
      `Write a single short sentence (max 15 words) describing "${name}" ` +
      `for an online grocery store in the "${category}" category.\n` +
      `Highlight freshness, quality, or value.\n` +
      `Respond with ONLY the description sentence, no quotes.`;
    const raw = await callGemini(prompt);
    res.json({ description: raw.replace(/^["']|["']$/g, "").replace(/\.$/, "") });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /ai/low-stock-insight
app.post("/ai/low-stock-insight", async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(503).json({ detail: "AI service not configured" });
  const { shop_name, low_stock_items } = req.body;
  if (!low_stock_items || !low_stock_items.length) {
    return res.status(422).json({ detail: "low_stock_items is required" });
  }
  try {
    const itemsList = low_stock_items.join(", ");
    const prompt =
      `You are an inventory advisor for a grocery store named "${shop_name || "the store"}".\n` +
      `The following products are running low on stock (5 units or fewer): ${itemsList}\n` +
      `Give 2-3 short, practical sentences of advice on restocking priorities and what to order first.\n` +
      `Consider typical demand patterns for Indian grocery stores.\n` +
      `Respond in plain text, no bullet points or headers.`;
    const insight = await callGemini(prompt);
    res.json({ insight });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /ai/chat — Conversational AI with rolling history and role-based system context
app.post("/ai/chat", async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(503).json({ detail: "AI service not configured" });
  const { message, role = "customer", shop_id, history = [] } = req.body;
  if (!message || !String(message).trim()) {
    return res.status(422).json({ detail: "message is required" });
  }

  const roleContext = {
    customer: (
      "You are HyperMart Assistant, a helpful shopping assistant for a hyperlocal " +
      "marketplace in India. Help customers find products, compare shops, and get " +
      "shopping advice. Be friendly, concise, and use ₹ for prices."
    ),
    owner: (
      "You are HyperMart Business Assistant, an AI advisor for shop owners. " +
      "Help with inventory decisions, pricing strategies, sales trends, and " +
      "business growth tips relevant to small Indian neighbourhood shops."
    ),
    admin: (
      "You are HyperMart Admin Assistant. Help with platform governance, " +
      "shop approval decisions, user management issues, and analytics interpretation."
    ),
  }[role] || "You are a helpful assistant for the HyperMart marketplace.";

  const shopContext = shop_id ? ` The user is currently managing shop ID ${shop_id}.` : "";

  const historyText = (Array.isArray(history) ? history.slice(-10) : [])
    .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt =
    `${roleContext}${shopContext}\n\n` +
    `${historyText ? historyText + "\n" : ""}` +
    `User: ${message}\nAssistant:`;

  try {
    const reply = await callGemini(prompt);
    res.json({ reply, tools_used: [], sources: [] });
  } catch (_) {
    res.json({
      reply: "I'm having trouble connecting right now. Please try again shortly.",
      tools_used: [],
      sources: [],
    });
  }
});

// POST /ai/sales-forecast  (auth required)
app.post("/ai/sales-forecast", requireAuth, async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(503).json({ detail: "AI service not configured" });
  const { shop_id } = req.body;
  if (!shop_id) return res.status(422).json({ detail: "shop_id is required" });
  const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(Number(shop_id));
  if (!shop) return res.status(404).json({ detail: "Shop not found" });
  if (!assertShopOwnership(shop, req.user, res)) return;

  // Collect last 30 days of daily revenue
  const dailyData = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d); dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd   = new Date(d); dayEnd.setUTCHours(23, 59, 59, 999);
    const row = db.prepare(
      "SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE shop_id = ? AND created_at >= ? AND created_at <= ?"
    ).get(Number(shop_id), dayStart.toISOString(), dayEnd.toISOString());
    dailyData.push({ date: dayStart.toISOString().slice(0, 10), revenue: Math.round(row.revenue * 100) / 100 });
  }

  const last7      = dailyData.slice(-7).map(d => d.revenue);
  const avgRevenue = last7.reduce((s, v) => s + v, 0) / 7;

  // 7-day simple forecast with ±10 % jitter
  const forecast = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    forecast.push({
      date:              d.toISOString().slice(0, 10),
      day:               d.toLocaleDateString("en-US", { weekday: "short" }),
      predicted_revenue: Math.round(avgRevenue * (0.9 + Math.random() * 0.2) * 100) / 100,
    });
  }

  try {
    const prompt =
      `You are a retail sales analyst. A grocery store named "${shop.name}" had the following ` +
      `daily revenue (INR) over the last 7 days: ${last7.map((v, i) => `Day ${i + 1}: ₹${v}`).join(", ")}.\n` +
      `Average daily revenue: ₹${Math.round(avgRevenue)}.\n` +
      `Give 2-3 sentences of sales forecast insight for the next 7 days, considering typical Indian grocery demand. Plain text only.`;
    const insight = await callGemini(prompt);
    res.json({ forecast, insight, avg_daily_revenue: Math.round(avgRevenue * 100) / 100 });
  } catch (_) {
    res.json({ forecast, insight: null, avg_daily_revenue: Math.round(avgRevenue * 100) / 100 });
  }
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
