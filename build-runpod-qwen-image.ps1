param(
    [string]$DockerHubUsername = "",
    [switch]$Prefetch = $false,
    [switch]$InstallFlashAttn = $true,
    [switch]$EnforceFlashAttn = $true,
    [switch]$UseDevelBase = $true,
    [switch]$MaxPerf = $false
)

if (-not $PSBoundParameters.ContainsKey('Prefetch')) {
    $Prefetch = $true
}

if ($MaxPerf) {
    $Prefetch = $true
    $InstallFlashAttn = $true
    $EnforceFlashAttn = $true
    $UseDevelBase = $true
}

if ($DockerHubUsername -eq "") {
    $DockerHubUsername = Read-Host "Bitte gib deinen DockerHub Benutzernamen ein (oder drücke Enter für 'talea')"
}

if ($DockerHubUsername -eq "") {
    $DockerHubUsername = "talea"
}

# Simple preflight: max-perf builds need a lot of temporary disk space
# for the CUDA devel base image, flash-attn compilation, Docker layers and
# optional model prefetch. Abort early instead of hanging until ENOSPC.
$SystemDrive = Get-PSDrive -Name C -ErrorAction SilentlyContinue
if ($SystemDrive) {
    $FreeGB = [math]::Round($SystemDrive.Free / 1GB, 1)
    if ($Prefetch -and $FreeGB -lt 50) {
        Write-Host "WARNUNG: Auf C: sind nur noch $FreeGB GB frei." -ForegroundColor Red
        Write-Host "Ein Qwen MAX-PERF Build mit Prefetch braucht oft deutlich mehr temporären Platz." -ForegroundColor Red
        Write-Host "Abbruch, um einen spaeten ENOSPC-Haenger waehrend docker build zu vermeiden." -ForegroundColor Red
        Write-Host "Loesung 1: Speicher freimachen und danach erneut starten." -ForegroundColor Yellow
        Write-Host "Loesung 2: Ohne Modell-Prefetch bauen:" -ForegroundColor Yellow
        Write-Host "  .\\build-runpod-qwen-image.ps1 -DockerHubUsername $DockerHubUsername -Prefetch:`$false" -ForegroundColor Cyan
        exit 1
    }
}

# Erzeuge einen Zeitstempel-Tag (z.B. 20260228-1335)
$Timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$BaseName = "$DockerHubUsername/qwen3-tts-runpod"
$VersionTag = "${BaseName}:${Timestamp}"
$LatestTag = "${BaseName}:latest"

$PrefetchVal = if ($Prefetch) { 1 } else { 0 }
$InstallFlashAttnVal = if ($InstallFlashAttn) { 1 } else { 0 }
$EnforceFlashAttnVal = if ($EnforceFlashAttn) { 1 } else { 0 }
$BaseImage = if ($UseDevelBase) { "pytorch/pytorch:2.5.1-cuda12.4-cudnn9-devel" } else { "pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime" }
$ModeText = if ($Prefetch) { "PROD (mit Modellen)" } else { "FAST-DEV (ohne Modelle)" }
if ($InstallFlashAttn) {
    $ModeText = "$ModeText + flash-attn"
}
if ($EnforceFlashAttn) {
    $ModeText = "$ModeText + enforce-flash"
}
if ($UseDevelBase) {
    $ModeText = "$ModeText + devel-base"
}
if ($MaxPerf) {
    $ModeText = "MAX-PERF (prefetch + flash + enforce + devel)"
}

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " Baue und pushe Docker Image ($ModeText)" -ForegroundColor Cyan
Write-Host " Tag: $VersionTag" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

# Schritt 1: Docker Image bauen
Write-Host "`n[Schritt 1/2] Baue Docker Image..." -ForegroundColor Yellow
$env:BUILDKIT_PROGRESS = "plain"
docker build --progress=plain --build-arg PYTORCH_BASE_IMAGE=$BaseImage --build-arg PREFETCH_MODEL=$PrefetchVal --build-arg INSTALL_FLASH_ATTN=$InstallFlashAttnVal --build-arg ENFORCE_FLASH_ATTN=$EnforceFlashAttnVal -t $VersionTag -t $LatestTag -f runpod/qwen3-tts/Dockerfile runpod/qwen3-tts/

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
