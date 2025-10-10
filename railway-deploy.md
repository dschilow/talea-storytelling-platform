# Railway Deployment Guide für Talea

## 1. Railway Setup

1. Gehe zu [Railway.app](https://railway.app) und erstelle einen Account
2. Installiere Railway CLI: `npm install -g @railway/cli`
3. Login: `railway login`

## 2. Project erstellen

```bash
railway new
# Wähle "Deploy from GitHub repo"
# Verbinde dein GitHub Repository
```

## 3. Environment Variables setzen

In Railway Dashboard oder via CLI:

```bash
# Runware API Key (WICHTIG!)
railway variables set RunwareApiKey=sk-your-runware-api-key-here

# Andere Secrets falls nötig
railway variables set CLERK_PUBLISHABLE_KEY=pk_test_...
railway variables set CLERK_SECRET_KEY=sk_test_...
```

## 4. Deployment

Railway deployed automatisch bei Git Push. Manual deployment:

```bash
railway up
```

## 5. Domain konfigurieren

1. In Railway Dashboard → Settings → Domains
2. Custom Domain hinzufügen oder Railway Domain verwenden

## 6. Logs überwachen

```bash
railway logs
```

## Wichtige Dateien für Railway:

- `railway.json` - Railway Konfiguration
- `nixpacks.toml` - Build Konfiguration
- `Dockerfile` - Alternative Container Build
- `.env.example` - Environment Variables Template

## Troubleshooting:

1. **Build Fehler**: Überprüfe `nixpacks.toml` Build Commands
2. **Start Fehler**: Stelle sicher dass `encore run --port=$PORT` funktioniert
3. **Environment Variables**: Alle Secrets müssen in Railway gesetzt sein