# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Talea is an AI-powered storytelling platform where avatars with evolving personalities create unique, personalized stories. The platform uses Encore.ts (TypeScript backend framework) with a React frontend, deployed on Railway.

## Tech Stack

**Backend:** Encore.ts, PostgreSQL (multiple databases per service), OpenAI GPT, Clerk authentication
**Frontend:** React, TypeScript, Tailwind CSS v4, Redux Toolkit, Clerk React
**Package Manager:** Bun (required for this project)

## Development Commands

### Running the Application

```bash
# Start backend (from project root)
encore run

# Start frontend development server (from frontend/)
cd frontend
bun run dev

# Generate frontend client (from backend/)
encore gen client --target leap
```

The backend runs at `http://localhost:4000` and frontend at `http://localhost:5173`.

### Building

```bash
# Build frontend
cd backend
bun run build  # This also builds the frontend into backend/frontend/dist
```

### Testing

```bash
# Run Encore tests (from backend/)
encore test

# Test specific service
encore test ./avatar
```

### Database Operations

```bash
# Access database shell for a specific service
encore db shell <service-name>

# Example: Access avatar database
encore db shell avatar

# Database migrations are automatically run on startup via backend/health/init-migrations.ts
```

## Architecture

### Backend Services (Encore.ts Microservices)

The backend is organized into **10 independent Encore services**, each with its own database and API endpoints:

- **avatar/** - Avatar CRUD, personality trait management, memory system
- **story/** - Story generation, AI content creation, chapter management
- **doku/** - Knowledge base articles that avatars can learn from
- **ai/** - AI services (personality analysis, avatar generation, image generation)
- **user/** - User profile management
- **admin/** - Admin dashboard (user/avatar management, statistics)
- **tavi/** - AI chat assistant
- **auth/** - Clerk authentication integration
- **log/** - Centralized logging with Pub/Sub
- **health/** - Health checks and automatic database migration runner
- **frontend/** - Serves the built React frontend

Each service has:
- `encore.service.ts` - Service definition and endpoint imports
- `db.ts` - Database connection (if needed)
- `migrations/` - SQL migration files (numbered, with .up.sql and .down.sql)
- Individual API endpoint files

### Frontend Structure

```
frontend/
├── screens/          # Main application screens (Admin, Auth, Avatar, Doku, Home, Logs, Story)
├── components/       # Reusable React components
├── hooks/            # Custom React hooks
├── store/            # Redux Toolkit state management
└── client/           # Auto-generated Encore client (don't edit manually)
```

### Key Backend Patterns

**1. Personality Trait System (Critical)**

All avatars start with **9 base personality traits at value 0**:
- knowledge 🧠, creativity 🎨, vocabulary 🔤, courage 🦁, curiosity 🔍, teamwork 🤝, empathy 💗, persistence 🧗, logic 🔢

Personality traits use a **hierarchical system**:
- Base traits: `{ value: number, subcategories?: Record<string, number> }`
- Subcategories only exist when AI assigns them (e.g., `knowledge.history`, `knowledge.physics`)
- See [backend/constants/personalityTraits.ts](backend/constants/personalityTraits.ts:23) for full definitions
- Updates must include `description` field explaining why the trait changed
- Use [backend/avatar/updatePersonality.ts](backend/avatar/updatePersonality.ts:27) API to apply trait changes
- Traits are automatically upgraded via [backend/avatar/upgradePersonalityTraits.ts](backend/avatar/upgradePersonalityTraits.ts:7)

**2. Story Generation Flow**

1. User creates story with `StoryConfig` (genre, setting, avatars, age group, learning mode, etc.)
2. [backend/story/generate.ts](backend/story/generate.ts:158) orchestrates the process:
   - Loads avatar details with upgraded personality traits
   - Calls AI to generate story content with chapters
   - AI returns `avatarDevelopments` (personality changes based on story events)
   - Validates developments via MCP validator
   - Applies personality updates to **ALL user avatars** (participants get full points, readers get half)
   - Creates structured memories with categorization
   - Stores story and chapters in database
3. Cost tracking via Pub/Sub to log files (not database)

**3. Pub/Sub Safety Pattern**

Always use `publishWithTimeout` helper to prevent hanging operations:

```typescript
import { publishWithTimeout } from "../helpers/pubsubTimeout";

await publishWithTimeout(logTopic, {
  source: 'my-service',
  timestamp: new Date(),
  data: {...}
});
```

**4. MCP Integration**

The platform integrates with external MCP servers for validation:
- Avatar development validation
- Trait update normalization
- Memory synchronization
- See [backend/helpers/mcpClient.ts](backend/helpers/mcpClient.ts:1)

**5. Database Migrations**

- Migrations auto-run on startup via [backend/health/init-migrations.ts](backend/health/init-migrations.ts:1)
- Use numbered migration files: `1_name.up.sql`, `1_name.down.sql`
- Each service manages its own migrations in `<service>/migrations/`

### Frontend Patterns

**API Client Generation:**
The frontend client is auto-generated from backend services. After backend changes, regenerate with:

```bash
cd backend
encore gen client --target leap
```

**State Management:**
- Redux Toolkit for global state
- React hooks for local component state
- Clerk React for authentication state

**Authentication:**
- All API calls automatically include Clerk token via Encore auth middleware
- Frontend uses `@clerk/clerk-react` components

## Environment Variables

### Backend (Encore Secrets)

```bash
ClerkSecretKey=sk_test_...
OpenAIKey=sk-...
RunwareApiKey=...  # Optional: for image generation
MCPServerAPIKey=...  # For MCP validator integration
```

Set via Encore dashboard or local `encore.dev/config`.

### Frontend

```bash
VITE_BACKEND_URL=https://your-backend.up.railway.app
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Important Implementation Notes

### Avatar Personality Updates

When updating avatar personality traits, you MUST:
1. Use the exact trait IDs from [backend/constants/personalityTraits.ts](backend/constants/personalityTraits.ts:23)
2. Include a `description` field explaining the reason for each change
3. Subcategories (like `knowledge.biology`) are only created when AI requests them via updates
4. Base traits max at 100, knowledge subcategories max at 1000
5. All avatars start with all 9 base traits at value 0

### Story Generation

- The AI generates `avatarDevelopments` with specific trait changes based on story content
- ALL user avatars receive updates (not just story participants)
- Participants get full trait points, readers get 50% points
- Memory categorization determines cooldown periods for personality shifts
- Cost tracking is logged to files, not stored in database

### Adding New Services

1. Create service directory in `backend/`
2. Add `encore.service.ts` with service definition
3. Create `db.ts` if database needed
4. Add migrations in `migrations/` folder
5. Import endpoint files in `encore.service.ts`
6. Migrations will auto-run on next startup

### Modifying Database Schema

1. Create new migration file with incremented number
2. Write both `.up.sql` and `.down.sql` files
3. Restart backend - migrations run automatically via health service
4. Never modify existing migrations that have been deployed

### Working with Images

- Avatar images generated via AI ([backend/ai/avatar-generation.ts](backend/ai/avatar-generation.ts:1))
- Story chapter images use canonical avatar appearance from `visualProfile`
- Image consistency ensured via vision QA system ([backend/story/vision-qa.ts](backend/story/vision-qa.ts:1))

## Deployment

The project is deployed on Railway with GitHub Actions building Docker images for backend and direct deployment for frontend. See [README.md](README.md:5) for detailed deployment instructions.

**Important:** Database migrations run automatically on startup, so no manual migration steps needed during deployment.

## Common Patterns to Follow

1. **Always use Bun** as package manager (not npm/yarn/pnpm)
2. **Use `publishWithTimeout`** for all Pub/Sub operations
3. **Validate avatar developments** via MCP before applying
4. **Include descriptions** when updating personality traits
5. **Auto-upgrade traits** on read to ensure consistency
6. **Generate frontend client** after backend API changes
7. **Never skip Clerk authentication** - all endpoints require auth unless explicitly marked `auth: false`

## Documentation References

- Full deployment guide: [DEVELOPMENT.md](DEVELOPMENT.md:1)
- Testing guide: [TESTING_GUIDE.md](TESTING_GUIDE.md:1)
- Project structure: [README.md](README.md:100)
