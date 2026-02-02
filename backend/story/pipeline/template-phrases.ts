export type TemplatePhraseMatch = { label: string; index: number };

const TEMPLATE_PHRASE_PATTERNS_DE: Array<{ label: string; pattern: RegExp }> = [
  { label: "Knoten loesen", pattern: /\b(knoten|knoten)\s+l(o|oe|\u00f6)ste\b/i },
  { label: "Frage loest Knoten", pattern: /\bstellte\s+die\s+frage[^.!?]{0,60}knoten\s+l(o|oe|\u00f6)st/iu },
  { label: "entscheidender Hinweis", pattern: /\bentscheidend(?:er|e|es)?\s+hinweis\b/i },
  { label: "wichtiger Hinweis", pattern: /\bwichtig(?:er|e|es)?\s+hinweis\b/i },
  { label: "wichtige Entscheidung", pattern: /\bwichtige(?:r|s)?\s+entscheidung\b/i },
  { label: "besondere Idee", pattern: /\bbesondere(?:r|s)?\s+idee\b/i },
  { label: "neue Faehigkeit", pattern: /\bneue(?:r|s)?\s+f(ae|\u00e4)higkeit\b/i },
  { label: "spuerte Anspannung", pattern: /\bsp(u|\u00fc)rte[n]?\s+die\s+anspannung\b/i },
  { label: "traurig aber hoffnungsvoll", pattern: /\btraurig,\s*aber\s*hoffnungsvoll\b/i },
  { label: "wie ein Magnet", pattern: /\bwie\s+ein\s+magnet\b/i },
];

const TEMPLATE_PHRASE_PATTERNS_EN: Array<{ label: string; pattern: RegExp }> = [
  { label: "untied the knot", pattern: /\b(untied|unravel(?:ed)?)\s+the\s+knot\b/i },
  { label: "asked the question that solved", pattern: /\basked\s+the\s+question[^.!?]{0,60}(solved|fixed|untied)\b/i },
  { label: "decisive clue", pattern: /\b(decisive|crucial|important)\s+clue\b/i },
  { label: "important hint", pattern: /\b(decisive|crucial|important)\s+hint\b/i },
  { label: "important decision", pattern: /\bimportant\s+decision\b/i },
  { label: "special idea", pattern: /\bspecial\s+idea\b/i },
  { label: "new ability", pattern: /\bnew\s+ability\b/i },
  { label: "felt the tension", pattern: /\bfelt\s+the\s+tension\b/i },
  { label: "sad but hopeful", pattern: /\bsad\s+but\s+hopeful\b/i },
  { label: "like a magnet", pattern: /\blike\s+a\s+magnet\b/i },
];

export function findTemplatePhraseMatches(text: string, language: string): TemplatePhraseMatch[] {
  if (!text) return [];
  const patterns = language === "de" ? TEMPLATE_PHRASE_PATTERNS_DE : TEMPLATE_PHRASE_PATTERNS_EN;
  const matches: TemplatePhraseMatch[] = [];
  for (const entry of patterns) {
    const idx = text.search(entry.pattern);
    if (idx >= 0) {
      matches.push({ label: entry.label, index: idx });
    }
  }
  return matches;
}
