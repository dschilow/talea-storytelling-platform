import { api } from "encore.dev/api";

let migrationsRun = false;

// All migration SQL statements - executed in order
const MIGRATION_STATEMENTS = [
  // 1. Users table
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    subscription TEXT NOT NULL DEFAULT 'starter',
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
  
  // 12. Avatar doku read tracking
  `CREATE TABLE IF NOT EXISTS avatar_doku_read (
    avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    doku_id TEXT NOT NULL REFERENCES dokus(id) ON DELETE CASCADE,
    read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (avatar_id, doku_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_avatar_doku_avatar ON avatar_doku_read(avatar_id)`,
  `CREATE INDEX IF NOT EXISTS idx_avatar_doku_doku ON avatar_doku_read(doku_id)`,
  
  // 13. Avatar story read tracking
  `CREATE TABLE IF NOT EXISTS avatar_story_read (
    avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (avatar_id, story_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_avatar_story_avatar ON avatar_story_read(avatar_id)`,
  `CREATE INDEX IF NOT EXISTS idx_avatar_story_story ON avatar_story_read(story_id)`,
  
  // 14. AI personality tracking
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

  // 15. Character pool for supporting story characters
  `CREATE TABLE IF NOT EXISTS character_pool (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    archetype TEXT NOT NULL,
    emotional_nature JSONB NOT NULL,
    visual_profile JSONB NOT NULL,
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

  // 16. Story-character junction table
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

  // 17. Story skeletons (Phase 1 output storage)
  `CREATE TABLE IF NOT EXISTS story_skeletons (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    title TEXT,
    chapters JSONB NOT NULL,
    supporting_character_requirements JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_story_skeletons_story ON story_skeletons(story_id)`,

  // 18. Add avatar_developments column to stories
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='stories' AND column_name='avatar_developments') THEN
      ALTER TABLE stories ADD COLUMN avatar_developments JSONB;
    END IF;
  END $$`,
];

/**
 * Initialize database - runs migrations on first call
 * This is automatically triggered by Railway's health check
 */
export const initializeDatabaseMigrations = api(
  { expose: true, method: "GET", path: "/init", auth: false },
  async (): Promise<{ success: boolean; message: string; tablesCreated?: number }> => {
    if (migrationsRun) {
      return { 
        success: true, 
        message: "Migrations already completed in this instance" 
      };
    }

    try {
      console.log("=== Running Talea Database Migrations ===");

      // Use story database for migrations (all services share same DB in Railway)
      const { storyDB } = await import("../story/db");

      // Check if users table already exists
      const result = await storyDB.queryRow<{ exists: boolean }>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'users'
        );
      `;

      if (result && result.exists) {
        console.log("✓ Database tables already exist");
        migrationsRun = true;
        return { 
          success: true, 
          message: "Database tables already exist" 
        };
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
            console.log(`    ⚠️  Already exists (skipping)`);
            successCount++;
            continue;
          }
          // Otherwise, log error but continue with next statement
          console.error(`    ✗ Failed:`, err.message);
        }
      }

      console.log(`✓ Migrations completed! ${successCount}/${MIGRATION_STATEMENTS.length} statements executed successfully`);
      migrationsRun = true;

      return { 
        success: true, 
        message: `Migrations completed successfully`, 
        tablesCreated: successCount 
      };
    } catch (error: any) {
      console.error("✗ Migration failed:", error);
      return { 
        success: false, 
        message: `Migration failed: ${error.message}` 
      };
    }
  }
);

