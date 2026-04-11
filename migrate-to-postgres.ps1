# ===================================================================
# HyperMart PostgreSQL Migration & Seeding Script
# ===================================================================
# This script migrates the database from SQLite to PostgreSQL
# and seeds the production database with demo data.
#
# Prerequisites:
# 1. PostgreSQL database created on Render
# 2. DATABASE_URL env var set to PostgreSQL connection string on Render
# 3. Backend redeployed with updated dependencies (psycopg2-binary)
#
# Usage:
#   .\migrate-to-postgres.ps1
# ===================================================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   PostgreSQL Migration & Seeding" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$API_URL = "https://hypermart-ukg0.onrender.com"

# ── Step 1: Verify Backend is Up ──────────────────────────────────────
Write-Host "[1/4] Checking backend status..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest "$API_URL/docs" -UseBasicParsing -TimeoutSec 10
    Write-Host "  [OK] Backend is responding" -ForegroundColor Green
} catch {
    Write-Host "  [!!] Backend is not responding. Please check Render deployment." -ForegroundColor Red
    Write-Host "      URL: https://dashboard.render.com" -ForegroundColor Gray
    exit 1
}

# ── Step 2: Wait for Migrations ───────────────────────────────────────
Write-Host "`n[2/4] Waiting for database migrations to complete..." -ForegroundColor Yellow
Write-Host "  Note: Render automatically runs migrations on startup" -ForegroundColor Gray
Write-Host "  Waiting 10 seconds for migrations to complete..." -ForegroundColor Gray
Start-Sleep -Seconds 10
Write-Host "  [OK] Migrations should be complete" -ForegroundColor Green

# ── Step 3: Register Users ────────────────────────────────────────────
Write-Host "`n[3/4] Creating users..." -ForegroundColor Yellow

$users = @(
    @{ email = "senamallas@gmail.com"; password = "Admin@123"; display_name = "Admin User"; phone = "+91-9000000001"; role = "admin" }
    @{ email = "anand@example.com"; password = "Owner@123"; display_name = "Anand Kumar"; phone = "+91-9000000002"; role = "owner" }
    @{ email = "priya@example.com"; password = "Owner@123"; display_name = "Priya Sharma"; phone = "+91-9000000003"; role = "owner" }
    @{ email = "ravi@example.com"; password = "Customer@123"; display_name = "Ravi Patel"; phone = "+91-9000000004"; role = "customer" }
)

$tokens = @{}

foreach ($u in $users) {
    try {
        $body = @{
            email = $u.email
            password = $u.password
            display_name = $u.display_name
            phone = $u.phone
            role = $u.role
        } | ConvertTo-Json

        $response = Invoke-WebRequest "$API_URL/auth/register" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
        $tokens[$u.email] = $data.access_token
        Write-Host "  [OK] $($u.email)" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 400) {
            Write-Host "  [--] $($u.email) (already exists, logging in...)" -ForegroundColor Yellow
            try {
                $loginBody = @{
                    email = $u.email
                    password = $u.password
                } | ConvertTo-Json
                $loginResponse = Invoke-WebRequest "$API_URL/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing
                $loginData = $loginResponse.Content | ConvertFrom-Json
                $tokens[$u.email] = $loginData.access_token
            } catch {
                Write-Host "  [!!] Failed to login $($u.email)" -ForegroundColor Red
            }
        } else {
            Write-Host "  [!!] Failed to create $($u.email): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "`n  Users logged in: $($tokens.Count) / $($users.Count)" -ForegroundColor Cyan

# ── Step 4: Create Shops ──────────────────────────────────────────────
Write-Host "`n[4/4] Creating shops and products..." -ForegroundColor Yellow

$shops = @(
    @{ name = "Anand Groceries"; category = "Grocery"; location = "Central Market"; owner = "anand@example.com" }
    @{ name = "Anand Dairy Fresh"; category = "Dairy"; location = "Milk Lane"; owner = "anand@example.com" }
    @{ name = "Priya Bakery"; category = "Bakery & Snacks"; location = "Food Plaza"; owner = "priya@example.com" }
    @{ name = "Priya Vegetables"; category = "Vegetables & Fruits"; location = "Green Valley"; owner = "priya@example.com" }
    @{ name = "Priya Beverages"; category = "Beverages"; location = "Old Town"; owner = "priya@example.com" }
)

$shopIds = @()

foreach ($shop in $shops) {
    try {
        $headers = @{ Authorization = "Bearer $($tokens[$shop.owner])" }
        $body = @{
            name = $shop.name
            address = "$($shop.location), Hyderabad"
            category = $shop.category
            location_name = $shop.location
            lat = 17.385 + (Get-Random -Minimum -10 -Maximum 10) / 1000
            lng = 78.486 + (Get-Random -Minimum -10 -Maximum 10) / 1000
        } | ConvertTo-Json

        $response = Invoke-WebRequest "$API_URL/shops" -Method POST -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
        $shopIds += $data.id
        Write-Host "  [OK] $($shop.name) (ID: $($data.id))" -ForegroundColor Green
    } catch {
        Write-Host "  [!!] Failed to create $($shop.name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Products for each shop
$products = @(
    # Shop 1: Anand Groceries
    @{ shop_idx = 0; name = "Basmati Rice"; category = "Grocery"; unit = "5 kg"; price = 320; mrp = 350; stock = 50 }
    @{ shop_idx = 0; name = "Sugar"; category = "Grocery"; unit = "1 kg"; price = 45; mrp = 50; stock = 100 }
    @{ shop_idx = 0; name = "Sunflower Oil"; category = "Grocery"; unit = "1 L"; price = 155; mrp = 170; stock = 40 }
    @{ shop_idx = 0; name = "Atta Flour"; category = "Grocery"; unit = "10 kg"; price = 410; mrp = 450; stock = 30 }
    
    # Shop 2: Anand Dairy Fresh
    @{ shop_idx = 1; name = "Fresh Milk"; category = "Dairy"; unit = "1 L"; price = 55; mrp = 60; stock = 80 }
    @{ shop_idx = 1; name = "Paneer"; category = "Dairy"; unit = "200g"; price = 90; mrp = 100; stock = 40 }
    @{ shop_idx = 1; name = "Yogurt"; category = "Dairy"; unit = "500g"; price = 60; mrp = 70; stock = 50 }
    @{ shop_idx = 1; name = "Butter"; category = "Dairy"; unit = "100g"; price = 55; mrp = 60; stock = 60 }
    
    # Shop 3: Priya Bakery
    @{ shop_idx = 2; name = "White Bread"; category = "Bakery & Snacks"; unit = "piece"; price = 45; mrp = 50; stock = 100 }
    @{ shop_idx = 2; name = "Butter Cookies"; category = "Bakery & Snacks"; unit = "250g"; price = 80; mrp = 90; stock = 50 }
    @{ shop_idx = 2; name = "Cake"; category = "Bakery & Snacks"; unit = "500g"; price = 250; mrp = 280; stock = 20 }
    @{ shop_idx = 2; name = "Croissants"; category = "Bakery & Snacks"; unit = "4 pcs"; price = 120; mrp = 140; stock = 30 }
    
    # Shop 4: Priya Vegetables
    @{ shop_idx = 3; name = "Tomatoes"; category = "Vegetables & Fruits"; unit = "1 kg"; price = 40; mrp = 45; stock = 100 }
    @{ shop_idx = 3; name = "Onions"; category = "Vegetables & Fruits"; unit = "1 kg"; price = 35; mrp = 40; stock = 150 }
    @{ shop_idx = 3; name = "Potatoes"; category = "Vegetables & Fruits"; unit = "1 kg"; price = 30; mrp = 35; stock = 200 }
    @{ shop_idx = 3; name = "Spinach"; category = "Vegetables & Fruits"; unit = "250g"; price = 20; mrp = 25; stock = 80 }
    
    # Shop 5: Priya Beverages
    @{ shop_idx = 4; name = "Coca Cola"; category = "Beverages"; unit = "2 L"; price = 90; mrp = 100; stock = 60 }
    @{ shop_idx = 4; name = "Orange Juice"; category = "Beverages"; unit = "1 L"; price = 120; mrp = 140; stock = 40 }
    @{ shop_idx = 4; name = "Mineral Water"; category = "Beverages"; unit = "1 L"; price = 20; mrp = 20; stock = 200 }
    @{ shop_idx = 4; name = "Energy Drink"; category = "Beverages"; unit = "250ml"; price = 110; mrp = 120; stock = 50 }
)

$productCount = 0
$failedCount = 0

foreach ($product in $products) {
    if ($product.shop_idx -ge $shopIds.Count) {
        Write-Host "  [!!] Invalid shop index for $($product.name)" -ForegroundColor Red
        $failedCount++
        continue
    }

    $shopId = $shopIds[$product.shop_idx]
    $shopOwner = $shops[$product.shop_idx].owner

    try {
        $headers = @{ Authorization = "Bearer $($tokens[$shopOwner])" }
        $body = @{
            name = $product.name
            unit = $product.unit
            price = $product.price
            mrp = $product.mrp
            stock = $product.stock
            category = $product.category
        } | ConvertTo-Json

        Invoke-WebRequest "$API_URL/shops/$shopId/products" -Method POST -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing | Out-Null
        $productCount++
        Write-Host "  [OK] $($product.name)" -ForegroundColor Green
    } catch {
        Write-Host "  [!!] Failed to create $($product.name): $($_.Exception.Message)" -ForegroundColor Red
        $failedCount++
    }
}

# ── Summary ───────────────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   MIGRATION COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Users:    $($tokens.Count) created/logged in" -ForegroundColor Green
Write-Host "Shops:    $($shopIds.Count) created" -ForegroundColor Green
Write-Host "Products: $productCount created ($failedCount failed)" -ForegroundColor Green
Write-Host "`nDemo Credentials:" -ForegroundColor Yellow
Write-Host "  Admin:    senamallas@gmail.com / Admin@123" -ForegroundColor Gray
Write-Host "  Owner 1:  anand@example.com / Owner@123" -ForegroundColor Gray
Write-Host "  Owner 2:  priya@example.com / Owner@123" -ForegroundColor Gray
Write-Host "  Customer: ravi@example.com / Customer@123" -ForegroundColor Gray
Write-Host "`nProduction URLs:" -ForegroundColor Yellow
Write-Host "  Frontend: https://frontend-phi-five-15.vercel.app" -ForegroundColor Cyan
Write-Host "  Backend:  https://hypermart-ukg0.onrender.com" -ForegroundColor Cyan
Write-Host ""
