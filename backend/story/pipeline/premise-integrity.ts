/** Pure deterministic premise checks used before expensive drafting. */

const MAGIC_ENGINE_FAMILIES: Array<{ family: string; pattern: RegExp }> = [
  { family: "hourglass", pattern: /\b(?:sanduhr|hourglass)\w*\b/i },
  { family: "crown", pattern: /\b(?:eiskrone|krone|crown)\w*\b/i },
  { family: "mirror", pattern: /\b(?:spiegel|mirror)\w*\b/i },
  { family: "key", pattern: /\b(?:schl(?:u|ü|ue)ssel|key)\w*\b/i },
  { family: "compass", pattern: /\b(?:kompass|compass)\w*\b/i },
  { family: "amulet", pattern: /\b(?:amulett|amulet)\w*\b/i },
  { family: "clock", pattern: /\b(?:spieluhr|taschenuhr|clock)\w*\b/i },
  { family: "book", pattern: /\b(?:zauberbuch|magisches?\s+buch|magic\s+book)\w*\b/i },
  { family: "ring", pattern: /\b(?:zauberring|magic\s+ring)\w*\b/i },
  { family: "flute", pattern: /\b(?:zauberfl(?:o|ö|oe)te|magic\s+flute)\w*\b/i },
];

/** Return the distinct supernatural devices named inside the rule itself. */
export function detectMultipleMagicEngines(wonderRule: string): string[] {
  const rule = String(wonderRule || "");
  if (!rule.trim()) return [];
  return MAGIC_ENGINE_FAMILIES
    .filter((entry) => entry.pattern.test(rule))
    .map((entry) => entry.family);
}

/** A refrain should be playable language, not a compressed rule explanation. */
export function refrainLooksExpository(refrainLine: string): boolean {
  const line = String(refrainLine || "").trim();
  if (!line) return false;
  return /\b(?:wenn|dann|wer|muss|regel|because|when|then|must)\b|\b(?:schwindet|bindet|verschwindet|kostet)\b/i.test(line);
}