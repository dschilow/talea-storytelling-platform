/**
 * Which knowledge trait a finished doku grows.
 *
 * The doku's world (domainId) is the classification the child picked in the
 * wizard or that a Lernkosmos suggestion carried, and the Lernkosmos files the
 * doku under the same world. The knowledge subcategory follows it, so the
 * "Wissen" tree and the planet agree. Only when no world is known do topic
 * keywords decide, and when nothing matches the plain base trait "knowledge"
 * grows: a subcategory is never invented from a guess.
 */

const DOMAIN_KNOWLEDGE_TRAIT: Record<string, string> = {
  space: "knowledge.astronomy",
  nature: "knowledge.biology",
  body: "knowledge.biology",
  dinosaurs: "knowledge.biology",
  oceans: "knowledge.biology",
  sports_science: "knowledge.biology",
  history: "knowledge.history",
  myths: "knowledge.history",
  tech: "knowledge.physics",
  earth: "knowledge.geography",
  logic: "knowledge.mathematics",
  coding: "knowledge.mathematics",
  chemistry: "knowledge.chemistry",
};

const TOPIC_KEYWORDS: Array<{ keywords: string[]; trait: string }> = [
  { keywords: ["bio", "tier", "pflanz", "zoo", "mensch", "koerper", "leben"], trait: "knowledge.biology" },
  { keywords: ["geschichte", "histor", "antike", "mittelalter", "krieg", "kultur", "pyramiden"], trait: "knowledge.history" },
  { keywords: ["physik", "kraft", "energie", "bewegung", "elektr", "licht", "atom"], trait: "knowledge.physics" },
  { keywords: ["erde", "karte", "kontinent", "geografie", "ocean", "meer", "berg"], trait: "knowledge.geography" },
  { keywords: ["stern", "planet", "weltall", "galax", "kosmos", "astronom", "mond"], trait: "knowledge.astronomy" },
  { keywords: ["mathe", "zahl", "rechnen", "geometr", "bruch", "plus", "minus"], trait: "knowledge.mathematics" },
  { keywords: ["chemie", "stoff", "reaktion", "element", "molekuel", "labor"], trait: "knowledge.chemistry" },
];

function foldUmlauts(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

export function resolveDokuKnowledgeTrait(args: {
  domainId?: string | null;
  topic?: string;
  perspective?: string;
}): string {
  const domainTrait = DOMAIN_KNOWLEDGE_TRAIT[String(args.domainId || "").trim().toLowerCase()];
  if (domainTrait) return domainTrait;

  const text = foldUmlauts(`${args.topic ?? ""} ${args.perspective ?? ""}`);
  for (const entry of TOPIC_KEYWORDS) {
    if (entry.keywords.some((keyword) => text.includes(keyword))) return entry.trait;
  }
  return "knowledge";
}
