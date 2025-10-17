# PowerShell script to configure Railway services via GraphQL API
# Usage:
#   $env:RAILWAY_TOKEN = "your_token"
#   $env:BACKEND_SERVICE_ID = "service_id"
#   $env:NSQ_SERVICE_ID = "service_id"
#   $env:FRONTEND_SERVICE_ID = "service_id"
#   .\configure-railway.ps1

param(
    [string]$RailwayToken = $env:RAILWAY_TOKEN,
    [string]$BackendServiceId = $env:BACKEND_SERVICE_ID,
    [string]$NsqServiceId = $env:NSQ_SERVICE_ID,
    [string]$FrontendServiceId = $env:FRONTEND_SERVICE_ID
)

if (-not $RailwayToken) {
    Write-Error "RAILWAY_TOKEN not set. Please set it as environment variable or pass as parameter."
    exit 1
}

$apiUrl = "https://api.railway.app/graphql/v2"
$headers = @{
    "Authorization" = "Bearer $RailwayToken"
    "Content-Type" = "application/json"
}

# Function to update service to use Image Registry
function Update-ServiceToImage {
    param(
        [string]$ServiceId,
        [string]$Image
    )

    Write-Host "Configuring Backend Service to use Image Registry: $Image"

    $query = @"
mutation {
  serviceUpdate(
    id: \"$ServiceId\",
    input: {
      source: {
        image: \"$Image\"
      }
    }
  ) {
    id
    name
  }
}
"@

    $body = @{
        query = $query
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $body
        Write-Host "✅ Backend service updated to use image: $Image"
        return $response
    }
    catch {
        Write-Error "❌ Failed to update backend service: $_"
        Write-Error $_.Exception.Response
    }
}

# Function to update service to use Dockerfile from repo
function Update-ServiceToDockerfile {
    param(
        [string]$ServiceId,
        [string]$DockerfilePath,
        [string]$ServiceName
    )

    Write-Host "Configuring $ServiceName Service to use Dockerfile: $DockerfilePath"

    $query = @"
mutation {
  serviceUpdate(
    id: \"$ServiceId\",
    input: {
      source: {
        repo: {
          branch: \"main\"
          dockerfilePath: \"$DockerfilePath\"
        }
      }
    }
  ) {
    id
    name
  }
}
"@

    $body = @{
        query = $query
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $body
        Write-Host "✅ $ServiceName service updated to use Dockerfile: $DockerfilePath"
        return $response
    }
    catch {
        Write-Error "❌ Failed to update $ServiceName service: $_"
        Write-Error $_.Exception.Response
    }
}

# Configure Backend Service to use GHCR image
if ($BackendServiceId) {
    Update-ServiceToImage -ServiceId $BackendServiceId -Image "ghcr.io/dschilow/talea-storytelling-platform:latest"
} else {
    Write-Warning "⚠️ BACKEND_SERVICE_ID not set, skipping backend configuration"
}

# Configure NSQ Service to use Dockerfile
if ($NsqServiceId) {
    Update-ServiceToDockerfile -ServiceId $NsqServiceId -DockerfilePath "Dockerfile.nsq" -ServiceName "NSQ"
} else {
    Write-Warning "⚠️ NSQ_SERVICE_ID not set, skipping NSQ configuration"
}

# Configure Frontend Service to use Dockerfile
if ($FrontendServiceId) {
    Update-ServiceToDockerfile -ServiceId $FrontendServiceId -DockerfilePath "Dockerfile.frontend" -ServiceName "Frontend"
} else {
    Write-Warning "⚠️ FRONTEND_SERVICE_ID not set, skipping Frontend configuration"
}

Write-Host "`n✅ Railway services configured successfully!"
Write-Host "⚠️ Note: You may need to manually add build args for Frontend service:"
Write-Host "   - VITE_BACKEND_URL"
Write-Host "   - VITE_CLERK_PUBLISHABLE_KEY"
