# 🎯 Quick Fix: Frontend Service verwendet falsches Dockerfile

## ❌ Problem

Der Frontend Service referenziert `Dockerfile.backend` statt `Dockerfile.frontend`, und das Feld ist im Railway Dashboard schreibgeschützt.

## ✅ Lösung

Railway's `railway.toml` wird auf ALLE Services angewendet. Du musst die Konfiguration direkt im Railway Dashboard überschreiben.

---

## **Option 1: Raw Editor verwenden (Empfohlen)**

### **Schritt-für-Schritt:**

1. **Gehe zum Frontend Service** in Railway
2. **Klicke auf "Settings" Tab**
3. **Scrolle zu "Build" Section**
4. **Suche nach einem Button:**
   - `Edit Raw Configuration` ODER
   - `Override Configuration` ODER
   - Ein ⚙️ Zahnrad-Symbol ODER
   - `...` (Drei Punkte) → "Edit Configuration"

5. **Im Raw Editor:**
   ```toml
   [build]
   builder = "DOCKERFILE"
   dockerfilePath = "Dockerfile.frontend"  # ← Hier ändern!
   ```

6. **Speichern** und **Redeploy**

---

## **Option 2: Service-Isolation (Falls Raw Editor nicht verfügbar)**

### **A) Dockerfile Path über Umgebungsvariable setzen**

Railway unterstützt manchmal Overrides via Environment Variables:

1. **Gehe zu:** Frontend Service → Variables
2. **Füge hinzu:**
   ```
   RAILWAY_DOCKERFILE_PATH=Dockerfile.frontend
   ```
3. **Redeploy**

⚠️ **Hinweis:** Dies funktioniert nicht immer zuverlässig.

---

## **Option 3: railway.toml umbenennen (Nuclear Option)**

### **Schritt 1: Umbenennen**

Im Terminal:

```bash
cd C:\MyProjects\Talea\talea-storytelling-platform
git mv railway.toml railway.backend.reference.toml
git add railway.backend.reference.toml
git commit -m "Disable railway.toml to allow per-service configuration"
git push
```

### **Schritt 2: Beide Services manuell konfigurieren**

#### **Backend Service → Settings:**

```
Build:
  Builder: DOCKERFILE
  Dockerfile Path: Dockerfile.backend

Deploy:
  Start Command: /app/start.sh
  Health Check Path: /health
  Health Check Timeout: 300
```

#### **Frontend Service → Settings:**

```
Build:
  Builder: DOCKERFILE
  Dockerfile Path: Dockerfile.frontend  ← Jetzt frei editierbar!

Deploy:
  Start Command: (leer lassen)
```

### **Schritt 3: Beide Services neu deployen**

---

## **Option 4: Separate Git Branches (Advanced)**

Falls du die `railway.toml` behalten möchtest:

1. **Branch für Backend erstellen:**
   ```bash
   git checkout -b railway-backend
   git push -u origin railway-backend
   ```

2. **Im Railway Dashboard:**
   - Backend Service → Settings → Source
   - Branch ändern zu: `railway-backend`

3. **Zurück zu main:**
   ```bash
   git checkout main
   ```

4. **railway.toml für Frontend anpassen:**
   ```toml
   [build]
   builder = "DOCKERFILE"
   dockerfilePath = "Dockerfile.frontend"
   ```

5. **Frontend Service bleibt auf `main` Branch**

⚠️ **Nachteil:** Du musst Änderungen zwischen Branches synchronisieren.

---

## 🎯 **Meine Empfehlung: Option 3 (railway.toml umbenennen)**

### **Vorteile:**
- ✅ Beide Services können unabhängig konfiguriert werden
- ✅ Keine Branch-Komplexität
- ✅ Felder im Railway Dashboard sind editierbar
- ✅ Klar dokumentiert in RAILWAY_MANUAL_CONFIG.md

### **Nachteil:**
- ❌ Konfiguration nur im Railway Dashboard (nicht in Git versioniert)

### **Lösung für den Nachteil:**

Die Datei `railway.backend.reference.toml` dient als Dokumentation:

```toml
# Diese Datei ist nur zur Referenz!
# Tatsächliche Konfiguration erfolgt im Railway Dashboard.
# Siehe: RAILWAY_MANUAL_CONFIG.md

[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile.backend"

[deploy]
startCommand = "/app/start.sh"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

---

## ✅ **Nach dem Fix: Verification**

### **Frontend Logs sollten zeigen:**

```
✅ Using Dockerfile: Dockerfile.frontend
✅ Step 1/12 : FROM node:20-alpine AS builder
✅ Step 5/12 : RUN npm run build
✅ Step 10/12 : FROM nginx:alpine-slim
✅ Successfully deployed!
```

### **NICHT:**

```
❌ Using Dockerfile: Dockerfile.backend
❌ Error: Cannot find package 'encore.dev'
❌ Build failed
```

---

## 📚 **Weitere Dokumentation**

- `RAILWAY_MANUAL_CONFIG.md` - Vollständige manuelle Konfigurationsanleitung
- `ANLEITUNG_FUER_DIMITRI.md` - Komplette Deployment-Anleitung
- [Railway Multi-Service Docs](https://docs.railway.app/deploy/deployments#monorepo-support)

---

**Erstellt:** 2025-10-14  
**Projekt:** Talea Storytelling Platform  
**Status:** Kritischer Fix für Frontend Build
