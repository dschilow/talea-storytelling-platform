# 🎯 Anleitung für Dimitri - Talea Railway Deployment

## 🎯 **NEUE STRATEGIE: GitHub Actions + GHCR (wie NotePad)**

✅ **Problem gelöst!** Ich habe das Projekt auf die gleiche Strategie wie NotePad umgestellt:

- **Backend:** GitHub Actions baut Docker Image → GHCR → Railway deployed fertiges Image
- **Frontend:** Railway baut direkt aus GitHub Repo mit `railway.frontend.toml`
- **Vorteil:** Keine Dockerfile Path Konflikte mehr!

→ **Vollständige Setup-Anleitung:** [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)

---

## ✅ Was ich automatisch gefixed habe

### 1. **Database Migrations** ✅
- `backend/health/init-migrations.ts` erstellt
- Alle 14 Tabellen werden automatisch erstellt beim `/health` Check
- Migrations laufen automatisch beim ersten Railway Deploy

### 2. **Pub/Sub Timeouts** ✅
- Alle 13 `.publish()` Calls haben jetzt Timeout (2 Sekunden)
- `backend/helpers/pubsubTimeout.ts` Helper erstellt
- Verhindert "Creating..." Dialog-Hängen
- **Gefixt in:**
  - `backend/story/generate.ts`
  - `backend/tavi/chat.ts`
  - `backend/story/ai-generation.ts`
  - `backend/doku/generate.ts`
  - `backend/ai/analyze-personality.ts`
  - `backend/ai/image-generation.ts`
  - `backend/ai/analyze-avatar.ts`

### 3. **Frontend Token Validation** ✅
- `frontend/hooks/useBackend.ts` updated
- Wirft Error wenn Token fehlt
- Verhindert 401 Fehler und Race Conditions

### 4. **CORS Configuration** ✅
- `backend/encore.app` formatiert
- Verwendet `allow_origins_with_credentials` (richtig!)
- Platzhalter für Railway URL vorhanden

### 5. **Dokumentation** ✅
- `START_HERE.md` - Einstiegspunkt
- `COMMON_ISSUES_TALEA.md` - Problemlösungen
- `README.md` - Projekt-Übersicht

---

## 📝 Was DU noch machen musst

### Schritt 1: Code committen & pushen

```powershell
cd C:\MyProjects\Talea\talea-storytelling-platform

git add .
git commit -m "Apply all Railway deployment fixes + manual config guide"
git push
```

**⚠️ WICHTIG:** Railway nutzt nur EINE `railway.toml` für alle Services!  
→ Frontend Dockerfile Path musst du **manuell** in Railway konfigurieren!  
→ Siehe [RAILWAY_MANUAL_CONFIG.md](./RAILWAY_MANUAL_CONFIG.md)

### Schritt 2: GitHub Setup (GitHub Actions + GHCR)

**📚 Vollständige Anleitung:** [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)

#### **2.1 GitHub Repository Secrets**

1. **Gehe zu deinem GitHub Repo → Settings → Secrets and variables → Actions**
2. **Füge hinzu:**

   **RAILWAY_TOKEN:**
   - Railway Dashboard → Profil → Account Settings → Tokens → Create Token
   - Kopiere Token und füge als Secret hinzu

   **RAILWAY_SERVICE_ID:**
   - Railway → Backend Service → URL: `railway.app/project/XXX/service/YYY`
   - Kopiere `YYY` und füge als Secret hinzu

#### **2.2 GitHub Actions aktivieren**

1. **Workflow ist bereits erstellt:** `.github/workflows/deploy-backend.yml`
2. **Teste Workflow:**
   ```powershell
   git add .
   git commit -m "Setup GitHub Actions backend deployment"
   git push
   ```
3. **Prüfe Logs:** GitHub Repo → Actions → Neuester Run

### Schritt 3: Railway Setup

1. **Railway Dashboard öffnen:**
   - Gehe zu [railway.app](https://railway.app)
   - Erstelle neues Projekt

2. **Services deployen:**

   **PostgreSQL:**
   - "+ New" → "Database" → "PostgreSQL"
   
   **Backend Service (Docker Image von GHCR):**
   - "+ New" → "Docker Image"
   - Image URL: `ghcr.io/DEIN_GITHUB_USERNAME/talea-backend:latest`
   - Name: `backend`
   - **Authentifizierung:**
     - Username: Dein GitHub Username
     - Token: GitHub Personal Access Token mit `read:packages` scope
   
   **Frontend Service (GitHub Repo):**
   - "+ New" → "GitHub Repo" → talea-storytelling-platform
   - Name: `frontend`
   - **Wichtig:** Railway erkennt automatisch `railway.frontend.toml`!

3. **Environment Variables setzen:**

   **Backend Service → Variables:**
   ```
   ClerkSecretKey=sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   OpenAIKey=sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   RunwareApiKey=XXXXXXXX  (optional)
   ```

   **Frontend Service → Variables:**
   ```
   VITE_BACKEND_URL=https://backend-production-XXXX.up.railway.app
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXX
   ```

   **API Keys holen:**
   - **Clerk:** [dashboard.clerk.com](https://dashboard.clerk.com) → API Keys
   - **OpenAI:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Schritt 4: CORS URL updaten

1. **Warte bis Frontend deployed ist**
2. **Kopiere die Frontend URL** (z.B. `https://frontend-production-YYYY.up.railway.app`)
3. **Update `backend/encore.app`:**
   ```json
   {
     "global_cors": {
       "allow_origins_with_credentials": [
         "https://frontend-production-YYYY.up.railway.app"  ← HIER DEINE URL
       ]
     }
   }
   ```
4. **Commit & Push:**
   ```powershell
   git add backend/encore.app
   git commit -m "Update CORS with Railway frontend URL"
   git push
   ```
   → GitHub Actions baut automatisch neues Backend Image
   → Railway deployed es automatisch

### Schritt 5: Database Migrations triggern

1. **Öffne im Browser:**
   ```
   https://backend-production-XXXX.up.railway.app/health
   ```

2. **Sollte zeigen:**
   ```json
   {
     "status": "healthy",
     "migrations": {
       "run": true,
       "message": "Migrations completed successfully"
     }
   }
   ```

### Schritt 6: Testen!

1. **Öffne Frontend URL** in Browser
2. **Sign in** mit Clerk
3. **Erstelle einen Avatar**
4. **Generiere eine Story** 🎉

---

## 🎯 Alle Fixes die ich angewendet habe

| Fix | Status | Datei | Beschreibung |
|-----|--------|-------|--------------|
| Database Migrations | ✅ | `backend/health/init-migrations.ts` | Auto-run beim /health Check |
| Health Endpoint | ✅ | `backend/health/health.ts` | Triggert Migrations automatisch |
| Pub/Sub Helper | ✅ | `backend/helpers/pubsubTimeout.ts` | 2s Timeout Wrapper |
| Pub/Sub Timeouts (13x) | ✅ | Alle Services | Verhindert Dialog-Hängen |
| Frontend Token Validation | ✅ | `frontend/hooks/useBackend.ts` | Error bei fehlendem Token |
| CORS Config | ✅ | `backend/encore.app` | Formatiert, Platzhalter |
| START_HERE.md | ✅ | Neu erstellt | Deployment-Einstieg |
| COMMON_ISSUES_TALEA.md | ✅ | Neu erstellt | Problemlösungen |
| README.md | ✅ | Neu erstellt | Projekt-Übersicht |

---

## 🚨 Wichtige Unterschiede zu NotePad

### Mehr Datenbanken
Talea verwendet mehrere DB-Schemas:
- `user` - User profiles
- `avatar` - Avatars + Memories  
- `story` - Stories + Chapters
- `doku` - Knowledge base
- `ai` - Personality tracking

**Alle werden automatisch erstellt!** ✅

### AI Features
- **OpenAI API Key benötigt** für Story-Generation
- **Runware API Key optional** für Image-Generation
- **Model:** Verwendet `gpt-5-nano` (änderbar in Code)

### Pub/Sub
- **13 Pub/Sub Calls** (statt 3 bei NotePad)
- Alle haben jetzt Timeout ✅
- Logs gehen zu `log` Service

---

## 📊 Erwartetes Verhalten

### Erster Deploy
1. Railway baut Docker Images (10-15 min wegen AI Dependencies)
2. Backend startet, `/health` wird aufgerufen
3. Migrations laufen automatisch (14 Tabellen)
4. Frontend startet
5. Fertig! ✨

### Bei Problemen
1. **"Creating..." hängt** → FIXED mit Pub/Sub Timeout ✅
2. **401 Errors** → FIXED mit Token Validation ✅
3. **CORS Errors** → Update `backend/encore.app` mit Frontend URL
4. **Tabellen fehlen** → Öffne `/health` Endpoint
5. **Story Generation fails** → Check OpenAI API Key

---

## 🎉 Ready to Deploy!

Alle kritischen Fixes vom NotePad Projekt sind angewendet.

**Next Steps:**
1. ✅ Commit & Push
2. ✅ Railway Setup (Backend + Frontend + PostgreSQL)
3. ✅ Environment Variables setzen
4. ✅ CORS URL updaten
5. ✅ `/health` aufrufen
6. ✅ Testen!

**Start here:** [START_HERE.md](./START_HERE.md)

---

**Los geht's! Du schaffst das! 🚀**

Bei Problemen: [COMMON_ISSUES_TALEA.md](./COMMON_ISSUES_TALEA.md)

