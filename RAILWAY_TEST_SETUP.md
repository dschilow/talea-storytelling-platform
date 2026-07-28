# Railway Test Environment Setup

## Overview

This document explains how to set up the **test-main** branch with automated deployments to a separate Railway test environment (`talea-test`).

## Architecture

```
main branch → Railway PROD (talea.website)
test-main branch → Railway TEST (talea-test.up.railway.app)
```

### What Happens

1. **Push to `test-main`** → Automatic Docker build + Railway deployment to TEST
2. **Test features** on `https://talea-test.up.railway.app` (or custom domain)
3. **Merge to `main`** when ready → Automatic deployment to PROD

## GitHub Secrets Required

Add these secrets to your GitHub repository:

### For TEST deployments (required for automatic test-main deployments):

- **`RAILWAY_API_TOKEN`** - Your Railway API token (same as PROD, if using same Railway account)
- **`RAILWAY_ENVIRONMENT_ID_TEST`** - The TEST environment ID on Railway
- **`RAILWAY_SERVICE_ID_TEST`** - The backend service ID in TEST environment

### For PROD deployments (already configured):

- **`RAILWAY_ENVIRONMENT_ID`** - The PROD environment ID
- **`RAILWAY_SERVICE_ID`** - The PROD backend service ID
- **`GEMINI_API_KEY`** - Your Gemini API key
- **`OPENROUTER_API_KEY`** - Your OpenRouter API key (if used)

## Railway Configuration

### Step 1: Create Test Environment

In your Railway project on **https://railway.app**:

1. Go to your Talea project
2. Click **+ New** → **Environment**
3. Name it: `test` or `staging`
4. Keep it isolated with **separate services**

### Step 2: Create Test Services

In the TEST environment, create these services:

#### Backend Service (Encore)

1. Click **+ New** → **Database** → **PostgreSQL**
   - Name: `talea-postgres-test`
   - This is separate from PROD database ✅

2. Click **+ New** → **Service** → **Github Repo**
   - Source: Your repository
   - Branch: `test-main` (important!)
   - Dockerfile: `Dockerfile.encore-runtime-audio` (custom)
   - Build command: (leave empty)
   - Start command: `./app`

3. Configure environment variables for backend:
   ```
   ENCORE_APP_SECRETS={"ClerkSecretKey":"sk_test_...","OpenAIKey":"...","GeminiAPIKey":"...","MCPServerAPIKey":"..."}
   PORT=8080
   ENVIRONMENT=test
   DATABASE_URLS=postgres://...  # Test database URL
   ```

#### Frontend Service (React)

1. Click **+ New** → **Service** → **Github Repo**
   - Source: Your repository
   - Branch: `test-main`
   - Dockerfile: `Dockerfile.frontend`
   - Config file: `railway.test.toml` (via plugin if available)

2. Configure environment variables for frontend:
   ```
   VITE_BACKEND_URL_TEST=https://talea-backend-test.up.railway.app
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

### Step 3: Get Service IDs

You need to get the Railway service IDs for automation:

**Via Railway CLI:**
```bash
railway login
railway link  # Select your Talea project
railway service list
```

Look for:
- `test-backend` (or your backend service name)
- Note the service ID (usually in parentheses)

**Via Railway Dashboard:**
1. Open https://railway.app → Your Project → TEST environment
2. Click each service
3. In the URL: `https://railway.app/project/xxx/service/yyy`
   - `yyy` is the service ID

### Step 4: Add GitHub Secrets

Go to your GitHub repository **Settings → Secrets and variables → Actions**

Add these secrets:

```
RAILWAY_API_TOKEN
  └─ Get from https://railway.app/account/tokens
     (create new token if needed)

RAILWAY_ENVIRONMENT_ID_TEST
  └─ Environment ID from Railway TEST environment
     Click environment in Railway dashboard to see it in URL

RAILWAY_SERVICE_ID_TEST
  └─ Service ID for backend in TEST environment
```

## Usage

### Make changes on test-main

```bash
# Switch to test-main branch
git checkout test-main

# Make your changes
# ...

# Commit and push
git add .
git commit -m "feat: test feature"
git push origin test-main
```

### GitHub Actions automatically:

1. ✅ Builds Docker image
2. ✅ Pushes to `ghcr.io/dschilow/talea:test-main`
3. ✅ Triggers Railway deployment to TEST environment

### Monitor deployment

1. Check **GitHub Actions** tab for workflow status
2. Check **Railway dashboard** for service deployment logs
3. Test at: **https://talea-test.up.railway.app** (or your custom domain)

### Merge to Production

When ready to go live:

```bash
# Switch to main
git checkout main

# Merge test-main
git merge test-main

# Push to main
git push origin main
```

→ Production deployment automatically triggers

## Environment Variables by Service

### Backend Test Environment

```
ClerkSecretKey=sk_test_...
OpenAIKey=sk-...
GeminiAPIKey=...
MCPServerAPIKey=...
DATABASE_URLS=postgres://user:pass@host/talea_test
PORT=8080
ENVIRONMENT=test
```

### Frontend Test Environment

```
VITE_BACKEND_URL_TEST=https://talea-backend-test.up.railway.app
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Important Notes

⚠️ **Database Isolation**
- Test environment uses a **separate PostgreSQL instance**
- Test data does NOT affect production
- Each test can have its own avatar, stories, etc.

⚠️ **Secrets Management**
- Never commit `.env` files or secrets
- Use Railway environment variables
- Clerk keys must be the same (test key works for both)

⚠️ **Custom Domain (Optional)**
- Test URL defaults to: `https://talea-test.up.railway.app`
- You can add custom domain like `https://test.talea.website`
- Configure in Railway service settings → Domain

## Troubleshooting

### Deployment fails

1. **Check GitHub Actions logs**
   - Go to repo → Actions tab
   - Click workflow run
   - Review error messages

2. **Check Railway logs**
   - Open Railway dashboard
   - Select TEST environment → Backend service
   - Click Logs tab
   - Look for build/runtime errors

3. **Missing secrets**
   - Verify all 3 secrets are in GitHub:
     - `RAILWAY_API_TOKEN`
     - `RAILWAY_ENVIRONMENT_ID_TEST`
     - `RAILWAY_SERVICE_ID_TEST`

### Test site won't load

1. Check if both backend and frontend are deployed
2. Verify `VITE_BACKEND_URL_TEST` points to correct backend URL
3. Check browser console for CORS errors
4. Verify Clerk keys are correct

### Database issues

1. Ensure test database exists on Railway
2. Check `DATABASE_URLS` environment variable
3. Verify PostgreSQL service is running
4. Migrations should run automatically on startup

## Quick Reference

| Environment | Branch | URL | Database |
|-------------|--------|-----|----------|
| PROD | main | talea.website | talea-postgres |
| TEST | test-main | talea-test.up.railway.app | talea-postgres-test |

---

**Next Steps:**
1. ✅ Create TEST environment on Railway
2. ✅ Add GitHub Secrets for TEST
3. ✅ Push a change to test-main
4. ✅ Monitor GitHub Actions + Railway deployment
5. ✅ Test feature at talea-test URL
6. ✅ Merge to main when ready
