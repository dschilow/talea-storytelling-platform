# ⚠️ WICHTIG: Manuelle Railway Konfiguration erforderlich

## Problem

Railway liest nur **EINE** `railway.toml` Datei für ALLE Services im Projekt.

Das bedeutet:
- ❌ `railway.frontend.toml` wird IGNORIERT
- ❌ Frontend Service versucht `Dockerfile.backend` zu nutzen
- ❌ Build schlägt fehl!

## ✅ Lösung: Manuelle Konfiguration

Du musst **jeden Service manuell** in Railway konfigurieren.

---

## Schritt-für-Schritt Anleitung

### 1. Backend Service konfigurieren

1. **Railway Dashboard** → Dein Projekt
2. **Backend Service** anklicken
3. **Settings** → **Build**
4. Setze:
   ```
   Builder: DOCKERFILE
   Dockerfile Path: Dockerfile.backend
   ```
5. **Settings** → **Deploy**
   ```
   Start Command: /app/start.sh
   Health Check Path: /health
   Health Check Timeout: 300
   Restart Policy: ON_FAILURE
   ```

### 2. Frontend Service konfigurieren

1. **Railway Dashboard** → Dein Projekt
2. **Frontend Service** anklicken
3. **Settings** → **Build**
4. Setze:
   ```
   Builder: DOCKERFILE
   Dockerfile Path: Dockerfile.frontend  ← WICHTIG!
   ```
5. **Settings** → **Deploy**
   ```
   Health Check Path: /
   Health Check Timeout: 100
   Restart Policy: ON_FAILURE
   ```

### 3. Services neu deployen

Nach der Konfiguration:
1. Beide Services → **Deploy** → **Redeploy**
2. Oder: Push einen neuen Commit

---

## Verification

### Backend Service
- **Build Logs** sollten zeigen: `Building with Dockerfile: Dockerfile.backend`
- **Start Command**: `/app/start.sh`
- **Health Check**: `GET /health` sollte `200 OK` sein

### Frontend Service
- **Build Logs** sollten zeigen: `Building with Dockerfile: Dockerfile.frontend`
- **Nginx** sollte starten
- **Health Check**: `GET /` sollte `200 OK` sein

---

## Alternative: Nixpacks (NICHT empfohlen)

Wenn Railway Nixpacks statt Dockerfile nutzt:
1. Settings → Build
2. Wähle: **Dockerfile** (nicht Nixpacks)
3. Setze Dockerfile Path manuell

---

## Screenshots (zur Referenz)

### Backend Service Settings

```
┌─────────────────────────────────────┐
│ Settings → Build                    │
├─────────────────────────────────────┤
│ Builder: DOCKERFILE                 │
│ Dockerfile Path: Dockerfile.backend │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Settings → Deploy                   │
├─────────────────────────────────────┤
│ Start Command: /app/start.sh        │
│ Health Check Path: /health          │
│ Health Check Timeout: 300           │
└─────────────────────────────────────┘
```

### Frontend Service Settings

```
┌─────────────────────────────────────┐
│ Settings → Build                    │
├─────────────────────────────────────┤
│ Builder: DOCKERFILE                 │
│ Dockerfile Path: Dockerfile.frontend│  ← WICHTIG!
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Settings → Deploy                   │
├─────────────────────────────────────┤
│ Health Check Path: /                │
│ Health Check Timeout: 100           │
└─────────────────────────────────────┘
```

---

## Häufige Fehler

### ❌ Frontend nutzt Backend Dockerfile

**Symptom:**
```
Error: Cannot find module 'encore.dev/api'
```

**Lösung:**
- Frontend Service → Settings → Build
- Setze: `Dockerfile Path: Dockerfile.frontend`

### ❌ Build schlägt fehl: "No such file or directory"

**Symptom:**
```
COPY failed: file not found in build context
```

**Lösung:**
- Prüfe dass `Dockerfile.frontend` und `Dockerfile.backend` im Root liegen
- Prüfe dass Railway das richtige Dockerfile nutzt

### ❌ Nixpacks wird statt Dockerfile genutzt

**Symptom:**
```
Nixpacks detected Node.js
```

**Lösung:**
- Settings → Build
- Builder: **DOCKERFILE** (explizit wählen)

---

## Summary

✅ **Backend:** `Dockerfile.backend` + `/app/start.sh`  
✅ **Frontend:** `Dockerfile.frontend` + nginx  
⚠️ **Manuelle Konfiguration:** MUSS in Railway Dashboard gemacht werden  
❌ **railway.frontend.toml:** Wird ignoriert (nur zur Referenz)

---

**Nach der Konfiguration sollten beide Services sauber deployen!** ✅

