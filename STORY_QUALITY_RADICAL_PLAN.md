# Talea – Radikaler Qualitätsplan für Story-Pipeline
**Datum:** 2026-04-17
**Ziel:** Kindergeschichten auf 10.0-Niveau (vergleichbar mit *Schule der magischen Tiere*, *Sams*, *Kokosnuss*, *Pettersson*)
**Analysierter Fall:** *Das Geheimnis von Weisheitskrone* → Eigenbewertung 5.2 / 10

---

## 1 · Root-Cause (knallhart)

Die Pipeline ist ein **technisch-sauberer Satzgenerator ohne Story-Engine**. Sie produziert Prosa, die Regeln erfüllt, aber keine Geschichte erzählt, die ein 7-Jähriges noch am nächsten Tag nacherzählen würde.

### Die 7 strukturellen Todsünden im aktuellen System

| # | Problem | Wo im Code | Auswirkung auf die Story |
|---|---------|------------|--------------------------|
| 1 | **Premise wird nie definiert** | `buildV8BlueprintPrompt` prompts.ts:1184 fragt nur "theme" + "core conflict" + Scene-Direktiven – **niemand fragt: "Worum geht es, in einem Satz, den ein Kind nacherzählt?"** | Kein Kind weiß, was "Weisheitskrone" ist |
| 2 | **Kein Hook-Konzept** | V8 Blueprint: Ch1 = "sets up orientation clearly". V8 System: "chapter 1 darf ruhig und klar beginnen" | Ch1 ist eine leere Landstraße – keine brennende Frage |
| 3 | **Kein Payoff-Konzept** | Ch5-Spec: "concrete win, small price, callback". Kein Wort zu *Überraschung*, *Transformation*, *Auflösung des Ch1-Versprechens* | Ch5 wiederholt Ch1-Muster, keine Katharsis |
| 4 | **Figuren sind leer** | `speechStyleHints` = 1 String + 1 Beispielsatz. Kein Running-Gag-System, kein Macken-Register, keine distinktiven Weltsicht | Alexander und Adrian sind austauschbar |
| 5 | **Welt hat keine Textur** | Cover zeigt Drache + Eichhörnchen – **im Text tauchen sie nicht auf**. DNA/Theme-Felder sind abstrakte Labels, keine spezifischen Welt-Anker | Generischer Wald ohne Charme |
| 6 | **Critic prüft Handwerk, nicht Wirkung** | `semantic-critic.ts:153-164` – 10 Dimensionen alle handwerklich (voice, tension, humor, readability …). **Keine Prüfung auf: Premise verständlich? Stakes emotional? Würde ein Kind weiterlesen wollen?** | Stories mit 6.8/10 werden durchgewunken, Kinder verstehen sie nicht |
| 7 | **Surgery ist Pflaster auf Gipsbein** | `release-polisher.ts` – bolt-ons wie "Wenn sie das Falsche folgten, verloren sie den Heimweg" | Stakes als Afterthought, keine Struktur |

### Was echte Kinderbücher (Schule der magischen Tiere) anders machen

1. **High Concept in einem Satz**: *"Jedes Kind bekommt ein sprechendes Tier, das genau zu ihm passt."* → Sofort verstanden, sofort begehrt.
2. **Welt mit Textur**: Wintersteinschule, Mortimer Morrison, konkrete Räume, Lehrer mit Macken. Du riechst die Schule.
3. **Emotionale Stakes**: Freundschaft, Mut gegen Mobbing, Geheimnis vor den Eltern. **Kein abstraktes Rätsel.**
4. **Running Gags & Tics**: Rabbats Sprüche, Benni-Chaos, Ida-Stottern. Jede Figur hat Fingerabdruck in 2 Sätzen.
5. **Kapitelende = Cliffhanger mit Gefühl**, nicht mit Rätsel: *"Wird Ida heute den Mut haben?"* (emotional), nicht *"Was steht auf dem Zettel?"* (Info).
6. **Payoff = Transformation**: Das schüchterne Kind sagt im Finale laut die Wahrheit. Der Leser fühlt den Triumph im Bauch.

**Talea hat nichts davon systematisch.** Weder im Blueprint, noch im Prompt, noch im Critic.

---

## 2 · Die Radikal-Reframe (das zentrale Insight)

> **Die Blueprint ist der Gott der Pipeline. Aber der Blueprint fragt die falschen Fragen.**

Der Writer-Prompt sagt wörtlich: *"The blueprint is your compass, not your script"* – aber dann folgt 300 Zeilen, die nichts anderes tun, als den Blueprint 1:1 zu materialisieren. Wenn im Blueprint keine Story-Seele steckt, kann der Writer sie nicht erfinden.

**Konsequenz:** Kein Prompt-Tweak wird die Qualität retten. Wir brauchen eine neue **Story-Seele-Ebene vor dem Blueprint**.

Die neue Pipeline:

```
┌──────────────────────────────────────────────────────────┐
│  STAGE 0 (NEU!): STORY SOUL                              │
│  · Premise (1 Satz, testbar)                             │
│  · Hook-Question (was will der Leser wissen?)            │
│  · Emotional Stakes (was verliert das Kind gefühlt?)     │
│  · World Texture (3 konkrete Welt-Anker)                 │
│  · Character Fingerprints (Macke, Running-Gag, Wortschatz)│
│  · Payoff Promise (wie fühlt sich Ch5 an?)               │
│  · Benchmark-Book (welches echte Buch ist Referenz?)     │
└────────────┬─────────────────────────────────────────────┘
             ↓
┌──────────────────────────────────────────────────────────┐
│  STAGE 1: SOUL-VALIDATION (LLM-Kritiker vor Blueprint)   │
│  · Ist die Premise nacherzählbar?                        │
│  · Hookt sie ein 7-Jähriges?                             │
│  · Sind Stakes emotional (nicht abstrakt)?               │
│  · REJECT + REGEN bis Soul pass = 8.0                    │
└────────────┬─────────────────────────────────────────────┘
             ↓
┌──────────────────────────────────────────────────────────┐
│  STAGE 2: BLUEPRINT (bestehend, aber Soul-gebunden)      │
│  · Jedes Ch-Ziel MUSS auf Soul.payoffPromise zurückzielen│
│  · Jedes Ch-Ende = emotionale Cliffhanger-Frage          │
└────────────┬─────────────────────────────────────────────┘
             ↓
┌──────────────────────────────────────────────────────────┐
│  STAGE 3: PROSE-WRITER (überarbeitet)                    │
│  · Bekommt Soul + Blueprint + Character-Fingerprints     │
│  · System-Prompt mit POSITIVEN Referenz-Beispielen       │
│    aus echten deutschen Kinderbüchern                    │
│  · Ch1-Lock: muss Hook-Question in Absatz 1-2 setzen     │
│  · Ch5-Lock: muss Soul.payoffPromise einlösen            │
└────────────┬─────────────────────────────────────────────┘
             ↓
┌──────────────────────────────────────────────────────────┐
│  STAGE 4: CRITIC 2.0 (erweitert)                         │
│  · Aktuelle 10 Dimensionen bleiben                       │
│  · NEU: premise_clarity (0-10)                           │
│  · NEU: hook_strength (0-10)                             │
│  · NEU: emotional_stakes (0-10)                          │
│  · NEU: character_distinctiveness (pro Figur separat)   │
│  · NEU: world_texture (konkret vs generisch)             │
│  · NEU: payoff_earned (Ch5-Gefühl vs Ch1-Versprechen)   │
│  · NEU: nacherzählbarkeit (kann 7-J. es wiedergeben?)   │
│  · Hard-Reject < 7.5 (nicht < 5.9 wie jetzt)            │
└────────────┬─────────────────────────────────────────────┘
             ↓
┌──────────────────────────────────────────────────────────┐
│  STAGE 5: SURGERY (bestehend, aber schärfer)             │
│  · Patch-Operationen MÜSSEN Soul-referenzieren           │
│  · Nicht mehr kosmetische Sensorik-Hinzufügung          │
└──────────────────────────────────────────────────────────┘
```

---

## 3 · Was wird gelöscht (Legacy-Schulden)

Die Explore-Analyse bestätigt: **~8.000 Zeilen toter Code** blockieren Fortschritt.

| Datei | Zeilen | Action | Begründung |
|-------|--------|--------|------------|
| `backend/story/four-phase-orchestrator.ts` | 2.373 | **DELETE** | Ersetzt durch `pipeline/orchestrator.ts` |
| `backend/story/phase1-skeleton.ts` | ~800 | **DELETE** | OpenAI-Skeleton, nicht mehr im Pfad |
| `backend/story/phase2-matcher.ts` | ~600 | **DELETE** | In `casting-engine.ts` migriert |
| `backend/story/phase3-finalizer.ts` | ~800 | **DELETE** | In `story-writer.ts` migriert |
| `backend/story/ai-generation.ts` | 2.551 | **SHRINK zu <500** | Nur noch als expliziter Fallback |
| `backend/story/story-post-processor.ts` | ~200 | **MERGE** | Logik in quality-gates.ts |
| `backend/story/story-remixer.ts` | ~200 | **KEEP** (Utility, separater Use Case) |

**Effekt:** Pipeline wird nachvollziehbar, Testabdeckung verdoppelt sich bei halbem Code.

---

## 4 · Die neue "Story Soul" – Schema und Prompt

### 4.1 · Schema (TypeScript)

```typescript
// backend/story/pipeline/schemas/story-soul.ts (NEU)

export interface StorySoul {
  // Ein Satz, den ein 7-Jähriger beim Abendessen nacherzählen würde
  premise: string; // z.B. "Zwei Brüder müssen ihrem Opa den geheimen Kuchenrezept-Drachen zurückbringen, bevor der Ofen kalt wird."

  // Was will der Leser NACH Ch1 dringend wissen? (emotional, nicht info)
  hookQuestion: string; // z.B. "Trauen sich die Brüder in den Drachenwald, obwohl sie sich eigentlich nicht leiden können?"

  // Was verliert das Kind GEFÜHLT bei Scheitern?
  emotionalStakes: {
    what: string; // "Opas Geburtstag"
    why: string;  // "Opa hat ihnen jedes Jahr den Kuchen gebacken und weint heimlich, wenn keiner kommt"
    whoCares: string; // "Alexander, weil Opa ihm Fahrrad beigebracht hat"
  };

  // Konkrete Welt-Anker (3 sehr spezifische Details)
  worldTexture: {
    anchors: [string, string, string]; // ["Rezeptzettel mit Schokoladenfingerabdrücken", "Opas schief hängende Brille", "Ofen klingt wie alter Mann"]
    senseDetails: string; // "riecht nach Zimt + nasser Wolle + Nebelkerzen"
    placeName: string;   // "Krümelwald hinter der Bäckerei"
  };

  // Figuren-Fingerabdrücke (pro Figur – PFLICHT)
  characterFingerprints: Array<{
    name: string;
    role: "protagonist" | "partner" | "antagonist" | "helper" | "comic-relief";
    coreMacke: string;           // "sammelt komische Steine, will jeden benennen"
    runningGag: string;          // "sagt 'Halt!' in absolut jedem Kapitel genau einmal"
    favoriteWords: string[];     // ["eindeutig", "Eigentlich"]
    tabooWords: string[];        // ["vielleicht", "irgendwie"]
    bodyTell: string;            // "zupft Ohrläppchen wenn nervös"
    wantIneedle: string;         // "will von Opa ernstgenommen werden"
    fearInternal: string;        // "hat Angst dass Opa ihn vergisst"
    voiceExample: string;        // EIN konkreter, lustiger Beispielsatz von dieser Figur
  }>;

  // Nebenfiguren die im Cover landen MÜSSEN auch im Text landen
  supportingCast: Array<{
    name: string;
    purpose: "comic-relief" | "mentor" | "trickster" | "emotional-mirror";
    firstAppearanceChapter: number;
    signaturAction: string; // z.B. "Eichhörnchen versteckt heimlich Nüsse in Alexanders Tasche"
  }>;

  // Wie SOLL sich Ch5 anfühlen? (Gefühlsversprechen)
  payoffPromise: {
    emotionalLanding: string; // "Warm, leicht gerührt, stolz"
    transformationOfChild: string; // "Alexander lernt, dass Adrian langsamer denkt, aber genauer – und dass das ein Geschenk ist"
    finalImage: string; // "Beide essen Kuchen in Opas Küche, das Eichhörnchen stiehlt eine Krume"
    callbackFromChapter1: string; // "Der Rezeptzettel wird zu Opas Lesebrille"
  };

  // Antagonismus (MUSS vorhanden sein – Reibung macht Geschichte)
  antagonism: {
    type: "internal" | "external" | "social" | "nature";
    specific: string; // "Alexander misstraut Adrian, weil Adrian letztes Jahr gelogen hat"
    resolvesHow: string; // "Adrian beichtet in Ch4 die alte Lüge"
  };

  // Benchmark (was ist das Vorbild?)
  benchmarkBook: {
    title: string; // "Schule der magischen Tiere – Endlich Ferien"
    whyMatch: string; // "warmer Tonfall, zwei Kinder mit gegensätzlichen Charakteren, konkrete Welt, emotionale Geheimnisse"
    voiceReference: string; // Ein 2-Satz-Absatz als Ton-Referenz
  };

  // Humor-Register (konkret, nicht abstrakt)
  humorBeats: Array<{
    chapter: number;
    type: "misunderstanding" | "slapstick" | "dry-observation" | "callback" | "absurd-literal";
    what: string; // "Adrian übersetzt 'bring das zum Opa' falsch und bringt den Opa selbst"
  }>;

  // Drei Szenen, die ein Kind NACHSPIELEN würde (ikonisch)
  iconicScenes: [string, string, string];
}
```

### 4.2 · Soul-Generator Prompt (ersetzt/ergänzt Blueprint Stage)

```
SYSTEM:
Du bist ein Team aus drei Experten:
1. Margit Auer (Autorin von "Schule der magischen Tiere")
2. Paul Maar (Autor von "Sams")
3. Ein Lektor eines deutschen Kinderbuchverlags (Oetinger/Carlsen)

Ihr plant die SEELE einer 5-Kapitel-Geschichte für 6-8-Jährige, BEVOR
geschrieben wird. Ihr wisst: Kinder lieben Bücher nicht wegen Regeln,
sondern wegen FIGUREN MIT MACKEN, WELTEN MIT ECKEN und GEHEIMNISSEN
MIT HERZKLOPFEN.

Arbeitsweise:
- Premise MUSS in einem Satz sein, den ein 7-Jähriges beim Abendessen
  Opa erzählen würde. Teste: "Opa, weißt du was? [Premise]" – klingt es
  natürlich? Sonst verwerfen.
- Keine abstrakten Rätsel. Stakes MÜSSEN emotional und konkret sein
  (Opa, Freundschaft, Geburtstag, Geheimnis vor Eltern).
- Jede Figur MUSS eine Macke haben, die auf Seite 1 schon riechbar ist.
- Welt MUSS drei konkrete Anker haben. Nicht "Wald" – sondern "Krümelwald
  hinter der Bäckerei, riecht nach Zimt".
- Figuren auf dem Cover MÜSSEN in der Story eine Rolle spielen. Keine
  Cover-Statisten.
- Antagonismus ist PFLICHT. Reibung macht Geschichte. Kann intern sein
  (Brüder-Konflikt) oder extern (Regenwetter kippt Plan).
- Payoff-Promise MUSS definieren, wie Ch5 SICH ANFÜHLT – nicht nur was
  passiert.

USER:
Config:
- Avatare: Alexander (6, vorsichtig), Adrian (7, impulsiv)
- Genre: fairy_tales
- Setting: Landschaft mit Wald
- Alter: 6-8
- Bekannte Cover-Figuren: Drache Fauchi, Eichhörnchen (müssen Rolle haben!)
- User-Wunsch: [falls vorhanden]

Produziere eine StorySoul im JSON-Schema [...schema einfügen...].
Nutze als Ton-Referenz:
"Als Ida die Tür aufmachte, saß auf ihrem Kopfkissen eine Schildkröte.
Sie trug eine kleine Brille und las Zeitung."
(Margit Auer – so konkret, so kurios, so warm.)

Verbotene Floskeln im Soul:
- "Abenteuer" (zu generisch)
- "geheimnisvoll" (zu abstrakt)
- "magisch" (zu billig) – lieber konkret magisch
- "müssen herausfinden" (Rätsel-Prosa)

Rückgabe: NUR das JSON. Kein Kommentar.
```

### 4.3 · Soul-Validator Prompt (Stage 1 Gate)

```
SYSTEM:
Du bist ein strenger Kinderbuch-Lektor. Prüfe eine StorySoul VOR der Story.
Rubrik (0-10 je Punkt):

1. PREMISE_RESTATABLE: Kann ein 7-Jähriges den Premise-Satz nach einmal
   Hören wiederholen? Konkret, Namen, ein Ziel. (Hard: < 7 = FAIL)

2. EMOTIONAL_HOOK: Ist die hookQuestion emotional, nicht informativ?
   "Trauen sich die Brüder...?" = 9. "Was ist hinter der Tür?" = 4.

3. STAKES_FEELABLE: Verliert das Kind gefühlt etwas? (Oma/Opa, Freund,
   Geburtstag = ja. "Rätsel-Lösung", "Weg finden" = nein.)

4. WORLD_SPECIFICITY: 3 Welt-Anker – sind sie konkret und kurios?
   "Krümelwald hinter der Bäckerei mit Opa-Geruch" = 9.
   "Zauberwald" = 2.

5. CHARACTER_DISTINCT: Klingen die voiceExamples WIRKLICH verschieden
   oder austauschbar?

6. COVER_CAST_USED: Sind alle Cover-Figuren in supportingCast mit echter
   Funktion? (Drache darf nicht nur "Prop" sein.)

7. ANTAGONISM_REAL: Gibt es echte Reibung? Nicht nur "Rätsel finden".

8. PAYOFF_FEELS: Ist payoffPromise.emotionalLanding spezifisch und warm?
   Nicht "glücklich" – sondern "stolz mit Kloß im Hals".

9. BENCHMARK_MATCHES: Passt das Benchmark-Buch wirklich zur geplanten
   Story oder ist es Lippenbekenntnis?

10. WOULD_CHILD_REREAD: Gesamteindruck – würde ein Kind es 3x hören wollen?

Verdict:
- Gesamt >= 8.0 UND jede Dim >= 6.0 → "approved"
- Sonst → "reject" MIT konkreten fixes pro niedriger Dim.
```

---

## 5 · Neue System-Prompts (Story-Writer V9)

### 5.1 · System Prompt (DE) – die "Autorenpersona"

```
Du bist Margit Auer an einem guten Tag. Du schreibst für 6-8-Jährige,
die morgens im Bett noch lieber vorlesen lassen als aufstehen.

DEINE HALTUNG:
- Du zeigst, statt zu erklären.
- Du hörst deinen Figuren zu – jede hat eine eigene Stimme, Macken
  und Lieblingswörter. Alexander klingt NICHT wie Adrian. Ein Leser
  erkennt sie blind am Satzbau.
- Du liebst konkrete Details: keine "Landschaft", sondern "ein schiefer
  Apfelbaum, unter dem immer eine Socke liegt".
- Du hast Humor im Blut. Humor ist NIE eingeschoben – er kommt aus
  Verhalten: Jemand missversteht. Jemand übertreibt. Jemand sagt etwas
  total Ernstes, das für Erwachsene komisch ist.
- Du traust Kindern lange Sätze zu, wenn der Rhythmus stimmt. Aber
  du wechselst oft mit kurzen Sätzen ab. Zack. So.

DEINE VIER GEHEIMWAFFEN:
1. DER HOOK: Seite 1, Absatz 1-2. Eine brennende FRAGE oder eine
   schräge BEOBACHTUNG. Nie "Die Landstraße lag still" – das ist
   TV-Serie Standbild. Lieber: "Wenn man in unserer Familie den Ofen
   vergaß, flog die Schwalbe davon. Und heute war der Ofen kalt."

2. DIE WELT MIT ECKEN: Konkret, riechbar, mit einem seltsamen Detail.
   Wenn das Wort "Wald" vorkommt, DRÜCKST DU ES WEG und findest einen
   spezifischen Namen, Geruch, Figur.

3. DIE FIGUREN MIT FINGERABDRUCK: Jede Figur hat 2-3 Tics, die der
   Leser nach Kapitel 2 erkennt. Die wiederholen sich (aber nicht
   monoton – variiert).

4. DAS GEFÜHLS-CLIFFHANGER: Jedes Kapitelende lässt ein GEFÜHL offen,
   nicht nur eine Info. "Adrian wusste nicht, wie er das wieder gut
   machen sollte" schlägt "Was stand auf dem Zettel?".

DEINE VERBOTE:
- Keine Prompt-Sprache, keine Moral-Sätze, keine Meta-Kommentare.
- Kein "plötzlich", "auf einmal", "irgendwie", "eigentlich" (Schlampe-Wörter).
- Keine Sätze wie "Adrian spürte Angst" – zeige es: "Adrian zog das
  Ohrläppchen, wie immer, wenn es ernst wurde."
- Keine austauschbaren Dialoge. Wenn du "sagte er" 5x hintereinander
  schreibst, machst du etwas falsch.
- Keine Cover-Figur ohne Rolle. Wenn ein Drache auf dem Cover ist, hat
  er SÄTZE zu sagen und eine Macke.

DEIN REFERENZ-KLANG (so soll sich deine Prosa anfühlen):

  "Benni fand, dass Schule wie eine Zwiebel war: außen hart, innen
  weich, und wenn man reinbiss, musste man weinen. Aber heute war
  alles anders. Heute saß auf seinem Tisch ein Schildkrötenei.
  'Hey', sagte Benni zum Ei. Das Ei sagte nichts zurück. Noch nicht."

Notiere: kurze Sätze. Konkrete Bilder. Humor aus Perspektive. Dialog
mit einer lebenden Figur (das Ei). Innere Welt ohne "fühlte".
```

### 5.2 · User Prompt (DE) – Story-Writer V9

```
Schreibe die Geschichte. Du bekommst die SOUL (das Herz), die BLUEPRINT
(das Skelett) und die VOICE-CARDS (die Stimmen).

SOUL (das Herz – alles muss darauf zurückzielen):
{{storySoul}}

BLUEPRINT (das Skelett – Reihenfolge der Szenen):
{{blueprint}}

VOICE CARDS (wie die Figuren klingen):
{{voiceCards}}

HARTE REGELN (nicht verhandelbar):
1. KAPITEL 1, ABSATZ 1 muss die HOOK-QUESTION wecken. Nicht beantworten.
   Wecken. Der Leser soll nach Absatz 2 wissen wollen, was passiert.
2. KAPITEL 5 muss SOUL.payoffPromise.emotionalLanding erreichen. Der
   Leser soll ausatmen, nicht "aha".
3. Jede Figur aus characterFingerprints muss ihre coreMacke mindestens
   2x zeigen. Die favoriteWords müssen tatsächlich vorkommen.
4. Jede Figur aus supportingCast muss in ihrem firstAppearanceChapter
   auftauchen – und ihre signaturAction zeigen.
5. Die drei iconicScenes müssen erkennbar im Text stehen.
6. Jedes Kapitelende = GEFÜHLS-Cliffhanger (keine Info-Frage).
7. Humor-Beats aus soul.humorBeats müssen als echte Szene realisiert
   sein, nicht als Abstrakt-Notiz.

OUTPUT (JSON):
{
  "title": "...",
  "description": "...",  // 1 Satz, der Lust auf das Buch macht
  "chapters": [
    { "chapter": 1, "paragraphs": ["...", "...", "...", "..."] }
  ]
}

VOR DEM SCHREIBEN (intern, nicht ausgeben):
1. Lies soul.premise laut. Würdest du das einem 7-Jährigen erzählen?
2. Prüfe: Sind deine ersten 30 Wörter in Ch1 ein HOOK oder ein Standbild?
3. Prüfe: Klingen deine beiden Protagonisten nach 2 Sätzen unterscheidbar?
Wenn nein → verwerfen und neu.
```

---

## 6 · Critic 2.0 – Erweiterte Rubrik

Datei: `pipeline/semantic-critic.ts` (Erweiterung, nicht Ersatz)

### Zusätzliche Dimensionen

```typescript
interface SemanticCriticRubricScoresV2 extends SemanticCriticRubricScores {
  // Neu:
  premise_clarity: Score;        // Versteht ein 7-J. in Ch1, worum es geht?
  hook_strength: Score;          // Packt Ch1-Absatz-1 wirklich?
  stakes_emotional: Score;       // Sind Stakes fühlbar (nicht nur Info)?
  character_distinctiveness: {   // PRO Figur
    perCharacter: Record<string, Score>;
    overall: Score;
  };
  world_texture: Score;          // Konkret vs generisch?
  payoff_earned: Score;          // Ch5-Gefühl vs Ch1-Versprechen
  retellability: Score;          // Kann ein 7-J. es nacherzählen?
  cover_cast_utilization: Score; // Sind Cover-Figuren im Text?
  running_gag_presence: Score;   // Mind. 1 Gag der wiederkehrt?
  cliffhanger_quality: Score;    // Chapter-Endings emotional?
}
```

### Verschärfte Thresholds

```typescript
const QUALITY_BARS = {
  publish:    { overall: 9.0, hardMins: { premise_clarity: 8, hook_strength: 8, stakes_emotional: 8, payoff_earned: 8 }},
  acceptable: { overall: 8.0, hardMins: { premise_clarity: 7, hook_strength: 7, stakes_emotional: 6, payoff_earned: 7 }},
  revision:   { overall: 7.0 },
  reject:     { overall_below: 7.0 }
};
```

**Aktuell**: < 5.9 = FAIL. **Neu**: < 7.0 = FAIL (hard reject, regen soul+story). Die Story von heute (6.8) wäre im neuen System **verworfen**, nicht durchgewunken.

---

## 7 · Implementierungsplan in 5 Sprints

### Sprint 1 – Fundament (1-2 Tage) – **HIER STARTEN**
- [ ] Legacy löschen: `four-phase-orchestrator`, `phase1-3`, Teile von `ai-generation`
- [ ] Neues Schema: `pipeline/schemas/story-soul.ts`
- [ ] Neue Datei: `pipeline/story-soul-generator.ts`
- [ ] Neue Datei: `pipeline/story-soul-validator.ts`
- [ ] Orchestrator: Stage 0 + Stage 1 einbauen

### Sprint 2 – Prompts (2-3 Tage)
- [ ] Soul-Generator-Prompt schreiben (DE/EN)
- [ ] Soul-Validator-Prompt schreiben
- [ ] Story-Writer V9 System + User Prompt schreiben
- [ ] 3 deutsche Kinderbuch-Referenz-Absätze in Prompts embed (Auer, Maar, Funke)
- [ ] A/B: V8 vs V9 an 10 Test-Stories laufen lassen

### Sprint 3 – Critic 2.0 (1-2 Tage)
- [ ] Rubrik um 6 Dimensionen erweitern
- [ ] Hard-Thresholds anheben (< 7.0 = reject)
- [ ] Surgery-Prompt umschreiben: MUSS Soul-referenzieren

### Sprint 4 – Character Fingerprint System (2-3 Tage)
- [ ] `canon-fusion.ts` erweitern: volles Fingerprint-Schema statt cue-Liste
- [ ] Voice-Card-Generator aus Avatar-Personality + Memory
- [ ] Running-Gag-Tracker über Kapitel hinweg

### Sprint 5 – Testing & Tuning (laufend)
- [ ] Eval-Set: 20 Referenz-Stories manuell bewertet (1-10 pro Dim)
- [ ] Automatisches Eval: jede neue Pipeline-Version läuft gegen Eval-Set
- [ ] Regression-Gate: Durchschnitt darf nicht < letztes Release fallen

---

## 8 · Erwartete Wirkung (ehrliche Prognose)

| Metrik | Ist | Nach Sprint 1-2 | Nach Sprint 1-5 |
|--------|-----|-----------------|-----------------|
| Premise verständlich | ~40% | 85% | 95% |
| Hook in Ch1 | Zufall | 80% | 95% |
| Figuren unterscheidbar | ~30% | 70% | 90% |
| Emotionaler Payoff | ~25% | 65% | 85% |
| Cover-Cast genutzt | ~10% | 80% | 95% |
| **Durchschnitts-Score (intern)** | **5.2** | **7.2** | **8.5-9.0** |
| Kostenerhöhung/Story | Basis | +20% (+1 LLM Call für Soul) | +30% |

Die Kosten steigen – aber aktuell zahlst du für Stories, die Kinder nicht verstehen. Das ist der teuerste Output.

---

## 9 · Entscheidungsfrage an dich

**Soll ich mit Sprint 1 starten?** Konkret heißt das:

1. ✅ Jetzt: Dieses Dokument ablegen (erledigt)
2. ⏳ Als Nächstes: `story-soul.ts` Schema-Datei schreiben
3. ⏳ Dann: `story-soul-generator.ts` mit neuem Prompt schreiben
4. ⏳ Dann: `story-soul-validator.ts` implementieren
5. ⏳ Dann: `pipeline/orchestrator.ts` so umbauen, dass Stage 0 + 1 vor dem Blueprint laufen
6. ⏳ Dann: *ohne* Legacy-Deletion testen (Safety-Net), dann Legacy weg

Alternative: Soll ich stattdessen erst **eine Test-Story** mit komplett manuell geschriebener Soul durch die bestehende Pipeline jagen, damit wir sehen, wie stark alleine die Soul-Stufe wirkt? Das wäre 30min Arbeit und liefert harten Beleg, dass der Ansatz stimmt, bevor wir 5 Sprints investieren.

**Empfehlung: Proof-of-Concept-Test zuerst, dann Sprint 1.** Wenn du grünes Licht gibst, schreibe ich jetzt die Soul für eine Testgeschichte und schicke sie manuell an die bestehende Writer-Stage – das zeigt in 1 Stunde, ob die Hypothese trägt.
