# PowerShell script to run migrations on Railway PostgreSQL
# Run this with: powershell -ExecutionPolicy Bypass -File migrate-simple.ps1

$connectionString = "postgresql://postgres:HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr@switchback.proxy.rlwy.net:38603/railway"
$sqlFile = "all-migrations.sql"

Write-Host "🔄 Preparing to run migrations..." -ForegroundColor Cyan

# Check if SQL file exists
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Error: $sqlFile not found!" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Reading SQL file..." -ForegroundColor Yellow
$sqlContent = Get-Content $sqlFile -Raw

# Split SQL into individual statements (simple approach)
$statements = $sqlContent -split ";\s*(?=CREATE|ALTER|--)"

Write-Host "📦 Found $($statements.Count) SQL statements" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  IMPORTANT:" -ForegroundColor Yellow
Write-Host "This script requires PostgreSQL client (psql) to be installed." -ForegroundColor Yellow
Write-Host ""
Write-Host "Please copy the following command and run it manually:" -ForegroundColor Cyan
Write-Host ""
Write-Host "`$env:PGPASSWORD='HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr'; psql -h switchback.proxy.rlwy.net -p 38603 -U postgres -d railway -f all-migrations.sql" -ForegroundColor Green
Write-Host ""
Write-Host "OR install PostgreSQL client first:" -ForegroundColor Yellow
Write-Host "  winget install PostgreSQL.PostgreSQL" -ForegroundColor White
Write-Host ""
