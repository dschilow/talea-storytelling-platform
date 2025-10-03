# 🚀 Railway Quick Start - 5 Minuten Setup

## ⚡ Schnellstart (wenn du es eilig hast)

### 1. Railway Account & Projekt (2 Min)
```bash
# Railway Account erstellen: https://railway.app
# "New Project" → "Deploy from GitHub repo"
# Repository auswählen: talea-storytelling-platform
```

**🗄️ PostgreSQL Datenbank hinzufügen:**
```bash
# Im Railway Dashboard:
# → "+ New" → "Database" → "Add PostgreSQL"
# Railway setzt automatisch DATABASE_URL ✅
```

### 2. Secrets setzen (2 Min)

Im Railway Dashboard → Settings → Variables:

```bash
# PFLICHT - Clerk Secret Key
ClerkSecretKey=sk_test_DEIN_KEY_VON_CLERK

# PFLICHT - Runware API Key
RunwareApiKey=sk-DEIN_KEY_VON_RUNWARE
```

### 3. Deploy starten (1 Min)
```bash
# Automatisch via Git Push:
git push origin main

# ODER manuell im Dashboard:
# Klick auf "Deploy"
```

### 4. Logs checken (1 Min)
```bash
# Im Dashboard: Deployments → View Logs
# ODER via CLI:
railway logs
```

### 5. Fertig! ✅

Deine App läuft auf: `https://DEIN-PROJECT.up.railway.app`

---

## 🔑 Secrets schnell finden

### Clerk Secret Key
1. → https://dashboard.clerk.com
2. → API Keys
3. → Kopiere "Secret Key" (beginnt mit `sk_test_`)

### Runware API Key
1. → https://runware.ai/dashboard
2. → API Keys
3. → Kopiere Key (beginnt mit `sk-`)

### Clerk Publishable Key (für Frontend)
1. → https://dashboard.clerk.com
2. → API Keys
3. → Kopiere "Publishable Key" (beginnt mit `pk_test_`)

---

## ✅ Deployment Checklist

Nach dem Deployment:

- [ ] PostgreSQL Datenbank erstellt
- [ ] Logs zeigen "Database migrations completed"
- [ ] Logs zeigen "Encore server running"
- [ ] Keine Fehler in Logs: `railway logs`
- [ ] Health Check ist grün
- [ ] Railway URL öffnen und testen
- [ ] Frontend kann Backend erreichen

---

## 🐛 Schnelle Fixes

### "Authentication failed"
```bash
# Clerk Secret nochmal setzen:
railway variables set ClerkSecretKey=sk_test_NEUER_KEY
railway up
```

### "Build failed"
```bash
# Lokal testen:
cd backend && bun install && bun run build

# Bei Erfolg:
git push
```

### Frontend erreicht Backend nicht
```bash
# Backend URL in Frontend setzen:
railway variables set VITE_CLIENT_TARGET=https://DEIN-BACKEND.up.railway.app
```

---

## 📱 Railway CLI Befehle

```bash
# Installation
npm install -g @railway/cli

# Login
railway login

# Logs anzeigen
railway logs

# Variables setzen
railway variables set KEY=value

# Deployment starten
railway up

# Status checken
railway status
```

---

## 🔗 Wichtige Links

- [Railway Dashboard](https://railway.app/dashboard)
- [Clerk Dashboard](https://dashboard.clerk.com)
- [Runware Dashboard](https://runware.ai/dashboard)
- [Ausführliche Anleitung](./RAILWAY_DEPLOYMENT.md)
- [PostgreSQL Setup](./RAILWAY_POSTGRESQL_SETUP.md)

---

**Probleme?** → Siehe [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) für Details
