# RAILWAY FIX - Die ultimative Lösung

## Das Problem

Railway erkennt automatisch `Dockerfile.backend` für ALLE Services, weil:
1. `Dockerfile.backend` ist im Root-Verzeichnis
2. Railway TOML-Dateien werden ignoriert
3. Jeder Service braucht die Environment Variable `RAILWAY_CONFIG_FILE`

## Die Lösung (genau wie bei NotePad)

### 1. Backend Service
**Environment Variable hinzufügen:**
```
RAILWAY_CONFIG_FILE=railway.toml
```

Das sorgt dafür, dass Railway `railway.toml` verwendet, welches `Dockerfile.backend` referenziert.

### 2. Frontend Service
**Environment Variable hinzufügen:**
```
RAILWAY_CONFIG_FILE=railway.frontend.toml
```

Das sorgt dafür, dass Railway `railway.frontend.toml` verwendet, welches `Dockerfile.frontend` referenziert.

**Zusätzlich Build Args sicherstellen:**
- `VITE_BACKEND_URL` ist bereits gesetzt ✅
- `VITE_CLERK_PUBLISHABLE_KEY` ist bereits gesetzt ✅

### 3. NSQ Service
**Bereits korrekt konfiguriert:**
```
RAILWAY_CONFIG_FILE=railway.nsq.toml ✅
```

NSQ sollte funktionieren sobald die ENV Variable aktiv ist.

## Schritt-für-Schritt Anleitung

### Backend Service

1. Gehe zu Backend Service → Variables
2. Füge neue Variable hinzu:
   - Name: `RAILWAY_CONFIG_FILE`
   - Value: `railway.toml`
3. Redeploy

### Frontend Service

1. Gehe zu Frontend Service → Variables
2. Füge neue Variable hinzu:
   - Name: `RAILWAY_CONFIG_FILE`
   - Value: `railway.frontend.toml`
3. Redeploy

### NSQ Service

1. NSQ hat bereits `RAILWAY_CONFIG_FILE=railway.nsq.toml`
2. Stelle sicher, dass die Variable aktiv ist
3. Falls nicht, setze sie und redeploy

## Warum funktioniert das?

Railway liest die Environment Variable `RAILWAY_CONFIG_FILE` und verwendet die angegebene TOML-Datei für die Build-Konfiguration. Ohne diese Variable verwendet Railway Auto-Detection und findet immer `Dockerfile.backend` zuerst.

## Erwartetes Ergebnis

Nach dem Setzen der Variablen:

✅ **Backend** baut mit `Dockerfile.backend` (via `railway.toml`)
✅ **Frontend** baut mit `Dockerfile.frontend` (via `railway.frontend.toml`)
✅ **NSQ** baut mit `Dockerfile.nsq` (via `railway.nsq.toml`)

Keine Railpack-Fehler mehr!
Keine "wrong Dockerfile" Fehler mehr!

## Verifizierung

Nach Redeploy sollten die Build-Logs zeigen:
- Backend: "Using Detected Dockerfile: Dockerfile.backend"
- Frontend: "Using Detected Dockerfile: Dockerfile.frontend"
- NSQ: "Using Detected Dockerfile: Dockerfile.nsq"
