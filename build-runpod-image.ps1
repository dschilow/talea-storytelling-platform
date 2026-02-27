param(
    [string]$DockerHubUsername = ""
)

if ($DockerHubUsername -eq "") {
    $DockerHubUsername = Read-Host "Bitte gib deinen DockerHub Benutzernamen ein (oder drücke Enter für 'talea')"
}

if ($DockerHubUsername -eq "") {
    $DockerHubUsername = "talea"
}

$ImageName = "$DockerHubUsername/cosyvoice3-runpod:latest"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " Baue und pushe Docker Image: $ImageName" -ForegroundColor Cyan
Write-Host " Dies wird die Modelle mit in das Image einbauen (PREFETCH_MODEL=1)" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

# Schritt 1: Docker Image bauen
Write-Host "`n[Schritt 1/2] Baue Docker Image (das kann ein paar Minuten dauern)..." -ForegroundColor Yellow
docker build --build-arg PREFETCH_MODEL=1 -t $ImageName -f runpod/cosyvoice3/Dockerfile .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Fehler beim Bauen des Docker Images!" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Schritt 2: Docker Image pushen
Write-Host "`n[Schritt 2/2] Pushe Docker Image zu DockerHub..." -ForegroundColor Yellow
docker push $ImageName

if ($LASTEXITCODE -ne 0) {
    Write-Host "Fehler beim Pushen des Docker Images! Bist du auf DockerHub eingeloggt? (Führe 'docker login' aus)" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n==========================================================================" -ForegroundColor Green
Write-Host " ERFOLG! Das optimierte Image wurde gebaut und auf DockerHub geladen." -ForegroundColor Green
Write-Host " Du kannst jetzt in deinem RunPod Template das Image auf '$ImageName' ändern." -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
