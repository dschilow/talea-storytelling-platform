/**
 * Greenfield Schicht 1 — Artifact-Template-Library
 *
 * 8 kuratierte Artefakt-Templates für Kinderbuch-Stories (ages 6-8).
 * Jedes Artefakt hat:
 *  - konkrete Erscheinung (kein "Kraftkristall allgemein")
 *  - eine klare Fähigkeit (1 Satz)
 *  - einen klaren Preis (für "artifact-with-price"-Stories)
 *  - eine vorgegebene Arc-Rolle (wo es in den 5 Kapiteln landet)
 *
 * Zweck: verhindert, dass der Blueprint "generische Magie" erfindet. Jedes
 * Artefakt ist ein physisches Ding, das ein Kind sich vorstellen und
 * nachzeichnen kann.
 */

export type ArtifactArcRole =
  /** Wird in Ch1 gefunden, wandert mit, ist in Ch5 der Fokus */
  | "found_then_central"
  /** Steht ab Ch1 klar im Zentrum, Fokus-Item der ganzen Story */
  | "central_from_start"
  /** Erscheint erst in Ch2/3 als Entdeckung */
  | "discovered_midway"
  /** Ist Teil des Settings, wird erst im Finale zum Schlüssel */
  | "dormant_until_finale";

export interface ArtifactTemplate {
  id: string;
  label: string;
  /** Wie das Artefakt konkret aussieht — kein "leuchtender Stein allgemein" */
  physicalDescription: string;
  /** Eine klare Fähigkeit, in einem Satz */
  ability: string;
  /** Der Preis jeder Nutzung (bei "artifact-with-price"-Skeletten) */
  priceOfUse: string;
  /** Arc-Rolle: wo im 5-Kapitel-Bogen platzieren */
  arcRole: ArtifactArcRole;
  /** Typische Fundorte */
  typicalFindPlaces: ReadonlyArray<string>;
  /** Welche Skelette dieses Artefakt besonders bereichern */
  boostsSkeletons: ReadonlyArray<string>;
}

// ─── 8 ARTEFAKT-TEMPLATES ───────────────────────────────────────────────────────

export const ARTIFACT_TEMPLATES: ReadonlyArray<ArtifactTemplate> = [
  {
    id: "art-01-star-screw",
    label: "Die Stern-Schraube",
    physicalDescription:
      "Eine alte Messingschraube mit sternförmigem Kopf, leicht grünlich angelaufen. Passt in keinen heutigen Schraubenzieher mehr.",
    ability:
      "Wer sie in der Hand hält und leise zählt, sieht eine Sekunde in die Zukunft — gerade genug, um zu erkennen, ob der nächste Schritt richtig ist.",
    priceOfUse:
      "Jede Nutzung löscht eine kleine Erinnerung (ein Lieblingsgeräusch, einen Spitznamen, einen Geruch aus der Kindheit).",
    arcRole: "found_then_central",
    typicalFindPlaces: ["Werkstatt", "Schubladen-Schatulle", "zwischen Büchern"],
    boostsSkeletons: ["mw-01-artifact-price", "cft-01-three-trials"],
  },
  {
    id: "art-02-whispering-coin",
    label: "Die Flüster-Münze",
    physicalDescription:
      "Eine dünne kupferne Münze mit eingeritzten Linien, die wie ein Kreis aus Ohren aussehen. Lauwarm in der Hand.",
    ability:
      "Wer sie ans Ohr legt, hört, was die andere Person WIRKLICH meint — aber nicht immer, was sie sagt.",
    priceOfUse:
      "Die eigenen Worte werden für den Tag leiser und weniger klar. Andere verstehen das Kind schwerer.",
    arcRole: "found_then_central",
    typicalFindPlaces: ["Brunnenrand", "zwischen Kieseln", "Schuhkarton"],
    boostsSkeletons: ["cft-03-helper-returns", "mw-01-artifact-price"],
  },
  {
    id: "art-03-folded-letter",
    label: "Der gefaltete Brief",
    physicalDescription:
      "Ein vergilbtes Papier, dreimal gefaltet, die Tinte an einer Stelle verwischt, als hätte jemand darauf geweint. Kein Absender.",
    ability:
      "Wenn man ihn zur richtigen Person trägt, steht darauf plötzlich genau der Satz, den sie jetzt hören muss. Sonst bleibt er leer.",
    priceOfUse:
      "Der Brief verschwindet nach der Übergabe für immer — das Kind muss ohne ihn weitergehen.",
    arcRole: "dormant_until_finale",
    typicalFindPlaces: ["hinter Tapete", "Buchseite", "Schreibtischschublade"],
    boostsSkeletons: ["cft-03-helper-returns", "cft-02-transformation"],
  },
  {
    id: "art-04-blue-thread",
    label: "Der blaue Faden",
    physicalDescription:
      "Ein Stück blauer Garn, zwei Handspannen lang, am Ende ausgefranst. Knotet sich von selbst, wenn er um etwas Wichtiges gelegt wird.",
    ability:
      "Findet zurück zum Ausgangspunkt — wer den Faden hält, weiß den Weg heim, auch im dichtesten Nebel.",
    priceOfUse:
      "Kein Preis außer: der Faden wird bei jeder Nutzung ein wenig kürzer. Kind muss entscheiden, wann er sich die Heimkehr noch leisten kann.",
    arcRole: "central_from_start",
    typicalFindPlaces: ["Omas Nähkästchen", "Jackentasche", "um einen alten Zaunpfahl"],
    boostsSkeletons: ["cft-01-three-trials", "mw-02-gate-to-other-world"],
  },
  {
    id: "art-05-chipped-mug",
    label: "Die abgeplatzte Tasse",
    physicalDescription:
      "Eine blaue Keramiktasse mit zwei Scherben, die neben ihr liegen. Unten am Boden ein eingeritztes Herz.",
    ability:
      "Wer die Scherben zusammenhält, während er einem anderen ein ehrliches Wort sagt, fügt die Tasse ein Stückchen weiter zusammen.",
    priceOfUse:
      "Jede unehrliche Geste in der Nähe lässt sie wieder einen Riss bekommen.",
    arcRole: "central_from_start",
    typicalFindPlaces: ["Omas Küchenschrank", "Fensterbrett", "auf dem Boden zersplittert"],
    boostsSkeletons: ["cft-02-transformation", "mw-03-forgotten-rule"],
  },
  {
    id: "art-06-wooden-figure",
    label: "Die Holzfigur mit verblassender Farbe",
    physicalDescription:
      "Eine kleine handgeschnitzte Figur (Tier oder Kind, 6 cm hoch), einst bunt bemalt, jetzt an den Rändern blass. Glatt, warm in der Hand.",
    ability:
      "Zeigt in Träumen, was jemand wirklich wünscht — aber nur, wenn man sie unter das Kopfkissen legt.",
    priceOfUse:
      "Die Farbe verblasst weiter. Wenn sie ganz weiß ist, kann die Figur nichts mehr zeigen.",
    arcRole: "found_then_central",
    typicalFindPlaces: ["Regal", "Kinderzimmer-Kiste", "auf dem Dachboden"],
    boostsSkeletons: ["mw-01-artifact-price", "cft-02-transformation"],
  },
  {
    id: "art-07-dusty-recipe-card",
    label: "Das verstaubte Rezeptkärtchen",
    physicalDescription:
      "Eine vergilbte Karteikarte mit Omas Handschrift, Mehlspuren am Rand. Name oben durchgestrichen und ersetzt.",
    ability:
      "Wenn das Rezept genau so nachgekocht wird wie geschrieben, erinnert sich einer in der Familie an etwas Wichtiges aus der Vergangenheit.",
    priceOfUse:
      "Kein Preis — aber die Karte kann nur EINMAL diese Erinnerung zurückbringen. Danach ist sie ein normales Rezept.",
    arcRole: "dormant_until_finale",
    typicalFindPlaces: ["Küchenschublade", "altes Kochbuch", "Briefkasten"],
    boostsSkeletons: ["cft-03-helper-returns", "mw-03-forgotten-rule"],
  },
  {
    id: "art-08-small-mirror",
    label: "Der kleine Taschenspiegel",
    physicalDescription:
      "Ein runder, faustgroßer Handspiegel in verbeultem Silberrahmen. An der Rückseite eine verblasste Blume eingraviert.",
    ability:
      "Zeigt nicht das Gesicht des Kindes, sondern das eines anderen — und zwar das, das gerade an das Kind denkt.",
    priceOfUse:
      "Jedes Mal, wenn er benutzt wird, verdunkelt sich der Spiegel ein bisschen mehr. Nach sieben Nutzungen wird er zum blinden Glas.",
    arcRole: "discovered_midway",
    typicalFindPlaces: ["Omas Schmuckkästchen", "im alten Koffer", "zwischen Tüchern"],
    boostsSkeletons: ["mw-02-gate-to-other-world", "cft-02-transformation"],
  },
];

export const ARTIFACT_TEMPLATE_MAP: ReadonlyMap<string, ArtifactTemplate> = new Map(
  ARTIFACT_TEMPLATES.map((a) => [a.id, a]),
);

/**
 * Heuristisches Matching: welches Artefakt passt am besten zum Skelett?
 */
export function pickArtifactForSkeleton(skeletonId: string): ArtifactTemplate | undefined {
  const candidates = ARTIFACT_TEMPLATES.filter((a) => a.boostsSkeletons.includes(skeletonId));
  if (candidates.length === 0) return undefined;
  // Deterministisch: das erste passende. Binding-Layer kann zufälliger wählen.
  return candidates[0];
}

/**
 * Prompt-Block für den Blueprint-LLM.
 */
export function buildArtifactTemplatePromptBlock(artifact: ArtifactTemplate): string {
  return [
    `ARTIFACT TEMPLATE (pre-designed, use as-is or close to it):`,
    `Name: "${artifact.label}"`,
    `Look: ${artifact.physicalDescription}`,
    `Ability: ${artifact.ability}`,
    `Price of use: ${artifact.priceOfUse}`,
    `Arc role: ${artifact.arcRole}`,
    ``,
    `Place of finding candidates: ${artifact.typicalFindPlaces.join(", ")}`,
    ``,
    `Blueprint must:`,
    `  - keep the physical description concrete (no "a glowing crystal", name the material, shape, size)`,
    `  - state the ability in child-readable language`,
    `  - make the price VISIBLE on the page at least once`,
  ].join("\n");
}
