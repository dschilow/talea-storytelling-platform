# Talea Avatar Migration - PowerShell Script
# Adds inventory and skills columns to avatars table on Railway PostgreSQL

$ErrorActionPreference = "Stop"

Write-Host "🚀 Talea Avatar Migration Runner (PostgreSQL Direct Connection)" -ForegroundColor Cyan
Write-Host ""

# Railway PostgreSQL Connection Details
$PGHOST = "autorack.proxy.rlwy.net"
$PGPORT = "42832"
$PGUSER = "postgres"
$PGPASSWORD = "HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr"
$PGDATABASE = "railway"

# Migration SQL
$migrationSQL = @"
ALTER TABLE avatars ADD COLUMN inventory TEXT DEFAULT '[]';
ALTER TABLE avatars ADD COLUMN skills TEXT DEFAULT '[]';
"@

Write-Host "📋 Migration SQL:" -ForegroundColor Yellow
Write-Host $migrationSQL
Write-Host ""

# Check if psql is installed
try {
    $psqlVersion = psql --version 2>&1
    Write-Host "✓ PostgreSQL client found: $psqlVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ psql command not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "You need to install PostgreSQL client tools:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "  2. Or install via Chocolatey: choco install postgresql" -ForegroundColor White
    Write-Host ""
    Write-Host "Alternative: Use the API-based migration (requires backend deployment)" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "⚠️  IMPORTANT: This will modify the production database!" -ForegroundColor Yellow
Write-Host "Press any key to continue, or Ctrl+C to cancel..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Write-Host ""

# Set environment variable for password
$env:PGPASSWORD = $PGPASSWORD

Write-Host "🔄 Connecting to Railway PostgreSQL..." -ForegroundColor Cyan

try {
    # Execute migration
    $migrationSQL | psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE
    
    Write-Host ""
    Write-Host "✅ Migration executed successfully!" -ForegroundColor Green
    
    # Verify columns
    Write-Host ""
    Write-Host "📊 Verifying added columns..." -ForegroundColor Cyan
    $verifySQL = "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'avatars' AND column_name IN ('inventory', 'skills');"
    $verifySQL | psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE
    
    Write-Host ""
    Write-Host "🎉 SUCCESS! Inventory and skills columns added to avatars table!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ Migration failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible issues:" -ForegroundColor Yellow
    Write-Host "  - Columns already exist (not an error)" -ForegroundColor White
    Write-Host "  - Connection timeout (Railway firewall)" -ForegroundColor White
    Write-Host "  - Wrong credentials" -ForegroundColor White
    exit 1
} finally {
    # Clear password from environment
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Migration completed!" -ForegroundColor Cyan
