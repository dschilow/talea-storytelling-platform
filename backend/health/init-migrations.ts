import { api } from "encore.dev/api";

let migrationsRun = false;

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
];

/**
 * Initialize database - runs migrations on first call
 * This is automatically triggered by Railway's health check
 */
export const initializeDatabaseMigrations = api(
  { expose: true, method: "GET", path: "/init", auth: false },
  async (): Promise<{ success: boolean; message: string; tablesCreated?: number; fairyTalesCount?: number }> => {
    // Don't check migrationsRun flag - always check fairy tales migrations

    try {
      console.log("=== Running Talea Database Migrations ===");

      // Use story database for migrations (all services share same DB in Railway)
      const { storyDB } = await import("../story/db");

      // Check if character_pool table exists (our newest table)
      const result = await storyDB.queryRow<{ exists: boolean }>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'character_pool'
        );
      `;

      const tablesExist = result && result.exists;

      if (tablesExist) {
        console.log("[Init] Character pool and all tables already exist - skipping table migrations");
      } else {
        // Also check if users table exists (for backward compatibility)
        const usersExist = await storyDB.queryRow<{ exists: boolean }>`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'users'
          );
        `;

        if (usersExist && usersExist.exists) {
          console.log("[Init] Base tables exist, but character pool missing - running remaining migrations");
        }

        console.log(`Executing ${MIGRATION_STATEMENTS.length} SQL statements...`);

        let successCount = 0;
        for (let i = 0; i < MIGRATION_STATEMENTS.length; i++) {
          const statement = MIGRATION_STATEMENTS[i];
          const preview = statement.substring(0, 80).replace(/\s+/g, ' ');

          try {
            console.log(`  [${i + 1}/${MIGRATION_STATEMENTS.length}] ${preview}...`);
            await storyDB.exec(statement);
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

              await fairytalesDB.exec(sql);

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

