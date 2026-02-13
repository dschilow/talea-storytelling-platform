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
  // Heroic stock phrases
  { label: "griff beherzt", pattern: /\bgriff\s+beherzt\b/i },
  { label: "setzte Idee um", pattern: /\bsetzte\s+(?:die\s+|eine\s+)?idee\s+(?:sofort\s+)?um\b/i },
  { label: "fasste Mut", pattern: /\bfasste\s+(?:neuen?\s+)?mut\b/i },
  { label: "raffte sich auf", pattern: /\braffte\s+sich\s+auf\b/i },
  { label: "nahm Sache in die Hand", pattern: /\bnahm\s+(?:die\s+)?sache\s+(?:selbst\s+)?in\s+die\s+hand\b/i },
  { label: "bewies Mut", pattern: /\bbewies\s+(?:gro(?:ss|\u00df)en\s+)?mut\b/i },
  { label: "ueberlegte nicht lange", pattern: /\b(u|\u00fc)berlegte\s+nicht\s+lange\b/i },
  { label: "zeigte wahre Groesse", pattern: /\bzeigte\s+(?:seine|ihre)?\s*wahre\s+gr(oe|\u00f6)(ss|\u00df)e\b/i },
  // Emotional stock phrases
  // "Herz schlug schneller" removed: valid in real children's literature (Funke, Lindgren)
  { label: "Augen leuchteten", pattern: /\baugen\s+leuchteten\s+(?:vor\s+)?(?:freude|gl(u|\u00fc)ck|begeisterung)\b/i },
  { label: "tiefe Freude", pattern: /\btiefe\s+freude\b/i },
  { label: "unendliche Dankbarkeit", pattern: /\bunendliche\s+dankbarkeit\b/i },
  // Narration stock phrases
  { label: "in diesem Moment", pattern: /\bin\s+diesem\s+(?:einen\s+)?moment\s+(?:wusste|verstand|erkannte)\b/i },
  { label: "da wusste er/sie", pattern: /\bda\s+wusste\s+(?:er|sie),?\s+(?:dass|was)\b/i },
  { label: "ohne zu zoegern", pattern: /\bohne\s+zu\s+z(oe|\u00f6)gern\b/i },
  { label: "mit vereinten Kraeften", pattern: /\bmit\s+vereinten\s+kr(ae|\u00e4)ften\b/i },
  { label: "wie durch ein Wunder", pattern: /\bwie\s+durch\s+ein\s+wunder\b/i },
  { label: "ploetzlich hatte er/sie eine Idee", pattern: /\bpl(oe|\u00f6)tzlich\s+hatte\s+(?:er|sie)\s+eine\s+idee\b/i },
  { label: "es war geschafft", pattern: /\bes\s+war\s+(?:endlich\s+)?geschafft\b/i },
  { label: "ein Laecheln stahl sich", pattern: /\bein\s+l(ae|\u00e4)cheln\s+stahl\s+sich\b/i },
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
  // Heroic stock phrases
  { label: "grabbed courageously", pattern: /\bgrabbed\s+courageously\b/i },
  { label: "put idea into action", pattern: /\bput\s+(?:the\s+|an\s+)?idea\s+(?:immediately\s+)?into\s+action\b/i },
  { label: "gathered courage", pattern: /\bgathered\s+(?:(?:his|her|their)\s+)?courage\b/i },
  { label: "took matters into hands", pattern: /\btook\s+matters\s+into\s+(?:his|her|their)\s+(?:own\s+)?hands\b/i },
  { label: "showed true courage", pattern: /\bshowed\s+(?:true|real|great)\s+courage\b/i },
  { label: "without hesitation", pattern: /\bwithout\s+(?:a\s+moment'?s?\s+)?hesitation\b/i },
  // Emotional stock phrases
  { label: "heart beat faster", pattern: /\bheart\s+(?:beat|raced|pounded)\s+faster\b/i },
  { label: "eyes lit up with joy", pattern: /\beyes\s+lit\s+up\s+(?:with\s+)?(?:joy|happiness|delight)\b/i },
  { label: "deep joy", pattern: /\bdeep\s+(?:sense\s+of\s+)?joy\b/i },
  { label: "endless gratitude", pattern: /\bendless\s+gratitude\b/i },
  // Narration stock phrases
  { label: "in that moment knew", pattern: /\bin\s+that\s+(?:very\s+)?moment[,]?\s+(?:knew|understood|realized)\b/i },
  { label: "as if by magic", pattern: /\bas\s+if\s+by\s+magic\b/i },
  { label: "with combined forces", pattern: /\bwith\s+(?:their\s+)?combined\s+(?:forces|strength|efforts)\b/i },
  { label: "suddenly had an idea", pattern: /\bsuddenly\s+had\s+an\s+idea\b/i },
  { label: "it was done", pattern: /\bit\s+was\s+(?:finally\s+)?done\b/i },
  { label: "a smile crept", pattern: /\ba\s+smile\s+crept\s+(?:across|onto|over)\b/i },
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
