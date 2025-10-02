import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";
import { avatar } from "~encore/clients";

const storyDB = SQLDatabase.named("story");
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
  }>;
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
          await avatar.updatePersonality({
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

          personalityChanges.push({
            avatarName: userAvatar.name,
            changes: changes
          });

          updatedCount++;
          console.log(`✅ Updated ${userAvatar.name} successfully and marked story as read`);

        } catch (error) {
          console.error(`❌ Failed to update ${userAvatar.name}:`, error);
        }
      }

      console.log(`🎉 Story reading complete: ${updatedCount} avatars updated`);

      return {
        success: true,
        updatedAvatars: updatedCount,
        personalityChanges
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
    "kindness": "Freundlichkeit",
    "humor": "Humor",
    "determination": "Entschlossenheit",
    "wisdom": "Weisheit"
  };

  return displayNames[personalityTrait] || personalityTrait;
}

// Helper function to map genres to personality traits
function inferPersonalityTrait(genre?: string): string {
  if (!genre) return "empathy";

  const g = genre.toLowerCase();

  const map: Array<{ keywords: string[]; trait: string }> = [
    { keywords: ["fantasy", "magie", "zauberer", "feen", "drachen"], trait: "creativity" },
    { keywords: ["abenteuer", "reise", "entdeckung", "expedition"], trait: "courage" },
    { keywords: ["freundschaft", "familie", "liebe", "gemeinschaft"], trait: "empathy" },
    { keywords: ["wissenschaft", "rätsel", "geheimnis", "detektiv"], trait: "curiosity" },
    { keywords: ["tier", "natur", "umwelt", "wald"], trait: "kindness" },
    { keywords: ["humor", "komödie", "spaß", "lustig"], trait: "humor" },
    { keywords: ["herausforderung", "problem", "lösung", "kampf"], trait: "determination" },
    { keywords: ["märchen", "weisheit", "lehre", "moral"], trait: "wisdom" },
  ];

  for (const entry of map) {
    if (entry.keywords.some(k => g.includes(k))) {
      return entry.trait;
    }
  }

  // Default to empathy if no specific match found
  return "empathy";
}