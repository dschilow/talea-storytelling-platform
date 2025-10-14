# 🎭 Talea - AI Storytelling Platform

An AI-powered storytelling platform where avatars with evolving personalities create unique, personalized stories.

## 🚀 **NEW: Ready for Railway Deployment!**

**All fixes applied from NotePad project:**
- ✅ Database migrations auto-run
- ✅ Pub/Sub timeout protection  
- ✅ Frontend race condition fixes
- ✅ CORS properly configured

→ **[START HERE - Deployment Guide](./START_HERE.md)**

⚠️ **Known Issue: Frontend Dockerfile Problem**
Railway's `railway.toml` applies to ALL services.
→ **[Quick Fix Guide](./FRONTEND_DOCKERFILE_FIX.md)**

---

## Features

- 🤖 **AI Avatar Generation** - Create unique characters with detailed personalities
- 📖 **Story Generation** - GPT-powered storytelling with multiple avatars
- 🧠 **Personality Evolution** - Avatars learn and change based on experiences
- 📚 **Doku System** - Knowledge base that avatars can learn from
- 🎨 **Visual Profiles** - AI-generated or photo-based avatar images
- 👥 **Admin Dashboard** - User management and platform statistics
- 💬 **Tavi Chat** - AI assistant for the platform
- 🔐 **Clerk Authentication** - Secure user management

---

## Tech Stack

### Backend
- **Encore.ts** - TypeScript backend framework
- **PostgreSQL** - Multiple databases for different services
- **OpenAI GPT** - Story and personality generation
- **Pub/Sub** - Event-driven analytics and logging
- **Clerk** - Authentication

### Frontend
- **React** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Clerk React** - Authentication UI

---

## Quick Start

### For Railway Deployment
→ **[START HERE](./START_HERE.md)**

### For Local Development

1. **Install Encore CLI:**
   ```bash
   curl -L https://encore.dev/install.sh | bash
   ```

2. **Set up environment:**
   - Get OpenAI API key from [OpenAI Dashboard](https://platform.openai.com/api-keys)
   - Get Clerk keys from [Clerk Dashboard](https://dashboard.clerk.com)
   - Add secrets in Encore dashboard or local config

3. **Run:**
   ```bash
   encore run
   ```

Frontend available at `http://localhost:5173`  
Backend available at `http://localhost:4000`

---

## Documentation

### 🎯 Deployment Guides
- **[ANLEITUNG_FUER_DIMITRI.md](./ANLEITUNG_FUER_DIMITRI.md)** - 🇩🇪 **Vollständige Anleitung (Deutsch)**
- **[START_HERE.md](./START_HERE.md)** - Quick start guide
- **[RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)** - Full deployment docs

### 🔧 Configuration & Troubleshooting
- **[FRONTEND_DOCKERFILE_FIX.md](./FRONTEND_DOCKERFILE_FIX.md)** - 🚨 Frontend Dockerfile Problem
- **[RAILWAY_MANUAL_CONFIG.md](./RAILWAY_MANUAL_CONFIG.md)** - Manual Railway configuration
- **[COMMON_ISSUES_TALEA.md](./COMMON_ISSUES_TALEA.md)** - Common issues & solutions

### 💻 Development
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Local development guide

---

## Project Structure

```
talea-storytelling-platform/
├── backend/
│   ├── avatar/          # Avatar management
│   ├── story/           # Story generation
│   ├── doku/            # Knowledge base
│   ├── ai/              # AI services
│   ├── admin/           # Admin dashboard
│   ├── tavi/            # AI chat assistant
│   ├── user/            # User profiles
│   ├── auth/            # Authentication
│   ├── health/          # Health checks & migrations
│   └── helpers/         # Shared utilities
├── frontend/
│   ├── screens/         # Main application screens
│   ├── components/      # Reusable components
│   ├── hooks/           # Custom React hooks
│   └── store/           # State management
└── docs/                # Documentation
```

---

## Environment Variables

### Backend
```bash
ClerkSecretKey=sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
OpenAIKey=sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
RunwareApiKey=XXXXXXXX  # Optional: for image generation
```

### Frontend
```bash
VITE_BACKEND_URL=https://your-backend.up.railway.app
VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXX
```

---

## Database Schema

- **users** - User profiles and subscriptions
- **avatars** - AI avatars with personalities and visual profiles
- **avatar_memories** - Memory system for avatars
- **stories** + **chapters** - Generated stories
- **dokus** - Knowledge base articles
- **avatar_doku_read** - Avatar reading tracking
- **avatar_story_read** - Story completion tracking
- **personality_tracking** - AI personality evolution logs

---

## API Keys Needed

1. **Clerk** (Required)
   - Sign up at [clerk.com](https://clerk.com)
   - Free tier available
   - Get: Secret Key + Publishable Key

2. **OpenAI** (Required for story generation)
   - Sign up at [platform.openai.com](https://platform.openai.com)
   - Add payment method
   - Get: API Key

3. **Runware** (Optional - for image generation)
   - Sign up at [runware.ai](https://runware.ai)
   - Get: API Key

---

## Contributing

This project includes all production-ready fixes for Railway deployment.

When making changes:
- Database schema changes → Add migrations to relevant service
- New Pub/Sub calls → Use `publishWithTimeout()` helper
- Frontend API calls → Ensure proper token handling

---

## License

MIT

---

## Support

For deployment issues, see [COMMON_ISSUES_TALEA.md](./COMMON_ISSUES_TALEA.md)

For feature requests or bugs, open an issue on GitHub.

---

**Ready to deploy?** → [Get Started](./START_HERE.md) 🚀

