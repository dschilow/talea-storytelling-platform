/**
 * Memory Categorization & Personality Shift Cooldown System
 * 
 * Implements structured memory updates as per optimization spec Section 7.3:
 * - Acute memories: Immediate, vivid experiences
 * - Thematic memories: Recurring patterns and themes
 * - Personality memories: Long-term character development
 * - Cooldown system: Prevents rapid personality shifts
 */

import type { SQLDatabase } from "encore.dev/storage/sqldb";

export type MemoryCategory = "acute" | "thematic" | "personality";

export interface CategorizedMemory {
  category: MemoryCategory;
  experience: string;
  emotionalImpact: "positive" | "negative" | "neutral";
  personalityChanges: Array<{
    trait: string;
    change: number;
    description?: string;
  }>;
  developmentDescription?: string;
  storyId: string;
  storyTitle: string;
  contentType: "story" | "doku";
}

export interface PersonalityShiftCooldown {
  avatarId: string;
  trait: string;
  lastShiftTimestamp: Date;
  cooldownHours: number;
}

/**
 * Categorizes a memory based on its content and personality changes
 */
export function categorizeMemory(
  experience: string,
  personalityChanges: Array<{ trait: string; change: number; description?: string }>,
  storyTitle: string
): MemoryCategory {
  // PERSONALITY: Significant trait changes (≥5 points) or multiple traits affected
  const hasSignificantChange = personalityChanges.some(c => Math.abs(c.change) >= 5);
  const hasMultipleChanges = personalityChanges.length >= 3;
  
  if (hasSignificantChange || hasMultipleChanges) {
    return "personality";
  }

  // THEMATIC: Recurring patterns (keywords: "again", "once more", "like before", "remember when")
  const thematicKeywords = [
    "wieder", "erneut", "wie zuvor", "wie damals", "schon wieder",
    "again", "once more", "like before", "remember when", "as always"
  ];
  const isThematic = thematicKeywords.some(keyword => 
    experience.toLowerCase().includes(keyword) || storyTitle.toLowerCase().includes(keyword)
  );
  
  if (isThematic) {
    return "thematic";
  }

  // ACUTE: Default for immediate, vivid experiences
  return "acute";
}

/**
 * Checks if a personality shift is allowed based on cooldown
 * 
 * Cooldown rules:
 * - Acute: No cooldown (immediate experiences)
 * - Thematic: 24 hours cooldown per trait
 * - Personality: 72 hours cooldown per trait (prevents rapid shifts)
 */
export function isPersonalityShiftAllowed(
  category: MemoryCategory,
  trait: string,
  lastShifts: PersonalityShiftCooldown[]
): { allowed: boolean; reason?: string; remainingHours?: number } {
  // Acute memories: Always allowed
  if (category === "acute") {
    return { allowed: true };
  }

  // Find last shift for this trait
  const lastShift = lastShifts.find(s => s.trait === trait);
  if (!lastShift) {
    return { allowed: true }; // No previous shift
  }

  // Calculate cooldown based on category
  const cooldownHours = category === "personality" ? 72 : 24;
  const hoursSinceLastShift = (Date.now() - lastShift.lastShiftTimestamp.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceLastShift < cooldownHours) {
    const remainingHours = Math.ceil(cooldownHours - hoursSinceLastShift);
    return {
      allowed: false,
      reason: `Cooldown active for trait "${trait}" (${category} category)`,
      remainingHours,
    };
  }

  return { allowed: true };
}

/**
 * Filters personality changes based on cooldown rules
 */
export function filterPersonalityChangesWithCooldown(
  category: MemoryCategory,
  changes: Array<{ trait: string; change: number; description?: string }>,
  lastShifts: PersonalityShiftCooldown[]
): {
  allowedChanges: Array<{ trait: string; change: number; description?: string }>;
  blockedChanges: Array<{ trait: string; change: number; reason: string; remainingHours: number }>;
} {
  const allowedChanges: typeof changes = [];
  const blockedChanges: Array<{ trait: string; change: number; reason: string; remainingHours: number }> = [];

  for (const change of changes) {
    const shiftCheck = isPersonalityShiftAllowed(category, change.trait, lastShifts);
    
    if (shiftCheck.allowed) {
      allowedChanges.push(change);
    } else {
      blockedChanges.push({
        trait: change.trait,
        change: change.change,
        reason: shiftCheck.reason ?? "Cooldown active",
        remainingHours: shiftCheck.remainingHours ?? 0,
      });
    }
  }

  return { allowedChanges, blockedChanges };
}

/**
 * Creates a structured memory with categorization
 */
export function createStructuredMemory(
  experience: string,
  personalityChanges: Array<{ trait: string; change: number; description?: string }>,
  storyId: string,
  storyTitle: string,
  contentType: "story" | "doku" = "story",
  emotionalImpact: "positive" | "negative" | "neutral" = "positive"
): CategorizedMemory {
  const category = categorizeMemory(experience, personalityChanges, storyTitle);
  
  const developmentDescription = personalityChanges.length > 0
    ? `[${category.toUpperCase()}] ${personalityChanges
        .map(c => c.description || `${c.trait}: ${c.change > 0 ? '+' : ''}${c.change}`)
        .join(", ")}`
    : undefined;

  return {
    category,
    experience,
    emotionalImpact,
    personalityChanges,
    developmentDescription,
    storyId,
    storyTitle,
    contentType,
  };
}

/**
 * Reconstructs the most recent personality shift per trait for an avatar from
 * its stored memories. This is what `filterPersonalityChangesWithCooldown`
 * needs to actually enforce the 24h/72h cooldowns — without it the cooldown
 * check always receives an empty list and never blocks anything.
 *
 * `db` is injected (the avatar DB) so this module stays free of a hard DB
 * dependency and remains easy to unit-test.
 */
type CooldownMemoryRow = { personality_changes: string | null; created_at: Date | string };

export async function loadPersonalityShiftCooldowns(
  db: SQLDatabase,
  avatarId: string,
  lookbackHours = 72
): Promise<PersonalityShiftCooldown[]> {
  // Only memories within the longest cooldown window can still be blocking.
  const rows = await db.queryAll<CooldownMemoryRow>`
    SELECT personality_changes, created_at
    FROM avatar_memories
    WHERE avatar_id = ${avatarId}
      AND created_at >= NOW() - (${lookbackHours} || ' hours')::interval
    ORDER BY created_at DESC
  `;

  const latestByTrait = new Map<string, PersonalityShiftCooldown>();

  for (const row of rows) {
    const timestamp = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
    if (Number.isNaN(timestamp.getTime())) continue;

    let changes: Array<{ trait?: unknown }> = [];
    try {
      const parsed = row.personality_changes ? JSON.parse(row.personality_changes) : [];
      if (Array.isArray(parsed)) changes = parsed;
    } catch {
      continue;
    }

    for (const change of changes) {
      const trait = typeof change?.trait === "string" ? change.trait : undefined;
      if (!trait) continue;
      // Rows are DESC, so the first time we see a trait it is the most recent.
      if (!latestByTrait.has(trait)) {
        latestByTrait.set(trait, {
          avatarId,
          trait,
          lastShiftTimestamp: timestamp,
          cooldownHours: lookbackHours,
        });
      }
    }
  }

  return Array.from(latestByTrait.values());
}

/**
 * Generates a human-readable summary of memory categorization
 */
export function summarizeMemoryCategory(category: MemoryCategory): string {
  switch (category) {
    case "acute":
      return "Unmittelbare Erfahrung (keine Cooldown)";
    case "thematic":
      return "Wiederkehrendes Thema (24h Cooldown)";
    case "personality":
      return "Tiefgreifende Entwicklung (72h Cooldown)";
  }
}

