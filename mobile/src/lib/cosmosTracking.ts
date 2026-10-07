// AUTO-GENERATED from the web app by scripts/sync-feature-models.mjs.
export type CosmosSkillType =
  | "REMEMBER"
  | "UNDERSTAND"
  | "COMPARE"
  | "APPLY"
  | "TRANSFER"
  | "EXPLAIN";

export function inferDomainFromDokuTopic(params: {
  topic?: string;
  perspective?: string;
  title?: string;
  sectionTitle?: string;
}): string {
  const value = `${params.topic || ""} ${params.perspective || ""} ${params.title || ""} ${params.sectionTitle || ""}`.toLowerCase();
  const map: Array<{ keywords: string[]; domainId: string }> = [
    { keywords: ["astronom", "weltraum", "galax", "planet", "stern", "kosmos"], domainId: "space" },
    { keywords: ["natur", "tier", "bio", "pflanz", "zool"], domainId: "nature" },
    { keywords: ["geschichte", "kultur", "antike", "histor"], domainId: "history" },
    { keywords: ["technik", "erfind", "physik", "robot", "maschine"], domainId: "tech" },
    { keywords: ["mensch", "koerper", "korper", "medizin", "gesund"], domainId: "body" },
    { keywords: ["erde", "geografie", "geographie", "klima", "wetter", "ozean"], domainId: "earth" },
    { keywords: ["kunst", "musik", "malerei", "kompon"], domainId: "arts" },
    { keywords: ["mathe", "logik", "raetsel", "ratsel", "algorithm"], domainId: "logic" },
  ];

  for (const entry of map) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) {
      return entry.domainId;
    }
  }
  const perspective = String(params.perspective || "").toLowerCase().trim();
  if (perspective === "technology") return "tech";
  if (perspective === "nature") return "nature";
  if (perspective === "history") return "history";
  if (perspective === "culture") return "arts";
  if (perspective === "science") return "space";
  return "history";
}

export function buildTopicId(params: {
  sourceContentType: "doku" | "story";
  sourceContentId: string;
  domainId: string;
  label?: string;
}): string {
  const sanitizedLabel = String(params.label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  const suffix = sanitizedLabel || params.sourceContentId.slice(0, 12);
  const normalizedDomain = params.domainId === "art" ? "arts" : params.domainId;
  return `${normalizedDomain}_${suffix}`;
}

export function inferSkillTypeFromQuestion(question: string): CosmosSkillType {
  const value = question.toLowerCase();
  if (/(warum|weshalb|wie entsteht|ursache|folge)/.test(value)) return "UNDERSTAND";
  if (/(vergleiche|unterschied|gemeinsamkeit|einordnen)/.test(value)) return "COMPARE";
  if (/(anwenden|situation|wenn .* dann|was waere|was wäre)/.test(value)) return "APPLY";
  if (/(erklaere|erklare|in eigenen worten|begruende)/.test(value)) return "UNDERSTAND";
  return "REMEMBER";
}

export function inferDifficultyFromQuestion(question: string, optionsCount: number): number {
  const value = question.toLowerCase();
  let score = 2;
  if (/(warum|weshalb|erklaere|erklare|begruende|vergleiche|anwenden)/.test(value)) score += 1;
  if (/(in eigenen worten|transfer|hypothese|schlussfolger)/.test(value)) score += 1;
  if (optionsCount >= 4) score += 1;
  return Math.max(1, Math.min(5, score));
}
