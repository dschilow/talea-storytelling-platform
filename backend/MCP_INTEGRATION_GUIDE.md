# MCP Integration Guide - Talea Storytelling Platform

## 🎯 Overview

Die Talea-Platform nutzt zwei **MCP (Model Context Protocol) Server** um konsistente Avatar-Aussehen und Erinnerungen in Geschichten zu gewährleisten:

1. **MCP Main Server** (`talea-mcp-main`) - Avatar Visual Profiles, Memories, Personality
2. **MCP Validator Server** (`talea-mcp-validator`) - Story Response Validation

---

## 📦 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Request                              │
│                  (Story Generation)                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                 Encore Backend                                │
│          (story/generate.ts + ai-generation.ts)               │
└──┬────────────┬──────────────┬────────────────┬─────────────┘
   │            │              │                │
   │ ①          │ ③            │ ④              │ ⑤
   │ Get Visual │ Generate     │ Build Image    │ Validate
   │ Profiles   │ Story Text   │ Prompts        │ Response
   │            │              │                │
   ▼            ▼              ▼                ▼
┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐
│   MCP   │  │  OpenAI  │  │ Runware  │  │     MCP     │
│  Main   │  │   API    │  │   AI     │  │  Validator  │
└─────────┘  └──────────┘  └──────────┘  └─────────────┘
     │                          │                 │
     │ ②                        │                 │
     │ Return Profiles          │                 │
     │                          │                 │
     ▼                          ▼                 ▼
┌──────────────────────────────────────────────────────────┐
│               PostgreSQL Database (Railway)               │
└──────────────────────────────────────────────────────────┘
```

---

## 🚀 Setup Instructions

### 1. Railway Environment Variables

#### **MCP Main Server** (`talea-mcp-main`)
Railway Service → Variables:
```env
DATABASE_URL=${POSTGRES.DATABASE_URL}
CLERK_SECRET_KEY=sk_test_<CLERK_SECRET_KEY>
MCP_SERVER_API_KEY=<MCP_SERVER_API_KEY>
PORT=3000
NODE_ENV=production
```

#### **MCP Validator Server** (`talea-mcp-validator`)
Railway Service → Variables:
```env
MCP_SERVER_API_KEY=<MCP_SERVER_API_KEY>
PORT=8080
NODE_ENV=production
```

#### **Encore Backend** (add new secret)
Railway Service → Variables:
```env
MCP_SERVER_API_KEY=<MCP_SERVER_API_KEY>
```

### 2. Encore Secret Configuration

Add to `backend/encore.app`:
```cue
secrets: [
    // Existing secrets...
    "OpenAIKey",
    "RunwareAPIKey",
    "ClerkSecretKey",

    // NEW: MCP Server API Key
    "MCPServerAPIKey"
]
```

Then set the secret:
```bash
encore secret set --type dev,prod MCPServerAPIKey <MCP_SERVER_API_KEY>
```

### 3. Railway Service Configuration

#### **MCP Main**
- Service Name: `talea-mcp-main`
- Port: `3000`
- Health Check: `/health`
- Build Command: `npm install && npm run build`
- Start Command: `node dist/index.js`

#### **MCP Validator**
- Service Name: `talea-mcp-validator`
- Port: `8080`
- Health Check: `/health`
- Build Command: `npm install && npm run build`
- Start Command: `node dist/index.js`

### 4. Deploy MCP Servers

```bash
# From project root
cd backend/mcp-main
npm install
npm run build

cd ../mcp-validator
npm install
npm run build

# Railway will auto-deploy via GitHub Actions
```

---

## 🔧 Usage in Encore Backend

### Option 1: Use Existing `ai-generation.ts` (Current)

**Status:** Already working, but WITHOUT MCP integration

```typescript
import { generateStoryContent } from "./ai-generation";

const story = await generateStoryContent({
  config: req.config,
  avatarDetails: avatarDetails,
});
```

### Option 2: Use NEW `ai-generation-with-mcp.ts` (Recommended)

**Status:** NEW, WITH full MCP integration for consistent avatars

```typescript
import { generateStoryContentWithMcp } from "./ai-generation-with-mcp";

const story = await generateStoryContentWithMcp({
  config: req.config,
  avatarDetails: avatarDetails,
  clerkToken: req.clerkToken, // Pass Clerk token for MCP auth
});
```

### Switching to MCP Version

Edit `backend/story/generate.ts`:

```typescript
// OLD (line 2):
import { generateStoryContent } from "./ai-generation";

// NEW:
import { generateStoryContentWithMcp } from "./ai-generation-with-mcp";

// OLD (line 146):
const generatedStory = await generateStoryContent({
  config: req.config,
  avatarDetails,
});

// NEW:
const generatedStory = await generateStoryContentWithMcp({
  config: req.config,
  avatarDetails,
  clerkToken: req.auth.token, // Get from Encore auth context
});
```

---

## 📡 MCP API Endpoints

### MCP Main Server
```
Base URL: https://talea-mcp-main-production.up.railway.app

GET  /health              - Health check
POST /mcp                 - MCP tool calls
GET  /sse                 - Server-Sent Events
```

### MCP Validator Server
```
Base URL: https://talea-mcp-validator-production.up.railway.app

GET  /health              - Health check
POST /mcp                 - MCP tool calls
```

---

## 🛠️ Available MCP Tools

### MCP Main Server

#### 1. `get_avatar_visual_profile`
Get complete visual profile for a single avatar.

```typescript
import { getAvatarVisualProfile } from "../helpers/mcpClient";

const profile = await getAvatarVisualProfile(avatarId, clerkToken);
// Returns: { id, name, visualProfile }
```

#### 2. `get_multiple_avatar_profiles`
Get visual profiles for multiple avatars.

```typescript
import { getMultipleAvatarProfiles } from "../helpers/mcpClient";

const profiles = await getMultipleAvatarProfiles(avatarIds, clerkToken);
// Returns: [{ id, name, visualProfile }, ...]
```

#### 3. `build_consistent_image_prompt`
Generate detailed image prompt from visual profile.

```typescript
import { buildConsistentImagePrompt } from "../helpers/mcpClient";

const prompt = await buildConsistentImagePrompt(avatarId, clerkToken, {
  sceneDescription: "in a magical forest",
  action: "running towards castle",
  expression: "smiling happily",
  clothing: "wearing red raincoat"
});
```

#### 4. `get_avatar_memories`
Get all memories for an avatar.

```typescript
import { getAvatarMemories } from "../helpers/mcpClient";

const memories = await getAvatarMemories(avatarId, clerkToken, 50);
// Returns: [{ id, storyId, storyTitle, experience, emotionalImpact, personalityChanges, createdAt }, ...]
```

#### 5. `search_memories_by_context`
Search memories by keyword.

```typescript
import { searchAvatarMemories } from "../helpers/mcpClient";

const memories = await searchAvatarMemories(avatarId, "dragon", clerkToken, 20);
```

#### 6. `add_avatar_memory`
Add new memory after story.

```typescript
import { addAvatarMemoryViaMcp } from "../helpers/mcpClient";

await addAvatarMemoryViaMcp(avatarId, clerkToken, {
  storyId: "story_123",
  storyTitle: "The Dragon's Quest",
  experience: "Learned to be brave",
  emotionalImpact: "positive",
  personalityChanges: [
    { trait: "courage", change: 3 },
    { trait: "knowledge.history", change: 5 }
  ]
});
```

#### 7. `get_avatar_personality`
Get avatar's personality traits.

```typescript
import { getAvatarPersonality } from "../helpers/mcpClient";

const personality = await getAvatarPersonality(avatarId, clerkToken);
// Returns: { id, name, personalityTraits }
```

### MCP Validator Server

#### 1. `validate_story_response`
Validate complete story response.

```typescript
import { validateStoryResponse } from "../helpers/mcpClient";

const result = await validateStoryResponse(storyData);
// Returns: { isValid: true, normalized: {...} } or { isValid: false, errors: [...] }
```

#### 2. `validate_avatar_developments`
Validate avatar developments.

```typescript
import { validateAvatarDevelopments } from "../helpers/mcpClient";

const result = await validateAvatarDevelopments(developments);
```

#### 3. `normalize_trait_updates`
Normalize trait IDs.

```typescript
import { normalizeTraitUpdates } from "../helpers/mcpClient";

const result = await normalizeTraitUpdates([
  { trait: "mut", change: 2 },        // German → "courage"
  { trait: "physics", change: 5 }     // → "knowledge.physics"
]);
// Returns: { isValid: true, normalized: [...] }
```

#### 4. `get_validation_report`
Get comprehensive validation report.

```typescript
import { getValidationReport } from "../helpers/mcpClient";

const report = await getValidationReport(storyData);
// Returns: { overall, storyStructure, chapters, avatarDevelopments, errors, warnings }
```

---

## 🔐 Authentication

### MCP Server API Key
- **Required for:** All MCP server calls
- **Header:** `X-MCP-API-Key: mcp_sk_xxx`
- **Generated:** `<MCP_SERVER_API_KEY>`

### Clerk Token
- **Required for:** MCP Main Server (user-specific data)
- **Header:** `Authorization: Bearer <clerk_token>`
- **Source:** From Encore auth context

---

## ✅ Testing

### Test MCP Main Server
```bash
curl -X POST https://talea-mcp-main-production.up.railway.app/health
# Should return: {"status":"healthy","service":"talea-mcp-main",...}
```

### Test MCP Tool Call
```bash
curl -X POST https://talea-mcp-main-production.up.railway.app/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <clerk_token>" \
  -H "X-MCP-API-Key: <MCP_SERVER_API_KEY>" \
  -d '{
    "method": "tools/list"
  }'
```

### Test MCP Validator
```bash
curl -X POST https://talea-mcp-validator-production.up.railway.app/health
# Should return: {"status":"healthy","service":"talea-mcp-validator",...}
```

---

## 🐛 Troubleshooting

### Error: "Missing MCP_SERVER_API_KEY"
**Solution:** Add secret to Railway environment variables and Encore secrets

### Error: "Avatar not found or access denied"
**Solution:** Check Clerk token is valid and user owns the avatar

### Error: "Invalid trait ID"
**Solution:** Use MCP Validator to normalize trait IDs first

### Error: "Database connection failed"
**Solution:** Check DATABASE_URL in MCP Main server environment variables

---

## 📊 Benefits of MCP Integration

### Before MCP:
- ❌ Avatare sehen in jeder Geschichte anders aus
- ❌ Visual Profiles werden nicht konsistent genutzt
- ❌ Keine zentrale Validierung der Story-Responses
- ❌ Trait-IDs werden inkonsistent verwendet

### After MCP:
- ✅ **100% konsistente Avatar-Aussehen** (Visual Profiles aus DB)
- ✅ **Zentrale Validierung** (alle Responses werden geprüft)
- ✅ **Normalisierte Trait-IDs** (German/English → Canonical)
- ✅ **Avatar-Erinnerungen** in Geschichten integriert
- ✅ **Skalierbar** (MCP-Server unabhängig von Encore)

---

## 🚀 Next Steps

1. **Test MCP Servers:** Deploy both servers to Railway
2. **Add Encore Secret:** `encore secret set MCPServerAPIKey`
3. **Switch to MCP Version:** Edit `story/generate.ts` to use `ai-generation-with-mcp.ts`
4. **Test Story Generation:** Create a story and verify consistent avatar appearance
5. **Monitor:** Check Railway logs for MCP server activity

---

## 📝 Notes

- **Visual Profiles sind READ-ONLY via MCP** (manuelle Updates im Frontend)
- **MCP-Server sind stateless** (keine Session-Verwaltung)
- **Rate Limiting:** Noch nicht implementiert (später hinzufügen)
- **Caching:** Noch nicht implementiert (später für Performance)
