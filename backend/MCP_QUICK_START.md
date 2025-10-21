# 🚀 MCP Integration - Quick Start

## ⚡ 5-Minuten Setup

### 1. Railway Environment Variables setzen

**MCP Main Service:**
```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
CLERK_SECRET_KEY=sk_test_K8f5b0LyLp7Y5RXSWQsdGXc4kFTT19mXNsY1hm5PXR
MCP_SERVER_API_KEY=mcp_sk_7d9f2b8a4e6c1d3f5a7b9c2e4f6a8b0c1d3e5f7a9b0c2d4e6f8a0b2c4d6e8f0
PORT=3000
NODE_ENV=production
```

**MCP Validator Service:**
```env
MCP_SERVER_API_KEY=mcp_sk_7d9f2b8a4e6c1d3f5a7b9c2e4f6a8b0c1d3e5f7a9b0c2d4e6f8a0b2c4d6e8f0
PORT=8080
NODE_ENV=production
```

**Encore Backend Service:**
```env
MCP_SERVER_API_KEY=mcp_sk_7d9f2b8a4e6c1d3f5a7b9c2e4f6a8b0c1d3e5f7a9b0c2d4e6f8a0b2c4d6e8f0
```

### 2. Railway Build Settings

**Beide MCP Services:**
- Build Command: `npm install && npm run build`
- Start Command: `node dist/index.js`
- Health Check: `/health`

**Root Directories:**
- MCP Main: `backend/mcp-main`
- MCP Validator: `backend/mcp-validator`

### 3. Deploy

```bash
git add .
git commit -m "feat: Add MCP servers"
git push
```

### 4. Test

```bash
# Health Check
curl https://talea-mcp-main-production.up.railway.app/health
curl https://talea-mcp-validator-production.up.railway.app/health
```

### 5. Switch Backend to MCP

**Edit:** `backend/story/generate.ts`

```typescript
// Line 2: Change import
import { generateStoryContentWithMcp } from "./ai-generation-with-mcp";

// Line 146: Change call
const generatedStory = await generateStoryContentWithMcp({
  config: req.config,
  avatarDetails,
  clerkToken: "CLERK_TOKEN_FROM_CONTEXT", // TODO: Get from Encore auth
});
```

---

## ✅ Was du jetzt hast

- ✅ 2 MCP Server deployed
- ✅ PostgreSQL connected
- ✅ Avatar Visual Profiles abrufbar
- ✅ Story Response Validation
- ✅ Trait Normalization
- ✅ Konsistente Avatar-Bilder

---

## 📚 Weitere Docs

- [Vollständige Integration Guide](./MCP_INTEGRATION_GUIDE.md)
- [Railway Deployment Guide](../RAILWAY_DEPLOYMENT_MCP.md)
- [MCP Main README](./mcp-main/README.md)
- [MCP Validator README](./mcp-validator/README.md)

---

## 🐛 Probleme?

1. Check Railway Logs
2. Verify Environment Variables
3. Verify Health Checks
4. Siehe [Troubleshooting Section](../RAILWAY_DEPLOYMENT_MCP.md#-troubleshooting)
