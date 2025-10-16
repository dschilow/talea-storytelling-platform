# 🚀 Start Here - Talea Storytelling Platform Deployment

**Welcome!** This is your starting point for deploying the Talea Storytelling Platform (Encore.ts + AI) to Railway.

## 📚 What is Talea?

Talea is an AI-powered storytelling platform where avatars with evolving personalities create unique stories. Built with:
- **Encore.ts** backend framework
- **React** frontend with beautiful UI
- **PostgreSQL** for data persistence
- **OpenAI GPT** for story generation
- **Clerk** for authentication
- **Pub/Sub** for event-driven analytics

---

## ⚡ Quick Deploy (10 minutes)

### **Prerequisites**
- [Railway Account](https://railway.app) (free tier)
- [Clerk Account](https://clerk.com) (free tier)
- [OpenAI API Key](https://platform.openai.com/api-keys)
- Git repository connected

### **Deployment Steps**

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for Railway deployment"
   git push
   ```

2. **Deploy on Railway**
   - Connect Railway to your GitHub repo
   - Railway auto-detects `Dockerfile.backend` and `Dockerfile.frontend`
   - 2 services will be created: Backend + Frontend

3. **Add PostgreSQL**
   - Railway Dashboard → "+ New" → "Database" → "PostgreSQL"
   - Automatically connected to backend

4. **Configure Environment Variables**

   **Backend Service:**
   ```bash
   ClerkSecretKey=sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   OpenAIKey=sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   RunwareApiKey=XXXXXXXX  # Optional: for image generation
   ```

   **Frontend Service:**
   ```bash
   VITE_BACKEND_URL=https://backend-production-XXXX.up.railway.app
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXX
   ```

5. **Initialize Database**
   - Open: `https://backend-production-XXXX.up.railway.app/health`
   - Should see: `{"status":"healthy","migrations":{"run":true,...}}`

6. **Update CORS**
   - Edit `backend/encore.app`
   - Replace `https://YOUR_FRONTEND_URL.up.railway.app` with your actual frontend URL
   - Commit and push to redeploy

7. **Test Application**
   - Open your frontend URL
   - Sign in with Clerk
   - Create an avatar
   - Generate a story ✨

---

## 🔧 Important Fixes Applied

This project includes all fixes from the NotePad project deployment:

✅ **Database Migrations** - Automatically run on `/health` check  
✅ **Pub/Sub Timeouts** - All `.publish()` calls have 2s timeout to prevent hanging  
✅ **Frontend Token Validation** - Prevents 401 errors and race conditions  
✅ **CORS with Credentials** - Properly configured for Railway deployment  

---

## 📖 Full Documentation

For detailed step-by-step instructions, see:
- **[TALEA_RAILWAY_DEPLOYMENT.md](./TALEA_RAILWAY_DEPLOYMENT.md)** - Complete deployment guide
- **[COMMON_ISSUES.md](./COMMON_ISSUES.md)** - Troubleshooting (if issues arise)

---

## 🆘 Quick Troubleshooting

### "Creating..." Dialog Hangs
**Cause:** Pub/Sub timeout  
**Solution:** Already fixed with `publishWithTimeout()` helper

### 401 Unauthorized Errors
**Cause:** Token not loaded before query  
**Solution:** Already fixed with token validation in `useBackend.ts`

### Database Tables Missing
**Cause:** Migrations not run  
**Solution:** Open `/health` endpoint to trigger migrations

### CORS Errors
**Cause:** Frontend URL not in `backend/encore.app`  
**Solution:** Update `encore.app` with your Railway frontend URL

---

## 🌟 Features

- **AI Avatar Generation** - Create unique characters with personalities
- **Story Generation** - GPT-powered storytelling with avatar interactions
- **Personality Evolution** - Avatars learn and change based on experiences
- **Doku System** - Knowledge base for avatars to learn from
- **Admin Dashboard** - Manage users and system stats
- **Tavi Chat** - AI assistant for the platform

---

**Ready to deploy?** → [Continue to Full Deployment Guide](./TALEA_RAILWAY_DEPLOYMENT.md)

