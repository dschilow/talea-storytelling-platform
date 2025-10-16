# 🚀 JETZT AUSFÜHREN - Deployment starten

## ✅ Was ich gefixed habe:

### **Problem 1: `railway.json` überschrieb alles**
- ❌ `railway.json` hatte höchste Priorität
- ❌ Überschrieb `railway.frontend.toml`
- ✅ **GELÖSCHT!**

### **Problem 2: GitHub Actions Workflow nicht gepusht**
- ✅ `.github/workflows/deploy-backend.yml` erstellt
- ⏳ **Muss jetzt gepusht werden!**

---

## 🎯 **SCHRITT 1: Commit & Push (Sofort ausführen!)**

### **Option A: Batch Script (Einfachste)**

**Doppelklick auf:**
```
C:\MyProjects\Talea\talea-storytelling-platform\COMMIT_AND_PUSH.bat
```

Das Script macht alles automatisch und öffnet GitHub Actions!

---

### **Option B: PowerShell (Manuell)**

```powershell
cd C:\MyProjects\Talea\talea-storytelling-platform

# Änderungen anzeigen
git status

# Alle Änderungen hinzufügen
git add -A

# Commit
git commit -m "Switch to GitHub Actions + GHCR (like NotePad) - Delete railway.json"

# Push
git push

# GitHub Actions öffnen
start https://github.com/dschilow/talea-storytelling-platform/actions
```

---

## 🔍 **SCHRITT 2: GitHub Actions prüfen**

1. **Browser öffnet automatisch:** `https://github.com/dschilow/talea-storytelling-platform/actions`

2. **Du solltest sehen:**
   ```
   ✅ Build and Deploy Talea Backend to Railway
   🔄 Running...
   ```

3. **Warte 5-10 Minuten** bis der Build durchgelaufen ist

4. **Erwartetes Ergebnis:**
   ```
   ✅ Checkout code
   ✅ Setup Node.js
   ✅ Log in to GitHub Container Registry
   ✅ Install Encore CLI
   ✅ Install Bun
   ✅ Install backend dependencies
   ✅ Build frontend
   ✅ Copy frontend build to backend
   ✅ Build Docker image with Encore
   ✅ Tag Docker image for GitHub Container Registry
   ✅ Push Docker image
   ✅ Trigger Railway deployment
   ```

---

## 🐳 **SCHRITT 3: Railway Backend Service ändern**

**WICHTIG:** Backend muss von GitHub Repo zu Docker Image wechseln!

### **3.1 Backend Service Source ändern**

1. **Gehe zu:** [Railway Dashboard](https://railway.app)
2. **Klicke auf:** Backend Service
3. **Settings → Source:**
   - Klicke **"Disconnect"** (beim GitHub Repo)
   
4. **Klicke:** "+ New" → **"Docker Image"**

5. **Image URL eingeben:**
   ```
   ghcr.io/dschilow/talea-backend:latest
   ```

6. **Authentifizierung:**
   - **Username:** `dschilow`
   - **Token:** GitHub Personal Access Token
   
   **Token erstellen:**
   1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   2. Generate new token (classic)
   3. Name: `Railway GHCR Access`
   4. Scopes: ✅ **`read:packages`**
   5. Generate token
   6. Kopiere Token und füge in Railway ein

7. **Connect**

### **3.2 Prüfe Image Pull**

Railway sollte jetzt:
```
🔄 Pulling image from ghcr.io/dschilow/talea-backend:latest
✅ Image pulled successfully
✅ Starting container...
✅ Health check passed: /health
```

---

## 📦 **SCHRITT 4: Frontend Service prüfen**

1. **Gehe zu:** Railway → Frontend Service

2. **Settings → Build:**
   - **Sollte jetzt zeigen:**
     ```
     ✅ Config File: railway.frontend.toml (Automatically Detected)
     ✅ Dockerfile: Dockerfile.frontend
     ```
   
   - **NICHT mehr:**
     ```
     ❌ The value is set in railway.json
     ```

3. **Falls nicht automatisch erkannt:**
   - Klicke auf Frontend Service
   - Settings → Source → Disconnect
   - "+ New" → GitHub Repo → talea-storytelling-platform
   - Railway sollte jetzt `railway.frontend.toml` erkennen

---

## ✅ **SCHRITT 5: Erste Deployment testen**

1. **Backend deployed via GHCR?**
   - Railway → Backend Service → Deployments → ✅ Healthy

2. **Frontend deployed via GitHub Repo?**
   - Railway → Frontend Service → Deployments → ✅ Healthy

3. **CORS URL updaten:**
   - Kopiere Frontend URL: `https://frontend-production-XXXX.up.railway.app`
   - Update `backend/encore.app`:
     ```json
     {
       "global_cors": {
         "allow_origins_with_credentials": [
           "https://frontend-production-XXXX.up.railway.app"
         ]
       }
     }
     ```
   - Commit & Push → GitHub Actions baut automatisch neues Backend Image!

4. **Health Check:**
   ```
   https://backend-production-YYYY.up.railway.app/health
   ```
   Sollte zeigen:
   ```json
   {
     "status": "healthy",
     "migrations": {
       "run": true,
       "message": "Migrations completed successfully"
     }
   }
   ```

5. **Frontend testen:**
   - Öffne `https://frontend-production-XXXX.up.railway.app`
   - Sign in mit Clerk
   - Erstelle Avatar
   - 🎉 **Funktioniert!**

---

## 🎯 **WICHTIG: GitHub Secrets setzen**

Damit GitHub Actions automatisch Railway triggern kann:

1. **GitHub Repo → Settings → Secrets and variables → Actions**

2. **Füge hinzu:**

   **RAILWAY_TOKEN:**
   - Railway → Profil → Account Settings → Tokens → Create Token
   - Kopiere Token
   - GitHub: New repository secret → Name: `RAILWAY_TOKEN` → Value: Token

   **RAILWAY_SERVICE_ID:**
   - Railway → Backend Service → URL in Browser: `railway.app/project/XXX/service/YYY`
   - Kopiere `YYY`
   - GitHub: New repository secret → Name: `RAILWAY_SERVICE_ID` → Value: YYY

---

## 🚨 **Falls Probleme auftreten:**

### **Problem: GitHub Actions fehlschlägt**

**Lösung:**
- Prüfe Actions Logs auf GitHub
- Häufige Fehler:
  - ❌ `encore: command not found` → Noch nicht alle Steps durchgelaufen
  - ❌ `permission denied` → GitHub Workflow permissions prüfen
  - ❌ `frontend build failed` → `frontend/package.json` prüfen

### **Problem: Railway kann Image nicht pullen**

**Lösung:**
1. Prüfe ob Image existiert: `https://github.com/dschilow/talea-storytelling-platform/pkgs/container/talea-backend`
2. Image auf "Public" setzen: GitHub → Packages → talea-backend → Package settings → Change visibility → Public
3. Oder: Railway Credentials aktualisieren

### **Problem: Frontend verwendet immer noch falschen Builder**

**Lösung:**
1. Frontend Service komplett löschen
2. Neu erstellen: "+ New" → GitHub Repo → talea-storytelling-platform
3. Railway erkennt automatisch `railway.frontend.toml`

---

## 📚 **Weitere Dokumentation:**

- **[GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)** - Vollständige GitHub Actions Anleitung
- **[ANLEITUNG_FUER_DIMITRI.md](./ANLEITUNG_FUER_DIMITRI.md)** - Komplette Deployment-Anleitung
- **[COMMON_ISSUES_TALEA.md](./COMMON_ISSUES_TALEA.md)** - Troubleshooting

---

**Los geht's! Führe SCHRITT 1 aus (Batch Script oder PowerShell)!** 🚀

**Erstellt:** 2025-10-14  
**Nächster Schritt:** COMMIT_AND_PUSH.bat ausführen

