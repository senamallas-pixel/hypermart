# Verify Backend is Using PostgreSQL
Write-Host "`n=== Verifying Backend Database Connection ===" -ForegroundColor Cyan

$apiUrl = "https://hypermart-ukg0.onrender.com"

Write-Host "`n1. Checking API health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$apiUrl/docs" -Method Get -ErrorAction Stop
    Write-Host "   ✓ Backend is responding" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Backend not responding - may still be deploying" -ForegroundColor Red
    Write-Host "   Wait 2-3 minutes and try again" -ForegroundColor Yellow
    exit
}

Write-Host "`n2. Checking for existing data..." -ForegroundColor Yellow
try {
    $shops = Invoke-RestMethod -Uri "$apiUrl/shops" -Method Get -ErrorAction Stop
    Write-Host "   Found $($shops.Count) shops" -ForegroundColor Cyan
    
    if ($shops.Count -eq 0) {
        Write-Host "   ⚠ Database is empty - ready to seed!" -ForegroundColor Yellow
        Write-Host "`n   Run: .\migrate-to-postgres.ps1" -ForegroundColor Cyan
    } else {
        Write-Host "   ✓ Database has data:" -ForegroundColor Green
        $shops | ForEach-Object { 
            Write-Host "     • $($_.name) - $($_.category)" -ForegroundColor White 
        }
    }
} catch {
    Write-Host "   ✗ Could not fetch data: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Check Complete ===" -ForegroundColor Cyan
Write-Host ""
