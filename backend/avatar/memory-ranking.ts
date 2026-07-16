export type MemoryTier = "working" | "episodic" | "core";

export type MemoryContentType = "story" | "doku" | "quiz" | "activity";

export type MemoryChangeInput = {
  trait: string;
  change: number;
};

export type MemoryClassificationInput = {
  experience: string;
  storyTitle: string;
  emotionalImpact: "positive" | "negative" | "neutral";
  personalityChanges: MemoryChangeInput[];
  developmentDescription?: string;
  contentType: MemoryContentType;
};

export type MemoryClassification = {
  tier: MemoryTier;
  importance: number;
  summary: string;
  tags: string[];
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function sanitizeMemoryText(value: string, maxLength = 240): string {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function classifyMemory(input: MemoryClassificationInput): MemoryClassification {
  const marker = sanitizeMemoryText(input.developmentDescription || "", 180)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^\[([A-Z_-]+)\]\s*:?\s*/, "$1: ");
  const isAcute = marker.startsWith("ACUTE");
  const isPersonalityDevelopment =
    marker.startsWith("PERSONALITY") || marker.startsWith("PERSOENLICHKEITSENTWICKLUNG");
  const hasCoreSignal =
    marker.includes("CORE") ||
    /\b(PRAEGEND|WENDEPUNKT|DEFINING|MILESTONE|IDENTITAET)\b/.test(marker);
  const totalChange = input.personalityChanges.reduce(
    (sum, change) => sum + Math.abs(Number.isFinite(change.change) ? change.change : 0),
    0
  );

  let importance = 1;
  if (totalChange >= 2) importance += 1;
  if (totalChange >= 6) importance += 1;
  if (input.emotionalImpact !== "neutral") importance += 1;
  if (hasCoreSignal || (isPersonalityDevelopment && totalChange >= 2)) importance += 1;
  importance = clamp(importance, 1, 5);

  const tier: MemoryTier =
    hasCoreSignal || importance >= 5
      ? "core"
      : isAcute && importance <= 3
        ? "working"
        : "episodic";

  const tags = Array.from(
    new Set([
      input.contentType,
      ...input.personalityChanges
        .map((change) => String(change.trait || "").split(".")[0].trim().toLowerCase())
        .filter(Boolean),
    ])
  ).slice(0, 8);

  return {
    tier,
    importance,
    summary:
      sanitizeMemoryText(input.experience) ||
      sanitizeMemoryText(input.storyTitle) ||
      "Gemeinsames Erlebnis",
    tags,
  };
}
