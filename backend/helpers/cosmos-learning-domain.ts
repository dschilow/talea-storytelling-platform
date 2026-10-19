/**
 * Which Lernkosmos world a learning-mode story counts in. Pure (no Encore imports), so it can be tested.
 */

const KNOWLEDGE_DOMAIN: Record<string, string> = {
  "knowledge.biology": "nature",
  "knowledge.astronomy": "space",
  "knowledge.physics": "tech",
  "knowledge.chemistry": "tech",
  "knowledge.geography": "earth",
  "knowledge.history": "history",
  "knowledge.mathematics": "logic",
};

const LEARNING_SUBJECT_DOMAIN: Record<string, string> = { math: "logic", geography: "earth", history: "history", science: "nature" };

function learningModeOf(config: unknown): { subjects: string[]; objectives: string[] } | null {
  let value: any = config;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const mode = value?.learningMode;
  if (!mode?.enabled || !Array.isArray(mode.subjects) || mode.subjects.length === 0) return null;
  return {
    subjects: mode.subjects.map(String),
    objectives: Array.isArray(mode.learningObjectives) ? mode.learningObjectives.map(String).filter(Boolean) : [],
  };
}

/**
 * A learning-mode story counts in the world of what it taught (2026-10-17): the knowledge trait it grew, else its
 * subject — a geography story used to land in "history" through its adventure genre. Language and living together
 * have no world of their own and keep the genre's (null).
 */
export function inferDomainFromLearning(config: unknown, grownTraits: string[] = []): { domainId: string; topic: string | null } | null {
  const mode = learningModeOf(config);
  if (!mode) return null;
  const fromTrait = grownTraits.map((trait) => KNOWLEDGE_DOMAIN[trait]).find(Boolean);
  const fromSubject = mode.subjects.map((subject) => LEARNING_SUBJECT_DOMAIN[subject]).find(Boolean);
  const domainId = fromTrait || fromSubject;
  return domainId ? { domainId, topic: mode.objectives[0] || null } : null;
}
