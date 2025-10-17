# ⚠️ CRITICAL: Railway Environment Variables müssen gesetzt werden!

## 🚨 Das Problem (ULTRATHINK Analyse)

Railway verwendet **automatisch** `Dockerfile.backend` für **ALLE Services**, weil es das erste Dockerfile im Root-Verzeichnis findet.

**Beweis aus deinen Logs:**
- ✅ Backend: "Using Detected Dockerfile: Dockerfile.backend" (korrekt)
- ❌ **Frontend**: "Using Detected Dockerfile: Dockerfile.backend" (FALSCH! Sollte Dockerfile.frontend sein!)
- ❌ **NSQ**: Verwendet Railpack (FALSCH! Sollte Dockerfile.nsq sein!)

## ✅ Die Lösung (Genau wie bei NotePad)

Railway benötigt die **Environment Variable `RAILWAY_CONFIG_FILE`** für jeden Service, um zu wissen, welche TOML-Datei (und damit welches Dockerfile) verwendet werden soll.

## 📋 Was DU jetzt im Railway Dashboard tun musst:

### 1️⃣ Backend Service

Gehe zu: **Backend → Variables** → Klicke auf "New Variable"

**Neue Variable hinzufügen:**
```
Name:  RAILWAY_CONFIG_FILE
Value: railway.toml
```

**Optional aber empfohlen - Lösche diese fehlerhaften Variables:**
- ❌ `DATABASE_URL` (die mit doppeltem "DATABASE_URL=" beginnt)
- ❌ Alle `ENCORE_DB_*_URL` Variables (Encore generiert diese automatisch)

**Behalte diese Variables:**
- ✅ `CLERK_SECRET_KEY`
- ✅ `OPENAI_API_KEY`
- ✅ `RUNWARE_API_KEY`
- ✅ `PGPASSWORD`
- ✅ `PORT=8080`

### 2️⃣ Frontend Service

Gehe zu: **Frontend → Variables** → Klicke auf "New Variable"

**Neue Variable hinzufügen:**
```
Name:  RAILWAY_CONFIG_FILE
Value: railway.frontend.toml
```

**Stelle sicher, dass diese Variables gesetzt sind:**
- ✅ `VITE_BACKEND_URL` (z.B. https://backend-2-production-3de1.up.railway.app)
- ✅ `VITE_CLERK_PUBLISHABLE_KEY` (pk_test_...)

### 3️⃣ NSQ Service

Gehe zu: **NSQ → Variables**

**Überprüfe, dass diese Variable existiert:**
```
Name:  RAILWAY_CONFIG_FILE
Value: railway.nsq.toml
```

Falls nicht vorhanden → Hinzufügen!

## 🔄 Nach dem Setzen der Variables

1. **Redeploy** alle drei Services (Backend, Frontend, NSQ)
2. Railway wird jetzt die korrekten Dockerfiles verwenden:
   - Backend → `Dockerfile.backend` ✅
   - Frontend → `Dockerfile.frontend` ✅
   - NSQ → `Dockerfile.nsq` ✅

## ✅ Erwartetes Ergebnis

### Backend Logs sollten zeigen:
```
✅ Using Detected Dockerfile: Dockerfile.backend
✅ Running database migrations...
✅ Runtime config found
✅ encore runtime successfully initialized
✅ gateway listening for incoming requests
✅ Caddy listening on port 8080
✅ Healthcheck passed!
```

### Frontend Logs sollten zeigen:
```
✅ Using Detected Dockerfile: Dockerfile.frontend
✅ Building Vite app...
✅ nginx started
✅ Serving static files
```

### NSQ Logs sollten zeigen:
```
✅ Using Detected Dockerfile: Dockerfile.nsq
✅ nsqd started
✅ nsqlookupd started
```

## 🎯 Code-Fixes bereits committed:

✅ Migration script umbenannt zu `.cjs` → kein ES module error mehr
✅ Caddy proxy fix (`localhost` → `127.0.0.1`)
✅ Secret-Namen korrigiert in `infra.config.railway.json`
✅ `buckets: []` Feld hinzugefügt

**Alles ist bereit! Du musst nur noch die Environment Variables setzen.**

## 📚 Warum funktioniert das?

Bei NotePad ist genau dieselbe Lösung im Einsatz:
- Jeder Service hat `RAILWAY_CONFIG_FILE` gesetzt
- Jede TOML-Datei referenziert ihr eigenes Dockerfile
- Railway liest die TOML und verwendet das korrekte Dockerfile

**Ohne `RAILWAY_CONFIG_FILE`** → Railway Auto-Detection findet immer `Dockerfile.backend` zuerst!

---

**Nächster Schritt:** Gehe jetzt ins Railway Dashboard und setze die Variables! 🚀
