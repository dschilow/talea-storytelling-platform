param(
    [string]$DockerHubUsername = "",
    [switch]$Prefetch = $false
)

if ($DockerHubUsername -eq "") {
    $DockerHubUsername = Read-Host "Bitte gib deinen DockerHub Benutzernamen ein (oder drücke Enter für 'talea')"
}

if ($DockerHubUsername -eq "") {
    $DockerHubUsername = "talea"
}

# Erzeuge einen Zeitstempel-Tag (z.B. 20240227-1335)
$Timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$BaseName = "$DockerHubUsername/cosyvoice3-runpod"
$VersionTag = "${BaseName}:${Timestamp}"
$LatestTag = "${BaseName}:latest"

$PrefetchVal = if ($Prefetch) { 1 } else { 0 }
$ModeText = if ($Prefetch) { "PROD (mit Modellen)" } else { "FAST-DEV (ohne Modelle)" }

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " Baue und pushe Docker Image ($ModeText)" -ForegroundColor Cyan
Write-Host " Tag: $VersionTag" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

# Schritt 1: Docker Image bauen
Write-Host "`n[Schritt 1/2] Baue Docker Image..." -ForegroundColor Yellow
docker build --build-arg PREFETCH_MODEL=$PrefetchVal -t $VersionTag -t $LatestTag -f runpod/cosyvoice3/Dockerfile .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Fehler beim Bauen des Docker Images!" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Schritt 2: Docker Image pushen
Write-Host "`n[Schritt 2/2] Pushe Docker Image zu DockerHub..." -ForegroundColor Yellow
Write-Host "Pushe $VersionTag..." -ForegroundColor Gray
docker push $VersionTag
Write-Host "Pushe $LatestTag..." -ForegroundColor Gray
docker push $LatestTag

if ($LASTEXITCODE -ne 0) {
    Write-Host "Fehler beim Pushen des Docker Images! Bist du auf DockerHub eingeloggt?" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n==========================================================================" -ForegroundColor Green
Write-Host " ERFOLG! Das Image wurde hochgeladen." -ForegroundColor Green
Write-Host " KOPIERE DIESEN TAG FÜR RUNPOD:" -ForegroundColor White
Write-Host " $VersionTag" -ForegroundColor Cyan -NoNewline
Write-Host " (Button wird nun aktiv!)" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
