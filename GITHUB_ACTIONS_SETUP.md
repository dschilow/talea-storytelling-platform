# 🚀 GitHub Actions Setup für Talea Backend

## 📦 Deployment Strategie (wie NotePad Projekt)

**Warum GitHub Actions + GHCR?**

Das Talea Projekt nutzt jetzt die gleiche Strategie wie das NotePad Projekt:

1. **Backend:** GitHub Actions baut Docker Image → Push zu GHCR → Railway deployed fertiges Image
2. **Frontend:** Railway baut direkt aus GitHub Repo mit `railway.frontend.toml`
3. **Vorteil:** Keine Dockerfile Path Konflikte, saubere Trennung

---

## 🔧 Setup Schritte

### **1. GitHub Repository Settings**

#### **A) GHCR Package Visibility**

1. Gehe zu deinem GitHub Repo: `https://github.com/DEIN_USERNAME/talea-storytelling-platform`
2. Klicke auf **"Settings" → "Actions" → "General"**
3. Scrolle zu **"Workflow permissions"**
4. Aktiviere:
   - ✅ **"Read and write permissions"**
   - ✅ **"Allow GitHub Actions to create and approve pull requests"**
5. **Save**

#### **B) Railway Secrets hinzufügen**

1. In deinem GitHub Repo → **"Settings" → "Secrets and variables" → "Actions"**
2. Klicke **"New repository secret"**
3. Füge hinzu:

**Secret 1: RAILWAY_TOKEN**
```
Name: RAILWAY_TOKEN
Secret: <Dein Railway API Token>
```

**Wie bekommst du den Railway Token?**
1. Gehe zu [railway.app](https://railway.app)
2. Klicke auf dein Profil (oben rechts) → **"Account Settings"**
3. Gehe zu **"Tokens"** → **"Create Token"**
4. Kopiere den Token und füge ihn als Secret hinzu

**Secret 2: RAILWAY_SERVICE_ID**
```
Name: RAILWAY_SERVICE_ID
Secret: <Deine Backend Service ID>
```

**Wie bekommst du die Service ID?**
1. Gehe zu deinem Railway Projekt
2. Klicke auf den **Backend Service**
3. In der URL steht: `railway.app/project/XXXX/service/YYYY`
4. Kopiere `YYYY` (das ist die Service ID)

---

### **2. Railway Backend Service konfigurieren**

**⚠️ WICHTIG: Ändere Backend Service Source zu "Docker Image"**

#### **Option A: Über Railway Dashboard (Empfohlen)**

1. **Gehe zu:** Railway Projekt → **Backend Service**
2. **Klicke auf:** Settings → **Source**
3. **Klicke auf:** "Disconnect" (beim aktuellen GitHub Repo)
4. **Klicke auf:** "+ New" → **"Docker Image"**
5. **Image URL eingeben:**
   ```
   ghcr.io/DEIN_GITHUB_USERNAME/talea-backend:latest
   ```
   (Ersetze `DEIN_GITHUB_USERNAME` mit deinem GitHub Username)

6. **Save**

7. **Authentifizierung für GHCR:**
   - Railway fragt nach Credentials für GHCR
   - **Username:** Dein GitHub Username
   - **Password/Token:** Erstelle ein GitHub Personal Access Token:
     1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
     2. Generate new token (classic)
     3. Scopes: ✅ `read:packages`
     4. Copy token
     5. Füge in Railway ein

#### **Option B: Über Railway CLI**

```bash
railway service --service backend --image ghcr.io/DEIN_GITHUB_USERNAME/talea-backend:latest
```

---

### **3. Frontend Service prüfen**

1. **Gehe zu:** Railway Projekt → **Frontend Service**
2. **Settings → Source:**
   - ✅ Sollte **GitHub Repo** sein: `talea-storytelling-platform`
3. **Settings → Build:**
   - ✅ Builder: **DOCKERFILE**
   - ✅ Config File: **railway.frontend.toml** ← Sollte automatisch erkannt werden
   - ✅ Dockerfile Path: **Dockerfile.frontend**

---

### **4. Ersten Deployment triggern**

#### **Manueller Build (für erstes Image):**

Da GitHub Actions nur bei `git push` läuft, musst du entweder:

**A) Dummy Commit machen:**
```bash
cd C:\MyProjects\Talea\talea-storytelling-platform
git add .
git commit -m "Setup GitHub Actions for backend deployment"
git push
```

**B) Oder GitHub Action manuell triggern:**
1. Gehe zu GitHub Repo → **"Actions"**
2. Klicke auf Workflow: **"Build and Deploy Talea Backend to Railway"**
3. Klicke **"Run workflow"**
4. Wähle Branch: **main**
5. Klicke **"Run workflow"**

#### **Logs prüfen:**

1. **GitHub Actions:**
   - GitHub Repo → Actions → Neuester Workflow Run
   - Sollte zeigen:
     ```
     ✅ Checkout code
     ✅ Setup Node.js
     ✅ Log in to GHCR
     ✅ Install Encore CLI
     ✅ Build frontend
     ✅ Build Docker image with Encore
     ✅ Push Docker image
     ✅ Trigger Railway deployment
     ```

2. **Railway Backend Service:**
   - Railway → Backend Service → Deployments
   - Sollte zeigen:
     ```
     ✅ Pulling image from ghcr.io/DEIN_USERNAME/talea-backend:latest
     ✅ Starting container...
     ✅ Healthy
     ```

---

## 🔄 Workflow

### **Bei jedem Git Push (zu main):**

1. **GitHub Actions** (automatisch):
   - Erkennt Änderungen in `backend/**` oder `Dockerfile.backend`
   - Baut neues Docker Image
   - Pusht zu GHCR: `ghcr.io/DEIN_USERNAME/talea-backend:latest`
   - Triggert Railway Redeploy via API

2. **Railway Backend** (automatisch):
   - Zieht neues Image von GHCR
   - Startet Container neu
   - Health Check: `/health`

3. **Railway Frontend** (automatisch):
   - Erkennt Änderungen in `frontend/**`
   - Baut neues Frontend mit `railway.frontend.toml`
   - Deployed

---

## 🐛 Troubleshooting

### **Problem: "Failed to authenticate with registry"**

**Lösung:**
1. Gehe zu GitHub Repo → Packages
2. Klicke auf `talea-backend` Package
3. Package settings → **"Change visibility"** → **"Public"**
4. Oder: Railway Service Credentials aktualisieren

---

### **Problem: "Image not found"**

**Ursache:** GitHub Actions hat noch kein Image gepusht.

**Lösung:**
1. Prüfe GitHub Actions Logs
2. Stelle sicher, dass der Workflow durchgelaufen ist
3. Prüfe GHCR: `https://github.com/DEIN_USERNAME?tab=packages`

---

### **Problem: "encore: command not found" in GitHub Actions**

**Lösung:** Workflow installiert Encore CLI automatisch. Falls das fehlschlägt:
```yaml
- name: Install Encore CLI
  run: |
    curl -L https://encore.dev/install.sh | bash
    echo "$HOME/.encore/bin" >> $GITHUB_PATH
```

---

## 📊 Vorteile dieser Strategie

| Aspekt | Vorher (beide aus Repo) | Jetzt (Backend via GHCR) |
|--------|-------------------------|--------------------------|
| **Dockerfile Konflikt** | ❌ Ja, railway.toml überschreibt | ✅ Nein, separate Sources |
| **Build Zeit** | 🐌 Railway baut alles | ⚡ GitHub Actions baut parallel |
| **Caching** | ❌ Railway Cache Probleme | ✅ GitHub Actions Layer Cache |
| **Kontrolle** | ❌ Railway Build Logs begrenzt | ✅ Volle GitHub Actions Logs |
| **Image Versioning** | ❌ Keine Tags | ✅ GHCR mit Tags möglich |

---

## 🚀 Nächste Schritte

1. ✅ GitHub Actions Workflow erstellt
2. ✅ railway.toml deaktiviert
3. ✅ railway.frontend.toml konfiguriert
4. ⏳ **Du musst:** Railway Secrets hinzufügen
5. ⏳ **Du musst:** Backend Service Source ändern zu Docker Image
6. ⏳ **Du musst:** Ersten Git Push machen

---

**Bereit für Deployment?** → Siehe [ANLEITUNG_FUER_DIMITRI.md](./ANLEITUNG_FUER_DIMITRI.md)

**Erstellt:** 2025-10-14  
**Projekt:** Talea Storytelling Platform  
**Strategie:** GitHub Actions + GHCR (wie NotePad)

