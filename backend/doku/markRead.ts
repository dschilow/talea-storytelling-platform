import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";
import { avatar } from "~encore/clients";

const dokuDB = SQLDatabase.named("doku");
const avatarDB = SQLDatabase.named("avatar");

interface MarkDokuReadRequest {
  dokuId: string;
  dokuTitle: string;
  topic: string;
  perspective?: string;
  avatarId?: string; // Optional: specific avatar to update, otherwise all avatars
}

interface MarkDokuReadResponse {
  success: boolean;
  updatedAvatars: number;
  personalityChanges: Array<{
    avatarName: string;
    changes: Array<{ trait: string; change: number; description: string }>;
  }>;
}

// Marks a doku as read and applies personality development to all user avatars
export const markRead = api<MarkDokuReadRequest, MarkDokuReadResponse>(
  { expose: true, method: "POST", path: "/doku/mark-read", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const userId = auth.userID;

    console.log(`📖 User ${userId} completed doku: "${req.dokuTitle}" (Topic: ${req.topic})`);

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
        // Update all user avatars (legacy behavior)
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

      // Determine knowledge trait based on topic
      const knowledgeTrait = inferKnowledgeSubcategory(req.topic, req.perspective);
      console.log(`🧠 Inferred knowledge trait: ${knowledgeTrait} for topic: ${req.topic}`);

      // Calculate points based on topic complexity
      const basePoints = 2; // Base points for reading a doku
      const knowledgePoints = Math.max(1, Math.min(10, basePoints));

      // Build changes for all avatars
      const changes = [
        {
          trait: knowledgeTrait, // z.B. "knowledge.history"
          change: knowledgePoints,
          description: `+${knowledgePoints} ${getKnowledgeDisplayName(knowledgeTrait)} durch Lesen der Doku "${req.dokuTitle}"`
        },
        {
          trait: "curiosity", // Hauptkategorie wird direkt geupdatet
          change: 1,
          description: `+1 Neugier durch Doku-Lektüre über ${req.topic}`
        }
      ];

      const personalityChanges: MarkDokuReadResponse['personalityChanges'] = [];
      let updatedCount = 0;

      // Apply changes to all user avatars
      for (const userAvatar of userAvatars) {
        try {
          // Check if this avatar has already read this doku
          const alreadyRead = await avatarDB.queryRow<{ id: string }>`
            SELECT id FROM avatar_doku_read
            WHERE avatar_id = ${userAvatar.id} AND doku_id = ${req.dokuId}
          `;

          if (alreadyRead) {
            console.log(`⏭️ Avatar ${userAvatar.name} has already read this doku (${req.dokuId}), skipping...`);
            continue;
          }

          console.log(`🔄 Updating ${userAvatar.name} with changes:`, changes);

          // Apply personality updates
          await avatar.updatePersonality({
            id: userAvatar.id,
            changes: changes,
            storyId: req.dokuId,
            contentTitle: req.dokuTitle,
            contentType: 'doku'
          });

          // Add memory
          await avatar.addMemory({
            id: userAvatar.id,
            storyId: req.dokuId,
            storyTitle: req.dokuTitle,
            experience: `Ich habe die Doku "${req.dokuTitle}" gelesen. Thema: ${req.topic}.`,
            emotionalImpact: 'positive',
            personalityChanges: changes,
            developmentDescription: `Wissensentwicklung: ${changes.map(c => c.description).join(', ')}`,
            contentType: 'doku'
          });

          // Mark this doku as read by this avatar
          await avatarDB.exec`
            INSERT INTO avatar_doku_read (avatar_id, doku_id, doku_title)
            VALUES (${userAvatar.id}, ${req.dokuId}, ${req.dokuTitle})
          `;

          personalityChanges.push({
            avatarName: userAvatar.name,
            changes: changes
          });

          updatedCount++;
          console.log(`✅ Updated ${userAvatar.name} successfully and marked doku as read`);

        } catch (error) {
          console.error(`❌ Failed to update ${userAvatar.name}:`, error);
        }
      }

      console.log(`🎉 Doku reading complete: ${updatedCount} avatars updated`);

      return {
        success: true,
        updatedAvatars: updatedCount,
        personalityChanges
      };

    } catch (error) {
      console.error(`💥 Error processing doku completion:`, error);
      throw error;
    }
  }
);

// Helper function to get display name for knowledge traits
function getKnowledgeDisplayName(knowledgeTrait: string): string {
  const displayNames: Record<string, string> = {
    "knowledge.biology": "Biologie",
    "knowledge.history": "Geschichte",
    "knowledge.physics": "Physik",
    "knowledge.geography": "Geographie",
    "knowledge.astronomy": "Astronomie",
    "knowledge.mathematics": "Mathematik",
    "knowledge.chemistry": "Chemie"
  };

  return displayNames[knowledgeTrait] || knowledgeTrait.split('.')[1] || "Wissen";
}

// Helper function to map topics to knowledge traits
function inferKnowledgeSubcategory(topic: string, perspective?: string): string {
  const t = `${topic} ${perspective ?? ""}`.toLowerCase();

  const map: Array<{ keywords: string[]; id: string }> = [
    { keywords: ["bio", "tier", "pflanz", "zoo", "mensch", "körper", "leben"], id: "knowledge.biology" },
    { keywords: ["geschichte", "histor", "antike", "mittelalter", "krieg", "kultur", "pyramiden"], id: "knowledge.history" },
    { keywords: ["physik", "kraft", "energie", "bewegung", "elektr", "licht", "atom"], id: "knowledge.physics" },
    { keywords: ["erde", "karte", "kontinent", "geografie", "ocean", "meer", "berg"], id: "knowledge.geography" },
    { keywords: ["stern", "planet", "weltall", "galax", "kosmos", "astronom", "mond"], id: "knowledge.astronomy" },
    { keywords: ["mathe", "zahl", "rechnen", "geometr", "bruch", "plus", "minus"], id: "knowledge.mathematics" },
    { keywords: ["chemie", "stoff", "reaktion", "element", "molekül", "labor"], id: "knowledge.chemistry" },
  ];

  for (const entry of map) {
    if (entry.keywords.some(k => t.includes(k))) {
      return entry.id;
    }
  }

  // Default to history if no specific match found
  return "knowledge.history";
}