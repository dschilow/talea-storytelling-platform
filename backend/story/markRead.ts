import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { storyDB } from "./db";
import { getAuthData } from "~encore/auth";
import { avatar } from "~encore/clients";
import { InventoryItem, Skill } from "../avatar/avatar";
import { unlockStoryArtifact } from "./artifact-matcher";
import type { ArtifactTemplate, PendingArtifact } from "./types";
import { buildArtifactImageUrlForClient } from "../helpers/image-proxy";

const avatarDB = SQLDatabase.named("avatar");

interface MarkStoryReadRequest {
  storyId: string;
  storyTitle: string;
  genre?: string;
  avatarId?: string; // Optional: specific avatar to update, otherwise all avatars
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
  // 🎁 NEW: Artifact unlocked after reading
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

// Marks a story as read and applies personality development to all user avatars
export const markRead = api<MarkStoryReadRequest, MarkStoryReadResponse>(
  { expose: true, method: "POST", path: "/story/mark-read", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const userId = auth.userID;

    console.log(`📖 User ${userId} completed story: "${req.storyTitle}" (Genre: ${req.genre || 'unknown'})`);

    try {
      // Load avatars to update (specific avatar or all user avatars)
      let userAvatars: { id: string; name: string }[];

      if (req.avatarId) {
        // Update only specific avatar
        const specificAvatar = await avatarDB.queryRow<{ id: string; name: string; user_id: string }>`
          SELECT id, name, user_id FROM avatars WHERE id = ${req.avatarId} AND user_id = ${userId}
        `;

        if (!specificAvatar) {
          console.log(`❌ Avatar ${req.avatarId} not found or not owned by user ${userId}`);
          return {
            success: false,
            updatedAvatars: 0,
            personalityChanges: []
          };
        }

        userAvatars = [{ id: specificAvatar.id, name: specificAvatar.name }];
        console.log(`👤 Updating specific avatar: ${specificAvatar.name}`);
      } else {
        // Update all user avatars (default behavior)
        userAvatars = await avatarDB.queryAll<{ id: string; name: string }>`
          SELECT id, name FROM avatars WHERE user_id = ${userId}
        `;
        console.log(`👥 Found ${userAvatars.length} avatars for user ${userId}`);
      }

      if (userAvatars.length === 0) {
        return {
          success: true,
          updatedAvatars: 0,
          personalityChanges: []
        };
      }

      // Determine personality traits based on story genre
      const personalityTrait = inferPersonalityTrait(req.genre);
      console.log(`🧠 Inferred personality trait: ${personalityTrait} for genre: ${req.genre}`);

      // Calculate points based on story genre and complexity
      const basePoints = 3; // Base points for reading a story (more than doku)
      const personalityPoints = Math.max(1, Math.min(15, basePoints));

      // Build changes for all avatars
      const changes = [
        {
          trait: personalityTrait,
          change: personalityPoints,
          description: `+${personalityPoints} ${getPersonalityDisplayName(personalityTrait)} durch Lesen der Geschichte "${req.storyTitle}"`
        },
        {
          trait: "empathy",
          change: 2,
          description: `+2 Empathie durch Geschichte über ${req.genre || 'verschiedene Themen'}`
        }
      ];

      const personalityChanges: MarkStoryReadResponse['personalityChanges'] = [];
      let updatedCount = 0;

      // Apply changes to all user avatars
      for (const userAvatar of userAvatars) {
        try {
          // Check if this avatar has already read this story
          const alreadyRead = await avatarDB.queryRow<{ id: string }>`
            SELECT id FROM avatar_story_read
            WHERE avatar_id = ${userAvatar.id} AND story_id = ${req.storyId}
          `;

          if (alreadyRead) {
            console.log(`⏭️ Avatar ${userAvatar.name} has already read this story (${req.storyId}), skipping...`);
            continue;
          }

          console.log(`🔄 Updating ${userAvatar.name} with changes:`, changes);

          // Apply personality updates
          const personalityResult = await avatar.updatePersonality({
            id: userAvatar.id,
            changes: changes,
            storyId: req.storyId,
            contentTitle: req.storyTitle,
            contentType: 'story'
          });

          // Add memory
          await avatar.addMemory({
            id: userAvatar.id,
            storyId: req.storyId,
            storyTitle: req.storyTitle,
            experience: `Ich habe die Geschichte "${req.storyTitle}" gelesen. Genre: ${req.genre || 'Unbekannt'}.`,
            emotionalImpact: 'positive',
            personalityChanges: changes,
            developmentDescription: `Persönlichkeitsentwicklung: ${changes.map(c => c.description).join(', ')}`,
            contentType: 'story'
          });

          // Mark this story as read by this avatar
          await avatarDB.exec`
            INSERT INTO avatar_story_read (avatar_id, story_id, story_title)
            VALUES (${userAvatar.id}, ${req.storyId}, ${req.storyTitle})
          `;

          // --- GAMIFICATION: Check for Artifact Upgrades Only ---
          // Note: New artifacts are created during story generation (Phase 4.5/4.6)
          // Here we only check if existing artifacts can be upgraded based on genre match
          let rewards = undefined;
          try {
            // Load avatar's current inventory
            const avatarRow = await avatarDB.queryRow<{ inventory: string }>`
              SELECT inventory FROM avatars WHERE id = ${userAvatar.id}
            `;
            
            if (avatarRow) {
              const inventory: InventoryItem[] = JSON.parse(avatarRow.inventory || '[]');
              const storyTags = req.genre ? [req.genre.toLowerCase()] : ['adventure'];
              const upgradedItems: InventoryItem[] = [];
              
              // Check for upgrades (items with matching tags and level < 3)
              for (const item of inventory) {
                const hasTagMatch = item.tags?.some(tag => storyTags.includes(tag)) ?? false;
                if (hasTagMatch && item.level < 3) {
                  item.level += 1;
                  // Update item name based on level
                  const baseName = item.name.replace(/^(Novice|Advanced|Master)\s+/, '');
                  if (item.level === 2) item.name = `Advanced ${baseName}`;
                  if (item.level === 3) item.name = `Master ${baseName}`;
                  item.description = `Verstärkte Version: ${item.name}. Level ${item.level}!`;
                  upgradedItems.push(item);
                  console.log(`[Gamification] 📈 Upgraded ${item.name} to level ${item.level}`);
                  break; // Only one upgrade per story
                }
              }
              
              // Save updated inventory if upgrades happened
              if (upgradedItems.length > 0) {
                await avatarDB.exec`
                  UPDATE avatars
                  SET inventory = ${JSON.stringify(inventory)},
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = ${userAvatar.id}
                `;
                
                rewards = {
                  newItems: [],
                  upgradedItems: upgradedItems,
                  newSkills: []
                };
                console.log(`🎁 Rewards for ${userAvatar.name}:`, rewards);
              } else {
                console.log(`📦 No artifact upgrades for ${userAvatar.name} (no matching tags or already max level)`);
              }
            }
          } catch (rewardError) {
            console.error(`⚠️ Failed to check rewards for ${userAvatar.name}:`, rewardError);
          }

          personalityChanges.push({
            avatarName: userAvatar.name,
            changes: changes,
            appliedChanges: personalityResult.appliedChanges.map(ac => ({
              trait: ac.trait,
              change: ac.change,
            })),
            masteryEvents: personalityResult.masteryEvents.map(me => ({
              trait: me.trait,
              oldTier: me.oldTier.name,
              newTier: me.newTier.name,
              newTierLevel: me.newTier.level,
              currentValue: me.newValue,
            })),
            rewards: rewards
          });

          updatedCount++;
          console.log(`✅ Updated ${userAvatar.name} successfully and marked story as read`);

        } catch (error) {
          console.error(`❌ Failed to update ${userAvatar.name}:`, error);
        }
      }

      console.log(`🎉 Story reading complete: ${updatedCount} avatars updated`);

      // ===== UNLOCK ARTIFACT FROM POOL =====
      let unlockedArtifact: MarkStoryReadResponse['unlockedArtifact'] | undefined;

      try {
        console.log(`🎁 Checking for artifact to unlock for story: ${req.storyId}`);
        const artifact = await unlockStoryArtifact(req.storyId);

        if (artifact) {
          console.log(`🎁 Artifact unlocked: ${artifact.name.de} (${artifact.category}, ${artifact.rarity})`);

          // Determine language (assume German for now, could be passed in request)
          const userLang = 'de';

          const resolvedArtifactImageUrl = await buildArtifactImageUrlForClient(artifact.id, artifact.imageUrl);

          unlockedArtifact = {
            id: artifact.id,
            name: userLang === 'de' ? artifact.name.de : artifact.name.en,
            description: userLang === 'de' ? artifact.description.de : artifact.description.en,
            category: artifact.category,
            rarity: artifact.rarity,
            emoji: artifact.emoji,
            visualKeywords: artifact.visualKeywords,
            imageUrl: resolvedArtifactImageUrl ?? artifact.imageUrl,
          };

          // Add artifact to each avatar's inventory
          for (const userAvatar of userAvatars) {
            try {
              const inventoryItem: InventoryItem = {
                id: `artifact_${artifact.id}_${userAvatar.id}`,
                name: unlockedArtifact.name,
                type: artifact.category.toUpperCase() as InventoryItem['type'],
                level: 1,
                sourceStoryId: req.storyId,
                description: unlockedArtifact.description,
                visualPrompt: artifact.visualKeywords.join(', '),
                tags: [artifact.category, artifact.rarity],
                acquiredAt: new Date().toISOString(),
                storyEffect: artifact.storyRole,
                imageUrl: unlockedArtifact.imageUrl,
              };

              // Load current inventory and add new item
              const avatarRow = await avatarDB.queryRow<{ inventory: string }>`
                SELECT inventory FROM avatars WHERE id = ${userAvatar.id}
              `;

              if (avatarRow) {
                const inventory: InventoryItem[] = JSON.parse(avatarRow.inventory || '[]');

                // Check if already has this artifact
                const alreadyHas = inventory.some(i => i.id === inventoryItem.id);
                if (!alreadyHas) {
                  inventory.push(inventoryItem);
                  await avatarDB.exec`
                    UPDATE avatars
                    SET inventory = ${JSON.stringify(inventory)},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${userAvatar.id}
                  `;
                  console.log(`🎁 Artifact added to ${userAvatar.name}'s inventory`);
                }
              }
            } catch (invError) {
              console.error(`⚠️ Failed to add artifact to ${userAvatar.name}'s inventory:`, invError);
            }
          }
        } else {
          console.log(`📦 No artifact to unlock for story ${req.storyId}`);
        }
      } catch (artifactError) {
        console.error(`⚠️ Failed to unlock artifact:`, artifactError);
      }

      return {
        success: true,
        updatedAvatars: updatedCount,
        personalityChanges,
        unlockedArtifact,
      };

    } catch (error) {
      console.error(`💥 Error processing story completion:`, error);
      throw error;
    }
  }
);

// Helper function to get display name for personality traits
function getPersonalityDisplayName(personalityTrait: string): string {
  const displayNames: Record<string, string> = {
    "creativity": "Kreativität",
    "courage": "Mut",
    "empathy": "Empathie",
    "curiosity": "Neugier",
    "teamwork": "Teamgeist",
    "persistence": "Ausdauer",
    "logic": "Logik",
    "vocabulary": "Wortschatz",
  };

  return displayNames[personalityTrait] || personalityTrait;
}

// Helper function to map genres to personality traits (using valid backend trait IDs)
function inferPersonalityTrait(genre?: string): string {
  if (!genre) return "empathy";

  const g = genre.toLowerCase();

  const map: Array<{ keywords: string[]; trait: string }> = [
    { keywords: ["fantasy", "magie", "zauberer", "feen", "drachen"], trait: "creativity" },
    { keywords: ["abenteuer", "reise", "entdeckung", "expedition", "herausforderung", "kampf"], trait: "courage" },
    { keywords: ["freundschaft", "familie", "liebe", "gemeinschaft"], trait: "empathy" },
    { keywords: ["wissenschaft", "rätsel", "geheimnis", "detektiv"], trait: "curiosity" },
    { keywords: ["tier", "natur", "umwelt", "wald"], trait: "empathy" },
    { keywords: ["humor", "komödie", "spaß", "lustig"], trait: "creativity" },
    { keywords: ["problem", "lösung", "ausdauer", "durchhalten"], trait: "persistence" },
    { keywords: ["märchen", "weisheit", "lehre", "moral"], trait: "vocabulary" },
    { keywords: ["team", "zusammen", "gemeinsam", "helfen"], trait: "teamwork" },
    { keywords: ["logik", "denken", "strategie", "plan"], trait: "logic" },
  ];

  for (const entry of map) {
    if (entry.keywords.some(k => g.includes(k))) {
      return entry.trait;
    }
  }

  // Default to empathy if no specific match found
  return "empathy";
}
