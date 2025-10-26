# Railway Deployment Guide

## Problem
Der Backend-Fehler `ReferenceError: MODEL is not defined` existiert noch, weil Railway den alten Code läuft.

## Lösung

### Option 1: Git Push (Automatisches Deployment)
```bash
# Alle Änderungen committen
git add .
git commit -m "Add AI model selection with cost tracking

- Add 8 AI models (gpt-5-nano to gpt-5-pro)
- Update prices to latest OpenAI rates
- Implement model selection in StoryWizard
- Add cost tracking to database
- Fix MODEL undefined error"

# Push zu Main Branch (triggert Railway Deploy)
git push origin main
```

### Option 2: Railway CLI
```bash
# Railway CLI installieren (falls nicht installiert)
npm install -g @railway/cli

# Login
railway login

# Projekt verlinken (falls nötig)
railway link

# Deploy
railway up
```

### Option 3: Railway Dashboard
1. Gehe zu https://railway.app
2. Öffne dein Projekt "talea-storytelling-platform"
3. Klicke auf "Backend" Service
4. Klicke auf "Deploy" → "Redeploy"

## Nach dem Deployment

### 1. Migration anwenden
Railway führt Migrations automatisch aus, wenn configured. Falls nicht:

```bash
# SSH ins Railway Container
railway run bash

# Migration anwenden
encore db migrate up

# Exit
exit
```

### 2. Testen
1. Neue Geschichte erstellen
2. Zu "Parameters" Step gehen
3. AI Model auswählen
4. Geschichte generieren
5. Logs prüfen:
   ```
   [ai-generation] 🤖 Using model: gpt-5-mini (Input: $0.25/1M, Output: $2/1M)
   [ai-generation] 💰 Cost breakdown:
     Input: 12500 tokens × $0.25/1M = $0.0031
     Output: 8300 tokens × $2/1M = $0.0166
     Total: $0.0197
   ```

## Alle Dateien die geändert wurden:

### Backend
- ✅ `backend/story/ai-generation.ts` - MODEL_CONFIGS, selectedModel Fix
- ✅ `backend/story/generate.ts` - AIModel Type, Cost Tracking
- ✅ `backend/story/migrations/4_add_cost_tracking.up.sql` - DB Migration
- ✅ `backend/story/migrations/4_add_cost_tracking.down.sql` - Rollback

### Frontend
- ✅ `frontend/screens/Story/StoryWizardScreen.tsx` - aiModel Config
- ✅ `frontend/screens/Story/steps/StoryParametersStep.tsx` - Model Selection UI

### Andere
- ✅ `backend/avatar/validateAndNormalize.ts` - TYPE Fix
- ✅ `backend/avatar/getMemories.ts` - Memory Limit (5+5)

## Erwartete Railway Logs nach Deploy:

```
[build] Building backend...
[build] ✓ TypeScript compiled successfully
[deploy] Deploying to production...
[deploy] Running migrations...
[deploy] ✓ Migration 4_add_cost_tracking applied
[deploy] ✓ Backend deployed successfully
```

## Troubleshooting

### Falls Migration fehlschlägt:
Die Migration fügt nur neue Spalten hinzu, keine Breaking Changes.

### Falls Deployment fehlschlägt:
```bash
# Logs ansehen
railway logs

# Rollback zum vorherigen Deploy
railway rollback
```

### TypeScript Errors im Build:
Alle Errors sollten bereits lokal behoben sein. Falls nicht:
```bash
cd backend
npx tsc --noEmit
```
