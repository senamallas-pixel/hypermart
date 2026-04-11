# Seed Production Database via API
# This script registers demo users on the production backend

$baseUrl = "https://hypermart-ukg0.onrender.com"

Write-Host "`n=== SEEDING PRODUCTION DATABASE ===" -ForegroundColor Cyan
Write-Host "Creating demo users on $baseUrl`n" -ForegroundColor Yellow

# Demo users from seed.py
$users = @(
    @{email="senamallas@gmail.com"; password="Admin@123"; display_name="Admin User"; phone="+91-9000000001"; role="admin"}
    @{email="anand@example.com"; password="Owner@123"; display_name="Anand Kumar"; phone="+91-9000000002"; role="owner"}
    @{email="priya@example.com"; password="Owner@123"; display_name="Priya Sharma"; phone="+91-9000000003"; role="owner"}
    @{email="ravi@example.com"; password="Customer@123"; display_name="Ravi Patel"; phone="+91-9000000004"; role="customer"}
)

$created = 0
$skipped = 0

foreach ($user in $users) {
    $body = $user | ConvertTo-Json
    try {
        $response = Invoke-WebRequest "$baseUrl/auth/register" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
        Write-Host "  [OK] Created $($user.role): $($user.email)" -ForegroundColor Green
        $created++
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 400) {
            Write-Host "  [--] Exists: $($user.email)" -ForegroundColor Gray
            $skipped++
        } else {
            Write-Host "  [!!] Failed: $($user.email)" -ForegroundColor Red
        }
    }
    Start-Sleep -Milliseconds 500
}

Write-Host "`n=== SEEDING COMPLETE ===" -ForegroundColor Cyan
Write-Host "Created: $created users" -ForegroundColor Green
Write-Host "Skipped: $skipped users" -ForegroundColor Gray

Write-Host "`n=== DEMO CREDENTIALS ===" -ForegroundColor Yellow
Write-Host "  Admin:    senamallas@gmail.com / Admin@123" -ForegroundColor White
Write-Host "  Owner 1:  anand@example.com / Owner@123" -ForegroundColor White
Write-Host "  Owner 2:  priya@example.com / Owner@123" -ForegroundColor White
Write-Host "  Customer: ravi@example.com / Customer@123" -ForegroundColor White
Write-Host "`nYou can now login with any of these accounts!`n" -ForegroundColor Green

