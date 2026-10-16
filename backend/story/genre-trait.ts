/**
 * Primary trait a story grows when it carries no stored AI development
 * (public stories read by another family, older stories, failed development
 * stage). The wizard sends English genre ids (fairy_tales, adventure, magic,
 * animals, scifi, modern); the German words cover older and imported stories.
 */
const GENRE_TRAITS: Array<{ keywords: string[]; trait: string }> = [
  { keywords: ["fantasy", "magic", "magie", "zauber", "fee", "drache"], trait: "creativity" },
  { keywords: ["adventure", "abenteuer", "reise", "expedition", "herausforderung", "kampf"], trait: "courage" },
  { keywords: ["freundschaft", "friendship", "familie", "liebe", "gemeinschaft"], trait: "empathy" },
  { keywords: ["scifi", "sci-fi", "science", "wissenschaft", "mystery", "raetsel", "geheimnis", "detektiv"], trait: "curiosity" },
  { keywords: ["animal", "tier", "natur", "umwelt", "wald"], trait: "empathy" },
  { keywords: ["comedy", "humor", "komoedie", "lustig"], trait: "creativity" },
  { keywords: ["problem", "loesung", "ausdauer", "durchhalten"], trait: "persistence" },
  { keywords: ["fairy", "maerchen", "weisheit", "lehre", "moral"], trait: "vocabulary" },
  { keywords: ["team", "zusammen", "gemeinsam", "helfen"], trait: "teamwork" },
  { keywords: ["logik", "denken", "strategie", "plan"], trait: "logic" },
];

export function inferPersonalityTrait(genre?: string): string {
  if (!genre) return "empathy";
  const value = genre.toLowerCase();
  for (const entry of GENRE_TRAITS) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) {
      return entry.trait;
    }
  }
  return "empathy";
}
