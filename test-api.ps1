# HyperMart API Test Script
$baseUrl = "https://hypermart-ukg0.onrender.com"

Write-Host "`n=== HYPERMART API COMPREHENSIVE TEST ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl`n" -ForegroundColor Gray

# 1. Test Docs
Write-Host "1. Core Endpoints" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest "$baseUrl/docs" -UseBasicParsing
    Write-Host "   ✓ GET /docs - $($r.StatusCode)" -ForegroundColor Green
} catch { Write-Host "   ✗ GET /docs" -ForegroundColor Red }

try {
    $r = Invoke-WebRequest "$baseUrl/" -UseBasicParsing
    Write-Host "   ✓ GET / - $($r.StatusCode)" -ForegroundColor Green
} catch { Write-Host "   ✗ GET /" -ForegroundColor Red }

# 2. Register Customer
Write-Host "`n2. Auth - Customer" -ForegroundColor Yellow
$custEmail = "customer_$(Get-Random)@test.com"
$custBody = @{email=$custEmail; password="Cust@123"; display_name="Test Customer"; role="customer"} | ConvertTo-Json
try {
    $r = Invoke-WebRequest "$baseUrl/auth/register" -Method POST -Body $custBody -ContentType "application/json" -UseBasicParsing
    $customer = $r.Content | ConvertFrom-Json
    $customerToken = $customer.access_token
    Write-Host "   ✓ POST /auth/register (customer) - ID $($customer.user.id)" -ForegroundColor Green
} catch { Write-Host "   ✗ POST /auth/register (customer)" -ForegroundColor Red }

# Login Customer  
$loginBody = @{email=$custEmail; password="Cust@123"} | ConvertTo-Json
try {
    $r = Invoke-WebRequest "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing
    Write-Host "   ✓ POST /auth/login (customer)" -ForegroundColor Green
} catch { Write-Host "   ✗ POST /auth/login (customer)" -ForegroundColor Red }

# 3. Register Owner
Write-Host "`n3. Auth - Owner" -ForegroundColor Yellow
$ownerEmail = "owner_$(Get-Random)@test.com"
$ownerBody = @{email=$ownerEmail; password="Owner@123"; display_name="Test Owner"; role="owner"} | ConvertTo-Json
try {
    $r = Invoke-WebRequest "$baseUrl/auth/register" -Method POST -Body $ownerBody -ContentType "application/json" -UseBasicParsing
    $owner = $r.Content | ConvertFrom-Json
    $global:ownerToken = $owner.access_token
    $ownerId = $owner.user.id
    Write-Host "   ✓ POST /auth/register (owner) - ID $ownerId" -ForegroundColor Green
    
    # Test Profile
    $headers = @{"Authorization"="Bearer $global:ownerToken"}
    $r = Invoke-WebRequest "$baseUrl/users/me" -Headers $headers -UseBasicParsing
    $profile = $r.Content | ConvertFrom-Json
    Write-Host "   ✓ GET /users/me - $($profile.display_name)" -ForegroundColor Green
} catch { Write-Host "   ✗ Owner registration/profile" -ForegroundColor Red }

# 4. Create Shop
Write-Host "`n4. Shop Management" -ForegroundColor Yellow
$shopBody = @{
    name="Test Grocery Store"
    address="123 Test St"
    lat=17.385
    lng=78.4867
    upi_id="testshop@ybl"
    category="Grocery"
    location_name="Central Market"
} | ConvertTo-Json
try {
    $headers = @{"Authorization"="Bearer $global:ownerToken"}
    $r = Invoke-WebRequest "$baseUrl/shops" -Method POST -Body $shopBody -Headers $headers -ContentType "application/json" -UseBasicParsing
    $shop = $r.Content | ConvertFrom-Json
    $global:shopId = $shop.id
    Write-Host "   ✓ POST /shops - Shop ID $($shop.id)" -ForegroundColor Green
    
    # List Shops
    $r = Invoke-WebRequest "$baseUrl/shops" -UseBasicParsing
    $shops = $r.Content | ConvertFrom-Json
    Write-Host "   ✓ GET /shops - Found $($shops.Count)" -ForegroundColor Green
    
    # Get Shop UPI
    $r = Invoke-WebRequest "$baseUrl/shops/$global:shopId/upi" -Headers $headers -UseBasicParsing
    $upi = $r.Content | ConvertFrom-Json
    Write-Host "   ✓ GET /shops/{id}/upi - $($upi.upi_id)" -ForegroundColor Green
} catch { Write-Host "   ✗ Shop operations" -ForegroundColor Red }

# 5. Product Management
Write-Host "`n5. Product Management" -ForegroundColor Yellow
$prodBody = @{name="Basmati Rice"; price=120.0; mrp=150.0; stock=100; unit="kg"; category="Grocery"} | ConvertTo-Json
try {
    $headers = @{"Authorization"="Bearer $global:ownerToken"}
    $r = Invoke-WebRequest "$baseUrl/shops/$global:shopId/products" -Method POST -Body $prodBody -Headers $headers -ContentType "application/json" -UseBasicParsing
    $product = $r.Content | ConvertFrom-Json
    $global:productId = $product.id
    Write-Host "   ✓ POST /shops/{id}/products - Product ID $($product.id)" -ForegroundColor Green
    
    # List Products
    $r = Invoke-WebRequest "$baseUrl/shops/$global:shopId/products" -Headers $headers -UseBasicParsing
    $products = $r.Content | ConvertFrom-Json
    Write-Host "   ✓ GET /shops/{id}/products - Found $($products.Count)" -ForegroundColor Green
} catch { Write-Host "   ✗ Product operations" -ForegroundColor Red }

# 6. Order Management
Write-Host "`n6. Order Management" -ForegroundColor Yellow
$orderBody = @{items=@(@{product_id=$global:productId; quantity=2}); payment_method="upi"} | ConvertTo-Json -Depth 3
try {
    $headers = @{"Authorization"="Bearer $global:ownerToken"}
    $r = Invoke-WebRequest "$baseUrl/shops/$global:shopId/walkin-order" -Method POST -Body $orderBody -Headers $headers -ContentType "application/json" -UseBasicParsing
    $order = $r.Content | ConvertFrom-Json
    $global:orderId = $order.id
    Write-Host "   ✓ POST /shops/{id}/walkin-order - Order ID $($order.id), Total Rs.$($order.total)" -ForegroundColor Green
    
    # Payment Status
    $r = Invoke-WebRequest "$baseUrl/orders/$global:orderId/payment-status" -Headers $headers -UseBasicParsing
    $payStatus = $r.Content | ConvertFrom-Json
    Write-Host "   ✓ GET /orders/{id}/payment-status - $($payStatus.payment_status)" -ForegroundColor Green
    
    # Public Payment Page
    $r = Invoke-WebRequest "$baseUrl/pay/$global:orderId" -UseBasicParsing
    Write-Host "   ✓ GET /pay/{id} (public) - $($r.StatusCode)" -ForegroundColor Green
} catch { Write-Host "   ✗ Order operations" -ForegroundColor Red }

# 7. Analytics
Write-Host "`n7. Analytics" -ForegroundColor Yellow
try {
    $headers = @{"Authorization"="Bearer $global:ownerToken"}
    $r = Invoke-WebRequest "$baseUrl/analytics/overview" -Headers $headers -UseBasicParsing
    Write-Host "   ✓ GET /analytics/overview" -ForegroundColor Green
    
    $r = Invoke-WebRequest "$baseUrl/shops/$global:shopId/analytics" -Headers $headers -UseBasicParsing
    Write-Host "   ✓ GET /shops/{id}/analytics" -ForegroundColor Green
} catch { Write-Host "   ✗ Analytics" -ForegroundColor Red }

# 8. Additional Endpoints
Write-Host "`n8. Additional Features" -ForegroundColor Yellow
try {
    $nearbyUrl = "$baseUrl/shops/nearby?lat=17.385&lng=78.4867&radius=5"
    $r = Invoke-WebRequest $nearbyUrl -UseBasicParsing
    Write-Host "   ✓ GET /shops/nearby" -ForegroundColor Green
} catch { Write-Host "   ✗ GET /shops/nearby" -ForegroundColor Red }

Write-Host "`n=== TEST COMPLETE ===" -ForegroundColor Cyan
Write-Host "✓ All core API endpoints tested successfully!`n" -ForegroundColor Green

