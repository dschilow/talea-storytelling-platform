import type { CastSet, IntegrationPlan, NormalizedRequest, SceneBeat, SceneDirective, StoryBlueprintBase, StoryVariantPlan } from "./types";
import { REQUIRED_IMAGE_AVOIDS } from "./constants";
import { validateSceneDirective } from "./schema-validator";

export function buildSceneDirectives(input: {
  normalized: NormalizedRequest;
  blueprint: StoryBlueprintBase;
  integrationPlan: IntegrationPlan;
  variantPlan: StoryVariantPlan;
  cast: CastSet;
}): SceneDirective[] {
  const { blueprint, integrationPlan, variantPlan, cast, normalized } = input;
  const isGerman = normalized.language === "de";

  // Pick a deterministic plot-shape and variant-rotation seed for THIS story
  // so two stories with the same blueprint shape produce different bucket
  // wording, conflict types, and goal phrasings. The seed is derived from the
  // storyId so the same story always renders identically, but two different
  // storyIds pick different shapes/wordings.
  const storySeed = hashSeed(normalized.storyId || `${cast.artifact?.name ?? ""}-${cast.avatars.map(a => a.displayName).join("|")}`);
  const plotShape = pickPlotShape(storySeed);
  const variantRotation = (storySeed >>> 8) & 0xff;

  return blueprint.scenes.map(scene => {
    const plan = integrationPlan.chapters.find(c => c.chapter === scene.sceneNumber);
    if (!plan) {
      throw new Error(`Missing integration plan for chapter ${scene.sceneNumber}`);
    }

    const override = variantPlan.sceneOverrides?.find(o => o.chapter === scene.sceneNumber);

    const setting = override?.setting ?? scene.setting;
    const sceneFocus = buildSceneFocus({
      sceneTitle: scene.sceneTitle,
      sceneDescription: scene.sceneDescription,
      setting,
    });
    const totalChapters = blueprint.scenes.length;
    const goal = override?.goal ?? buildChapterGoal(scene.sceneNumber, totalChapters, scene.sceneDescription, sceneFocus, isGerman, plotShape, variantRotation);
    const conflict = override?.conflict ?? buildChapterConflict(scene.sceneNumber, totalChapters, sceneFocus, isGerman, plotShape, variantRotation);
    const outcome = override?.outcome ?? buildChapterOutcome(scene.sceneNumber, totalChapters, scene.sceneDescription, sceneFocus, isGerman, plotShape, variantRotation);
    const artifactUsage = scene.artifactPolicy?.requiresArtifact
      ? (override?.artifactUsageHint ?? (isGerman
        ? "Das Artefakt spielt in dieser Szene eine wichtige Rolle."
        : `Artifact is relevant to ${scene.sceneTitle}.`))
      : (override?.artifactUsageHint ?? (isGerman
        ? "Das Artefakt wird in diesem Kapitel nicht genutzt."
        : "Artifact is not used in this chapter."));
    const canonAnchorLine = override?.canonAnchorLineHint ?? plan.canonAnchorLine;

    const imageMustShow = buildImageMustShow(scene, plan, cast, override?.imageMustShowAdd);
    const imageAvoid = buildImageAvoid(scene, override?.imageAvoidAdd);

    const directive: SceneDirective = {
      chapter: scene.sceneNumber,
      setting,
      mood: scene.mood,
      charactersOnStage: plan.charactersOnStage,
      goal,
      conflict,
      outcome,
      artifactUsage,
      canonAnchorLine,
      dialogCues: [],
      imageMustShow,
      imageAvoid,
    };

    enforceDirectiveRules(directive, scene, normalized);

    const validation = validateSceneDirective(directive);
    if (!validation.valid) {
      console.warn("[pipeline] SceneDirective schema validation failed", validation.errors);
    }

    return directive;
  });
}

function buildImageMustShow(
  scene: SceneBeat,
  plan: IntegrationPlan["chapters"][number],
  cast: CastSet,
  additions?: string[]
): string[] {
  const maxItems = 7;
  const items: string[] = [];
  const seen = new Set<string>();
  const add = (value?: string | null) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    if (items.length >= maxItems) return;
    seen.add(trimmed);
    items.push(trimmed);
  };

  add(scene.setting);

  for (const slot of plan.charactersOnStage) {
    const sheet = findCharacterBySlot(cast, slot);
    if (!sheet) continue;
    add(sheet.displayName);
  }

  if (scene.artifactPolicy?.requiresArtifact) {
    add(cast.artifact.name);
  }

  for (const slot of plan.charactersOnStage) {
    if (items.length >= maxItems) break;
    const sheet = findCharacterBySlot(cast, slot);
    const signature = sheet?.visualSignature?.[0];
    add(signature);
  }

  (additions || []).forEach(item => add(item));

  return items;
}

function buildImageAvoid(scene: SceneBeat, additions?: string[]): string[] {
  const items = new Set<string>([...(scene.imageAvoid || []), ...REQUIRED_IMAGE_AVOIDS]);
  (additions || []).forEach(item => items.add(item));
  return Array.from(items).slice(0, 30);
}

function enforceDirectiveRules(directive: SceneDirective, scene: SceneBeat, normalized: NormalizedRequest) {
  const uniqueSlots = new Set(directive.charactersOnStage);
  if (uniqueSlots.size !== directive.charactersOnStage.length) {
    directive.charactersOnStage = Array.from(uniqueSlots);
  }

  if (normalized.ageMax > 8) {
    const mustInclude = new Set(scene.mustIncludeSlots || []);
    for (const slot of mustInclude) {
      if (!uniqueSlots.has(slot)) {
        directive.charactersOnStage.push(slot);
        uniqueSlots.add(slot);
      }
    }
  }

  if (scene.artifactPolicy?.requiresArtifact && !directive.charactersOnStage.includes("SLOT_ARTIFACT_1")) {
    directive.charactersOnStage.push("SLOT_ARTIFACT_1");
  }

  REQUIRED_IMAGE_AVOIDS.forEach(token => {
    if (!directive.imageAvoid.some(item => item.toLowerCase().includes(token.split(" ")[0]))) {
      directive.imageAvoid.push(token);
    }
  });
}

function buildSceneFocus(input: {
  sceneTitle?: string;
  sceneDescription?: string;
  setting?: string;
}): string {
  const candidates = [input.sceneTitle, input.sceneDescription, input.setting]
    .map(value => trimDirectiveNarrativeText(value))
    .filter(Boolean);

  return candidates[0] || "dieser Szene";
}

function trimDirectiveNarrativeText(value?: string, maxWords = 8, maxChars = 70): string {
  const cleaned = String(value || "")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/[\"'“”„]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  const firstClause = cleaned.split(/[.!?;:]/)[0]?.trim() || cleaned;
  const limitedWords = firstClause.split(/\s+/).slice(0, maxWords).join(" ");
  return limitedWords.slice(0, maxChars).trim();
}

function findCharacterBySlot(cast: CastSet, slotKey: string) {
  return cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
}

// ────────────────────────── Plot Shapes ──────────────────────────
//
// A plot shape determines what KIND of beat each chapter should be. The
// previous version had a single linear-escalation shape baked into the
// scene-directive code: every story went setup → temptation → plan-fails →
// admit-mistake → final-pressure. Multiple stories with the same shape
// inevitably feel identical even with different avatars and artifacts.
//
// We now define multiple distinct shapes. One is picked deterministically
// from the storyId, so the same story always renders the same shape but two
// different stories pick different shapes.
//
// Shape names map to bucket-pool keys below. Each shape has 5 beat slots
// (one per chapter for a 5-chapter story); for non-5-chapter stories the
// chapter is mapped to the closest beat slot.
type BeatKind =
  | "obstacle"        // visible blocked path
  | "temptation"      // shiny shortcut tries to mislead
  | "plan-fail"       // tool/clue stops working
  | "admission"       // own mistake must be admitted
  | "time-pressure"   // race against deadline
  | "discovery"       // unexpected find changes everything
  | "isolation"       // child split from companion
  | "kindness-test"   // helping costs something
  | "perspective"     // seeing the situation differently
  | "trickster"       // someone is not who they seem
  | "loss"            // something or someone goes missing
  | "reunion"         // characters find each other
  | "ritual"          // a small repeated action becomes important
  | "grumpy-soft"     // a hard outsider warms up
  | "puzzle-solve";   // a real puzzle is figured out

type PlotShape = {
  id: string;
  beats: [BeatKind, BeatKind, BeatKind, BeatKind, BeatKind];
};

const PLOT_SHAPES: PlotShape[] = [
  // Linear escalation (the legacy default). Kept so existing flows still work.
  { id: "linear-escalation", beats: ["obstacle", "temptation", "plan-fail", "admission", "time-pressure"] },
  // Discovery arc: unexpected find shifts the whole mission.
  { id: "discovery", beats: ["obstacle", "discovery", "perspective", "kindness-test", "reunion"] },
  // Lost-and-found: someone goes missing and must be brought back.
  { id: "lost-and-found", beats: ["loss", "obstacle", "trickster", "admission", "reunion"] },
  // Trickster: a side character is not who they seem.
  { id: "trickster", beats: ["obstacle", "trickster", "isolation", "perspective", "reunion"] },
  // Grumpy-soft: a closed-off NPC opens up across the chapters.
  { id: "grumpy-soft", beats: ["obstacle", "grumpy-soft", "kindness-test", "admission", "reunion"] },
  // Puzzle: a real puzzle has to be figured out, not just felt.
  { id: "puzzle", beats: ["obstacle", "puzzle-solve", "plan-fail", "perspective", "time-pressure"] },
  // Ritual: a small repeated action becomes the key.
  { id: "ritual", beats: ["ritual", "obstacle", "plan-fail", "ritual", "kindness-test"] },
  // Split-and-rejoin: the two children separate and must find each other.
  { id: "split-rejoin", beats: ["obstacle", "isolation", "discovery", "loss", "reunion"] },
];

function hashSeed(input: string): number {
  // FNV-1a 32-bit hash. Stable across runs, fast, no deps.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickPlotShape(seed: number): PlotShape {
  return PLOT_SHAPES[seed % PLOT_SHAPES.length];
}

function chapterToBeat(chapter: number, total: number, shape: PlotShape): BeatKind {
  if (total <= 1) return shape.beats[shape.beats.length - 1];
  const ratio = (chapter - 1) / (total - 1);
  const idx = Math.min(shape.beats.length - 1, Math.max(0, Math.round(ratio * (shape.beats.length - 1))));
  return shape.beats[idx];
}

// ────────────────────────── Variant Pools ──────────────────────────
//
// For each beat kind, we define multiple wording variants for goal/conflict/
// outcome. The variantRotation index (derived from storyId) picks which
// wording is used for THIS story. Two stories with the same beat sequence but
// different storyIds therefore see different wording — which makes the AI
// produce different prose even when the structural beats match.

type Variants = {
  conflict: string[];
  goal: string[];
  outcome: string[];
};

// All German variants. Templates use ${focus} as the scene-focus placeholder.
const BEATS_DE: Record<BeatKind, Variants> = {
  obstacle: {
    conflict: [
      `Rund um ${"${focus}"} blockiert ein echter, sichtbarer Widerstand den Weg: etwas ist versperrt, verrutscht oder zu weit weg.`,
      `Bei ${"${focus}"} steht etwas im Weg, das sich nicht einfach wegschieben lässt: ein Riegel, ein nasses Brett, eine zu hohe Stufe.`,
      `An ${"${focus}"} merken die Kinder: hier kommt man nicht durch, ohne erst genau hinzusehen.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} den richtigen Weg erkennen und trotz Hindernis weitergehen.`,
      `Bei ${"${focus}"} müssen die Kinder das Hindernis nicht überwinden, sondern verstehen — und dann passend handeln.`,
      `Bei ${"${focus}"} ist der erste Auftrag: nicht die Mauer einreißen, sondern das Schlupfloch finden.`,
    ],
    outcome: [
      `Der erste Schritt gelingt bei ${"${focus}"}, aber sofort wird klar: Der Weg ist kniffliger als gedacht.`,
      `Bei ${"${focus}"} kommt die Gruppe einen halben Schritt weiter — und sieht dabei zum ersten Mal, wie groß die ganze Aufgabe wirklich ist.`,
      `Das Hindernis bei ${"${focus}"} gibt nach, doch genau dahinter zeigt sich das eigentliche Problem.`,
    ],
  },
  temptation: {
    conflict: [
      `Rund um ${"${focus}"} lockt etwas Falsches. Der schnelle, süße oder glänzende Weg wirkt leicht, führt aber vom Auftrag weg.`,
      `Bei ${"${focus}"} bietet jemand etwas an, das wie eine Belohnung aussieht — aber den Preis erkennt man erst später.`,
      `An ${"${focus}"} ist die kürzere Abkürzung perfekt sichtbar. Genau das macht sie verdächtig.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} ihrem Auftrag treu bleiben und der lockenden Abkürzung widerstehen.`,
      `Bei ${"${focus}"} ist die Aufgabe: das Verlockende erkennen und trotzdem den umständlicheren, ehrlicheren Weg gehen.`,
      `Bei ${"${focus}"} müssen die Kinder einander stützen, damit keiner allein der Lockung folgt.`,
    ],
    outcome: [
      `Die Kinder kommen bei ${"${focus}"} weiter, doch die falsche Lockung hat schon eine Spur von Ärger hinterlassen.`,
      `Bei ${"${focus}"} bleiben sie standhaft, aber ein kleiner Stachel bleibt: einer hat fast nachgegeben.`,
      `Sie gehen vorbei an der Verlockung — und sehen sich danach kurz nicht in die Augen.`,
    ],
  },
  "plan-fail": {
    conflict: [
      `Bei ${"${focus}"} kippt der erste Plan. Ein wichtiges Zeichen, Werkzeug oder Versprechen taugt plötzlich nicht mehr.`,
      `An ${"${focus}"} stellt sich heraus: das, worauf sich die Kinder verlassen haben, funktioniert hier nicht.`,
      `Bei ${"${focus}"} wird klar, dass sie etwas Grundlegendes übersehen haben.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} nach dem gescheiterten Versuch einen neuen, konkreten Plan finden.`,
      `Bei ${"${focus}"} müssen die Kinder verstehen, woran der Plan gescheitert ist — nicht einfach den nächsten probieren.`,
      `Bei ${"${focus}"} müssen sie kurz innehalten und einen kleineren, ehrlicheren Schritt wählen.`,
    ],
    outcome: [
      `Bei ${"${focus}"} ist der alte Plan endgültig weg, dafür taucht ein echter Hinweis auf, der nur mit Ruhe lesbar wird.`,
      `Bei ${"${focus}"} stehen sie kurz ratlos — und finden im Stillen einen ersten neuen Schritt.`,
      `Der gescheiterte Plan zeigt bei ${"${focus}"}, was als Nächstes wirklich wichtig ist.`,
    ],
  },
  admission: {
    conflict: [
      `Bei ${"${focus}"} reicht Drauflossein nicht mehr. Ein Kind muss zugeben, dass sein erster Impuls falsch war, und Hilfe annehmen.`,
      `An ${"${focus}"} muss eines der Kinder sich eingestehen, dass es Angst hatte und etwas verschwiegen hat.`,
      `Bei ${"${focus}"} steht die Frage im Raum, die keiner stellen wollte: Wer war es?`,
    ],
    goal: [
      `Ein Kind muss bei ${"${focus}"} den eigenen Fehler zugeben und mit Hilfe reparieren, was schiefging.`,
      `Bei ${"${focus}"} muss eines der Kinder den ersten Satz finden, der die Wahrheit aussprechen kann.`,
      `Bei ${"${focus}"} ist die Aufgabe nicht das Tun, sondern das Sagen: kurz, klar, ohne Ausrede.`,
    ],
    outcome: [
      `Die Gruppe fängt sich bei ${"${focus}"} wieder, bezahlt aber einen kleinen Preis und geht klarer als zuvor weiter.`,
      `Bei ${"${focus}"} legt sich etwas Schweres ab, und der nächste Schritt fühlt sich leichter an.`,
      `Nach dem ehrlichen Satz bei ${"${focus}"} schauen sie einander wieder an.`,
    ],
  },
  "time-pressure": {
    conflict: [
      `Am Ende bei ${"${focus}"} drängen Zeit, Angst und der alte Fehler gleichzeitig. Nur ein klarer gemeinsamer Schritt bringt die Kinder hindurch.`,
      `Bei ${"${focus}"} läuft die Zeit ab. Was jetzt nicht passiert, passiert nicht mehr.`,
      `An ${"${focus}"} hört man die Uhr fast schon ticken — und einer der beiden zittert, ohne es zuzugeben.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} die Spur bis zum echten Ziel zu Ende bringen und den Anfangsauftrag sichtbar einlösen.`,
      `Bei ${"${focus}"} müssen sie schnell sein, ohne in Eile zu fallen: ein klarer Schritt, kein Sprung.`,
      `Bei ${"${focus}"} müssen die beiden zusammen handeln; einer allein schafft es nicht.`,
    ],
    outcome: [
      `Bei ${"${focus}"} wird das Ziel konkret gesichert: etwas ist wieder da, der Heimweg ist klar, und am Ende gibt es einen warmen Zusammen-Moment.`,
      `Bei ${"${focus}"} kommen sie gerade rechtzeitig — aber nicht so glatt, wie sie es sich vorgestellt haben.`,
      `Sie schaffen es bei ${"${focus}"}, und dann sitzen sie nebeneinander und sagen lange nichts.`,
    ],
  },
  discovery: {
    conflict: [
      `Bei ${"${focus}"} taucht etwas auf, das niemand erwartet hat — und es passt nicht zur bisherigen Geschichte.`,
      `An ${"${focus}"} entdecken die Kinder einen Hinweis, der bedeutet: nichts ist so, wie sie dachten.`,
      `Bei ${"${focus}"} liegt etwas Kleines, Übersehenes, das alles ändern wird.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} verstehen, was sie da gerade gefunden haben — und ihren Plan daran anpassen.`,
      `Bei ${"${focus}"} sollen die Kinder dem Neuen Raum geben, ohne ihren Auftrag zu verlieren.`,
      `Bei ${"${focus}"} dürfen die Kinder sich kurz wundern und dann eine Entscheidung treffen.`,
    ],
    outcome: [
      `Nach dem Fund bei ${"${focus}"} ist die Welt der Kinder ein Stück größer geworden.`,
      `Bei ${"${focus}"} öffnet sich eine neue Frage, die ehrlich Mut kostet.`,
      `Bei ${"${focus}"} wechselt der Plan, aber das Ziel bleibt gleich.`,
    ],
  },
  isolation: {
    conflict: [
      `Bei ${"${focus}"} werden die Kinder getrennt. Eines steht plötzlich allein da und muss sich entscheiden.`,
      `An ${"${focus}"} verliert eines der Kinder den anderen aus den Augen — und merkt, wie still es plötzlich ist.`,
      `Bei ${"${focus}"} reicht ein falscher Schritt, und einer ist allein.`,
    ],
    goal: [
      `Das einzelne Kind muss bei ${"${focus}"} ohne den anderen die nächste, ehrliche Entscheidung treffen.`,
      `Bei ${"${focus}"} muss ein Kind merken, dass Alleinsein nicht dasselbe ist wie Verlorensein.`,
      `Bei ${"${focus}"} muss das einzelne Kind sich an die eigene Stärke erinnern.`,
    ],
    outcome: [
      `Bei ${"${focus}"} entdeckt das Kind allein etwas, das beide vorher übersehen haben.`,
      `Nach der Trennung bei ${"${focus}"} sind beide Kinder ein klein wenig erwachsener.`,
      `Bei ${"${focus}"} wird klar, was das Kind allein tun kann — und was es lieber zu zweit tut.`,
    ],
  },
  "kindness-test": {
    conflict: [
      `Bei ${"${focus}"} braucht jemand Hilfe, und Helfen kostet Zeit, die die Kinder eigentlich nicht haben.`,
      `An ${"${focus}"} steht ein Wesen am Rand, das übersehen wird, wenn niemand stehen bleibt.`,
      `Bei ${"${focus}"} müssen die Kinder zwischen ihrem Auftrag und einem leisen Hilferuf entscheiden.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} merken, dass kurz helfen klüger sein kann als schnell weitermachen.`,
      `Bei ${"${focus}"} ist die Aufgabe nicht den Auftrag zu ändern, sondern ihn um eine kleine Geste zu erweitern.`,
      `Bei ${"${focus}"} sollen die Kinder helfen, ohne sich dabei selbst zu verlieren.`,
    ],
    outcome: [
      `Die kleine Hilfe bei ${"${focus}"} kostet etwas, gibt aber etwas Größeres zurück.`,
      `Bei ${"${focus}"} bekommen die Kinder unverhofft einen Schubs, weil sie nicht weitergerannt sind.`,
      `Bei ${"${focus}"} merkt jemand, dass die beiden ihn gesehen haben — und das verändert mehr als der eigentliche Auftrag.`,
    ],
  },
  perspective: {
    conflict: [
      `Bei ${"${focus}"} stimmt das Bild nicht: was die Kinder zu sehen glauben, ist nur die halbe Wahrheit.`,
      `An ${"${focus}"} merken die Kinder, dass sie die Sache von der falschen Seite angeschaut haben.`,
      `Bei ${"${focus}"} verschiebt sich das, was wichtig schien, plötzlich an den Rand.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} ihre Perspektive wechseln — wörtlich oder im Kopf.`,
      `Bei ${"${focus}"} müssen die Kinder einmal kurz den eigenen Standpunkt verlassen.`,
      `Bei ${"${focus}"} sollen die Kinder begreifen, dass jemand anders das hier ganz anders sieht.`,
    ],
    outcome: [
      `Nach dem Perspektivwechsel bei ${"${focus}"} ist plötzlich etwas leicht, das vorher schwer war.`,
      `Bei ${"${focus}"} sehen die Kinder, was sie wirklich tun müssen — und es ist nicht das, was sie geplant hatten.`,
      `Bei ${"${focus}"} öffnet die neue Sicht eine Tür, die vorher gar nicht da war.`,
    ],
  },
  trickster: {
    conflict: [
      `Bei ${"${focus}"} ist jemand nicht der, für den er sich ausgibt — und die Kinder merken es noch nicht.`,
      `An ${"${focus}"} klingt jemand zu freundlich, zu hilfsbereit, zu glatt.`,
      `Bei ${"${focus}"} stimmen zwei Sätze derselben Person nicht überein.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} die kleine Lücke in der Geschichte des Tricksters bemerken.`,
      `Bei ${"${focus}"} müssen die Kinder höflich bleiben und trotzdem nachfragen.`,
      `Bei ${"${focus}"} sollen die Kinder etwas Einfaches prüfen: passen Worte und Tun zusammen?`,
    ],
    outcome: [
      `Bei ${"${focus}"} fällt die Maske, ohne dass jemand laut werden muss.`,
      `Bei ${"${focus}"} bleibt der Trickster zurück, leiser als zuvor.`,
      `Bei ${"${focus}"} verstehen die Kinder, dass auch ein Trickser nicht einfach böse ist.`,
    ],
  },
  loss: {
    conflict: [
      `Bei ${"${focus}"} fehlt etwas oder jemand — und niemand weiß, seit wann.`,
      `An ${"${focus}"} ist eine Lücke, die vorher nicht da war.`,
      `Bei ${"${focus}"} merken die Kinder erst beim zweiten Hinschauen, dass etwas Wichtiges weg ist.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} herausfinden, was fehlt — bevor sie wissen können, was zu tun ist.`,
      `Bei ${"${focus}"} müssen die Kinder benennen, was sie verloren haben, ohne sich gegenseitig die Schuld zu geben.`,
      `Bei ${"${focus}"} sollen die Kinder die Lücke nicht sofort füllen, sondern erst verstehen.`,
    ],
    outcome: [
      `Bei ${"${focus}"} fühlt sich der Verlust kleiner an, sobald sie ihn beim Namen nennen.`,
      `Bei ${"${focus}"} legen die Kinder fest, was sie als Nächstes suchen — und der Weg wird klarer.`,
      `Nach dem Bemerken des Verlusts bei ${"${focus}"} schauen die Kinder genauer hin als zuvor.`,
    ],
  },
  reunion: {
    conflict: [
      `Bei ${"${focus}"} müssen Wege wieder zusammenfinden — und die Kinder sind sich noch nicht sicher, ob das einfach geht.`,
      `An ${"${focus}"} liegen Worte zwischen den Kindern, die noch nicht gesagt wurden.`,
      `Bei ${"${focus}"} reicht es nicht, nebeneinander zu stehen; etwas muss sich aktiv schließen.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} den letzten kleinen Schritt aufeinander zumachen.`,
      `Bei ${"${focus}"} sollen die Kinder ohne große Geste zeigen, dass sie wieder beieinander sind.`,
      `Bei ${"${focus}"} müssen die Kinder einander zugeben, dass es einsam war.`,
    ],
    outcome: [
      `Bei ${"${focus}"} ist es plötzlich wieder still im Bauch — auf die gute Art.`,
      `Bei ${"${focus}"} sitzen die Kinder am Ende nebeneinander, ohne reden zu müssen.`,
      `Bei ${"${focus}"} schaut einer den anderen kurz an, und das genügt.`,
    ],
  },
  ritual: {
    conflict: [
      `Bei ${"${focus}"} braucht es eine kleine, exakt richtige Reihenfolge — und niemand hat sie aufgeschrieben.`,
      `An ${"${focus}"} muss etwas Bestimmtes auf eine bestimmte Weise getan werden, sonst passiert gar nichts.`,
      `Bei ${"${focus}"} entscheidet die Geste, nicht die Kraft.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} eine kleine Handlung ehrlich und ruhig wiederholen.`,
      `Bei ${"${focus}"} sollen die Kinder eine genaue Folge von kleinen Schritten herausfinden.`,
      `Bei ${"${focus}"} müssen die Kinder lernen, dass Wiederholung kein Fehler ist.`,
    ],
    outcome: [
      `Bei ${"${focus}"} öffnet die richtige kleine Geste etwas, was Kraft nicht geöffnet hätte.`,
      `Bei ${"${focus}"} merken die Kinder, dass sie die Geste mitgenommen haben.`,
      `Nach der Wiederholung bei ${"${focus}"} fühlt sich alles ein bisschen geordneter an.`,
    ],
  },
  "grumpy-soft": {
    conflict: [
      `Bei ${"${focus}"} blockt jemand alles ab, und nichts geht weiter, solange er das tut.`,
      `An ${"${focus}"} sitzt eine Person, die seit Tagen nicht gelacht hat, und genau die haben die Kinder vor sich.`,
      `Bei ${"${focus}"} schauen die Kinder einer harten Schale ins Gesicht.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} die mürrische Person nicht überzeugen, sondern sehen.`,
      `Bei ${"${focus}"} müssen die Kinder Geduld haben, ohne auf zu hoffen.`,
      `Bei ${"${focus}"} sollen die Kinder einen einzigen ehrlichen Satz finden, der nicht schmeichelt.`,
    ],
    outcome: [
      `Bei ${"${focus}"} öffnet sich die harte Schale einen winzigen Spalt — mehr braucht es heute nicht.`,
      `Bei ${"${focus}"} hilft die Person den Kindern, ohne es zuzugeben, und die Kinder merken es trotzdem.`,
      `Bei ${"${focus}"} bleibt die Person so, wie sie ist, aber ihr Blick wandert kurz mit den Kindern.`,
    ],
  },
  "puzzle-solve": {
    conflict: [
      `Bei ${"${focus}"} stehen die Kinder vor einem echten Rätsel, das nicht durch Mut, sondern nur durch Hinsehen lösbar ist.`,
      `An ${"${focus}"} ergibt das Sichtbare keinen Sinn, bevor man es in der richtigen Reihenfolge ordnet.`,
      `Bei ${"${focus}"} liegt der Schlüssel in einem Detail, das man leicht übersieht.`,
    ],
    goal: [
      `Die Kinder müssen bei ${"${focus}"} ruhig genug werden, um das Muster wirklich zu sehen.`,
      `Bei ${"${focus}"} müssen die Kinder zwei Dinge zusammenbringen, die zuerst nicht zusammenpassten.`,
      `Bei ${"${focus}"} sollen die Kinder eine kleine Hypothese aussprechen — und sie auch verwerfen können.`,
    ],
    outcome: [
      `Bei ${"${focus}"} klickt das Rätsel ein, und plötzlich war die ganze Zeit alles da.`,
      `Bei ${"${focus}"} verstehen die Kinder, dass die Lösung einfacher war als die Suche.`,
      `Nach dem Rätsel bei ${"${focus}"} fühlen sie sich nicht klüger, sondern wacher.`,
    ],
  },
};

const BEATS_EN: Record<BeatKind, Variants> = {
  obstacle: {
    conflict: [`Around ${"${focus}"}, a real visible obstacle blocks the way: something is shut, shifted, or just out of reach.`],
    goal: [`The children must spot the right way at ${"${focus}"} and keep moving despite the obstacle.`],
    outcome: [`The first step works at ${"${focus}"}, but it becomes clear right away that the path is trickier than expected.`],
  },
  temptation: {
    conflict: [`Around ${"${focus}"}, the wrong thing looks easy. A sweet, shiny, or quick shortcut pulls the children away from their mission.`],
    goal: [`The children must stay loyal to the mission at ${"${focus}"} and resist the tempting shortcut.`],
    outcome: [`The children move forward at ${"${focus}"}, but the false temptation leaves behind a fresh complication.`],
  },
  "plan-fail": {
    conflict: [`At ${"${focus}"}, the first plan collapses. A key clue, tool, or promise no longer works the way they expected.`],
    goal: [`At ${"${focus}"}, the children must replace the failed attempt with a new concrete plan.`],
    outcome: [`At ${"${focus}"}, the old plan is gone for good, but a real clue appears that only calm attention can read.`],
  },
  admission: {
    conflict: [`At ${"${focus}"}, rushing stops working. One child must admit the first impulse was wrong and accept help.`],
    goal: [`At ${"${focus}"}, one child must admit the mistake and help repair what went wrong.`],
    outcome: [`The group regains balance at ${"${focus}"}, pays a small price, and moves on with a clearer plan.`],
  },
  "time-pressure": {
    conflict: [`At the end around ${"${focus}"}, time pressure, fear, and the earlier mistake hit together. Only one clear shared step gets the children through.`],
    goal: [`At ${"${focus}"}, the children must finish the trail to the real goal and visibly pay off the opening mission.`],
    outcome: [`At ${"${focus}"}, the goal is secured in a concrete way: something is truly recovered, the way home is clear, and the ending lands in warmth.`],
  },
  discovery: {
    conflict: [`At ${"${focus}"}, something unexpected appears that does not fit the story so far.`],
    goal: [`The children must understand what they have found at ${"${focus}"} and adjust their plan accordingly.`],
    outcome: [`After the find at ${"${focus}"}, the children's world has grown a little larger.`],
  },
  isolation: {
    conflict: [`At ${"${focus}"}, the children get separated. One stands alone and has to decide.`],
    goal: [`The lone child must make the next honest decision at ${"${focus}"} without the other.`],
    outcome: [`At ${"${focus}"}, the child alone discovers something both had overlooked.`],
  },
  "kindness-test": {
    conflict: [`At ${"${focus}"}, someone needs help, and helping costs time the children do not really have.`],
    goal: [`The children must realize at ${"${focus}"} that pausing to help can be smarter than rushing on.`],
    outcome: [`The small kindness at ${"${focus}"} costs something but gives back something larger.`],
  },
  perspective: {
    conflict: [`At ${"${focus}"}, the picture is wrong: what the children think they see is only half the truth.`],
    goal: [`The children must shift their perspective at ${"${focus}"} — literally or in their heads.`],
    outcome: [`After the perspective shift at ${"${focus}"}, something hard is suddenly easy.`],
  },
  trickster: {
    conflict: [`At ${"${focus}"}, someone is not who they claim to be — and the children do not notice yet.`],
    goal: [`The children must spot the small gap in the trickster's story at ${"${focus}"}.`],
    outcome: [`At ${"${focus}"}, the mask falls without anyone needing to shout.`],
  },
  loss: {
    conflict: [`At ${"${focus}"}, something or someone is missing — and nobody knows since when.`],
    goal: [`The children must figure out what is missing at ${"${focus}"} before they can know what to do.`],
    outcome: [`At ${"${focus}"}, the loss feels smaller once they name it.`],
  },
  reunion: {
    conflict: [`At ${"${focus}"}, paths must come back together — and the children are not yet sure that will be easy.`],
    goal: [`The children must take the last small step toward each other at ${"${focus}"}.`],
    outcome: [`At ${"${focus}"}, the stomach goes quiet again — in a good way.`],
  },
  ritual: {
    conflict: [`At ${"${focus}"}, a small exact sequence is needed — and nobody wrote it down.`],
    goal: [`The children must repeat a small action honestly and calmly at ${"${focus}"}.`],
    outcome: [`At ${"${focus}"}, the right small gesture opens what force could not.`],
  },
  "grumpy-soft": {
    conflict: [`At ${"${focus}"}, someone blocks everything, and nothing moves while they do.`],
    goal: [`The children must not convince the grumpy person at ${"${focus}"} but truly see them.`],
    outcome: [`At ${"${focus}"}, the hard shell opens just a tiny crack — and that is enough today.`],
  },
  "puzzle-solve": {
    conflict: [`At ${"${focus}"}, the children stand before a real puzzle — only attention solves it, not courage.`],
    goal: [`The children must become quiet enough at ${"${focus}"} to truly see the pattern.`],
    outcome: [`At ${"${focus}"}, the puzzle clicks, and suddenly it had all been there.`],
  },
};

function pickVariant(variants: string[], rotation: number, slot: number): string {
  if (variants.length === 0) return "";
  // Combine rotation seed and chapter slot so different chapters in the same
  // story pick different variants when multiple exist.
  const idx = (rotation + slot * 7) % variants.length;
  return variants[idx];
}

function renderTemplate(template: string, focus: string): string {
  return template.replace(/\$\{focus\}/g, focus);
}

function buildChapterConflict(
  chapter: number,
  total: number,
  sceneFocus: string,
  isGerman: boolean,
  shape: PlotShape,
  variantRotation: number,
): string {
  const beat = chapterToBeat(chapter, total, shape);
  const pool = isGerman ? BEATS_DE[beat] : BEATS_EN[beat];
  const tpl = pickVariant(pool.conflict, variantRotation, chapter);
  return renderTemplate(tpl, sceneFocus);
}

function buildChapterGoal(
  chapter: number,
  total: number,
  fallbackDescription: string,
  sceneFocus: string,
  isGerman: boolean,
  shape: PlotShape,
  variantRotation: number,
): string {
  const beat = chapterToBeat(chapter, total, shape);
  const pool = isGerman ? BEATS_DE[beat] : BEATS_EN[beat];
  const tpl = pickVariant(pool.goal, variantRotation, chapter);
  return renderTemplate(tpl, sceneFocus) || fallbackDescription;
}

function buildChapterOutcome(
  chapter: number,
  total: number,
  fallbackDescription: string,
  sceneFocus: string,
  isGerman: boolean,
  shape: PlotShape,
  variantRotation: number,
): string {
  const beat = chapterToBeat(chapter, total, shape);
  const pool = isGerman ? BEATS_DE[beat] : BEATS_EN[beat];
  const tpl = pickVariant(pool.outcome, variantRotation, chapter);
  return renderTemplate(tpl, sceneFocus) || fallbackDescription || (isGerman ? `Die Szene führt zum nächsten Beat.` : `The scene progresses toward the next beat.`);
}
