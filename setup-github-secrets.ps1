# GitHub Secrets Setup Helper for HyperMart
# Run this script to get all the values needed for GitHub Secrets

Write-Host "`n=== GITHUB SECRETS CONFIGURATION ===" -ForegroundColor Cyan
Write-Host "Copy these values to: GitHub → Settings → Secrets and variables → Actions`n" -ForegroundColor Yellow

# 1. Extract Vercel IDs from local config
if (Test-Path "frontend\.vercel\project.json") {
    $vercelConfig = Get-Content "frontend\.vercel\project.json" | ConvertFrom-Json
    
    Write-Host "1. VERCEL_ORG_ID" -ForegroundColor Green
    Write-Host "   Value: $($vercelConfig.orgId)" -ForegroundColor White
    Write-Host ""
    
    Write-Host "2. VERCEL_PROJECT_ID" -ForegroundColor Green
    Write-Host "   Value: $($vercelConfig.projectId)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "⚠ Vercel config not found. Run 'cd frontend && npx vercel' first." -ForegroundColor Red
}

# 2. VERCEL_TOKEN
Write-Host "3. VERCEL_TOKEN" -ForegroundColor Green
Write-Host "   Get from: https://vercel.com/account/tokens" -ForegroundColor Gray
Write-Host "   Steps:" -ForegroundColor Gray
Write-Host "   - Go to Vercel Dashboard → Settings → Tokens" -ForegroundColor Gray
Write-Host "   - Click 'Create Token'" -ForegroundColor Gray
Write-Host "   - Name: 'GitHub Actions'" -ForegroundColor Gray
Write-Host "   - Scope: Full Account" -ForegroundColor Gray
Write-Host "   - Copy the token (shown only once!)" -ForegroundColor Gray
Write-Host ""

# 3. RENDER_DEPLOY_HOOK_URL
Write-Host "4. RENDER_DEPLOY_HOOK_URL" -ForegroundColor Green
Write-Host "   Get from: Render Dashboard → hypermart-api → Settings" -ForegroundColor Gray
Write-Host "   Steps:" -ForegroundColor Gray
Write-Host "   - Scroll to 'Deploy Hook'" -ForegroundColor Gray
Write-Host "   - Click 'Create Deploy Hook'" -ForegroundColor Gray
Write-Host "   - Name: 'GitHub Actions'" -ForegroundColor Gray
Write-Host "   - Copy the webhook URL" -ForegroundColor Gray
Write-Host ""

# 4. Copy helper
Write-Host "`n=== QUICK COPY FORMAT ===" -ForegroundColor Cyan
Write-Host "Add these secrets to GitHub (one per line):`n" -ForegroundColor Yellow

if (Test-Path "frontend\.vercel\project.json") {
    $vercelConfig = Get-Content "frontend\.vercel\project.json" | ConvertFrom-Json
    Write-Host "Secret Name: VERCEL_ORG_ID"
    Write-Host "Secret Value: $($vercelConfig.orgId)"
    Write-Host ""
    Write-Host "Secret Name: VERCEL_PROJECT_ID"
    Write-Host "Secret Value: $($vercelConfig.projectId)"
    Write-Host ""
}

Write-Host "Secret Name: VERCEL_TOKEN"
Write-Host "Secret Value: <get from https://vercel.com/account/tokens>"
Write-Host ""

Write-Host "Secret Name: RENDER_DEPLOY_HOOK_URL"
Write-Host "Secret Value: <get from Render Dashboard → Settings → Deploy Hook>"
Write-Host ""

Write-Host "`n=== NEXT STEPS ===" -ForegroundColor Cyan
Write-Host "1. Go to: https://github.com/senamallas-pixel/hypermart/settings/secrets/actions" -ForegroundColor White
Write-Host "2. Click 'New repository secret'" -ForegroundColor White
Write-Host "3. Add each secret from above" -ForegroundColor White
Write-Host "4. After adding all secrets, push a commit to trigger the workflows" -ForegroundColor White
Write-Host ""

Write-Host "`n=== DONE ===" -ForegroundColor Cyan
Write-Host "All secrets listed above. Add them to GitHub to enable CI/CD!`n" -ForegroundColor Green
