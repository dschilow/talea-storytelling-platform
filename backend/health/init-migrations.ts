import { api } from "encore.dev/api";

let migrationsRun = false;
let numberedMigrationFilesRunThisBoot = false;

// All migration SQL statements - executed in order
const MIGRATION_STATEMENTS = [
  // 1. Users table
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    subscription TEXT NOT NULL DEFAULT 'free',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  
  // 2. Add role to users
  `DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='role') THEN
      ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
    END IF;
  END $$`,
  
  // 3. Avatars table
  `CREATE TABLE IF NOT EXISTS avatars (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    physical_traits TEXT NOT NULL,
    personality_traits TEXT NOT NULL,
    image_url TEXT,
    creation_type TEXT NOT NULL CHECK (creation_type IN ('ai-generated', 'photo-upload')),
    is_public BOOLEAN NOT NULL DEFAULT false,
    original_avatar_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_avatars_user_id ON avatars(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_avatars_public ON avatars(is_public)`,
  `CREATE INDEX IF NOT EXISTS idx_avatars_original ON avatars(original_avatar_id)`,
  
  // 4. Add visual_profile to avatars
  `DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avatars' AND column_name='visual_profile') THEN
      ALTER TABLE avatars ADD COLUMN visual_profile TEXT;
    END IF;
  END $$`,
  
  // 5. Avatar memories
  `CREATE TABLE IF NOT EXISTS avatar_memories (
    id TEXT PRIMARY KEY,
    avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('experience', 'relationship', 'fact', 'emotion')),
    content TEXT NOT NULL,
    importance INTEGER NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_memories_avatar_id ON avatar_memories(avatar_id)`,
  `CREATE INDEX IF NOT EXISTS idx_memories_type ON avatar_memories(memory_type)`,
  `CREATE INDEX IF NOT EXISTS idx_memories_importance ON avatar_memories(importance DESC)`,
  
  // 6. Add knowledge_traits to avatars
  `DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avatars' AND column_name='knowledge_traits') THEN
      ALTER TABLE avatars ADD COLUMN knowledge_traits TEXT;
    END IF;
  END $$`,
  
  // 7. Stories table
  `CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    cover_image_url TEXT,
    config TEXT NOT NULL,
    metadata TEXT,
    status TEXT NOT NULL CHECK (status IN ('generating', 'complete', 'error')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    chapter_order INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status)`,
  `CREATE INDEX IF NOT EXISTS idx_chapters_story_id ON chapters(story_id)`,
  `CREATE INDEX IF NOT EXISTS idx_chapters_order ON chapters(story_id, chapter_order)`,
  
  // 8. Add is_public to stories
  `DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='stories' AND column_name='is_public') THEN
      ALTER TABLE stories ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;
    END IF;
  END $$`,
  
  // 9. Avatar developments (story related)
  `CREATE TABLE IF NOT EXISTS avatar_developments (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    chapter_id TEXT REFERENCES chapters(id) ON DELETE CASCADE,
    trait_name TEXT NOT NULL,
    old_value DECIMAL,
    new_value DECIMAL NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_developments_story ON avatar_developments(story_id)`,
  `CREATE INDEX IF NOT EXISTS idx_developments_avatar ON avatar_developments(avatar_id)`,
  `CREATE INDEX IF NOT EXISTS idx_developments_chapter ON avatar_developments(chapter_id)`,
  
  // 10. Dokus table
  `CREATE TABLE IF NOT EXISTS dokus (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    content JSONB NOT NULL,
    cover_image_url TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL CHECK (status IN ('generating', 'complete', 'error')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dokus_user_id ON dokus(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dokus_public ON dokus(is_public)`,
  
  // 11. Add metadata to dokus
  `DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='dokus' AND column_name='metadata') THEN
      ALTER TABLE dokus ADD COLUMN metadata JSONB;
    END IF;
  END $$`,

  // 12. Audio dokus table
  `CREATE TABLE IF NOT EXISTS audio_dokus (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    age_group TEXT,
    category TEXT,
    cover_description TEXT,
    cover_image_url TEXT,
    audio_url TEXT NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audio_dokus_user_id ON audio_dokus(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audio_dokus_public ON audio_dokus(is_public)`,
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='audio_dokus' AND column_name='age_group') THEN
      ALTER TABLE audio_dokus ADD COLUMN age_group TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='audio_dokus' AND column_name='category') THEN
      ALTER TABLE audio_dokus ADD COLUMN category TEXT;
    END IF;
  END $$`,
  
  // 13. Avatar doku read tracking
  `CREATE TABLE IF NOT EXISTS avatar_doku_read (
    avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    doku_id TEXT NOT NULL REFERENCES dokus(id) ON DELETE CASCADE,
    read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (avatar_id, doku_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_avatar_doku_avatar ON avatar_doku_read(avatar_id)`,
  `CREATE INDEX IF NOT EXISTS idx_avatar_doku_doku ON avatar_doku_read(doku_id)`,
  
  // 14. Avatar story read tracking
  `CREATE TABLE IF NOT EXISTS avatar_story_read (
    avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (avatar_id, story_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_avatar_story_avatar ON avatar_story_read(avatar_id)`,
  `CREATE INDEX IF NOT EXISTS idx_avatar_story_story ON avatar_story_read(story_id)`,
  
  // 15. AI personality tracking
  `CREATE TABLE IF NOT EXISTS personality_tracking (
    id TEXT PRIMARY KEY,
    avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('story_generation', 'doku_read', 'trait_update', 'memory_added')),
    context TEXT NOT NULL,
    personality_before TEXT NOT NULL,
    personality_after TEXT NOT NULL,
    changes JSONB NOT NULL,
    reasoning TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_personality_tracking_avatar ON personality_tracking(avatar_id)`,
  `CREATE INDEX IF NOT EXISTS idx_personality_tracking_type ON personality_tracking(event_type)`,
  `CREATE INDEX IF NOT EXISTS idx_personality_tracking_date ON personality_tracking(created_at DESC)`,

  // 16. Character pool for supporting story characters
  `CREATE TABLE IF NOT EXISTS character_pool (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    archetype TEXT NOT NULL,
    emotional_nature JSONB NOT NULL,
    visual_profile JSONB NOT NULL,
    image_url TEXT,
    max_screen_time INTEGER DEFAULT 50,
    available_chapters INTEGER[] DEFAULT '{1,2,3,4,5}',
    canon_settings TEXT[] DEFAULT '{}',
    recent_usage_count INTEGER DEFAULT 0,
    total_usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_character_pool_role ON character_pool(role)`,
  `CREATE INDEX IF NOT EXISTS idx_character_pool_archetype ON character_pool(archetype)`,
  `CREATE INDEX IF NOT EXISTS idx_character_pool_active ON character_pool(is_active)`,
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='character_pool' AND column_name='image_url') THEN
      ALTER TABLE character_pool ADD COLUMN image_url TEXT;
    END IF;
  END $$`,

  // 17. Story-character junction table
  `CREATE TABLE IF NOT EXISTS story_characters (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES character_pool(id),
    placeholder TEXT NOT NULL,
    chapters_appeared INTEGER[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_story_characters_story ON story_characters(story_id)`,
  `CREATE INDEX IF NOT EXISTS idx_story_characters_character ON story_characters(character_id)`,

  // 18. Story skeletons (Phase 1 output storage)
  `CREATE TABLE IF NOT EXISTS story_skeletons (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    title TEXT,
    chapters JSONB NOT NULL,
    supporting_character_requirements JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_story_skeletons_story ON story_skeletons(story_id)`,

  // 19. Add avatar_developments column to stories
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='stories' AND column_name='avatar_developments') THEN
      ALTER TABLE stories ADD COLUMN avatar_developments JSONB;
    END IF;
  END $$`,

  // 20. Monthly generation usage tracking
  `CREATE TABLE IF NOT EXISTS generation_usage (
    user_id TEXT NOT NULL,
    period_start DATE NOT NULL,
    story_count INTEGER NOT NULL DEFAULT 0,
    doku_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, period_start)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_generation_usage_user_period
    ON generation_usage(user_id, period_start)`,

  // 21. Talea Studio series
  `CREATE TABLE IF NOT EXISTS studio_series (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    logline TEXT,
    description TEXT,
    canonical_prompt TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_studio_series_user_id ON studio_series(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_studio_series_status ON studio_series(status)`,

  // 22. Talea Studio characters (series-scoped only)
  `CREATE TABLE IF NOT EXISTS studio_characters (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL REFERENCES studio_series(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    description TEXT,
    generation_prompt TEXT NOT NULL,
    image_prompt TEXT NOT NULL,
    visual_profile JSONB,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_studio_characters_series_id ON studio_characters(series_id)`,
  `CREATE INDEX IF NOT EXISTS idx_studio_characters_user_id ON studio_characters(user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_characters_series_name_unique ON studio_characters(series_id, lower(name))`,

  // 23. Talea Studio episodes
  `CREATE TABLE IF NOT EXISTS studio_episodes (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL REFERENCES studio_series(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    episode_number INTEGER NOT NULL CHECK (episode_number > 0),
    title TEXT NOT NULL,
    summary TEXT,
    story_text TEXT,
    approved_story_text TEXT,
    selected_character_ids TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'text_ready', 'text_approved', 'scenes_ready', 'images_ready', 'composed', 'published')),
    published_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id, series_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_studio_episodes_series_id ON studio_episodes(series_id)`,
  `CREATE INDEX IF NOT EXISTS idx_studio_episodes_user_id ON studio_episodes(user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_episodes_series_number_unique ON studio_episodes(series_id, episode_number)`,

  // 24. Talea Studio episode scenes
  `CREATE TABLE IF NOT EXISTS studio_episode_scenes (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    series_id TEXT NOT NULL,
    scene_order INTEGER NOT NULL CHECK (scene_order > 0),
    title TEXT NOT NULL,
    scene_text TEXT NOT NULL,
    participant_character_ids TEXT[] NOT NULL DEFAULT '{}',
    image_prompt TEXT,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (episode_id, series_id) REFERENCES studio_episodes(id, series_id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_studio_episode_scenes_episode_id ON studio_episode_scenes(episode_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_episode_scenes_episode_order_unique ON studio_episode_scenes(episode_id, scene_order)`,

  // 25. Metered AI usage (chat/image/tts quotas) - mirrors user/migrations/11_add_metered_ai_usage
  `CREATE TABLE IF NOT EXISTS metered_usage (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('chat', 'image', 'tts')),
    units BIGINT NOT NULL DEFAULT 0 CHECK (units >= 0),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, period_start, kind)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_metered_usage_user_period
    ON metered_usage(user_id, period_start)`,

  // 26. Artifact pool baseline (mirrors story/migrations/9_create_artifact_pool
  // + 12_add_artifact_pool_image) so fresh databases can hold the treasury.
  `CREATE TABLE IF NOT EXISTS artifact_pool (
    id TEXT PRIMARY KEY,
    name_de TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_de TEXT NOT NULL,
    description_en TEXT NOT NULL,
    category TEXT NOT NULL,
    rarity TEXT NOT NULL DEFAULT 'common',
    story_role TEXT NOT NULL,
    discovery_scenarios TEXT[] NOT NULL DEFAULT '{}',
    usage_scenarios TEXT[] NOT NULL DEFAULT '{}',
    emoji TEXT,
    visual_keywords TEXT[] NOT NULL DEFAULT '{}',
    genre_adventure DECIMAL(3,2) DEFAULT 0.5,
    genre_fantasy DECIMAL(3,2) DEFAULT 0.5,
    genre_mystery DECIMAL(3,2) DEFAULT 0.5,
    genre_nature DECIMAL(3,2) DEFAULT 0.5,
    genre_friendship DECIMAL(3,2) DEFAULT 0.5,
    genre_courage DECIMAL(3,2) DEFAULT 0.5,
    genre_learning DECIMAL(3,2) DEFAULT 0.5,
    recent_usage_count INTEGER DEFAULT 0,
    total_usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    last_used_in_story_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE artifact_pool ADD COLUMN IF NOT EXISTS image_url TEXT`,
  `CREATE TABLE IF NOT EXISTS story_artifacts (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    artifact_id TEXT NOT NULL REFERENCES artifact_pool(id),
    discovery_chapter INTEGER,
    usage_chapter INTEGER,
    is_unlocked BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 27. Artifact Treasury "Schatzkammer 2.0" - mirrors
  // story/migrations/41_artifact_treasury (sets, journal, shards, offers).
  `CREATE TABLE IF NOT EXISTS artifact_sets (
    id TEXT PRIMARY KEY,
    name_de TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_de TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    emoji TEXT,
    accent_color TEXT,
    crown_artifact_id TEXT REFERENCES artifact_pool(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE artifact_pool ADD COLUMN IF NOT EXISTS set_id TEXT REFERENCES artifact_sets(id)`,
  `CREATE INDEX IF NOT EXISTS idx_artifact_pool_set ON artifact_pool(set_id)`,
  `INSERT INTO artifact_sets (id, name_de, name_en, description_de, description_en, emoji, accent_color, crown_artifact_id, sort_order) VALUES
    ('set_explorers', 'Die Weltensucher', 'The Pathfinders', 'Karten, Kompasse und alles, was neue Wege zeigt.', 'Maps, compasses and everything that reveals new paths.', '🗺️', '#b98a4b', 'artifact_008', 1),
    ('set_detectives', 'Die Spurenleser', 'The Clue Seekers', 'Lupen, Linsen und Werkzeuge für wache Augen.', 'Lenses and tools for sharp eyes.', '🔍', '#7d8a5a', 'artifact_017', 2),
    ('set_dragons', 'Glutherz', 'Emberheart', 'Feuer, Funken und Drachenkraft.', 'Fire, sparks and dragon power.', '🐉', '#c26b4b', 'artifact_027', 3),
    ('set_storm', 'Frost & Sturm', 'Frost & Storm', 'Eis, Wind und Wetterzauber.', 'Ice, wind and weather magic.', '❄️', '#6b93b8', 'artifact_066', 4),
    ('set_hearts', 'Herzlicht', 'Heartlight', 'Alles, was Freundschaft und Familie stärkt.', 'Everything that strengthens friendship and family.', '💗', '#c5828c', 'artifact_042', 5),
    ('set_courage', 'Die Mutmacher', 'The Braveheart Kit', 'Schätze gegen Angst, Wut und traurige Tage.', 'Treasures against fear, anger and sad days.', '🦁', '#be8f55', 'artifact_089', 6),
    ('set_nature', 'Die Naturhüter', 'The Nature Keepers', 'Kräuter, Steine und die Kraft der Erde.', 'Herbs, stones and the power of the earth.', '🌿', '#527b70', 'artifact_026', 7),
    ('set_night', 'Nachtlichter', 'Nightlights', 'Träume, Schatten und geheimnisvolle Nächte.', 'Dreams, shadows and mysterious nights.', '🌙', '#5f78a0', 'artifact_082', 8),
    ('set_wisdom', 'Die Weisen', 'The Sages', 'Bücher, Wissen und kluge Gedanken.', 'Books, knowledge and clever thoughts.', '📚', '#8e7daf', 'artifact_088', 9),
    ('set_magic', 'Die Zauberwerkstatt', 'The Spell Workshop', 'Tränke, Zauberkreise und magisches Handwerk.', 'Potions, spell circles and magical craft.', '⚗️', '#8a6ca8', 'artifact_052', 10),
    ('set_treasure', 'Funkelschätze', 'Glitter Hoard', 'Glänzendes, Glück und sagenhafte Kostbarkeiten.', 'Shiny things, luck and fabled valuables.', '💎', '#9b7138', 'artifact_003', 11)
  ON CONFLICT (id) DO NOTHING`,
  `UPDATE artifact_pool SET set_id = 'set_explorers' WHERE id IN
    ('artifact_080','artifact_097','artifact_060','artifact_012','artifact_025','artifact_056','artifact_008') AND set_id IS NULL`,
  `UPDATE artifact_pool SET set_id = 'set_detectives' WHERE id IN
    ('artifact_098','artifact_030','artifact_077','artifact_076','artifact_005','artifact_017') AND set_id IS NULL`,
  `UPDATE artifact_pool SET set_id = 'set_dragons' WHERE id IN
    ('artifact_014','artifact_065','artifact_078','artifact_051','artifact_027') AND set_id IS NULL`,
  `UPDATE artifact_pool SET set_id = 'set_storm' WHERE id IN
    ('artifact_021','artifact_050','artifact_002','artifact_034','artifact_006','artifact_066') AND set_id IS NULL`,
  `UPDATE artifact_pool SET set_id = 'set_hearts' WHERE id IN
    ('artifact_039','artifact_092','artifact_093','artifact_094','artifact_033','artifact_070','artifact_042') AND set_id IS NULL`,
  `UPDATE artifact_pool SET set_id = 'set_courage' WHERE id IN
    ('artifact_087','artifact_071','artifact_028','artifact_029','artifact_072','artifact_073','artifact_040','artifact_089') AND set_id IS NULL`,
  `UPDATE artifact_pool SET set_id = 'set_nature' WHERE id IN
    ('artifact_019','artifact_062','artifact_010','artifact_049','artifact_064','artifact_022','artifact_035','artifact_026') AND set_id IS NULL`,
  `UPDATE artifact_pool SET set_id = 'set_night' WHERE id IN
    ('artifact_095','artifact_016','artifact_043','artifact_061','artifact_057','artifact_041','artifact_059','artifact_007','artifact_082') AND set_id IS NULL`,
  `UPDATE artifact_pool SET set_id = 'set_wisdom' WHERE id IN
    ('artifact_004','artifact_055','artifact_079','artifact_031','artifact_091','artifact_048','artifact_011','artifact_088') AND set_id IS NULL`,
  `UPDATE artifact_pool SET set_id = 'set_magic' WHERE id IN
    ('artifact_044','artifact_054','artifact_081','artifact_038','artifact_047','artifact_024','artifact_085','artifact_052') AND set_id IS NULL`,
  `UPDATE artifact_pool SET set_id = 'set_treasure' WHERE id IN
    ('artifact_032','artifact_083','artifact_036','artifact_023','artifact_001','artifact_058','artifact_046','artifact_003') AND set_id IS NULL`,
  `CREATE TABLE IF NOT EXISTS artifact_journal (
    id TEXT PRIMARY KEY,
    avatar_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL REFERENCES artifact_pool(id),
    story_id TEXT,
    story_title TEXT,
    event TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_artifact_journal_avatar ON artifact_journal(avatar_id, artifact_id, created_at DESC)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_journal_unique_story_event
    ON artifact_journal(avatar_id, artifact_id, story_id, event)
    WHERE story_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS avatar_artifact_shards (
    avatar_id TEXT PRIMARY KEY,
    shards INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS artifact_shard_offers (
    id TEXT PRIMARY KEY,
    avatar_id TEXT NOT NULL,
    artifact_ids TEXT[] NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    redeemed_at TIMESTAMP,
    redeemed_artifact_id TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_artifact_shard_offers_avatar
    ON artifact_shard_offers(avatar_id) WHERE redeemed_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS avatar_shard_grants (
    avatar_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (avatar_id, story_id)
  )`,
  `ALTER TABLE story_artifacts ADD COLUMN IF NOT EXISTS presence TEXT NOT NULL DEFAULT 'central'`,
  `ALTER TABLE story_artifacts ADD COLUMN IF NOT EXISTS brought_by_avatar_id TEXT`,

  // 28. Completion reward claims - mirrors
  // avatar/migrations/16_add_completion_reward_claims. Without this table
  // every story/doku completion fails before personality + treasury rewards.
  `CREATE TABLE IF NOT EXISTS avatar_completion_reward_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('story', 'doku')),
    content_id TEXT NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (avatar_id, content_type, content_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_avatar_completion_reward_claims_content
    ON avatar_completion_reward_claims(content_type, content_id)`,
  `INSERT INTO avatar_completion_reward_claims (avatar_id, content_type, content_id, claimed_at)
    SELECT avatar_id, 'story', story_id, read_at FROM avatar_story_read
    ON CONFLICT (avatar_id, content_type, content_id) DO NOTHING`,
  `INSERT INTO avatar_completion_reward_claims (avatar_id, content_type, content_id, claimed_at)
    SELECT avatar_id, 'doku', doku_id, read_at FROM avatar_doku_read
    ON CONFLICT (avatar_id, content_type, content_id) DO NOTHING`,
];

/**
 * Initialize database - runs migrations on first call
 * This is automatically triggered by Railway's health check
 */
export const initializeDatabaseMigrations = api(
  { expose: false, method: "GET", path: "/init", auth: false },
  async (): Promise<{ success: boolean; message: string; tablesCreated?: number; fairyTalesCount?: number }> => {
    // Don't check migrationsRun flag - always check fairy tales migrations

    try {
      console.log("=== Running Talea Database Migrations ===");

      // Use story database for migrations (all services share same DB in Railway)
      const { storyDB } = await import("../story/db");

      // Check if baseline and latest tables exist.
      const characterPoolResult = await storyDB.queryRow<{ exists: boolean }>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'character_pool'
        );
      `;
      const studioScenesResult = await storyDB.queryRow<{ exists: boolean }>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'studio_episode_scenes'
        );
      `;
      const meteredUsageResult = await storyDB.queryRow<{ exists: boolean }>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'metered_usage'
        );
      `;
      const artifactSetsResult = await storyDB.queryRow<{ exists: boolean }>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'artifact_sets'
        );
      `;
      const completionClaimsResult = await storyDB.queryRow<{ exists: boolean }>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'avatar_completion_reward_claims'
        );
      `;

      const characterPoolExists = Boolean(characterPoolResult?.exists);
      const studioTablesExist = Boolean(studioScenesResult?.exists);
      const meteredUsageExists = Boolean(meteredUsageResult?.exists);
      const artifactSetsExist = Boolean(artifactSetsResult?.exists);
      const completionClaimsExist = Boolean(completionClaimsResult?.exists);
      const tablesExist = characterPoolExists && studioTablesExist && meteredUsageExists && artifactSetsExist && completionClaimsExist;

      if (tablesExist) {
        console.log("[Init] Latest schema already present (including Talea Studio tables) - skipping table migrations");
      } else {
        // Also check if users table exists (for backward compatibility)
        const usersExist = await storyDB.queryRow<{ exists: boolean }>`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'users'
          );
        `;

        if (usersExist && usersExist.exists && !characterPoolExists) {
          console.log("[Init] Base tables exist, but character pool missing - running remaining migrations");
        } else if (usersExist && usersExist.exists && characterPoolExists && !studioTablesExist) {
          console.log("[Init] Base tables exist, but Talea Studio tables are missing - running remaining migrations");
        } else if (usersExist && usersExist.exists && !artifactSetsExist) {
          console.log("[Init] Base tables exist, but artifact treasury tables are missing - running remaining migrations");
        }

        console.log(`Executing ${MIGRATION_STATEMENTS.length} SQL statements...`);

        let successCount = 0;
        for (let i = 0; i < MIGRATION_STATEMENTS.length; i++) {
          const statement = MIGRATION_STATEMENTS[i];
          const preview = statement.substring(0, 80).replace(/\s+/g, ' ');

          try {
            console.log(`  [${i + 1}/${MIGRATION_STATEMENTS.length}] ${preview}...`);
            await (storyDB as any).exec(statement);
            successCount++;
          } catch (err: any) {
            // If error is "already exists", that's OK - continue
            if (err.message && (
              err.message.includes('already exists') ||
              err.message.includes('duplicate')
            )) {
              console.log("    [skip] Already exists (skipping)");
              successCount++;
              continue;
            }
            // Otherwise, log error but continue with next statement
            console.error("    [error] Failed:", err.message);
          }
        }

        console.log(`[Init] Base table migrations completed! ${successCount}/${MIGRATION_STATEMENTS.length} statements executed successfully`);
      }

      // Numbered migration files (user/avatar/story/fairytales) are the
      // canonical schema source, but the Railway container never runs Encore
      // auto-migrations. Run them idempotently once per process boot so every
      // deploy converges the schema (fixes e.g. the missing
      // avatar_completion_reward_claims table breaking story completion).
      if (!numberedMigrationFilesRunThisBoot) {
        numberedMigrationFilesRunThisBoot = true;
        try {
          console.log("\n=== Running numbered migration files (once per boot) ===");
          const { runAllNumberedMigrationFiles } = await import("./run-migrations");
          const result = await runAllNumberedMigrationFiles();
          console.log(`[Init] Numbered migration files: ${result.migrationsRun.length} ok, ${result.errors.length} failed`);
          for (const err of result.errors) console.error(`[Init] Numbered migration failure: ${err}`);
        } catch (numberedErr: any) {
          console.error("[Init] Numbered migration file run failed:", numberedErr?.message || numberedErr);
        }
      }

      // Now run fairy tales migrations using the fairy tales database directly
      console.log("\n=== Running Fairy Tales Migrations ===");
      let fairyTalesCount = 0;
      try {
        const { fairytalesDB } = await import("../fairytales/db");
        const fs = await import("fs/promises");
        const path = await import("path");
        const { fileURLToPath } = await import("url");

        // Check current count
        const countResult = await fairytalesDB.queryRow<{ count: number }>`
          SELECT COUNT(*) as count FROM fairy_tales
        `;
        fairyTalesCount = countResult?.count || 0;

        console.log(`[Fairy Tales] Current count: ${fairyTalesCount} tales`);

        if (fairyTalesCount >= 50) {
          console.log("[Fairy Tales] Already have 50+ tales. Migrations complete.");
        } else {
          console.log(`[Fairy Tales] Need to add ${50 - fairyTalesCount} more tales`);

          // Migrations are in the source directory at /app/fairytales/migrations
          const migrationsDir = path.join("/app", "fairytales", "migrations");

          console.log(`[Fairy Tales] Looking for migrations in: ${migrationsDir}`);

          const migrations = [
            "10_add_47_classic_fairy_tales.up.sql",
            "11_add_andersen_fairy_tales.up.sql",
            "12_add_russian_arabian_fairy_tales.up.sql",
            "13_add_classics_legends_fables.up.sql"
          ];

          // Run each migration
          for (const migrationFile of migrations) {
            try {
              const migrationPath = path.join(migrationsDir, migrationFile);
              console.log(`[Fairy Tales] Running ${migrationFile}...`);
              console.log(`[Fairy Tales] Full path: ${migrationPath}`);

              // Check if file exists
              try {
                await fs.access(migrationPath);
                console.log(`[Fairy Tales] File exists, reading...`);
              } catch (accessErr: any) {
                console.error(`[Fairy Tales] ✗ File not found: ${migrationPath}`);
                console.error(`[Fairy Tales] Access error:`, accessErr.message);
                continue;
              }

              const sql = await fs.readFile(migrationPath, "utf-8");
              console.log(`[Fairy Tales] SQL length: ${sql.length} characters`);

              await (fairytalesDB as any).exec(sql);

              console.log(`[Fairy Tales] ✓ ${migrationFile} completed`);
            } catch (migErr: any) {
              // Check if it's a duplicate key error
              if (migErr.message && migErr.message.includes("duplicate key")) {
                console.log(`[Fairy Tales] ⚠ ${migrationFile} - some tales already exist (skipping)`);
              } else {
                console.error(`[Fairy Tales] ✗ ${migrationFile} failed:`, migErr.message);
                console.error(`[Fairy Tales] Full error:`, migErr);
              }
            }
          }

          // Check final count
          const finalResult = await fairytalesDB.queryRow<{ count: number }>`
            SELECT COUNT(*) as count FROM fairy_tales
          `;
          fairyTalesCount = finalResult?.count || 0;
          console.log(`[Fairy Tales] Final count: ${fairyTalesCount} tales`);
        }
      } catch (fairyError: any) {
        console.error("[Fairy Tales] Error running migrations:", fairyError.message);
        // Don't fail the whole init if fairy tales fails
      }

      migrationsRun = true;

      return {
        success: true,
        message: `All migrations completed successfully`,
        fairyTalesCount
      };
    } catch (error: any) {
      console.error("[Init] Migration failed:", error);
      return {
        success: false,
        message: `Migration failed: ${error.message}`
      };
    }
  }
);

