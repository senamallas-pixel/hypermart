"use strict";
/**
 * HyperMart — SQLite wrapper using sql.js (pure WASM, no native bindings).
 * Exposes an API compatible with better-sqlite3 so index.js / seed.js are
 * unchanged: db.prepare(sql).get(...), .all(...), .run(...) and db.transaction().
 */

const initSqlJs = require("sql.js");
const fs        = require("fs");
const path      = require("path");

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "hypermart.db");

// ── Schema SQL ────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    uid           TEXT    UNIQUE NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    display_name  TEXT    NOT NULL,
    photo_url     TEXT,
    role          TEXT    NOT NULL DEFAULT 'customer',
    phone         TEXT,
    password_hash TEXT,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_login    TEXT
  );
  CREATE TABLE IF NOT EXISTS shops (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    address       TEXT    NOT NULL,
    category      TEXT    NOT NULL,
    location_name TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'pending',
    logo          TEXT,
    timings       TEXT,
    lat           REAL,
    lng           REAL,
    rating        REAL    NOT NULL DEFAULT 4.5,
    review_count  INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE TABLE IF NOT EXISTS products (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id    INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    price      REAL    NOT NULL,
    mrp        REAL    NOT NULL,
    unit       TEXT    NOT NULL,
    category   TEXT    NOT NULL,
    stock      INTEGER NOT NULL DEFAULT 0,
    image      TEXT,
    status     TEXT    NOT NULL DEFAULT 'active',
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE TABLE IF NOT EXISTS orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id          INTEGER NOT NULL REFERENCES shops(id),
    shop_name        TEXT    NOT NULL,
    customer_id      INTEGER NOT NULL REFERENCES users(id),
    total            REAL    NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'pending',
    payment_status   TEXT    NOT NULL DEFAULT 'pending',
    delivery_address TEXT    NOT NULL,
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at       TEXT
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    name       TEXT    NOT NULL,
    price      REAL    NOT NULL,
    quantity   INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan_amount  REAL    NOT NULL DEFAULT 10.0,
    status       TEXT    NOT NULL DEFAULT 'pending',
    starts_at    TEXT,
    expires_at   TEXT,
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`;

// Convert undefined → null so sql.js binding never chokes
function normalize(params) {
  return params.map(p => (p === undefined ? null : p));
}

// ── DB wrapper class ──────────────────────────────────────────────────────────

class DB {
  constructor() {
    this._db             = null;
    this._inTransaction  = false;
  }

  // Must be called once before any other method (awaited at server startup).
  async init() {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const buf  = fs.readFileSync(DB_PATH);
      this._db   = new SQL.Database(buf);
    } else {
      this._db   = new SQL.Database();
    }
    // Pragmas
    this._db.run("PRAGMA foreign_keys = ON");
    this._db.run("PRAGMA synchronous = NORMAL");
    // Create tables if needed
    this.createSchema();
    return this;
  }

  createSchema() {
    this._db.exec(SCHEMA_SQL);
    this._save();
  }

  dropAll() {
    this._db.exec(`
      DROP TABLE IF EXISTS order_items;
      DROP TABLE IF EXISTS orders;
      DROP TABLE IF EXISTS products;
      DROP TABLE IF EXISTS shops;
      DROP TABLE IF EXISTS subscriptions;
      DROP TABLE IF EXISTS users;
    `);
    this._save();
  }

  // Returns an object with .get(), .all(), .run() — matches better-sqlite3 API.
  prepare(sql) {
    const self = this;
    return {
      get(...args) {
        const params = normalize(args.flat());
        const stmt   = self._db.prepare(sql);
        stmt.bind(params);
        const row = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();
        return row;
      },
      all(...args) {
        const params = normalize(args.flat());
        const stmt   = self._db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
      run(...args) {
        const params = normalize(args.flat());
        self._db.run(sql, params);
        const rowid = self._db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] ?? 0;
        if (!self._inTransaction) self._save();
        return { lastInsertRowid: rowid };
      },
    };
  }

  exec(sql) {
    this._db.exec(sql);
    if (!this._inTransaction) this._save();
  }

  // Returns a callable that wraps fn in BEGIN / COMMIT / ROLLBACK.
  transaction(fn) {
    const self = this;
    return (...args) => {
      self._db.run("BEGIN");
      self._inTransaction = true;
      try {
        const result = fn(...args);
        self._db.run("COMMIT");
        self._inTransaction = false;
        self._save();
        return result;
      } catch (err) {
        self._db.run("ROLLBACK");
        self._inTransaction = false;
        throw err;
      }
    };
  }

  _save() {
    const data = this._db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

module.exports = new DB();
