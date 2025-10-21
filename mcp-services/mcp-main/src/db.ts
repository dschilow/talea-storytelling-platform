import pg from 'pg';
import { CONFIG } from './config.js';
import type {
  Avatar,
  AvatarRow,
  AvatarMemory,
  MemoryRow,
  PersonalityTraits,
} from './types.js';

const { Pool } = pg;

// PostgreSQL connection pool
export const pool = new Pool({
  connectionString: CONFIG.database.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
export async function testConnection(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Helper: Convert DB row to Avatar object
function rowToAvatar(row: AvatarRow): Avatar {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description || undefined,
    physicalTraits: JSON.parse(row.physical_traits),
    personalityTraits: JSON.parse(row.personality_traits),
    imageUrl: row.image_url || undefined,
    visualProfile: row.visual_profile ? JSON.parse(row.visual_profile) : undefined,
    creationType: row.creation_type,
    isPublic: row.is_public,
    originalAvatarId: row.original_avatar_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper: Convert DB row to Memory object
function rowToMemory(row: MemoryRow): AvatarMemory {
  return {
    id: row.id,
    avatarId: row.avatar_id,
    storyId: row.story_id,
    storyTitle: row.story_title,
    experience: row.experience,
    emotionalImpact: row.emotional_impact,
    personalityChanges: JSON.parse(row.personality_changes),
    createdAt: row.created_at,
  };
}

// ==================== AVATAR QUERIES ====================

/**
 * Get single avatar by ID (with user ownership check)
 */
export async function getAvatarById(
  avatarId: string,
  userId: string
): Promise<Avatar | null> {
  const query = `
    SELECT * FROM avatars
    WHERE id = $1 AND user_id = $2
    LIMIT 1
  `;

  const result = await pool.query<AvatarRow>(query, [avatarId, userId]);

  if (result.rows.length === 0) {
    return null;
  }

  return rowToAvatar(result.rows[0]);
}

/**
 * Get multiple avatars by IDs (with user ownership check)
 */
export async function getAvatarsByIds(
  avatarIds: string[],
  userId: string
): Promise<Avatar[]> {
  if (avatarIds.length === 0) {
    return [];
  }

  const query = `
    SELECT * FROM avatars
    WHERE id = ANY($1) AND user_id = $2
  `;

  const result = await pool.query<AvatarRow>(query, [avatarIds, userId]);

  return result.rows.map(rowToAvatar);
}

/**
 * Get avatar's visual profile only
 */
export async function getAvatarVisualProfile(
  avatarId: string,
  userId: string
) {
  const query = `
    SELECT id, name, visual_profile
    FROM avatars
    WHERE id = $1 AND user_id = $2
    LIMIT 1
  `;

  const result = await pool.query(query, [avatarId, userId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    name: row.name,
    visualProfile: row.visual_profile ? JSON.parse(row.visual_profile) : null,
  };
}

/**
 * Get avatar's personality traits only
 */
export async function getAvatarPersonality(
  avatarId: string,
  userId: string
): Promise<{ id: string; name: string; personalityTraits: PersonalityTraits } | null> {
  const query = `
    SELECT id, name, personality_traits
    FROM avatars
    WHERE id = $1 AND user_id = $2
    LIMIT 1
  `;

  const result = await pool.query(query, [avatarId, userId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    name: row.name,
    personalityTraits: JSON.parse(row.personality_traits),
  };
}

// ==================== MEMORY QUERIES ====================

/**
 * Get all memories for an avatar
 */
export async function getAvatarMemories(
  avatarId: string,
  userId: string,
  limit: number = 50
): Promise<AvatarMemory[]> {
  // First verify the avatar belongs to the user
  const avatarCheck = await pool.query(
    'SELECT id FROM avatars WHERE id = $1 AND user_id = $2',
    [avatarId, userId]
  );

  if (avatarCheck.rows.length === 0) {
    throw new Error('Avatar not found or access denied');
  }

  const query = `
    SELECT * FROM avatar_memories
    WHERE avatar_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;

  const result = await pool.query<MemoryRow>(query, [avatarId, limit]);

  return result.rows.map(rowToMemory);
}

/**
 * Search memories by context/keyword
 */
export async function searchMemories(
  avatarId: string,
  userId: string,
  searchTerm: string,
  limit: number = 20
): Promise<AvatarMemory[]> {
  // First verify the avatar belongs to the user
  const avatarCheck = await pool.query(
    'SELECT id FROM avatars WHERE id = $1 AND user_id = $2',
    [avatarId, userId]
  );

  if (avatarCheck.rows.length === 0) {
    throw new Error('Avatar not found or access denied');
  }

  const query = `
    SELECT * FROM avatar_memories
    WHERE avatar_id = $1
      AND (
        experience ILIKE $2
        OR story_title ILIKE $2
      )
    ORDER BY created_at DESC
    LIMIT $3
  `;

  const result = await pool.query<MemoryRow>(query, [
    avatarId,
    `%${searchTerm}%`,
    limit,
  ]);

  return result.rows.map(rowToMemory);
}

/**
 * Add new memory for avatar
 */
export async function addAvatarMemory(
  avatarId: string,
  userId: string,
  memory: {
    storyId: string;
    storyTitle: string;
    experience: string;
    emotionalImpact: 'positive' | 'negative' | 'neutral';
    personalityChanges: Array<{ trait: string; change: number }>;
  }
): Promise<AvatarMemory> {
  // First verify the avatar belongs to the user
  const avatarCheck = await pool.query(
    'SELECT id FROM avatars WHERE id = $1 AND user_id = $2',
    [avatarId, userId]
  );

  if (avatarCheck.rows.length === 0) {
    throw new Error('Avatar not found or access denied');
  }

  // Ensure avatar_memories table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS avatar_memories (
      id TEXT PRIMARY KEY,
      avatar_id TEXT NOT NULL,
      story_id TEXT,
      story_title TEXT,
      experience TEXT,
      emotional_impact TEXT CHECK (emotional_impact IN ('positive', 'negative', 'neutral')),
      personality_changes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
    )
  `);

  const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const query = `
    INSERT INTO avatar_memories (
      id, avatar_id, story_id, story_title,
      experience, emotional_impact, personality_changes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const result = await pool.query<MemoryRow>(query, [
    memoryId,
    avatarId,
    memory.storyId,
    memory.storyTitle,
    memory.experience,
    memory.emotionalImpact,
    JSON.stringify(memory.personalityChanges),
  ]);

  return rowToMemory(result.rows[0]);
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('✅ Database pool closed');
}
