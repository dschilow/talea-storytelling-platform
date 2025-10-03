# 🚀 Talea Railway Deployment - Dokumentations-Übersicht

## 📚 Verfügbare Anleitungen

### 1. **[RAILWAY_QUICKSTART.md](./RAILWAY_QUICKSTART.md)** ⚡
**5-Minuten Setup für schnelles Deployment**
- Schnellstart-Anleitung
- Wichtigste Schritte auf einen Blick
- Checkliste zum Abhaken
- Für: Erfahrene Entwickler, die es eilig haben

### 2. **[RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)** 📖
**Komplette Schritt-für-Schritt Anleitung**
- Ausführliche Deployment-Anleitung
- Alle Environment Variables erklärt
- Troubleshooting-Guide
- CORS & Domain-Konfiguration
- Für: Erste Deployment oder bei Problemen

### 3. **[RAILWAY_POSTGRESQL_SETUP.md](./RAILWAY_POSTGRESQL_SETUP.md)** 🐘
**PostgreSQL Datenbank-Konfiguration**
- PostgreSQL auf Railway einrichten
- Datenbank-Struktur verstehen
- Migrations verwalten
- Performance-Tipps
- Backups & Monitoring
- Für: Datenbank-spezifische Fragen

---

## 🎯 Welche Anleitung ist für mich?

### Ich bin neu bei Railway
→ Start mit **[RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)**
→ Lies alle Schritte sorgfältig durch

### Ich kenne Railway schon
→ **[RAILWAY_QUICKSTART.md](./RAILWAY_QUICKSTART.md)** reicht
→ 5 Minuten und du bist fertig

### Ich habe Datenbank-Probleme
→ **[RAILWAY_POSTGRESQL_SETUP.md](./RAILWAY_POSTGRESQL_SETUP.md)**
→ Alle PostgreSQL-Details hier

### Ich habe ein Problem beim Deployment
→ **[RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)** → Troubleshooting-Sektion
→ Häufige Fehler und Lösungen

---

## 🔧 Konfigurationsdateien

### **[railway.json](./railway.json)**
Build & Deployment-Konfiguration für Railway
- Build Command
- Start Command
- Health Checks

### **[nixpacks.toml](./nixpacks.toml)**
Nixpacks Build-Konfiguration
- Node.js & Bun Setup
- Build-Phasen
- Port-Konfiguration

### **[.env.railway](./.env.railway)**
Environment Variables Template
- Alle benötigten Secrets dokumentiert
- Wo man die Keys findet
- Deployment Checklist

### **[Dockerfile](./Dockerfile)**
Alternative Container-Build (optional)
- Falls du Docker statt Nixpacks nutzen willst

---

## 🗄️ Datenbank: PostgreSQL

Deine App nutzt **PostgreSQL** auf Railway (keine SQLite!):

### Warum PostgreSQL?
✅ Production-ready
✅ Concurrent Writes
✅ Bessere Performance bei vielen Usern
✅ Automatische Backups
✅ Horizontal Scaling möglich

### Lokale Entwicklung
- Encore nutzt **SQLite** automatisch lokal
- Migrations funktionieren identisch
- Kein manueller Setup nötig

### Production (Railway)
- **PostgreSQL** für alle Datenbanken
- Automatische Migrations beim Deploy
- Eine Datenbank, mehrere Schemas

**Details:** [RAILWAY_POSTGRESQL_SETUP.md](./RAILWAY_POSTGRESQL_SETUP.md)

---

## 🔐 Benötigte Secrets

### Pflicht (ohne diese läuft nichts):

1. **ClerkSecretKey** - Clerk Authentication
   - Wo: https://dashboard.clerk.com → API Keys
   - Format: `sk_test_XXXXXXXXX`

2. **RunwareApiKey** - Bildgenerierung
   - Wo: https://runware.ai/dashboard → API Keys
   - Format: `sk-XXXXXXXXX`

3. **DATABASE_URL** - PostgreSQL Connection
   - ✅ Automatisch von Railway gesetzt
   - Nicht manuell eingeben!

### Optional:

4. **OPENAI_API_KEY** - Erweiterte AI Features
   - Wo: https://platform.openai.com/api-keys
   - Format: `sk-XXXXXXXXX`

**Details:** [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) → Schritt 3

---

## 📋 Deployment Checkliste

### Vor dem Deployment:
- [ ] GitHub Repository ist aktuell
- [ ] Alle Änderungen committed
- [ ] Lokal getestet (`encore run`)
- [ ] Clerk & Runware API Keys bereit

### Railway Setup:
- [ ] Railway Account erstellt
- [ ] PostgreSQL Datenbank hinzugefügt
- [ ] ClerkSecretKey gesetzt
- [ ] RunwareApiKey gesetzt
- [ ] App mit GitHub verbunden

### Nach dem Deployment:
- [ ] Logs zeigen "Database migrations completed"
- [ ] Logs zeigen "Encore server running"
- [ ] Keine Fehler in `railway logs`
- [ ] Health Check ist grün
- [ ] Railway URL öffnen und testen
- [ ] Clerk: Railway Domain zu authorized parties hinzugefügt

---

## 🐛 Häufige Probleme

| Problem | Lösung | Anleitung |
|---------|--------|-----------|
| "Authentication failed" | Clerk Secret prüfen | [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md#troubleshooting) |
| "Database migration failed" | Logs checken, Migrations prüfen | [RAILWAY_POSTGRESQL_SETUP.md](./RAILWAY_POSTGRESQL_SETUP.md#troubleshooting) |
| "Build failed" | Lokal testen, Dependencies prüfen | [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md#troubleshooting) |
| Frontend erreicht Backend nicht | CORS, VITE_CLIENT_TARGET prüfen | [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md#troubleshooting) |
| "Too many connections" | PostgreSQL Connection Limit | [RAILWAY_POSTGRESQL_SETUP.md](./RAILWAY_POSTGRESQL_SETUP.md#troubleshooting) |

---

## 📱 Railway CLI Befehle

```bash
# Installation
npm install -g @railway/cli

# Login
railway login

# Projekt verbinden
railway link

# Variables setzen
railway variables set ClerkSecretKey=sk_test_...
railway variables set RunwareApiKey=sk-...

# Deployment
railway up

# Logs anzeigen
railway logs
railway logs --follow  # Live logs

# PostgreSQL verbinden
railway connect postgres

# Status checken
railway status

# Variables anzeigen
railway variables
```

---

## 🔗 Wichtige Links

### Dokumentation:
- [Railway Docs](https://docs.railway.app/)
- [Encore.dev Docs](https://encore.dev/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

### Dashboards:
- [Railway Dashboard](https://railway.app/dashboard)
- [Clerk Dashboard](https://dashboard.clerk.com)
- [Runware Dashboard](https://runware.ai/dashboard)
- [OpenAI Dashboard](https://platform.openai.com)

### Support:
- [Railway Discord](https://discord.gg/railway)
- [Encore Discord](https://encore.dev/discord)
- [GitHub Issues](https://github.com/DEIN-REPO/issues)

---

## 🆘 Hilfe benötigt?

1. **Prüfe Logs:** `railway logs`
2. **Checke Railway Dashboard:** Metrics, Deployments
3. **Lies Troubleshooting:** In den jeweiligen Guides
4. **PostgreSQL Probleme:** [RAILWAY_POSTGRESQL_SETUP.md](./RAILWAY_POSTGRESQL_SETUP.md#troubleshooting)
5. **Deployment Probleme:** [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md#troubleshooting)
6. **Railway Discord:** https://discord.gg/railway

---

## ✅ Nächste Schritte nach Deployment

1. **Domain einrichten** (optional)
   - Custom Domain in Railway hinzufügen
   - DNS-Records konfigurieren
   - SSL automatisch

2. **Monitoring aktivieren**
   - Railway Metrics checken
   - Error Tracking einrichten
   - Alerts konfigurieren

3. **Backups prüfen**
   - PostgreSQL Auto-Backups aktiv?
   - Backup-Strategie definieren
   - Recovery-Plan erstellen

4. **Performance optimieren**
   - Query Performance analysieren
   - Indexes optimieren
   - Caching-Strategie

**Siehe:** Jeweilige Guides für Details

---

**Viel Erfolg mit dem Deployment! 🚀**

Bei Fragen: Siehe Links oben oder Railway Discord
