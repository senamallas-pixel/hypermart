# Comprehensive Production Seed Script
# Seeds users, shops, and products on production backend

$baseUrl = "https://hypermart-ukg0.onrender.com"

Write-Host "`n=== COMPREHENSIVE PRODUCTION SEEDING ===" -ForegroundColor Cyan
Write-Host "Backend: $baseUrl`n" -ForegroundColor Yellow

# Step 1: Create Users
Write-Host "STEP 1: Creating Users..." -ForegroundColor Cyan
$users = @(
    @{email="senamallas@gmail.com"; password="Admin@123"; display_name="Admin User"; phone="+91-9000000001"; role="admin"},
    @{email="anand@example.com"; password="Owner@123"; display_name="Anand Kumar"; phone="+91-9000000002"; role="owner"},
    @{email="priya@example.com"; password="Owner@123"; display_name="Priya Sharma"; phone="+91-9000000003"; role="owner"},
    @{email="ravi@example.com"; password="Customer@123"; display_name="Ravi Patel"; phone="+91-9000000004"; role="customer"}
)

$userTokens = @{}
foreach ($user in $users) {
    $body = $user | ConvertTo-Json
    try {
        $r = Invoke-WebRequest "$baseUrl/auth/register" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        $data = $r.Content | ConvertFrom-Json
        $userTokens[$user.email] = $data.access_token
        Write-Host "  [OK] $($user.email)" -ForegroundColor Green
    } catch {
        # If 400, try login instead
        $loginBody = @{email=$user.email; password=$user.password} | ConvertTo-Json
        try {
            $r = Invoke-WebRequest "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing
            $data = $r.Content | ConvertFrom-Json
            $userTokens[$user.email] = $data.access_token
            Write-Host "  [--] $($user.email) (exists, logged in)" -ForegroundColor Gray
        } catch {
            Write-Host "  [!!] $($user.email) failed" -ForegroundColor Red
        }
    }
    Start-Sleep -Milliseconds 200
}

# Step 2: Create Shops
Write-Host "`nSTEP 2: Creating Shops..." -ForegroundColor Cyan

$shops = @(
    @{owner="anand@example.com"; name="Anand Groceries"; category="Grocery"; location_name="Green Valley"; address="12, Main St, Green Valley"; upi_id="anandgrocery@ybl"},
    @{owner="anand@example.com"; name="Anand Dairy Fresh"; category="Dairy"; location_name="Milk Lane"; address="5, Milk Lane, Sector 4"; upi_id="ananddairy@ybl"},
    @{owner="priya@example.com"; name="Priya Bakery"; category="Bakery & Snacks"; location_name="Central Market"; address="27, Baker St, Central Market"; upi_id="priyabakery@ybl"},
    @{owner="priya@example.com"; name="Priya Vegetables"; category="Vegetables & Fruits"; location_name="Green Valley"; address="8, Veggie Row, Green Valley"; upi_id="priyaveggies@ybl"},
    @{owner="priya@example.com"; name="Priya Beverages"; category="Beverages"; location_name="Food Plaza"; address="3, Food Plaza, Block B"; upi_id="priyabev@ybl"}
)

$shopIds = @{}
foreach ($shop in $shops) {
    $token = $userTokens[$shop.owner]
    if (-not $token) { Write-Host "  [!!] No token for $($shop.owner)" -ForegroundColor Red; continue }
    
    $headers = @{"Authorization"="Bearer $token"}
    $body = @{
        name=$shop.name
        category=$shop.category
        location_name=$shop.location_name
        address=$shop.address
        lat=17.385
        lng=78.4867
        upi_id=$shop.upi_id
    } | ConvertTo-Json
    
    try {
        $r = Invoke-WebRequest "$baseUrl/shops" -Method POST -Body $body -Headers $headers -ContentType "application/json" -UseBasicParsing
        $data = $r.Content | ConvertFrom-Json
        $shopIds["$($shop.owner)|$($shop.name)"] = $data.id
        Write-Host "  [OK] $($shop.name) (ID: $($data.id))" -ForegroundColor Green
    } catch {
        Write-Host "  [!!] $($shop.name) failed" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 300
}

# Step 3: Create Products
Write-Host "`nSTEP 3: Creating Products..." -ForegroundColor Cyan

$products = @(
    # Anand Groceries
    @{shop="anand@example.com|Anand Groceries"; name="Basmati Rice (5 kg)"; price=320; mrp=370; unit="5 kg bag"; stock=50; category="Grocery"},
    @{shop="anand@example.com|Anand Groceries"; name="Toor Dal (1 kg)"; price=130; mrp=145; unit="1 kg"; stock=80; category="Grocery"},
    @{shop="anand@example.com|Anand Groceries"; name="Sunflower Oil (1 L)"; price=155; mrp=175; unit="1 L bottle"; stock=30; category="Grocery"},
    @{shop="anand@example.com|Anand Groceries"; name="Sugar (1 kg)"; price=45; mrp=50; unit="1 kg"; stock=100; category="Grocery"},
    @{shop="anand@example.com|Anand Groceries"; name="Wheat Flour (5 kg)"; price=210; mrp=230; unit="5 kg bag"; stock=60; category="Grocery"},
    
    # Anand Dairy Fresh
    @{shop="anand@example.com|Anand Dairy Fresh"; name="Full Cream Milk (1 L)"; price=62; mrp=65; unit="1 L pouch"; stock=120; category="Dairy"},
    @{shop="anand@example.com|Anand Dairy Fresh"; name="Paneer (200 g)"; price=90; mrp=100; unit="200 g pack"; stock=40; category="Dairy"},
    @{shop="anand@example.com|Anand Dairy Fresh"; name="Butter (100 g)"; price=55; mrp=60; unit="100 g"; stock=30; category="Dairy"},
    @{shop="anand@example.com|Anand Dairy Fresh"; name="Fresh Curd (500 g)"; price=40; mrp=45; unit="500 g"; stock=60; category="Dairy"},
    @{shop="anand@example.com|Anand Dairy Fresh"; name="Ghee (500 g)"; price=280; mrp=320; unit="500 g jar"; stock=15; category="Dairy"},
    
    # Priya Bakery
    @{shop="priya@example.com|Priya Bakery"; name="Multigrain Bread"; price=40; mrp=45; unit="400 g loaf"; stock=25; category="Bakery & Snacks"},
    @{shop="priya@example.com|Priya Bakery"; name="Butter Cookies (200 g)"; price=60; mrp=70; unit="200 g box"; stock=15; category="Bakery & Snacks"},
    @{shop="priya@example.com|Priya Bakery"; name="Croissant (4 pcs)"; price=90; mrp=100; unit="4 pieces"; stock=20; category="Bakery & Snacks"},
    
    # Priya Vegetables
    @{shop="priya@example.com|Priya Vegetables"; name="Tomatoes (1 kg)"; price=35; mrp=40; unit="1 kg"; stock=50; category="Vegetables & Fruits"},
    @{shop="priya@example.com|Priya Vegetables"; name="Potatoes (1 kg)"; price=28; mrp=32; unit="1 kg"; stock=100; category="Vegetables & Fruits"},
    @{shop="priya@example.com|Priya Vegetables"; name="Onions (1 kg)"; price=32; mrp=38; unit="1 kg"; stock=80; category="Vegetables & Fruits"},
    @{shop="priya@example.com|Priya Vegetables"; name="Bananas (dozen)"; price=48; mrp=55; unit="12 pieces"; stock=40; category="Vegetables & Fruits"},
    
    # Priya Beverages
    @{shop="priya@example.com|Priya Beverages"; name="Orange Juice (1 L)"; price=95; mrp=110; unit="1 L packet"; stock=30; category="Beverages"},
    @{shop="priya@example.com|Priya Beverages"; name="Cola (2 L)"; price=85; mrp=95; unit="2 L bottle"; stock=50; category="Beverages"},
    @{shop="priya@example.com|Priya Beverages"; name="Mineral Water (1 L)"; price=20; mrp=25; unit="1 L bottle"; stock=100; category="Beverages"}
)

$productCount = 0
$productsFailed = 0

foreach ($product in $products) {
    $shopId = $shopIds[$product.shop]
    if (-not $shopId) { Write-Host "  [!!] Shop not found: $($product.shop)" -ForegroundColor Red; continue }
    
    # Get owner email from shop key
    $ownerEmail = $product.shop.Split("|")[0]
    $token = $userTokens[$ownerEmail]
    if (-not $token) { continue }
    
    $headers = @{"Authorization"="Bearer $token"}
    $body = @{
        name=$product.name
        price=$product.price
        mrp=$product.mrp
        unit=$product.unit
        stock=$product.stock
        category=$product.category
    } | ConvertTo-Json
    
    try {
        $r = Invoke-WebRequest "$baseUrl/shops/$shopId/products" -Method POST -Body $body -Headers $headers -ContentType "application/json" -UseBasicParsing
        $productCount++
        Write-Host "  [OK] $($product.name)" -ForegroundColor Green
    } catch {
        $productsFailed++
        Write-Host "  [!!] $($product.name)" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 200
}

# Summary
Write-Host "`n=== SEEDING COMPLETE ===" -ForegroundColor Cyan
Write-Host "Users:    $($userTokens.Count) logged in" -ForegroundColor Green
Write-Host "Shops:    $($shopIds.Count) created" -ForegroundColor Green
Write-Host "Products: $productCount created ($productsFailed failed)" -ForegroundColor Green

Write-Host "`n=== DEMO CREDENTIALS ===" -ForegroundColor Yellow
Write-Host "  Admin:    senamallas@gmail.com / Admin@123" -ForegroundColor White
Write-Host "  Owner 1:  anand@example.com / Owner@123" -ForegroundColor White
Write-Host "  Owner 2:  priya@example.com / Owner@123" -ForegroundColor White
Write-Host "  Customer: ravi@example.com / Customer@123" -ForegroundColor White
Write-Host "`nProduction database is now fully seeded!`n" -ForegroundColor Green
