# Railway Deployment - Komplette Lösung

## Diagnose der aktuellen Probleme

### 1. Services verwenden falsche Dockerfiles
- **Backend**: Verwendet `Dockerfile.backend` ✅ (korrekt, aber Healthcheck schlägt fehl)
- **Frontend**: Verwendet `Dockerfile.backend` ❌ (sollte `Dockerfile.frontend` sein)
- **NSQ**: Verwendet Railpack ❌ (sollte `Dockerfile.nsq` sein)

### 2. Backend läuft, aber Healthcheck schlägt fehl
Backend Logs zeigen:
```
encore runtime successfully initialized ✅
gateway listening for incoming requests ✅
```

Aber Healthcheck an `/health` schlägt fehl → **Caddy Problem**

### 3. Falsche Environment Variables
```
DATABASE_URL="DATABASE_URL="postgresql://...  # DOPPELT!
ENCORE_DB_*_URL="postgresql://${{Postgres.PGUSER}}:..."  # Template nicht aufgelöst!
```

## Die Lösung in 3 Schritten

### Schritt 1: RAILWAY_CONFIG_FILE für alle Services setzen

#### Backend Service
1. Gehe zu Backend → Variables
2. Füge hinzu: `RAILWAY_CONFIG_FILE` = `railway.toml`
3. **Lösche die falsche DATABASE_URL Variable** (die mit doppeltem "DATABASE_URL=")
4. **Lösche alle ENCORE_DB_*_URL Variables** (die werden automatisch von Encore generiert)

#### Frontend Service
1. Gehe zu Frontend → Variables
2. Füge hinzu: `RAILWAY_CONFIG_FILE` = `railway.frontend.toml`
3. Stelle sicher Build Args sind gesetzt:
   - `VITE_BACKEND_URL` ✅
   - `VITE_CLERK_PUBLISHABLE_KEY` ✅

#### NSQ Service
1. Gehe zu NSQ → Variables
2. Verifiziere: `RAILWAY_CONFIG_FILE` = `railway.nsq.toml` ist gesetzt ✅

### Schritt 2: Redeploy nach neuem Code-Push

Der neueste Push enthält:
- ✅ Caddy proxy fix (`localhost` → `127.0.0.1`)
- ✅ Korrekte Secret-Namen in `infra.config.railway.json`
- ✅ `buckets: []` Feld vorhanden

Nach dem Setzen der `RAILWAY_CONFIG_FILE` Variables → Redeploy alle Services

### Schritt 3: Verifizierung

#### Backend sollte zeigen:
```
✅ Using Detected Dockerfile: Dockerfile.backend
✅ encore runtime successfully initialized
✅ Caddy listening on port 8080
✅ Healthcheck passed (/health)
```

#### Frontend sollte zeigen:
```
✅ Using Detected Dockerfile: Dockerfile.frontend
✅ nginx serving static files
✅ Frontend accessible
```

#### NSQ sollte zeigen:
```
✅ Using Detected Dockerfile: Dockerfile.nsq
✅ nsqd started
✅ nsqlookupd started
```

## Warum funktioniert das?

**Problem:** Railway findet automatisch `Dockerfile.backend` im Root und verwendet es für ALLE Services.

**Lösung:** `RAILWAY_CONFIG_FILE` teilt Railway mit, welche TOML-Datei verwendet werden soll. Jede TOML-Datei spezifiziert ihr eigenes Dockerfile:
- `railway.toml` → `Dockerfile.backend`
- `railway.frontend.toml` → `Dockerfile.frontend`
- `railway.nsq.toml` → `Dockerfile.nsq`

**Genau so funktioniert es bei NotePad!**

## Kritische Environment Variables

### Backend (minimal, Encore generiert den Rest):
```bash
RAILWAY_CONFIG_FILE=railway.toml
CLERK_SECRET_KEY=sk_test_...
OPENAI_API_KEY=sk-proj-...
RUNWARE_API_KEY=vs5giq...
PGPASSWORD=${{Postgres.PGPASSWORD}}  # Railway Service Variable Reference
PORT=8080
```

**NICHT** setzen:
- ❌ DATABASE_URL (Encore generiert das)
- ❌ ENCORE_DB_*_URL (Encore generiert das automatisch)

### Frontend:
```bash
RAILWAY_CONFIG_FILE=railway.frontend.toml
VITE_BACKEND_URL=https://backend-2-production-3de1.up.railway.app
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### NSQ:
```bash
RAILWAY_CONFIG_FILE=railway.nsq.toml
```

### Postgres:
```bash
# Bereits korrekt konfiguriert ✅
POSTGRES_DB=railway
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Hq...
```

## Next Steps

1. **Setze `RAILWAY_CONFIG_FILE` für Backend und Frontend** (NSQ hat es schon)
2. **Lösche falsche ENV Variables im Backend** (DATABASE_URL, ENCORE_DB_*)
3. **Warte auf den neuesten Code-Push** (Caddy fix ist committed)
4. **Redeploy alle drei Services**
5. **Überprüfe die Logs**

Das sollte alle Probleme beheben! 🎉
