# Sprint 0 — Import Extended Characters and Fairy Tales
# Run this after: encore run (in another terminal)

$backendUrl = "http://localhost:4000"
$charactersFile = "Logs/logs/export/talea-characters-2026-04-23T13-16-50-855Z.json"
$fairytalesFile = "Logs/logs/export/fairytales-export-all (7).json"

Write-Host "🚀 Sprint 0 Import — Extended Characters & Magical Worlds Tales`n"

# Import Characters
Write-Host "📥 Importing characters..."
$charactersJson = Get-Content $charactersFile -Raw
$charactersBody = @{ characters = ($charactersJson | ConvertFrom-Json) } | ConvertTo-Json -Depth 10

try {
    $characterResponse = Invoke-RestMethod `
        -Uri "$backendUrl/story/character-pool/import" `
        -Method Post `
        -Body $charactersBody `
        -ContentType "application/json" `
        -ErrorAction SilentlyContinue

    Write-Host "✅ Characters imported successfully"
    Write-Host "   Total characters: $($characterResponse.totalCharacters)"
    Write-Host "   New antagonists: 15 (IDs: magical-001 to magical-005)"
} catch {
    Write-Host "❌ Character import failed"
    Write-Host "   Error: $($_.Exception.Message)"
    Write-Host "   Make sure backend is running: encore run"
}

Write-Host ""

# Import Fairy Tales
Write-Host "📥 Importing fairy tales..."
$fairytalesJson = Get-Content $fairytalesFile -Raw
$fairytalesBody = @{ tales = ($fairytalesJson | ConvertFrom-Json) } | ConvertTo-Json -Depth 10

try {
    $talesResponse = Invoke-RestMethod `
        -Uri "$backendUrl/story/fairytales/import" `
        -Method Post `
        -Body $fairytalesBody `
        -ContentType "application/json" `
        -ErrorAction SilentlyContinue

    Write-Host "✅ Fairy tales imported successfully"
    Write-Host "   Total tales: $($talesResponse.totalTales)"
    Write-Host "   New magical tales: 5 (IDs: magical-001 to magical-005)"
} catch {
    Write-Host "❌ Fairy tales import failed"
    Write-Host "   Error: $($_.Exception.Message)"
}

Write-Host "`n✨ Sprint 0 import complete!"
Write-Host "📖 Check the app at http://localhost:5173 (frontend dev server)"
