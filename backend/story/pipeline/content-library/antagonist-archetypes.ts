/**
 * Greenfield Schicht 1 — Antagonist-Archetype-Library
 *
 * 6 kuratierte Antagonist-Archetypen, gruppiert nach psychologischem Profil.
 * Jeder Archetyp ist ein DNA-Template (Motiv/Schwäche/Sprach-Tick) und
 * referenziert 1-3 existierende Character-Pool-IDs aus dem Sprint-0-Import
 * (15 Antagonisten, IDs b1a2c001-1111-4b01-8001-000000000001..000000000015).
 *
 * Zweck:
 *  - Skeleton → Archetyp-Kategorie → konkrete Character-Pool-Zuweisung
 *  - Blueprint muss Antagonist-DNA füllen, bekommt das Template als Hint
 *  - Deterministisch, kein LLM-Call
 */

export type AntagonistArchetypeCategory =
  | "the_greedy"
  | "the_cold"
  | "the_trickster"
  | "the_controller"
  | "the_absent"
  | "the_sorrowful";

export interface AntagonistArchetypeTemplate {
  category: AntagonistArchetypeCategory;
  label: string;
  /** Psychologische Kernbeschreibung */
  description: string;
  /** Motiv-Template (konkret, kein "will Macht") */
  motivePattern: string;
  /** Schwäche-Template */
  weaknessPattern: string;
  /** Wie die Figur typisch in die Story eintritt */
  firstActionPattern: string;
  /** Sprach-Tick-Template (wiederkehrend, markant) */
  speechTicPattern: string;
  /** Pool-Character-IDs aus dem Sprint-0-Import, die zu diesem Archetyp passen */
  poolCharacterIds: ReadonlyArray<string>;
  /** Welche Skeleton-Genres dieser Archetyp am besten bedient */
  suitableFor: ReadonlyArray<"classical-fairy-tales" | "magical-worlds">;
}

// ─── 6 ARCHETYPEN ───────────────────────────────────────────────────────────────

const GREEDY: AntagonistArchetypeTemplate = {
  category: "the_greedy",
  label: "Der Gierige",
  description:
    "Will etwas Konkretes haben und nimmt mehr, als ihm zusteht. Keine abstrakte Bosheit — echte, benennbare Gier nach einem Ding.",
  motivePattern:
    "Will [konkretes Objekt/Zeit/Geräusch/Erinnerung] sammeln, bis er alles davon hat. Ein 'Tausch'-Angebot an das Kind ist immer unfair.",
  weaknessPattern:
    "Erkennt nicht, wann er schon genug hat. Kann nichts freiwillig zurückgeben.",
  firstActionPattern:
    "Erscheint als 'Helfer' oder 'Tauschpartner' und bittet um etwas Kleines, das Kind ohne nachzudenken hergibt.",
  speechTicPattern:
    "Sagt 'nur ein kleines Stückchen' oder 'nur einmal' oder zählt ständig leise mit.",
  poolCharacterIds: [
    "b1a2c001-1111-4b01-8001-000000000001", // Der Geräusche-Fresser
    "b1a2c001-1111-4b01-8001-000000000002", // Die Stundendiebin
    "b1a2c001-1111-4b01-8001-000000000007", // Krummfinger der Sammler
  ],
  suitableFor: ["classical-fairy-tales", "magical-worlds"],
};

const COLD: AntagonistArchetypeTemplate = {
  category: "the_cold",
  label: "Der Gleichgültige / Kalte",
  description:
    "Zerstört nicht aktiv — er löscht Wärme aus, indem er gleichgültig ist. Gefahr besteht darin, dass in seiner Nähe Gefühl verschwindet.",
  motivePattern:
    "Will [Farbe/Lachen/Mitgefühl/Unterschied] ausgleichen, bis alles gleich grau ist. Glaubt, Gleichheit wäre Frieden.",
  weaknessPattern:
    "Ein einziger echter Mitgefühls-Moment vor ihm tut ihm physisch weh. Er weicht zurück.",
  firstActionPattern:
    "Erscheint in Ch2 oder Ch3 als ruhige Person, die dem Kind rät, 'nicht so viel zu fühlen'. Die Farben im Bild werden leicht blasser.",
  speechTicPattern:
    "Monoton, langsam. Wiederholt 'das ist doch alles gleich' oder 'das spielt keine Rolle'.",
  poolCharacterIds: [
    "b1a2c001-1111-4b01-8001-000000000003", // Morbus der Gleichgueltige
    "b1a2c001-1111-4b01-8001-000000000012", // Frau Gleichgleich
  ],
  suitableFor: ["magical-worlds"],
};

const TRICKSTER: AntagonistArchetypeTemplate = {
  category: "the_trickster",
  label: "Der Trickser / Verwirrer",
  description:
    "Verdreht Wahrheit, streut Zweifel, spielt Figuren gegeneinander aus. Keine direkte Gewalt — nur Worte, die verletzen.",
  motivePattern:
    "Profitiert davon, dass Figuren sich gegenseitig misstrauen. Füttert Gerüchte.",
  weaknessPattern:
    "Wenn zwei Figuren seine Lügen offen nebeneinander halten, fällt seine Version in sich zusammen.",
  firstActionPattern:
    "Tritt als 'freundliche Informationsquelle' auf, flüstert Dinge, die leise Zweifel säen.",
  speechTicPattern:
    "Beginnt Sätze mit 'Hast du schon gehört, dass...' oder 'Ich sag ja nur...' oder 'Eigentlich...'",
  poolCharacterIds: [
    "b1a2c001-1111-4b01-8001-000000000005", // Die Besserwisserin Klotilde
    "b1a2c001-1111-4b01-8001-000000000008", // Schattenjunge Finn
    "b1a2c001-1111-4b01-8001-000000000009", // Flüstertante Flora
  ],
  suitableFor: ["classical-fairy-tales", "magical-worlds"],
};

const CONTROLLER: AntagonistArchetypeTemplate = {
  category: "the_controller",
  label: "Der Ordnungs-Tyrann",
  description:
    "Verlangt, dass alles an seinem Platz ist, unterdrückt Abweichung. Seine Regel ist nicht böse — sie ist nur so streng, dass Kreativität erstickt.",
  motivePattern:
    "Will, dass [Raum/Regel/Ritual] unverändert bleibt, weil jede Abweichung ihn erschreckt.",
  weaknessPattern:
    "Eine kleine, respektvolle Bitte um Ausnahme lässt ihn nachdenken. Er hat Angst, aber keinen Hass.",
  firstActionPattern:
    "Tritt als Hüter einer Schwelle/Regel auf. Weist das Kind zurück mit korrektem, aber unflexiblem Verhalten.",
  speechTicPattern:
    "Kurze Befehlssätze. 'Das ist nicht erlaubt.' 'Das war schon immer so.' 'Stopp.'",
  poolCharacterIds: [
    "b1a2c001-1111-4b01-8001-000000000004", // Der Zu-Ordentliche
    "b1a2c001-1111-4b01-8001-000000000013", // Der Leiser-Mann
    "b1a2c001-1111-4b01-8001-000000000014", // Noch-Einmal-Nick
  ],
  suitableFor: ["magical-worlds"],
};

const ABSENT: AntagonistArchetypeTemplate = {
  category: "the_absent",
  label: "Das Vergessen / Der Abwesende",
  description:
    "Kein einzelner Feind — eine kollektive Gleichgültigkeit, ein vergessenes Wissen, ein fehlendes Wesen. Schwer zu greifen, aber deutlich spürbar.",
  motivePattern:
    "Profitiert davon, dass [Regel/Wesen/Erinnerung] nicht mehr gesehen wird. Manifestiert sich erst spät als Figur — oder bleibt abstrakt.",
  weaknessPattern:
    "Eine einzige Figur, die das Vergessene wieder sichtbar lebt, nimmt der Abwesenheit ihre Macht.",
  firstActionPattern:
    "In Ch1 nur spürbar (falsche Rhythmen, grelle Farben, schiefer Stein). Erst in Ch3/4 bekommt die Abwesenheit ein Gesicht (oder auch nicht).",
  speechTicPattern:
    "Wenn sie doch spricht: 'Das haben wir nie gebraucht.' 'Wer erinnert sich schon daran.'",
  poolCharacterIds: [
    "b1a2c001-1111-4b01-8001-000000000006", // Der Mutlosmacher
    "b1a2c001-1111-4b01-8001-000000000010", // Tante Sorgenfalt
    "b1a2c001-1111-4b01-8001-000000000015", // Der Letzte Wehmueter
  ],
  suitableFor: ["magical-worlds"],
};

const SORROWFUL: AntagonistArchetypeTemplate = {
  category: "the_sorrowful",
  label: "Der verzauberte Traurige",
  description:
    "Wirkt wie ein Feind, ist aber eigentlich eine Figur mit Schmerz. Sein 'Angriff' ist ein Hilferuf. Klassisches Froschkönig-Muster.",
  motivePattern:
    "Will gesehen, berührt, genannt werden — nicht besiegt. Sein feindliches Verhalten ist Ausdruck ungesehenen Schmerzes.",
  weaknessPattern:
    "Ein ehrliches Wort, eine Berührung, eine gesummte Melodie löst den 'Fluch' sofort.",
  firstActionPattern:
    "Erscheint gruselig/bedrohlich in Ch1/2 — doch ein kleines Detail passt nicht zu echter Feindschaft (eine Melodie, eine Farbe).",
  speechTicPattern:
    "Wiederholt einen Halbsatz oder eine Melodie, die einen alten Schmerz verrät.",
  poolCharacterIds: [
    "b1a2c001-1111-4b01-8001-000000000011", // Bruchkind Brenno
    "b1a2c001-1111-4b01-8001-000000000015", // Der Letzte Wehmueter (fits both)
  ],
  suitableFor: ["classical-fairy-tales"],
};

export const ANTAGONIST_ARCHETYPES: ReadonlyArray<AntagonistArchetypeTemplate> = [
  GREEDY,
  COLD,
  TRICKSTER,
  CONTROLLER,
  ABSENT,
  SORROWFUL,
];

export const ANTAGONIST_ARCHETYPE_MAP: ReadonlyMap<
  AntagonistArchetypeCategory,
  AntagonistArchetypeTemplate
> = new Map(ANTAGONIST_ARCHETYPES.map((a) => [a.category, a]));

/**
 * Gibt den Archetyp für eine Kategorie zurück.
 */
export function getAntagonistArchetype(
  category: AntagonistArchetypeCategory,
): AntagonistArchetypeTemplate | undefined {
  return ANTAGONIST_ARCHETYPE_MAP.get(category);
}

/**
 * Baut einen kompakten Prompt-Block für den Blueprint-LLM aus einem Archetyp.
 */
export function buildAntagonistArchetypePromptBlock(
  archetype: AntagonistArchetypeTemplate,
): string {
  return [
    `ANTAGONIST ARCHETYPE (use as template for antagonist_dna field):`,
    `Category: "${archetype.category}" — ${archetype.label}`,
    `Essence: ${archetype.description}`,
    ``,
    `DNA template (customize with story-specific names and details):`,
    `  motive: ${archetype.motivePattern}`,
    `  weakness: ${archetype.weaknessPattern}`,
    `  first_action: ${archetype.firstActionPattern}`,
    `  speech_tic: ${archetype.speechTicPattern}`,
    ``,
    `Pool-ready characters matching this archetype (pick one or customize):`,
    ...archetype.poolCharacterIds.map((id) => `  - ${id}`),
  ].join("\n");
}
