/**
 * Storybook Pipeline — the premise bank.
 *
 * Hand-written on purpose. Asking a model to invent a premise under a wall of
 * banned motifs reliably produces something *different* rather than something
 * a child can play. "Ein Aufzug, der Ausreden löscht" beats "ein Hund, der
 * Hausaufgaben frisst" on novelty and loses catastrophically on comprehension:
 * an excuse is not a thing a seven-year-old can see disappear.
 *
 * Every entry here obeys the same four rules, taken from what the canon
 * actually does (Grüffelo, Findus, Hotzenplotz, Raupe Nimmersatt):
 *
 *   1. The want is touchable. Not "einen Fehler ungeschehen machen" but
 *      "die Schuhe rechtzeitig zum Spiel bringen".
 *   2. The opponent has their own want that physically collides with it.
 *      Boredom is not a want.
 *   3. The magic leaves a VISIBLE, ideally COUNTABLE trace. A child must be
 *      able to point at the page and say "schon wieder einer weg".
 *   4. Three escalating beats, then the same move again with more at stake.
 *
 * Novelty comes from the combinatorics — premise x heroes x setting x cast x
 * artifact x wish — not from the premise being unheard of.
 */

import type { Premise, PremiseVariant, PremiseVariants, ResolvedPremise } from "./types";

type RawPremise = Omit<Premise, "variants">;

const RAW_PREMISES: RawPremise[] = [
  {
    id: "schuhe-geradeaus",
    workingTitle: "Die Schuhe, die nur geradeaus wollen",
    genres: ["adventure", "friendship", "magic", "fantasy"],
    settings: ["village", "city", "home", "forest"],
    ageBands: ["6-8", "9-12"],
    situation:
      "Auf dem Dachboden liegt ein Paar alte Turnschuhe mit acht Knoten im Schnürsenkel, und wer sie anzieht, läuft nur noch geradeaus.",
    childWant: "rechtzeitig und mit beiden Schuhen beim Spiel auf dem Bolzplatz ankommen",
    whyItHurts: "ohne ihn fehlt der Mannschaft der fünfte Spieler und das Spiel fällt aus",
    opponent: {
      roleNeed: "gegenspieler",
      want: "die Schuhe selbst haben, weil sie ihm einmal gehört haben",
    },
    wonderRule: {
      rule: "Die Schuhe gehen nur geradeaus. Wer sie zwingt abzubiegen, schafft es — aber es kostet.",
      visibleSideEffect: "Bei jeder erzwungenen Kurve löst sich einer der acht Knoten und der Schnürsenkel wird kürzer.",
    },
    escalation: [
      "Erste Kurve: quer durch den Sandkasten, Sand in beiden Schuhen, ein Knoten weg.",
      "Zweite Kurve: mitten durch die aufgehängte Wäsche, mit einem Bettlaken über dem Kopf weiter, drei Knoten weg.",
      "Dritte Kurve: durch die offene Tür der Bäckerei hinein und hinten wieder hinaus, Mehlwolke, nur noch ein Knoten übrig.",
    ],
    reversal:
      "Am Ende biegt er nicht ab, sondern nutzt das Geradeaus mit voller Absicht: einmal quer durch die Hecke, die alle anderen umlaufen müssen.",
    price: "Er lässt den letzten Knoten los und damit die Schuhe — sie bleiben, wo sie stehen bleiben.",
    closingImage: "Die Schuhe stehen ordentlich nebeneinander am Zaun, ein einziger kurzer Schnürsenkel hängt heraus.",
    gagType: "koerperliche_eskalation",
    roleNeeds: ["gegenspieler", "komplize"],
    artifactSlot: false,
  },

  {
    id: "klingel-zehn-sekunden",
    workingTitle: "Die Klingel, die zu früh klingelt",
    genres: ["adventure", "mystery", "friendship"],
    settings: ["village", "city", "home"],
    ageBands: ["6-8", "9-12"],
    situation:
      "An einem alten Fahrrad sitzt eine Klingel, die immer genau zehn Sekunden klingelt, bevor etwas schiefgeht.",
    childWant: "das Rad heil bis zum Sommerfest bringen, weil er den Kuchen im Korb transportiert",
    whyItHurts: "fällt der Kuchen, gibt es beim Fest nichts zu essen und alle wissen, wer schuld ist",
    opponent: {
      roleNeed: "gegenspieler",
      want: "das Fahrrad zurückhaben, bevor jemand merkt, dass es gar nicht verschenkt war",
    },
    wonderRule: {
      rule: "Die Klingel klingelt zehn Sekunden vor jedem Missgeschick. Wer sie hört, hat genau zehn Sekunden Zeit.",
      visibleSideEffect: "Nach jedem Klingeln springt ein Speichenreflektor ab und liegt blitzend auf der Straße.",
    },
    escalation: [
      "Erstes Klingeln: zehn Sekunden bis der Korb kippt — er fängt ihn mit dem Knie, ein Reflektor liegt hinter ihm.",
      "Zweites Klingeln: zehn Sekunden bis der Hund losrennt — er kommt eine Sekunde zu spät und hat den Hund am Hosenbein.",
      "Drittes Klingeln: zehn Sekunden bis die Brücke gesperrt wird — er zählt laut mit und schafft es auf sechs.",
    ],
    reversal:
      "Am Schluss klingelt es, und statt selbst wegzurennen, benutzt er die zehn Sekunden, um jemand anderen aus dem Weg zu ziehen.",
    price: "Er gibt das Fahrrad zurück, obwohl er es liebt — mit dem letzten Reflektor als Geschenk daran.",
    closingImage: "Die Klingel hängt jetzt an einem anderen Lenker und ist still.",
    gagType: "das_ding_hoert_nicht_auf",
    roleNeeds: ["gegenspieler", "komplize", "autoritaet"],
    artifactSlot: true,
  },

  {
    id: "kuchen-waechst",
    workingTitle: "Der Kuchen, der immer größer wird",
    genres: ["friendship", "magic", "fantasy", "adventure"],
    settings: ["home", "village", "city"],
    ageBands: ["3-5", "6-8"],
    situation:
      "Ein Rührkuchen steht auf dem Fensterbrett und wird jedes Mal ein Stück größer, wenn in der Küche jemand schwindelt.",
    childWant: "den Kuchen zum Backwettbewerb tragen und den Holzlöffel-Pokal gewinnen",
    whyItHurts: "der Pokal war dem Opa versprochen, der extra mit dem Bus kommt",
    opponent: {
      roleNeed: "gegenspieler",
      want: "selbst gewinnen und deshalb möglichst viele Leute zum Schwindeln bringen",
    },
    wonderRule: {
      rule: "Jede Schwindelei in Hörweite lässt den Kuchen um eine Handbreit wachsen. Die Wahrheit lässt ihn nicht wieder schrumpfen.",
      visibleSideEffect: "Bei jedem Wachsen knackt die Kuchenform und bekommt einen neuen Riss.",
    },
    escalation: [
      "Nach der ersten Schwindelei passt der Kuchen nicht mehr durch die Küchentür.",
      "Nach der zweiten füllt er den halben Flur, und der Briefträger schiebt die Post oben hinein.",
      "Nach der dritten drückt er gegen das Wohnzimmerfenster und die Scheibe biegt sich.",
    ],
    reversal:
      "Statt eine letzte Schwindelei zu erfinden, sagt er vor allen laut, was wirklich passiert ist — und schneidet den Kuchen dort an, wo der größte Riss sitzt.",
    price: "Er teilt den Kuchen so auf, dass für ihn selbst kein Stück übrig bleibt.",
    closingImage: "Die gesprungene Kuchenform steht sauber gespült auf dem Fensterbrett, ein Riss quer hindurch.",
    gagType: "koerperliche_eskalation",
    roleNeeds: ["gegenspieler", "skeptiker", "autoritaet"],
    artifactSlot: false,
  },

  {
    id: "hund-frisst-hausaufgaben",
    workingTitle: "Der Hund, der die Hausaufgaben bellt",
    genres: ["animals", "friendship", "mystery"],
    settings: ["home", "village", "city"],
    ageBands: ["6-8"],
    situation:
      "Der Nachbarshund frisst das Matheheft und bellt seitdem jede Aufgabe wieder heraus — leider rückwärts und immer im falschen Moment.",
    childWant: "das Heft zurückbekommen, bevor es am Montag eingesammelt wird",
    whyItHurts: "ohne Heft muss er alles noch einmal rechnen und verpasst den Ausflug",
    opponent: {
      roleNeed: "gegenspieler",
      want: "dass der Hund weiterbellt, weil es die lustigste Sache seit Wochen ist",
    },
    wonderRule: {
      rule: "Was der Hund frisst, bellt er wieder heraus — rückwärts und immer dann, wenn es am meisten stört.",
      visibleSideEffect: "Bei jedem Bellen fällt ein nasser Papierschnipsel aus seinem Maul.",
    },
    escalation: [
      "Erstes Bellen: mitten im Unterricht, drei Schnipsel liegen unter der Bank.",
      "Zweites Bellen: im Bus, alle drehen sich um, und der Hund bellt eine Zahl, die niemand versteht.",
      "Drittes Bellen: direkt vor der Lehrerin, und diesmal bellt er die richtige Zahl zuerst.",
    ],
    reversal:
      "Am Ende füttert er den Hund absichtlich mit einem Zettel — aber mit einem, auf dem die Wahrheit steht.",
    price: "Er gibt sein Lieblingskuscheltier her, damit der Hund etwas zum Kauen hat, das kein Papier ist.",
    closingImage: "Das geflickte Matheheft liegt auf dem Tisch, an einer Ecke fehlt ein Stück in Hundezahnform.",
    gagType: "das_ding_hoert_nicht_auf",
    roleNeeds: ["gegenspieler", "kleiner_helfer", "autoritaet"],
    artifactSlot: false,
  },

  {
    id: "alles-doppelt",
    workingTitle: "Alles doppelt",
    genres: ["magic", "fantasy", "friendship", "adventure"],
    settings: ["home", "village", "castle", "fantasy"],
    ageBands: ["3-5", "6-8"],
    situation:
      "Seit dem Gewitter wird alles doppelt, was mit der linken Hand angefasst wird — erst ein Eis, dann ein Hund, dann eine Oma.",
    childWant: "ein zweites Eis, weil das erste in den Sand gefallen ist",
    whyItHurts: "das Eisgeld war für den ganzen Nachmittag gedacht und ist jetzt weg",
    opponent: {
      roleNeed: "gegenspieler",
      want: "die linke Hand für sich benutzen und damit den Marktstand voller Ware verdoppeln",
    },
    wonderRule: {
      rule: "Was die linke Hand berührt, gibt es sofort zwei Mal. Rückgängig geht nichts.",
      visibleSideEffect: "Jedes verdoppelte Ding ist eine Spur blasser als das Original — man sieht sofort, welches das zweite ist.",
    },
    escalation: [
      "Zwei Eis: praktisch. Beide schmelzen gleichzeitig.",
      "Zwei Hunde: sie bellen sich gegenseitig an und rennen in zwei Richtungen.",
      "Zwei Omas: beide rufen zum Essen, aus verschiedenen Fenstern, und beide meinen es ernst.",
    ],
    reversal:
      "Zum Schluss fasst er absichtlich etwas an, das es nur einmal gibt — und verschenkt das zweite.",
    price: "Er muss sich zwischen zwei Dingen entscheiden, die er beide liebt, und eines gehen lassen.",
    closingImage: "Auf dem Tisch liegt ein einzelner Handschuh für die linke Hand, ordentlich gefaltet.",
    gagType: "koerperliche_eskalation",
    roleNeeds: ["gegenspieler", "komplize", "autoritaet"],
    artifactSlot: true,
  },

  {
    id: "drache-hat-angst-vor-feuer",
    workingTitle: "Der Drache, der Angst vor Feuer hat",
    genres: ["fairy_tales", "fantasy", "adventure", "friendship"],
    settings: ["castle", "forest", "fantasy", "village"],
    ageBands: ["6-8", "9-12"],
    situation:
      "Hinter dem Schloss wohnt ein Drache, der nicht Feuer speien kann, weil er sich vor der eigenen Flamme fürchtet — und morgen ist Drachenprüfung.",
    childWant: "dass die Drachenprüfung stattfindet, weil sonst das Winterfeuer im Dorf kalt bleibt",
    whyItHurts: "ohne Winterfeuer friert das ganze Dorf und das Fest fällt aus",
    opponent: {
      roleNeed: "gegenspieler",
      want: "dass der Drache durchfällt, damit endlich jemand anderes das Feuer machen darf",
    },
    wonderRule: {
      rule: "Der Drache speit nur Feuer, wenn er nicht hinschaut. Sobald er auf die Flamme blickt, geht sie aus.",
      visibleSideEffect: "Jedes Mal, wenn die Flamme ausgeht, wird eine seiner Rückenschuppen grau.",
    },
    escalation: [
      "Erster Versuch: mit geschlossenen Augen — er trifft die Fahnenstange statt den Holzstapel.",
      "Zweiter Versuch: rückwärts — er zündet den Hut des Bürgermeisters an, dreimal graue Schuppen.",
      "Dritter Versuch: mit einem Eimer über dem Kopf — er hört nur, wie alle gleichzeitig loslachen.",
    ],
    reversal:
      "Am Ende schaut der Drache doch hin — weil ein Kind neben ihm steht und mit hinschaut, sodass er sich nicht allein fürchten muss.",
    price: "Das Kind gibt seinen warmen Schal her, um die letzte Glut zu schützen.",
    closingImage: "Der Holzstapel brennt, und auf dem Drachenrücken sitzt eine einzige goldene Schuppe zwischen den grauen.",
    gagType: "selbstbewusst_falsch",
    roleNeeds: ["gegenspieler", "kleiner_helfer", "autoritaet"],
    artifactSlot: false,
  },

  {
    id: "schluessel-einmal-pro-tuer",
    workingTitle: "Der Schlüssel, der jede Tür nur einmal öffnet",
    genres: ["adventure", "mystery", "magic", "fantasy"],
    settings: ["castle", "city", "home", "fantasy"],
    ageBands: ["6-8", "9-12"],
    situation:
      "Im Futter einer alten Jacke steckt ein Schlüssel, der jede Tür öffnet — aber jede Tür nur ein einziges Mal.",
    childWant: "durch sieben Türen bis in den Turm kommen, wo der Schulhund eingesperrt ist",
    whyItHurts: "der Turm wird am Abend zugemauert und der Hund wäre dann drin",
    opponent: {
      roleNeed: "gegenspieler",
      want: "den Turm heute noch zumauern, weil er dafür bezahlt wird",
    },
    wonderRule: {
      rule: "Der Schlüssel öffnet jede Tür. Danach ist genau diese Tür für ihn für immer tot.",
      visibleSideEffect: "Nach jeder geöffneten Tür verschwindet einer der sieben Zacken am Schlüsselbart.",
    },
    escalation: [
      "Die erste Tür ist leicht, aber dahinter sind gleich zwei neue — ein Zacken weniger.",
      "Bei der vierten merkt er, dass er die Rücktür schon verbraucht hat und nicht zurückkann.",
      "Vor der sechsten steht er mit zwei Zacken und drei Türen da.",
    ],
    reversal:
      "Am Ende öffnet er nicht die letzte Tür, sondern gibt den Schlüssel jemandem, der auf der anderen Seite steht — und die Tür geht von dort auf.",
    price: "Er lässt den Schlüssel drüben und kommt selbst nur durchs Fenster wieder heraus.",
    closingImage: "Der Schlüssel hängt zackenlos an einem Nagel neben der Turmtür, die jetzt offen steht.",
    gagType: "woertlich_genommen",
    roleNeeds: ["gegenspieler", "komplize", "skeptiker"],
    artifactSlot: true,
  },

  {
    id: "vogel-plappert-peinliches",
    workingTitle: "Der Vogel, der nur Peinliches nachplappert",
    genres: ["animals", "friendship", "mystery"],
    settings: ["home", "village", "city", "forest"],
    ageBands: ["6-8"],
    situation:
      "Ein zugeflogener Vogel wiederholt nur Sätze, bei denen jemand rot geworden ist — laut und mitten unter Leuten.",
    childWant: "das Geburtstagsgeheimnis bis Samstag für sich behalten",
    whyItHurts: "wird es verraten, ist die Überraschung für die Schwester kaputt",
    opponent: {
      roleNeed: "gegenspieler",
      want: "den Vogel weiterfüttern, weil er hören will, was die Nachbarn so sagen",
    },
    wonderRule: {
      rule: "Der Vogel plappert nur Sätze nach, bei denen jemand rot geworden ist. Andere Sätze vergisst er sofort.",
      visibleSideEffect: "Nach jedem Nachplappern verliert er eine Feder, und die Feder landet vor der Person, über die er geredet hat.",
    },
    escalation: [
      "Am Gartenzaun plappert er den ersten Satz und eine Feder segelt vor die Nachbarin.",
      "Im Bus plappert er einen Satz über den Busfahrer, der daraufhin anhält.",
      "Vor dem Kuchenladen plappert er das halbe Geheimnis und die Federn liegen im Halbkreis.",
    ],
    reversal:
      "Am Ende sagt das Kind das Geheimnis absichtlich selbst laut — bevor der Vogel es tun kann, und in eigenen Worten.",
    price: "Es gibt das Federversteck her, seine liebste Sammelschachtel, damit der Vogel wieder wegfliegt.",
    closingImage: "In der leeren Sammelschachtel liegt genau eine Feder.",
    gagType: "erwachsener_merkt_nichts",
    roleNeeds: ["gegenspieler", "kleiner_helfer", "skeptiker"],
    artifactSlot: false,
  },

  {
    id: "boot-nur-bei-gegenwind",
    workingTitle: "Das Boot, das nur bei Gegenwind fährt",
    genres: ["adventure", "nature", "friendship"],
    settings: ["village", "forest", "fantasy", "desert"],
    ageBands: ["6-8", "9-12"],
    situation:
      "Am Steg liegt ein kleines Boot mit rotem Segel, das sich keinen Zentimeter bewegt, solange der Wind von hinten kommt.",
    childWant: "vor dem Abend zur Insel und zurück, um die vergessene Brotdose zu holen",
    whyItHurts: "in der Dose steckt der Schlüssel, und ohne ihn kommt niemand ins Haus",
    opponent: {
      roleNeed: "gegenspieler",
      want: "das Boot für die Abendfahrt haben und deshalb jeden anderen davon fernhalten",
    },
    wonderRule: {
      rule: "Das Boot fährt nur, wenn der Wind von vorn kommt. Rückenwind lässt es stehen.",
      visibleSideEffect: "Bei jeder Fahrt gegen den Wind reißt ein Streifen aus dem roten Segel.",
    },
    escalation: [
      "Erste Fahrt: gegen den Wind bis zur Boje, ein Streifen weg, alle am Ufer lachen.",
      "Zweite Fahrt: der Wind dreht mittendrin und das Boot bleibt stehen wie festgeklebt.",
      "Dritte Fahrt: er dreht das Boot absichtlich falsch herum und fährt rückwärts vorwärts.",
    ],
    reversal:
      "Am Schluss segelt er nicht gegen den Wind, sondern wartet — und lässt jemanden anderen zuerst hinüber.",
    price: "Er zerschneidet das letzte Stück Segel, um daraus ein Seil zu machen.",
    closingImage: "Das Boot liegt am Steg, das Segel ist ein Flickenteppich aus roten Streifen.",
    gagType: "selbstbewusst_falsch",
    roleNeeds: ["gegenspieler", "komplize"],
    artifactSlot: false,
  },

  {
    id: "wecker-haelt-zeit-an",
    workingTitle: "Der Wecker, der alle anderen anhält",
    genres: ["magic", "adventure", "mystery", "fantasy"],
    settings: ["home", "city", "village", "space"],
    ageBands: ["6-8", "9-12"],
    situation:
      "Ein zerbeulter Wecker hält beim Klingeln alle anderen an — nur den nicht, der ihn hält.",
    childWant: "das selbstgebaute Vogelhaus fertig bekommen, bevor der Regen kommt",
    whyItHurts: "wird es nass, fällt es auseinander und die Vogelfamilie zieht weg",
    opponent: {
      roleNeed: "gegenspieler",
      want: "den Wecker haben, um vor allen anderen an der Essensausgabe zu stehen",
    },
    wonderRule: {
      rule: "Wer den Wecker hält und klingeln lässt, hält alle anderen an. Nur zehn Atemzüge lang.",
      visibleSideEffect: "Nach jedem Klingeln bleibt einer der Zeiger stehen und läuft nicht mehr mit.",
    },
    escalation: [
      "Erstes Klingeln: zehn Atemzüge, er schafft ein Brett. Der Sekundenzeiger steht still.",
      "Zweites Klingeln: er schafft das Dach, aber alle stehen genau da, wo er hinlaufen muss.",
      "Drittes Klingeln: nur noch der Stundenzeiger läuft, und mitten im Stillstand fängt es an zu regnen.",
    ],
    reversal:
      "Zuletzt klingelt er nicht für sich, sondern hält alle an, damit jemand anderes über die Straße kommt.",
    price: "Er gibt den Wecker weg, obwohl er ihn vom Opa hat.",
    closingImage: "Der Wecker steht auf dem Fensterbrett des fertigen Vogelhauses, alle Zeiger still.",
    gagType: "koerperliche_eskalation",
    roleNeeds: ["gegenspieler", "skeptiker", "kleiner_helfer"],
    artifactSlot: true,
  },

  {
    id: "riese-zu-leise",
    workingTitle: "Der Riese, den keiner hört",
    genres: ["fairy_tales", "fantasy", "friendship"],
    settings: ["forest", "castle", "village", "fantasy"],
    ageBands: ["3-5", "6-8"],
    situation:
      "Am Waldrand wohnt ein Riese, dessen Stimme so leise ist wie ein Blatt — und heute muss er das ganze Dorf vor dem steigenden Bach warnen.",
    childWant: "die Warnung ins Dorf bringen, bevor der Bach über die Brücke geht",
    whyItHurts: "steht das Wasser erst auf der Brücke, kommt niemand mehr nach Hause",
    opponent: {
      roleNeed: "gegenspieler",
      want: "dass alle beim Fest bleiben, weil er die Eintrittskarten verkauft hat",
    },
    wonderRule: {
      rule: "Der Riese kann alles anheben, aber seine Stimme trägt nur einen Schritt weit. Je größer das Ding, das er hebt, desto leiser wird er.",
      visibleSideEffect: "Jedes Mal, wenn er etwas Großes hebt, verstummt ein Vogel im Wald.",
    },
    escalation: [
      "Er hebt einen Baumstamm quer über den Weg — und niemand hört sein Rufen.",
      "Er hebt einen Felsen ins Bachbett — jetzt hört ihn nicht mal mehr das Kind neben ihm.",
      "Er hebt die halbe Brücke an — und ist völlig stumm, mitten im lautesten Moment.",
    ],
    reversal:
      "Am Ende hebt er gar nichts mehr, sondern flüstert einem einzigen Kind etwas ins Ohr, das es weiterträgt.",
    price: "Das Kind gibt seine Trillerpfeife her, damit der Riese wenigstens ein Geräusch machen kann.",
    closingImage: "Am Riesenhals hängt an einer Schnur eine kleine Trillerpfeife.",
    gagType: "erwachsener_merkt_nichts",
    roleNeeds: ["gegenspieler", "komplize", "autoritaet"],
    artifactSlot: true,
  },

  {
    id: "karte-zeigt-aerger",
    workingTitle: "Die Karte, die immer zum Ärger zeigt",
    genres: ["adventure", "mystery", "nature"],
    settings: ["forest", "village", "city", "desert"],
    ageBands: ["6-8", "9-12"],
    situation:
      "Auf einer alten Karte wandert ein Tintenklecks über Nacht — und morgens steht er immer genau da, wo an diesem Tag etwas schiefgeht.",
    childWant: "den verschwundenen Ziegenbock vor dem Abend zurückbringen",
    whyItHurts: "ohne den Bock gibt es morgen keine Milch für den Markt",
    opponent: {
      roleNeed: "gegenspieler",
      want: "dass der Bock nicht gefunden wird, weil er ihn selbst behalten will",
    },
    wonderRule: {
      rule: "Der Klecks zeigt den Ort, wo heute etwas schiefgeht — nicht den Ort, wo das Gesuchte ist.",
      visibleSideEffect: "Nach jedem Weg, den man ihm folgt, wird der Klecks kleiner und blasser.",
    },
    escalation: [
      "Der erste Klecks führt zum umgekippten Bienenstock — Ärger, aber kein Bock.",
      "Der zweite führt in die Brennnesseln, und dort steckt nur ein Hut fest.",
      "Der dritte Klecks ist so klein, dass man ihn kaum noch sieht, und er zeigt auf das eigene Haus.",
    ],
    reversal:
      "Zum Schluss folgt er dem Klecks nicht, sondern geht absichtlich in die Gegenrichtung — und trifft genau dort den Bock.",
    price: "Er lässt die Karte am Fundort liegen, damit der nächste sie findet.",
    closingImage: "Die Karte liegt auf dem Zaunpfahl, der Klecks ist ein winziger blasser Punkt am Rand.",
    gagType: "woertlich_genommen",
    roleNeeds: ["gegenspieler", "skeptiker", "kleiner_helfer"],
    artifactSlot: true,
  },

  {
    id: "raumanzug-piept",
    workingTitle: "Der Raumanzug, der immer piept",
    genres: ["space", "adventure", "friendship"],
    settings: ["space", "city", "fantasy"],
    ageBands: ["6-8", "9-12"],
    situation:
      "Auf der kleinen Station piept ein geflickter Raumanzug jedes Mal, wenn jemand in der Nähe etwas Wichtiges vergessen hat.",
    childWant: "die selbstgezogene Pflanze rechtzeitig zum Versorgungsschiff bringen",
    whyItHurts: "kommt sie zu spät, fliegt das Schiff ohne sie los und die Pflanze erfriert",
    opponent: {
      roleNeed: "gegenspieler",
      want: "den Anzug abschalten, weil das Piepen ihn beim Schlafen stört",
    },
    wonderRule: {
      rule: "Der Anzug piept bei allem, was jemand in der Nähe vergessen hat — er sagt aber nie, was.",
      visibleSideEffect: "Nach jedem Piepen erlischt eines der sechs Lämpchen am Ärmel.",
    },
    escalation: [
      "Erstes Piepen im Gang: irgendetwas ist vergessen, sie finden nur einen offenen Schrank.",
      "Zweites Piepen in der Schleuse: sie suchen fünf Minuten und finden einen Handschuh.",
      "Drittes Piepen direkt vor dem Schiff: noch ein Lämpchen, und alle schauen sich an.",
    ],
    reversal:
      "Am Schluss piept es nicht mehr für sie, sondern für jemand anderen — und sie geht zurück, obwohl das Schiff wartet.",
    price: "Sie lässt die Pflanze zurück und nimmt stattdessen den Anzug mit.",
    closingImage: "Am Fenster der Station steht die Pflanze, daneben der Anzug mit einem einzigen leuchtenden Lämpchen.",
    gagType: "das_ding_hoert_nicht_auf",
    roleNeeds: ["gegenspieler", "komplize", "autoritaet"],
    artifactSlot: true,
  },

  {
    id: "dino-zu-gross-fuer-versteck",
    workingTitle: "Der Dino, der sich nicht verstecken kann",
    genres: ["dinosaurs", "animals", "friendship", "adventure"],
    settings: ["forest", "village", "fantasy", "desert"],
    ageBands: ["3-5", "6-8"],
    situation:
      "Ein junger Dino ist beim Versteckspiel immer als Erster dran, weil sein Schwanz überall hervorschaut.",
    childWant: "das Versteckspiel gewinnen, weil der Gewinner den großen Stock bekommt",
    whyItHurts: "ohne den Stock kann er die Höhle nicht abstützen, in der er schläft",
    opponent: {
      roleNeed: "gegenspieler",
      want: "den Stock selbst haben und deshalb dafür sorgen, dass der Dino jedes Mal auffliegt",
    },
    wonderRule: {
      rule: "Der Dino wird unsichtbar, solange er die Luft anhält. Der Schwanz aber bleibt sichtbar.",
      visibleSideEffect: "Jedes Mal, wenn er ausatmet, wird ein Fleck auf seinem Rücken für immer grün.",
    },
    escalation: [
      "Hinter dem Farn: Kopf weg, Schwanz da. Ein grüner Fleck.",
      "Im Wasser: alles weg, aber der Schwanz malt Wellen an die Oberfläche.",
      "Unter dem Blätterhaufen: er hält so lange die Luft an, dass er sich pusten hört.",
    ],
    reversal:
      "Zum Schluss versteckt er sich gar nicht, sondern stellt sich mitten auf die Lichtung — und wird zuletzt gefunden, weil niemand dort sucht.",
    price: "Er gibt den gewonnenen Stock her, damit ein anderer damit die Brücke flicken kann.",
    closingImage: "Auf dem Dinorücken leuchten drei grüne Flecken wie ein Muster.",
    gagType: "koerperliche_eskalation",
    roleNeeds: ["gegenspieler", "kleiner_helfer", "komplize"],
    artifactSlot: false,
  },

  {
    id: "brief-liest-sich-selbst",
    workingTitle: "Der Brief, der sich selbst vorliest",
    genres: ["mystery", "friendship", "magic"],
    settings: ["home", "village", "city", "castle"],
    ageBands: ["6-8", "9-12"],
    situation:
      "Ein Brief ohne Absender liest sich jeden Mittag selbst vor — jedes Mal einen Satz weiter und immer da, wo Leute stehen.",
    childWant: "herausfinden, wer den Brief geschrieben hat, bevor der letzte Satz kommt",
    whyItHurts: "im letzten Satz steht ein Name, und wer da drinsteht, muss wegziehen",
    opponent: {
      roleNeed: "gegenspieler",
      want: "dass der Brief zu Ende gelesen wird, weil ihm das einen Vorteil bringt",
    },
    wonderRule: {
      rule: "Der Brief liest jeden Mittag genau einen Satz mehr vor. Zurücknehmen kann man nichts.",
      visibleSideEffect: "Nach jedem Satz verblasst die Tinte einer Zeile ganz oben.",
    },
    escalation: [
      "Erster Satz: auf dem Schulhof, alle drehen sich um.",
      "Zweiter Satz: im Laden, und diesmal fällt ein halber Name.",
      "Dritter Satz: vor dem eigenen Haus, und die Tinte oben ist fast weg.",
    ],
    reversal:
      "Am Ende liest das Kind den letzten Satz selbst laut vor, bevor der Brief es tun kann — und liest ihn zu Ende, anders als alle dachten.",
    price: "Es gibt den Brief aus der Hand, obwohl es ihn behalten möchte.",
    closingImage: "Auf dem Tisch liegt ein leeres Blatt mit einer einzigen noch dunklen Zeile.",
    gagType: "erwachsener_merkt_nichts",
    roleNeeds: ["gegenspieler", "skeptiker", "komplize"],
    artifactSlot: true,
  },

  {
    id: "brunnen-tauscht",
    workingTitle: "Der Brunnen, der tauscht",
    genres: ["fairy_tales", "fantasy", "magic", "adventure"],
    settings: ["village", "castle", "forest", "fantasy"],
    ageBands: ["6-8", "9-12"],
    situation:
      "Wer etwas in den alten Dorfbrunnen wirft, bekommt sofort etwas anderes heraus — aber nie das, was er wollte.",
    childWant: "die zerbrochene Brille der Großmutter ersetzen, bevor sie zurückkommt",
    whyItHurts: "ohne Brille kann die Großmutter das Abendbrot nicht schneiden und merkt sofort, was passiert ist",
    opponent: {
      roleNeed: "gegenspieler",
      want: "den Brunnen für sich allein haben und alles Brauchbare vorher hineinwerfen",
    },
    wonderRule: {
      rule: "Der Brunnen tauscht sofort — und gibt immer etwas zurück, das jemand anders gerade dringend braucht.",
      visibleSideEffect: "Nach jedem Tausch sinkt der Wasserspiegel um eine Handbreit und ein Stein liegt frei.",
    },
    escalation: [
      "Für den Kamm gibt es einen Schuh, viel zu groß, ein Stein liegt frei.",
      "Für den Schuh gibt es einen Käfig ohne Vogel, und zwei Steine liegen frei.",
      "Für den Käfig gibt es einen zweiten Käfig, und der Brunnen ist fast leer.",
    ],
    reversal:
      "Zum Schluss wirft das Kind nicht mehr hinein, um etwas zu bekommen, sondern um jemandem genau das zu geben, was er braucht.",
    price: "Es wirft sein Glücksband hinein und bekommt nichts dafür.",
    closingImage: "Der Brunnen ist wieder voll, und auf dem Rand liegt eine geflickte Brille.",
    gagType: "woertlich_genommen",
    roleNeeds: ["gegenspieler", "autoritaet", "kleiner_helfer"],
    artifactSlot: true,
  },

  {
    id: "katze-laeuft-rueckwaerts",
    workingTitle: "Die Katze, die rückwärts läuft",
    genres: ["animals", "mystery", "friendship"],
    settings: ["home", "city", "village"],
    ageBands: ["3-5", "6-8"],
    situation:
      "Eine Katze läuft seit dem Umzug nur noch rückwärts — und immer genau dorthin, wo sie schon einmal war.",
    childWant: "herausfinden, wo die Katze jede Nacht hingeht, bevor sie ganz wegbleibt",
    whyItHurts: "bleibt sie weg, ist das kleine Geschwisterkind untröstlich",
    opponent: {
      roleNeed: "gegenspieler",
      want: "die Katze für sich behalten, weil sie bei ihm Mäuse fängt",
    },
    wonderRule: {
      rule: "Die Katze läuft rückwärts genau den Weg zurück, den sie schon einmal gegangen ist. Neue Wege geht sie nicht.",
      visibleSideEffect: "Auf jedem Rückweg lässt sie ein Haarbüschel fallen, weiß auf dunklem Boden.",
    },
    escalation: [
      "Erster Rückweg: bis zur Mülltonne, ein Büschel.",
      "Zweiter Rückweg: bis unter das alte Auto, wo es nach Fisch riecht.",
      "Dritter Rückweg: über eine Mauer, die kein Kind hochkommt.",
    ],
    reversal:
      "Am Ende folgt das Kind der Katze nicht mehr, sondern geht den Weg selbst vorwärts — und kommt so als Erstes an.",
    price: "Es gibt seinen Platz auf dem Bett her, damit die Katze bleibt.",
    closingImage: "Auf dem Kissen liegt ein weißes Haarbüschel in einer kleinen Spirale.",
    gagType: "selbstbewusst_falsch",
    roleNeeds: ["gegenspieler", "kleiner_helfer"],
    artifactSlot: false,
  },

  {
    id: "samen-erinnert-sich",
    workingTitle: "Der Samen, der sich erinnert",
    genres: ["nature", "magic", "friendship", "fantasy"],
    settings: ["forest", "village", "home", "desert"],
    ageBands: ["6-8", "9-12"],
    situation:
      "Aus einem einzigen Samen wächst über Nacht genau die Pflanze, an die zuletzt jemand gedacht hat — auch wenn das eine Brennnessel ist.",
    childWant: "bis zum Schulfest einen Baum haben, unter den alle passen",
    whyItHurts: "ohne Schatten fällt das Fest aus und die Klasse verliert die Wette",
    opponent: {
      roleNeed: "gegenspieler",
      want: "dass das Fest woanders stattfindet, nämlich bei ihm",
    },
    wonderRule: {
      rule: "Der Samen wächst über Nacht zu dem, woran zuletzt jemand gedacht hat. Man kann ihn nicht zwingen.",
      visibleSideEffect: "Nach jeder Nacht bleibt eine leere Samenhülse liegen, und es sind nur drei im Beutel.",
    },
    escalation: [
      "Erste Nacht: eine Brennnessel, weil jemand daran gedacht hat, sich zu kratzen.",
      "Zweite Nacht: ein Kürbis so groß wie ein Fass, aber ohne einen Zentimeter Schatten.",
      "Dritte Nacht: nichts, weil alle gleichzeitig an etwas anderes gedacht haben.",
    ],
    reversal:
      "Zum Schluss denkt nicht das Kind an den Baum, sondern es bringt alle dazu, gleichzeitig an denselben zu denken.",
    price: "Es gibt die letzte Hülse weg und behält keinen Samen für sich.",
    closingImage: "Unter dem jungen Baum liegen drei leere Samenhülsen im Gras.",
    gagType: "koerperliche_eskalation",
    roleNeeds: ["gegenspieler", "komplize", "skeptiker"],
    artifactSlot: true,
  },

  {
    id: "muetze-sagt-wahrheit",
    workingTitle: "Die Mütze, die dazwischenredet",
    genres: ["friendship", "magic", "mystery"],
    settings: ["city", "home", "village", "castle"],
    ageBands: ["6-8"],
    situation:
      "Eine gestrickte Mütze sagt jeden Satz laut, den ihr Träger gerade hinunterschluckt.",
    childWant: "beim Vorlesewettbewerb bis zum Ende durchhalten",
    whyItHurts: "wer abbricht, darf im nächsten Jahr nicht mehr mitmachen",
    opponent: {
      roleNeed: "gegenspieler",
      want: "selbst gewinnen und deshalb dafür sorgen, dass die Mütze so oft wie möglich redet",
    },
    wonderRule: {
      rule: "Was der Träger hinunterschluckt, sagt die Mütze laut. Abnehmen hilft nicht, dann redet sie einfach vom Kopf des Nächsten.",
      visibleSideEffect: "Bei jedem Satz rollt sich ein Stück Wolle auf und der Bommel wird kleiner.",
    },
    escalation: [
      "Erster Satz vor der Klasse: peinlich, aber alle lachen mit.",
      "Zweiter Satz vor der Jury: die Mütze sagt genau das, was niemand hören sollte.",
      "Dritter Satz auf dem Kopf des Gegenspielers: und der wird knallrot.",
    ],
    reversal:
      "Am Ende schluckt das Kind nichts mehr hinunter, sondern sagt den Satz selbst — und die Mütze bleibt still.",
    price: "Es wickelt den letzten Wollfaden ab und verschenkt ihn.",
    closingImage: "Auf der Stuhllehne liegt eine Mütze ganz ohne Bommel.",
    gagType: "erwachsener_merkt_nichts",
    roleNeeds: ["gegenspieler", "autoritaet", "komplize"],
    artifactSlot: true,
  },

  {
    id: "leiter-in-die-wolke",
    workingTitle: "Die Leiter, die nur nach oben geht",
    genres: ["adventure", "fantasy", "magic", "nature"],
    settings: ["forest", "village", "fantasy", "space"],
    ageBands: ["6-8", "9-12"],
    situation:
      "Hinter dem Schuppen steht eine Leiter, deren Sprossen nach oben immer da sind — und nach unten verschwinden.",
    childWant: "den Drachen vom Dach holen, den der kleine Bruder verloren hat",
    whyItHurts: "der Drachen war das Letzte, was der Opa gebaut hat",
    opponent: {
      roleNeed: "gegenspieler",
      want: "die Leiter abbauen, weil sie ihm gehört und er sie verkaufen will",
    },
    wonderRule: {
      rule: "Nach oben hat die Leiter immer eine Sprosse mehr. Nach unten fehlt jede, auf der man schon stand.",
      visibleSideEffect: "Jede benutzte Sprosse fällt hinter dem Kletternden klappernd zu Boden.",
    },
    escalation: [
      "Bis zum Dachrand: drei Sprossen liegen unten im Gras.",
      "Bis zum Schornstein: sieben Sprossen unten, und der Drachen hängt eine Armlänge weiter.",
      "Bis über den Schornstein hinaus: unten liegt ein ganzer Haufen und der Wind frischt auf.",
    ],
    reversal:
      "Statt weiter zu klettern, wirft er die letzte Sprosse hinunter — als Brücke für den, der nachkommen muss.",
    price: "Er lässt den Drachen los, damit er die Hände frei hat.",
    closingImage: "Unten im Gras liegen die Sprossen aufgestapelt, ganz oben klemmt ein Stück Drachenschnur.",
    gagType: "das_ding_hoert_nicht_auf",
    roleNeeds: ["gegenspieler", "komplize", "kleiner_helfer"],
    artifactSlot: false,
  },

  {
    id: "spieluhr-weckt-alles",
    workingTitle: "Die Spieluhr, die alles aufweckt",
    genres: ["magic", "fairy_tales", "mystery", "fantasy"],
    settings: ["castle", "home", "forest", "village"],
    ageBands: ["3-5", "6-8"],
    situation:
      "Eine kleine Spieluhr weckt alles auf, was gerade schläft — Menschen, Tiere und auch Dinge, die eigentlich nie geschlafen haben.",
    childWant: "vor Sonnenaufgang das Vogelnest zurück in den Baum bringen",
    whyItHurts: "wacht die Vogelmutter auf und findet das Nest am Boden, zieht sie weg",
    opponent: {
      roleNeed: "gegenspieler",
      want: "die Spieluhr, um damit jeden Morgen als Erster wach zu sein",
    },
    wonderRule: {
      rule: "Ein Dreh weckt alles im Umkreis. Wieder einschlafen lässt sich nichts, was einmal wach ist.",
      visibleSideEffect: "Nach jedem Dreh springt eine der zwölf Zacken vom Uhrwerkskamm ab.",
    },
    escalation: [
      "Erster Dreh: der Hofhund ist wach und bellt jeden Schritt.",
      "Zweiter Dreh: die Türklinke ist wach und dreht sich von allein.",
      "Dritter Dreh: das ganze Haus ist wach, nur die Vogelmutter nicht — noch nicht.",
    ],
    reversal:
      "Zum Schluss dreht das Kind die Spieluhr absichtlich — um jemanden zu wecken, der sonst etwas verpasst.",
    price: "Es lässt die Spieluhr im Baum zurück, als Gewicht gegen den Wind.",
    closingImage: "Im Nest liegt die Spieluhr zwischen den Zweigen, ihr Kamm hat nur noch eine Zacke.",
    gagType: "das_ding_hoert_nicht_auf",
    roleNeeds: ["gegenspieler", "kleiner_helfer", "autoritaet"],
    artifactSlot: true,
  },

  {
    id: "schneemann-im-juli",
    workingTitle: "Der Schneemann, der nicht schmelzen will",
    genres: ["friendship", "magic", "nature", "fantasy"],
    settings: ["village", "home", "forest", "city"],
    ageBands: ["3-5", "6-8"],
    situation:
      "Mitten im Juli steht auf der Wiese ein Schneemann, der nicht schmilzt — er wandert nur jeden Tag ein Stück weiter in den Schatten.",
    childWant: "den Schneemann bis zum Sommerfest heil halten, weil alle ihn sehen sollen",
    whyItHurts: "schmilzt er vorher, glaubt niemand, dass es ihn gegeben hat",
    opponent: {
      roleNeed: "gegenspieler",
      want: "den Schneemann wegräumen, weil er auf seiner Festwiese steht",
    },
    wonderRule: {
      rule: "Der Schneemann schmilzt nicht in der Sonne, sondern nur, wenn ihn jemand anfasst. Dann fehlt genau eine Handvoll.",
      visibleSideEffect: "Jede Berührung hinterlässt eine Delle, und die Dellen bleiben.",
    },
    escalation: [
      "Die erste Hand: eine Delle in der Schulter, und alle wollen auch mal.",
      "Die zweite Hand: sein Arm fällt ab und liegt dampfend im Gras.",
      "Die dritte Hand: der Kopf sitzt schief und rutscht bei jedem Schritt.",
    ],
    reversal:
      "Am Schluss fasst das Kind ihn absichtlich an — um ihn zu tragen, obwohl das eine Handvoll kostet.",
    price: "Es gibt seine warme Jacke her, um den Rest einzuwickeln.",
    closingImage: "In der Kühltruhe der Nachbarin liegt ein Schneeball voller kleiner Dellen.",
    gagType: "koerperliche_eskalation",
    roleNeeds: ["gegenspieler", "komplize", "autoritaet"],
    artifactSlot: false,
  },
];

/**
 * Variation axes, one set per premise.
 *
 * This is the answer to "the child must never feel they have read this before".
 * The structure of a premise is what makes it work, so the structure stays. The
 * *surface* — the object, the countable unit, the places the escalation happens,
 * what the opponent is after, and which comic engine drives it — is redrawn
 * every time.
 *
 * Per premise that is 4 x 4 x 4 x 3 x 3 = 576 distinct tellings, and the draw is
 * recorded so a combination a family already had is never dealt again. Multiply
 * by heroes, cast rotation out of 128 pool characters, artifact, setting and the
 * wizard's wishes and the practical repeat distance is far beyond what any child
 * will read.
 */
const VARIANT_AXES: Record<string, PremiseVariants> = {
  "schuhe-geradeaus": {
    objekt: ["ein Paar alte Turnschuhe", "ein Paar zu große Gummistiefel", "ein Paar quietschende Rollschuhe", "ein Paar geerbte Wanderstiefel"],
    einheit: ["acht Knoten im Schnürsenkel", "sechs Klettverschlüsse", "sieben Metallösen", "fünf bunte Perlen am Band"],
    arena: ["Sandkasten, Wäscheleine, Bäckerei", "Marktplatz, Springbrunnen, Schneiderei", "Schulhof, Turnhalle, Hausmeisterkeller", "Gemüsebeet, Hühnerstall, Heuscheune"],
    gegnerWunsch: ["die Schuhe zurückhaben, weil sie ihm einmal gehört haben", "die Abkürzung für sich behalten, die nur geradeaus funktioniert", "dass das Spiel ausfällt, weil seine Mannschaft sonst verliert"],
    gag: ["koerperliche_eskalation", "das_ding_hoert_nicht_auf", "woertlich_genommen"],
  },
  "klingel-zehn-sekunden": {
    objekt: ["eine Fahrradklingel", "eine Kuhglocke am Handkarren", "ein Türglöckchen am Bollerwagen", "eine kleine Schiffsglocke am Roller"],
    einheit: ["sechs Speichenreflektoren", "fünf Glasperlen am Griff", "vier Schrauben am Halter", "sieben Kerben im Holz"],
    arena: ["Feldweg, Hundewiese, Brücke", "Bahnhofsvorplatz, Markthalle, Tunnel", "Kiesweg, Ententeich, Bahnübergang", "Kopfsteinpflaster, Treppenstraße, Fähranleger"],
    gegnerWunsch: ["das Gefährt zurückhaben, bevor jemand merkt, dass es nicht verschenkt war", "die Klingel abschrauben, weil sie ihn bei seiner Arbeit stört", "als Erster ankommen und deshalb jede Warnung verhindern"],
    gag: ["das_ding_hoert_nicht_auf", "erwachsener_merkt_nichts", "koerperliche_eskalation"],
  },
  "kuchen-waechst": {
    objekt: ["ein Rührkuchen", "ein Hefezopf", "eine Topfsuppe", "ein Berg Kartoffelbrei"],
    einheit: ["Risse in der Backform", "gesprungene Kacheln unter dem Topf", "Knöpfe, die von der Schürze springen", "Nägel, die aus dem Regalbrett fahren"],
    arena: ["Küchentür, Flur, Wohnzimmerfenster", "Vorratskammer, Treppenhaus, Balkontür", "Backstube, Ladentheke, Schaufenster", "Zeltküche, Festbank, Bühnenaufgang"],
    gegnerWunsch: ["selbst gewinnen und deshalb möglichst viele zum Schwindeln bringen", "den Wettbewerb absagen lassen, weil er nicht fertig geworden ist", "die geheime Zutat herausfinden und dafür alle aushorchen"],
    gag: ["koerperliche_eskalation", "selbstbewusst_falsch", "erwachsener_merkt_nichts"],
  },
  "hund-frisst-hausaufgaben": {
    objekt: ["ein Matheheft", "ein Zeichenblock", "ein Notenblatt", "eine Einkaufsliste"],
    einheit: ["nasse Papierschnipsel", "abgekaute Heftecken", "Tintenflecken auf dem Teppich", "Krümel in einer Spur"],
    arena: ["Klassenzimmer, Schulbus, Lehrerzimmertür", "Bibliothek, Pausenhof, Elternabend", "Probenraum, Bühne, Garderobe", "Supermarkt, Kasse, Parkplatz"],
    gegnerWunsch: ["dass der Hund weiterbellt, weil es die lustigste Sache seit Wochen ist", "den Hund für sich behalten, weil er bei ihm nachts wach bleibt", "beweisen, dass Hunde in die Schule nicht hineingehören"],
    gag: ["das_ding_hoert_nicht_auf", "erwachsener_merkt_nichts", "woertlich_genommen"],
  },
  "alles-doppelt": {
    objekt: ["die linke Hand", "ein alter Handschuh", "ein Löffel aus dem Gewitterschrank", "eine Haarspange"],
    einheit: ["blassere Zwillinge, die man sofort erkennt", "ein Summen, das bei jedem Doppel lauter wird", "ein kalter Fleck, der bleibt", "ein Schatten, der doppelt fällt"],
    arena: ["Eisdiele, Hundewiese, Küchenfenster", "Wochenmarkt, Kirchplatz, Waschsalon", "Schulhof, Bushaltestelle, Turnhalle", "Zeltlager, Lagerfeuer, Waschhaus"],
    gegnerWunsch: ["die Hand für seinen Marktstand benutzen und alles verdoppeln", "das Geheimnis verkaufen, bevor es jemand anders tut", "beweisen, dass es Zauberei nicht gibt, und alles dafür kaputtmachen"],
    gag: ["koerperliche_eskalation", "woertlich_genommen", "selbstbewusst_falsch"],
  },
  "drache-hat-angst-vor-feuer": {
    objekt: ["ein junger Drache", "ein alter Ofendrache", "ein Feuervogel", "ein Funkenkobold"],
    einheit: ["graue Rückenschuppen", "erloschene Federspitzen", "kalte Stellen am Bauch", "verrußte Krallen"],
    arena: ["Fahnenstange, Bürgermeisterhut, Holzstapel", "Marktbude, Wäschekorb, Scheunentor", "Turmspitze, Glockenseil, Feuerschale", "Steg, Fischernetz, Leuchtturm"],
    gegnerWunsch: ["dass der Drache durchfällt, damit endlich jemand anderes das Feuer machen darf", "den Drachen wegschicken, weil er ihm Kundschaft vertreibt", "die Prüfung so lange verschieben, bis niemand mehr zuschaut"],
    gag: ["selbstbewusst_falsch", "koerperliche_eskalation", "erwachsener_merkt_nichts"],
  },
  "schluessel-einmal-pro-tuer": {
    objekt: ["ein Schlüssel im Jackenfutter", "ein Schlüssel an einer Halskette", "ein Dietrich aus Fischbein", "ein Schlüssel aus grünem Glas"],
    einheit: ["sieben Zacken am Schlüsselbart", "sechs Kerben am Griff", "fünf Ringe an der Kette", "vier Zähne aus Messing"],
    arena: ["Turmtreppe, Archiv, Glockenstube", "Gewächshaus, Heizkeller, Dachboden", "Lagerhalle, Kühlraum, Laderampe", "Katakombe, Zisterne, Brunnenhaus"],
    gegnerWunsch: ["den Turm heute noch zumauern, weil er dafür bezahlt wird", "den Schlüssel selbst haben, weil er weiß, was hinter der letzten Tür liegt", "dass niemand hineinkommt, bevor er alles ausgeräumt hat"],
    gag: ["woertlich_genommen", "koerperliche_eskalation", "selbstbewusst_falsch"],
  },
  "vogel-plappert-peinliches": {
    objekt: ["ein zugeflogener Vogel", "ein Papagei aus dem Zoogeschäft", "eine sprechende Elster", "ein Rabe mit einem Ring am Bein"],
    einheit: ["ausfallende Federn", "verlorene Halmstücke aus dem Nest", "Kiesel, die er fallen lässt", "Fäden, die er aus dem Schal zieht"],
    arena: ["Gartenzaun, Bus, Kuchenladen", "Balkon, Wartezimmer, Sportplatz", "Waldrand, Fähre, Dorffest", "Schulflur, Musikraum, Elternabend"],
    gegnerWunsch: ["den Vogel weiterfüttern, weil er hören will, was die Nachbarn sagen", "den Vogel verkaufen und deshalb möglichst laut vorführen", "das Geheimnis vor allen ausplaudern, um selbst wichtig zu sein"],
    gag: ["erwachsener_merkt_nichts", "das_ding_hoert_nicht_auf", "woertlich_genommen"],
  },
  "boot-nur-bei-gegenwind": {
    objekt: ["ein Boot mit rotem Segel", "ein Floß mit einem Bettlaken als Segel", "ein Tretboot mit Schirm", "ein Schlitten mit Segel auf dem Sand"],
    einheit: ["Streifen aus dem roten Segel", "Bretter, die sich lösen", "Knoten im Halteseil", "Ringe am Mast"],
    arena: ["Boje, Schilfgürtel, Inselsteg", "Wehr, Brückenpfeiler, Bootshaus", "Sandbank, Fischerhütte, Leuchtfeuer", "Düne, Salzsee, Karawanenrast"],
    gegnerWunsch: ["das Boot für die Abendfahrt haben und jeden anderen fernhalten", "die Insel für sich behalten, solange dort noch etwas liegt", "beweisen, dass das Boot Schrott ist, damit es verbrannt wird"],
    gag: ["selbstbewusst_falsch", "koerperliche_eskalation", "woertlich_genommen"],
  },
  "wecker-haelt-zeit-an": {
    objekt: ["ein zerbeulter Wecker", "eine Taschenuhr ohne Deckel", "eine Sanduhr aus blauem Glas", "ein Metronom aus Holz"],
    einheit: ["stehenbleibende Zeiger", "Sandkörner, die nicht mehr rieseln", "Zahnräder, die herausspringen", "Kerben am Gehäuse"],
    arena: ["Werkbank, Hofdurchgang, Regenrinne", "Bahnsteig, Kiosk, Unterführung", "Baustelle, Gerüst, Kranhaken", "Raumstation, Schleuse, Frachtluke"],
    gegnerWunsch: ["den Wecker haben, um vor allen anderen an der Ausgabe zu stehen", "die angehaltene Zeit nutzen, um etwas mitzunehmen", "beweisen, dass alle spinnen, und den Wecker zertreten"],
    gag: ["koerperliche_eskalation", "erwachsener_merkt_nichts", "das_ding_hoert_nicht_auf"],
  },
  "riese-zu-leise": {
    objekt: ["ein Riese", "ein Baumwesen", "ein Steinmann aus dem Bruch", "ein Nebelwanderer"],
    einheit: ["verstummende Vögel", "erlöschende Glühwürmchen", "Blätter, die lautlos fallen", "Glocken, die nicht mehr anschlagen"],
    arena: ["Waldweg, Bachbett, Brücke", "Deich, Schleuse, Fährsteg", "Bergpfad, Geröllfeld, Hängebrücke", "Stadtmauer, Kanal, Marktbrunnen"],
    gegnerWunsch: ["dass alle beim Fest bleiben, weil er die Karten verkauft hat", "den Riesen vertreiben, weil ihm der Wald gehören soll", "die Warnung selbst überbringen und dafür gefeiert werden"],
    gag: ["erwachsener_merkt_nichts", "selbstbewusst_falsch", "koerperliche_eskalation"],
  },
  "karte-zeigt-aerger": {
    objekt: ["eine alte Karte mit wanderndem Tintenklecks", "ein Kompass, dessen Nadel schielt", "ein Wetterhäuschen mit zwei Figuren", "ein Stock, der von allein ausschlägt"],
    einheit: ["der Klecks wird blasser", "die Nadel dreht sich langsamer", "die Figuren kommen nicht mehr heraus", "der Stock verliert Rinde"],
    arena: ["Bienenstock, Brennnesseln, eigenes Haus", "Mühlgraben, Dornenhecke, Nachbarhof", "Steinbruch, Fuchsbau, Bahndamm", "Oase, Salzpfanne, Karawanenlager"],
    gegnerWunsch: ["dass das Gesuchte nicht gefunden wird, weil er es behalten will", "die Karte für sich haben, um jedem Ärger auszuweichen", "beweisen, dass die Karte lügt, und sie verbrennen"],
    gag: ["woertlich_genommen", "selbstbewusst_falsch", "erwachsener_merkt_nichts"],
  },
  "raumanzug-piept": {
    objekt: ["ein geflickter Raumanzug", "ein Helm mit losem Visier", "ein Werkzeuggürtel", "ein Rucksack mit Kontrolllämpchen"],
    einheit: ["sechs Lämpchen am Ärmel", "vier Balken auf der Anzeige", "fünf Klettstreifen", "drei Sicherungen im Griff"],
    arena: ["Verbindungsgang, Schleuse, Landeplattform", "Gewächsmodul, Wasseraufbereitung, Frachtraum", "Beobachtungskuppel, Werkstatt, Antennenmast", "Rover, Kraterrand, Basislager"],
    gegnerWunsch: ["den Anzug abschalten, weil das Piepen ihn beim Schlafen stört", "den Anzug für die eigene Ausfahrt haben", "beweisen, dass der Anzug kaputt ist, damit er ersetzt wird"],
    gag: ["das_ding_hoert_nicht_auf", "erwachsener_merkt_nichts", "koerperliche_eskalation"],
  },
  "dino-zu-gross-fuer-versteck": {
    objekt: ["ein junger Dino mit langem Schwanz", "ein Flugsaurier mit zu breiten Flügeln", "ein Panzerdino mit klappernden Platten", "ein Langhals mit unübersehbarem Kopf"],
    einheit: ["grüne Flecken auf dem Rücken", "abfallende Schuppen", "Platten, die sich verfärben", "Streifen, die heller werden"],
    arena: ["Farnbusch, Flussbett, Blätterhaufen", "Schilf, Schlammloch, Felsspalt", "Aschefeld, Baumstumpf, Höhleneingang", "Palmenhain, Wasserloch, Sanddüne"],
    gegnerWunsch: ["den Stock selbst haben und deshalb dafür sorgen, dass der Dino auffliegt", "das Spiel gewinnen, weil er noch nie gewonnen hat", "das Versteck für sich behalten, weil dort sein Vorrat liegt"],
    gag: ["koerperliche_eskalation", "selbstbewusst_falsch", "woertlich_genommen"],
  },
  "brief-liest-sich-selbst": {
    objekt: ["ein Brief ohne Absender", "eine Postkarte mit halber Schrift", "ein Zettel aus einer Flaschenpost", "ein Aushang am schwarzen Brett"],
    einheit: ["verblassende Zeilen von oben", "abbröckelnde Siegelwachsstücke", "Ecken, die sich einrollen", "Buchstaben, die herunterfallen"],
    arena: ["Schulhof, Laden, Haustür", "Bahnsteig, Café, Hinterhof", "Kirchplatz, Brunnen, Rathaustreppe", "Hafenkai, Fischmarkt, Leuchtturmtür"],
    gegnerWunsch: ["dass der Brief zu Ende gelesen wird, weil ihm das nützt", "den Brief vernichten, bevor sein eigener Name fällt", "den letzten Satz vorher wissen, um ihn zu verkaufen"],
    gag: ["erwachsener_merkt_nichts", "das_ding_hoert_nicht_auf", "selbstbewusst_falsch"],
  },
  "brunnen-tauscht": {
    objekt: ["der alte Dorfbrunnen", "ein Loch in der Klostermauer", "ein hohler Baumstamm", "eine Truhe ohne Boden"],
    einheit: ["freiliegende Steine am Rand", "sinkender Wasserstand", "Moosstreifen, die trocken werden", "Ringe, die sichtbar werden"],
    arena: ["Marktplatz, Schmiede, Kirchhof", "Klosterhof, Kräutergarten, Torhaus", "Waldlichtung, Köhlerhütte, Wegkreuz", "Burghof, Küchentrakt, Wachturm"],
    gegnerWunsch: ["den Brunnen für sich allein haben und alles Brauchbare vorher hineinwerfen", "herausfinden, wer was braucht, um es teuer zu verkaufen", "den Brunnen zuschütten lassen, weil er dort etwas versteckt hat"],
    gag: ["woertlich_genommen", "koerperliche_eskalation", "selbstbewusst_falsch"],
  },
  "katze-laeuft-rueckwaerts": {
    objekt: ["eine Katze", "ein Igel", "ein Hund mit drei Beinen", "eine zahme Krähe"],
    einheit: ["weiße Haarbüschel", "abgeknickte Stacheln", "Pfotenabdrücke im Mehl", "verlorene Federn"],
    arena: ["Mülltonne, altes Auto, Mauer", "Hinterhof, Kellerschacht, Dachrinne", "Scheune, Misthaufen, Feldweg", "Baustelle, Rohrleitung, Bauzaun"],
    gegnerWunsch: ["das Tier für sich behalten, weil es bei ihm Mäuse fängt", "das Tier loswerden, weil es seine Beete umgräbt", "herausfinden, wo das Tier hingeht, um dort zu graben"],
    gag: ["selbstbewusst_falsch", "erwachsener_merkt_nichts", "das_ding_hoert_nicht_auf"],
  },
  "samen-erinnert-sich": {
    objekt: ["ein einzelner Samen", "eine Zwiebel aus dem Keller", "ein Kern aus einer alten Frucht", "ein Steckling in einem Glas"],
    einheit: ["leere Samenhülsen", "abgezogene Zwiebelschalen", "verbrauchte Wasserstände im Glas", "Etiketten, die abfallen"],
    arena: ["Schulgarten, Hof, Sportplatz", "Innenhof, Dachterrasse, Brachfläche", "Waldrand, Bachufer, Wiesenhang", "Oasenrand, Lehmbeet, Schattenhaus"],
    gegnerWunsch: ["dass das Fest woanders stattfindet, nämlich bei ihm", "den Samen selbst haben, um damit Geld zu verdienen", "beweisen, dass nichts wächst, und deshalb heimlich stören"],
    gag: ["koerperliche_eskalation", "selbstbewusst_falsch", "woertlich_genommen"],
  },
  "muetze-sagt-wahrheit": {
    objekt: ["eine gestrickte Mütze", "ein Schal mit Fransen", "ein Paar Fäustlinge", "eine Kapuze mit Kordel"],
    einheit: ["ein schrumpfender Bommel", "Fransen, die verschwinden", "Maschen, die aufgehen", "eine Kordel, die kürzer wird"],
    arena: ["Klassenzimmer, Aula, Schulflur", "Bühne, Foyer, Garderobe", "Bibliothek, Lesesaal, Treppenhaus", "Festzelt, Bühnenrand, Losbude"],
    gegnerWunsch: ["selbst gewinnen und deshalb möglichst oft die Mütze zum Reden bringen", "die Mütze haben, um andere auszuhorchen", "den Wettbewerb absagen, weil er sich blamiert hat"],
    gag: ["erwachsener_merkt_nichts", "koerperliche_eskalation", "woertlich_genommen"],
  },
  "leiter-in-die-wolke": {
    objekt: ["eine Leiter hinter dem Schuppen", "eine Strickleiter am Baum", "eine Wendeltreppe ohne Geländer", "ein Stapel Kisten, der von allein wächst"],
    einheit: ["herunterfallende Sprossen", "reißende Knoten", "Stufen, die verschwinden", "Kisten, die unten zerbrechen"],
    arena: ["Dachrand, Schornstein, Firstbalken", "Baumkrone, Vogelnest, Wetterfahne", "Turmluke, Glockenstuhl, Turmspitze", "Mastkorb, Rah, Ausguck"],
    gegnerWunsch: ["die Leiter abbauen, weil sie ihm gehört und er sie verkaufen will", "selbst hinauf, weil dort oben etwas liegt, das er will", "verhindern, dass jemand sieht, was auf dem Dach steht"],
    gag: ["das_ding_hoert_nicht_auf", "koerperliche_eskalation", "selbstbewusst_falsch"],
  },
  "spieluhr-weckt-alles": {
    objekt: ["eine kleine Spieluhr", "eine Drehorgel im Miniformat", "ein Windspiel aus Muscheln", "eine Taschenharfe"],
    einheit: ["abspringende Zacken am Kamm", "reißende Saiten", "Muscheln, die herunterfallen", "Löcher in der Walze"],
    arena: ["Hofhund, Türklinke, ganzes Haus", "Stallgasse, Brunnenrad, Dorfglocke", "Bibliothek, Standuhr, Ahnengalerie", "Baumhaus, Bienenstock, Waldrand"],
    gegnerWunsch: ["die Spieluhr haben, um jeden Morgen als Erster wach zu sein", "alles wachhalten, damit niemand die Nacht verpasst", "die Spieluhr zerstören, weil sie ihn nachts verrät"],
    gag: ["das_ding_hoert_nicht_auf", "koerperliche_eskalation", "erwachsener_merkt_nichts"],
  },
  "schneemann-im-juli": {
    objekt: ["ein Schneemann im Juli", "ein Eisblock, der nicht taut", "ein Frostvogel", "eine Schneekugel ohne Glas"],
    einheit: ["Dellen von jeder Hand", "abbrechende Kanten", "verlorene Federn aus Eis", "Flocken, die liegen bleiben"],
    arena: ["Festwiese, Schattenbaum, Kühltruhe", "Marktplatz, Kirchenschatten, Eisdiele", "Schulhof, Fahrradkeller, Hausmeisterraum", "Waldlichtung, Bachlauf, Felsspalte"],
    gegnerWunsch: ["den Schneemann wegräumen, weil er auf seiner Festwiese steht", "den Schneemann verkaufen, solange es ihn noch gibt", "beweisen, dass es ihn gar nicht gibt, und ihn dabei anfassen"],
    gag: ["koerperliche_eskalation", "erwachsener_merkt_nichts", "selbstbewusst_falsch"],
  },
};

const FALLBACK_VARIANTS: PremiseVariants = {
  objekt: ["das Fundstück"],
  einheit: ["sichtbare Spuren"],
  arena: ["Zuhause, Weg, Ziel"],
  gegnerWunsch: ["dasselbe haben wollen wie die Hauptfigur"],
  gag: ["koerperliche_eskalation"],
};

export const PREMISE_BANK: Premise[] = RAW_PREMISES.map((premise) => ({
  ...premise,
  variants: VARIANT_AXES[premise.id] || FALLBACK_VARIANTS,
}));

/** Total number of distinct tellings the bank can produce before any repeat. */
export function countDistinctTellings(): number {
  return PREMISE_BANK.reduce((sum, premise) => {
    const v = premise.variants;
    return sum + v.objekt.length * v.einheit.length * v.arena.length * v.gegnerWunsch.length * v.gag.length;
  }, 0);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Draws one variant. Deterministic for a given seed, but walks the whole
 * combination space before reusing anything the family has already had.
 */
export function resolvePremiseVariant(
  premise: Premise,
  seed: string,
  usedVariantKeys: Set<string> = new Set()
): ResolvedPremise {
  const axes = premise.variants;
  const base = hashString(`${premise.id}::${seed}`);
  const combos = axes.objekt.length * axes.einheit.length * axes.arena.length * axes.gegnerWunsch.length * axes.gag.length;

  let chosen: PremiseVariant | null = null;
  // Step with an odd stride so consecutive offsets touch every combination.
  for (let step = 0; step < combos; step += 1) {
    const index = (base + step * 7919) % combos;
    let rest = index;
    const objekt = axes.objekt[rest % axes.objekt.length];
    rest = Math.floor(rest / axes.objekt.length);
    const einheit = axes.einheit[rest % axes.einheit.length];
    rest = Math.floor(rest / axes.einheit.length);
    const arena = axes.arena[rest % axes.arena.length];
    rest = Math.floor(rest / axes.arena.length);
    const gegnerWunsch = axes.gegnerWunsch[rest % axes.gegnerWunsch.length];
    rest = Math.floor(rest / axes.gegnerWunsch.length);
    const gag = axes.gag[rest % axes.gag.length];

    const key = `${premise.id}:${index}`;
    if (!usedVariantKeys.has(key) || step === combos - 1) {
      chosen = { objekt, einheit, arena, gegnerWunsch, gag, key };
      break;
    }
  }

  const variant = chosen || {
    objekt: axes.objekt[0],
    einheit: axes.einheit[0],
    arena: axes.arena[0],
    gegnerWunsch: axes.gegnerWunsch[0],
    gag: axes.gag[0],
    key: `${premise.id}:0`,
  };

  const [arenaA, arenaB, arenaC] = variant.arena.split(",").map((entry) => entry.trim());

  return {
    premise,
    variant,
    directives: [
      `Das zentrale Ding ist diesmal: ${variant.objekt}. Ersetze damit den Gegenstand aus der Prämisse überall.`,
      `Die sichtbare Folge zählt diesmal in: ${variant.einheit}. Der Text muss mitzählen können.`,
      `Die drei Steigerungen spielen diesmal hier: ${arenaA || variant.arena}${arenaB ? `, dann ${arenaB}` : ""}${arenaC ? `, dann ${arenaC}` : ""}.`,
      `Der Gegenspieler will diesmal: ${variant.gegnerWunsch}.`,
      `Der Laufgag läuft diesmal über: ${variant.gag}.`,
    ],
  };
}

const AGE_BAND_ORDER: Array<"3-5" | "6-8" | "9-12"> = ["3-5", "6-8", "9-12"];

function normalizeAgeBand(ageGroup?: string): "3-5" | "6-8" | "9-12" {
  const raw = String(ageGroup || "").trim();
  if (raw === "3-5" || raw === "6-8" || raw === "9-12") return raw;
  if (raw === "13+") return "9-12";
  return "6-8";
}

function tokenize(value?: string): string[] {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/)
    .filter((t) => t.length > 2);
}

export interface PremiseSelectionInput {
  genre?: string;
  setting?: string;
  ageGroup?: string;
  /** Premise ids used by this user's recent stories — heavily penalised. */
  recentPremiseIds?: string[];
  /** Free-text wish from the wizard; nudges the pick without overriding fit. */
  customPrompt?: string;
  /** Deterministic tie-break so the same story id reproduces the same pick. */
  seed?: string;
}

export interface PremiseSelection {
  premise: Premise;
  score: number;
  reason: string;
  /** Runner-ups, kept for logging and for a retry that must not repeat itself. */
  alternatives: Premise[];
}

/**
 * Picks a premise. Deterministic given the same seed, but rotates across
 * stories because recently used ids are pushed down hard.
 */
export function selectPremise(input: PremiseSelectionInput): PremiseSelection {
  const genre = String(input.genre || "").toLowerCase().trim();
  const setting = String(input.setting || "").toLowerCase().trim();
  const band = normalizeAgeBand(input.ageGroup);
  const bandIndex = AGE_BAND_ORDER.indexOf(band);
  const recent = new Set((input.recentPremiseIds || []).map((id) => String(id)));
  const wishTokens = new Set(tokenize(input.customPrompt));

  // Cheap stable hash so a given story id always lands on the same premise.
  let seedHash = 0;
  for (const ch of String(input.seed || "")) {
    seedHash = (seedHash * 31 + ch.charCodeAt(0)) >>> 0;
  }

  const scored = PREMISE_BANK.map((premise, index) => {
    let score = 0;
    const reasons: string[] = [];

    if (genre && premise.genres.includes(genre)) {
      score += 30;
      reasons.push("genre");
    }
    if (setting && premise.settings.includes(setting)) {
      score += 22;
      reasons.push("setting");
    }
    if (premise.ageBands.includes(band)) {
      score += 26;
      reasons.push("alter");
    } else {
      // One band away is workable, two bands away is not.
      const distance = Math.min(
        ...premise.ageBands.map((b) => Math.abs(AGE_BAND_ORDER.indexOf(b) - bandIndex))
      );
      score += distance === 1 ? 8 : -40;
    }

    if (wishTokens.size > 0) {
      const haystack = tokenize(
        `${premise.workingTitle} ${premise.situation} ${premise.childWant} ${premise.wonderRule.rule}`
      );
      const hits = haystack.filter((token) => wishTokens.has(token)).length;
      if (hits > 0) {
        score += Math.min(18, hits * 6);
        reasons.push("wunsch");
      }
    }

    if (recent.has(premise.id)) score -= 120;

    // Deterministic jitter — spreads picks without making them random.
    score += ((seedHash + index * 2654435761) % 1000) / 100;

    return { premise, score, reason: reasons.join("+") || "basis" };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  return {
    premise: best.premise,
    score: Number(best.score.toFixed(2)),
    reason: best.reason,
    alternatives: scored.slice(1, 4).map((entry) => entry.premise),
  };
}

export function getPremiseById(id: string): Premise | undefined {
  return PREMISE_BANK.find((premise) => premise.id === id);
}
