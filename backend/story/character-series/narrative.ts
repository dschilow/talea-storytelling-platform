import { SERIES_PLAN_FILES, type SeriesEnsembleMember, type SeriesEpisodeBlueprint } from './episode-plans';

/** Editorial contract: stable cast, an earned arrival, and a world that generates adventures. */
export interface SeriesNarrative {
  promise: string;
  lead: string;
  voice: string;
  world: string;
  rules: string[];
  ensemble: Array<Pick<SeriesEnsembleMember, 'id' | 'name' | 'species' | 'nature' | 'look'> & Partial<SeriesEnsembleMember>>;
  origin: { before: string; arrival: string; encounter: string; trouble: string; choice: string; after: string };
  arcs: Array<{ question: string; possibilities: string[]; earnedChange: string }>;
  episodes?: SeriesEpisodeBlueprint[];
  seasonTitles?: { 1: string; 2: string };
}

export const SERIES_NARRATIVES: Record<string, SeriesNarrative> = {
  "nebelfee": {
    "promise": "Suchabenteuer am Waldsee: Eine kaum sichtbare Fee hilft bei verlorenen Dingen, falschen Verdächtigungen und kleinen unheimlichen Rätseln. Während jedes Abenteuer endet, sucht sie nach der Geschichte eines verlassenen Hauses und einem eigenen Zuhause.",
    "lead": "Die Nebelfee will anderen den Weg zurückgeben und ihren eigenen Heimweg finden. Sie deutet Hinweise zu schnell, gerade wenn sie ihr Hoffnung machen; sie ist aufmerksam, stolz auf ihre Arbeit und heimlich naschhaft.",
    "voice": "Leise, genau, mit trockenen Ausflüchten: Das war bestimmt der Wind. Sie kann sich ärgern und widersprechen; nicht in jedem Kapitel verschwinden oder entschuldigen.",
    "world": "Waldsee mit Uferweg, nahen Gärten und einem alten Fundhaus, der Wegwarte. Zwei verblasste Namen am Haus eröffnen die gemeinsame Suche. Oben am Hügel steht eine zweite Warte; der alte Nebelstieg verbindet beide. Neue Orte werden einzeln und erst bei Bedarf eingeführt.",
    "rules": [
      "Eine konkrete Angabe zum vermissten Ding oder Weg UND dessen letztem bekannten Ort lässt den nächsten Abschnitt einer Spur bis zu einer Kreuzung schimmern. Für den nächsten Abschnitt braucht es einen neuen Hinweis; keine Zielortung oder Gedankenleserei.",
      "Die Fee kann Dinge tragen; beim Verblassen setzt sie sie ab. Getragene Dinge bleiben sichtbar. Laute Geräusche oder Verlegenheit können ihre Kontur schwächen, nicht jede Schwierigkeit lösen.",
      "Von innen bleibt der gewöhnliche Ausgang der Wegwarte sichtbar, auch wenn der Nebel draußen aufzieht. Das Holzschild ist ein gewöhnlicher Gegenstand. Wünsche, Hüte und Lieder werden nicht plötzlich lebendig."
    ],
    "origin": {
      "before": "Die Fee kennt ihre Suchgabe, aber nicht mehr ihren eigenen früheren Heimweg. Das Fundhaus ist verlassen; sie hat die Kinder noch nicht getroffen.",
      "arrival": "Die Kinder sind mit ihrem Hund zum Picknick am Waldsee gekommen. Als er ins Schilf läuft, folgen sie seinen Lauten auf dem Uferweg und treffen auf einen scheinbar allein hüpfenden Stiefel.",
      "encounter": "Der Stiefel wird von der kaum sichtbaren Fee getragen. Die Kinder sprechen sie an, stellen sich vor und erklären die Hundesuche; erst danach versuchen sie gemeinsam eine Spur zu lesen.",
      "trouble": "Die Fee verspricht zu schnell einen Heimweg und folgt versehentlich einem Spielzeugstempel-Abdruck. Im Schilf winselt der echte Hund; sein letzter sicherer Ort muss geklärt werden.",
      "choice": "Die Fee fragt statt weiter zu behaupten. Die Kinder nennen den umgefallenen Picknickkorb und zeigen einen echten Pfotenabdruck; ihre Suchgabe lässt den nächsten Abschnitt des Landwegs schimmern.",
      "after": "Der Hund kommt zum Picknickplatz zurück. Beim Unterstellen entdecken sie die Wegwarte mit zwei verblassten Namen. Warum erinnert sich die Fee an dieses Haus?"
    },
    "arcs": [
      {
        "question": "Wem gehörte das Haus, das der Fee vertraut vorkommt?",
        "possibilities": [
          "Ein knurrender Postkorb hat eine natürliche Erklärung.",
          "Ein Kuscheltier braucht einen erkennbaren Besitzer, nicht den lautesten Anspruch.",
          "Eine unklare Einladung berührt die Angst der Fee, nicht gemeint zu sein."
        ],
        "earnedChange": "Bis Folge 5 arbeitet wieder ein Fundregal. Maren ist als ein Name bekannt; die Fee bittet erstmals um Hilfe bei ihrer eigenen Suche."
      },
      {
        "question": "Warum verließen Maren und Bela ihr gemeinsames Haus?",
        "possibilities": [
          "Ein Schattenmonster wird durch einen einfachen Lichttest verstanden.",
          "Ein falsch gestellter Pfeil verlangt ein öffentliches Eingeständnis.",
          "Ein privater Brief wird erst mit Erlaubnis zum Beleg."
        ],
        "earnedChange": "Folge 10 beantwortet die Betreiberfrage durch Belas vorbereitete Antwort: gemeinsamer Betrieb, späterer Umzug nach einem kaputten Höhenweg. Die Fee war Besucherin und erhält eine Einladung."
      },
      {
        "question": "Wie kommen wir gemeinsam zur oberen Warte?",
        "possibilities": [
          "Ein falscher Glockenruf behindert eine echte Überfahrt.",
          "Eine Dose verlangt Rückgabe statt neugieriges Öffnen.",
          "Ein Rabe muss nicht bestohlen werden, um einen Wegweiser zurückzubekommen."
        ],
        "earnedChange": "Bis Folge 15 sind kurze reale Wegabschnitte geprüft, Freunde gewonnen und das Glasdach der oberen Warte sichtbar. Keine Kette aus Rätselgegenständen."
      },
      {
        "question": "Wo möchte die Fee heute zu Hause sein?",
        "possibilities": [
          "Ein erhoffter Heimweg entpuppt sich als Spiegellicht.",
          "Eine gemeinsame Reise wartet auf ein ängstliches Kind.",
          "Ein Abschiedsgerücht verlangt eine klare persönliche Entscheidung."
        ],
        "earnedChange": "Folge 19 klärt die frühere Verbindung zu beiden Häusern; Folge 20 endet mit einem selbst gewählten Zuhause am See und einer gelebten Besuchsfreundschaft."
      }
    ],
    ensemble: SERIES_PLAN_FILES["nebelfee"].ensemble,
    episodes: SERIES_PLAN_FILES["nebelfee"].episodes,
    seasonTitles: SERIES_PLAN_FILES["nebelfee"].seasonTitles,
  },
  "funkelflug": {
    "promise": "Bergabenteuer mit einem Drachen, dessen Flügel nicht tragen und dessen große Ansagen oft zuerst landen. Rettungen, Rivalität und komische Irrtümer machen seine kleinen Bodenwege wertvoll. Aus einem Außenseiter wird ein Gastgeber, bei dem Kleine und Große wirklich mitmachen können.",
    "lead": "Funkelflug will als richtiger Drache ernst genommen werden. Er kann nicht fliegen und überspielt das mit großen Ansagen. Er kennt kleine Felsgänge, bemerkt Luftzüge und kann hartnäckig an einer Aufgabe bleiben. Seine Hilfsbereitschaft und sein Ruhmverlangen geraten aneinander.",
    "voice": "Begeistert, vollmundig und bei Gegenwind erfinderisch: Das war eine Zwischenlandung. Er kann trocken nachlegen und auch einmal recht haben. Kein zwanghafter Reim nach jeder Handlung.",
    "world": "Ein bewohnter Drachenberg mit Bodenwegen, großen Landeplätzen und einer verlassenen Wegewarte. Neben der kleinen Höhle hängt eine seit Jahren stumme gewöhnliche Glocke mit einer einfachen Zugschnur. Wer die Warte noch benutzt und welche Wege sie verbindet, wird erst durch die jeweiligen Abenteuer bekannt.",
    "rules": [
      "Funkelflugs Flügel tragen ihn nicht. Sprünge bleiben Sprünge; eine Rettung verleiht ihm keine plötzliche Flugkraft. Sein kleiner Körper erreicht Dinge, die große Drachen nicht erreichen.",
      "Beim Niesen können kleine Funken entstehen. Sie folgen seiner Nase, nicht seinem Wunsch. Es gibt kein absichtlich herbeigezaubertes Großfeuer.",
      "Wind, Echo und Glocke haben sichtbare räumliche Ursachen. Drei Schläge entstehen durch drei Züge an derselben einfachen Schnur, nicht durch drei zu sammelnde Maschinenteile. Ein ungeprüfter Weg wird nicht durch ein Signal sicher."
    ],
    "origin": {
      "before": "Funkelflug lebt neben der stillgelegten Wegewarte und übt seinen angeblichen Flugauftritt. Seine Flügel tragen ihn nicht; niemand muss ihm eine künstliche Mutprüfung stellen.",
      "arrival": "Die Kinder kommen über den Wanderweg zur Bergwiese, um dort ihren Papierdrachen steigen zu lassen. Eine vollmundige Flugankündigung hinter einem Felsen macht sie neugierig.",
      "encounter": "Sie sehen Funkelflugs Bauchlandung und seinen Versuch, sie als Besichtigung auszugeben. Beim Einsammeln des Papierdrachens nennen alle ihre Namen, bevor sie ein Fiepen hören.",
      "trouble": "Ein Igel steckt hinter einer leichten Holzplatte am niedrigen Felszugang. Funkelflug möchte vor den neuen Zuschauern noch als großer Flieger wirken; große Hände erreichen die Innenseite nicht.",
      "choice": "Er kriecht durch die kleine offene Lücke, während die Kinder den freien Rand beleuchten. Er schiebt die leichte Platte von innen zur Seite und befreit das Tier.",
      "after": "Der Igel läuft frei. Die sichtbare an der Platte liegende Glockenschnur bewegt sich: genau EIN Schlag. Der erste Dank gilt Funkelflugs wirklicher Stärke; warum wurde die Glocke festgelegt?"
    },
    "arcs": [
      {
        "question": "Kann ein Drache ohne Flugkraft dazugehören?",
        "possibilities": [
          "Eine kleine Rettung gelingt gerade durch Funkelflugs Größe.",
          "Mucks will seinen Schlafplatz behalten.",
          "Der Treffpunkt braucht Platz für Omas großen Körper und ehrliche Angst vor seltsamen Geräuschen."
        ],
        "earnedChange": "Bis Folge 5 ist die Glockenfunktion bekannt, Mucks Einwand verstanden und ein möglicher Bodenweg entdeckt. Funkelflug wird für konkrete Taten gebraucht."
      },
      {
        "question": "Kann die alte Warte einen Weg für alle eröffnen?",
        "possibilities": [
          "Eine verlorene Wette verlangt keinen gefährlichen Sprung.",
          "Eine Flugkarte hilft Fußgängern nicht.",
          "Ein angekündigter Durchgang braucht die Zustimmung seines Nachbarn."
        ],
        "earnedChange": "Folge 10 erfüllt das Ziel: Die erste Gruppe geht den geprüften Bodenweg; drei Glockenschläge melden die tatsächliche Öffnung. Funkelflug wählt Verantwortung statt Auftritt."
      },
      {
        "question": "Wie kommen Kleine und Große zu einem gemeinsamen Winterfest?",
        "possibilities": [
          "Platz, faire Wettkämpfe und Vorräte erzeugen unterschiedliche Konflikte.",
          "Ein schöner Festplatz kann zu windig sein.",
          "Ein wackliges Brückenbrett verlangt einen Umweg und fachkundige Reparatur statt Heldentum."
        ],
        "earnedChange": "Bis Folge 15 stehen ein geschützter Festplatz und die geprüfte Brücke zur Verfügung. Die Gruppe hat sichtbare faire Absprachen getroffen."
      },
      {
        "question": "Darf Funkelflugs eigene Idee genauso viel zählen wie Flugkunst?",
        "possibilities": [
          "Ein Nachmacher braucht ein ehrliches Vorbild.",
          "Neue Spiele brauchen eigene Zustimmung, nicht alte Wegrechte.",
          "Wetter und eine einseitige Jury verlangen Änderungen am Fest."
        ],
        "earnedChange": "Folge 20 lässt das vorbereitete Bodenfest wirklich stattfinden, auch für große Drachen. Funkelflug bleibt flugunfähig, aber seine Idee ist ein fester Teil des Berglebens."
      }
    ],
    ensemble: SERIES_PLAN_FILES["funkelflug"].ensemble,
    episodes: SERIES_PLAN_FILES["funkelflug"].episodes,
    seasonTitles: SERIES_PLAN_FILES["funkelflug"].seasonTitles,
  },
  "graf-griesgram": {
    "promise": "Eine turbulente Haus- und Nachbarschaftskomödie: Der Graf will Gesellschaft, aber am liebsten nach lauter unmöglichen Regeln. Die Kinder widersprechen ihm mit eigenen Wünschen. Ein leerer Kinderplatz und ein alter Streit entwickeln sich zu einem gemeinsamen Mittwochstisch und einem fairen Dorfturnier.",
    "lead": "Der Graf wünscht sich Gesellschaft und fürchtet, dabei die Kontrolle zu verlieren. Er kann hervorragend beobachten, backt heimlich und erinnert sich präzise. Seine selbst geschaffenen Ausnahmen machen seine Regeln immer unbrauchbarer.",
    "voice": "Förmlich, knapp, mit übergenauen Ausnahmen und trockenem Stolz. Er sagt Besuch ab, während er Tassen hinstellt. Kein belehrender Erwachsener, der in jeder Folge dieselbe Einsamkeit überwindet.",
    "world": "Ein gewöhnliches großes Haus mit Garten am Dorf. Früher traf sich dort eine Runde aus Nachbarn; zwölf alte Stühle und ein Kinderplatz erinnern daran. Warum die Runde endete, erschließt sich erst aus den einzelnen Abenteuern. Briefe, Bilder und Beteiligte liefern begrenzte Belege, keine Geheimfach-Schnitzeljagd.",
    "rules": [
      "Menschen verursachen die Verwicklungen. Keine magische Tür und keine Zufallserbschaft löst einen Konflikt.",
      "Auch Angestellte haben freie Tage und eigene Vorhaben. Der Graf muss selbst handeln. Alte Briefe geben Belege, keine allwissenden Antworten.",
      "Einmal begründete Einladungen und Freundschaften bleiben wahr. Der Graf darf grummelig bleiben, ohne nach jeder Folge wieder ganz allein zu sein."
    ],
    "origin": {
      "before": "Der Graf lebt zurückgezogen mit strenger Hausordnung. Der Mittwochstisch ist geschlossen, die alte Runde zerstritten. Seine Regeln schützen vor Unordnung und verhindern zugleich den Besuch, den er gern hätte.",
      "arrival": "Die Kinder lassen auf der Dorfwiese ihren selbst gebauten Papierdrachen steigen. Als er im benachbarten Garten landet, gehen sie zum Tor des Grafen und klingeln, um ihn zurückzuholen.",
      "encounter": "Der Graf erscheint mit einer umständlichen Fluggeräte-Regel. Die Kinder nennen sich und erklären, dass der Drache ihnen gehört; er stellt sich als Besitzer des Gartens vor.",
      "trouble": "Der Drache hängt am niedrigen Rosenbogen und beginnt zu reißen. Der Graf besteht auf seiner gerade erfundenen Erlaubnis, während der Wind seine eigenen Papiere verteilt.",
      "choice": "Er gibt den Kindern Zugang und hält den erreichbaren Ast zurück. Sie lösen die Schnur und retten den Drachen; der Graf ersetzt sein Verbot durch eine einfache Bitte.",
      "after": "Er lädt sie tatsächlich zum Kakao ein. Beim Holen eines Stuhls wird der leere dreizehnte Kinderplatz sichtbar. Das neue Treffen beginnt; der alte Streit ist noch nicht gelöst."
    },
    "arcs": [
      {
        "question": "Kann aus einer Ausnahme ein echter Besuch werden?",
        "possibilities": [
          "Johanns freier Tag bleibt frei.",
          "Ein missglücktes Gespensterspiel muss die Angst der Kinder ernst nehmen.",
          "Adas Eigentum und ein müdes Kind sind wichtiger als die neue Regel."
        ],
        "earnedChange": "Bis Folge 5 sitzt wieder ein Kind am Mittwochstisch. Ada kehrt für eine Runde zurück; der goldene Apfel wird als Holz-Spielpreis eingeordnet."
      },
      {
        "question": "Was beendete die frühere Freundschaft?",
        "possibilities": [
          "Krümelangst und eine fehlgeleitete Einladung belasten heutige Besuche.",
          "Ein vorschneller Keksverdacht macht die alte Beschuldigung überprüfbar.",
          "Der vorbereitete Spielkorb widerlegt den vermeintlichen Diebstahl."
        ],
        "earnedChange": "Folge 9 beantwortet den Apfelstreit, Folge 10 zeigt die erneuerte große Runde. Der Graf entschuldigt sich; Ada entscheidet selbst über den neuen Anfang."
      },
      {
        "question": "Kann der Graf auch bei anderen und gegen andere mitspielen?",
        "possibilities": [
          "Als Gast muss er selbst eine Hausregel akzeptieren.",
          "Eine echte Einladung braucht keine Verbotsliste.",
          "Gleiche Zeit und unveränderte Regeln gelten auch, wenn Johann gewinnt."
        ],
        "earnedChange": "Bis Folge 15 sind echte Teilnehmer und faire Grundregeln vereinbart. Johann wird als gleichwertiger Mitspieler anerkannt."
      },
      {
        "question": "Halten die gemeinsamen Regeln auch unter Druck?",
        "possibilities": [
          "Eine peinliche Geschichte braucht Zustimmung.",
          "Lärm und Ruhe werden räumlich verabredet.",
          "Ein Gleichstand prüft die vorher vereinbarte Regel im öffentlichen Finale."
        ],
        "earnedChange": "Das Turnier endet in Folge 19. Folge 20 zeigt eine eigenständig geleitete Kinderstunde und eine gemeinsam veränderbare Hausordnung; der Graf bleibt grummelig und verbunden."
      }
    ],
    ensemble: SERIES_PLAN_FILES["graf-griesgram"].ensemble,
    episodes: SERIES_PLAN_FILES["graf-griesgram"].episodes,
    seasonTitles: SERIES_PLAN_FILES["graf-griesgram"].seasonTitles,
  },
  "kapitaen-blubbert": {
    "promise": "Komische Küstenabenteuer: Ein Seehund auf dem Kapitänssitz, ein vermeintliches Seeungeheuer und eine Insel, die absichtlich auf keiner Karte steht. Blubbert möchte als großer Entdecker gelten und lernt, dass eine gute Mannschaft und ein geschützter Ort wichtiger sein können. Später sucht die Crew Pias frühere Lehrmeisterin auf der Sternschnuppe.",
    "lead": "Blubbert will als Entdecker gelten und niemanden zurücklassen. Er ist ein guter Seemann, aber hört Einwände zu spät. Ein Avatar kann sich irren, während Blubberts Erfahrung die Gruppe weiterbringt.",
    "voice": "Seemännisch, bildhaft, kurze große Ansagen. Einen hervorragenden Einfall der anderen nennt er gern eine Idee des Kapitäns. Der Gag wird später gegen ihn gewendet.",
    "world": "Ein übersichtlicher Küstenhafen und das kleine Segelboot Seegras. Die erste Fahrt bleibt nah am Hafen; die erfahrene Bootsbauerin Pia begleitet sie. Ein Steintor auf einem alten Ortsplättchen passt zu keiner aktuellen Karte; die Erklärung folgt erst aus den vorgesehenen Entdeckungen. Neue Ziele werden nacheinander gezeigt, nicht als Navigationsinventar aufgezählt.",
    "rules": [
      "Der Muschelkompass zeigt nur zu einem hinreichend bekannten Ort, den die Reisenden mit einer echten Ortsangabe benennen können. Eine Insel aus einer vagen Geschichte reicht nicht.",
      "Die Anwesenden legen gemeinsam ein Ortsplättchen in die Muschelschale und richten sie offen aus. Das ist eine sichtbare gemeinsame Handlung, kein Gedanken- oder Lügendetektor.",
      "Der Kompass zeigt eine Richtung, keine sichere Route, kein Wetter und keine Gegenstände. Karten, Strömung und Erfahrung bleiben nötig. Die Crew kann ihr Ziel gemeinsam ändern."
    ],
    "origin": {
      "before": "Blubbert bereitet seine erste verantwortliche Fahrt als Kapitän vor. Pia ist als erfahrene Bootsbauerin dabei. Die Avatare, der Kompass und die gemeinsame Suchfrage sind noch nicht eingeführt.",
      "arrival": "Die Kinder kommen über den Hafensteg, weil sie das kleine Segelboot ansehen wollen. Ein bellender Hund und Blubberts empörte Ansprache machen sie auf einen Seehund auf dem Kapitänssitz aufmerksam.",
      "encounter": "Blubbert erklärt dem Tier seine Sitzordnung, Pia erklärt den Kindern die Lage. Erst stellen sich alle vor und vereinbaren die Mitfahrt; die Kinder sind keine schon eingespielte Mannschaft.",
      "trouble": "Der Seehund flüchtete vom niedrigen Steg vor einem Hund aufs Boot und wagt sich nicht zurück. Pia lässt den Hund früh außer Sicht bringen; das erschrockene Tier bleibt dennoch auf dem Boot. Die Kinder hören die Mutter aus der nahen Bucht und schlagen diese Fahrt vor, bevor Blubbert seinen Vorführplan aufgibt.",
      "choice": "Die Crew schafft Abstand zum Hund. Blubbert ändert sein Ziel zur bekannten ruhigen Bucht, Pia hilft beim Boot; die Kinder beobachten und halten Abstand zum Tier.",
      "after": "Am niedrigen Strandsteg geht der Seehund selbst ins Wasser zu seiner Mutter. Bei der Kartensuche wird ein Muschelkompass mit einem alten Steintor-Plättchen gefunden. Pia kennt das Tor aus einem Bild; warum fehlt es heute auf der Karte?"
    },
    "arcs": [
      {
        "question": "Ist das Steintor ein wirklicher Ort?",
        "possibilities": [
          "Ein Tier braucht Abstand statt einen Kapitänsbefehl.",
          "Ein vermeintliches Monster hat eine sichtbare Ursache.",
          "Piratenverdacht und eine schrumpfende Sandbank prüfen Blubberts schnelle Deutungen."
        ],
        "earnedChange": "Bis Folge 5 heißt die Insel Scherensand. Ein Foto verbindet das Tor mit Ruheplätzen für Seehunde; der Grund ihres Fehlens bleibt noch offen."
      },
      {
        "question": "Warum soll niemand die Insel finden?",
        "possibilities": [
          "Ein losgetriebenes leeres Boot verlangt Verantwortung statt Festrede.",
          "Kallis Geisterschiff führt zu echtem Nachfragen.",
          "Ein Kartograf verlangt Schutz und Blubbert verzichtet auf das Entdeckerrennen."
        ],
        "earnedChange": "Folge 8 erklärt den Schutzgrund. Folge 10 zeigt den erlaubten Besuch und eine echte kleine Befreiung hinter dem Tor; ein Bild eröffnet erst danach Pias Suche."
      },
      {
        "question": "Wo ist die Sternschnuppe und will Pia ihre Lehrmeisterin wiedersehen?",
        "possibilities": [
          "Ein Schiffsname ist kein eindeutiger Beleg.",
          "Ein vermeintlicher Schatz gehört zu einem gewöhnlichen Fernglas.",
          "Eine Nachricht gibt der gesuchten Person und Pia eine eigene Entscheidung."
        ],
        "earnedChange": "Folge 15 findet die Sternschnuppe als bewohnte Station. Die Lehrmeisterin hat auf die Nachricht geantwortet; das persönliche Wiedersehen ist verabredet."
      },
      {
        "question": "Wie wird aus der Suche eine verlässliche Zusammenarbeit?",
        "possibilities": [
          "Pia und ihre Lehrmeisterin sprechen den alten Streit selbst an.",
          "Klare Zeichen und geteilte Beobachtungsaufgaben machen die Küstenrunde möglich.",
          "Fremdes Gepäck wird zurückgegeben; Windstille verlangt einen kleineren Plan."
        ],
        "earnedChange": "Folge 20 zeigt die gelungene gemeinsame Küstenrunde und Blubberts ehrliche Anerkennung aller Beiträge. Eine reale Einladung öffnet den Ausblick zu den Bernstein-Schären."
      }
    ],
    ensemble: SERIES_PLAN_FILES["kapitaen-blubbert"].ensemble,
    episodes: SERIES_PLAN_FILES["kapitaen-blubbert"].episodes,
    seasonTitles: SERIES_PLAN_FILES["kapitaen-blubbert"].seasonTitles,
  },
  "tilda-tueftel": {
    "promise": "Werkstattkomödien mit einer Erfinderin, deren großartige Vorführungen oft an ganz gewöhnlichen Wünschen vorbeigehen. Ein verschluckter Teddy, eine unmögliche Burg und eine vorlaute Gans verlangen Einfallsreichtum und echte Entscheidungen. Aus Arturs altem Bilder-Spielwerk wächst eine eigene gemeinsame Erfinderschau.",
    "lead": "Tilda ist erfinderisch, ehrgeizig und liebt ihre unscheinbare Lieblingsklammer. Sie möchte beeindrucken und muss manchmal ihre schönste Idee verändern, wenn sie an den wirklichen Wünschen anderer vorbeigeht. Sie kann zuhören lernen, ohne ihre Neugier und ihren eigenen Willen zu verlieren.",
    "voice": "Schnelle genaue Wörter für Dinge, begeistert beim Vorführen, trocken beleidigt bei unvernünftiger Nutzung. Sie hört zu, darf widersprechen und braucht keine Lehrsatzrede.",
    "world": "Eine Dorfwerkstatt mit Ideenfenster, flachem Hof und Schuppen. Erfindungen haben sichtbare einfache Funktionen statt verschachtelter Mechanik. Im Schuppen steht ein staubiger Kasten mit einer kleinen Öffnung und Arturs Handschrift; sein Zweck wird erst in den vorgesehenen Abenteuern erschlossen. Das Ideenfenster öffnet sich nach der ersten Begegnung.",
    "rules": [
      "Erfindungen folgen sichtbarer Mechanik, Material und Nutzung. Keine Universalmaschine, keine heimlich magische Batterie.",
      "Ein Test hat erkennbare Bedingungen; Fehler verändern die Lage. Ein Erwachsener übernimmt gefährliche Handgriffe, nicht die ganze Problemlösung.",
      "Erfolgreiche Entwürfe und Erfahrungen bleiben erhalten. Neue Wünsche erzeugen neue Konflikte statt dieselbe Nachfragelektion zu wiederholen."
    ],
    "origin": {
      "before": "Tilda tüftelt allein hinter dem geschlossenen Fenster. Sie möchte mit einer Aufräummaschine beeindrucken und hat noch keine gemeinsame Ideenwerkstatt. Ihre einfache Lieblingsklammer ist nur ein nützliches Werkzeug.",
      "arrival": "Die Kinder gehen vom Dorfplatz zu Tildas Werkstatt, weil die Naht ihres geliebten Teddys locker ist. Sie wollen ihn reparieren lassen und treffen Tilda beim Ausprobieren der Maschine.",
      "encounter": "Tilda begrüßt die unbekannten Kinder, stellt sich und ihr Gerät vor. Die Kinder nennen ihre Namen und den Reparaturwunsch, bevor Tilda zu ihrer Vorführung ansetzt.",
      "trouble": "Ein pedalbewegter Besen schiebt aus Versehen den Teddy in die Sammelkiste. Tildas rückwärtiger Versuch wirbelt Tücher umher, statt den Teddy aus der Ecke hinter der Schauseite zu holen.",
      "choice": "Tilda erkennt die abnehmbare Front schon beim ersten Rettungsversuch, wehrt sich zunächst aus Stolz gegen den sichtbaren Abbau und entscheidet sich schließlich dafür. Die Kinder entdecken das Band und bergen den Teddy. Danach reparieren sie gemeinsam die ursprüngliche lockere Naht, mit der Klammer als Stoffhalter.",
      "after": "Das Kind hat den Teddy heil zurück. Tilda öffnet das Ideenfenster für wirkliche Wünsche. Beim Wegräumen sehen sie Arturs staubigen Bühnenkasten und fragen, wofür er gedacht war."
    },
    "arcs": [
      {
        "question": "Was wollte Artur mit dem alten Bühnenkasten zeigen?",
        "possibilities": [
          "Ein geliebtes Spielzeug ist wichtiger als die Vorführfassade.",
          "Ein gemalter Knopf erklärt ein Missverständnis am neuen Fenster.",
          "Kleine und große Burgen sowie ein verdrängter Kinderauftritt zeigen verschiedene Wünsche."
        ],
        "earnedChange": "Bis Folge 5 belegt ein normales Foto eine gemeinsame Dorfaufführung. Tilda beginnt, den Kasten als Bühne statt als unbekannte Universalmaschine zu verstehen."
      },
      {
        "question": "Wer darf das alte Spielwerk heute zu Ende erfinden?",
        "possibilities": [
          "Kunos Lieblingsknopf bleibt sein Eigentum.",
          "Rostig verteidigt ihren gewöhnlichen Schlafplatz.",
          "Drei rückwärts gezeigte Bilder und ein gemeinsam gelerntes Lied erschließen das Werk."
        ],
        "earnedChange": "Folge 10 zeigt ein vollständiges Stück mit selbst gezeichnetem Ende. Arturs vorbereitete Bitte erklärt die leere Seite; daraus entsteht die eigene Erfinderschau."
      },
      {
        "question": "Wessen Ideen bekommen Platz auf unserer Schau?",
        "possibilities": [
          "Eine hängende Brotladung verlangt Rückgabe vor weiterer Vorführung.",
          "Kuno braucht sichtbare Anerkennung statt Arbeit im Hintergrund.",
          "Ein unlesbares Schild und ein umkämpfter Tisch verlangen Perspektivwechsel und Absprachen."
        ],
        "earnedChange": "Bis Folge 15 hat die Schau ein machbares gemeinsames Programm und benannte Beiträge. Nicht jede Folge repariert wieder denselben Apparat."
      },
      {
        "question": "Kann Tilda eine gemeinsame Schau ermöglichen, ohne alles selbst zu bestimmen?",
        "possibilities": [
          "Die Kinder dürfen eine kleine Probe selbst berichtigen.",
          "Rostigs normaler Weg und Regen verändern den Aufbau.",
          "Eine heimliche letzte Verbesserung wird zugunsten geübter Abläufe zurückgenommen."
        ],
        "earnedChange": "Folge 20 erfüllt das Versprechen der Schau mit einer gelebten gemeinsamen Aufführung. Tilda erhält Anerkennung fürs Ermöglichen und lässt anderen ihre eigene Leistung."
      }
    ],
    ensemble: SERIES_PLAN_FILES["tilda-tueftel"].ensemble,
    episodes: SERIES_PLAN_FILES["tilda-tueftel"].episodes,
    seasonTitles: SERIES_PLAN_FILES["tilda-tueftel"].seasonTitles,
  }
};
