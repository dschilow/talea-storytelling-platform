import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";
import { avatar } from "~encore/clients";

const avatarDB = SQLDatabase.named("avatar");

interface MarkDokuReadRequest {
  dokuId: string;
  dokuTitle: string;
  topic: string;
  perspective?: string;
  avatarId?: string;
}

interface MarkDokuReadResponse {
  success: boolean;
  updatedAvatars: number;
  personalityChanges: Array<{
    avatarName: string;
    changes: Array<{ trait: string; change: number; description: string }>;
    appliedChanges?: Array<{ trait: string; change: number }>;
    masteryEvents?: Array<{
      trait: string;
      oldTier: string;
      newTier: string;
      newTierLevel: number;
      currentValue: number;
    }>;
  }>;
}

interface DokuChange {
  trait: string;
  change: number;
  description: string;
}

export const markRead = api<MarkDokuReadRequest, MarkDokuReadResponse>(
  { expose: true, method: "POST", path: "/doku/mark-read", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const userId = auth.userID;

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

    const personalityChanges: MarkDokuReadResponse["personalityChanges"] = [];
    let updatedCount = 0;

    for (const userAvatar of userAvatars) {
      try {
        const alreadyRead = await avatarDB.queryRow<{ id: string }>`
          SELECT id
          FROM avatar_doku_read
          WHERE avatar_id = ${userAvatar.id} AND doku_id = ${req.dokuId}
        `;

        if (alreadyRead) {
          continue;
        }

        const avatarRow = await avatarDB.queryRow<{ personality_traits: string }>`
          SELECT personality_traits
          FROM avatars
          WHERE id = ${userAvatar.id}
        `;

        const changes = buildDokuReadChanges(req, userAvatar.id, avatarRow?.personality_traits ?? "{}");
        if (changes.length === 0) {
          continue;
        }

        const personalityResult = await avatar.updatePersonality({
          id: userAvatar.id,
          changes,
          storyId: req.dokuId,
          contentTitle: req.dokuTitle,
          contentType: "doku",
        });

        await avatar.addMemory({
          id: userAvatar.id,
          storyId: req.dokuId,
          storyTitle: req.dokuTitle,
          experience: `Ich habe die Doku "${req.dokuTitle}" gelesen. Thema: ${req.topic}.`,
          emotionalImpact: "positive",
          personalityChanges: changes,
          developmentDescription: `Wissensentwicklung: ${changes.map((item) => item.description).join(", ")}`,
          contentType: "doku",
        });

        await avatarDB.exec`
          INSERT INTO avatar_doku_read (avatar_id, doku_id, doku_title)
          VALUES (${userAvatar.id}, ${req.dokuId}, ${req.dokuTitle})
          ON CONFLICT (avatar_id, doku_id) DO NOTHING
        `;

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
        });

        updatedCount += 1;
      } catch (error) {
        console.error(`Failed to update doku progression for ${userAvatar.name}`, error);
      }
    }

    return {
      success: true,
      updatedAvatars: updatedCount,
      personalityChanges,
    };
  }
);

function getKnowledgeDisplayName(knowledgeTrait: string): string {
  const displayNames: Record<string, string> = {
    "knowledge.biology": "Biologie",
    "knowledge.history": "Geschichte",
    "knowledge.physics": "Physik",
    "knowledge.geography": "Geografie",
    "knowledge.astronomy": "Astronomie",
    "knowledge.mathematics": "Mathematik",
    "knowledge.chemistry": "Chemie",
  };

  return displayNames[knowledgeTrait] || knowledgeTrait.split(".")[1] || "Wissen";
}

function inferKnowledgeSubcategory(topic: string, perspective?: string): string {
  const value = `${topic} ${perspective ?? ""}`.toLowerCase();

  const map: Array<{ keywords: string[]; id: string }> = [
    { keywords: ["bio", "tier", "pflanz", "zoo", "mensch", "koerper", "leben"], id: "knowledge.biology" },
    { keywords: ["geschichte", "histor", "antike", "mittelalter", "krieg", "kultur", "pyramiden"], id: "knowledge.history" },
    { keywords: ["physik", "kraft", "energie", "bewegung", "elektr", "licht", "atom"], id: "knowledge.physics" },
    { keywords: ["erde", "karte", "kontinent", "geografie", "ocean", "meer", "berg"], id: "knowledge.geography" },
    { keywords: ["stern", "planet", "weltall", "galax", "kosmos", "astronom", "mond"], id: "knowledge.astronomy" },
    { keywords: ["mathe", "zahl", "rechnen", "geometr", "bruch", "plus", "minus"], id: "knowledge.mathematics" },
    { keywords: ["chemie", "stoff", "reaktion", "element", "molekuel", "labor"], id: "knowledge.chemistry" },
  ];

  for (const entry of map) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) {
      return entry.id;
    }
  }

  return "knowledge.history";
}

function buildDokuReadChanges(
  req: MarkDokuReadRequest,
  avatarId: string,
  personalityTraitsRaw: string
): DokuChange[] {
  const traits = parseTraits(personalityTraitsRaw);
  const knowledgeTrait = inferKnowledgeSubcategory(req.topic, req.perspective);
  const context = `${req.topic} ${req.perspective ?? ""} ${req.dokuTitle}`.toLowerCase();
  const variation = stableHash(`${req.dokuId}:${avatarId}`) % 2;
  const depthSignals = countKeywordMatches(context, [
    "warum",
    "wie",
    "zusammenhang",
    "ursache",
    "modell",
    "experiment",
    "vergleich",
    "analyse",
    "perspektive",
    "fakten",
  ]);

  const knowledgeCurrent = getKnowledgeSubcategoryValue(traits, knowledgeTrait);
  const knowledgePenalty = knowledgeCurrent >= 130 ? 2 : knowledgeCurrent >= 90 ? 1 : 0;
  const knowledgePoints = clamp(2 + Math.min(2, depthSignals) + variation - knowledgePenalty, 1, 5);

  const curiosityCurrent = getTraitValue(traits, "curiosity");
  const curiosityPenalty = curiosityCurrent >= 90 ? 1 : 0;
  const curiosityPoints = clamp(1 + (depthSignals >= 2 ? 1 : 0) - curiosityPenalty, 1, 3);

  const supportTrait = inferDokuSupportTrait(context);
  const supportCurrent = supportTrait ? getTraitValue(traits, supportTrait) : 0;
  const supportPoints = supportTrait
    ? clamp((depthSignals >= 1 ? 1 : 0) + variation - (supportCurrent >= 92 ? 1 : 0), 0, 2)
    : 0;

  const changes: DokuChange[] = [
    {
      trait: knowledgeTrait,
      change: knowledgePoints,
      description: `+${knowledgePoints} ${getKnowledgeDisplayName(knowledgeTrait)} durch Doku "${req.dokuTitle}"`,
    },
    {
      trait: "curiosity",
      change: curiosityPoints,
      description: `+${curiosityPoints} Neugier durch vertiefte Doku-Lektuere`,
    },
  ];

  if (supportTrait && supportPoints > 0) {
    changes.push({
      trait: supportTrait,
      change: supportPoints,
      description: `+${supportPoints} ${getSupportDisplayName(supportTrait)} durch Transfer des Gelernten`,
    });
  }

  return mergeDokuChanges(changes);
}

function inferDokuSupportTrait(context: string): string | null {
  if (/(mathe|physik|modell|analyse|logik|beweis)/.test(context)) {
    return "logic";
  }
  if (/(sprache|begriff|vokabel|definition|erklaer)/.test(context)) {
    return "vocabulary";
  }
  if (/(team|gruppe|zusammen|gesellschaft|kultur)/.test(context)) {
    return "teamwork";
  }
  return null;
}

function getSupportDisplayName(traitId: string): string {
  const labels: Record<string, string> = {
    logic: "Logik",
    vocabulary: "Wortschatz",
    teamwork: "Teamgeist",
  };
  return labels[traitId] || traitId;
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

function getKnowledgeSubcategoryValue(traits: Record<string, unknown>, traitId: string): number {
  const [baseKey, subcategory] = traitId.split(".");
  if (!baseKey || !subcategory) {
    return 0;
  }

  const baseTrait = traits[baseKey];
  if (!baseTrait || typeof baseTrait !== "object") {
    return 0;
  }

  const rawSubcategories = (baseTrait as { subcategories?: unknown }).subcategories;
  if (!rawSubcategories || typeof rawSubcategories !== "object") {
    return 0;
  }

  const rawValue = (rawSubcategories as Record<string, unknown>)[subcategory];
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return 0;
  }

  return Math.max(0, rawValue);
}

function mergeDokuChanges(changes: DokuChange[]): DokuChange[] {
  const merged = new Map<string, DokuChange>();

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
