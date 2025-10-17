# Railway Service IDs Anleitung

## Service IDs finden

### Methode 1: Über die URL im Railway Dashboard

Wenn du einen Service im Railway Dashboard öffnest, findest du die Service-ID in der URL:

```
https://railway.app/project/{PROJECT_ID}/service/{SERVICE_ID}
```

Die `{SERVICE_ID}` ist ein langer String wie z.B. `abc123de-f456-7890-ghij-klmnopqrstuv`

### Methode 2: Über Railway CLI (wenn installiert)

```bash
railway service list
```

## PowerShell Skript verwenden

### 1. Service IDs sammeln

Öffne im Railway Dashboard:
- **Backend Service** → Kopiere die Service-ID aus der URL
- **NSQ Service** → Kopiere die Service-ID aus der URL
- **Frontend Service** → Kopiere die Service-ID aus der URL

### 2. Railway Token holen

1. Gehe zu https://railway.app/account/tokens
2. Erstelle ein neues Token
3. Kopiere das Token (es wird nur einmal angezeigt!)

### 3. Skript ausführen

```powershell
# Environment Variables setzen
$env:RAILWAY_TOKEN = "dein_railway_token_hier"
$env:BACKEND_SERVICE_ID = "backend_service_id_hier"
$env:NSQ_SERVICE_ID = "nsq_service_id_hier"
$env:FRONTEND_SERVICE_ID = "frontend_service_id_hier"

# Skript ausführen
.\configure-railway.ps1
```

### Oder inline Parameter:

```powershell
.\configure-railway.ps1 `
  -RailwayToken "dein_token" `
  -BackendServiceId "backend_id" `
  -NsqServiceId "nsq_id" `
  -FrontendServiceId "frontend_id"
```

## Was das Skript macht

1. **Backend Service**:
   - Ändert Source zu "Image Registry"
   - Setzt Image auf `ghcr.io/dschilow/talea-storytelling-platform:latest`

2. **NSQ Service**:
   - Ändert Source zu "GitHub Repository" mit Dockerfile
   - Setzt Dockerfile Path auf `Dockerfile.nsq`

3. **Frontend Service**:
   - Ändert Source zu "GitHub Repository" mit Dockerfile
   - Setzt Dockerfile Path auf `Dockerfile.frontend`
   - ⚠️ Build Args müssen manuell im Dashboard gesetzt werden:
     - `VITE_BACKEND_URL`
     - `VITE_CLERK_PUBLISHABLE_KEY`

## Manuelle Alternative

Falls das Skript nicht funktioniert, kannst du die Services auch manuell im Railway Dashboard konfigurieren (siehe [RAILWAY_CONFIG_FIX.md](RAILWAY_CONFIG_FIX.md)).
