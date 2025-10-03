# 🚀 Railway Deployment mit Encore - Vollständige Anleitung

## 📋 Übersicht

Diese Anleitung zeigt dir die **richtige und vollständige** Methode um deine Encore-App auf Railway zu deployen.

**Workflow:**
1. ✅ GitHub Actions buildet Docker Image mit `encore build docker`
2. ✅ Image wird zu GitHub Container Registry gepusht
3. ✅ Railway pullt und deployed das Image automatisch

---

## 🔧 Schritt 1: GitHub Repository vorbereiten

### 1.1 GitHub Actions Workflow ist bereits erstellt

Die Datei `.github/workflows/deploy-railway.yml` wurde erstellt.

**Was dieser Workflow macht:**
- Installiert Encore CLI
- Buildet deine App mit `encore build docker`
- Pusht das Image zu GitHub Container Registry (ghcr.io)
- Läuft automatisch bei jedem Push zu `main`

---

## 📦 Schritt 2: GitHub Container Registry Package öffentlich machen

### 2.1 Erstes Deployment durchführen

```bash
git add .
git commit -m "Add GitHub Actions workflow for Encore build"
git push origin main
```

### 2.2 Warte auf GitHub Actions

1. Gehe zu GitHub → Dein Repository
2. Tab "Actions"
3. Warte bis Workflow "Build and Deploy Encore App to Railway" fertig ist (~2-3 Min)

### 2.3 Package öffentlich machen

1. Gehe zu deinem GitHub Profil
2. Tab "Packages"
3. Finde Package `talea-storytelling-platform`
4. Klick drauf → "Package settings"
5. Scroll zu "Danger Zone"
6. **"Change visibility" → "Public"**

**Warum?** Railway braucht Zugriff auf dein Container Image.

---

## 🚂 Schritt 3: Railway Service erstellen

### 3.1 Alten Service löschen (falls vorhanden)

Im Railway Dashboard:
1. Gehe zu deinem Projekt
2. Klick auf den alten "backend" Service
3. Settings → "Delete Service"

### 3.2 Neuen Service mit Docker Image erstellen

1. **Im Railway Dashboard**: Klick "+ New"
2. Wähle **"Empty Service"**
3. Name: `backend`

### 3.3 Docker Image konfigurieren

1. Klick auf den neuen Service
2. **Settings** Tab
3. Scroll zu **"Source"**
4. Wähle **"Deploy from Docker Image"**
5. **Image URL eingeben**:
   ```
   ghcr.io/DEIN-GITHUB-USERNAME/talea-storytelling-platform:latest
   ```

   ⚠️ **Ersetze** `DEIN-GITHUB-USERNAME` mit deinem GitHub Username!

   Beispiel: Wenn dein GitHub Username `johndoe` ist:
   ```
   ghcr.io/johndoe/talea-storytelling-platform:latest
   ```

6. **Save Changes**

---

## 🗄️ Schritt 4: PostgreSQL Datenbank (falls noch nicht vorhanden)

### 4.1 PostgreSQL hinzufügen

1. **Im Railway Dashboard**: Klick "+ New"
2. **Database** → **PostgreSQL**
3. Railway erstellt die Datenbank und setzt automatisch `DATABASE_URL`

---

## 🔐 Schritt 5: Environment Variables setzen

### 5.1 Im Railway Service (backend)

Gehe zu: **Service** → **Variables** → **+ New Variable**

Setze diese Variables:

```bash
# Port (wichtig!)
PORT=8080

# Clerk Authentication
ClerkSecretKey=sk_test_DEIN_CLERK_SECRET

# Runware AI
RunwareApiKey=sk-DEIN_RUNWARE_KEY

# Optional: OpenAI
OPENAI_API_KEY=sk-DEIN_OPENAI_KEY
```

**DATABASE_URL** wird automatisch gesetzt wenn du PostgreSQL hinzugefügt hast.

### 5.2 Port 8080 wichtig!

Encore Docker Images laufen **standardmäßig auf Port 8080**. Railway muss das wissen.

---

## 🌐 Schritt 6: Domain generieren

1. **Service** → **Settings**
2. Scroll zu **"Networking"**
3. **"Generate Domain"**
4. Du bekommst: `https://backend-production-XXXX.up.railway.app`

---

## 🚀 Schritt 7: Deployment auslösen

### 7.1 Automatisches Deployment

Jedes Mal wenn du zu GitHub pushst:
```bash
git push origin main
```

→ GitHub Actions buildet neues Image
→ Railway pullt automatisch das neueste Image
→ Service wird neu deployed

### 7.2 Manuelles Deployment

Im Railway Service:
1. Klick auf **"Deploy"**
2. Railway pullt das neueste Image von GHCR
3. Startet den Container

---

## 🔍 Schritt 8: Logs checken

### 8.1 GitHub Actions Logs

1. GitHub → Repository → Actions
2. Klick auf den neuesten Workflow Run
3. Check ob Build erfolgreich war

### 8.2 Railway Logs

1. Railway Service → **Deployments**
2. Klick auf aktuelles Deployment
3. **View Logs**

**Erwarte:**
```
✅ Starting Encore application
✅ Running database migrations
✅ Listening on :8080
✅ Ready to handle requests
```

---

## ✅ Deployment Checklist

- [ ] GitHub Actions Workflow läuft erfolgreich
- [ ] Docker Image in GitHub Packages sichtbar
- [ ] Package ist "Public"
- [ ] Railway Service mit Docker Image konfiguriert
- [ ] PostgreSQL Datenbank erstellt
- [ ] Environment Variables gesetzt (PORT=8080, ClerkSecretKey, RunwareApiKey)
- [ ] Domain generiert
- [ ] Logs zeigen "Ready to handle requests"
- [ ] Domain öffnen funktioniert

---

## 🐛 Troubleshooting

### Problem: "Image pull failed"

**Lösung:**
- GitHub Package muss **Public** sein
- Image URL muss korrekt sein: `ghcr.io/USERNAME/REPO:latest`

### Problem: "Port mismatch"

**Lösung:**
- Setze `PORT=8080` in Railway Variables
- Encore Docker Images nutzen Port 8080 standardmäßig

### Problem: "Database connection failed"

**Lösung:**
- Prüfe ob `DATABASE_URL` gesetzt ist (automatisch von Railway PostgreSQL)
- Prüfe Railway Logs für Database Errors

### Problem: "Authentication failed"

**Lösung:**
- `ClerkSecretKey` muss gesetzt sein
- Prüfe ob der Wert korrekt ist (beginnt mit `sk_test_` oder `sk_live_`)

---

## 🔄 Updates deployen

### Einfacher Workflow:

1. **Code ändern**
2. **Commit & Push:**
   ```bash
   git add .
   git commit -m "Update feature X"
   git push origin main
   ```
3. **GitHub Actions buildet automatisch**
4. **Railway deployed automatisch**
5. **Fertig!** ✅

---

## 📊 Architektur-Übersicht

```
┌─────────────┐
│   GitHub    │
│  (Code Repo)│
└──────┬──────┘
       │ push
       ▼
┌─────────────────┐
│ GitHub Actions  │
│ encore build    │
│     docker      │
└──────┬──────────┘
       │ push image
       ▼
┌────────────────────┐
│ GitHub Container   │
│    Registry        │
│ (ghcr.io)          │
└──────┬─────────────┘
       │ pull image
       ▼
┌────────────────────┐
│     Railway        │
│  (Production)      │
│ + PostgreSQL       │
└────────────────────┘
```

---

## 🎉 Fertig!

Deine Encore-App läuft jetzt **richtig und vollständig** auf Railway!

**Vorteile dieser Methode:**
- ✅ Production-ready mit kompilierter App
- ✅ Automatisches Deployment bei Git Push
- ✅ Kein Development-Mode auf Production
- ✅ Optimierte Docker Images
- ✅ Proper Database Migrations
- ✅ Volle Encore Features

---

## 📚 Weitere Ressourcen

- [Encore Railway Deployment Docs](https://encore.dev/docs/ts/self-host/deploy-railway)
- [GitHub Container Registry Docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Railway Docker Deployment](https://docs.railway.app/deploy/deployments#docker-image)

---

**Bei Problemen:** Check GitHub Actions Logs UND Railway Logs!
