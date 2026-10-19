import type { StoryBrief } from "../storybook/context";
import type { AgeBand, LengthBudget } from "../storybook/craft";

export interface WonderPackage {
  id: string;
  title: string;
  genres: string[];
  ages: AgeBand[];
  premise: string;
  humor: string;
  spine: string[];
  protect: string[];
  adapt: string;
  sample: string;
  /** Social/performance conflicts suit gentler configurations; adventure requests need a wider consequence. */
  maxSuspense?: number;
}

/** Original editorial examples. These are proposed premises, not audience-tested successes. */
export const WONDER_PACKAGES: WonderPackage[] = [
  {
    id: "wonder:shadow-afternoon", title: "Heute geht der Schatten vor",
    maxSuspense: 1,
    genres: ["magic", "fairy_tales"], ages: ["6-8", "9-12"],
    premise: "Ein Schatten will beim Schattentheater endlich die Hauptrolle spielen. Sein Kind hat aber versprochen, bei der Aufführung den Drachen zu machen.",
    humor: "Der Schatten ist ein eitler Schauspieler; seine großen Gesten sehen an Alltagsgegenständen unfreiwillig komisch aus.",
    spine: ["Beim Zähneputzen verbeugt sich der Schatten statt mitzuputzen.", "Das Kind verspricht ihm eine Rolle, ohne mit dem anderen Avatar zu reden.", "Der Schatten spielt nun ALLE Rollen; das Stück gerät durcheinander.", "Der andere Avatar bemerkt, wie verschiedene Lichtabstände die Figuren verändern, und probiert es vor der Aufführung aus.", "Beide geben die eigene perfekte Rolle auf und inszenieren zusammen ein Stück, in dem der Schatten mitentscheiden darf."],
    protect: ["Lichtabstände vor dem Finale praktisch erproben.", "Fliegen oder Feuerlösen eines Avatars löst den Streit um die Aufführung nicht.", "Der Schatten kann auf Flächen spielen, aber keine Dinge tragen; kein spontaner Wechsel zur körperlichen Figur."],
    adapt: "Passt zu Figuren mit sehr unterschiedlichen Vorstellungen vom Auftreten. Anzahl der Rollen und Sprache an Alter anpassen. Bei rein realistischen Wünschen unpassend.",
    sample: `Als Jona die Zahnbürste hob, hob sein Schatten beide Arme. Dann verbeugte er sich.
„Du machst das falsch“, sagte Jona mit vollem Mund.
Der Schatten verbeugte sich noch tiefer.
„Das ist Zähneputzen. Niemand klatscht beim Zähneputzen.“
Vom Flur kam ein einzelnes Klatschen.
„Ich schon“, sagte Leni. „Wenn du endlich fertig bist.“
Der Schatten legte eine Hand aufs Herz. An der Wand sah es aus, als würde er einen sehr flachen Preis entgegennehmen.`,
  },
  {
    id: "wonder:thunder-laundry", title: "Bitte nicht schleudern!",
    maxSuspense: 1,
    genres: ["magic", "fairy_tales"], ages: ["3-5", "6-8", "9-12"],
    premise: "Eine kleine Gewitterwolke hat sich in einem Wäschekorb versteckt, weil sie ihr erstes Donnern nicht vor den großen Wolken üben will.",
    humor: "Eine Naturerscheinung mit Lampenfieber und sehr falschen Vorstellungen davon, was in einen Haushalt gehört; erst winzige, dann hörbare Donnerproben.",
    spine: ["Eine Socke regnet auf den Boden; darunter sitzt die Wolke.", "Die Kinder wollen ihr eine heimliche Probe ermöglichen und wählen dafür einen ungeeigneten Ort.", "Das Verstecken macht die Probe peinlicher, nicht sicherer. Einer der Avatare muss sein Versprechen korrigieren.", "Eine früh gezeigte, harmlose akustische Besonderheit ermöglicht eine gemeinsame Probe.", "Die Wolke traut sich hörbar zu werden, und die Kinder stehen bei ihr. Kein Zauber beseitigt rückwirkend das kleine Durcheinander."],
    protect: ["Keine Gewitter-Sicherheitsregel der realen Welt umkehren; dies ist eine fantastische Hauswolke.", "Die entscheidende akustische Entdeckung früh zeigen.", "Kein neues Instrument aus dem Nichts; die Kinder helfen, aber die Wolke donnert selbst."],
    adapt: "Für die Jüngsten bleibt der Donner leise und freiwillig. Nicht in eine Weltraum- oder Tiergeschichte drücken.",
    sample: `Im Wäschekorb saß etwas Graues, das nicht zu den Socken gehörte.
„Mama?“, rief Nora. „Die Wäsche hat Augen.“
„Dann soll sie beim Sortieren helfen.“
Das graue Etwas zog sich ein Handtuch über den Kopf.
„Ich bin nicht da“, sagte es.
Unter dem Korb entstand eine Pfütze.
„Du bist ziemlich viel da“, sagte Nora.`,
  },
  {
    id: "wonder:colour-rainbow", title: "Der Regenbogen passt hier nicht durch",
    genres: ["magic", "fairy_tales", "adventure"], ages: ["6-8", "9-12"],
    premise: "Ein verirrter Regenbogen sitzt quer in der Straße. Wenn man ihn vorwärts durch einen Gegenstand zieht, nimmt er dessen Farbe mit. Rückwärts gibt er genau diese Farbe zurück. Die Kinder wollen ihn nach Hause bringen und richten beim ersten Versuch ein gewaltiges Durcheinander an.",
    humor: "Ein überlanger, höflicher Gast bemüht sich, nicht aufzufallen, während erst ein Frühstück, dann ein Laden und schließlich ein ganzer Straßenzug blass werden. Ein kleiner farblicher Irrtum kehrt verändert wieder.",
    spine: ["Beim Frühstück wird der Marmeladenfleck plötzlich durchsichtig; am Fenster klemmt ein Stück Regenbogen.", "Die Kinder probieren die Vorwärts- und Rückwärtswirkung an einer harmlosen Sache aus.", "Ein ungeduldiger Transportversuch zieht den Regenbogen quer durch den vertrauten Ort. Die Folgen betreffen ein persönliches Vorhaben der Kinder.", "Ein Avatar hält an und rekonstruiert die tatsächliche Route, der andere übernimmt eine Aufgabe, die ihm zuvor lästig war.", "Sie führen den Regenbogen auf dem vorbereiteten Weg rückwärts zurück. Der Gast muss mithelfen, die Kinder geben den Takt an. Ein kleiner letzter Farbfehler wird zum gemeinsamen Witz."],
    protect: ["Die Farbrückgabe wurde vor dem großen Missgeschick gezeigt und funktioniert auch im Finale nur für vorher aufgenommene Farbe.", "Anhalten löst die Lage nicht: Die Kinder wollen den schon entstandenen Schaden wiedergutmachen.", "Kein Verkehrsunfall, keine unvorbereiteten Hilfsmittel, kein willkürliches Ende der Welt.", "Die Rückroute muss tatsächlich begehbar sein. Fliegen ist erlaubt, ersetzt aber das Rückführen durch die berührten Dinge nicht."],
    adapt: "Für Abenteuer in einer vertrauten oder fantastischen Welt. Ein Lernziel über echte Farben oder Wetter braucht ausdrücklich die Unterscheidung zwischen Zauber und Wirklichkeit.",
    sample: `„Ich stehe ein bisschen ungünstig“, sagte der Regenbogen.
Ben sah zur Straße. Das eine Ende steckte im Briefkasten. Das andere verschwand hinter der Bäckerei.
„Wo ist deine Mitte?“
„Im Gemüseladen. Ich versuche, nichts anzufassen.“
Aus dem Laden kam ein Schrei.
„DIE TOMATEN!“
Der Regenbogen wurde an einer Stelle sehr rot.
„Das“, sagte er leise, „war ein Versuch.“`,
  },
  {
    id: "wonder:robot-picnic", title: "Das Picknick wird ordentlich",
    genres: ["scifi"], ages: ["6-8", "9-12"],
    premise: "Ein Aufräumroboter räumt beim Picknick auf einer Raumstation schon auf, bevor jemand gegessen hat. Für ihn bedeutet ein voller Tisch: Aufgabe nicht erledigt.",
    humor: "Der Roboter arbeitet gewissenhaft gegen das Ziel der Kinder. Ein besonders ordentlich gelegtes Sandwich kehrt immer wieder an die falsche Stelle zurück.",
    spine: ["Das erste belegte Brot fährt gerade vor der Nase weg.", "Die Kinder verstecken Teller, wodurch der Roboter noch gründlicher sucht.", "Ihr eigener falscher Auftrag wird erkennbar; die Lebensmittel sind sicher im Sortierfach.", "Ein Avatar erinnert sich an eine beobachtete Kennzeichnung, der andere organisiert die Rückgabe als gemeinsame Aufgabe.", "Sie geben dem Roboter eine Aufgabe mit erkennbarem Ende; am Schluss räumt er freiwillig EINEN Krümel auf."],
    protect: ["Sortierfach, Bedienung und Stopptaste früh zeigen; falls Stoppen möglich ist, müssen die Kinder es versuchen.", "Keine Lebensgefahr oder neue Hackerfähigkeit nötig.", "Technische Regeln bleiben konsistent, echtes Lernwissen von erfundener Technik trennen."],
    adapt: "Auch mit fliegenden oder sehr starken Avataren plausibel: Das Missverständnis muss geklärt werden. Kein magischer Gast nötig.",
    sample: `„Guten Appetit“, sagte der Roboter und nahm den Tisch mit.
Miro hielt sein Messer in die Luft.
„Das war der Teil, auf dem unser Appetit lag.“
Der Roboter hielt an. Eine grüne Lampe blinkte.
„Tisch erfolgreich entfernt. Appetit nicht gefunden.“
„Der ist gerade gegangen“, sagte Ada.`,
  },
  {
    id: "wonder:forest-delivery", title: "Ein Paket mit Stacheln",
    genres: ["animals", "adventure"], ages: ["3-5", "6-8", "9-12"],
    premise: "Zwei Freunde sollen ein Picknickpaket zum Waldteich bringen. Ein verschlafener Igel rollt sich versehentlich in das ausgelegte Einwickeltuch.",
    humor: "Ein scheinbar widerspenstiges Paket mit einer völlig vernünftigen eigenen Meinung. Der Leser erkennt den Gast früh, die Helden etwas später.",
    spine: ["Beim Packen verschwindet ein Igel im Tuch; der Leser sieht ihn.", "Ein Avatar wickelt zu hastig, der andere bemerkt die Atembewegung.", "Sie öffnen das Paket früh genug; anschließend verhandeln sie den Transport, statt die Verwechslung künstlich zu strecken.", "Eine vorbereitete Wegschwierigkeit wird mit den unterschiedlichen Fähigkeiten aller Beteiligten gelöst.", "Am Teich bekommt der Igel einen eigenen Platz, das Essen ist tatsächlich angekommen."],
    protect: ["Kein gefangenes Tier als Witz; beim ersten Verdacht sofort vorsichtig öffnen.", "Bei menschlichen Avataren Wildtiere nicht füttern oder als Haustiere mitnehmen.", "Route und Transportmittel vor dem Hindernis zeigen."],
    adapt: "Für sprechende Tierwelten besonders passend. Bei realistischem Naturwissen ist das Tier stumm und die Lösung respektiert das.",
    sample: `Das Paket nieste.
„Das war das Brot“, sagte Fritzi.
„Brot niest nicht.“
„Unseres vielleicht schon. Papa hat sehr viel Pfeffer draufgemacht.“
Das Paket sagte: „Entschuldigung.“
Fritzi stellte es langsam ins Gras.
„Höfliches Brot“, flüsterte sie.`,
  },
  {
    id: "wonder:backwards-party", title: "Der Kuchen kommt zuerst",
    genres: ["modern", "adventure"], ages: ["3-5", "6-8", "9-12"],
    premise: "Ein Kind organisiert für seinen Freund ein Fest rückwärts: zuerst der Abschied, zuletzt die Begrüßung. Nur die Gäste kennen den Plan nicht.",
    humor: "Ein gut gemeinter Plan wird ernsthaft umgesetzt; Missverständnisse haben konkrete Folgen, bis die Kinder miteinander sprechen.",
    spine: ["Ein Gast bekommt an der Tür sein Abschiedstütchen und dreht wieder um.", "Der Organisator versucht noch konsequenter rückwärts zu feiern, der andere Avatar möchte lieber die Gäste behalten.", "Ein kleiner Streit zeigt, für wen das Fest eigentlich gedacht war.", "Die Kinder ändern gemeinsam den Ablauf, anstatt die Gäste zu belehren.", "Ein freiwilliger Rückwärtsbrauch bleibt als gemeinsamer Witz."],
    protect: ["Keine Magie in einer realistischen Konfiguration.", "Das beschenkte Kind darf eigene Wünsche haben.", "Die Lösung besteht aus einer sichtbaren Entscheidung und Handlung, nicht einer Moralrede."],
    adapt: "Eine bodenständige Alternative; Ort, Festanlass und Altersstufe lassen sich ändern, der Beziehungskonflikt bleibt.",
    sample: `„Schön, dass du da warst!“, sagte Toni.
Ben stand noch vor der Tür.
„War ich?“
Toni drückte ihm eine Tüte in die Hand.
„Für den Heimweg.“
Ben sah die Tüte an. Dann Toni. Dann die Straße.
„Das war ein schnelles Fest. Ich hatte mir extra die Schuhe angezogen.“`,
  },
  {
    id: "wonder:dragon-hiccups", title: "Hicks, Eure Majestät!",
    genres: ["fairy_tales", "magic", "adventure"], ages: ["6-8", "9-12"],
    premise: "Ein kleiner Drache soll beim Schlossfest die Lichter anzünden. Vor Aufregung bekommt er Schluckauf, und seine warmen Funken kommen immer zur falschen Zeit.",
    humor: "Der Drache möchte würdevoll wirken und braucht praktische Hilfe; ein übervorsichtiger Festhelfer schützt hartnäckig die falschen Dinge.",
    spine: ["Ein winziger Hicks toastet versehentlich ein vorbereitetes Brot.", "Die Helden versuchen die Aufregung zu verbergen und erschweren dadurch die Probe.", "Ein falscher Versuch misslingt sichtbar, ohne jemanden zu gefährden.", "Eine früh erprobte sichere Art, die Lichter heranzubringen, erlaubt dem Drachen sein eigenes Tempo.", "Die Avatare stellen den Ablauf um und der Drache vollendet selbst seine Aufgabe."],
    protect: ["Kein echtes Feuerexperiment zum Nachmachen; sichere fantastische Bühnenwelt.", "Magie und Anatomie eines Drachenavatars nicht willkürlich überschreiben.", "Ein einfacher Ersatz darf den sozialen Wunsch des Drachen nicht lösen."],
    adapt: "Falls ein Avatar selbst Drache ist, nicht automatisch dessen Fähigkeiten oder Ängste neu erfinden. Er kann der Helfer sein.",
    sample: `„Ich bin vollkommen ruhig“, sagte der Drache.
Hicks.
Das Brot auf dem Frühstückstisch wurde braun.
„Sehe ich“, sagte Fina und drehte ihre Scheibe um.
Der Drache presste die Lippen zusammen.
„Nur die andere Seite noch“, bat Fina.`,
  },
];

export function selectWonderPackages(brief: StoryBrief): WonderPackage[] {
  const eligible = WONDER_PACKAGES.filter(p => p.ages.includes(brief.band) && p.genres.includes(brief.config.genre || "magic") && (p.maxSuspense === undefined || (brief.config.suspenseLevel ?? 1) <= p.maxSuspense));
  const seed = [...brief.seed].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  const rotated = eligible.map((_, i) => eligible[(i + seed) % eligible.length]);
  return rotated.filter(p => !brief.recentEngineIds.includes(p.id)).slice(0, 2);
}

/** A short adventure has space for scenes, not just picture captions. */
export function wonderBudget(length: string | undefined, band: AgeBand): LengthBudget {
  const index = length === "short" ? 0 : length === "long" ? 2 : 1;
  const ranges = band === "3-5" ? [[350, 550], [600, 850], [900, 1200]]
    : band === "6-8" ? [[950, 1300], [1900, 2500], [2700, 3400]]
    : [[1200, 1600], [2300, 3000], [3400, 4300]];
  const [min, max] = ranges[index];
  const pages = band === "3-5" ? [3, 4, 5][index] : [4, 6, 7][index];
  return { pages, wordsPerPageMin: Math.floor(min / pages), wordsPerPageMax: Math.ceil(max / pages), totalWordsMin: min, totalWordsMax: max, maxCast: band === "3-5" ? 1 : 2, maxCharactersPerImage: 3 };
}
