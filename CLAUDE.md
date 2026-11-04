# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Talea is an AI-powered storytelling platform where avatars with evolving personalities create unique, personalized stories. The platform uses Encore.ts (TypeScript backend framework) with a React frontend, deployed on Railway.

## Tech Stack

**Backend:** Encore.ts, PostgreSQL (multiple databases per service), OpenAI GPT, Google Gemini 2.0 Flash, Clerk authentication
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

**⚠️ IMPORTANT: Updating Database on Railway Production**

When you need to modify database values directly on Railway (e.g., config updates, data fixes):

**DO NOT** manually connect to Railway Postgres. **ALWAYS** use the API-based migration endpoint:

```powershell
# PowerShell command to update database on Railway
$sql = @"
YOUR SQL STATEMENT HERE;
"@
$body = @{ sql = $sql; migrationName = "descriptive_name" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://backend-2-production-3de1.up.railway.app/story/run-migration-sql" -Method Post -Body $body -ContentType "application/json"
```

**Example:**
```powershell
$sql = @"
UPDATE pipeline_config SET value = jsonb_set(value, '{runwareSteps}', '4'), updated_at = CURRENT_TIMESTAMP WHERE key = 'default';
"@
$body = @{ sql = $sql; migrationName = "update_runware_steps" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://backend-2-production-3de1.up.railway.app/story/run-migration-sql" -Method Post -Body $body -ContentType "application/json"
```

**Why this pattern:**
- ✅ Safe: Properly handles transactions and errors
- ✅ Logged: All executions are logged for audit trail
- ✅ Idempotent: Can run multiple times without issues
- ✅ No credentials needed: Uses internal API endpoint

See [DatabaseMigrationDoku.md](DatabaseMigrationDoku.md:1) for detailed guide.

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
   - Applies personality updates to **participating avatars only** (the avatars in `config.avatarIds`); non-participating avatars are not touched
   - Applies a per-trait cooldown (24h thematic / 72h personality, reconstructed from `avatar_memories`) before writing changes
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
GeminiAPIKey=...  # For Google Gemini 2.0 Flash story generation
RunwareApiKey=...  # Optional: for image generation
MCPServerAPIKey=...  # For MCP validator integration
```

Set via Encore dashboard or local `encore.dev/config`.

**Note:** See [GEMINI_SETUP.md](GEMINI_SETUP.md:1) for detailed Google Gemini 2.0 Flash setup instructions.

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

**AI Model Selection:**
- Users can choose between OpenAI GPT models and Google Gemini 2.0 Flash in the Story Wizard
- Model selection affects cost and generation quality
- Gemini 2.0 Flash is **free** during preview phase and optimized for creative storytelling
- Default model: `gpt-5-mini` (balanced quality/cost)
- See [backend/story/ai-generation.ts](backend/story/ai-generation.ts:230) for model configurations

**Story Generation Flow:**
- The AI generates `avatarDevelopments` with specific trait changes based on story content
- Only participating avatars (those in `config.avatarIds`) receive updates; there is no reduced "reader" reward
- Memory categorization determines cooldown periods for personality shifts (acute = none, thematic = 24h, personality = 72h per trait), enforced via `loadPersonalityShiftCooldowns`
- Cost tracking is logged to files, not stored in database

**Implementation Files:**
- [backend/story/generate.ts](backend/story/generate.ts:1) - Main story generation orchestrator
- [backend/story/ai-generation.ts](backend/story/ai-generation.ts:1) - OpenAI integration
- [backend/story/gemini-generation.ts](backend/story/gemini-generation.ts:1) - Google Gemini integration

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

### Running Database Migrations Manually (Emergency)

**Problem:** Sometimes SQL migration files aren't copied into the Railway Docker container, causing automatic migrations to fail.

**Solution:** Use the manual migration script to execute SQL files via API.

**Steps:**

1. **Verify the issue:**
   ```bash
   # Check current fairy tales count (should be 50)
   curl https://backend-2-production-3de1.up.railway.app/fairytales/trigger-migrations
   ```

2. **Run the migration script:**
   ```bash
   bun run run-migrations-via-api.ts
   ```

3. **What it does:**
   - Reads SQL migration files from `backend/fairytales/migrations/`
   - Sends them to `/fairytales/run-migration-sql` API endpoint
   - API splits SQL by semicolon and executes each statement separately
   - Handles duplicate key errors gracefully
   - Reports success/failure for each migration

4. **How it works:**
   - [run-migrations-via-api.ts](run-migrations-via-api.ts:1) - Local script that reads SQL files
   - [backend/fairytales/run-migration-sql.ts](backend/fairytales/run-migration-sql.ts:1) - API endpoint that executes raw SQL
   - SQL is split into individual statements (by `;`) and executed one by one
   - Progress logged every 10 statements

5. **Expected output:**
   ```
   🚀 Talea Fairy Tales Migration Runner (API Mode)
   📊 Checking current fairy tale count...
     Current count: 15 tales

   🔄 Running 10_add_47_classic_fairy_tales...
     ✅ completed successfully

   📊 Final Results:
     Migrations executed: 4/4
     Final fairy tale count: 50

   🎉 SUCCESS! Database now has exactly 50 fairy tales!
   ```

6. **Verify on website:**
   - https://www.talea.website/fairytales should show all 50 fairy tales

**Important Notes:**
- The script is idempotent - duplicate entries are skipped automatically
- Each migration file is executed as a transaction
- Progress is logged to Railway console for debugging
- The API endpoint has no authentication (marked `auth: false`) for emergency access

### Working with Images

- Avatar images generated via AI ([backend/ai/avatar-generation.ts](backend/ai/avatar-generation.ts:1))
- Story chapter images use canonical avatar appearance from `visualProfile`
- Image consistency ensured via vision QA system ([backend/story/vision-qa.ts](backend/story/vision-qa.ts:1))

### Talea Originals (pre-produced series, replaces the old Studio)

- Every child reads the same series; admins produce episodes on the series page (tab "Studio"). Endpoints: [backend/story/library-api.ts](backend/story/library-api.ts:1) — keep endpoint files directly in the service folder, the Encore v1.50 client generator writes wrong import paths for subfolders.
- Seed: [backend/story/library/seed/](backend/story/library/seed/) (series bible, season plan, written episodes), pictures in `frontend/public/library/`. The seed never overwrites admin edits (characters, plans, texts).
- Pipeline (Encore-free): [backend/story/library/engine.ts](backend/story/library/engine.ts:1) — Luna plans, Sol writes, Gemini scores 8 dimensions (min 9, max 3 writes), Luna finalizes canon facts, collectible and picture direction. Only approved episodes are canon. Pictures: FLUX 3 Image Klein with ONE reference sheet and bounding boxes per figure ([backend/story/library/images.ts](backend/story/library/images.ts:1)); scenes are action moments, nobody looks at the camera.
- Tools: `bun --env-file=.env.local run scripts/library/episode-live-test.ts --series <slug> --episode N` (live, no DB), `scripts/library/generate-seed-images.ts`, `encore exec -- bun scripts/library-smoke.ts` (from backend/).
- Hand-written seed episodes (S1E1, S1E2 of both series are written by Claude): counter-read with `bun --env-file=.env.local run scripts/library/episode-review.ts --series <slug> --episode N --file draft.txt` (GPT-6.1 Sol, pipeline score sheet + child check; `--provider openai` uses OPENAI_API_KEY instead of OpenRouter). Sol grades hard (7–8 = good) and finds real rule breaks; about 0.09–0.11 $ per run.
- **Audio dramas (Hörspiele)** — [backend/story/library/audio/](backend/story/library/audio/), endpoints in [backend/story/library-audio-api.ts](backend/story/library-audio-api.ts:1): Captain Comedy (`8tJgFGd1nr7H5KLTvjjt`, like Tavi) narrates, every figure keeps its own ElevenLabs voice (bible `audio.cast` → admin choice in table `library_voice_cast` wins → automatic pick is stored). Chain: Luna casts the episode's guests → Sol writes a screenplay per chapter (fidelity check: every quoted line must survive) → ElevenLabs v4 in takes of ≤ 1,600 characters (longer dialogue requests drop or invent lines) → optional listening check per take (speech-to-text, re-record up to 3×) — OFF by default, the editor finds it too expensive; `TALEA_AUDIO_QA=on` enables it → series score (theme, bridge, scene beds) composed ONCE per series with ElevenLabs Music and cached in the bucket → studio mix (`mixStudioMaster` in [backend/doku/audio-render.ts](backend/doku/audio-render.ts:1), shared with the audio dokus). The account allows only 2 ElevenLabs requests at once; 429 is retried, never treated as "not available". Admin decides at approval (`withAudio`/`releaseAudio`) or later in the Studio; old episodes get theirs via the same button. Live test without DB: `encore exec -- bun --env-file=../.env.local scripts/library-audio-live.ts --series <slug> [--script-only] [--from <dir>]` (from backend/).
- **Voice engines** ([backend/story/library/audio/engines.ts](backend/story/library/audio/engines.ts:1)): `gemini-lite` (default since 2026-10-25, the editor finds it good enough; `TALEA_AUDIO_ENGINE` changes the server default) / `gemini-flash` (Gemini 3.8 TTS via OpenRouter `/audio/speech`, key = `OpenRouterAPIKey`), `elevenlabs` (v4 dialogue takes). Gemini makes speech only: sounds and music stay ElevenLabs. Gemini takes one voice per request (two at most, a third gives 400) and no timestamps, so [gemini-render.ts](backend/story/library/audio/gemini-render.ts:1) records every line on its own: leading tone tag + persona → `instructions`, reaction tags ([laughs], [pause]) stay in the text (Gemini performs them, measured), free length check with up to 2 retakes, trim padding, level per figure, radio-play gaps, one WAV per part with exact line spans. Gemini cast per series in table `library_voice_engine_cast` (persona stays in `library_voice_cast`); narrator Puck; boys keep male voices, age comes from the direction. The Studio picks the engine per recording, shows a cost breakdown (list prices), keeps the previous recording to compare/restore, and caches generated sounds in the bucket (`library/sounds/v1/…`), so re-recording a screenplay buys no sound twice. Measured Bruno S1E1 ch. 1: ElevenLabs $0.33 vs Gemini Lite $0.044 / Flash $0.068 for the voices, no lost lines on any engine. Live test flags: `--engine gemini-lite`, `--estimate` (with `--from`, free), `--budget <usd>`, `--no-sounds`, `--gemini-cast ella=Leda`.
- **Sound library** ([backend/story/library/audio/sound-library.ts](backend/story/library/audio/sound-library.ts:1), table `library_sounds`, Studio section "Geräusche-Bibliothek"): every generated spot effect and ambience bed is kept for ALL stories with a German label, a precise English description and keywords with synonyms. Before a recording (while the voices record) every sound of the screenplay is cast: named library id or the same prompt → taken; else a BM25 keyword search finds candidates (library + earlier new sounds of the episode) and Luna decides strictly ("im Zweifel neu") and describes the new ones (≈ 0.15 ct per episode). A taken sound plays with the entry's prompt and length, so the bucket cache (`library/sounds/v1/…`) finds its audio; new sounds join once their audio exists. Spot effects play in full, so a stored one must be 70–150 % (or ±0.5 s) of the wished length. Blocked entries are never offered and screenplays naming them are recast. Measured 2026-10-25: two independent screenplays of Bruno S1E1 shared 44 of 57 sounds; chapter 1 of the other screenplay cost 5 ct of sounds instead of ≈ 13 ct. Live test: `--plan-sounds` (with `--from`: print the casting, record nothing; sounds with audio in the local cache join `Logs/library/audio/sound-library.json`), `--no-library`.

### Talea-Folge (the Originals' method for the family's own stories)

- Lane `storybookEngine: "talea-folge-v1"` (wizard card "Eigene Geschichte"): in ONE call Sol 6.1 plans the story's own bible silently (one wonder with one rule, voices, one running gag, courage, payoffs) and writes a short header (IDEE/REGEL/FIGUR/FUNDSTÜCK/WIRKUNG/LACHER/WISSEN) plus the chapters, with two Originals chapters as the style reference. Since 2026-11-04 the lane borrows the Figurenabenteuer's machinery (user: the series makes very good stories and pictures, Talea-Folge was too long and cost 12–14 ¢): **lengths** of `seriesBudget` (6–8 medium: 3 × 450–650 words), at most one new figure up to age 8, the wonder is the only magic and never adds or removes body parts (FLUX cannot count changing limbs), nothing after the final laugh; **Haiku 5.5** reads the manuscript with the series' editorial craft (`episodeEditorSystem`) and Sol repairs only the quoted passages (`applyStoryEdits`, heading lines change titles), at most two rounds, each kept only if the recheck finds fewer defects — no more whole-story rewrites; **pictures** exactly like the series: guest portrait (now read by Luna and redrawn once, `guestPortraitCheck`), the series' reference plan for recurring props, Luna direction from exact quotes (`directFolgePictures` → `directSourcePictures` in [character-series/pictures.ts](backend/story/character-series/pictures.ts); any hero may carry cover and page 1), FLUX.2 klein 9B KV (`SERIES_IMAGE_MODEL`), Luna check + Jev, the series' redraw ladder and 16-call cap. **Redraws from a corrected prompt** (both lanes, user proposal 2026-11-04): before a failed picture is drawn again, Luna gets the failed picture, the identity sheet, its COMPLETE prompt, the story passage and all findings (review, Jev, panel check), names the cause and writes the corrected COMPLETE prompt (`SERIES_PROMPT_REWRITE`, `readSeriesShotRewrite`, `seriesRewrittenPrompt`; same moment and actor, at most one figure less in a three-figure picture, positive words only because FLUX paints what a negation names — in the first trials Luna blamed the code's own "No additional foreground children" line for the extra children); the code adds back the identity line WITH its binding (faces, glasses and outfits stay with their owner, human anatomy, one continuous setting — without it Nora lost her glasses and the sheet's portraits floated over the scene), the object references, the art style and the wordless line; a prompt that forgets a cast figure or is out of size falls back to her rewritten scene inside the code-built prompt. The one-figure rescue plan never inherits a rewritten prompt. The redraw is a fresh picture without appended fix sentences; each further wave rewrites the latest prompt. ≈ 0.1–0.2 ¢ per redraw; an unusable rewrite keeps the old repair (edit, then same scene + fixes), `TALEA_SERIES_PROMPT_REWRITE=off` restores it. Logged as `prompt-rewrite` (cause) and `rewritten-scene` in `imageQa[].history`. Measured 2026-11-04 on six production-equal pilots (4 Folge, 2 series): 16 of 36 rewritten redraws passed (the old repairs ≈ 3 of 14, a scene-only rewrite 2 of 14), 16 of 20 failed pictures were rescued, 39 of 42 pictures printed. What still fails: a wonder that changes size or material (a growing cork crown painted as gold, a shrinking cake) and an extra child in a crowded three-figure cover. The reviewer never asks for lettering (a missing boat name "Seegras" cost four redraws). A new figure gets a look of its own (a green troll in a red vest was drawn as a well-known film ogre). `scripts/character-series/pilot-v2.ts` passes `imageModel` since 2026-11-04; before, series pilots built the FLUX-3 region prompt and were not production-equal. The wizard's picture style applies to both lanes (and `stripAdminOnlyStoryOptions` keeps `imageStyle` — it was dropped for customers before). Measured pilots 2026-11-04 (`scripts/episode/pilot.ts`, fictional avatars): 1,490–1,530 words, 6.7–8.7 ¢ per story (text 2.7–3.7 ¢), 5–6 of 7 pictures. Remaining picture faults: FLUX doubles a creature pool figure (a second bear), outfits drift, a wonder that grows keeps its portrait size. Pool portraits remain an error source (Hexe Kräuterweis is drawn young because her portrait is). The writer runs on OpenRouter's flex tier (refused flex falls back to standard; `TALEA_EPISODE_FLEX=off`); a flex call refused under load is retried on flex once after 4 s; failed attempts are logged as `llm-attempt-failed`. `TALEA_EPISODE_MODE=two-step` = JSON plan first (not better). Luna (≈ 5.5) and Gemini 3.8 Flash (≈ 6) were measured as writers and are not good enough. Code [backend/story/episode/](backend/story/episode/), hosted by `storybook-mode-generation.ts` (`folgeMode`). Guide and measurements: [docs/talea-folge-pipeline.md](docs/talea-folge-pipeline.md).
- End-to-end pilot without DB or Encore (production path incl. pictures): `bun --env-file=.env.local run scripts/episode/pilot.ts --run [--images] --genre fairy_tales --length medium --seed <s> --out Logs/episode/<name>` (`--style colored-pencil`), ≈ 3–4 ¢ text, ≈ 7–9 ¢ with pictures, ≈ 5 min; writes story.md, result.json (costs, every picture attempt) and the printed pictures.
- Text-only live test without DB, Sol/Luna directly over the OpenAI API (`OPENAI_API_KEY` in `.env.local`): `bun --env-file=.env.local run scripts/episode/run.ts --genre magic --age 6-8 --length medium --flavors lachfreude --out Logs/episode/<name>` (`--mode two-step`, `--writer`, `--planner openai/gpt-6-luna`, `--hero-file`, `--learning science`, `--dry`, `--via-openrouter --flex` = the production path). ≈ 4–5 ¢ (OpenAI direct) and 2 min per story.
- Since 2026-10-28 every family chooses on the wizard's first page "Was möchtet ihr erleben?": **Eigene Geschichte** = Talea-Folge, **Figurenabenteuer** = Figurenserie. `stripAdminOnlyStoryOptions` keeps exactly these two lanes ([backend/story/customer-story-lane.ts](backend/story/customer-story-lane.ts), tested) and drops every other one. A request without a lane (Tavi, older apps) follows the Railway variable `TALEA_CUSTOMER_STORY_ENGINE`: `talea-folge-v1`, or unset the standard pipeline (writer `moonshotai/kimi-k2.6`). The other lanes (Wunder & Witz, old standard, Bilderbuch, Kapitelbuch, Buchwerkstatt, Developer) are admin test lanes, folded away under "Eigene Geschichte" on that page; the wizard has no model picker any more (both product lanes write with fixed models).

### Prices, legal pages, fonts (release setup)

- Prices families see come live from Clerk Billing (`useBookablePlans` in [frontend/components/subscription/billingPlans.ts](frontend/components/subscription/billingPlans.ts:1)) on the landing page and in the app, so they always match checkout. `PLAN_PRICES` in `planCatalog.ts` is only the fallback for a build without Clerk. Change prices in the Clerk dashboard, nowhere else. Clerk answers a period that is not offered with amount 0: `priceForPeriod` treats that as "not bookable".
- Clerk texts are German (`@clerk/localizations`, [frontend/utils/clerkLocalization.ts](frontend/utils/clerkLocalization.ts:1)); the checkout buttons say "Zahlungspflichtig abonnieren" (§ 312j BGB).
- Impressum, Datenschutz, AGB/Widerruf: [frontend/screens/Legal/](frontend/screens/Legal/). Operator details go into `legalInfo.ts`; the footer links stay hidden until they are complete. Keep the processor list in `LegalPage.tsx` in sync when a provider is added.
- Fonts are self-hosted via `@fontsource/*` (`frontend/styles/fonts.ts` and `@import` in screen CSS). Never load Google Fonts or other third-party assets from the browser (GDPR, LG München I 3 O 17493/20).

### Game Voices and Sound Effects (ElevenLabs) — any agent can generate them

The game "Mitternachts-Alibi" (`frontend/screens/Game/alibi/`) plays pre-generated MP3s from `frontend/public/game/alibi/voices/<id>.mp3`, listed in `voices/manifest.json`. Missing clips fall back to the browser voice, so new lines must be generated and committed. Tools: `scripts/game-voices/` (full guide in its `README.md`).

**Key:** `ELEVENLABS_API_KEY` in `.env.local` (git-ignored). The scripts read it automatically; fallback is the Railway variable of service "backend 2" (production) via `railway variables`. Never print, log or commit the key.

**Add or change a spoken line:**
1. Text for the game (caption + browser fallback): `frontend/screens/Game/alibi/data/content-data.ts` → `KOM` (Kommissar Tavi) or `WHISPER` (secret phone, ids `w.*`). Character lines live in `data/characters.ts` (`intro`, `stmt`, `deny`, `confess`, `smug`, `witness`).
2. Same id in `docs/games/mitternachts-alibi-v2/Stimmen.json`: `{ "filename": "<id>.mp3", "voice": "Kommissar Tavi", "kind": "tavi" | "flüstern" | "figur", "prio": 1, "text": "…", "eleven": "[calm, measured] …" }`. `eleven` is the text sent to ElevenLabs with audio tags in square brackets (`[whispers]` for whisper clips, emotions like `[dramatic]`, `[playful, warm]`). For `kind: "figur"` the tags come from `scripts/game-voices/casting.mjs` (voice + persona per character).
3. Generate only what changed (hash of voice + text, resumable):
   ```bash
   bun scripts/game-voices/generate.mjs --prio 3 --dry        # plan + characters + cost estimate
   bun scripts/game-voices/generate.mjs --prio 3              # all missing/changed clips
   bun scripts/game-voices/generate.mjs --ids kom.x,w.y --force --seed 7   # redo single clips (other take)
   ```
4. Sound effects: prompt in `docs/games/mitternachts-alibi-v2/Effekte.json` (or `EXTRA` in `scripts/game-voices/sfx.mjs`), then `bun scripts/game-voices/sfx.mjs` (`--only fx.name --force` to redo). Play in code with `director.sfx(...)` / `{ fx: "fx.name" }`.
5. Check: `bun scripts/game-voices/verify.mjs --loudness` (missing ids, tempo, loudness). Optional listening check without ears: `scripts/game-voices/check-transcripts.py` (local faster-whisper) flags spoken tags and swallowed or repeated sentences; re-roll those with `--force --seed N`.
6. Commit the new MP3s and `manifest.json` together with the text changes.

Facts: model `eleven_v4` (fallback `eleven_v3`); Tavi always uses the audio-doku voice `8tJgFGd1nr7H5KLTvjjt`; ffmpeg normalizes to −19 LUFS speech / −23 effects / −34 ambience, mono 64 kbit/s. Audio tags count as billed characters. The key cannot read the account balance (`user_read` missing); `generate.mjs` stops cleanly when credits run out.

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
