# Railway Deployment Guide für Talea Storytelling Platform

## 📋 Übersicht

Diese Anleitung führt dich Schritt für Schritt durch das Deployment deiner Talea-App auf Railway.

## 🗄️ Datenbank-Architektur

Deine App verwendet **PostgreSQL** als Production-Datenbank auf Railway.

### Verwendete Datenbanken:
1. **avatar** - Avatar-Daten, Memories, Personality Traits
2. **user** - Benutzerprofile und Rollen
3. **story** - Geschichten und Kapitel
4. **doku** - Dokumentationen
5. **personality_tracking** - AI Personality Updates

### PostgreSQL Setup
- **Lokal**: Encore nutzt SQLite für Development (automatisch)
- **Railway**: PostgreSQL für Production

### Migrations
Alle Datenbanken haben Migrations in `backend/*/migrations/` Ordnern. Encore führt diese automatisch beim Start aus.

**📘 Siehe:** [RAILWAY_POSTGRESQL_SETUP.md](./RAILWAY_POSTGRESQL_SETUP.md) für detaillierte PostgreSQL-Konfiguration

---

## 🚀 Step-by-Step Deployment

### Schritt 1: Railway Account erstellen

1. Gehe zu [railway.app](https://railway.app)
2. Klicke auf "Start a New Project"
3. Melde dich an mit GitHub (empfohlen)

---

### Schritt 2: Neues Projekt erstellen

#### Option A: Von GitHub Repository deployen (empfohlen)

1. Im Railway Dashboard: **"New Project"** → **"Deploy from GitHub repo"**
2. Verbinde dein GitHub Repository
3. Wähle das Repository: `talea-storytelling-platform`
4. Railway erkennt automatisch die Konfiguration

#### Option B: Mit Railway CLI

```bash
# Railway CLI installieren
npm install -g @railway/cli

# Login
railway login

# Projekt erstellen
railway init

# Verlinke mit GitHub
railway link
```

---

### Schritt 2.5: PostgreSQL Datenbank hinzufügen

**Wichtig:** Bevor du die App deployst, erstelle eine PostgreSQL Datenbank!

1. **Im Railway Dashboard**: Klick auf "+ New"
2. Wähle **"Database"** → **"Add PostgreSQL"**
3. Railway erstellt automatisch:
   - PostgreSQL Instanz
   - `DATABASE_URL` Environment Variable
   - Automatische Backups

**Das war's!** Encore nutzt automatisch die `DATABASE_URL` für alle Datenbanken.

**📘 Details:** Siehe [RAILWAY_POSTGRESQL_SETUP.md](./RAILWAY_POSTGRESQL_SETUP.md)

---

### Schritt 3: Environment Variables (Secrets) einrichten

Railway verwendet Environment Variables für sensible Daten. Diese **MÜSSEN** alle gesetzt werden:

#### 🔐 Erforderliche Secrets:

##### 1. **Clerk Authentication** (Wichtig!)

```bash
CLERK_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXX
```

**Wo finde ich das?**
- Gehe zu [clerk.com](https://clerk.com) → Dashboard
- Wähle dein Projekt
- Sidebar: "API Keys"
- Kopiere den **Secret Key** (beginnt mit `sk_test_` oder `sk_live_`)

**In Railway setzen:**
```bash
# Via CLI:
railway variables set CLERK_SECRET_KEY=sk_test_XXXXXXXXX

# ODER im Railway Dashboard:
# Settings → Variables → New Variable
# Name: CLERK_SECRET_KEY
# Value: sk_test_XXXXXXXXX
```

##### 2. **Runware API Key** (für Bildgenerierung)

```bash
RunwareApiKey=sk-XXXXXXXXXXXXXXXXXXXXXXXX
```

**Wo finde ich das?**
- Gehe zu [runware.ai](https://runware.ai)
- Dashboard → API Keys
- Erstelle einen neuen Key oder kopiere einen existierenden

**In Railway setzen:**
```bash
railway variables set RunwareApiKey=sk-XXXXXXXXXXXXXXXX
```

##### 3. **OpenAI API Key** (optional, für erweiterte AI Features)

```bash
OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXXXXXXXXXX
```

**Wo finde ich das?**
- Gehe zu [platform.openai.com](https://platform.openai.com)
- Account → API Keys
- "Create new secret key"

**In Railway setzen:**
```bash
railway variables set OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXX
```

---

### Schritt 4: Encore.dev Secrets konfigurieren

Deine App verwendet Encore.dev, das eigene Secrets verwaltet. Diese müssen als **Encore Secrets** gesetzt werden:

#### ClerkSecretKey in Encore Format:

Railway erkennt automatisch Encore und erstellt die notwendige Infrastruktur. Du musst aber das Secret in der richtigen Form bereitstellen:

**In Railway Dashboard:**
1. Settings → Variables
2. Füge hinzu:

```
ClerkSecretKey=sk_test_XXXXXXXXX
```

**Wichtig:** Encore erwartet den Secret-Namen **ohne Unterstriche** (camelCase).

---

### Schritt 5: Port-Konfiguration

Railway stellt automatisch eine `$PORT` Variable bereit. Die App ist bereits konfiguriert:

**In `nixpacks.toml`:**
```toml
[start]
cmd = 'cd backend && encore run --port=$PORT'
```

**Kein weiterer Schritt erforderlich** ✅

---

### Schritt 6: Frontend Environment Variables

Falls du ein separates Frontend-Service hast, benötigt es:

```bash
# Clerk Publishable Key (nicht geheim, kann öffentlich sein)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXX

# Backend API URL (wird von Railway gesetzt)
VITE_CLIENT_TARGET=https://your-app-name.up.railway.app
```

**Wo finde ich VITE_CLERK_PUBLISHABLE_KEY?**
- Clerk Dashboard → API Keys
- Kopiere "Publishable key" (beginnt mit `pk_test_` oder `pk_live_`)

**VITE_CLIENT_TARGET:**
- Nach dem ersten Deployment gibt dir Railway eine URL
- Format: `https://<your-project>.up.railway.app`

---

### Schritt 7: Deploy ausführen

#### Automatisches Deployment:

Railway deployt automatisch bei jedem Git Push:

```bash
git add .
git commit -m "Railway deployment setup"
git push origin main
```

#### Manuelles Deployment via CLI:

```bash
railway up
```

#### Im Railway Dashboard:

1. Gehe zu deinem Projekt
2. Klicke auf "Deploy"
3. Warte auf Build & Deployment (5-10 Minuten beim ersten Mal)

---

### Schritt 8: Logs überwachen

#### Via CLI:
```bash
railway logs
```

#### Im Dashboard:
1. Projekt öffnen
2. Tab "Deployments"
3. Klicke auf das aktuelle Deployment
4. "View Logs"

**Wichtige Log-Meldungen:**
- ✅ `Database migrations completed`
- ✅ `Encore server running on port XXXX`
- ❌ `Authentication failed` → Clerk Secret falsch
- ❌ `Runware API error` → Runware Key fehlt/falsch

---

### Schritt 9: Custom Domain (optional)

1. Railway Dashboard → Settings → Domains
2. **Railway Domain** (kostenlos):
   - Klicke "Generate Domain"
   - Du bekommst: `your-app.up.railway.app`
3. **Custom Domain**:
   - Klicke "Custom Domain"
   - Gib deine Domain ein (z.B. `talea.deinewebsite.de`)
   - Füge die CNAME Records zu deinem DNS Provider hinzu

---

## 🔧 Troubleshooting

### Problem: Build schlägt fehl

**Lösung:**
```bash
# Lokal testen:
cd backend
bun install
bun run build

# Bei Erfolg: Push zu Git
git push
```

### Problem: "Database migration failed"

**Ursache:** Noch DB existiert nicht oder Migrations sind fehlerhaft

**Lösung:**
- Railway erstellt SQLite Datenbanken automatisch
- Prüfe Migrations: `backend/*/migrations/*.up.sql`
- Logs checken: `railway logs`

### Problem: "Authentication failed"

**Ursache:** Clerk Secret fehlt oder ist falsch

**Lösung:**
1. Prüfe Clerk Dashboard → API Keys
2. Stelle sicher, dass du den **Secret Key** verwendest (nicht Publishable)
3. Setze Variable neu:
   ```bash
   railway variables set ClerkSecretKey=sk_test_NEUER_KEY
   ```
4. Redeploy:
   ```bash
   railway up
   ```

### Problem: "Runware API error"

**Ursache:** Runware API Key fehlt oder ungültig

**Lösung:**
```bash
railway variables set RunwareApiKey=sk-DEIN_KEY
railway up
```

### Problem: Frontend kann Backend nicht erreichen

**Ursache:** CORS oder falsche Backend URL

**Lösung:**
1. Prüfe `VITE_CLIENT_TARGET` im Frontend:
   ```bash
   railway variables set VITE_CLIENT_TARGET=https://dein-backend.up.railway.app
   ```
2. Prüfe CORS-Konfiguration in `backend/auth/auth.ts`:
   - `AUTHORIZED_PARTIES` Array muss deine Railway Domain enthalten

---

## 📊 Datenbank-Backup

### SQLite Datenbanken exportieren:

```bash
# Via Railway CLI
railway run bash

# Im Container:
cd /app/backend
sqlite3 avatar.db .dump > avatar_backup.sql
```

### PostgreSQL Migration (für Produktions-Setup):

Für größere Apps empfiehlt sich PostgreSQL:

1. Railway Dashboard → "New" → "Database" → "PostgreSQL"
2. Kopiere Connection String
3. Ändere Encore DB Config zu PostgreSQL
4. Migrations anpassen

---

## 🔒 Sicherheits-Checkliste

- [ ] Alle Secrets sind gesetzt (Clerk, Runware, OpenAI)
- [ ] `.env` Dateien sind in `.gitignore`
- [ ] Clerk authorized parties enthalten Railway Domain
- [ ] CORS ist korrekt konfiguriert
- [ ] Database Backups sind eingerichtet
- [ ] Logs werden überwacht
- [ ] Health Checks sind aktiv

---

## 📚 Wichtige Links

- [Railway Dashboard](https://railway.app/dashboard)
- [Encore.dev Docs](https://encore.dev/docs)
- [Clerk Docs](https://clerk.com/docs)
- [Runware AI Docs](https://docs.runware.ai)

---

## 🆘 Support

Bei Problemen:
1. Prüfe Railway Logs: `railway logs`
2. Prüfe Encore Logs im Dashboard
3. Checke GitHub Issues
4. Railway Community: [Discord](https://discord.gg/railway)

---

## ✅ Quick Reference - Alle Environment Variables

```bash
# Pflicht-Secrets:
ClerkSecretKey=sk_test_XXXXXXXXX
RunwareApiKey=sk-XXXXXXXXXXXXXXXX

# Optional:
OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXX

# System (automatisch von Railway):
PORT=4000
NODE_ENV=production
RAILWAY_ENVIRONMENT=production
```

---

**Viel Erfolg mit dem Deployment! 🚀**
