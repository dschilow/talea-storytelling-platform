# 🚀 Railway Deployment Guide - MCP Servers

## Schritt-für-Schritt Anleitung zum Deployment der MCP-Server

---

## 📋 Prerequisites

- ✅ Railway Account
- ✅ GitHub Repository connected to Railway
- ✅ PostgreSQL Service bereits deployed
- ✅ Beide MCP Services erstellt:
  - `talea-mcp-main-production`
  - `talea-mcp-validator-production`

---

## 🔧 Step 1: Environment Variables konfigurieren

### Service 1: `talea-mcp-main`

**Railway Dashboard → talea-mcp-main → Variables:**

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
CLERK_SECRET_KEY=sk_test_<CLERK_SECRET_KEY>
MCP_SERVER_API_KEY=<MCP_SERVER_API_KEY>
PORT=3000
NODE_ENV=production
```

**Wichtig:**
- `DATABASE_URL` als Reference zu PostgreSQL Service: `${{Postgres.DATABASE_URL}}`
- `CLERK_SECRET_KEY` verwenden (nicht veröffentlichen!)
- `MCP_SERVER_API_KEY` generiert (siehe oben)

### Service 2: `talea-mcp-validator`

**Railway Dashboard → talea-mcp-validator → Variables:**

```env
MCP_SERVER_API_KEY=<MCP_SERVER_API_KEY>
PORT=8080
NODE_ENV=production
```

---

## 🏗️ Step 2: Railway Build Settings konfigurieren

### Service 1: `talea-mcp-main`

**Railway Dashboard → talea-mcp-main → Settings:**

**Root Directory:**
```
backend/mcp-main
```

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
node dist/index.js
```

**Health Check Path:**
```
/health
```

**Port:**
```
3000
```

### Service 2: `talea-mcp-validator`

**Railway Dashboard → talea-mcp-validator → Settings:**

**Root Directory:**
```
backend/mcp-validator
```

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
node dist/index.js
```

**Health Check Path:**
```
/health
```

**Port:**
```
8080
```

---

## 🔗 Step 3: PostgreSQL Connection verknüpfen

### MCP Main Service mit PostgreSQL verbinden

**Railway Dashboard → talea-mcp-main → Settings → Service Connections:**

1. Click **"Connect to Service"**
2. Select **"Postgres"**
3. Railway erstellt automatisch `${{Postgres.DATABASE_URL}}` Variable

**Verify Connection:**
```bash
# In Railway Logs solltest du sehen:
✅ Database connection successful
```

---

## 📦 Step 4: Deployment triggern

### Option A: Automatic Deployment (GitHub)

**Railway Dashboard → Settings → GitHub:**

1. **Branch:** `implement-mcp-servers` (oder `main`)
2. **Auto Deploy:** `Enabled`
3. **Watch Paths:**
   - `backend/mcp-main/**`
   - `backend/mcp-validator/**`

**Commit & Push:**
```bash
git add .
git commit -m "feat: Add MCP servers for consistent avatar appearance"
git push origin implement-mcp-servers
```

Railway wird automatisch deployen!

### Option B: Manual Deployment

**Railway Dashboard → Deploy:**

1. Click **"Deploy Now"**
2. Railway baut und deployed die Services

---

## ✅ Step 5: Deployment verifizieren

### Test 1: Health Checks

```bash
# MCP Main
curl https://talea-mcp-main-production.up.railway.app/health

# Expected Output:
{
  "status": "healthy",
  "service": "talea-mcp-main",
  "version": "1.0.0",
  "timestamp": "2025-01-20T..."
}

# MCP Validator
curl https://talea-mcp-validator-production.up.railway.app/health

# Expected Output:
{
  "status": "healthy",
  "service": "talea-mcp-validator",
  "version": "1.0.0",
  "timestamp": "2025-01-20T..."
}
```

### Test 2: MCP Tools List

```bash
curl -X POST https://talea-mcp-main-production.up.railway.app/mcp \
  -H "Content-Type: application/json" \
  -H "X-MCP-API-Key: <MCP_SERVER_API_KEY>" \
  -H "Authorization: Bearer <your_clerk_token>" \
  -d '{"method": "tools/list"}'

# Expected: List of 7 tools
```

### Test 3: Railway Logs prüfen

**Railway Dashboard → talea-mcp-main → Logs:**

```
🚀 Starting Talea MCP Main Server...
✅ Configuration validated successfully
✅ Database connection successful
✅ MCP Main Server running on port 3000
🔗 Health: http://localhost:3000/health
🔗 MCP Endpoint: http://localhost:3000/mcp
🔗 SSE Endpoint: http://localhost:3000/sse
✅ MCP Main Server started successfully
```

**Railway Dashboard → talea-mcp-validator → Logs:**

```
🚀 Starting Talea MCP Validator Server...
✅ Configuration validated successfully
✅ MCP Validator Server running on port 8080
🔗 Health: http://localhost:8080/health
🔗 MCP Endpoint: http://localhost:8080/mcp
✅ MCP Validator Server started successfully
```

---

## 🔐 Step 6: Encore Backend konfigurieren

### Add MCP Secret to Encore

**Option A: Railway Dashboard (Encore Service):**

```env
MCP_SERVER_API_KEY=<MCP_SERVER_API_KEY>
```

**Option B: Encore CLI (Local Dev):**

```bash
# If you use encore CLI locally
encore secret set --type dev MCPServerAPIKey <MCP_SERVER_API_KEY>

encore secret set --type prod MCPServerAPIKey <MCP_SERVER_API_KEY>
```

### Update MCP Client URLs (if needed)

**File:** `backend/helpers/mcpClient.ts`

```typescript
// Change URLs if Railway gives you different domains
const MCP_MAIN_URL = "https://talea-mcp-main-production.up.railway.app";
const MCP_VALIDATOR_URL = "https://talea-mcp-validator-production.up.railway.app";
```

---

## 🧪 Step 7: End-to-End Test

### Test Story Generation mit MCP

1. **Frontend:** Erstelle eine neue Story mit 2+ Avataren
2. **Backend Logs:** Schaue nach folgenden Logs:

```
📚 [ai-generation-mcp] Generate story start WITH MCP
🔍 [MCP] Fetching visual profiles for all avatars...
✅ [MCP] Loaded visual profile for Max
✅ [MCP] Loaded visual profile for Luna
📊 [MCP] Loaded 2 visual profiles
🔍 [MCP Validator] Validating story response...
✅ [MCP Validator] Story response is valid
🖼️ [ai-generation-mcp] Generating images with MCP profiles...
🎨 [MCP] Cover prompt length: 1234
🎨 [MCP] Chapter 1 prompt length: 987
✅ [ai-generation-mcp] Story generation complete with MCP
```

3. **Verify:** Prüfe, ob Avatare in allen Bildern gleich aussehen!

---

## 📊 Step 8: Monitoring & Logging

### Railway Metrics

**Dashboard → Service → Metrics:**

- **CPU Usage:** < 50% normal
- **Memory Usage:** < 512MB normal
- **Request Count:** Track MCP calls
- **Response Times:** < 500ms normal

### Enable Logging (Optional)

**File:** `backend/helpers/mcpClient.ts`

```typescript
// Add detailed logging
console.log(`📡 [MCP] Request:`, { tool, args });
console.log(`✅ [MCP] Response:`, { result });
```

---

## 🐛 Troubleshooting

### Problem: "Service failed to start"

**Solution:**
1. Check Railway Logs für Fehler
2. Verify Environment Variables gesetzt
3. Verify Build Command korrekt
4. Verify package.json existiert

### Problem: "Database connection failed"

**Solution:**
1. Check `DATABASE_URL` als Reference gesetzt: `${{Postgres.DATABASE_URL}}`
2. Verify PostgreSQL Service läuft
3. Check Firewall/Network Settings

### Problem: "Unauthorized" bei MCP Calls

**Solution:**
1. Verify `MCP_SERVER_API_KEY` in beiden Services identisch
2. Verify `X-MCP-API-Key` Header korrekt
3. Verify `Authorization` Bearer Token von Clerk

### Problem: "Avatar not found"

**Solution:**
1. Verify User ist Owner des Avatars
2. Verify Clerk Token valid
3. Check Avatar existiert in DB

---

## 🎉 Success Checklist

- ✅ MCP Main deployed & healthy
- ✅ MCP Validator deployed & healthy
- ✅ PostgreSQL connected
- ✅ Environment Variables gesetzt
- ✅ Health Checks pass
- ✅ MCP Tools list works
- ✅ Encore Backend hat Secret
- ✅ Story Generation nutzt MCP
- ✅ Avatare sehen konsistent aus

---

## 🚀 Next Steps

1. **Switch zu MCP Version:** Edit `story/generate.ts` → use `ai-generation-with-mcp.ts`
2. **Test ausgiebig:** Mehrere Stories generieren
3. **Monitor Performance:** Railway Metrics beobachten
4. **Optimize:** Caching/Rate Limiting später hinzufügen

---

## 📝 Important Notes

- **MCP_SERVER_API_KEY** muss in 3 Services identisch sein:
  - `talea-mcp-main`
  - `talea-mcp-validator`
  - `talea-backend` (Encore)

- **DATABASE_URL** nur in MCP Main benötigt

- **CLERK_SECRET_KEY** nur in MCP Main benötigt

- **Ports:**
  - MCP Main: `3000`
  - MCP Validator: `8080`
  - Encore Backend: `8080` (different service)

---

## 🎯 Key Benefits

### Vorher:
- Avatare sehen jedes Mal anders aus 😞
- Keine konsistente Nutzung von Visual Profiles
- Manuelle Trait-Validierung fehleranfällig

### Nachher:
- **100% konsistente Avatar-Aussehen** 🎨
- **Zentrale Validierung aller Responses** ✅
- **Automatische Trait-Normalisierung** 🔄
- **Skalierbar & Wartbar** 🚀

---

Viel Erfolg beim Deployment! 🎉
