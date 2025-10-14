# 🛠️ Common Issues - Talea Specific

**Quick solutions for Talea deployment issues.**

---

## ✅ All Critical Fixes Applied

The following fixes from the NotePad project have been applied to Talea:

1. ✅ **Database Migrations** - Auto-run via `/health` endpoint
2. ✅ **Pub/Sub Timeouts** - All 13 `.publish()` calls wrapped with timeout
3. ✅ **Token Validation** - `useBackend.ts` throws error if no token
4. ✅ **CORS Configuration** - Uses `allow_origins_with_credentials`

---

## 🔧 Manual Steps Required

### 1. Update CORS URL

After deploying, update `backend/encore.app`:

```json
{
  "global_cors": {
    "allow_origins_with_credentials": [
      "https://YOUR_ACTUAL_FRONTEND_URL.up.railway.app"  ← Change this!
    ]
  }
}
```

Then commit and push to redeploy backend.

---

### 2. Add API Keys

**Required Environment Variables:**

**Backend:**
- `ClerkSecretKey` - From [Clerk Dashboard](https://dashboard.clerk.com) → API Keys → Secret key
- `OpenAIKey` - From [OpenAI Dashboard](https://platform.openai.com/api-keys)
- `RunwareApiKey` - (Optional) For image generation

**Frontend:**
- `VITE_BACKEND_URL` - Your Railway backend URL
- `VITE_CLERK_PUBLISHABLE_KEY` - From Clerk Dashboard → API Keys → Publishable key

---

### 3. Trigger Database Migrations

After first deployment:
```
https://backend-production-XXXX.up.railway.app/health
```

Should return:
```json
{
  "status": "healthy",
  "migrations": {
    "run": true,
    "message": "Migrations completed successfully"
  }
}
```

---

## 🚨 Known Issues

### Issue: "Creating..." Dialog Hangs

**Status:** ✅ **FIXED**

All Pub/Sub `.publish()` calls now have 2-second timeout:
```typescript
await publishWithTimeout(logTopic, { ... });
```

If still hanging, check backend logs for Pub/Sub warnings (non-critical).

---

### Issue: 401 Errors on Page Load

**Status:** ✅ **FIXED**

`useBackend.ts` now validates token before sending requests:
```typescript
const token = await getToken();
if (!token) {
  throw new Error("No authentication token available");
}
```

**If still occurs:**
1. Hard refresh: `Ctrl + Shift + R`
2. Clear cache in browser console (F12):
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   window.location.reload();
   ```

---

### Issue: Database Tables Missing

**Status:** ✅ **FIXED**

Tables are auto-created via `/health` endpoint.

**Tables created:**
- `users` - User profiles and subscriptions
- `avatars` - AI avatars with personalities
- `avatar_memories` - Avatar memory system
- `stories` + `chapters` - Generated stories
- `dokus` - Knowledge base
- `avatar_doku_read` + `avatar_story_read` - Reading tracking
- `personality_tracking` - AI personality evolution logs

**To verify:**
Railway → PostgreSQL → Connect → psql:
```sql
\dt
```

---

### Issue: Story Generation Fails

**Causes:**
1. **OpenAI API Key missing/invalid**
   - Check `OpenAIKey` in Railway backend variables
   - Verify key is active at [OpenAI Dashboard](https://platform.openai.com/api-keys)

2. **Model not available**
   - Code uses `gpt-5-nano` (check if available for your account)
   - Update model in `backend/story/ai-generation.ts` if needed:
     ```typescript
     const MODEL = "gpt-4o-mini";  // or another model
     ```

3. **Insufficient OpenAI credits**
   - Check your OpenAI account balance

---

### Issue: Image Generation Fails

**Cause:** `RunwareApiKey` not configured (optional feature)

**Solution:**
- Get API key from [Runware](https://runware.ai/)
- Add to Railway backend variables: `RunwareApiKey=XXXXXXXX`

**Or:** Skip image generation - stories work without images.

---

## 🔍 Debug Tips

### Check Backend Logs

Railway → Backend Service → "Logs" tab

**Look for:**
- ✅ `=== Running Talea Database Migrations ===`
- ✅ `✓ Migrations completed!`
- ⚠️ `Failed to publish event: Pub/Sub timeout` (non-critical)
- ❌ Any errors in red

### Check Frontend Logs

Browser Console (F12):
- ❌ CORS errors → Update `backend/encore.app`
- ❌ 401 errors → Check Clerk keys
- ❌ Network errors → Check `VITE_BACKEND_URL`

### Test API Manually

```bash
# Health check
curl https://backend-production-XXXX.up.railway.app/health

# Should return:
# {"status":"healthy","migrations":{"run":true,...}}
```

---

## 📊 Expected Behavior

### First Deployment
1. Railway builds Docker images (5-10 min)
2. Backend starts, triggers migrations via `/health`
3. Frontend starts, connects to backend
4. Ready to use! ✨

### Subsequent Deployments
1. Faster builds (3-5 min)
2. Migrations skip if tables exist
3. Zero downtime

---

## 🆘 Still Having Issues?

1. **Check all environment variables** are set correctly
2. **Verify Clerk keys** (Secret vs Publishable)
3. **Check OpenAI API key** is active
4. **Clear browser cache** completely
5. **Test in incognito mode**

---

**Most issues are fixed!** This codebase includes all critical fixes from successful NotePad deployment.

