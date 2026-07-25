/**
 * Decides whether a beat-sheet field still names the story's personal object.
 *
 * Lives in its own module so the beat-sheet GATE and the deterministic REPAIR
 * are physically unable to drift apart, and so it can be unit-tested without
 * booting the Encore runtime.
 *
 * They did drift. The gate compared word-initial 4-character stems; the repair
 * asked whether the object's stem appeared as a substring ANYWHERE in the text.
 * Substring matching is strictly more permissive: for the object "Türen" the
 * repair accepted "Die Kreaturen im Flur..." because "kreaturen" contains
 * "ture". The repair then reported success, the gate rejected the very same
 * sentence, and the run aborted with a 500 before any prose existed
 * (story 42a63cca, "Alexander und der Schlüssel der halben Türen").
 *
 * Word-initial stems are the correct rule: German compounds put the head noun
 * at the END ("Schlüsselbund" IS a kind of Schlüssel), but a stem buried
 * mid-word is almost always an unrelated word that happens to share letters.
 */
export interface PersonalObjectStemMatcher {
  /** False when the object name has no word long enough to anchor on. */
  hasStems: boolean;
  sharesStem: (text: string) => boolean;
}

const MIN_STEM_SOURCE_LENGTH = 4;
const STEM_LENGTH = 4;

/**
 * Folds to a canonical form in which "Tür" and "Tuer" are the same word.
 *
 * Umlauts EXPAND (ü -> ue) rather than collapsing (ü -> u), because both
 * spellings show up in the same run: the model writes "Türglocke" while the
 * deterministic fallback sentences are written in transliterated German
 * ("zurueck", "beschaedigt", "persoenlich"). Collapsing to "u" made those two
 * spellings produce different stems — "turg" vs "tuer" — so the selfheal could
 * emit a cost that its own gate then rejected.
 *
 * The expansion must run BEFORE NFKD, which would otherwise split "ü" into
 * "u" + combining mark and leave nothing for these rules to match.
 */
function foldGerman(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

function stemsOf(text: string): string[] {
  return foldGerman(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_STEM_SOURCE_LENGTH)
    .map((word) => word.slice(0, STEM_LENGTH));
}

export function buildPersonalObjectStemMatcher(objectName: string): PersonalObjectStemMatcher {
  const objectStems = new Set(stemsOf(objectName));
  return {
    hasStems: objectStems.size > 0,
    sharesStem: (text: string) => stemsOf(text).some((stem) => objectStems.has(stem)),
  };
}
