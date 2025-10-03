# Railway Deployment Guide für Talea

> 🚀 **Quick Start?** Siehe [RAILWAY_QUICKSTART.md](./RAILWAY_QUICKSTART.md)
> 📚 **Ausführliche Anleitung?** Siehe [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

## Übersicht

Diese Datei ist veraltet. Nutze stattdessen:

### 📄 Neue Deployment-Guides:

1. **[RAILWAY_QUICKSTART.md](./RAILWAY_QUICKSTART.md)** - 5-Minuten Setup für schnelles Deployment
2. **[RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)** - Komplette Schritt-für-Schritt Anleitung mit allen Details

### 🔧 Konfigurationsdateien:

- [railway.json](./railway.json) - Railway Build & Deploy Config
- [nixpacks.toml](./nixpacks.toml) - Build Commands
- [.env.railway](./.env.railway) - Environment Variables Template
- [Dockerfile](./Dockerfile) - Alternative Container Build

---

## Quick Reference

### Benötigte Secrets:

```bash
# Im Railway Dashboard setzen:
ClerkSecretKey=sk_test_DEIN_CLERK_KEY
RunwareApiKey=sk-DEIN_RUNWARE_KEY

# Optional:
OPENAI_API_KEY=sk-DEIN_OPENAI_KEY
```

### Deployment Commands:

```bash
# Automatisch via Git:
git push origin main

# Manuell via CLI:
railway up

# Logs anzeigen:
railway logs
```

---

**Für alle weiteren Details siehe:**
- [RAILWAY_QUICKSTART.md](./RAILWAY_QUICKSTART.md) - Schnellstart
- [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) - Vollständige Anleitung