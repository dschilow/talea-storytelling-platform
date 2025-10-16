# Railway Service Konfiguration Fix

## Problem
Railway ignoriert die `.toml` Konfigurationsdateien und verwendet stattdessen Railpack Auto-Detection. Alle drei Services (Backend, NSQ, Frontend) bauen mit Railpack statt mit Dockerfiles.

## Lösung

### Option 1: Manuell im Railway Dashboard (Empfohlen)

#### Backend Service
1. Gehe zu Backend Service → Settings → Source
2. Ändere **Source Type** von "GitHub Repository" zu **"Image"**
3. Image: `ghcr.io/dschilow/talea-storytelling-platform:latest`
4. Speichern und Redeploy

#### NSQ Service
1. Gehe zu NSQ Service → Settings → Build
2. Setze **Builder** auf "Dockerfile"
3. **Dockerfile Path**: `Dockerfile.nsq`
4. Root Directory: `/` (Standard)
5. Speichern und Redeploy

#### Frontend Service
1. Gehe zu Frontend Service → Settings → Build
2. Setze **Builder** auf "Dockerfile"
3. **Dockerfile Path**: `Dockerfile.frontend`
4. Root Directory: `/` (Standard)
5. Unter Variables → Build Args hinzufügen:
   - `VITE_BACKEND_URL`: Die Railway URL deines Backend Service
   - `VITE_CLERK_PUBLISHABLE_KEY`: Dein Clerk Publishable Key
6. Speichern und Redeploy

### Option 2: Mit Railway API (Automatisch)

```bash
# Setze Environment Variables
export RAILWAY_TOKEN="dein_railway_token"
export BACKEND_SERVICE_ID="backend_service_id"
export NSQ_SERVICE_ID="nsq_service_id"
export FRONTEND_SERVICE_ID="frontend_service_id"

# Führe das Konfigurationsskript aus
bash configure-railway-services.sh
```

## Service IDs finden

Railway Service IDs findest du in der URL im Dashboard:
```
https://railway.app/project/{PROJECT_ID}/service/{SERVICE_ID}
```

Oder mit Railway CLI:
```bash
railway service list
```

## Verifizierung

Nach der Konfiguration sollten die Services:

### Backend
- Source: Image Registry
- Image: `ghcr.io/dschilow/talea-storytelling-platform:latest`
- Keine "Railpack" Logs mehr
- Start mit `/app/start.sh`
- **KEIN** "missing field buckets" Fehler mehr (das neue Image hat `buckets: []`)

### NSQ
- Builder: Dockerfile
- Path: `Dockerfile.nsq`
- Start mit `/start-nsq.sh`
- Ports 4150, 4151, 4160, 4161 exposed

### Frontend
- Builder: Dockerfile
- Path: `Dockerfile.frontend`
- Build Args: VITE_BACKEND_URL, VITE_CLERK_PUBLISHABLE_KEY
- Start mit nginx auf Port 80

## Warum funktionieren .toml Dateien nicht?

Railway `.toml` Dateien werden nur verwendet wenn:
1. Der Service **manuell** im Dashboard mit der TOML-Datei verknüpft wurde
2. Oder der Service per Railway CLI mit `--config` erstellt wurde

Bei automatischer Service-Erkennung aus GitHub verwendet Railway immer Auto-Detection (Railpack), ignoriert aber TOMLs.

## Nächste Schritte

Nach erfolgreicher Konfiguration:
1. Warte auf Redeploys aller drei Services
2. Überprüfe Backend Logs - sollte erfolgreich starten ohne "buckets" Fehler
3. Überprüfe NSQ Logs - sollte nsqd, nsqlookupd starten
4. Überprüfe Frontend Logs - sollte nginx starten
5. Teste die Anwendung über die Frontend URL
