import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type CharacterRecord = Record<string, unknown> & {
  id: string;
  name: string;
  dominantPersonality?: string;
  secondaryTraits?: string[];
  physical_description?: string;
  visualProfile?: { description?: string };
};

type Enrichment = {
  backstory: string;
  profession_tags: string[];
  age_category: "child" | "teenager" | "young_adult" | "adult" | "elder" | "ageless" | "any";
  gender: "male" | "female" | "neutral" | "any";
  species_category: "human" | "humanoid" | "animal" | "magical_creature" | "mythical" | "elemental" | "any";
  size_category: "tiny" | "small" | "medium" | "large" | "giant" | "any";
  social_class: "royalty" | "nobility" | "merchant" | "craftsman" | "commoner" | "outcast" | "any";
  physical_description?: string;
};

const sourcePath = resolve("Logs/talea-characters-2026-04-27T11-17-53-120Z.json");
const outputPath = resolve("Logs/talea-characters-2026-07-15-enterprise-enriched.json");

const enrichments: Record<string, Enrichment> = {
  "f2ac946c-f313-4b30-aaf6-c095959871ba": {
    backstory: "Nova wuchs neben einem kleinen Observatorium auf und schlief am liebsten unter selbst gemalten Sternkarten ein. Als sie eines Nachts ein schwaches Notsignal auffing, lernte sie, dass Entdecken mehr bedeutet als als Erste anzukommen: Man muss auch für andere zurückkehren. Seitdem führt sie ein Logbuch über unbekannte Orte, mutige Entscheidungen und jedes Versprechen, das sie ihrer Crew gibt.",
    profession_tags: ["astronaut", "pilot", "researcher", "explorer"], age_category: "young_adult", gender: "female", species_category: "human", size_category: "medium", social_class: "commoner",
  },
  "6361b9fb-b86e-4aa8-aa27-0f901b5a4f18": {
    backstory: "Bruno erbte eine winzige Backstube, in der der Ofen schief und das erste Brot steinhart war. Statt aufzugeben, fragte er jeden Gast nach einer Erinnerung, die nach Zuhause duftete, und entwickelte daraus seine berühmten Trostbrötchen. Hinter seiner Fröhlichkeit steckt die Sorge, dass jemand hungrig oder unbemerkt bleiben könnte.",
    profession_tags: ["baker", "merchant", "craftsman", "cook"], age_category: "adult", gender: "male", species_category: "human", size_category: "large", social_class: "craftsman",
  },
  "b1a2c001-1111-4b01-8001-000000000011": {
    backstory: "Brenno zerbrach als Kind eine kostbare Schale und wartete vergeblich darauf, dass jemand sie mit ihm reparierte. Aus Scham wurde Trotz: Wenn alles kaputt blieb, musste niemand sehen, wie sehr er selbst sich nach Heilung sehnte. Goldene Nähte in seinem Porzellangesicht erinnern daran, dass geduldige Reparatur möglich ist, auch wenn Brenno das noch nicht glauben kann.",
    profession_tags: ["breaker", "saboteur", "outcast"], age_category: "teenager", gender: "male", species_category: "humanoid", size_category: "medium", social_class: "outcast",
    physical_description: "Junge mit einem Gesicht wie rissiges Porzellan, dessen Bruchlinien von feinen goldenen Nähten durchzogen sind. Er trägt einen zu großen dunklen Mantel und hält eine Hand oft auffällig geöffnet.",
  },
  "b1a2c001-1111-4b01-8001-000000000001": {
    backstory: "Der Geräusche-Fresser lebte lange in einer Welt ohne Klang. Als er endlich hören konnte, wollte er jedes Lachen, Lied und Klirren für sich bewahren und begann, Geräusche in seinem Sack zu sammeln. Doch je voller der Sack wird, desto weniger kann er unterscheiden, welches Geräusch ihm wirklich etwas bedeutet.",
    profession_tags: ["sound_collector", "thief", "outcast"], age_category: "ageless", gender: "neutral", species_category: "magical_creature", size_category: "small", social_class: "outcast",
    physical_description: "Kleine graue Kreatur mit trichterförmigen Ohren, rundem Bauch und einem geflickten Sack voller schimmernder Geräuschblasen am Gürtel.",
  },
  "b1a2c001-1111-4b01-8001-000000000013": {
    backstory: "Als Kind hörte der Leiser-Mann immer wieder, seine Stimme sei zu laut und seine Ideen seien störend. Er machte sich selbst so still, bis selbst seine Schritte verschwanden. Heute legt er Filz über alles Lebendige, weil ihn fremde Stimmen an die eigene verlorene Stimme erinnern.",
    profession_tags: ["silencer", "censor", "outcast"], age_category: "adult", gender: "male", species_category: "human", size_category: "medium", social_class: "outcast",
    physical_description: "Dürre, blasse Gestalt mit einem Finger vor den Lippen und mehreren Mänteln aus dickem grauem Filz, die selbst seine Schritte verschlucken.",
  },
  "b1a2c001-1111-4b01-8001-000000000015": {
    backstory: "Der Letzte Wehmüter bewachte einst einen Festplatz, auf dem jedes Jahr Musik, Wimpel und Geschichten zusammenkamen. Als die anderen fortzogen, blieb er zurück und hielt jede Erinnerung fest, aus Angst, sie könnte beim Weitergehen verschwinden. Seine größte Sehnsucht ist nicht, dass alles bleibt, sondern dass jemand das Vergangene mit in die Zukunft nimmt.",
    profession_tags: ["keeper", "historian", "guardian", "outcast"], age_category: "elder", gender: "male", species_category: "human", size_category: "large", social_class: "outcast",
    physical_description: "Großer breitschultriger Mann in einem Mantel aus Herbstlaub und verblichenen Wimpeln. An seinem Gürtel hängen kleine Erinnerungsstücke vergangener Feste.",
  },
  "b1a2c001-1111-4b01-8001-000000000006": {
    backstory: "Der Mutlosmacher hatte früher selbst hundert Pläne, doch nach mehreren Enttäuschungen faltete er sie zu Flicken für seinen Mantel. Nun redet er anderen jeden Anfang aus und nennt das Fürsorge. Heimlich beobachtet er Menschen, die trotz Angst einen kleinen ersten Schritt wagen, weil ein Teil von ihm noch immer wissen möchte, wie sich Hoffnung anfühlt.",
    profession_tags: ["dream_dampener", "tempter", "outcast"], age_category: "adult", gender: "male", species_category: "humanoid", size_category: "medium", social_class: "outcast",
    physical_description: "Krumme, freundlich wirkende Gestalt mit hängenden Schultern und einem Mantel aus zusammengeflickten, eingerissenen Traum-Papieren.",
  },
  "b1a2c001-1111-4b01-8001-000000000004": {
    backstory: "Der Zu-Ordentliche lernte früh, dass jeder Klecks und jedes schiefe Bild Ärger brachte. Also machte er aus Ordnung eine Rüstung und aus Regeln ein Lineal für die ganze Welt. Insgeheim faszinieren ihn Dinge, die unperfekt sind und trotzdem geliebt werden, auch wenn er sofort nach seinem Staubtuch greift.",
    profession_tags: ["inspector", "organizer", "controller"], age_category: "adult", gender: "male", species_category: "human", size_category: "medium", social_class: "commoner",
    physical_description: "Dürrer Mann in makellosem beigem Anzug, mit strengem Seitenscheitel, weißen Handschuhen und einem kleinen Staubtuch in der Hand.",
  },
  "3c457260-8851-4d95-ba26-31915eb24bef": {
    backstory: "Schnüffel löste seinen ersten Fall, als im Viertel alle denselben stillen Jungen für einen verschwundenen Kuchen verantwortlich machten. Ein einziger Zimtkrümel führte zum wahren Dieb und zeigte ihm, wie gefährlich vorschnelle Urteile sind. Seither sammelt er nicht nur Spuren, sondern auch die Geschichten hinter ihnen.",
    profession_tags: ["detective", "investigator", "mediator"], age_category: "adult", gender: "male", species_category: "human", size_category: "medium", social_class: "commoner",
  },
  "b1a2c001-1111-4b01-8001-000000000005": {
    backstory: "Klotilde wurde früher nur dann gelobt, wenn sie eine Antwort wusste. Aus Wissensfreude wuchs die Angst, ohne kluge Worte unsichtbar zu sein, und aus dieser Angst ihr ständiges Verbessern. In ihrem Buch bewahrt sie eine leere Seite auf, die sie an all das erinnert, was auch sie noch fragen darf.",
    profession_tags: ["scholar", "teacher", "critic"], age_category: "adult", gender: "female", species_category: "human", size_category: "medium", social_class: "commoner",
    physical_description: "Strenge Frau mit hoher Frisur, Brille auf der Nasenspitze und einem stets aufgeschlagenen, mit Notizzetteln gefüllten Buch unter dem Arm.",
  },
  "b1a2c001-1111-4b01-8001-000000000002": {
    backstory: "Die Stundendiebin besteht aus den Minuten, die andere achtlos verstreichen lassen. Anfangs sammelte sie nur verlorene Augenblicke, doch die Angst vor dem eigenen Verschwinden machte sie gierig nach fremder Zeit. Besonders Abschiede bringen ihre innere Uhr durcheinander, weil sie spürt, dass manche Minuten kostbar sind, gerade weil sie enden.",
    profession_tags: ["time_thief", "collector", "magical_outcast"], age_category: "ageless", gender: "female", species_category: "magical_creature", size_category: "medium", social_class: "outcast",
    physical_description: "Dürre blasse Gestalt in einem Mantel aus abgelaufenen Kalenderblättern, mit Taschen voller klickender Uhren und einem feinen Zifferblatt über dem Herzen.",
  },
  "7ae55808-ab5c-484b-a792-76030a875932": {
    backstory: "Fauchi schämte sich lange dafür, dass sein Feuer bei jeder starken Emotion losprustete. Erst als seine Funken in einer kalten Nacht ein verirrtes Tier wärmten, verstand er, dass Temperament auch Schutz bedeuten kann. Nun übt er, vor dem Fauchen zuzuhören, ohne seine feurige Natur zu verstecken.",
    profession_tags: ["dragon", "guardian", "firekeeper"], age_category: "teenager", gender: "male", species_category: "mythical", size_category: "large", social_class: "any",
  },
  "9b3f10d2-e380-4bbf-8541-76dad6e66356": {
    backstory: "Flitz wuchs in einer Baumkrone auf, die bei jedem Sturm neue Wege verlangte. Weil es kleiner war als die anderen Waldbewohner, baute es sich eine Werkzeugtasche und lernte, Schnelligkeit mit Einfallsreichtum zu verbinden. Hinter seinen Wortspielen steckt die leise Angst, nutzlos zu sein, sobald einmal niemand eine schnelle Lösung braucht.",
    profession_tags: ["scout", "inventor", "climber", "forest_helper"], age_category: "young_adult", gender: "neutral", species_category: "animal", size_category: "small", social_class: "commoner",
  },
  "a8fa1eda-4708-4ddd-bd6e-9bb00d5d6de4": {
    backstory: "Rosalie bekam ihren ersten Zauberstab zu früh und ließ aus Ungeduld einen ganzen Garten rückwärts blühen. Gemeinsam mit einer alten Gärtnerin setzte sie jede Pflanze behutsam wieder in ihren eigenen Rhythmus. Seitdem hilft sie besonders jenen, die im Verborgenen traurig sind, und weiß, dass gute Magie oft mit aufmerksamem Hinsehen beginnt.",
    profession_tags: ["fairy", "healer", "garden_helper", "magic_guide"], age_category: "young_adult", gender: "female", species_category: "magical_creature", size_category: "tiny", social_class: "any",
  },
  "232f86d7-87be-49a8-a34c-2e61cf28f791": {
    backstory: "Fanni wollte schon als Kind wissen, wo jede Tür hinführt und wie man im Notfall wieder hinauskommt. Bei ihrem ersten großen Einsatz merkte sie, dass ruhige Worte manchmal genauso wichtig sind wie Wasser. Heute trainiert sie ihr Team gründlich, erzählt aber auch Witze, damit Mut und Vorsicht nebeneinander Platz haben.",
    profession_tags: ["firefighter", "rescuer", "guardian", "team_leader"], age_category: "adult", gender: "female", species_category: "human", size_category: "medium", social_class: "commoner",
  },
  "b1a2c001-1111-4b01-8001-000000000009": {
    backstory: "Flora stand früher oft neben Gruppen, deren Geheimnisse sie nicht kannte. Statt um Freundschaft zu bitten, lernte sie, mit geflüsterten Versprechen Nähe zu erzwingen. Sie sehnt sich nach ehrlichem Vertrauen, fürchtet aber, dass niemand bleibt, wenn alle laut sagen dürfen, was sie wirklich denken.",
    profession_tags: ["secret_keeper", "gossip", "manipulator"], age_category: "adult", gender: "female", species_category: "human", size_category: "medium", social_class: "outcast",
    physical_description: "Zierliche Frau in einem schulterlosen dunklen Umhang, mit unnatürlich großen, stets leicht nach vorn geneigten Ohren und einem silbernen Schlüsselbund.",
  },
  "b1a2c001-1111-4b01-8001-000000000012": {
    backstory: "Frau Gleichgleich verlor einst in einem einzigen chaotischen Jahr ihr Zuhause, ihren Tagesplan und viele vertraute Dinge. Sie baute sich einen Alltag, in dem nichts überraschen durfte, und begann schließlich auch andere darin einzusperren. Eine kleine freundliche Veränderung kann sie neugierig machen, doch noch nennt sie dieses Gefühl Unordnung.",
    profession_tags: ["routine_keeper", "controller", "caretaker"], age_category: "adult", gender: "female", species_category: "human", size_category: "medium", social_class: "commoner",
    physical_description: "Hagere Frau in einem Kleid mit exakt wiederholtem Karomuster, streng symmetrischer Frisur und einem kleinen Tagesplan an einer Kette.",
  },
  "7dd5269b-fdda-4096-a55c-4c4677fb6eb1": {
    backstory: "Quak lebte an einem stillen Teich, bis eine lange Trockenzeit die Tiere gegeneinander aufbrachte. Mit Rhythmen auf Seerosenblättern brachte er alle dazu, gemeinsam nach Wasser zu suchen. Seitdem glaubt er, dass eine Gruppe leichter zusammenfindet, wenn jeder seinen eigenen Klang beitragen darf.",
    profession_tags: ["musician", "swamp_guide", "mediator", "animal_helper"], age_category: "young_adult", gender: "male", species_category: "animal", size_category: "small", social_class: "commoner",
  },
  "ae4893e0-f064-4559-bea2-89c5044f2c9b": {
    backstory: "Kräuterweis lernte ihre Kunst nicht aus einem Zauberbuch, sondern von Pflanzen, die sie nach einem fehlgeschlagenen Spruch wieder gesund pflegen musste. Sie misstraut schnellen Lösungen und prüft jede Zutat zweimal. Ihr trockener Spott verbirgt große Zuneigung zu allen, die sorgfältig lernen wollen.",
    profession_tags: ["witch", "herbalist", "healer", "scholar"], age_category: "elder", gender: "female", species_category: "human", size_category: "medium", social_class: "outcast",
  },
  "f30ea3db-46db-412f-9049-a7ab23447892": {
    backstory: "Blubbert fand seinen Muschelkompass als junger Matrose in einem Nebel, in dem die ganze Mannschaft die Orientierung verloren hatte. Der Kompass zeigt nicht nach Norden, sondern zu dem Ziel, das die Crew gemeinsam wählt. Deshalb liebt er Abenteuer, duldet aber keine Reise, bei der einer allein zurückbleibt.",
    profession_tags: ["captain", "sailor", "navigator", "explorer"], age_category: "adult", gender: "male", species_category: "human", size_category: "large", social_class: "commoner",
  },
  "143001e9-4e80-4fb7-b277-27d109ba27f9": {
    backstory: "Kicher arbeitete einst in einer Werkstatt, in der jedes Spielzeug genau nach Vorschrift aussehen musste. Eines Nachts baute er heimlich ein Spielzeug, das selbst neue Regeln erfand, und wurde dafür fortgeschickt. Seitdem testet er mit seinen Streichen, ob Regeln Menschen schützen oder nur ihre Fantasie einsperren.",
    profession_tags: ["trickster", "toymaker", "inventor", "saboteur"], age_category: "young_adult", gender: "male", species_category: "magical_creature", size_category: "small", social_class: "outcast",
  },
  "fe8da689-7dc9-4992-b6ea-ef625cc24b01": {
    backstory: "Karl erbte die Krone früher als erwartet und glaubte zunächst, ein König müsse jede Antwort allein kennen. Eine schlechte Entscheidung lehrte ihn, wie viel Mut es braucht, Rat anzunehmen. Seither bewahrt er im Thronsaal einen leeren Stuhl für die Stimme auf, die noch nicht gehört wurde.",
    profession_tags: ["king", "ruler", "mentor", "strategist"], age_category: "elder", gender: "male", species_category: "human", size_category: "medium", social_class: "royalty",
  },
  "b1a2c001-1111-4b01-8001-000000000007": {
    backstory: "Krummfinger besaß als Kind fast nichts und gewöhnte sich daran, jeden Fund sofort zu verstecken. Aus Vorsicht wurde Sammelwut, bis sein Rückregal schwerer war als er selbst. Geschenke verwirren ihn, denn sie beweisen, dass Wert nicht immer daraus entsteht, etwas festzuhalten.",
    profession_tags: ["collector", "thief", "scavenger", "outcast"], age_category: "adult", gender: "male", species_category: "magical_creature", size_category: "small", social_class: "outcast",
    physical_description: "Kleiner zitterig-schneller Kobold mit überlangen dünnen Fingern und einem hohen Rückregal voller Knöpfe, Münzen, Kristalle und anderer Kleinigkeiten.",
  },
  "a6cd9fbc-4a85-40c6-9c7f-819f49c230f0": {
    backstory: "Lämpel war als Schülerin so still, dass niemand bemerkte, wie viele Fragen sie hatte. Eine geduldige Lehrerin gab ihr ein Notizheft und feierte jede Frage mit einem kleinen Stern. Heute schafft Lämpel Räume, in denen Fehler als Hinweise gelten und auch die leiseste Idee Licht bekommen kann.",
    profession_tags: ["teacher", "mentor", "educator", "mediator"], age_category: "adult", gender: "female", species_category: "human", size_category: "medium", social_class: "commoner",
  },
  "dd6aa766-c863-45f1-84b1-dbe04e57b2c1": {
    backstory: "Mia fand als kleines Kind hinter einem Schrank eine Tür, die nur aufging, wenn man die richtige Frage stellte. Seitdem sammelt sie Karten, Geräusche und unbeantwortete Warum-Fragen. Sie ist mutig, doch ihre Neugier kann sie zu schnell voranstürmen lassen; lernen muss sie, dass Zuhören manchmal die spannendste Entdeckung ist.",
    profession_tags: ["explorer", "student", "mapmaker", "investigator"], age_category: "child", gender: "female", species_category: "human", size_category: "medium", social_class: "commoner",
  },
  "b1a2c001-1111-4b01-8001-000000000003": {
    backstory: "Morbus liebte einst Farben, Speisen und Menschen so heftig, dass jeder Verlust schmerzte. Um sich zu schützen, beschloss er, nichts mehr wichtig zu finden, und sein Umhang begann die Welt um ihn herum auszubleichen. Lieblingsdinge machen ihn wütend und neugierig zugleich, weil sie an das erinnern, was er aufgegeben hat.",
    profession_tags: ["color_drain", "tempter", "magical_outcast"], age_category: "ageless", gender: "male", species_category: "magical_creature", size_category: "medium", social_class: "outcast",
    physical_description: "Schlanke Gestalt mit hellen Augen und einem langen grauen Umhang, dessen Saum Farben aus dem Boden zieht und als blasse Fäden hinter sich herträgt.",
  },
  "b1a2c001-1111-4b01-8001-000000000014": {
    backstory: "Nick wuchs ohne Grenzen auf: Niemand sagte ihm, wann ein Spiel, ein Wunsch oder ein Risiko genug war. Er lernte, jeden nächsten Versuch charmant als letzten zu verkaufen, bis er selbst nicht mehr wusste, wie Aufhören geht. Klare Pläne und ein freundlich gemeintes Nein beeindrucken ihn mehr, als er zugibt.",
    profession_tags: ["gambler", "tempter", "trickster"], age_category: "young_adult", gender: "male", species_category: "human", size_category: "medium", social_class: "outcast",
    physical_description: "Junger Mann mit halboffener Weste, wachem Zwinkern im Auge und einer abgegriffenen Münze, die ständig über seine Fingerknöchel rollt.",
  },
  "2a560bb7-8250-47c6-9fa3-4fa1bc52d616": {
    backstory: "Oma Herzlich führte früher ein kleines Haus am Rand eines viel bereisten Weges. Wer sich an ihren Tisch setzte, bekam Tee, eine Geschichte und so viel Zeit, wie gerade nötig war. Seit das Haus stiller geworden ist, zieht sie los, um Geborgenheit dorthin zu bringen, wo niemand einen Platz für sie vorbereitet hat.",
    profession_tags: ["caregiver", "storyteller", "cook", "mentor"], age_category: "elder", gender: "female", species_category: "human", size_category: "medium", social_class: "commoner",
  },
  "51b9c213-11b0-4204-86cf-1a6387fa7b45": {
    backstory: "Peter wurde Polizist, nachdem ein Freund zu Unrecht beschuldigt worden war und niemand genau hingesehen hatte. Er liebt Regeln, wenn sie Menschen schützen, und stellt sie infrage, wenn sie nur bequem sind. Sein sekundengenaues Notizbuch hilft ihm ruhig zu bleiben, darf aber nie wichtiger werden als das, was ein Mensch erzählt.",
    profession_tags: ["police_officer", "guardian", "investigator", "mediator"], age_category: "adult", gender: "male", species_category: "human", size_category: "medium", social_class: "commoner",
  },
  "e30ab8f1-f874-4128-a8a2-c1c1a6b71922": {
    backstory: "Papierschiff begann als Bote in einem Küstenort, dessen Brücke bei jedem Sturm unpassierbar wurde. Er faltete den ersten wichtigen Brief zu einem Boot und lief am Ufer entlang, bis die Nachricht ihr Ziel fand. Seitdem glaubt er, dass Versprechen einen Weg verdienen, auch wenn der geplante Weg verschwunden ist.",
    profession_tags: ["postman", "messenger", "courier", "navigator"], age_category: "adult", gender: "male", species_category: "human", size_category: "medium", social_class: "commoner",
  },
  "1d94ce9b-f505-44f6-aa04-ac5f7ff699e4": {
    backstory: "Rotbart wurde in einer Bande groß, in der ein gegebenes Wort mehr galt als Gold. Als ein früherer Hauptmann die eigene Mannschaft verriet, übernahm Rotbart das Kommando und schrieb seinen strengen Ehrenkodex. Er jagt Schätzen nach, doch heimlich fürchtet er eine leere Beute weniger als den Verlust der Loyalität seiner Leute.",
    profession_tags: ["bandit_captain", "swordsman", "strategist", "outlaw"], age_category: "adult", gender: "male", species_category: "human", size_category: "large", social_class: "outcast",
  },
  "49a9b894-ecf3-41c3-af41-f2da415ab34d": {
    backstory: "Raubauke schloss sich Räubern an, weil ihr lautes Durcheinander sich zum ersten Mal wie eine Familie anfühlte. Er überspielt Unsicherheit mit Spott und springt lieber in ein Abenteuer, als lange über mögliche Fehler nachzudenken. Wenn jemand aus seiner Gruppe wirklich Hilfe braucht, zeigt sich eine Loyalität, die nicht zu seinem Ruf passen will.",
    profession_tags: ["bandit", "scout", "outlaw", "brawler"], age_category: "young_adult", gender: "male", species_category: "human", size_category: "medium", social_class: "outcast",
  },
  "3ee0a6b0-e175-428e-b3d0-983f2b5b4964": {
    backstory: "Rostfrei bekam seinen Namen nach einem Turnier, bei dem er trotz glänzender Rüstung vor Angst kaum vom Pferd stieg. Er gab den Fehler offen zu, half anschließend aber zu Fuß und rettete damit einen Knappen. Seitdem weiß er, dass Ehre nicht bedeutet, niemals Angst zu haben, sondern trotz Angst verlässlich zu handeln.",
    profession_tags: ["knight", "guardian", "swordsman", "rescuer"], age_category: "adult", gender: "male", species_category: "human", size_category: "medium", social_class: "nobility",
  },
  "b1a2c001-1111-4b01-8001-000000000008": {
    backstory: "Finn und sein bester Freund kannten früher jedes gemeinsame Versteck. Als ein neues Kind dazukam, glaubte Finn, ersetzt worden zu sein, und sein Schatten begann ein Eigenleben zu führen. Er stößt andere weg, bevor sie ihn verlassen können, achtet aber noch immer genau darauf, ob irgendwo ein Platz im Spiel frei bleibt.",
    profession_tags: ["shadow_walker", "rival", "outcast"], age_category: "child", gender: "male", species_category: "human", size_category: "medium", social_class: "outcast",
    physical_description: "Schmaler Junge mit dunklem Umhang und wachem, misstrauischem Blick. Sein auffallend dunkler Schatten bewegt sich stets eine halbe Sekunde später als er selbst.",
  },
  "4dd05b89-affe-49ce-b9d5-53cd0496bcee": {
    backstory: "Der Schwarzmagier nannte sich einst Meister Vardun und war ein begabter Hüter kleiner Lichtzauber. Als andere mehr Applaus bekamen, wandte er sich Schattenmagie zu und gab sich den Namen Morbus, um gefürchtet zu werden. Macht ist für ihn der Versuch, nie wieder übersehen zu werden; aufrichtiges Licht macht ihn deshalb besonders wütend.",
    profession_tags: ["dark_wizard", "sorcerer", "ruler", "strategist"], age_category: "adult", gender: "male", species_category: "human", size_category: "medium", social_class: "outcast",
  },
  "b1a2c001-1111-4b01-8001-000000000010": {
    backstory: "Tante Sorgenfalt verlor einst jemanden, nachdem sie eine Gefahr zu spät bemerkt hatte. Seitdem versucht sie, jedes Risiko vorherzusehen und jeden geliebten Menschen festzuhalten. Ihre Fürsorge ist echt, doch sie muss lernen, dass Schutz auch bedeutet, anderen einen eigenen mutigen Schritt zuzutrauen.",
    profession_tags: ["caretaker", "worrier", "guardian"], age_category: "adult", gender: "female", species_category: "human", size_category: "medium", social_class: "commoner",
    physical_description: "Rundliche Gestalt in drei verschieden gemusterten Umhängen übereinander, mit einem Taschentuch in der Hand und einer Tasche voller vorsorglicher Kleinigkeiten.",
  },
  "a3550fee-bb55-4acd-948d-398db9d51983": {
    backstory: "Grummel bewacht eine alte Steinbrücke, seit laute Reisende sein sorgfältig geordnetes Steinnest zerstörten. Er verlangt Ruhe und Respekt, bevor er jemanden passieren lässt. Wer seine glatten Steine nicht verspottet und ehrlich mit ihm spricht, entdeckt einen geduldigen Helfer mit erstaunlich sanften Händen.",
    profession_tags: ["bridge_guardian", "stoneworker", "troll", "guide"], age_category: "adult", gender: "male", species_category: "mythical", size_category: "large", social_class: "outcast",
  },
  "c44eeaee-a615-44de-8fd9-1565d609d7ae": {
    backstory: "Sternenschweif war ein junger Zauberer, der jeden Wunsch sofort erfüllen wollte. Ein unachtsamer Wunsch ließ einen Stern vom Himmel fallen, und er brauchte viele Jahre, um ihn zurückzubringen. Heute lehrt er, erst das eigene Gefühl zu verstehen und dann Magie zu wirken, denn jeder Zauber zieht eine Bahn durch mehr als ein Leben.",
    profession_tags: ["wizard", "mentor", "astronomer", "magic_guardian"], age_category: "elder", gender: "male", species_category: "human", size_category: "medium", social_class: "any",
  },
};

const raw = await readFile(sourcePath, "utf8");
const characters = JSON.parse(raw) as CharacterRecord[];

if (!Array.isArray(characters)) throw new Error("Expected the character export root to be an array.");
if (characters.length !== Object.keys(enrichments).length) {
  throw new Error(`Expected ${Object.keys(enrichments).length} characters, found ${characters.length}.`);
}

const enriched = characters.map((character) => {
  const enrichment = enrichments[character.id];
  if (!enrichment) throw new Error(`Missing enrichment for ${character.name} (${character.id}).`);

  const personalityKeywords = Array.from(new Set([
    character.dominantPersonality,
    ...(character.secondaryTraits ?? []),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0)));

  const physicalDescription = enrichment.physical_description ?? character.physical_description;
  const visualProfile = character.visualProfile && physicalDescription
    ? { ...character.visualProfile, description: physicalDescription }
    : character.visualProfile;

  return {
    ...character,
    ...enrichment,
    personality_keywords: personalityKeywords,
    physical_description: physicalDescription,
    visualProfile,
  };
});

await writeFile(outputPath, `${JSON.stringify(enriched, null, 2)}\n`, "utf8");
console.log(`Wrote ${enriched.length} enriched characters to ${outputPath}`);
