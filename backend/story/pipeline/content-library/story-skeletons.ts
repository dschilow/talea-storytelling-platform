/**
 * Greenfield Schicht 1 — Story-Skeleton-Library
 *
 * 6 kuratierte 5-Akt-Skelette für die zwei priorisierten Genres:
 *  - classical-fairy-tales (3 Skelette)
 *  - magical-worlds (3 Skelette)
 *
 * Jedes Skelett besteht aus:
 *  - 5 Kapitel-Archetypen (arc-gebunden: SETUP, DISCOVERY, TURNING_POINT, DARKEST_MOMENT, LANDING)
 *  - 1 Must-Have-Moment (der ikonische Kern-Moment, der das Skelett definiert)
 *  - 1 Antagonisten-Pattern (welche Art Gegner passt)
 *  - 1 Payoff-Typ (welches der 8 Ending-Patterns landet diese Story am besten)
 *  - Konkret-Anker-Hints (abstrakte Themen → physische Story-Objekte)
 *
 * Das Skelett ist NICHT der fertige Blueprint, sondern der deterministische
 * Vorschlag, den der Blueprint-LLM als Anker nimmt. Er hält den Blueprint-LLM
 * von "aus dem Nichts erfindet" weg und zwingt ihn in bewährte Strukturen.
 */

import type { EndingPatternName } from "../ending-patterns";

export type StorySkeletonGenre = "classical-fairy-tales" | "magical-worlds";

export type StoryArcLabel =
  | "SETUP"
  | "DISCOVERY"
  | "TURNING_POINT"
  | "DARKEST_MOMENT"
  | "LANDING";

export interface StorySkeletonChapterHint {
  chapter: 1 | 2 | 3 | 4 | 5;
  arc: StoryArcLabel;
  /** Was PASSIERT archetypisch in diesem Kapitel (abstrakt, für LLM-Hint) */
  beat: string;
  /** Hint für eine physische Handlung, die Kind nachspielen kann */
  playableHint: string;
}

export interface StorySkeletonAntagonistPattern {
  /** Archetyp-Name (passt zu einer Kategorie der Antagonist-Library) */
  archetypeCategory: "the_greedy" | "the_cold" | "the_trickster" | "the_controller" | "the_absent" | "the_sorrowful";
  /** Wie der Antagonist in die Welt tritt (first_action-Skelett) */
  firstActionShape: string;
  /** Wie er besiegt/aufgelöst wird (nicht durch Gewalt!) */
  defeatShape: string;
}

export interface StorySkeletonConcreteAnchorHint {
  /** Abstraktes Konzept, das im Skelett steckt */
  abstractTheme: string;
  /** Mögliche konkrete Anker — der Binding-Layer wählt einen */
  concreteCandidates: ReadonlyArray<string>;
}

/**
 * Sprint 4 (S4.2) — Refrain candidates per skeleton.
 * Gruffalo-Prinzip: ein wiederkehrender, einprägsamer Satz/Halbsatz schafft Memorability.
 * Der Blueprint wählt einen Kandidaten oder formuliert einen passenden — der Writer
 * MUSS ihn ≥3× über Kapitel verteilen + 1× im Schluss.
 */
export interface StorySkeletonRefrainHint {
  /** Wörtlicher Refrain (z.B. "Erst hinschauen, dann los."). Kurz: 2-6 Wörter. */
  candidate: string;
  /** Wann passt dieser Refrain? (Tonalität: warnend, beruhigend, fragend, lachend) */
  tone: "warnend" | "beruhigend" | "fragend" | "lachend" | "entschlossen";
}

/**
 * Sprint 5 (S5.2) — Iconic visual motif that threads through all 5 chapters.
 * Gruffalo: knobbly knees + purple prickles. Ours: ein konkreter Gegenstand, der
 * pro Kapitel anders auftaucht (Tasche → Hand → Boden → zurück in Tasche).
 */
export interface StorySkeletonIconicMotif {
  /** Der Gegenstand selbst (z.B. "kleiner glatter Stein") */
  object: string;
  /** Pro Kapitel: wo/wie taucht das Motiv auf */
  perChapterPosition: ReadonlyArray<string>;
}

export interface StorySkeleton {
  id: string;
  genre: StorySkeletonGenre;
  label: string;
  /** Kurze Beschreibung, wann dieses Skelett passt */
  description: string;
  /** Der ikonische Kern-Moment — muss in einem bestimmten Kapitel landen */
  mustHaveMoment: {
    chapter: 1 | 2 | 3 | 4 | 5;
    description: string;
  };
  /** 5 Kapitel-Hints in fester Arc-Reihenfolge */
  chapterHints: ReadonlyArray<StorySkeletonChapterHint>;
  /** Welcher Antagonist-Typ passt */
  antagonistPattern: StorySkeletonAntagonistPattern;
  /** Welches der 8 Ending-Patterns passt am besten (Blueprint kann abweichen) */
  recommendedEndingPattern: EndingPatternName;
  /** Abstract → Concrete Anchor Hints */
  concreteAnchorHints: ReadonlyArray<StorySkeletonConcreteAnchorHint>;
  /** Typische Settings, die dieses Skelett braucht */
  typicalSettings: ReadonlyArray<string>;
  /** Sprint 4 (S4.2): 3-5 Refrain-Vorschläge — Blueprint wählt EINEN aus */
  refrainCandidates: ReadonlyArray<StorySkeletonRefrainHint>;
  /** Sprint 5 (S5.2): wiederkehrendes Bildmotiv durch alle 5 Kapitel */
  iconicMotif: StorySkeletonIconicMotif;
}

// ─── CLASSICAL FAIRY TALES ──────────────────────────────────────────────────────

const SKEL_CF_QUEST_OF_3_TRIALS: StorySkeleton = {
  id: "cft-01-three-trials",
  genre: "classical-fairy-tales",
  label: "Drei Prüfungen",
  description:
    "Klassisches Märchen: Kind verlässt Heim, trifft drei Hindernisse/Wesen, besteht durch Gutherzigkeit (nicht Stärke), kehrt heim mit Gabe.",
  mustHaveMoment: {
    chapter: 3,
    description:
      "Das Kind tut etwas Großzügiges für ein kleines Wesen (Tier, Bettler, Pflanze), obwohl es selbst wenig hat. Diese Geste wird in Kap. 5 belohnt.",
  },
  chapterHints: [
    {
      chapter: 1,
      arc: "SETUP",
      beat: "Kind wird aus Zuhause aufgebrochen (Not, Auftrag, Mangel). Ein kleines Detail aus Zuhause wandert mit (Brot, Faden, Ring).",
      playableHint: "Kind steckt das Detail in die Tasche, schaut noch einmal zurück.",
    },
    {
      chapter: 2,
      arc: "DISCOVERY",
      beat: "Erste Begegnung: ein Wesen braucht Hilfe. Kind hilft mit dem kleinen Detail, bekommt Hinweis zurück.",
      playableHint: "Kind teilt das Brot/den Faden, das Wesen nickt oder zeigt etwas.",
    },
    {
      chapter: 3,
      arc: "TURNING_POINT",
      beat: "Zweite Begegnung: Kind wählt falsch (ungeduldig, vorschnell) und verliert etwas Wichtiges. Körper-Reaktion: heißes Gesicht, trockener Hals.",
      playableHint: "Kind greift zu schnell, etwas fällt oder geht kaputt, kurze Stille.",
    },
    {
      chapter: 4,
      arc: "DARKEST_MOMENT",
      beat: "Kind sitzt allein, verdaut Verlust, erinnert sich an Ch2-Gabe, beschließt langsamer zu handeln. KEIN Erwachsener rettet.",
      playableHint: "Kind atmet tief, hält das Kapitel-1-Detail fest, nickt sich selbst zu.",
    },
    {
      chapter: 5,
      arc: "LANDING",
      beat: "Dritte Begegnung löst sich durch das gelernte Verhalten. Rückkehr nach Hause, aber verändert. Das Ch2-Wesen taucht wieder auf.",
      playableHint: "Kind reicht jetzt, ohne zu greifen — das Wesen gibt eine echte Gabe zurück.",
    },
  ],
  antagonistPattern: {
    archetypeCategory: "the_greedy",
    firstActionShape:
      "Antagonist erscheint in Ch2 oder Ch3 als 'Helfer', der eine unfaire Gegenleistung verlangt (nimmt mehr als er gibt).",
    defeatShape:
      "Kind zahlt die Gegenleistung nicht mit Gewalt, sondern dadurch, dass es in Ch4 gelernt hat, dem Antagonisten nichts zu bieten, was er braucht.",
  },
  recommendedEndingPattern: "return_home_changed",
  concreteAnchorHints: [
    {
      abstractTheme: "Freundlichkeit",
      concreteCandidates: [
        "das halbe Stück Brot, das Kind in Kap.2 dem Vogel gibt",
        "der blaue Faden, den das Kind einer alten Frau schenkt",
        "die leere Wasserflasche, die am Brunnen gefüllt wird",
      ],
    },
    {
      abstractTheme: "Geduld",
      concreteCandidates: [
        "das Kind lässt den Käfer über den Zaun laufen, statt ihn zu schnappen",
        "das Kind wartet, bis der Wind stoppt, bevor es die Tür öffnet",
      ],
    },
    {
      abstractTheme: "Rückkehr",
      concreteCandidates: [
        "der Gartenhag am Eingang des Dorfes, der in Kap.1 schief stand",
        "das Fenster der Oma, das in Kap.1 dunkel war und in Kap.5 leuchtet",
      ],
    },
  ],
  typicalSettings: ["Dorf", "Wald", "Wegkreuzung", "Hütte", "Brunnen"],
  refrainCandidates: [
    { candidate: "Erst hinschauen, dann los.", tone: "warnend" },
    { candidate: "Ein Schritt. Noch einer.", tone: "entschlossen" },
    { candidate: "Wer teilt, kommt weiter.", tone: "beruhigend" },
    { candidate: "Klein ist nicht nichts.", tone: "beruhigend" },
  ],
  iconicMotif: {
    object: "der kleine glatte Stein in der Tasche",
    perChapterPosition: [
      "Stein steckt tief in der Hosentasche, das Kind tastet danach beim Aufbruch.",
      "Stein wandert in die Hand, wird dem Wesen kurz gezeigt, dann wieder eingesteckt.",
      "Stein fällt aus der Tasche bei der falschen Entscheidung, rollt unter etwas.",
      "Stein wird wiedergefunden und fest in die Faust gedrückt.",
      "Stein wird am Ende einem anderen geschenkt oder ans Ufer gelegt.",
    ],
  },
};

const SKEL_CF_TRANSFORMATION: StorySkeleton = {
  id: "cft-02-transformation",
  genre: "classical-fairy-tales",
  label: "Verwandlung / Fluch gelöst",
  description:
    "Eine Figur (Tier, Stein, Stille) ist verzaubert. Kind muss eine kleine mitfühlende Geste finden, die den Zauber löst. Klassisch: Froschkönig-Struktur.",
  mustHaveMoment: {
    chapter: 4,
    description:
      "Das Kind erkennt, dass die verzauberte Figur Schmerz hat — keine Gefahr. Statt Angst: Berührung, Wort, Blick.",
  },
  chapterHints: [
    {
      chapter: 1,
      arc: "SETUP",
      beat: "Kind trifft beiläufig auf ein seltsames Wesen/Ding. Erster Eindruck: gruselig oder merkwürdig.",
      playableHint: "Kind weicht zurück, beobachtet aus der Ferne.",
    },
    {
      chapter: 2,
      arc: "DISCOVERY",
      beat: "Das Wesen folgt dem Kind oder kehrt wieder. Kind bemerkt ein Detail (ein Wort, ein Muster, ein Geräusch), das nicht zum Äußeren passt.",
      playableHint: "Das Wesen summt leise eine Melodie, die das Kind kennt.",
    },
    {
      chapter: 3,
      arc: "TURNING_POINT",
      beat: "Kind flieht aus Angst (falsche Entscheidung), verletzt das Wesen dabei unabsichtlich. Körper-Signal: brennende Wangen.",
      playableHint: "Das Kind schlägt eine Tür zu, ein Klagelaut dahinter.",
    },
    {
      chapter: 4,
      arc: "DARKEST_MOMENT",
      beat: "Kind kehrt zurück, findet das Wesen einsam/verletzt. Statt Angst: mitfühlende Geste (Berührung, ein Wort).",
      playableHint: "Kind legt die Hand auf etwas Kaltes oder Raues, sagt den Namen oder die Melodie.",
    },
    {
      chapter: 5,
      arc: "LANDING",
      beat: "Der Zauber löst sich — nicht durch Magie, sondern weil das Wesen sich gesehen fühlt. Ob es sich verwandelt oder in seiner Form bleibt, ist offen.",
      playableHint: "Das Wesen blinzelt, richtet sich auf, nickt leise.",
    },
  ],
  antagonistPattern: {
    archetypeCategory: "the_sorrowful",
    firstActionShape:
      "Der 'Antagonist' ist eigentlich das verzauberte Wesen selbst — sein angeblich feindliches Verhalten ist Schmerzausdruck.",
    defeatShape:
      "Kein klassischer Sieg. Das Kind erkennt, dass kein echter Feind da ist, und das löst den 'Fluch'.",
  },
  recommendedEndingPattern: "revealed_truth",
  concreteAnchorHints: [
    {
      abstractTheme: "Erkenntnis",
      concreteCandidates: [
        "die Melodie, die Kind und Wesen beide kennen",
        "das kleine Kettchen unter der rauen Schale",
        "die Augenfarbe, die nicht zum Rest passt",
      ],
    },
    {
      abstractTheme: "Mitgefühl",
      concreteCandidates: [
        "die Hand, die das Kind auf den kalten Stein legt",
        "das warme Tuch, das Kind dem Wesen umlegt",
      ],
    },
    {
      abstractTheme: "Nicht-Wegrennen",
      concreteCandidates: [
        "das Kind, das zurück zur geschlossenen Tür geht",
        "die Füße, die stehen bleiben, statt zu fliehen",
      ],
    },
  ],
  typicalSettings: ["Waldrand", "alter Brunnen", "verlassene Mühle", "Uferstein", "Turmkammer"],
  refrainCandidates: [
    { candidate: "Nicht weglaufen. Hinhören.", tone: "beruhigend" },
    { candidate: "Wer schaut, sieht doppelt.", tone: "fragend" },
    { candidate: "Komm näher, leise.", tone: "beruhigend" },
    { candidate: "Der Schmerz hat einen Namen.", tone: "warnend" },
  ],
  iconicMotif: {
    object: "die kleine Melodie, die das Wesen summt",
    perChapterPosition: [
      "Das Kind hört die Melodie zum ersten Mal aus dem Gebüsch und bleibt stehen.",
      "Die Melodie kehrt wieder, leiser, wie eine zweite Erinnerung.",
      "Die Melodie bricht ab, als das Kind die Tür zuschlägt.",
      "Das Kind summt selbst die Melodie zurück, halb in der Luft.",
      "Beide summen die Melodie zusammen, das Wesen blinzelt.",
    ],
  },
};

const SKEL_CF_HELPER_RETURNS: StorySkeleton = {
  id: "cft-03-helper-returns",
  genre: "classical-fairy-tales",
  label: "Der Helfer kehrt zurück",
  description:
    "Kind half in Kap.1 jemandem, ohne Lohn zu erwarten. In Kap.4/5 kommt diese Hilfe genau dann zurück, wenn das Kind selbst nicht mehr weiter weiß. Die Struktur lebt vom setzen-einlösen-Bogen.",
  mustHaveMoment: {
    chapter: 5,
    description:
      "Der Helfer aus Ch1 taucht wieder auf und löst etwas, das das Kind allein nicht konnte — aber nur, weil das Kind in Kap. 4 eine eigene mutige Geste gemacht hat.",
  },
  chapterHints: [
    {
      chapter: 1,
      arc: "SETUP",
      beat: "Kind begegnet kurz einem hilfsbedürftigen Wesen. Tut etwas Kleines (Wasser, Schatten, ein Wort). Geht weiter ohne Erwartung.",
      playableHint: "Kind reicht einen Becher oder schiebt einen Ast zur Seite.",
    },
    {
      chapter: 2,
      arc: "DISCOVERY",
      beat: "Kind stößt auf sein eigenes Problem/Abenteuer. Noch mutig, noch alleine.",
      playableHint: "Kind öffnet eine Tür, folgt einer Spur.",
    },
    {
      chapter: 3,
      arc: "TURNING_POINT",
      beat: "Kind macht einen Fehler, weil es zu schnell entscheidet. Etwas geht schief, das vorher sicher war.",
      playableHint: "Kind ruft einen Namen zu früh aus, ein Echo antwortet falsch.",
    },
    {
      chapter: 4,
      arc: "DARKEST_MOMENT",
      beat: "Kind ist allein, hoffnungslos. Macht eine eigene, mutige kleine Geste (nicht das Problem lösen, aber nicht aufgeben).",
      playableHint: "Kind klopft drei Mal an eine kalte Wand, wartet.",
    },
    {
      chapter: 5,
      arc: "LANDING",
      beat: "Der Helfer aus Ch1 taucht auf — und tut genau das, was das Kind braucht. Nicht als Magie, sondern als Dankbarkeit.",
      playableHint: "Das Wesen aus Ch1 zieht das Kind an der Hand über den Rand, gibt zurück.",
    },
  ],
  antagonistPattern: {
    archetypeCategory: "the_controller",
    firstActionShape:
      "Antagonist erscheint in Ch3 als 'Regelhüter' — verlangt, dass das Kind etwas tut, was es eigentlich nicht kann (Prüfung).",
    defeatShape:
      "Der Helfer aus Ch1 findet eine Lücke in den Regeln des Antagonisten, die nur das Kind übersehen konnte.",
  },
  recommendedEndingPattern: "promise_kept",
  concreteAnchorHints: [
    {
      abstractTheme: "Dankbarkeit",
      concreteCandidates: [
        "die kleine Feder, die das Ch1-Wesen dem Kind gibt",
        "der rote Stein, der wieder auftaucht",
      ],
    },
    {
      abstractTheme: "Geben ohne Erwartung",
      concreteCandidates: [
        "der halbe Keks aus der Hosentasche",
        "das trockene Tuch für die nassen Pfoten",
      ],
    },
    {
      abstractTheme: "Mut allein",
      concreteCandidates: [
        "das drei Mal klopfende Kind an der kalten Wand",
        "die leise Stimme, die in die Dunkelheit hineinspricht",
      ],
    },
  ],
  typicalSettings: ["Wegkreuzung", "Brunnen", "Höhle", "Flussufer", "Klosterhof"],
  refrainCandidates: [
    { candidate: "Was du gibst, kommt zurück.", tone: "beruhigend" },
    { candidate: "Klopf, klopf, klopf.", tone: "entschlossen" },
    { candidate: "Auch leise zählt.", tone: "beruhigend" },
    { candidate: "Niemand schaut allein.", tone: "warnend" },
  ],
  iconicMotif: {
    object: "die kleine Feder in der Hosentasche",
    perChapterPosition: [
      "Das Kind hilft einem Vogel und steckt die kleine Feder ein, die es findet.",
      "Die Feder kitzelt am Bein, das Kind tastet kurz danach.",
      "Die Feder wird vom Wind weggeblasen, das Kind greift zu spät.",
      "Das Kind findet die Feder im Sand wieder, hält sie fest.",
      "Die Feder fliegt von selbst zurück zum Vogel, der zurückgekehrt ist.",
    ],
  },
};

// ─── MAGICAL WORLDS ─────────────────────────────────────────────────────────────

const SKEL_MW_ARTIFACT_WITH_PRICE: StorySkeleton = {
  id: "mw-01-artifact-price",
  genre: "magical-worlds",
  label: "Artefakt mit Preis",
  description:
    "Kind findet ein magisches Objekt mit Kraft. Jede Nutzung kostet etwas Kleines, Konkretes (eine Erinnerung, ein Ton, eine Farbe). Kind muss lernen, wann NICHT zu nutzen.",
  mustHaveMoment: {
    chapter: 4,
    description:
      "Das Kind entscheidet bewusst, das Artefakt NICHT zu nutzen, obwohl die Lösung eine Nutzung wäre. Es zahlt den Preis durch Verzicht.",
  },
  chapterHints: [
    {
      chapter: 1,
      arc: "SETUP",
      beat: "Kind findet ein kleines unscheinbares Artefakt. Testet es zufällig — etwas leuchtet, klingt, bewegt sich. Erster Preis ist noch nicht sichtbar.",
      playableHint: "Kind streichelt das Artefakt, es antwortet mit einem Ton.",
    },
    {
      chapter: 2,
      arc: "DISCOVERY",
      beat: "Kind nutzt das Artefakt zum zweiten Mal, diesmal bewusst. Bemerkt: etwas fehlt jetzt (eine Erinnerung, eine Farbe am Rand, ein Lieblingswort).",
      playableHint: "Kind summt und stockt — ein Teil der Melodie ist weg.",
    },
    {
      chapter: 3,
      arc: "TURNING_POINT",
      beat: "Dritte Nutzung — das Kind greift zu schnell zur Kraft. Der Preis ist diesmal groß (eine Person erinnert sich nicht mehr an etwas). Körper-Reaktion: Tränen, die nicht kommen wollen.",
      playableHint: "Kind sagt einen Namen, das Gegenüber fragt wer das ist.",
    },
    {
      chapter: 4,
      arc: "DARKEST_MOMENT",
      beat: "Kind steht vor einer Situation, wo die Kraft DIE Lösung wäre. Es entscheidet sich dagegen. Sitzt alleine mit dem Artefakt in der Hand.",
      playableHint: "Kind hält das Artefakt fest, legt es dann hin, dreht sich weg.",
    },
    {
      chapter: 5,
      arc: "LANDING",
      beat: "Das Verzichten hat eine eigene Lösung ermöglicht (anders, mit Hilfe der Umgebung). Kind versiegelt oder gibt das Artefakt weg.",
      playableHint: "Kind legt das Artefakt in eine Kiste, schließt den Deckel, atmet aus.",
    },
  ],
  antagonistPattern: {
    archetypeCategory: "the_greedy",
    firstActionShape:
      "Antagonist erscheint, weil er das Artefakt will. Bietet dem Kind 'Tausch' an.",
    defeatShape:
      "Das Kind gibt dem Antagonisten nicht das Artefakt — aber zeigt ihm, dass der Preis auch für den Antagonisten gilt. Der Antagonist weicht zurück.",
  },
  recommendedEndingPattern: "object_transformed",
  concreteAnchorHints: [
    {
      abstractTheme: "Verantwortung",
      concreteCandidates: [
        "das kleine steinerne Artefakt, das immer kälter wird",
        "die glitzernde Münze, die nach jeder Nutzung stumpfer wird",
        "die Holzfigur, deren Farbe langsam verblasst",
      ],
    },
    {
      abstractTheme: "Verzicht",
      concreteCandidates: [
        "die leere Hand, die das Kind geschlossen hält",
        "das Artefakt in der Kiste mit dem roten Band",
      ],
    },
    {
      abstractTheme: "Preis",
      concreteCandidates: [
        "der Name eines Freundes, der beim zweiten Einsatz verschwommen klingt",
        "die Lieblingsfarbe, die im Bild ihrer Erinnerung grau wird",
      ],
    },
  ],
  typicalSettings: ["verborgene Werkstatt", "Speicher", "Dachboden", "alter Brunnen", "geheimes Zimmer"],
  refrainCandidates: [
    { candidate: "Jede Kraft hat einen Preis.", tone: "warnend" },
    { candidate: "Nicht jetzt. Noch nicht.", tone: "entschlossen" },
    { candidate: "Stillhalten ist auch eine Antwort.", tone: "beruhigend" },
    { candidate: "Nimm die Hand weg.", tone: "warnend" },
  ],
  iconicMotif: {
    object: "das kühle Artefakt mit dem matten Schimmer",
    perChapterPosition: [
      "Das Kind findet das Artefakt unter Staub, es ist überraschend kühl.",
      "Das Artefakt liegt in der offenen Hand, der Schimmer pulsiert einmal.",
      "Das Artefakt ist diesmal kälter als sonst, etwas in der Erinnerung kippt.",
      "Das Kind legt das Artefakt aufs Brett, dreht sich weg.",
      "Das Artefakt liegt geschlossen in einer Kiste, das rote Band außen.",
    ],
  },
};

const SKEL_MW_GATE_TO_OTHER_WORLD: StorySkeleton = {
  id: "mw-02-gate-to-other-world",
  genre: "magical-worlds",
  label: "Tor in andere Welt",
  description:
    "Kind entdeckt eine Grenze/ein Tor zu einer anderen Welt. Tritt hindurch, lernt deren Regeln, kehrt verändert zurück. Hin-und-Zurück-Struktur.",
  mustHaveMoment: {
    chapter: 2,
    description:
      "Das Kind tritt durch das Tor und erlebt den 'Welt-Schock': alle Regeln anders, ein kleines Detail besonders fremd (Licht, Schatten, Klang).",
  },
  chapterHints: [
    {
      chapter: 1,
      arc: "SETUP",
      beat: "Kind bemerkt eine Unregelmäßigkeit am gewohnten Ort (eine Tür, die nicht da war, ein Spiegel, der flimmert, ein Geräusch hinter dem Schrank).",
      playableHint: "Kind legt die Hand auf die Wand, spürt Wärme, wo keine sein sollte.",
    },
    {
      chapter: 2,
      arc: "DISCOVERY",
      beat: "Tritt hindurch. Andere Welt ist nicht beängstigend, aber ALLES ist anders geregelt. Kind lernt die erste Regel durch Beobachtung.",
      playableHint: "Kind versucht zu springen, fällt seitwärts — Schwerkraft anders.",
    },
    {
      chapter: 3,
      arc: "TURNING_POINT",
      beat: "Kind bricht unabsichtlich eine lokale Regel. Jemand ist verletzt/traurig. Kind versteht jetzt, dass Regeln einen Grund haben.",
      playableHint: "Kind pflückt eine Blume, die sich zusammenzieht und weint.",
    },
    {
      chapter: 4,
      arc: "DARKEST_MOMENT",
      beat: "Kind sitzt im Exil dieser Welt, macht eine eigene Geste der Wiedergutmachung — nicht durch Macht, sondern durch Respekt.",
      playableHint: "Kind pflanzt die Blume zurück, kniet und wartet, bis etwas antwortet.",
    },
    {
      chapter: 5,
      arc: "LANDING",
      beat: "Kind darf durch das Tor zurück — aber ein kleines Detail der fremden Welt bleibt in ihm (ein Wort, ein Licht, ein Weg zu denken). Heimkehr mit Unterschied.",
      playableHint: "Kind hält an der Schwelle inne, schaut zurück, nickt, geht weiter.",
    },
  ],
  antagonistPattern: {
    archetypeCategory: "the_controller",
    firstActionShape:
      "Ein 'Hüter' der anderen Welt versucht das Kind gleich am Tor zurückzuschicken (aus gutem Grund: früherer Missbrauch).",
    defeatShape:
      "Der Hüter lässt das Kind bleiben, NACHDEM es die Ch4-Wiedergutmachung geleistet hat. Keine Konfrontation.",
  },
  recommendedEndingPattern: "return_home_changed",
  concreteAnchorHints: [
    {
      abstractTheme: "Respekt",
      concreteCandidates: [
        "die Blume, die das Kind in Ch3 bricht und in Ch4 zurückpflanzt",
        "der blaue Stein, den das Kind erst nimmt, dann zurücklegt",
      ],
    },
    {
      abstractTheme: "Fremdsein",
      concreteCandidates: [
        "der Schatten, der in die falsche Richtung fällt",
        "der Ton, der Wörter in dieser Welt anders klingen lässt",
      ],
    },
    {
      abstractTheme: "Mitbringsel",
      concreteCandidates: [
        "das kleine Blatt der anderen Welt, das das Kind im Haar trägt",
        "das leise summende Wort, das das Kind nun kennt",
      ],
    },
  ],
  typicalSettings: ["alter Spiegel", "Schrankrückwand", "Brunnenschacht", "Türrahmen im Keller", "Baumstumpf"],
  refrainCandidates: [
    { candidate: "Dort gilt etwas anderes.", tone: "fragend" },
    { candidate: "Nicht so wie zu Hause.", tone: "warnend" },
    { candidate: "Schritt für Schritt zurück.", tone: "beruhigend" },
    { candidate: "Hier ist hier, dort ist dort.", tone: "entschlossen" },
  ],
  iconicMotif: {
    object: "der schimmernde Türrahmen, der zwischen den Welten flackert",
    perChapterPosition: [
      "Das Kind bemerkt das Flackern am Türrahmen, legt die Hand auf die Wand daneben.",
      "Der Rahmen leuchtet kurz auf, das Kind tritt durch.",
      "Auf der anderen Seite ist der Rahmen kaum sichtbar, nur ein leises Schimmern.",
      "Das Kind steht vor dem Rahmen, der wackelt, als wolle er sich schließen.",
      "Das Kind tritt zurück durch den Rahmen, dahinter wird es ruhig.",
    ],
  },
};

const SKEL_MW_FORGOTTEN_RULE: StorySkeleton = {
  id: "mw-03-forgotten-rule",
  genre: "magical-worlds",
  label: "Die vergessene Regel",
  description:
    "Eine magische Gemeinschaft hat eine grundlegende Regel vergessen. Etwas läuft schief, niemand weiß warum. Kind entdeckt die vergessene Regel und hilft sie wiederherzustellen.",
  mustHaveMoment: {
    chapter: 3,
    description:
      "Das Kind findet die vergessene Regel — aber sie ist schwer auszusprechen, weil sie unbequem ist (z.B. 'Keine Magie ohne Mitgefühl').",
  },
  chapterHints: [
    {
      chapter: 1,
      arc: "SETUP",
      beat: "Kind kommt in die magische Gemeinschaft, spürt: etwas stimmt nicht (Farben zu grell, Lachen zu laut, Rhythmus falsch). Niemand kann sagen was.",
      playableHint: "Kind stolpert über einen Stein, der zur falschen Seite rollt.",
    },
    {
      chapter: 2,
      arc: "DISCOVERY",
      beat: "Kind trifft ein altes Wesen (oder ein Kind mit altem Wissen), das Andeutungen macht. Verweist auf einen alten Platz/Buch.",
      playableHint: "Das Wesen zeigt mit dem Finger, ohne zu sprechen, auf etwas Verstaubtes.",
    },
    {
      chapter: 3,
      arc: "TURNING_POINT",
      beat: "Kind liest/findet die vergessene Regel. Sie ist einfach, aber unbequem. Kind spürt den Widerstand der Gemeinschaft gegen die Regel.",
      playableHint: "Kind liest einen Satz laut, jemand schüttelt sofort den Kopf.",
    },
    {
      chapter: 4,
      arc: "DARKEST_MOMENT",
      beat: "Kind wird ausgelacht oder abgewiesen. Sitzt allein mit der Regel. Entscheidet: ich halte sie trotzdem.",
      playableHint: "Kind wiederholt die Regel leise zu sich selbst, nickt einmal.",
    },
    {
      chapter: 5,
      arc: "LANDING",
      beat: "Kind lebt die Regel einfach — und einer nach dem anderen folgt. Die Gemeinschaft heilt sich durch das Beispiel, nicht durch Predigt.",
      playableHint: "Kind wendet die Regel auf das kleine Tier an, ein zweiter macht es nach.",
    },
  ],
  antagonistPattern: {
    archetypeCategory: "the_absent",
    firstActionShape:
      "Antagonist ist kein einzelner Feind, sondern die kollektive Gleichgültigkeit / das Vergessen selbst. Profiteur des Vergessens zeigt sich erst in Ch3/4.",
    defeatShape:
      "Kein dramatischer Showdown. Das Leben-nach-der-Regel ist die Auflösung. Der Profiteur verliert seine Macht einfach durch Irrelevanz.",
  },
  recommendedEndingPattern: "circle_closed",
  concreteAnchorHints: [
    {
      abstractTheme: "Mitgefühl",
      concreteCandidates: [
        "das kleine verletzte Tier in Ch5, das die Gemeinschaft ignoriert hatte",
        "die Hand, die das Kind einem Fremden reicht",
      ],
    },
    {
      abstractTheme: "Integrität",
      concreteCandidates: [
        "das alte Buch mit der Regel, das das Kind bei sich trägt",
        "die Schrift an der Wand, die das Kind wieder sichtbar macht",
      ],
    },
    {
      abstractTheme: "Vorbild",
      concreteCandidates: [
        "das zweite Kind, das die Geste des Protagonisten nachmacht",
        "der Erwachsene, der vom Fenster schaut und plötzlich selbst teilt",
      ],
    },
  ],
  typicalSettings: ["magische Bibliothek", "Tempel-Innenhof", "Ruine", "Markt", "Baum der Ältesten"],
  refrainCandidates: [
    { candidate: "Eine Regel ist eine Regel.", tone: "warnend" },
    { candidate: "Auch wenn niemand schaut.", tone: "entschlossen" },
    { candidate: "Man hört sie nur, wenn es still ist.", tone: "beruhigend" },
    { candidate: "Drei Wörter. Nicht mehr.", tone: "fragend" },
  ],
  iconicMotif: {
    object: "die alte Schriftrolle mit den drei verblassten Worten",
    perChapterPosition: [
      "Das Kind entdeckt die Rolle hinter losem Putz, ein Wort darauf glüht kurz.",
      "Das Kind entrollt sie weiter, das zweite Wort wird sichtbar.",
      "Das Kind ignoriert das dritte Wort, etwas geht schief.",
      "Das Kind liest das dritte Wort jetzt laut vor, aber langsam.",
      "Die Rolle wird wieder zusammengerollt und an einen würdigen Platz gelegt.",
    ],
  },
};

// ─── EXPORTS ────────────────────────────────────────────────────────────────────

export const STORY_SKELETONS: ReadonlyArray<StorySkeleton> = [
  SKEL_CF_QUEST_OF_3_TRIALS,
  SKEL_CF_TRANSFORMATION,
  SKEL_CF_HELPER_RETURNS,
  SKEL_MW_ARTIFACT_WITH_PRICE,
  SKEL_MW_GATE_TO_OTHER_WORLD,
  SKEL_MW_FORGOTTEN_RULE,
];

export const STORY_SKELETON_MAP: ReadonlyMap<string, StorySkeleton> = new Map(
  STORY_SKELETONS.map((s) => [s.id, s]),
);

/**
 * Liefert alle Skelette für ein Genre.
 */
export function getSkeletonsByGenre(genre: StorySkeletonGenre): ReadonlyArray<StorySkeleton> {
  return STORY_SKELETONS.filter((s) => s.genre === genre);
}

/**
 * Heuristisches Matching: Welches Skelett passt am besten zur gegebenen
 * Genre-/Tag-Kombination? Deterministisch — kein LLM.
 */
export function pickBestSkeleton(input: {
  genre?: string;
  themeTags?: ReadonlyArray<string>;
  hasArtifact?: boolean;
  settingHint?: string;
}): StorySkeleton | undefined {
  const normalizedGenre = String(input.genre || "").toLowerCase();
  const isFairyTale =
    normalizedGenre.includes("fairy")
    || normalizedGenre.includes("märchen")
    || normalizedGenre.includes("maerchen")
    || normalizedGenre.includes("classical");
  const isMagicalWorld =
    normalizedGenre.includes("magical")
    || normalizedGenre.includes("magisch")
    || normalizedGenre.includes("fantasy")
    || normalizedGenre.includes("magical-worlds");

  let candidates: StorySkeleton[] = [];
  if (isFairyTale) candidates = STORY_SKELETONS.filter((s) => s.genre === "classical-fairy-tales");
  else if (isMagicalWorld) candidates = STORY_SKELETONS.filter((s) => s.genre === "magical-worlds");
  else candidates = [...STORY_SKELETONS];
  if (candidates.length === 0) candidates = [...STORY_SKELETONS];

  const tags = new Set((input.themeTags || []).map((t) => String(t).toLowerCase()));
  const setting = String(input.settingHint || "").toLowerCase();

  // Scoring-Heuristik
  const scored = candidates.map((skel) => {
    let score = 0;
    if (input.hasArtifact && skel.id === "mw-01-artifact-price") score += 3;
    if (input.hasArtifact && skel.id === "cft-01-three-trials") score += 1;
    if (tags.has("verwandlung") || tags.has("transformation") || tags.has("fluch")) {
      if (skel.id === "cft-02-transformation") score += 3;
    }
    if (tags.has("andere-welt") || tags.has("portal") || tags.has("tor")) {
      if (skel.id === "mw-02-gate-to-other-world") score += 3;
    }
    if (tags.has("gemeinschaft") || tags.has("regel") || tags.has("vergessen")) {
      if (skel.id === "mw-03-forgotten-rule") score += 3;
    }
    if (tags.has("helfer") || tags.has("dankbarkeit") || tags.has("gutherzig")) {
      if (skel.id === "cft-03-helper-returns") score += 3;
    }
    // Setting match bonus
    if (setting) {
      for (const typicalSetting of skel.typicalSettings) {
        if (setting.includes(typicalSetting.toLowerCase())) score += 1;
      }
    }
    return { skel, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.skel;
}

/**
 * Baut einen kompakten Prompt-Block für den Blueprint-LLM aus einem gewählten
 * Skelett. Der Blueprint bekommt die Struktur als STARKEN Hint, darf aber
 * abweichen (anders als bei hart-validierten Feldern).
 */
export function buildSkeletonPromptBlock(skeleton: StorySkeleton): string {
  const chapterLines = skeleton.chapterHints
    .map(
      (ch) =>
        `  Ch${ch.chapter} (${ch.arc}): ${ch.beat}\n    Playable: ${ch.playableHint}`,
    )
    .join("\n");

  const anchorLines = skeleton.concreteAnchorHints
    .map(
      (h) =>
        `  - "${h.abstractTheme}" → Kandidat: "${h.concreteCandidates[0]}"`,
    )
    .join("\n");

  const refrainLines = skeleton.refrainCandidates
    .map((r) => `  - "${r.candidate}" (Tonalität: ${r.tone})`)
    .join("\n");

  const motifLines = skeleton.iconicMotif.perChapterPosition
    .map((pos, idx) => `  Ch${idx + 1}: ${pos}`)
    .join("\n");

  return [
    `STORY SKELETON (recommended structural backbone — follow unless plot contradicts):`,
    `Skeleton: "${skeleton.label}" (${skeleton.id})`,
    `Genre: ${skeleton.genre}`,
    `Core: ${skeleton.description}`,
    `Must-have moment: Ch${skeleton.mustHaveMoment.chapter} — ${skeleton.mustHaveMoment.description}`,
    ``,
    `Chapter beats:`,
    chapterLines,
    ``,
    `Antagonist pattern:`,
    `  Archetype category: ${skeleton.antagonistPattern.archetypeCategory}`,
    `  First action shape: ${skeleton.antagonistPattern.firstActionShape}`,
    `  Defeat shape: ${skeleton.antagonistPattern.defeatShape}`,
    ``,
    `Recommended ending_pattern: "${skeleton.recommendedEndingPattern}" (blueprint may override if plot demands)`,
    ``,
    `Concrete-anchor hints (pick one candidate per theme for concrete_anchors field):`,
    anchorLines,
    ``,
    `REFRAIN CANDIDATES (Sprint 4 S4.2 — pick exactly ONE for blueprint.refrain_line, or invent a similar 2-6-word phrase that fits this story):`,
    refrainLines,
    ``,
    `ICONIC MOTIF (Sprint 5 S5.2 — must thread through all 5 chapters; use as blueprint.iconic_motif):`,
    `  Object: ${skeleton.iconicMotif.object}`,
    motifLines,
  ].join("\n");
}
