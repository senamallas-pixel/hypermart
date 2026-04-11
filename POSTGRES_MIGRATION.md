# PostgreSQL Migration Guide

This guide walks you through migrating HyperMart from SQLite to PostgreSQL on Render.

## Overview

**Current Setup:** SQLite (ephemeral, resets on redeploys)
**Target Setup:** PostgreSQL (persistent, managed database)

## Prerequisites

✅ PostgreSQL database created on Render
✅ Backend code updated for PostgreSQL support
✅ `psycopg2-binary` added to requirements.txt

## Migration Steps

### Step 1: Update Render Environment Variable

1. Go to [Render Dashboard](https://dashboard.render.com/d/dpg-d7dbcdt7vec73819d70-a)
2. Select your **hypermart-api** web service
3. Go to **Environment** tab
4. Find the `DATABASE_URL` variable
5. Click **Edit** and update the value to your PostgreSQL connection string:

   ```
   postgresql://hypermart_user:[PASSWORD]@dpg-d7dbcdt7vec73819d70-a:5432/hypermart
   ```

   **Get the exact connection string:**
   - Go to your PostgreSQL database page in Render
   - Copy the **External Database URL**
   - Paste it as the `DATABASE_URL` value

6. Click **Save Changes**

### Step 2: Trigger Redeploy

After updating the environment variable, Render will automatically redeploy your backend service.

**Monitor the deployment:**
- Go to **Logs** tab in your web service
- Watch for:
  - ✅ `pip install -r requirements.txt` (should install `psycopg2-binary`)
  - ✅ `Application startup complete`
  - ✅ No database connection errors

**Expected deployment time:** 2-5 minutes

### Step 3: Verify Connection

Once deployed, verify the backend can connect to PostgreSQL:

```powershell
# Check backend health
curl https://hypermart-ukg0.onrender.com/docs
```

You should see the FastAPI docs page.

### Step 4: Run Migration & Seeding Script

Run the migration script to create tables and seed data:

```powershell
.\migrate-to-postgres.ps1
```

**What this script does:**
1. ✅ Verifies backend is responding
2. ✅ Waits for automatic migrations (FastAPI creates tables on startup)
3. ✅ Creates 4 demo users (admin, 2 owners, 1 customer)
4. ✅ Creates 5 shops across different categories
5. ✅ Creates 20 products distributed across shops

### Step 5: Test the Application

Visit the frontend and test with demo credentials:

**Frontend:** https://frontend-phi-five-15.vercel.app

**Demo Credentials:**
- **Admin:** senamallas@gmail.com / Admin@123
- **Owner 1:** anand@example.com / Owner@123 (owns 2 shops)
- **Owner 2:** priya@example.com / Owner@123 (owns 3 shops)
- **Customer:** ravi@example.com / Customer@123

**Test Scenarios:**
1. ✅ Customer login → Browse shops → Place order
2. ✅ Owner login → View dashboard → Create walk-in order → Test UPI payment
3. ✅ Admin login → Access admin panel

## Database Connection Details

From your Render PostgreSQL dashboard:

```
Hostname:     dpg-d7dbcdt7vec73819d70-a
Port:         5432
Database:     hypermart
Username:     hypermart_user
```

**Connection Strings:**
- **Internal** (for Render services): `postgresql://hypermart_user:[PASSWORD]@dpg-d7dbcdt7vec73819d70-a:5432/hypermart`
- **External** (for local development): Available in Render dashboard

## Benefits of PostgreSQL

✅ **Persistent Data:** Survives backend redeployments
✅ **Better Performance:** Optimized for concurrent connections
✅ **Production-Ready:** Robust, ACID-compliant
✅ **Scalable:** Easy to upgrade plan as needed
✅ **Automatic Backups:** Render handles backups (Pro plan)

## Rollback (If Needed)

If you need to rollback to SQLite:

1. In Render dashboard, update `DATABASE_URL` back to:
   ```
   sqlite:///./hypermart.db
   ```
2. Redeploy the service
3. Run `seed-production-full.ps1` to populate SQLite

## Troubleshooting

### Issue: Backend won't start after migration

**Check logs for:**
- `FATAL: password authentication failed` → Wrong password in DATABASE_URL
- `could not connect to server` → Check hostname/port
- `database "hypermart" does not exist` → Verify database name

**Solution:** Double-check the DATABASE_URL format:
```
postgresql://username:password@hostname:port/database
```

### Issue: Tables not created

**Cause:** FastAPI creates tables on startup via `database.py`

**Verify:**
```python
# backend/main.py should have:
@app.on_event("startup")
async def startup_event():
    create_tables()
```

### Issue: Migration script fails

**Check:**
1. Backend is deployed and responding: `curl https://hypermart-ukg0.onrender.com/docs`
2. DATABASE_URL is set correctly in Render
3. PostgreSQL database is running (check Render dashboard)

## Files Modified

- ✅ `backend/requirements.txt` → Added `psycopg2-binary>=2.9.9`
- ✅ `backend/database.py` → Conditional connect_args, pool_pre_ping
- ✅ `render.yaml` → Database reference, fromDatabase property
- ✅ `migrate-to-postgres.ps1` → New migration script

## Next Steps

1. ✅ Run migration script
2. ✅ Test all application features
3. ✅ Monitor database performance in Render dashboard
4. ✅ Set up database backups (if on Pro plan)
5. ✅ Update CI/CD documentation

## Support

- **Render Docs:** https://render.com/docs/databases
- **SQLAlchemy PostgreSQL:** https://docs.sqlalchemy.org/en/20/dialects/postgresql.html
- **FastAPI with PostgreSQL:** https://fastapi.tiangolo.com/tutorial/sql-databases/
