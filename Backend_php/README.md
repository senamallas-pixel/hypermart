# HyperMart — PHP API (`Backend_php/`)

A dependency-free PHP 8 + MySQL port of the Python FastAPI backend (now `Backend_python/`), built to run on
**Hostinger Premium shared hosting** (which runs PHP + MySQL but cannot run Python/Node
app servers). It reproduces the same REST contract, so the unchanged React frontend works
against it by only pointing `VITE_API_URL` at `https://<your-domain>/api`.

- No Composer / external libraries — JWT (HS256), HMAC, base64url are native PHP; OpenAI
  and Razorpay are plain cURL calls; image uploads are stored on the local (Hostinger) filesystem.
- Front controller (`index.php`) + `.htaccess` route all `/api/*` requests through a tiny router.
- `src/` holds the framework (`Database`, `Auth`, `Router`, `Present`, `Enums`, `Validation`)
  and `src/controllers/` holds one controller per route group.

## Layout

```
Backend_php/
  index.php        Front controller (bootstrap, CORS, dispatch, error→JSON)
  .htaccess        Rewrite to index.php; deny direct access to src/, .env, *.sql, config.php
  config.php       Loads .env, exposes env() + now_utc()
  .env.example     Copy to .env and fill in
  schema.sql       MySQL schema (13 tables) — import once
  seed.php         Demo data (CLI or token-guarded HTTP)
  src/             Database, Auth, Router, Request, Response, Enums, Present, Validation, AiTools
  src/controllers/ Auth, User, Subscription, Shop, Product, Order, Payment, Analytics,
                   Supplier, PurchaseOrder, Discount, Upload, Ai
```

## Deploy to Hostinger (hPanel)

1. **Create a MySQL database**: hPanel → *Databases → MySQL Databases*. Note host, db name,
   user, password.
2. **Import the schema**: open *phpMyAdmin* for that DB → *Import* → upload `schema.sql`.
3. **Upload the API**: put the **contents of `Backend_php/`** into `public_html/api/`.
4. **Create `public_html/api/.env`** from `.env.example` with the real DB credentials, a strong
   `JWT_SECRET`, and (optionally) Razorpay / OpenAI keys. Set a `SEED_TOKEN` if you
   plan to seed over HTTP.
5. **Seed demo data (optional)**: visit `https://<domain>/api/seed.php?token=<SEED_TOKEN>`
   (add `&reset=1` to drop+recreate tables first). Then blank out `SEED_TOKEN` or delete
   `seed.php`. From SSH you can instead run `php seed.php --reset`.
6. **PHP version**: ensure PHP ≥ 8.0 (hPanel → *PHP Configuration*) with `pdo_mysql`, `curl`,
   `mbstring`, `openssl` enabled (Hostinger defaults).
7. **Frontend**: build with `VITE_API_URL=https://<domain>/api` (see `frontend/.env.production`)
   and upload `frontend/dist/` contents into `public_html/`. Enable free SSL in hPanel.

After deploy, `GET https://<domain>/api/shops` should return JSON.

## Local development

```bash
# from the repo root, with PHP 8 + a local MySQL
mysql -u root -p -e "CREATE DATABASE hypermart"
mysql -u root -p hypermart < Backend_php/schema.sql
cp Backend_php/.env.example Backend_php/.env          # set DB_* + JWT_SECRET
php Backend_php/seed.php                       # demo data
php -S localhost:8000 Backend_php/index.php    # API at http://localhost:8000
```
Point the web app at it with `VITE_API_URL=http://localhost:8000` and run `npm run dev`.

## Notes

- **Passwords** use PHP bcrypt (the Python backend used passlib `pbkdf2_sha256`). This is a fresh
  database re-seeded from scratch, so there are no legacy hashes to migrate. Demo credentials are
  unchanged (`ravi@example.com` / `Customer@123`, etc.).
- **Enums**: category/location are stored as the SQLAlchemy *keys* (`vegetables`, `green_valley`)
  and exchanged over the API as *values* (`Vegetables & Fruits`, `Green Valley`), matching the
  original backend and the frontend. `src/Enums.php` does the mapping.
- **Optional services** (AI, Razorpay) return `503`/degrade gracefully when their env
  keys are unset — identical to the Python backend. Image uploads are written to the local
  `uploads/` folder and served from `/api/uploads/`.
- The existing `Backend_python/` (Python) and `backend-node/` remain untouched as references.
