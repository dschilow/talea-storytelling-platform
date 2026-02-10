import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";
import { avatar } from "~encore/clients";
import { InventoryItem, Skill } from "../avatar/avatar";
import { unlockStoryArtifact } from "./artifact-matcher";
import { buildArtifactImageUrlForClient } from "../helpers/image-proxy";

const avatarDB = SQLDatabase.named("avatar");

interface MarkStoryReadRequest {
  storyId: string;
  storyTitle: string;
  genre?: string;
  avatarId?: string;
}

interface MarkStoryReadResponse {
  success: boolean;
  updatedAvatars: number;
  personalityChanges: Array<{
    avatarName: string;
    changes: Array<{ trait: string; change: number; description: string }>;
    appliedChanges?: Array<{ trait: string; change: number; oldValue?: number; newValue?: number }>;
    masteryEvents?: Array<{
      trait: string;
      oldTier: string;
      newTier: string;
      newTierLevel: number;
      currentValue: number;
    }>;
    rewards?: {
      newItems: InventoryItem[];
      upgradedItems: InventoryItem[];
      newSkills: Skill[];
    };
  }>;
  unlockedArtifact?: {
    id: string;
    name: string;
    description: string;
    category: string;
    rarity: string;
    emoji?: string;
    visualKeywords: string[];
    imageUrl?: string;
  };
}

interface StoryChange {
  trait: string;
  change: number;
  description: string;
}

export const markRead = api<MarkStoryReadRequest, MarkStoryReadResponse>(
  { expose: true, method: "POST", path: "/story/mark-read", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const userId = auth.userID;

    console.log(`Story finished by user ${userId}: "${req.storyTitle}"`);

    let userAvatars: { id: string; name: string }[] = [];
    if (req.avatarId) {
      const specificAvatar = await avatarDB.queryRow<{ id: string; name: string; user_id: string }>`
        SELECT id, name, user_id
        FROM avatars
        WHERE id = ${req.avatarId} AND user_id = ${userId}
      `;

      if (!specificAvatar) {
        return {
          success: false,
          updatedAvatars: 0,
          personalityChanges: [],
        };
      }
      userAvatars = [{ id: specificAvatar.id, name: specificAvatar.name }];
    } else {
      userAvatars = await avatarDB.queryAll<{ id: string; name: string }>`
        SELECT id, name
        FROM avatars
        WHERE user_id = ${userId}
      `;
    }

    if (userAvatars.length === 0) {
      return {
        success: true,
        updatedAvatars: 0,
        personalityChanges: [],
      };
    }

    const personalityChanges: MarkStoryReadResponse["personalityChanges"] = [];
    let updatedCount = 0;

    for (const userAvatar of userAvatars) {
      try {
        const alreadyRead = await avatarDB.queryRow<{ id: string }>`
          SELECT id
          FROM avatar_story_read
          WHERE avatar_id = ${userAvatar.id} AND story_id = ${req.storyId}
        `;

        if (alreadyRead) {
          continue;
        }

        const avatarRow = await avatarDB.queryRow<{ personality_traits: string; inventory: string }>`
          SELECT personality_traits, inventory
          FROM avatars
          WHERE id = ${userAvatar.id}
        `;

        const changes = buildStoryReadChanges(req, userAvatar.id, avatarRow?.personality_traits ?? "{}");
        if (changes.length === 0) {
          continue;
        }

        const personalityResult = await avatar.updatePersonality({
          id: userAvatar.id,
          changes,
          storyId: req.storyId,
          contentTitle: req.storyTitle,
          contentType: "story",
        });

        await avatar.addMemory({
          id: userAvatar.id,
          storyId: req.storyId,
          storyTitle: req.storyTitle,
          experience: `Ich habe die Geschichte "${req.storyTitle}" gelesen. Genre: ${req.genre || "Unbekannt"}.`,
          emotionalImpact: "positive",
          personalityChanges: changes,
          developmentDescription: `Persoenlichkeitsentwicklung: ${changes.map((item) => item.description).join(", ")}`,
          contentType: "story",
        });

        await avatarDB.exec`
          INSERT INTO avatar_story_read (avatar_id, story_id, story_title)
          VALUES (${userAvatar.id}, ${req.storyId}, ${req.storyTitle})
          ON CONFLICT (avatar_id, story_id) DO NOTHING
        `;

        let rewards: MarkStoryReadResponse["personalityChanges"][number]["rewards"] | undefined = undefined;
        try {
          const inventory: InventoryItem[] = JSON.parse(avatarRow?.inventory || "[]");
          const storyTags = req.genre ? [req.genre.toLowerCase()] : ["adventure"];
          const upgradedItems: InventoryItem[] = [];

          for (const item of inventory) {
            const hasTagMatch = item.tags?.some((tag) => storyTags.includes(tag)) ?? false;
            if (hasTagMatch && item.level < 3) {
              item.level += 1;
              const baseName = item.name.replace(/^(Novice|Advanced|Master)\s+/, "");
              if (item.level === 2) item.name = `Advanced ${baseName}`;
              if (item.level === 3) item.name = `Master ${baseName}`;
              item.description = `Verstaerkte Version: ${item.name}. Level ${item.level}!`;
              upgradedItems.push(item);
              break;
            }
          }

          if (upgradedItems.length > 0) {
            await avatarDB.exec`
              UPDATE avatars
              SET inventory = ${JSON.stringify(inventory)},
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ${userAvatar.id}
            `;

            rewards = {
              newItems: [],
              upgradedItems,
              newSkills: [],
            };
          }
        } catch (rewardError) {
          console.error(`Failed reward update for ${userAvatar.name}`, rewardError);
        }

        personalityChanges.push({
          avatarName: userAvatar.name,
          changes,
          appliedChanges: personalityResult.appliedChanges.map((entry) => ({
            trait: entry.trait,
            change: entry.change,
          })),
          masteryEvents: personalityResult.masteryEvents.map((entry) => ({
            trait: entry.trait,
            oldTier: entry.oldTier.name,
            newTier: entry.newTier.name,
            newTierLevel: entry.newTier.level,
            currentValue: entry.newValue,
          })),
          rewards,
        });

        updatedCount += 1;
      } catch (error) {
        console.error(`Failed to update avatar ${userAvatar.name}`, error);
      }
    }

    let unlockedArtifact: MarkStoryReadResponse["unlockedArtifact"] | undefined;
    try {
      const artifact = await unlockStoryArtifact(req.storyId);

      if (artifact) {
        const resolvedArtifactImageUrl = await buildArtifactImageUrlForClient(artifact.id, artifact.imageUrl);
        unlockedArtifact = {
          id: artifact.id,
          name: artifact.name.de,
          description: artifact.description.de,
          category: artifact.category,
          rarity: artifact.rarity,
          emoji: artifact.emoji,
          visualKeywords: artifact.visualKeywords,
          imageUrl: resolvedArtifactImageUrl ?? artifact.imageUrl,
        };

        for (const userAvatar of userAvatars) {
          try {
            const inventoryItem: InventoryItem = {
              id: `artifact_${artifact.id}_${userAvatar.id}`,
              name: unlockedArtifact.name,
              type: artifact.category.toUpperCase() as InventoryItem["type"],
              level: 1,
              sourceStoryId: req.storyId,
              description: unlockedArtifact.description,
              visualPrompt: artifact.visualKeywords.join(", "),
              tags: [artifact.category, artifact.rarity],
              acquiredAt: new Date().toISOString(),
              storyEffect: artifact.storyRole,
              imageUrl: unlockedArtifact.imageUrl,
            };

            const avatarRow = await avatarDB.queryRow<{ inventory: string }>`
              SELECT inventory
              FROM avatars
              WHERE id = ${userAvatar.id}
            `;

            if (!avatarRow) {
              continue;
            }

            const inventory: InventoryItem[] = JSON.parse(avatarRow.inventory || "[]");
            const alreadyHas = inventory.some((item) => item.id === inventoryItem.id);

            if (!alreadyHas) {
              inventory.push(inventoryItem);
              await avatarDB.exec`
                UPDATE avatars
                SET inventory = ${JSON.stringify(inventory)},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${userAvatar.id}
              `;
            }
          } catch (inventoryError) {
            console.error(`Failed to add unlocked artifact for ${userAvatar.name}`, inventoryError);
          }
        }
      }
    } catch (artifactError) {
      console.error("Failed to unlock artifact", artifactError);
    }

    return {
      success: true,
      updatedAvatars: updatedCount,
      personalityChanges,
      unlockedArtifact,
    };
  }
);

function getPersonalityDisplayName(traitId: string): string {
  const displayNames: Record<string, string> = {
    creativity: "Kreativitaet",
    courage: "Mut",
    empathy: "Empathie",
    curiosity: "Neugier",
    teamwork: "Teamgeist",
    persistence: "Ausdauer",
    logic: "Logik",
    vocabulary: "Wortschatz",
  };

  return displayNames[traitId] || traitId;
}

function inferPersonalityTrait(genre?: string): string {
  if (!genre) return "empathy";

  const value = genre.toLowerCase();
  const map: Array<{ keywords: string[]; trait: string }> = [
    { keywords: ["fantasy", "magie", "zauber", "fee", "drache"], trait: "creativity" },
    { keywords: ["abenteuer", "reise", "expedition", "herausforderung", "kampf"], trait: "courage" },
    { keywords: ["freundschaft", "familie", "liebe", "gemeinschaft"], trait: "empathy" },
    { keywords: ["wissenschaft", "raetsel", "geheimnis", "detektiv"], trait: "curiosity" },
    { keywords: ["tier", "natur", "umwelt", "wald"], trait: "empathy" },
    { keywords: ["humor", "komoedie", "lustig"], trait: "creativity" },
    { keywords: ["problem", "loesung", "ausdauer", "durchhalten"], trait: "persistence" },
    { keywords: ["maerchen", "weisheit", "lehre", "moral"], trait: "vocabulary" },
    { keywords: ["team", "zusammen", "gemeinsam", "helfen"], trait: "teamwork" },
    { keywords: ["logik", "denken", "strategie", "plan"], trait: "logic" },
  ];

  for (const entry of map) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) {
      return entry.trait;
    }
  }
  return "empathy";
}

function buildStoryReadChanges(
  req: MarkStoryReadRequest,
  avatarId: string,
  personalityTraitsRaw: string
): StoryChange[] {
  const traits = parseTraits(personalityTraitsRaw);
  const primaryTrait = inferPersonalityTrait(req.genre);
  const secondaryTrait = primaryTrait === "empathy" ? "teamwork" : "empathy";
  const context = `${req.storyTitle} ${req.genre ?? ""}`.toLowerCase();

  const complexityHits = countKeywordMatches(context, [
    "strategie",
    "entscheid",
    "konflikt",
    "myster",
    "lernen",
    "freund",
    "problem",
    "held",
    "mission",
    "frage",
  ]);

  const variation = (stableHash(`${req.storyId}:${avatarId}`) % 3) - 1;

  const primaryCurrent = getTraitValue(traits, primaryTrait);
  const primaryPenalty = primaryCurrent >= 85 ? 2 : primaryCurrent >= 65 ? 1 : 0;
  const primaryPoints = clamp(3 + Math.min(2, complexityHits) + variation - primaryPenalty, 1, 6);

  const secondaryCurrent = getTraitValue(traits, secondaryTrait);
  const secondaryPenalty = secondaryCurrent >= 90 ? 1 : 0;
  const secondaryPoints = clamp(1 + (complexityHits >= 2 ? 1 : 0) - secondaryPenalty, 1, 3);

  const reflectionTrait = inferReflectionTrait(context, primaryTrait, secondaryTrait);
  const reflectionCurrent = reflectionTrait ? getTraitValue(traits, reflectionTrait) : 0;
  const reflectionPoints = reflectionTrait
    ? clamp((complexityHits >= 1 ? 1 : 0) + (variation > 0 ? 1 : 0) - (reflectionCurrent >= 92 ? 1 : 0), 0, 2)
    : 0;

  const changes: StoryChange[] = [
    {
      trait: primaryTrait,
      change: primaryPoints,
      description: `+${primaryPoints} ${getPersonalityDisplayName(primaryTrait)} durch Geschichte "${req.storyTitle}"`,
    },
    {
      trait: secondaryTrait,
      change: secondaryPoints,
      description: `+${secondaryPoints} ${getPersonalityDisplayName(secondaryTrait)} durch Reflexion der Handlung`,
    },
  ];

  if (reflectionTrait && reflectionPoints > 0) {
    changes.push({
      trait: reflectionTrait,
      change: reflectionPoints,
      description: `+${reflectionPoints} ${getPersonalityDisplayName(reflectionTrait)} durch Schluesselmomente der Geschichte`,
    });
  }

  return mergeStoryChanges(changes);
}

function inferReflectionTrait(context: string, primaryTrait: string, secondaryTrait: string): string | null {
  if (/(raetsel|plan|strategie|detektiv|schlussfolger)/.test(context)) {
    return "logic";
  }
  if (/(sprache|wort|dialog|erz[a-z]*hl|frage)/.test(context)) {
    return "vocabulary";
  }
  if (/(wieder|durchhalten|lange|schritt|uebung)/.test(context)) {
    return "persistence";
  }
  if (/(team|gemeinsam|gruppe|hilfe)/.test(context)) {
    return "teamwork";
  }

  const fallback = "curiosity";
  if (fallback !== primaryTrait && fallback !== secondaryTrait) {
    return fallback;
  }
  return null;
}

function parseTraits(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function getTraitValue(traits: Record<string, unknown>, traitId: string): number {
  const raw = traits[traitId];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, raw);
  }
  if (raw && typeof raw === "object" && typeof (raw as { value?: unknown }).value === "number") {
    const value = (raw as { value: number }).value;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }
  return 0;
}

function mergeStoryChanges(changes: StoryChange[]): StoryChange[] {
  const merged = new Map<string, StoryChange>();

  for (const change of changes) {
    if (!change.trait || !Number.isFinite(change.change) || change.change <= 0) {
      continue;
    }

    const existing = merged.get(change.trait);
    if (!existing) {
      merged.set(change.trait, { ...change });
      continue;
    }

    existing.change += change.change;
    existing.description = `${existing.description}; ${change.description}`;
    merged.set(change.trait, existing);
  }

  return Array.from(merged.values());
}

function countKeywordMatches(source: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => (source.includes(keyword) ? count + 1 : count), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}
