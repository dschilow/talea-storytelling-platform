# Talea Storytelling Platform - Projekt-Zusammenfassung

**Version:** 2025-01-13
**Zweck:** Schnelle Referenz für Entwicklungsarbeit

---

## 🎯 Projekt-Übersicht

**Talea** ist eine KI-gestützte Storytelling-Plattform, auf der Avatare mit sich entwickelnden Persönlichkeiten einzigartige, personalisierte Geschichten und Lerninhalte erleben.

**Kernfeatures:**
- 🎭 **Avatar-System** mit 9 hierarchischen Persönlichkeitsmerkmalen
- 📖 **KI-Story-Generierung** mit 4-Phasen-Orchestrator
- 📚 **Bildungs-Dokus** im Galileo/Checker-Tobi-Stil
- 🧚 **Märchen-System** mit Rollen-Mapping
- 🧠 **Memory-System** mit Cooldown für realistische Charakterentwicklung
- 🎨 **KI-Bildgenerierung** mit Vision QA für Konsistenz

---

## 🏗️ Architektur

### Tech Stack

**Backend:**
- **Encore.ts** - TypeScript Backend-Framework (Microservices)
- **PostgreSQL** - 11 separate Datenbanken (eine pro Service)
- **OpenAI GPT** - Story/Doku-Generierung, Analyse (gpt-5-mini/gpt-5/gpt-5-pro)
- **Runware API** - Bildgenerierung (Flux-Modelle)
- **Clerk** - Authentifizierung

**Frontend:**
- **React 18** + TypeScript
- **Redux Toolkit** - State Management
- **Tailwind CSS v4** - Styling
- **React Router** - Navigation
- **Framer Motion** - Animationen
- **shadcn/ui** - UI-Komponenten

**Package Manager:** **Bun** (erforderlich!)

**Deployment:** Railway (Backend + Frontend)

---

## 📁 Backend-Services (11 Microservices)

### 1. Avatar Service
**Pfad:** `/backend/avatar/`

**Hauptfunktionen:**
- Avatar CRUD (Create, Read, Update, Delete)
- **Persönlichkeits-Updates** via `updatePersonality.ts` ⭐
- **Memory-Management** (Erinnerungen an Stories/Dokus)
- **Auto-Trait-Upgrade** via `upgradePersonalityTraits.ts`
- Read-Tracking (verhindert doppelte Entwicklungen)

**Datenbank-Tabellen:**
- `avatars` - Avatar-Stammdaten
- `avatar_memories` - Erinnerungen mit emotionalem Impact
- `avatar_story_read` - Story-Lesehistorie (UNIQUE constraint)
- `avatar_doku_read` - Doku-Lesehistorie (UNIQUE constraint)

**Wichtige Endpoints:**
```typescript
POST /avatar                    // Avatar erstellen
GET /avatar/:id                 // Avatar abrufen
POST /avatar/personality        // Persönlichkeit updaten ⭐
POST /avatar/memory             // Memory hinzufügen
GET /avatar/:id/memories        // Memories abrufen
POST /avatar/upgrade-traits     // Alle Avatare upgraden
```

**Besonderheiten:**
- **9 Basis-Traits** (alle starten bei 0): knowledge, creativity, vocabulary, courage, curiosity, teamwork, empathy, persistence, logic
- **Hierarchische Traits:** knowledge hat Subcategories (z.B. knowledge.biology)
- **Auto-Upgrade on Read:** Stellt sicher, dass alle Avatare das aktuelle Schema haben

---

### 2. Story Service
**Pfad:** `/backend/story/`

**Hauptfunktionen:**
- **Story-Generierung** mit 4-Phasen-System (FourPhaseOrchestrator)
- **Character Pool Management** (wiederverwendbare Supporting Characters)
- **Avatar-Entwicklung** nach Story-Abschluss
- **Image Generation** mit Vision QA
- **Cost Tracking** via Pub/Sub

**Datenbank-Tabellen:**
- `stories` - Story-Stammdaten (config als JSON)
- `chapters` - Story-Kapitel mit Bildern
- `character_pool` - Supporting Characters mit Usage-Tracking
- `story_characters` - Character-Usage pro Story
- `story_skeletons` - Phase-1-Output (temporär)

**4-Phasen-Orchestrator:**
```
Phase 1: Skeleton Generation
  → AI erstellt Story-Struktur mit Platzhaltern

Phase 2: Character Matching
  → Character Pool matched mit Requirements
  → Platzhalter ersetzt mit konkreten Characters

Phase 3: Story Finalization
  → AI füllt finale Details
  → Generiert avatarDevelopments (Trait-Änderungen)

Phase 4: Image Generation
  → Cover + Chapter-Bilder (parallel)
  → Vision QA für Konsistenz
```

**Wichtige Endpoints:**
```typescript
POST /story/generate                    // Story generieren ⭐
POST /story/generate-from-fairytale     // Story aus Märchen
GET /story/:id                          // Story abrufen
GET /story/character-pool               // Character Pool
```

**Besonderheiten:**
- **Alle User-Avatare** werden nach Story entwickelt (Teilnehmer 100%, Leser 50%)
- **Memory Categorization:** acute (kein Cooldown), thematic (24h), personality (72h)
- **Vision QA** prüft Bild-Konsistenz mit Avatar-Beschreibungen

---

### 3. Doku Service
**Pfad:** `/backend/doku/`

**Hauptfunktionen:**
- **Bildungs-Artikel** generieren (Galileo/Checker-Tobi-Stil)
- **Wissens-Trait-Updates** (primär knowledge.* Subcategories)
- **Interaktive Elemente** (Quiz, Aktivitäten)

**Datenbank-Tabellen:**
- `dokus` - Doku-Stammdaten (content als JSON mit Sections)

**Doku-Struktur:**
```typescript
{
  sections: [
    {
      title: string,
      content: string,  // Markdown
      keyFacts: string[],
      imageIdea?: string,
      interactive?: {
        quiz?: { questions, answers },
        activities?: { experiments, projects }
      }
    }
  ]
}
```

**Wichtige Endpoints:**
```typescript
POST /doku/generate         // Doku generieren
GET /doku/:id              // Doku abrufen
POST /doku/:id/mark-read   // Als gelesen markieren ⭐
```

**Besonderheiten:**
- **Topic → Knowledge Mapping:** "Tiere" → knowledge.biology, "Planeten" → knowledge.astronomy
- **Punkte-Berechnung:** Basis 2, +1 für standard depth, +2 für deep, +1 für long
- **Duplicate Prevention:** `avatar_doku_read` verhindert mehrfache Updates

---

### 4. AI Service
**Pfad:** `/backend/ai/`

**Hauptfunktionen:**
- **Avatar-Bild-Generierung** (Runware API)
- **Persönlichkeits-Analyse** (OpenAI)
- **Foto-Analyse** mit Vision (Visual Profile Extraktion)
- **Übersetzung** (Deutsch ↔ Englisch)

**Keine eigene Datenbank** (Stateless Service)

**Wichtige Endpoints:**
```typescript
POST /ai/generate-avatar      // Avatar-Bild generieren
POST /ai/analyze-personality  // Trait-Analyse nach Story/Doku
POST /ai/analyze-avatar       // Foto → Visual Profile ⭐
POST /ai/translate            // Text übersetzen
```

**Modelle:**
- Story Generation: gpt-5-mini / gpt-5 / gpt-5-pro
- Avatar Analysis: gpt-5-mini
- Image Generation: Runware (flux-1.1-pro)

---

### 5. Fairytales Service
**Pfad:** `/backend/fairytales/`

**Hauptfunktionen:**
- **Märchen-Katalog** (Grimm, Andersen, etc.)
- **Rollen-Mapping** (User-Avatare → Märchen-Rollen)
- **Szenen-Templates** mit Platzhaltern

**Datenbank-Tabellen:**
- `fairy_tales` - Märchen-Katalog
- `fairy_tale_roles` - Rollen-Definitionen pro Märchen
- `fairy_tale_scenes` - Szenen-Templates mit [PLATZHALTERN]
- `generated_stories` - Generierte personalisierte Stories
- `generated_story_scenes` - Szenen mit Bildern
- `fairy_tale_usage_stats` - Analytics

**Vorgefertigte Märchen:**
- grimm-015: Hänsel und Gretel (9 Szenen)
- grimm-026: Rotkäppchen (6 Szenen)
- grimm-027: Bremer Stadtmusikanten

---

### 6. User Service
**Pfad:** `/backend/user/`

**Subscription-Tiers:**
- **starter** - Basis
- **familie** - Mehrere Benutzer
- **premium** - Alle Features

---

### 7. Admin Service
**Pfad:** `/backend/admin/`

**Hauptfunktionen:**
- User-Verwaltung
- Avatar-Statistiken
- Story-Übersicht

**Authorization:** Nur für User mit `role = "admin"`

---

### 8. Tavi Service (KI-Chat-Assistent)
**Pfad:** `/backend/tavi/`

**Persönlichkeit:**
- Magisches Geschichten-Genie 🧞‍♂️
- Freundlich, hilfsbereit
- Spricht Deutsch mit Emojis

**Limits:**
- Max 50 Wörter pro Anfrage
- Max 4000 Completion Tokens
- gpt-5-mini Modell

---

### 9. Log Service
**Pfad:** `/backend/log/`

**Hauptfunktionen:**
- **Zentralisiertes Logging** via Pub/Sub
- **Cost Tracking** (Token-Usage → USD)
- **Performance Monitoring**

**Datenbank-Tabellen:**
- `logs` (in verschiedenen Service-DBs)

**Log-Sources:**
- `openai-story-generation`
- `runware-single-image` / `runware-batch-image`
- `phase1-skeleton-generation`, `phase2-character-matching`, etc.

---

### 10. Health Service
**Pfad:** `/backend/health/`

**Hauptfunktionen:**
- **Auto-Migration** on Startup
- Health-Checks für alle DBs
- Fairy Tales Setup

**Wichtig:** Migrations laufen automatisch beim Start via `init-migrations.ts`

---

### 11. Frontend Service
**Pfad:** `/backend/frontend/`

**Funktionalität:**
- Serviert statische React-App aus `./dist`
- SPA-Routing (404 → index.html)

---

## 📁 Frontend-Struktur

### Screens (Hauptansichten)

**Avatar Management:**
- `AvatarsScreen.tsx` - Übersicht
- `AvatarWizardScreen.tsx` - Wizard für Erstellung
- `AvatarDetailScreen.tsx` - Detailansicht
- `EditAvatarScreen.tsx` - Bearbeitung

**Story Management:**
- `StoriesScreen.tsx` - Übersicht
- `ModernStoryWizard.tsx` - Story-Wizard ⭐
- `StoryScrollReaderScreen.tsx` - Lesemodus ⭐
- `FairyTaleSelectionScreen.tsx` - Märchen-Auswahl

**Doku Management:**
- `DokusScreen.tsx` - Übersicht
- `DokuWizardScreen.tsx` - Doku-Wizard
- `DokuScrollReaderScreen.tsx` - Lesemodus

**Weitere:**
- `HomeScreen.tsx` / `ModernHomeScreen.tsx` - Dashboard
- `CharacterPoolScreen.tsx` - Charakterpool
- `LogViewerScreen.tsx` - Logs (Dev)
- `AdminDashboard.tsx` - Admin-Panel

---

### Components (Wiederverwendbare Komponenten)

**Card Components:**
- `AvatarCard.tsx`, `StoryCard.tsx`, `DokuCard.tsx`
- Varianten: Animated, Playful

**Drawer Components:**
- `AvatarWizardDrawer.tsx`, `StoryWizardDrawer.tsx`, `DokuWizardDrawer.tsx`
- Config-Drawers für Konfiguration

**Common Components:**
- `TaviButton.tsx` + `TaviChat.tsx` - KI-Assistent
- `HierarchicalTraitDisplay.tsx` - Trait-Anzeige
- `PersonalityDevelopment.tsx` - Entwicklungs-Visualisierung

**UI Components (shadcn/ui):**
- `responsive-drawer.tsx` (Desktop: Dialog, Mobile: Drawer)
- `button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, etc.

---

### State Management (Redux Toolkit)

**Store:** `frontend/store/store.ts`

**Slices:**
1. **avatarSlice** (`store/slices/avatarSlice.ts`)
   ```typescript
   {
     avatars: Avatar[],
     currentAvatar: Avatar | null,
     loading: boolean,
     error: string | null
   }
   ```

2. **storySlice** (`store/slices/storySlice.ts`)
   ```typescript
   {
     stories: Story[],
     currentStory: Story | null,
     loading: boolean,
     error: string | null
   }
   ```

---

### Custom Hooks

**Backend Integration:**
- `useBackend.ts` - Zentrale Hook für API-Calls (mit Clerk Token)

**Personality System:**
- `usePersonalityAI.ts` - KI-Analyse nach Stories/Dokus/Quiz
- `useAvatarMemory.ts` - Memory-Management

**UI:**
- `use-media-query.ts` - Responsive Queries

---

### Navigation

**Bottom Navigation Bar:**
1. Home (/)
2. Avatare (/avatar)
3. Stories (/stories)
4. Doku (/doku)
5. Charaktere (/characters)
6. Logs (/logs)

**Wichtige Routen:**
```
/                           → HomeScreen
/avatar                     → AvatarsScreen
/avatar/create              → AvatarWizardScreen
/avatar/:avatarId           → AvatarDetailScreen
/story                      → ModernStoryWizard
/story-reader/:storyId      → StoryScrollReaderScreen
/stories                    → StoriesScreen
/doku                       → DokusScreen
/doku-reader/:dokuId        → DokuScrollReaderScreen
/characters                 → CharacterPoolScreen
/logs                       → LogViewerScreen
/_admin                     → AdminDashboard (nur Admins)
```

---

## 🎭 Persönlichkeitssystem (KRITISCH!)

### 9 Basis-Traits

**Alle Avatare starten bei 0, Max: 100 (knowledge: 1000)**

1. **knowledge** 🧠 - Hierarchisch mit Subcategories (max 1000)
2. **creativity** 🎨
3. **vocabulary** 🔤
4. **courage** 🦁
5. **curiosity** 🔍
6. **teamwork** 🤝
7. **empathy** 💗
8. **persistence** 🧗
9. **logic** 🔢

### Hierarchisches System

**Knowledge-Struktur:**
```typescript
{
  "knowledge": {
    "value": 50,  // Summe aller Subcategories
    "subcategories": {
      "biology": 20,
      "physics": 30
    }
  },
  "courage": { "value": 15 },
  // ... andere Traits
}
```

**Subcategories (Beispiele):**
- `knowledge.biology`, `knowledge.physics`, `knowledge.astronomy`
- `knowledge.history`, `knowledge.mathematics`, `knowledge.chemistry`

### Trait-Updates

**File:** `backend/avatar/updatePersonality.ts`

**Prozess:**
1. Load Avatar
2. Auto-Upgrade Traits (`upgradePersonalityTraits()`)
3. Apply Changes:
   - Basis-Traits: Direktes Update (z.B. `courage: +2`)
   - Knowledge Subcategories: Erstelle falls nicht vorhanden (z.B. `knowledge.biology: +5`)
   - Automatische Summierung für knowledge.value
4. Bounds-Checking (0-100 für Basis, 0-1000 für knowledge.*)
5. Speichern

**Wichtig:**
- Jedes Update benötigt `description` (Begründung)
- Subcategories werden nur bei Bedarf erstellt
- Auto-Upgrade on Read stellt Konsistenz sicher

---

## 📖 Story-Generation-Flow

**File:** `backend/story/generate.ts`

### Komplett-Ablauf

```
1. User Request (StoryConfig)
   ↓
2. Create Story Record (status: "generating")
   ↓
3. Load Avatar Details + Auto-Upgrade Traits
   ↓
4. [4-Phase Character Pool] (Standard)
   │
   ├─ Phase 1: Skeleton Generation
   │  → AI erstellt Story-Struktur mit [PLATZHALTERN]
   │
   ├─ Phase 2: Character Matching
   │  → Character Pool matched Requirements
   │  → Ersetze Platzhalter mit konkreten Characters
   │
   ├─ Phase 3: Story Finalization
   │  → AI füllt finale Details
   │  → Generiert avatarDevelopments (Trait-Änderungen)
   │
   └─ Phase 4: Image Generation
      → Cover + Chapter-Bilder (parallel)
      → Vision QA für Konsistenz
   ↓
5. Validate Avatar Developments (MCP)
   ↓
6. Cost Tracking (Log via Pub/Sub)
   ↓
7. Persist Story + Chapters
   ↓
8. Apply Personality Updates zu ALLEN User-Avataren
   - Teilnehmer: 100% Punkte
   - Leser: 50% Punkte
   ↓
9. Memory Categorization + Cooldown Check
   - acute (kein Cooldown)
   - thematic (24h Cooldown)
   - personality (72h Cooldown)
   ↓
10. Update Each Avatar + Add Memory
    ↓
11. Return Complete Story
```

### StoryConfig (Wichtige Parameter)

```typescript
{
  avatarIds: string[];
  genre: string;           // z.B. "Abenteuer", "Fantasy"
  setting: string;         // z.B. "Magischer Wald"
  length: "short" | "medium" | "long";
  complexity: "simple" | "medium" | "complex";
  ageGroup: "3-5" | "6-8" | "9-12" | "13+";
  learningMode?: {
    enabled: boolean;
    subjects: string[];
    difficulty: string;
    objectives: string[];
  };
  stylePreset?: StylePresetKey;  // z.B. "grueffelo" (gereimt)
  aiModel?: AIModelOption;       // gpt-5-mini, gpt-5, gpt-5-pro
  useCharacterPool?: boolean;    // 4-Phase System aktivieren
}
```

---

## 🧠 Memory-System

**File:** `backend/story/memory-categorization.ts`

### 3 Memory-Kategorien

1. **Acute (Akut)**
   - Unmittelbare, lebhafte Erfahrungen
   - **Kein Cooldown**
   - Beispiel: "Ich habe heute einen Drachen gesehen!"

2. **Thematic (Thematisch)**
   - Wiederkehrende Muster
   - **24h Cooldown pro Trait**
   - Keywords: "wieder", "erneut", "wie damals"
   - Beispiel: "Wieder ein Abenteuer mit meinem Freund"

3. **Personality (Persönlichkeit)**
   - Signifikante Charakterentwicklung
   - **72h Cooldown pro Trait**
   - Kriterien: ≥5 Punkte Änderung ODER ≥3 Traits betroffen
   - Beispiel: "Lebensverändernde Erkenntnis"

### Cooldown-Enforcement

```typescript
const { allowedChanges, blockedChanges } =
  filterPersonalityChangesWithCooldown(category, changes, lastShifts);

// Nur allowedChanges werden angewendet
// blockedChanges werden geloggt mit verbleibenden Stunden
```

**Zweck:** Verhindert unrealistische Persönlichkeitssprünge

---

## 🔐 Authentication Flow (Clerk)

**File:** `backend/auth/auth.ts`

### Ablauf

```
1. Frontend Request mit Clerk Token
   ↓
2. Encore authHandler Middleware
   ↓
3. Clerk Token Verification
   - verifyToken() mit 120s Clock Skew
   ↓
4. Authorized Party Check
   - Whitelist: localhost, Railway, Leap.dev
   ↓
5. Fetch Clerk User Details
   ↓
6. Database User Sync
   - Create if not exists
   - Merge identities bei Email-Match
   ↓
7. Return AuthData
   {
     userID, email, imageUrl, role, clerkToken
   }
   ↓
8. Attach to Request Context
   - getAuthData() in Services verfügbar
```

### Identity Merging

Bei Email-Match:
- Update `user_id` in `avatars`, `stories`, `dokus`
- Preserve Admin-Role

---

## 📊 Logging & Monitoring

**File:** `backend/log/logger.ts`

### Pub/Sub mit Timeout-Protection

**KRITISCHES PATTERN:**

```typescript
// ✅ IMMER verwenden
await publishWithTimeout(logTopic, {
  source: 'openai-story-generation',
  timestamp: new Date(),
  request: { ... },
  response: { ... }
});

// ❌ NIEMALS direkt publishen (kann hängen)
await logTopic.publish(data);
```

**Timeout:** 2000ms (konfigurierbar)
**Verhalten:** Non-blocking, Fehler werden geloggt aber nicht geworfen

### Log-Sources

**AI Operations:**
- `openai-story-generation`
- `openai-avatar-analysis-stable`
- `runware-single-image` / `runware-batch-image`

**4-Phase System:**
- `phase1-skeleton-generation`
- `phase2-character-matching`
- `phase3-story-finalization`
- `phase4-image-generation`

**Was wird geloggt:**
- Token Usage (Input/Output/Total)
- USD Costs
- Processing Time
- Full Request/Response Payloads

---

## 🛠️ Entwicklungs-Befehle

### Backend starten

```bash
# From project root
encore run

# Backend läuft auf http://localhost:4000
```

### Frontend starten

```bash
cd frontend
bun run dev

# Frontend läuft auf http://localhost:5173
```

### Frontend Client generieren

```bash
cd backend
encore gen client --target leap

# Generiert frontend/client.ts
# Nach Backend-API-Änderungen IMMER ausführen!
```

### Testing

```bash
# Alle Tests
encore test

# Spezifischer Service
encore test ./avatar
```

### Database

```bash
# DB Shell für Service
encore db shell avatar

# Migrations laufen automatisch beim Start!
```

### Build

```bash
cd backend
bun run build  # Baut auch Frontend in backend/frontend/dist
```

---

## 🚨 Wichtige Patterns & Best Practices

### 1. Immer publishWithTimeout verwenden

```typescript
// ✅ CORRECT
await publishWithTimeout(logTopic, data);

// ❌ WRONG
await logTopic.publish(data);
```

### 2. Trait-Updates mit Description

```typescript
// ✅ CORRECT
await updatePersonality({
  avatarId,
  changes: [
    {
      trait: "courage",
      change: 3,
      description: "Faced fear and helped friend"
    }
  ]
});

// ❌ WRONG - Fehlt Description
await updatePersonality({
  avatarId,
  changes: [{ trait: "courage", change: 3 }]
});
```

### 3. Auto-Upgrade Traits on Read

```typescript
// ✅ CORRECT
const rawTraits = JSON.parse(avatar.personality_traits);
const upgradedTraits = upgradePersonalityTraits(rawTraits);

// ❌ WRONG - Fehlende Traits verursachen Fehler
const traits = JSON.parse(avatar.personality_traits);
```

### 4. Duplicate Prevention prüfen

```typescript
// ✅ CORRECT
const alreadyRead = await db.queryRow`
  SELECT id FROM avatar_story_read
  WHERE avatar_id = ${avatarId} AND story_id = ${storyId}
`;

if (alreadyRead) {
  console.log('Already processed - skipping update');
  return;
}
```

### 5. Alle User-Avatare nach Story updaten

```typescript
// ✅ CORRECT
const allUserAvatars = await getAllAvatarsForUser(userId);

for (const avatar of allUserAvatars) {
  const isParticipant = participantIds.includes(avatar.id);
  const multiplier = isParticipant ? 1.0 : 0.5;

  const scaledChanges = changes.map(c => ({
    ...c,
    change: Math.round(c.change * multiplier)
  }));

  await updatePersonality({ avatarId: avatar.id, changes: scaledChanges });
}

// ❌ WRONG - Nur Teilnehmer updaten
for (const avatarId of config.avatarIds) {
  await updatePersonality({ avatarId, changes });
}
```

### 6. Memory Cooldown enforcement

```typescript
// ✅ CORRECT
const structuredMemory = createStructuredMemory(...);
const { allowedChanges, blockedChanges } =
  filterPersonalityChangesWithCooldown(
    structuredMemory.category,
    changes,
    lastShifts
  );

await updatePersonality({ changes: allowedChanges });

// ❌ WRONG - Bypassed Cooldown
await updatePersonality({ changes: allChanges });
```

### 7. Bun verwenden (nicht npm/yarn)

```bash
# ✅ CORRECT
bun install
bun run dev

# ❌ WRONG
npm install
npm run dev
```

### 8. Frontend Client nach API-Änderungen neu generieren

```bash
# Nach Änderungen in backend/
cd backend
encore gen client --target leap

# frontend/client.ts wird aktualisiert
```

---

## 🔑 Wichtige Dateipfade

### Backend

**Konstanten & Helpers:**
- `backend/constants/personalityTraits.ts` - Trait-Definitionen ⭐
- `backend/helpers/pubsubTimeout.ts` - Pub/Sub Safety
- `backend/helpers/mcpClient.ts` - MCP Integration

**Avatar Service:**
- `backend/avatar/updatePersonality.ts` - Trait-Updates ⭐
- `backend/avatar/upgradePersonalityTraits.ts` - Schema-Migration
- `backend/avatar/addMemory.ts` - Memory hinzufügen
- `backend/avatar/getMemories.ts` - Memory abrufen

**Story Service:**
- `backend/story/generate.ts` - Haupt-Generierung ⭐
- `backend/story/four-phase-orchestrator.ts` - 4-Phase-System
- `backend/story/memory-categorization.ts` - Cooldown-System ⭐
- `backend/story/traitMapping.ts` - Trait-ID-Validierung
- `backend/story/vision-qa.ts` - Bild-QA

**Doku Service:**
- `backend/doku/generate.ts` - Doku-Generierung
- `backend/doku/markRead.ts` - Read-Tracking

**AI Service:**
- `backend/ai/analyze-avatar.ts` - Foto-Analyse (Visual Profile)
- `backend/ai/analyze-personality.ts` - Trait-Analyse
- `backend/ai/avatar-generation.ts` - Bild-Generierung

**Auth:**
- `backend/auth/auth.ts` - Clerk Integration ⭐

**Health:**
- `backend/health/init-migrations.ts` - Auto-Migrations

### Frontend

**Screens:**
- `frontend/screens/Home/ModernHomeScreen.tsx`
- `frontend/screens/Avatar/AvatarWizardScreen.tsx`
- `frontend/screens/Story/ModernStoryWizard.tsx`
- `frontend/screens/Story/StoryScrollReaderScreen.tsx`

**Components:**
- `frontend/components/Common/TaviButton.tsx` + `TaviChat.tsx`
- `frontend/components/Common/HierarchicalTraitDisplay.tsx`
- `frontend/components/Drawer/AvatarWizardDrawer.tsx`

**Hooks:**
- `frontend/hooks/useBackend.ts` - API Integration
- `frontend/hooks/usePersonalityAI.ts` - Trait-Analyse
- `frontend/hooks/useAvatarMemory.ts` - Memory-Management

**Store:**
- `frontend/store/store.ts` - Redux Store
- `frontend/store/slices/avatarSlice.ts`
- `frontend/store/slices/storySlice.ts`

**Auto-Generated:**
- `frontend/client.ts` - Encore Client (nicht manuell bearbeiten!)

---

## 🌐 Environment Variables

### Backend (Encore Secrets)

```bash
ClerkSecretKey=sk_test_...
OpenAIKey=sk-...
RunwareApiKey=...
MCPServerAPIKey=...
```

**Setzen via:** Encore Dashboard oder `encore.dev/config`

### Frontend (.env)

```bash
VITE_BACKEND_URL=https://your-backend.up.railway.app
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

---

## 🚀 Deployment

**Platform:** Railway

**Auto-Deployment:**
- GitHub Actions baut Docker Images
- Frontend direkt deployed
- Migrations laufen automatisch beim Start

**Wichtig:** Keine manuellen Migration-Steps nötig!

---

## 🎨 Design-System

### Farben

**Primary Colors:**
- primary (Pink/Rosa)
- lavender (Lila)
- mint (Türkis)
- peach (Pfirsich)

**Gradienten:**
- primary, lavender, sunset, ocean, warm, cool

**Glassmorphismus:**
```typescript
{
  background: 'rgba(255, 255, 255, 0.65)',
  border: 'rgba(255, 255, 255, 0.3)',
  shadow: '0 8px 32px rgba(169, 137, 242, 0.15)'
}
```

### Typografie

**Schriftarten:**
- **Nunito** - Body (300, 400, 600, 700, 800)
- **Fredoka** - Headlines (400, 500, 600, 700)

### UI-Patterns

**Wizard-Pattern:**
- Multi-Step-Formulare in Drawers
- Stepper-Navigation
- Validierung pro Step

**Responsive Drawer:**
- Desktop: Full-Screen Dialog (max 600px)
- Mobile: Bottom Drawer (max 85vh)

**Card-Varianten:**
- solid, glass, outline, fun, playful

---

## 📈 Service-Dependencies

```
Frontend
  ↓ (Clerk Token)
Auth Gateway
  ↓
├─→ Avatar ──→ MCP (Main & Validator)
├─→ Story ───→ Avatar, AI, Log, MCP
├─→ Doku ────→ Avatar, AI, Log
├─→ AI ──────→ Log
├─→ Fairytales → Avatar, AI, Story
├─→ Admin ───→ User, Avatar, Story (via SQLDatabase.named)
└─→ Tavi ────→ AI, Log
```

---

## 🔍 Häufige Entwicklungs-Tasks

### Neue Personality Trait hinzufügen

1. Ergänze in `backend/constants/personalityTraits.ts`
2. Update `upgradePersonalityTraits()` für Migration
3. Update Frontend `HierarchicalTraitDisplay.tsx`

### Neue Story-Genre hinzufügen

1. Ergänze in `backend/story/generate.ts` (GenreType)
2. Update Story-Wizard in Frontend
3. Update AI-Prompts für Genre-spezifische Generation

### Neuen MCP-Endpoint hinzufügen

1. Ergänze in `backend/helpers/mcpClient.ts`
2. Update MCP-Server-Implementierung
3. Update Caller-Services (z.B. Story, Avatar)

### Neue Migration hinzufügen

1. Erstelle `X_name.up.sql` und `X_name.down.sql` in `backend/{service}/migrations/`
2. Inkrementiere Nummer (nächste freie)
3. Restart Backend → Auto-Migration läuft

### Frontend Client aktualisieren

```bash
cd backend
encore gen client --target leap

# frontend/client.ts wird neu generiert
```

---

## 🐛 Troubleshooting

### Pub/Sub hängt

**Symptom:** Service friert ein nach Pub/Sub-Call

**Fix:** Verwende `publishWithTimeout()` statt direktem `publish()`

```typescript
// ✅ Mit Timeout
await publishWithTimeout(logTopic, data);
```

### Trait-Updates funktionieren nicht

**Symptom:** Traits bleiben bei 0

**Check:**
1. Trait-ID korrekt? (siehe `personalityTraits.ts`)
2. `description` vorhanden?
3. `upgradePersonalityTraits()` läuft?

```typescript
// Prüfe Trait-IDs
const validIds = [
  "knowledge", "creativity", "vocabulary", "courage",
  "curiosity", "teamwork", "empathy", "persistence", "logic"
];
```

### Doppelte Personality-Updates

**Symptom:** Avatar erhält mehrfache Updates für gleiche Story

**Check:** Read-Tracking

```sql
SELECT * FROM avatar_story_read
WHERE avatar_id = '...' AND story_id = '...';
```

**Fix:** Ensure `markRead()` vor `updatePersonality()`

### Frontend kann Backend nicht erreichen

**Check:**
1. `VITE_BACKEND_URL` korrekt in `.env`?
2. Backend läuft? (`encore run`)
3. CORS-Settings in Encore?

### Clerk Auth fehlschlägt

**Check:**
1. `ClerkSecretKey` korrekt?
2. Token im Authorization Header?
3. Authorized Party in Whitelist?

```typescript
// Prüfe in backend/auth/auth.ts
const allowedAzps = [
  'http://localhost:5173',
  'https://staging-p-xxx.up.railway.app',
  // ...
];
```

---

## 📚 Weitere Dokumentation

**Im Repository:**
- `README.md` - Projekt-Übersicht
- `DEVELOPMENT.md` - Deployment-Guide
- `TESTING_GUIDE.md` - Testing-Guide
- `CLAUDE.md` - Claude-spezifische Anweisungen

**Externe Docs:**
- Encore.ts: https://encore.dev/docs
- Clerk: https://clerk.com/docs
- OpenAI: https://platform.openai.com/docs
- Runware: https://docs.runware.ai

---

## ✅ Checkliste für neue Features

- [ ] Backend-Endpoint erstellen/ändern
- [ ] Datenbank-Migration (falls nötig)
- [ ] Trait-System berücksichtigen (falls relevant)
- [ ] Memory-System integrieren (falls Personality-Updates)
- [ ] Cooldown-System beachten
- [ ] publishWithTimeout für Logging
- [ ] MCP-Validator für Trait-Updates
- [ ] Frontend Client neu generieren (`encore gen client`)
- [ ] Redux State updaten (falls nötig)
- [ ] UI-Komponenten erstellen/anpassen
- [ ] Responsive Design prüfen
- [ ] Error-Handling implementieren
- [ ] Tests schreiben (`encore test`)
- [ ] Dokumentation updaten

---

**Ende der Zusammenfassung**

Diese Referenz sollte dir ermöglichen, schnell wieder in das Projekt einzusteigen und alle wichtigen Aspekte im Blick zu haben. 🚀
