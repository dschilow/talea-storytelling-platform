/**
 * Sprint 5 (S5.1) — Reference-Book Few-Shot Conditioning.
 *
 * Curated short structural reference paragraphs (NOT verbatim text from the
 * original works — these are paraphrased, original prose written in the
 * structural style of the reference works to teach the LLM rhythm and
 * concreteness without copying any IP).
 *
 * The block is appended to the writer's SYSTEM PROMPT, not the user prompt,
 * so it sits in the static cacheable region. After the first call per session
 * it costs ~5% of regular tokens via prompt cache.
 *
 * Reference works (style-only, not content):
 *  - Julia Donaldson, "Der Grüffelo" (rhythm + iconic refrain)
 *  - Margit Auer, "Die Schule der magischen Tiere" (clear scene with kid voice)
 *  - Sven Nordqvist, "Pettersson und Findus" (concrete physical detail)
 *  - Cornelia Funke, kurze Kinderbuch-Szene (sensory grounding)
 */

const REFERENCE_FEWSHOT_DE = `
═══ REFERENCE STYLE EXAMPLES (read these BEFORE writing — your prose should breathe like this) ═══

EXAMPLE 1 — RHYTHM + REFRAIN (style of Donaldson/Grüffelo, NOT verbatim):
„Eine Maus ging durch den Wald, ganz still. Im Gras lag ein Schatten. Der Schatten bewegte sich. Der Schatten hatte Augen.
'Oh nein', dachte die Maus. 'Oh nein, oh nein, oh nein.'
Aber sie ging weiter. Ein Schritt. Noch einer. Noch einer."
→ NOTICE: 4-7 word sentences. Refrain repeats 3×. Rhythm is the engine.

EXAMPLE 2 — KID VOICE + CONCRETE DETAIL (style of Auer/Schule der magischen Tiere, NOT verbatim):
„Ida hatte heute keine Lust auf Mathe. Mathe war wie kalter Pudding. Sie schaute aus dem Fenster.
Da saß eine Krähe auf dem Dach. Die Krähe legte den Kopf schief. Die Krähe zwinkerte.
'Du', flüsterte Ida. 'Du kannst doch gar nicht zwinkern.'"
→ NOTICE: Kid voice in dialogue. Concrete object (cold pudding). Animal action shows, doesn't tell.

EXAMPLE 3 — PHYSICAL SENSE GROUNDING (style of Nordqvist/Pettersson, NOT verbatim):
„Findus hüpfte über drei Steine zur Werkstatt. Der vierte Stein war nass. Findus rutschte ab und landete im Gras.
Pettersson lachte leise und reichte ihm die Hand. 'Komm, kleiner Wirbelwind. Wir bauen ein Boot.'
Findus nieste zweimal und stand auf. Das Gras kitzelte unter den Pfoten."
→ NOTICE: Verbs first (hüpfte, rutschte, lachte). Each sense (touch, sound, sight) shown not stated.

EXAMPLE 4 — SCENE-LEVEL CONCRETENESS (style of Funke, NOT verbatim):
„Im Werkzeugschuppen roch es nach Öl und altem Holz. An der Wand hing ein Hammer mit einem schiefen Stiel.
Mia nahm einen kleinen Nagel zwischen zwei Finger. Der Nagel war kalt. Sie drückte ihn in den Korken auf dem Tisch.
'Plok', machte der Korken. Mia lachte und drückte noch einen rein."
→ NOTICE: Setting through smell + sight. Action through physical contact. Sound effects sparingly used.

═══ TAKEAWAYS YOU MUST APPLY ═══
- Average sentence length 4-11 words. Long sentences are rare.
- Show physical actions FIRST, feelings SECOND.
- One concrete object per scene anchors the mood.
- Dialogue carries personality through word choice, not adverbs.
- Repeated lines are memory-handles, not filler.
- A child should be able to act it out.
═══ END REFERENCE STYLE EXAMPLES ═══
`;

const REFERENCE_FEWSHOT_EN = `
═══ REFERENCE STYLE EXAMPLES — read carefully before writing ═══

(Brief paraphrased style examples — analog to Donaldson, Auer, Nordqvist, Funke.)

EXAMPLE 1 (refrain + rhythm):
"A mouse walked through the wood, quite still. In the grass lay a shadow. The shadow moved. The shadow had eyes.
'Oh no,' the mouse thought. 'Oh no, oh no, oh no.'
But she walked on. One step. Another. Another."

EXAMPLE 2 (kid voice + concrete detail):
"Ida had no patience for math today. Math was like cold pudding. She looked out the window.
A crow sat on the roof. The crow tilted its head. The crow winked.
'Hey,' Ida whispered. 'You can't even wink.'"

═══ TAKEAWAYS ═══
- 4-11 words per sentence on average.
- Physical action before feeling.
- One concrete object anchors each scene.
- A child should be able to act it out.
═══ END REFERENCE STYLE EXAMPLES ═══
`;

/**
 * Returns the reference few-shot block to be appended to the writer's
 * SYSTEM prompt. Static and cacheable — same string every time.
 */
export function getReferenceFewshotBlock(language: string): string {
  return language === "de" ? REFERENCE_FEWSHOT_DE : REFERENCE_FEWSHOT_EN;
}
