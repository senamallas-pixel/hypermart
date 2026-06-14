# Hostinger CI/CD (GitHub Actions)

Three workflows deploy HyperMart to Hostinger Premium shared hosting:

| Workflow | File | Trigger | What it does |
|----------|------|---------|--------------|
| Frontend | `.github/workflows/deploy-hostinger-frontend.yml` | push to `main` touching `frontend/**` (or manual) | `npm ci && npm run build`, FTP-upload `frontend/dist/` → `public_html/` |
| PHP API  | `.github/workflows/deploy-hostinger-php.yml` | push to `main` touching `Backend_php/**` (or manual) | `php -l` lint, FTP-upload `Backend_php/` → `public_html/api/` |
| DB schema | `.github/workflows/deploy-hostinger-db.yml` | manual only | SSH in, run `mysql < schema.sql` (idempotent); optional destructive reseed |

## One-time setup

### 1. GitHub → Settings → Secrets and variables → Actions → **Secrets**

| Secret | Used by | Where to find it |
|--------|---------|------------------|
| `HOSTINGER_FTP_SERVER` | frontend, php | hPanel → Files → FTP Accounts (host, e.g. `ftp.hypershopindia.com`) |
| `HOSTINGER_FTP_USERNAME` | frontend, php | FTP account username |
| `HOSTINGER_FTP_PASSWORD` | frontend, php | FTP account password |
| `HOSTINGER_SSH_HOST` | db | hPanel → Advanced → SSH Access |
| `HOSTINGER_SSH_USERNAME` | db | SSH username |
| `HOSTINGER_SSH_PASSWORD` | db | SSH password (or switch the action to a key) |
| `DB_NAME` / `DB_USER` / `DB_PASS` | db | hPanel → Databases → MySQL Databases |

### 2. GitHub → ... → **Variables** (optional — sensible defaults exist)

| Variable | Default | Notes |
|----------|---------|-------|
| `HOSTINGER_WEB_DIR` | `public_html/` | frontend upload target |
| `HOSTINGER_API_DIR` | `public_html/api/` | PHP upload target (FTP path) |
| `HOSTINGER_API_DIR_FS` | `public_html/api` | API path relative to SSH home (for the DB workflow) |
| `HOSTINGER_SSH_PORT` | `65002` | Hostinger's default SSH port |

### 3. Server-side `.env` (once, by hand)
Create `public_html/api/.env` from `Backend_php/.env.example` with real DB creds, a strong
`JWT_SECRET`, and any Razorpay/OpenAI/Cloudinary keys. **The PHP workflow never overwrites it**
(`.env` is excluded from the upload).

## First deploy order

1. Push `main` → **frontend** + **PHP** workflows run (or trigger each via *Actions → Run workflow*).
2. Create the server `.env` (step 3 above) if not done.
3. Run **Apply DB Schema on Hostinger** manually with `apply_schema = true`. For a fresh demo
   dataset, also set `reseed = true` (⚠️ drops all tables first).
4. Verify: `https://hypershopindia.com/api/shops` returns JSON, and `https://hypershopindia.com`
   loads the app.

## Notes
- The frontend sync **excludes `api/**`** so deploying the static site never deletes the PHP backend
  that lives under the same web root.
- FTP uses **FTPS** (encrypted). If your FTP account is plain FTP, change `protocol: ftps` → `ftp`.
- The frontend build bakes `VITE_API_URL=https://hypershopindia.com/api` from `frontend/.env.production`.
  Update that file if your domain/path differs.
