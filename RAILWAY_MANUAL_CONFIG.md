# 🚂 Railway Manual Configuration für Multi-Service Setup

## ❌ Problem

Railway verwendet standardmäßig **EINE** `railway.toml` für **ALLE** Services im Projekt. Dies führt zu Konflikten, wenn Backend und Frontend unterschiedliche Dockerfiles benötigen.

## ✅ Lösung: Manuelle Konfiguration im Railway Dashboard

### 📋 **Schritt-für-Schritt Anleitung**

---

## **1️⃣ Backend Service Konfiguration**

### **A) Settings → Build**

```
Builder: DOCKERFILE
Dockerfile Path: Dockerfile.backend
Watch Paths: (leer lassen oder: backend/**)
```

### **B) Settings → Deploy**

```
Custom Start Command: /app/start.sh
Health Check Path: /health
Health Check Timeout: 300
Restart Policy: ON_FAILURE
Max Retries: 10
```

### **C) Settings → Environment Variables**

```
PORT=8080
PGHOST=postgres.railway.internal
PGPORT=5432
PGDATABASE=railway
PGUSER=postgres
PGPASSWORD=${{Postgres.PGPASSWORD}}
ClerkSecretKey=sk_live_...
OpenAIKey=sk-...
```

---

## **2️⃣ Frontend Service Konfiguration**

### **A) Settings → Build**

⚠️ **WICHTIG: Hier MUSS manuell konfiguriert werden!**

```
Builder: DOCKERFILE
Dockerfile Path: Dockerfile.frontend  ← ÄNDERN von Dockerfile.backend!
Watch Paths: (leer lassen oder: frontend/**)
```

### **B) Settings → Deploy**

```
Custom Start Command: (leer lassen - Nginx startet automatisch)
```

### **C) Settings → Environment Variables**

```
VITE_BACKEND_URL=https://backend-production-xxxx.up.railway.app
VITE_CLIENT_TARGET=https://backend-production-xxxx.up.railway.app
```

*(xxxx durch deine tatsächliche Backend-URL ersetzen)*

---

## **3️⃣ PostgreSQL Service**

### **Settings → Connect**

Kopiere diese Werte für Backend Environment Variables:

```
PGHOST=postgres.railway.internal
PGPORT=5432
PGDATABASE=railway
PGUSER=postgres
PGPASSWORD=${{Postgres.PGPASSWORD}}
```

---

## 🎯 **So überschreibst du die railway.toml im Dashboard**

### **Für den Frontend Service:**

1. **Gehe zu:** Frontend Service → Settings
2. **Scrolle zu:** "Build" Section
3. **Klicke auf:** Den kleinen Stift/Edit-Button rechts neben "Dockerfile Path"
4. **ODER:** Klicke auf "Raw Editor" (falls verfügbar)
5. **Ändere:**
   ```
   dockerfilePath = "Dockerfile.frontend"
   ```

### **Falls das Feld wirklich gesperrt ist:**

1. **Lösche die Umgebungsvariable** `RAILWAY_CONFIG_FILE` (falls vorhanden)
2. **Gehe zu:** Service Settings → General
3. **Suche nach:** "Source Repository" oder "Root Directory"
4. **Setze Root Directory auf:** `/` (root)
5. **Versuche erneut**, das Dockerfile Path Feld zu editieren

---

## 🚨 **Letzte Option: railway.toml temporär deaktivieren**

Falls Railway die `railway.toml` zwingend auf alle Services anwendet:

### **Option A: Umbenennen (Empfohlen für Testing)**

```bash
git mv railway.toml railway.backend.reference.toml
git commit -m "Disable railway.toml for manual configuration"
git push
```

Dann im Railway Dashboard **beide Services manuell** konfigurieren wie oben beschrieben.

### **Option B: Service-spezifische TOML (Railway Enterprise)**

Falls du Railway Pro/Enterprise hast:

```toml
# railway.toml
[[services]]
name = "backend"
build.builder = "DOCKERFILE"
build.dockerfilePath = "Dockerfile.backend"

[[services]]
name = "frontend"
build.builder = "DOCKERFILE"
build.dockerfilePath = "Dockerfile.frontend"
```

⚠️ **Hinweis:** Diese Syntax funktioniert nur mit Railway Pro/Enterprise.

---

## ✅ **Verification nach der Konfiguration**

### **Backend Deployment Logs sollten zeigen:**

```
✅ Building with Dockerfile: Dockerfile.backend
✅ Installing Caddy...
✅ Installing Encore CLI...
✅ Starting Encore on port 4001...
✅ Starting Caddy on port 8080...
```

### **Frontend Deployment Logs sollten zeigen:**

```
✅ Building with Dockerfile: Dockerfile.frontend
✅ npm install
✅ npm run build
✅ Build completed: dist/
✅ Starting Nginx...
```

---

## 📚 **Weitere Ressourcen**

- [Railway Multi-Service Documentation](https://docs.railway.app/deploy/deployments#monorepo-support)
- [Railway TOML Reference](https://docs.railway.app/deploy/railway-toml)
- `ANLEITUNG_FUER_DIMITRI.md` - Vollständige Deployment-Anleitung

---

## 💡 **Quick Fix für dein aktuelles Problem**

1. **Im Frontend Service Settings:**
   - Gehe zu "Settings" Tab
   - Scrolle zu "Build" Section
   - Klicke auf das ⚙️ Zahnrad oder "Edit Raw Config"
   - Ändere `dockerfilePath = "Dockerfile.backend"` zu `dockerfilePath = "Dockerfile.frontend"`
   - Speichern
   - Redeploy

2. **Falls "Edit Raw Config" Button nicht sichtbar:**
   - Gehe zu Railway Project Settings (nicht Service Settings!)
   - Suche nach "Configuration Mode" oder "Advanced Settings"
   - Aktiviere "Manual Configuration" oder "Override TOML"

3. **Falls nichts funktioniert:**
   - Kontaktiere Railway Support und frage nach "per-service TOML override"
   - Oder nutze die "Umbenennen" Lösung oben

---

**Erstellt:** 2025-10-14  
**Projekt:** Talea Storytelling Platform  
**Railway Version:** v2 (Standard Hobby Plan)
