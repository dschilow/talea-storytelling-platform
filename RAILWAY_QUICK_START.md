# 🚀 Railway Test Environment - Quick Start

**Get your staging environment running in 2 minutes!**

## Prerequisites

✅ Railway CLI installed (check: `railway --version`)
✅ Railway API token (get at: https://railway.app/account/tokens)
✅ GitHub CLI installed (check: `gh --version`)
✅ GitHub authenticated (run: `gh auth login` if not)

## Step 1: Get Your Railway Project ID

```bash
railway login  # Use your token
railway list   # Find your Talea project
railway link   # Link to Talea project
```

After linking, get the project ID:
```bash
echo $RAILWAY_PROJECT_ID
# Or from Railway Dashboard URL: https://railway.app/project/PROJECT_ID
```

## Step 2: Create Test Environment (Automated)

Run the automated Railway setup:

```bash
RAILWAY_API_TOKEN=your_token RAILWAY_PROJECT_ID=your_project_id bun run setup-railway-test-env.ts
```

This will:
✅ Create `test` environment on Railway
✅ Create PostgreSQL test database
✅ Create backend service (Encore, branch: test-main)
✅ Create frontend service (React, branch: test-main)
✅ Configure environment variables
✅ Print your new service IDs

**📋 Copy the output! You'll need the service IDs next.**

## Step 3: Add GitHub Secrets (Automated)

From the output above, you'll have:
- `RAILWAY_ENVIRONMENT_ID_TEST`
- `RAILWAY_SERVICE_ID_TEST`

Run:

```bash
bun run setup-github-secrets.mjs ENVIRONMENT_ID_TEST SERVICE_ID_TEST
```

This will:
✅ Set `RAILWAY_ENVIRONMENT_ID_TEST` secret
✅ Set `RAILWAY_SERVICE_ID_TEST` secret
✅ Verify all secrets are configured

## Step 4: Test It! 🎉

Now push to `test-main`:

```bash
git checkout test-main
git push origin test-main
```

GitHub Actions will automatically:
1. Build Docker image ✅
2. Push to registry ✅
3. Deploy to Railway test environment ✅
4. Available at: **https://talea-test.up.railway.app**

Monitor deployment:
- **GitHub Actions**: https://github.com/dschilow/talea-storytelling-platform/actions
- **Railway Dashboard**: https://railway.app

## Typical Workflow

```bash
# 1. Make changes on test-main
git checkout test-main
echo "your feature" > file.txt
git add .
git commit -m "feat: my feature"
git push origin test-main

# → GitHub Actions auto-deploys to test environment

# 2. Test at https://talea-test.up.railway.app

# 3. When ready, merge to production
git checkout main
git merge test-main
git push origin main

# → Production deployment automatically triggers
```

## Complete Commands (Copy-Paste)

```bash
# 1. Authenticate Railway
railway login

# 2. Link your project
railway link

# 3. Create test environment (replace with your values)
RAILWAY_API_TOKEN="your_token_here" RAILWAY_PROJECT_ID="your_project_id_here" bun run setup-railway-test-env.ts

# 4. Add GitHub secrets (from step 3 output)
bun run setup-github-secrets.mjs YOUR_ENVIRONMENT_ID YOUR_SERVICE_ID

# 5. Test the deployment
git checkout test-main
git push origin test-main

# → Check GitHub Actions and Railway dashboard for status
```

## Troubleshooting

### "Missing RAILWAY_API_TOKEN"
```bash
railway login  # Authenticate first
# Then get token from: https://railway.app/account/tokens
```

### "Missing RAILWAY_PROJECT_ID"
```bash
railway link  # Select your Talea project
railway list  # Should show the project ID
```

### GitHub secrets not working
```bash
# Check if authenticated
gh auth status

# Manually verify secrets were set
gh secret list --repo dschilow/talea-storytelling-platform
```

### Deployment fails
1. Check GitHub Actions logs: https://github.com/dschilow/talea-storytelling-platform/actions
2. Check Railway logs: https://railway.app → TEST environment → service → Logs
3. Common issues:
   - Database not initialized (migrations need to run)
   - Missing environment variables (check Railway service settings)
   - Wrong branch (should be `test-main`)

### Can't access talea-test.up.railway.app
1. Verify frontend service deployed: Railway dashboard → TEST environment → talea-frontend-test
2. Check domain configuration: Service → Domain tab
3. Verify `VITE_BACKEND_URL_TEST` is set correctly
4. Check browser console for CORS errors

## Environment Details

### Test Database
- **Type**: PostgreSQL
- **Name**: `talea-postgres-test` (on Railway)
- **Isolation**: Completely separate from production ✅
- **Data**: Only persists for testing, not synced with production

### Test Frontend
- **Domain**: `talea-test.up.railway.app` (default)
- **Branch**: `test-main`
- **Redeploys**: Every push to `test-main`

### Test Backend
- **Branch**: `test-main`
- **Redeploys**: Every push to `test-main`
- **Logs**: Available in Railway dashboard

## Key Files Created

```
.github/workflows/
  └── deploy-railway-test.yml        # Auto-deploy workflow for test-main

scripts/
  └── trigger-railway-deploy-test.mjs # Railway deployment trigger

setup-railway-test-env.ts            # Automated Railway setup
setup-github-secrets.mjs             # Automated GitHub secrets
railway.test.toml                    # Frontend config for test
RAILWAY_TEST_SETUP.md                # Detailed documentation
RAILWAY_QUICK_START.md               # This file
```

## What Happens After Merge to Main

When you merge `test-main` → `main`:

```bash
git checkout main
git merge test-main
git push origin main
```

✅ Production workflow triggers
✅ Docker image built and tagged as `:latest`
✅ Automatically deployed to production
✅ Available at: **https://talea.website**

**No manual steps needed!** Both workflows run automatically.

---

**Questions?** See [RAILWAY_TEST_SETUP.md](RAILWAY_TEST_SETUP.md) for detailed documentation.

**Status Check:**
- Test environment: https://railway.app (TEST environment)
- Production environment: https://railway.app (production environment)
- Deployments: https://github.com/dschilow/talea-storytelling-platform/actions
