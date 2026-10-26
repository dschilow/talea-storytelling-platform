/** Hand-edited character concepts. Scores describe the source concept, not measured story quality. */
export interface Revision {
  score: number;
  want: string;
  runningGag: string;
  fear?: string;
  secret?: string;
  backstory?: string;
  introLine?: string;
  canLead?: boolean;
  canOppose?: boolean;
  villainStyle?: "comic" | "misunderstood" | "real";
  comicRole?: string;
}

export const folds: Record<string, { into: string; reason: string }> = {
  "Bäcker Bruno": { into: "Bäcker Braun", reason: "Warme Backstube und Trostgebäck doppeln Braun. Das misslungene erste Brot und das eigene Wunschrezept fließen in Braun ein." },
  "Bäcker Wilhelm": { into: "Bäcker Braun", reason: "Versorgt und tröstet mit Brot wie Braun; Brotschnuppern allein trägt keine weitere feste Bäckerfigur." },
  "Gelehrter Professor Theodor": { into: "Professor Lichtweis", reason: "Zerstreuter, begeisterter Wissensvermittler wie Lichtweis. Lichtweis bleibt der forschende Professor." },
  "König Wilhelm": { into: "König Karl der Weise", reason: "Weiser, gerechter Zuhörer wie Karl. Karls leerer Stuhl für die ungehörte Stimme ist das markantere Motiv." },
};

/** Leads carry the central wish; the other figures stay active for supporting roles. */
export const leadNames = new Set([
  "Die Nebelfee", "Funkelflug", "Luna", "Graf Griesgram", "Kobold Kicher",
  "Der Geraeusche-Fresser", "Brumm der Steinwächter", "Morpheus", "Wolke Wuschel",
  "Lumi Nachtlicht", "Astra", "Silberfunke", "Die Nebelhexe", "Hexe Kräuterweis", "Drache Fauchi",
  "Tilda Tüftel", "Juna Windwärts", "Mia Neugier", "Kapitän Blubbert", "Schattenjunge Finn",
  "Samu Sanftpfote", "Yara Wellenklang", "Zauberer Sternenschweif", "Schwarzmagier Vardun", "Pip",
]);

export const revisions: Record<string, Revision> = {
  "Amir Sternfinder": {
    score: 7.5, want: "Er will eine eigene Sternkarte zeichnen und als Erster erklären, wohin ihr fehlendes Stück gehört.",
    runningGag: "Amir sieht überall Sternbilder und benennt sie feierlich. Andere erkennen darin einen Löffel oder eine Socke. Gerade sein schönstes Sternbild ist noch gar nicht fertig.",
    secret: "Eine Stelle seiner Sternkarte ist ausgedacht. Er hat sie noch niemandem gezeigt.",
  },
  "Astra": {
    score: 7, want: "Sie will ihren Platz am Himmel wiederfinden und unterwegs unbedingt eine richtige Erdenfreundin werden.",
    fear: "Dass ihr Licht vergeht, bevor sie herausfindet, wo sie hingehört.",
    secret: "Sie erkennt Sternbilder, verwechselt auf der Erde aber Fenster, Glühwürmchen und Straßenlaternen.",
    runningGag: "Astra begrüßt ein vermeintliches Himmelszeichen ehrfürchtig; es ist eine Lampe oder ein Käfer. Wird sie verbessert, behandelt sie auch diesen neuen Bekannten höchst feierlich.",
    backstory: "Astra kam vom Rand des Himmels auf die Erde und fand den Rückweg nicht. Ihr kleines Funkeln half bereits einem Kind nach Hause. Nun sucht sie ihr eigenes Himmelszeichen und sammelt Erdenkenntnisse, wobei sie gern so tut, als kenne sie sich längst aus. Ihr Licht zeigt ihren Standort, erfüllt aber keine Wünsche.",
    introLine: "Astra. Ist das dort euer Mond? Ach, eine Küchenlampe. Sehr stattlich.",
  },
  "Astronautin Nova": {
    score: 7.5, want: "Sie will die Herkunft eines unbekannten Signals entdecken und die nächste Abzweigung ihrer Expedition selbst wählen.",
    runningGag: "Nova beginnt ihren professionellen Countdown, doch jemand stellt noch eine Frage. Sie startet tapfer neu; schließlich zählt die ganze Crew mit und sie selbst vergisst die Drei.",
    secret: "Ein Signal in ihrem Logbuch hat sie als unbedeutend abgetan. Nun hört sie es immer wieder.",
  },
  "Bäcker Braun": {
    score: 6.5, want: "Er will sein unmögliches Lieblingsbrot backen und dabei jeden Gast an seinem Tisch behalten.",
    fear: "Dass alle sein Brot loben, aber niemand ehrlich sagt, was daran nicht stimmt.",
    secret: "Sein erstes steinhartes Brot liegt noch in der Schublade; er benutzt es heimlich als Briefbeschwerer.",
    runningGag: "Braun bietet für jede Lage das passende Gebäck an, sogar einem Wesen ohne Mund. Wird sein eigenes Brot kritisiert, probiert er sofort mit und verteidigt es mit vollem Mund.",
    backstory: "Bäcker Braun öffnet seine warme Dorfbackstube vor Sonnenaufgang. Während eines knappen Winters verschenkte er heimlich Brötchen. Für sein besonderes Lieblingsbrot fragt er Gäste nach dem Geschmack von Zuhause; gerade dieses Rezept gelingt ihm noch nicht. Er nimmt jede Bestellung ernst und verspricht dabei gern mehr, als sein Ofen fasst.",
    introLine: "Braun. Erst probieren. Ehrlich sein dürft ihr hinterher. Lieber gleich.",
    canLead: true, comicRole: "fusspot",
  },
  "Bauerntochter Greta": {
    score: 6, want: "Sie will ihren ersten eigenen Garten anlegen, aber keine einzige Pflanze dafür zurücklassen.",
    runningGag: "Greta verteilt Blumen nach deren angeblicher Vorliebe. Ein Gast bekommt einen immer unhandlicheren Strauß; ausgerechnet ihr Lieblingsblümchen will sie dann doch nicht hergeben.",
    secret: "Eine unscheinbare Pflanze in ihrem Korb hat noch nie geblüht. Sie verteidigt deren Platz gegen jeden gut gemeinten Rat.",
  },
  "Bo Bücherfuchs": {
    score: 8, want: "Er will das letzte unbeschriftete Regal seiner Bibliothek füllen und keine Frage unbeantwortet ablegen.",
    runningGag: "Bo sucht für eine einfache Frage das perfekte Buch. Seine immer genaueren Kategorien passen zu nichts; die Kinder schlagen ein ganz neues Fach vor, dessen Schild er sofort anfertigt.",
    secret: "Im unbeschrifteten Regal liegt seine eigene Frage. Er hat sich noch nicht getraut, sie vorzulesen.",
    introLine: "Bo Bücherfuchs. Die Antwort finden wir. Wo die Frage hingehört, ist schwieriger.",
  },
  "Bruchkind Brenno": {
    score: 8, want: "Er will seine zerbrochene Schale selbst zusammensetzen und bestimmen, welche fehlenden Stücke ersetzt werden dürfen.",
    runningGag: "Brenno erklärt einen misslungenen Versuch für völlig absichtlich. Danach bewacht er die krumme Stelle besonders eifersüchtig und verbessert sie heimlich, sobald alle wegsehen.",
    secret: "Das letzte passende Schalenstück trägt er bei sich. Es einzusetzen würde bedeuten, jemanden dabeibleiben zu lassen.",
  },
  "Brumm der Steinwächter": {
    score: 7, want: "Er will seinen alten Wachauftrag endlich richtig verstehen, ohne auch nur eine Regel zu brechen.",
    fear: "Dass er jahrelang den falschen Weg bewacht hat.",
    secret: "Ein Wort seines eingemeißelten Auftrags ist verwittert. Er ersetzt es bei jeder Erklärung durch ein anderes.",
    runningGag: "Brumm legt eine Regel ungeheuer wörtlich aus und sperrt dabei sich selbst aus. Um sie einzuhalten, verrückt er seine riesige Haltung millimeterweise, statt einen Schritt beiseitezutreten.",
    introLine: "BRUMM. Weitergehen verboten. Dastehen auch. Einen Moment. Das kläre ich.",
  },
  "Der Geraeusche-Fresser": {
    score: 8, want: "Er will das schönste Geräusch der Welt besitzen und sammelt vorsichtshalber alle anderen mit.",
    fear: "Dass jemand sein Lieblingsgeräusch macht, während er gerade den Sack zubindet.",
    secret: "Sein liebstes Geräusch ist ein ganz gewöhnliches Lachen. Im übervollen Sack findet er es nicht wieder.",
    runningGag: "Er beschreibt seine Sammlung flüsternd, doch aus dem Sack antwortet genau das falsche Geräusch: ein Schnarchen statt einer Fanfare. Seine strenge Ermahnung schluckt er versehentlich selbst.",
    backstory: "Der Geräusche-Fresser kam aus einer klanglosen Gegend und wollte jeden neuen Laut behalten. Er sammelt hörbare Geräusche als Blasen in seinem Sack; er nimmt niemandem die Fähigkeit zu sprechen. Was er freilässt, klingt wieder. Inzwischen sammelt er schneller, als er sortieren kann, und duldet keine Kritik an seinem vermeintlich tadellosen Archiv.",
  },
  "Der Leiser-Mann": {
    score: 6.5, want: "Er will einen vollkommen stillen Lieblingsraum einrichten und jede Unterbrechung vorsorglich auspolstern.",
    runningGag: "Er fordert Stille und verursacht beim Dämpfen selbst ein Geräusch. Er legt noch eine Filzschicht nach und hört nun die anderen nicht mehr kommen.",
    secret: "Er mag ein leises gemeinsames Lied, nennt es vor anderen aber eine hilfreiche Geräuschmessung.",
    backstory: "Der Leiser-Mann trägt dicke Filzmäntel und dämpft störende Dinge mit weichen Auflagen. Er sammelt keine Geräusche und nimmt niemandem die Stimme. Am liebsten hätte er einen ganz stillen Raum nur für sich. Seine übertriebene Vorsorge stört inzwischen seine eigene Ruhe; eine freundliche Unterbrechung dauert bei ihm oft länger als geplant.",
    villainStyle: "comic",
  },
  "Der Letzte Wehmueter": {
    score: 7, want: "Er will den verlassenen Festplatz bewahren und verhindern, dass jemand seine alten Dinge für nutzlos erklärt.",
    runningGag: "Er kennt zu jedem unbrauchbaren Gegenstand eine unentbehrliche Geschichte. Eine kurze Auskunft wird zur Führung; bei seinem eigenen Lieblingsstück fehlen ihm ausgerechnet die entscheidenden Worte.",
    secret: "Für einen neuen Gast hält er einen leeren Platz frei, nennt ihn aber stur einen historischen Sitzplatz.",
  },
  "Der Mutlosmacher": {
    score: 6.5, want: "Er will beweisen, dass sein Plan zum Nichtanfangen sicherer ist als jeder fremde Versuch.",
    runningGag: "Er bereitet das Scheitern so gewissenhaft vor, dass er selbst loslegen muss: Absperrung bauen, Warnschilder tragen, Pausenbrot packen. Hinterher behauptet er, das sei kein Anfang gewesen.",
    secret: "Er hat sein eigenes halbfertiges Vorhaben als Warnbeispiel getarnt und wartet heimlich auf einen Mitmacher.",
  },
  "Der Zeitweber": {
    score: 7, want: "Er will einen verpassten Augenblick nachholen und gleichzeitig jede Minute auf ihrem richtigen Platz halten.",
    fear: "Dass andere ohne ihn weitergehen, während er noch den richtigen Moment sucht.",
    secret: "In seinem Kalender steht seit Jahren eine Einladung, für die er sich nie Zeit genommen hat.",
    runningGag: "Der Zeitweber verlangt Pünktlichkeit, aber seine Uhren widersprechen sich. Er kündigt ein Ereignis als gleich bevorstehend an, während es hinter seinem Rücken bereits stattfindet.",
    backstory: "Der Zeitweber sah einen König einen kostbaren Augenblick verpassen und begann, die Zeit zu hüten. Er kann versäumte Momente sichtbar machen, aber die Vergangenheit weder zurückdrehen noch die Zukunft kennen. Bei seinen eigenen Verabredungen verliert er die Übersicht. Nicht jede richtige Minute fühlt sich für ihn auch richtig an.",
  },
  "Der Zu-Ordentliche": {
    score: 7.5, want: "Er will einen vollkommen geraden Weg durch eine Welt ziehen, in der dauernd etwas schief steht.",
    runningGag: "Er richtet etwas schief Stehendes aus und bringt dadurch das Nächste aus dem Lot. Zum Schluss steht er selbst krumm, hält aber sein Lineal triumphierend gerade.",
    secret: "In seiner makellosen Tasche steckt eine krumme Zeichnung, die er niemals begradigen würde.",
  },
  "Detektiv Schnüffel": {
    score: 7, want: "Er will einen Fall ganz ohne vorschnelles Urteil lösen und am liebsten trotzdem vor allen anderen recht haben.",
    runningGag: "Schnüffel verkündet einen großartigen Fund, der nur seinen eigenen Weg erklärt: sein Fußabdruck, sein Taschentuch. Er untersucht den peinlichen Befund mit unvermindertem amtlichem Ernst.",
    secret: "Seine erste Vermutung schreibt er mit Bleistift. Radierkrümel verraten, wie oft er sie bereits geändert hat.",
  },
  "Die Alte Eiche": {
    score: 7, want: "Sie will ihren vertrauten Wald bewahren und bestimmen, was sich unter ihren Ästen verändern darf.",
    fear: "Dass eines Tages niemand mehr unter ihr sitzt und erzählt.",
    secret: "Ihre Wurzeln können sich ein kleines Stück bewegen. Einen unbequemen neuen Weg hat sie bereits heimlich verlegt.",
    runningGag: "Sie beginnt mit „Als ich noch ein Setzling war“ und holt lange aus. Währenddessen handeln alle selbst; erst bei einer völlig belanglosen Frage antwortet sie verblüffend knapp.",
    introLine: "Setzt euch. Da nicht. Dort war schon immer mein Lieblingsplatz.",
  },
  "Die Besserwisserin Klotilde": {
    score: 7, want: "Sie will bei jeder Entdeckung als Erste die richtige Erklärung liefern, auch wenn noch niemand gefragt hat.",
    runningGag: "Klotilde verbessert ein einfaches Wort durch ein unhandliches Fachwort. Niemand versteht ihre eigene Bestellung; schließlich benutzt sie empört genau das Wort, das sie zuvor verbessert hat.",
    secret: "Sie übt heimlich den Satz „Das weiß ich nicht“, bringt ihn aber immer noch mit einer Fußnote heraus.",
  },
  "Die Nebelfee": {
    score: 7.5, want: "Sie will Verlorenes zu seinen Besitzern bringen und dabei endlich ihren eigenen Heimweg finden.",
    fear: "Dass sie im entscheidenden Moment verschwindet und niemand mehr weiß, wohin sie wollte.",
    secret: "Sie erkennt den Weg der anderen, aber nicht den zu ihrem eigenen Zuhause.",
    runningGag: "Die Nebelfee versucht ungesehen etwas zurückzugeben, doch der Gegenstand scheint allein zu wandern. Wird sie gelobt, verblasst sie vor Verlegenheit und beschwert sich hörbar über das Auffallen.",
    backstory: "Die Nebelfee führte einmal ein verirrtes Kind sicher durch dichten Nebel. Seitdem bringt sie Verlorenes zurück, ohne gern gesehen zu werden. Sie selbst verlor vor langer Zeit ihren Heimweg. Lautstärke lässt sie verblassen; einen getragenen Gegenstand macht sie damit nicht unsichtbar. Trotz ihrer Scheu hat sie sehr genaue Vorstellungen davon, was ihr gehört.",
    introLine: "Nicht erschrecken. Das gehört dir. Und den Weg dorthin suche ich selbst noch.",
  },
  "Die Nebelhexe": {
    score: 7.5, want: "Sie will einen würdigen Rätselgegner finden und dann unter keinen Umständen gegen ihn verlieren.",
    runningGag: "Sie verkündet einen winzigen Streich und spielt anschließend die völlig unbeteiligte Zuschauerin. Sobald jemand ihren Trick durchschaut, hilft sie beleidigt nach und verrät sich dabei selbst.",
    secret: "Eine ihrer besten Rätselantworten kennt sie selbst nicht. Sie behauptet, das mache die Frage besonders gut.",
  },
  "Diener Johann": {
    score: 6, want: "Er will einen einzigen Schlosstag nach seinem eigenen Plan gestalten, ohne jemanden enttäuschen zu müssen.",
    runningGag: "Johann beantwortet widersprüchliche Aufträge mit „Sehr wohl“ und versucht beide zugleich auszuführen. Seine höfliche Erklärung wird immer kürzer, bis ihm ein klares „Nein“ herausrutscht.",
    secret: "Er besitzt einen Ablaufplan für seinen ersten freien Nachmittag und hat ihn noch nie benutzt.",
    canLead: true,
  },
  "Die Stundendiebin": {
    score: 7.5, want: "Sie will genug Minuten sammeln, um selbst einen ganzen eigenen Tag zu besitzen.",
    runningGag: "Sie preist jede gestohlene Minute als kostbar an, verschwendet aber selbst Zeit mit ihrer perfekten Ordnung. Ein kurzer Abschied bringt ihre penibel sortierte Sammlung durcheinander.",
    secret: "Ihre Lieblingsminute bestand nur aus gemeinsamem Nichtstun. Sie nennt sie trotzdem eine wichtige Erledigung.",
  },
  "Drache Fauchi": {
    score: 7, want: "Er will als verlässlicher Drachenwächter ernst genommen werden und jeden Streit persönlich schlichten.",
    runningGag: "Fauchi kündigt eine ganz ruhige Ansprache an und brüllt schon die Begrüßung. Er wiederholt sie im Flüsterton; dabei entsteht ein riesiger Rauchkringel vor seinem ernsten Gesicht.",
    secret: "Für feierliche Ansprachen hat er ein winziges Manuskript, dessen letzte Zeile immer „erst zuhören“ lautet.",
  },
  "Eichhörnchen Flitz": {
    score: 7, want: "Flitz will den schnellsten Weg durch den Wald bauen und beweisen, dass Vorbereitung jede Eile schlägt.",
    runningGag: "Flitz präsentiert einen verblüffend schnellen Plan und erklärt ihn so rasant, dass alle noch am Anfang stehen. Beim Zurückerklären bemerkt Flitz eine selbst übersehene Abzweigung.",
    secret: "Eine ganz gewöhnliche langsame Strecke mag Flitz am liebsten, weil dort niemand eine Lösung verlangt.",
  },
  "Fee Rosalie": {
    score: 6.5, want: "Sie will einen eigenen Garten ohne schnelle Zauberhilfe zum Blühen bringen und hält das Warten kaum aus.",
    runningGag: "Rosalie verspricht, nicht einzugreifen, und legt den Zauberstab weg. Beim Warten erfindet sie immer kleinere Ausnahmen; ein einziges gewöhnliches Blatt beschäftigt sie länger als ein großer Zauber.",
    secret: "An einer Stelle hat sie doch heimlich gezaubert. Ausgerechnet diese Pflanze wächst anders als geplant.",
    canLead: true,
  },
  "Feuerwehrfrau Fanni": {
    score: 7, want: "Sie will eine Übung leiten, bei der jeder selbstständig den richtigen nächsten Schritt erkennt.",
    runningGag: "Bei harmlosen Proben gibt Fanni so genaue Anweisungen, dass selbst die Übungspuppe einen Namen erhält. Sobald jemand eigenständig gut handelt, versucht sie vergeblich, ihre stolze Miene zu verbergen.",
    secret: "Sie kann bei Übungen schlechter zuschauen als eingreifen und übt deshalb selbst das Abwarten.",
  },
  "Fluestertante Flora": {
    score: 7, want: "Sie will jede Neuigkeit zuerst erfahren und selbst bestimmen, wem sie sie weitererzählt.",
    runningGag: "Flora flüstert eine angeblich streng geheime, völlig sichtbare Neuigkeit. Weil die anderen nachfragen, muss sie lauter werden; schließlich hört das ganze Viertel ihr „Das bleibt unter uns“.",
    secret: "Eine echte Einladung trägt sie offen in der Tasche, erzählt davon aber wie von einem hochgeheimen Auftrag.",
  },
  "Frau Gleichgleich": {
    score: 7, want: "Sie will morgen ihren bewährten Tagesplan wiederholen, bis jede Überraschung einen festen Termin hat.",
    runningGag: "Für jede ungeplante Änderung schreibt sie sofort einen neuen unveränderlichen Plan. Bald widersprechen sich ihre Pläne; ihr einziger freier Termin heißt ausgerechnet „keine Überraschungen“.",
    secret: "Eine kleine Abweichung freut sie jedes Mal. In ihrem Plan nennt sie sie vorsorglich eine Pflicht.",
  },
  "Frau Müller": {
    score: 6.5, want: "Sie will, dass ihre Straße wieder ein Treffpunkt wird, und mischt sich dafür ungefragt in Nachbarschaftspläne ein.",
    runningGag: "Ihr Rat klingt abwegig und passt später erstaunlich gut. Gewöhnen sich alle daran, nehmen sie einen beiläufigen Unsinnssatz ebenfalls als Rat; sie widerspricht als Erste.",
    secret: "Als Kind hat sie das Wunderbare selbst gesehen. Bei einer bestimmten Frage schaut sie auffällig zu ihrem Gartenzaun.",
    introLine: "Frau Müller von nebenan. Den Plan kenne ich. Den Fehler darin auch. Meistens.",
  },
  "Frau Wellenreiter": {
    score: 7, want: "Sie will endlich die andere Seite ihrer Bucht besuchen, ohne ihren Leuchtturm im Stich zu lassen.",
    fear: "Dass sie außerhalb ihres Leuchtturms selbst die Orientierung verliert.",
    secret: "Sie kennt jedes Schiff vom Ufer aus, war selbst aber nie an Bord: Sie wird seekrank.",
    runningGag: "Sie erklärt Alltägliches mit Seefahrtsbegriffen und erwartet, dass alle folgen. An Bord hält sie steif an einer seemännischen Würde fest, während sie sich am falschen Ende festklammert.",
    canLead: true,
  },
  "Frosch Quak": {
    score: 6.5, want: "Er will einen eigenen Teichrhythmus erfinden, bei dem alle mitmachen und trotzdem sein Einsatz der wichtigste bleibt.",
    runningGag: "Quak zählt den Einsatz ein und verpasst beim begeisterten Dirigieren seinen eigenen. Danach erklärt er jeden fremden Quak zum absichtlichen Solo, bis jemand ihm ein Solo zuweist.",
    secret: "Er hält sich für einen großartigen Zuhörer, hört beim eigenen Lieblingsrhythmus aber kaum etwas anderes.",
    canLead: true,
  },
  "Funkelflug": {
    score: 7, want: "Er will eine eigene Drachenhöhle eröffnen, in der selbst die großen Drachen zu Besuch kommen.",
    runningGag: "Funkelflug nimmt eine ehrwürdige Drachenpose ein, muss niesen und entschuldigt sich bei immer kleineren Dingen. Jemand dankt ihm ernsthaft; diesmal hat er tatsächlich bewusst geholfen.",
    secret: "Seine beeindruckenden Flüge sind bisher sehr hohe Sprünge. Er übt den Unterschied heimlich.",
    fear: "Dass andere sein Üben sehen und ihn nur noch für einen Spaßdrachen halten.",
  },
  "Graf Griesgram": {
    score: 8, want: "Er will den besten Besuch seines Lebens empfangen, ohne zugeben zu müssen, dass er jemanden eingeladen hat.",
    runningGag: "Er schickt Gäste fort und ruft ihnen eine Frage hinterher. Wer trotzdem geht, bekommt noch einen angeblich überzähligen Keks; am Ende steht er selbst mit dem Tablett an der Tür.",
    secret: "Er übt Begrüßungen vor dem Spiegel und hat für seine unerwünschten Gäste die besten Tassen herausgestellt.",
    introLine: "Griesgram. Raus. Vorher Hände waschen. Die Kekse werden sonst weich.",
    villainStyle: "misunderstood",
  },
  "Graumund der Gleichgültige": {
    score: 7.5, want: "Er will alles Besondere gleichgültig machen und ausgerechnet selbst für seinen tadellosen Grauton bewundert werden.",
    runningGag: "Graumund nennt etwas bedeutungslos und erklärt dann ausführlich, weshalb sein eigenes Grau das beste ist. Einen geliebten Gegenstand kritisiert er so genau, dass sein Interesse unübersehbar wird.",
    secret: "Er bewahrt eine bunte Feder auf und hat für deren Farbe einen höchst umständlichen Graunamen erfunden.",
  },
  "Händler Gustav": {
    score: 7.5, want: "Er will das Geschäft seines Lebens abschließen und ungern zugeben, wenn ihm ein Kunde wichtiger wird.",
    runningGag: "Gustav bietet ein unschlagbares Zusatzgeschäft an und verhandelt sich damit selbst in eine Pflicht. Hinterher erklärt er seinen unbezahlten Umweg zur einmaligen Werbemaßnahme.",
    secret: "Ein Geschenk, das er nicht verkaufen will, liegt zwischen seinen teuersten Waren. Dafür nennt er absurde Preise.",
  },
  "Herr Seitenflug": {
    score: 6, want: "Er will das selbst verlegte wichtigste Buch wiederfinden, bevor jemand seinen perfekten Katalog prüfen möchte.",
    runningGag: "Er weiß genau, wo ein Buch stehen müsste, und begründet jedes falsche Fundstück fachmännisch. Nach langer Erklärung fragt ein Kind nach seiner eigenen Westentasche.",
    secret: "Das fehlende Buch ist nicht ausgeliehen. Er hat es selbst an einen besonders sicheren Ort gelegt.",
    canLead: true,
  },
  "Hexe Griselda": {
    score: 6.5, want: "Sie will als furchterregende Meisterhexe gelten und ihr angeblich verbotenes Rezept vor fremden Blicken schützen.",
    runningGag: "Griselda kündigt etwas Schreckliches an, doch die einschüchternde Zeremonie gilt einer harmlosen Haushaltssache. Wer nicht erschrickt, bekommt eine noch feierlichere Vorführung statt einer Erklärung.",
    secret: "Ihr sorgsam verborgenes Rezept ist ein gewöhnliches Kuchenrezept, das ihr einfach nicht gelingen will.",
    fear: "Dass alle ihre Auftritte nur höflich ertragen und lieber ohne sie weiterspielen.",
    villainStyle: "comic",
  },
  "Hexe Kräuterweis": {
    score: 7.5, want: "Sie will eine seltene Pflanze wieder ansiedeln und beweisen, dass ihr sorgfältiger Weg besser als Zauberei ist.",
    runningGag: "Ihre trockene Frage nach einer winzigen Zutat bringt einen Großredner zum Schweigen. Bei ihrer eigenen Lieblingspflanze redet sie plötzlich selbst viel zu lange.",
    secret: "Eine Pflanze wächst bei ihr trotz aller Sorgfalt nicht. Einen fremden Rat dazu braucht sie dringender, als sie sagt.",
  },
  "Hirtenjunge Peter": {
    score: 7, want: "Er will ein eigenes Abenteuer erleben und beweisen, dass seine Schafe dabei mehr wissen als die Schlossleute.",
    runningGag: "Peter zitiert ein Schaf als höchste Fachperson. Ein echtes Blöken klingt wie Widerspruch; er übersetzt es hastig neu und muss sich schließlich von einem Schaf führen lassen.",
  },
  "Juna Windwärts": {
    score: 7.5, want: "Sie will einen bislang unkartierten Weg selbst erkunden und ihre Karte vor ungebetenen Verbesserern verteidigen.",
    runningGag: "Juna nennt einen Umweg längst geplant und zeichnet ihn schnell ein. Den nächsten kennt jemand anders besser; ihre Karte bekommt widerwillig einen zweiten Namen.",
    secret: "Ein weißer Fleck auf ihrer Karte ist ein Ort, den sie besonders gern gemeinsam erkunden würde.",
  },
  "Kapitän Blubbert": {
    score: 7.5, want: "Er will mit seiner Crew eine unkartierte Insel erreichen und unbedingt selbst die Richtung bestimmen.",
    runningGag: "Blubbert hält eine donnernde Kapitänsrede; der Muschelkompass rührt sich erst, wenn auch die anderen zustimmen. Ihre sachlichen Einwände nennt er eilig eine hervorragende Idee des Kapitäns.",
  },
  "Kobold Kicher": {
    score: 7.5, want: "Er will das überraschendste Spiel der Welt erfinden und dabei selbst unter keinen Umständen verlieren.",
    runningGag: "Kicher erfindet eine rettende Zusatzregel, sobald er zurückliegt. Die anderen benutzen sie sofort besser als er. Nun muss er mit demonstrativer Begeisterung seine eigene Regel verteidigen.",
    secret: "Er kennt ein sehr gutes Spiel mit festen Regeln. Dass er es mag, findet er äußerst unkoboldhaft.",
  },
  "König Friedrich": {
    score: 7, want: "Er will für jede Schwierigkeit im Reich eine eindeutige Regel haben, die auch für ihn selbst gelten soll.",
    runningGag: "Friedrich erlässt einen präzisen Befehl und gerät selbst in dessen Folgen. Seine würdige Ausnahmebegründung endet an einer Regel, die er vorher besonders gelobt hat.",
  },
  "Königin Isabella": {
    score: 7, want: "Sie will einen Streit ohne königlichen Befehl beilegen und dabei selbst das letzte Wort behalten.",
    runningGag: "Isabella findet eine so höfliche Umschreibung, dass niemand ihre Bitte erkennt. Ein Kind sagt sie geradeheraus; sie wiederholt diese Fassung anschließend mit königlicher Selbstverständlichkeit.",
    secret: "Eine kleine höfische Tradition würde sie gern abschaffen. Sie hat nur noch niemandem gesagt, dass sie sie selbst erfand.",
  },
  "König Karl der Weise": {
    score: 6.5, want: "Er will eine gerechte Entscheidung treffen, ohne noch einmal die leiseste Stimme im Saal zu überhören.",
    runningGag: "Karl hört vorsichtshalber noch eine Meinung an und lässt einen weiteren Stuhl bringen. Als er endlich entscheiden will, sitzt er selbst am äußersten Rand seiner eigenen Beratung.",
    secret: "Er würde gern einmal etwas nur deshalb wählen, weil es ihm Freude macht, statt weil es besonders weise wirkt.",
  },
  "Krummfinger der Sammler": {
    score: 7.5, want: "Er will die vollständigste Sammlung besitzen und gerade das Stück ergattern, das jemand anderes behalten möchte.",
    runningGag: "Krummfinger erklärt einen wertlosen Fund zur Rarität, sobald jemand danach greift. Beim Tausch preist er beide Seiten so sehr an, dass er sich von keiner mehr trennen kann.",
  },
  "Kuno Knopf": {
    score: 7, want: "Er will seine Werkstatt für gerettete Lieblingsstücke öffnen und am liebsten jeden Flicken selbst setzen.",
    runningGag: "Kuno findet für ein winziges Loch einen übertrieben schönen Flicken. Er berät sich ernsthaft über Farben, während sein eigener loser Knopf immer auffälliger baumelt.",
    secret: "Sein eigenes Lieblingsstück ist absichtlich noch nicht fertig. Daran darf endlich jemand anderes mitarbeiten.",
    fear: "Dass jemand einen geliebten Gegenstand wegwirft, bevor er ihn retten kann.",
    canLead: true,
  },
  "Lehrerin Lämpel": {
    score: 6.5, want: "Sie will mit ihrer Klasse eine eigene Frage untersuchen und muss dafür ihren sorgfältigen Stundenplan loslassen.",
    runningGag: "Lämpel zeichnet für jede gute Frage eine Glühbirne. Die Fragen verzweigen sich schneller als ihr Plan; schließlich malt ein Kind neben ihre eigene Ratlosigkeit die größte Birne.",
    secret: "Eine Frage aus ihrem alten Schulheft ist bis heute offen. Ausgerechnet ihre Klasse möchte sie nun untersuchen.",
  },
  "Lumi Nachtlicht": {
    score: 7.5, want: "Lumi will einen Nachtweg zum ersten Mal selbst erkunden und dabei nicht ständig als Lampe gebraucht werden.",
    runningGag: "Lumi versucht furchtlos zu wirken, doch das Bauchlicht verrät jeden Schreck. Gerade beim stolzen Satz „Ich habe nichts bemerkt“ leuchtet es auf die größte Kleinigkeit.",
    secret: "Einen dunklen Ort findet Lumi heimlich schön und möchte dort einmal ohne Publikum verweilen.",
    canLead: true,
  },
  "Luna": {
    score: 8, want: "Sie will als Erste alles wissen und selbst bestimmen, wann ihre Freunde ihre Hilfe verdienen.",
    fear: "Dass sie vor anderen ehrlich überrascht wird.",
    secret: "Ihr streng geheimer Beobachtungsposten ist eine gewöhnliche Wäschekiste.",
    runningGag: "Nach jeder Überraschung behauptet Luna „Wusste ich doch“. Weiß sie tatsächlich einmal etwas vorher, hört niemand mehr hin; nun muss sie die anderen statt ihrer Überlegenheit überzeugen.",
    introLine: "Luna. Ich war schon hier. Ihr habt nur zu spät hingesehen.",
  },
  "Magd Elsa": {
    score: 5.5, want: "Sie will einen freien Nachmittag für ihre eigene Musik und aufhören, jede fremde Bitte sofort zu erfüllen.",
    runningGag: "Elsa summt beim Arbeiten höfliche kleine Verse über das, was wirklich schiefläuft. Die anderen summen ahnungslos mit und bemerken erst spät, dass sie darin selbst vorkommen.",
    secret: "Sie komponiert ein Lied mit einer eigenen Strophe für jeden Schlossbewohner. Für sich selbst fehlt noch eine.",
    backstory: "Elsa kennt die Arbeit im Schloss besser als dessen Herrschaft. Sie summt eigene Melodien und bemerkt, wer Aufgaben stillschweigend weiterreicht. Früher sagte sie zu allem Ja; nun versucht sie, ihren ersten freien Musiknachmittag durchzusetzen. Ihre Freundlichkeit ist eine Stärke, aber sie möchte selbst entscheiden, wem sie ihre Zeit schenkt.",
    canLead: true,
  },
  "Magierin Luna": {
    score: 6.5, want: "Sie will ihren ersten eigenen Zauber vollenden, statt immer nur auf fremde Hilferufe zu warten.",
    runningGag: "Sie kündigt eine unauffällige Probe an, doch ihr Stab verrät ihre Aufregung mit Licht. Beim Versuch, das Leuchten würdevoll zu verbergen, beleuchtet sie ausgerechnet ihr Versteck.",
    secret: "Der Zauber in ihrem verschlossenen Heft ist viel kleiner und persönlicher, als alle von einer Magierin erwarten.",
    canLead: true,
  },
  "Mia Neugier": {
    score: 7.5, want: "Sie will herausfinden, welche Frage die nächste verborgene Tür öffnet, und kann schlecht an Grenzen vorbeigehen.",
    runningGag: "Mia stellt eine Frage und läuft ihrer ersten Vermutung schon hinterher. Die Antwort ruft ihr nach; beim Zurückkommen hat sie eine zweite Frage, aber die erste noch nicht gehört.",
    secret: "Eine Tür öffnet sich nur, wenn sie selbst eine ehrliche Antwort gibt. Darum geht sie bisher herum.",
  },
  "Mina Mosaik": {
    score: 7.5, want: "Sie will ein eigenes großes Mosaik legen und selbst entscheiden, welcher scheinbar falsche Stein darin bleiben darf.",
    runningGag: "Mina verbessert ein fremdes Muster um einen winzigen Stein und entdeckt nun immer mehr Möglichkeiten. Ihr eigenes sorgfältig geplantes Bild bekommt schließlich einen absichtlich schiefen Platz.",
    secret: "Einen schönen Stein trägt sie lange in der Tasche, weil sie ihn nicht als ersten hinzulegen wagt.",
  },
  "Morpheus": {
    score: 7, want: "Er will einen Traum finden, der wirklich ihm selbst gehört, und dennoch seine nächtliche Runde schaffen.",
    fear: "Dass sein eigener Traum jemand anderem zugestellt werden müsste.",
    secret: "Er bringt anderen gute Träume, kann selbst aber nicht träumen und sammelt heimlich deren Beschreibungen.",
    runningGag: "Morpheus spricht so leise, dass eine harmlose Bitte falsch ankommt. Bei der wichtigen Wiederholung nimmt er sich hörbar zusammen; schon seine normale Stimme erscheint allen erstaunlich laut.",
    backstory: "Morpheus erfand sanfte Bilder gegen die Dunkelheit und lernte, sie anderen zu bringen. Seine Traumwölkchen zeigen kleine Möglichkeiten, erfüllen aber keine wirklichen Wünsche. Selbst träumt er nicht. Darum fragt er nebenbei auffällig genau nach fremden Träumen und hofft, einmal ein eigenes Bild zu finden, das niemandem sonst gehört.",
  },
  "Müller Hans": {
    score: 6.5, want: "Er will seine alte Mühle in Gang halten und ungern eingestehen, dass ein neues Verfahren besser sein könnte.",
    runningGag: "Hans kündigt eine ganz einfache Handarbeit an und zeigt dann einen erstaunlich umständlichen Ablauf. Nach einer fremden Verbesserung behauptet er knapp, genau das habe er eigentlich zeigen wollen.",
    secret: "Seit Tagen hört er eine Veränderung am Mühlengeräusch und tut noch so, als sei alles normal.",
  },
  "Noch-Einmal-Nick": {
    score: 7.5, want: "Er will immer einen weiteren Versuch bekommen und das letzte Wort darüber behalten, wann ein Spiel endet.",
    runningGag: "Nick verspricht hoch und heilig den allerletzten Versuch und erfindet dafür neue Namen. Soll er selbst auf jemanden warten, zählt er dieselben Versprechen plötzlich peinlich genau nach.",
    secret: "Er hat ein Spiel bereits gewonnen, spielt aber weiter, weil er die gemeinsame Runde nicht beenden möchte.",
  },
  "Oma Herzlich": {
    score: 6.5, want: "Sie will einen Besuch abstatten, auf den sie sich lange freut, und lässt sich unterwegs von jedem aufhalten.",
    runningGag: "Oma will nur kurz weiter und bietet im Weitergehen doch einen Sitzplatz, Tee oder eine Geschichte an. Muss sie selbst warten, behauptet sie, genau diese Pause sei längst geplant.",
    secret: "Ein ungeöffneter Brief enthält eine Einladung für sie. Sonst ist immer sie die Gastgeberin.",
  },
  "Pip": {
    score: 7, want: "Pip will die größte eigene Vorratskammer anlegen und gleichzeitig bei keinem Abenteuer fehlen.",
    runningGag: "Pip erklärt ein Nussversteck zum absolut sicheren Ort und gibt den anderen sofort mehrere Hinweise darauf. Bei der Rückkehr verteidigt Pip ein fremdes Versteck als das eigene.",
    secret: "Eine geliebte Nuss liegt seit Wochen an einem Ort, den Pip nur gemeinsam mit jemand anderem erreichen kann.",
  },
  "Polizist Peter": {
    score: 6.5, want: "Er will einen ungeklärten Vorfall fair auflösen und seinen eigenen ersten Verdacht ebenso gründlich prüfen.",
    runningGag: "Peter notiert eine winzige Begebenheit mit sekundengenauer Wichtigkeit. Für das wirklich Bemerkenswerte bittet er erst um einen Moment, weil die genaue Uhrzeit noch fehlt.",
  },
  "Postbote Papierschiff": {
    score: 7, want: "Er will eine Nachricht ohne lesbare Anschrift zustellen und weigert sich, sie einfach als unzustellbar abzulegen.",
    runningGag: "Er probiert eine feierliche Zustellung am falschen Ort und bittet selbst ein Tier höflich um Empfangsbestätigung. Seinen eigenen Brief erkennt er zwischen allen fremden Sendungen zuletzt.",
    secret: "Seit Langem trägt er einen selbst geschriebenen Brief mit sich, den er noch nicht abgegeben hat.",
    canLead: true,
  },
  "Prinz Alexander": {
    score: 6.5, want: "Er will eine eigene Expedition führen und beweisen, dass er mehr kann als gut vorbereitete Heldentaten.",
    runningGag: "Alexander erklärt eine kleine Aufgabe zur großen Heldentat und wartet auf den würdigen Einsatz. Die schlichte Vorarbeit hat jemand anders längst erledigt; nun übernimmt er sie besonders feierlich.",
    secret: "Er beneidet die anderen um alltägliche Fähigkeiten, die im Schloss immer jemand für ihn übernommen hat.",
  },
  "Prinzessin Rosalinde": {
    score: 6.5, want: "Sie will einen eigenen Zufluchtsort für Tiere schaffen und selbst bestimmen, was daran königlich sein muss.",
    runningGag: "Rosalinde hält eine tadellos höfische Rede, während ein Tier an ihrer Blumendekoration knabbert. Ihre würdige Umschreibung wird schließlich zu einer sehr deutlichen Bitte um einen Eimer.",
    secret: "Sie hat einen eigenen Plan für einen leeren Schlossraum gezeichnet und noch niemanden um Erlaubnis gefragt.",
  },
  "Professor Lichtweis": {
    score: 7, want: "Er will jede neue Entdeckung benennen und selbst noch etwas finden, das in keinem seiner Bücher steht.",
    runningGag: "Lichtweis erfindet für eine kleine Sache einen gewaltigen Fachnamen. Die Kinder nennen sie anders; bald benutzt er selbst ihr Wort und behauptet, es sei die Kurzfassung.",
    secret: "Sein wichtigstes Forschungsheft ist fast leer: Vor lauter Staunen vergisst er gerade dort das Aufschreiben.",
    introLine: "Lichtweis. Das hat bestimmt einen Namen. Falls nicht, bin ich rechtzeitig da.",
  },
  "Räuberhauptmann Rotbart": {
    score: 7.5, want: "Er will den größten Fang seiner Bande machen und dabei an seinem selbst geschriebenen Ehrenkodex festhalten.",
    runningGag: "Rotbart rechtfertigt einen Raub mit einer feierlichen Kodexregel. Eine andere Regel verlangt sofort das Gegenteil; er blättert würdevoll weiter, während seine Bande längst nachfragt.",
    secret: "In seinem Kodex steht eine freundliche Regel, deren Ursprung er vor seiner Bande verheimlicht.",
  },
  "Räuber Raubauke": {
    score: 7, want: "Er will Rotbarts nächste große Aufgabe bekommen und sich dabei von niemandem vorsagen lassen, wie es geht.",
    runningGag: "Raubauke nennt eine harmlose Hilfeleistung einen kühnen Überfall. Bei echtem Lob verteidigt er hastig seinen Räuberruf und hilft dabei aus Versehen noch ein Stück weiter.",
    secret: "Er kann eine überraschend sorgfältige Arbeit besonders gut und würde sie nie freiwillig vor der Bande zeigen.",
  },
  "Räuber Rolf": {
    score: 7, want: "Er will eine große Beute kassieren, ohne sich selbst auch nur einer kleinen Schwierigkeit auszusetzen.",
    runningGag: "Rolf verlangt eine furchterregende Weggebühr und bietet nach einem einzigen Einwand eilig Rabatt an. Am Ende verhandelt er darüber, ob er selbst beim Vorbeigehen helfen darf.",
    fear: "Dass jemand einen seiner großen Sprüche tatsächlich ernst nimmt und eine Mutprobe verlangt.",
    secret: "Er hat seinen eigenen Fluchtweg markiert und erklärt die Zeichen zu Warnungen vor seiner Bande.",
  },
  "Rika Rindenlauf": {
    score: 7.5, want: "Sie will einen verschwundenen Waldpfad wiederfinden und beweisen, dass man dafür keinen Zauber braucht.",
    runningGag: "Rika deutet eine Spur sachlich und zutreffend, lehnt aber jede magische Erklärung ab. Bei einem eindeutig unmöglichen Detail macht sie eine außergewöhnlich lange, sehr stille Untersuchungspause.",
    canLead: true,
  },
  "Ritter Rostfrei": {
    score: 7, want: "Er will eine eigene Ritteraufgabe bestehen und zeigen, dass gute Vorbereitung ebenso mutig wie Drauflosreiten ist.",
    runningGag: "Rostfrei kündigt einen entschlossenen Aufbruch an und prüft noch eine Kleinigkeit an der Ausrüstung. Wird er wirklich gebraucht, vergisst er die letzte Prüfung und handelt überraschend schlicht.",
    canLead: true,
  },
  "Samu Sanftpfote": {
    score: 7.5, want: "Er will eine winzige Puppenstube einrichten und dabei selbst bestimmen, wer ihm hilft.",
    runningGag: "Samu behandelt etwas Winziges mit ungeheurer Vorsicht und trägt nebenbei mühelos etwas Riesiges. Für eine kleine ungerechte Bitte braucht er viel mehr Anlauf als für den schweren Gegenstand.",
    secret: "Er hat für sich selbst eine winzige empfindliche Arbeit begonnen, bei der niemand seine Kraft bewundert.",
    fear: "Dass er aus Rücksicht wieder schweigt, obwohl jemand unfair behandelt wird.",
    canLead: true,
  },
  "Schattenjunge Finn": {
    score: 8, want: "Er will seinen festen Platz in einer gemeinsamen Unternehmung zurück und selbst entscheiden, wer dazukommen darf.",
    runningGag: "Finn tut abweisend, doch sein verspäteter Schatten winkt noch freundlich. Er versucht den Schatten zu verdecken; der führt seine vermeintlich gelangweilte Haltung erst recht vor.",
    secret: "Er hat für ein neues Spiel bereits einen zusätzlichen Platz vorbereitet und erklärt ihn zum Materiallager.",
  },
  "Schmied Konrad": {
    score: 6.5, want: "Er will ein unverwüstliches eigenes Werkstück fertigen und keinem unbewährten Material dafür trauen.",
    runningGag: "Konrad prüft jede Kleinigkeit wie ein wichtiges Werkzeug. Seine trockene Begutachtung bekommt ausgerechnet von einem Kind eine noch strengere Gegenprobe; nun schaut er besonders genau hin.",
    secret: "Sein erstes schiefes Werkstück funktioniert noch. Er zeigt es niemandem, obwohl er es selbst weiterbenutzt.",
  },
  "Schwarzmagier Vardun": {
    score: 7, want: "Er will einen eindrucksvollen eigenen Schattenzauber vollenden und dafür endlich ungeteilte Bewunderung erhalten.",
    runningGag: "Vardun probt einen drohenden Auftritt, doch sein Schatten setzt die große Geste zu früh. Er verbessert ihn flüsternd und merkt nicht, dass alle seine Regieanweisungen hören.",
    secret: "Ein kleiner Lichtzauber gelingt ihm noch immer leichter als seine prächtigsten Schattenkunststücke.",
    villainStyle: "comic",
  },
  "Silberfunke": {
    score: 7.5, want: "Silberfunke will ein unübertreffliches Rätsel verstecken und ungeduldig zuschauen, wie jemand es endlich löst.",
    runningGag: "Silberfunke gibt einen winzigen Hinweis und kann die Pause bis zum nächsten kaum aushalten. Der letzte allzu hilfreiche Reim verrät etwas, das eigentlich geheim bleiben sollte.",
    fear: "Dass jemand das Rätsel sofort löst oder gar nicht erst miträtseln möchte.",
  },
  "Silberhorn der Hirsch": {
    score: 6.5, want: "Er will seine Herde zu einem neuen sicheren Platz führen, ohne seine feierliche Würde einzubüßen.",
    runningGag: "Silberhorn stellt sich als majestätischer Beschützer vor etwas Harmloses. Hinter seinem Geweih brauchen die anderen freien Blick; er räumt würdevoll um und behauptet, genau das sei der Plan.",
    secret: "Vor einer kleinen Maus tritt er vorsichtiger zurück als vor einem lauten Eindringling.",
  },
  "Stiefmutter Brunhilde": {
    score: 6, want: "Sie will die angesehenste Person im Schloss sein und jede Idee als ihre eigene glänzen lassen.",
    fear: "Dass niemand ihre Leistung bemerkt, sobald jemand anderes den Raum betritt.",
    secret: "Sie erledigt eine schwierige praktische Arbeit ausgezeichnet, nennt sie aber unter ihrer Würde.",
    runningGag: "Brunhilde beansprucht die Urheberschaft einer guten Idee, bevor sie deren Folgen kennt. Muss sie nun selbst mithelfen, verteidigt sie ihre Würde mit immer unpraktischeren Ausreden.",
    backstory: "Brunhilde kennt höfische Regeln und will im Schloss den Ton angeben. Sie ist gewohnt, Bewunderung mit Aussehen zu gewinnen, traut ihrem eigenen Können aber wenig zu. Gute fremde Ideen übernimmt sie gern als ihre eigenen. Ihr Verhalten entspringt ihrem persönlichen Ehrgeiz, nicht ihrer Rolle als Stiefmutter; sie besitzt auch eigene praktische Begabungen.",
    villainStyle: "comic",
  },
  "Tante Sorgenfalt": {
    score: 7, want: "Sie will einen vollkommen sicheren Ausflug vorbereiten und unbedingt selbst entscheiden, wann alle bereit sind.",
    runningGag: "Für ein kleines Risiko packt sie vorsorglich einen riesigen Gegenstand ein. Das Gepäck erzeugt den nächsten Umweg; auf eine wirklich nützliche fremde Idee antwortet sie mit erleichtertem Widerwillen.",
    secret: "Sie möchte selbst etwas Neues ausprobieren, hat dafür aber noch keine völlig sichere Vorbereitung gefunden.",
  },
  "Theo Zeitsam": {
    score: 7, want: "Er will eine Sache gründlich zu Ende bringen und sich von niemandem zu einem schnellen Urteil drängen lassen.",
    runningGag: "Theo betrachtet etwas lange und sagt dann einen verblüffend kurzen Satz. Bei seiner eigenen Lieblingssache ist er plötzlich ungeduldig und kontrolliert empört die stehen gebliebene Uhr.",
    secret: "Er behauptet, auf nichts zu warten, kommt zu einer bestimmten Verabredung aber jedes Mal viel zu früh.",
    fear: "Dass die anderen weitergehen, bevor er seinen eigenen Gedanken zu Ende gebracht hat.",
    canLead: true,
  },
  "Tilda Tüftel": {
    score: 7.5, want: "Sie will eine eigene Erfindung bauen, die wirklich gebraucht wird, und hört Sonderwünsche allzu gern als Bauauftrag.",
    runningGag: "Tilda ergänzt eine Verbesserung, die eine neue Bedienungsfrage aufwirft. Sie rüstet begeistert nach; am Ende erklären andere ihr selbst, wie die inzwischen viel zu kluge Erfindung angeht.",
    secret: "Ihre liebste Erfindung ist sehr einfach. Sie versteckt sie hinter den Geräten, mit denen sie beeindrucken will.",
  },
  "Troll Grummel": {
    score: 7, want: "Er will seine Brücke als ruhigen eigenen Ort behalten und selbst bestimmen, wer sie betreten darf.",
    runningGag: "Grummel verlangt absolute Rücksicht auf seine Steinsammlung und poltert beim Erklären selbst am lautesten. Jeder neue Beweis seiner Ordnung bringt einen anderen Stein ins Rollen.",
    secret: "Ein besonders schöner Stein ist für einen Gast reserviert. Er prüft jedes Mal neue angebliche Zutrittsbedingungen.",
  },
  "Weise Frau Margarethe": {
    score: 6.5, want: "Sie will ein unvollständiges Kräuterheft ergänzen und dafür selbst noch einmal auf eine Lernreise gehen.",
    runningGag: "Margarethe fragt ruhig nach einer Einzelheit, während alle eine große Erklärung erwarten. Wird sie als allwissend vorgestellt, zählt sie trocken auf, wen sie selbst noch fragen muss.",
    secret: "Eine Pflanzenzeichnung im Heft stammt von jemandem, dessen unscheinbaren Hinweis sie lange unterschätzt hat.",
    canLead: true,
  },
  "Wirtin Martha": {
    score: 6.5, want: "Sie will das lebendigste Gasthaus der Gegend führen und bei jeder ankommenden Geschichte als Erste Bescheid wissen.",
    runningGag: "Martha fragt scheinbar nur nach einer Bestellung und erfährt dabei eine halbe Reisegeschichte. Eine vertrauliche Auskunft kennt sie längst; ein ganz offensichtliches Detail überrascht sie umso mehr.",
    secret: "Für einen lange erwarteten Gast hält sie einen Tisch frei und nennt das täglich einen Reservierungsfehler.",
  },
  "Wolke Wuschel": {
    score: 8, want: "Wuschel will einmal das eigene Wetter bestimmen und ausgerechnet an einem wichtigen Tag etwas ganz anderes fühlen.",
    runningGag: "Wuschel kündigt stolzes Schönwetter an, während ein winziges Wölkchen die wirkliche Stimmung verrät. Beim Verstecken wird das Wetter nur auffälliger; ehrliche Freude kommt ganz ungeplant.",
    secret: "Wuschel mag einen leisen Regen besonders gern und nennt ihn vor anderen noch schlechtes Wetter.",
  },
  "Yara Wellenklang": {
    score: 7.5, want: "Sie will eine Meeresmelodie vervollständigen und muss dafür einen Klang zulassen, den sie bisher falsch nennt.",
    runningGag: "Yara stimmt alles sorgfältig aufeinander ab und verbessert einen eigensinnigen Ton. Ohne ihn fehlt ihrer perfekten Melodie etwas; sie spielt ihn nach und tut, als habe er auf sie gewartet.",
    secret: "Eine Stelle ihres eigenen Lieds kann sie nicht allein spielen. Dafür braucht sie eine ungewohnte zweite Stimme.",
  },
  "Zauberer Sternenschweif": {
    score: 7, want: "Er will einen Papierdrachen ohne Magie steigen lassen und dabei wie ein großer Zauberer aussehen.",
    runningGag: "Sternenschweif rät zu Geduld und erklärt dabei sehr ausführlich, weshalb es bei seinem eigenen Wunsch diesmal eilig ist. Ein Lehrling gibt ihm mit größtem Ernst seinen Rat zurück.",
    secret: "Er kann Sternbahnen beschreiben, weiß aber nicht, wie ein gewöhnlicher Papierdrachen richtig angebunden wird.",
    introLine: "Sternenschweif. Nichts überstürzen. Bei meinem Anliegen wären fünf Minuten allerdings sehr willkommen.",
  },
  "Zauberer Merlin": {
    score: 6.5, want: "Er will seine verwunschene Werkstatt ordnen und keinen seiner angeblich unentbehrlichen Gegenstände hergeben.",
    runningGag: "Merlin räumt etwas per Zauber weg und braucht es gleich darauf wieder. Seine würdigen Erklärungen werden knapper, während aus dem neuen Versteck ein störendes Klingeln kommt.",
    secret: "Sein wertvollster Gegenstand ist völlig unmagisch. Gerade den hat er zwischen den großen Wundern verlegt.",
    introLine: "Merlin. Alles hat hier seinen Platz. Welchen, untersuchen wir gleich.",
  },
};
