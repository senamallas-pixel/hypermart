# HyperMart Environment Variables Reference Guide

## Overview

This project uses environment variables for configuration across different deployment environments (local, staging, production). This guide explains all available variables and how to configure them.

## File Structure

```
hypermart/
├── backend/.env.example          # Python/FastAPI backend configuration
├── backend-node/.env.example     # Node.js/Express backend configuration
├── frontend/.env.example         # React/Vite frontend configuration
└── ENV_GUIDE.md                  # This file
```

## PostgreSQL Database Connection

**Connection String Format:**
```
postgresql://username:password@hostname:port/database
```

**Render PostgreSQL Details:**
- **Hostname:** `dpg-d7dbcdt7vec73819d70-a`
- **Port:** `5432`
- **Database:** `hypermart`
- **Username:** `hypermart_user`
- **Password:** Available in Render PostgreSQL dashboard

**Full Connection String:**
```
postgresql://hypermart_user:[YOUR_PASSWORD]@dpg-d7dbcdt7vec73819d70-a:5432/hypermart
```

**Where to Get Password:**
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Navigate to your PostgreSQL database
3. Look for "Internal/External Database URL"
4. Copy the entire connection string (password is embedded)

## Quick Setup Instructions

### 1. Backend (Python/FastAPI)

```bash
cd backend
cp .env.example .env
```

**Edit `.env`:**
```bash
# Required
DATABASE_URL=postgresql://hypermart_user:[PASSWORD]@dpg-d7dbcdt7vec73819d70-a:5432/hypermart
JWT_SECRET=$(openssl rand -hex 32)

# Optional (for features)
GEMINI_API_KEY=your-key-here
RAZORPAY_KEY_ID=rzp_test_ScGuDdSnrFFMy2
RAZORPAY_KEY_SECRET=your-secret-here
```

### 2. Frontend (React/Vite)

```bash
cd frontend
cp .env.example .env
```

**Edit `.env`:**
```bash
# Local development
VITE_API_URL=http://localhost:8000

# Production (set in Vercel dashboard instead)
# VITE_API_URL=https://hypermart-ukg0.onrender.com
```

### 3. Backend Node.js (Alternative)

```bash
cd backend-node
cp .env.example .env
```

**Edit `.env`:**
```bash
DATABASE_URL=postgresql://hypermart_user:[PASSWORD]@dpg-d7dbcdt7vec73819d70-a:5432/hypermart
JWT_SECRET=$(openssl rand -hex 32)
```

## Environment Variables Reference

### Backend Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | ✅ Yes | Secret key for JWT tokens (32+ chars) | `openssl rand -hex 32` |
| `GEMINI_API_KEY` | No | Google Gemini API key for AI features | `AIza...` |
| `RAZORPAY_KEY_ID` | No | Razorpay public key for payments | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | No | Razorpay secret key | `secret...` |
| `MAX_UPLOAD_MB` | No | Max file upload size (default: 10) | `10` |
| `SQL_ECHO` | No | Enable SQL query logging | `false` |

### Frontend Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_API_URL` | ✅ Yes | Backend API base URL | `http://localhost:8000` |
| `VITE_RAZORPAY_KEY_ID` | No | Razorpay public key (frontend) | `rzp_test_...` |
| `VITE_ENABLE_AI` | No | Enable AI features | `true` |
| `VITE_ENABLE_UPI` | No | Enable UPI payments | `true` |

## Deployment Configurations

### Local Development

**Backend:**
```bash
DATABASE_URL=sqlite:///./hypermart.db  # Or PostgreSQL if available locally
JWT_SECRET=dev-secret-not-for-production
PORT=8000
```

**Frontend:**
```bash
VITE_API_URL=http://localhost:8000
```

### Render (Production Backend)

Set in Render Dashboard → hypermart-api → Environment:

| Variable | Value | Source |
|---|---|---|
| `DATABASE_URL` | From PostgreSQL database | Auto-linked from database |
| `JWT_SECRET` | Generated secure value | `openssl rand -hex 32` |
| `GEMINI_API_KEY` | Your API key | Google AI Studio |
| `RAZORPAY_KEY_ID` | Live key for production | Razorpay Dashboard |
| `RAZORPAY_KEY_SECRET` | Live secret | Razorpay Dashboard |

### Vercel (Production Frontend)

Set in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Value | Environment |
|---|---|---|
| `VITE_API_URL` | `https://hypermart-ukg0.onrender.com` | Production, Preview, Development |

## Security Best Practices

### ✅ Do's

- ✅ Use strong, randomly generated `JWT_SECRET` (32+ characters)
- ✅ Keep `.env` files in `.gitignore`
- ✅ Use different secrets for dev/staging/production
- ✅ Rotate secrets regularly
- ✅ Use test keys for Razorpay in development
- ✅ Enable GitHub secret scanning
- ✅ Use environment-specific values

### ❌ Don'ts

- ❌ Never commit `.env` files to git
- ❌ Don't use weak or default secrets in production
- ❌ Don't share secrets via email/chat
- ❌ Don't expose database credentials in logs
- ❌ Don't use production keys in development
- ❌ Don't hardcode secrets in source code

## Generating Secrets

### JWT Secret (Required)

**Unix/Linux/MacOS:**
```bash
openssl rand -hex 32
```

**Windows PowerShell:**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

**Online (Not Recommended for Production):**
- https://generate-secret.vercel.app/

### API Keys

- **Google Gemini:** https://makersuite.google.com/app/apikey
- **Razorpay:** https://dashboard.razorpay.com/app/keys
- **Vercel Token:** https://vercel.com/account/tokens

## Troubleshooting

### "Invalid database URL"

**Cause:** Malformed PostgreSQL connection string

**Fix:**
- Verify format: `postgresql://user:pass@host:port/database`
- Check for special characters in password (URL encode if needed)
- Ensure hostname is correct: `dpg-d7dbcdt7vec73819d70-a`

### "JWT token verification failed"

**Cause:** Mismatched `JWT_SECRET` between environments

**Fix:**
- Ensure same `JWT_SECRET` in Render environment variable
- Re-login to get new token with correct secret

### "Cannot connect to database"

**Cause:** Database not accessible or wrong credentials

**Fix:**
- Check PostgreSQL is running (Render dashboard)
- Verify connection string includes correct password
- Check network connectivity
- Try internal vs external URL on Render

### Frontend can't reach backend

**Cause:** Wrong `VITE_API_URL` value

**Fix:**
- Local: Use `http://localhost:8000`
- Production: Use `https://hypermart-ukg0.onrender.com`
- Check CORS is configured in backend

## Migration from SQLite to PostgreSQL

See [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md) for detailed migration guide.

**Quick Migration:**
1. Update `DATABASE_URL` in Render
2. Redeploy backend (auto-creates tables)
3. Run `migrate-to-postgres.ps1` to seed data

## Support Resources

- **Render Docs:** https://render.com/docs/environment-variables
- **Vite Env Guide:** https://vitejs.dev/guide/env-and-mode.html
- **PostgreSQL Connection:** https://www.postgresql.org/docs/current/libpq-connect.html
- **FastAPI Settings:** https://fastapi.tiangolo.com/advanced/settings/
