/* Mitternachts-Alibi v2: Orte, Bilder zum Merken, Fälle, Erzählertexte (Kommissar Tavi), Flüstertexte, Spuren.
 * Alles, was das Spiel spricht, steht hier in EINER Liste (clips). Aus ihr entsteht auch Stimmen.json.
 * Regel für alle gesprochenen Zeilen: KEINE Spielernamen. Figurennamen und Zahlen sind eigene kleine Clips. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KMContent = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SLOTS = [
    { id: 0, name: 'Abend', time: '19 Uhr', icon: '🌆', pub: 'Der Abend.', whisper: 'Der Abend.' },
    { id: 1, name: 'Mitternacht', time: '24 Uhr', icon: '🌙', pub: 'Mitternacht.', whisper: 'Mitternacht.' },
    { id: 2, name: 'Morgengrauen', time: '5 Uhr', icon: '🌅', pub: 'Das Morgengrauen.', whisper: 'Das Morgengrauen.' }
  ];
  var NUM_WORDS = ['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht'];

  /* Orte: Farbe und Bild helfen Kindern, sie sofort wiederzuerkennen. */
  var PLACES = {
    baeckerei: { name: 'die Bäckerei', at: 'in der Bäckerei', icon: '🥖', short: 'Bäckerei', color: '#c8782f' },
    bibliothek: { name: 'die Bibliothek', at: 'in der Bibliothek', icon: '📚', short: 'Bibliothek', color: '#7a5aa6' },
    markt: { name: 'der Marktplatz', at: 'auf dem Marktplatz', icon: '🧺', short: 'Marktplatz', color: '#b8473f' },
    garten: { name: 'der Kräutergarten', at: 'im Kräutergarten', icon: '🌿', short: 'Garten', color: '#3f8f55' },
    turm: { name: 'der Uhrturm', at: 'im Uhrturm', icon: '🕰️', short: 'Uhrturm', color: '#4a6f9a' },
    bruecke: { name: 'die alte Brücke', at: 'auf der alten Brücke', icon: '🌉', short: 'Brücke', color: '#2f8c8c' },
    wirtshaus: { name: 'das Wirtshaus', at: 'im Wirtshaus', icon: '🍲', short: 'Wirtshaus', color: '#b9892b' },
    schmiede: { name: 'die Schmiede', at: 'in der Schmiede', icon: '🔨', short: 'Schmiede', color: '#8b4a3a' }
  };

  /* Was man an einem Ort sehen kann: je Ort 4 Bilder mit eigenem Geräusch. Wer dort war, kennt das Bild. Der Täter nicht.
   * Jedes Bild ist als Bild und als Geräusch leicht zu merken und kommt nur an einem Ort vor. */
  var SIGHTS = {
    baeckerei: [
      { id: 'maus', icon: '🐭', name: 'eine Maus im Mehlsack', sfx: 'A tiny mouse squeaking twice, close' },
      { id: 'hoernchen', icon: '🥐', name: 'ein riesiges Hörnchen', sfx: 'A crunchy bite into a big flaky croissant' },
      { id: 'kekse', icon: '🍪', name: 'ein Teller Kekse', sfx: 'A plate of cookies sliding onto a wooden table' },
      { id: 'ofen', icon: '🔥', name: 'ein Ofen, der Funken sprüht', sfx: 'A bread oven crackling and popping with sparks' }
    ],
    bibliothek: [
      { id: 'eule', icon: '🦉', name: 'eine Eule auf dem Regal', sfx: 'An owl hooting softly twice' },
      { id: 'kerze', icon: '🕯️', name: 'eine flackernde Kerze', sfx: 'A candle flame flickering, a tiny breath of wind' },
      { id: 'teddy', icon: '🧸', name: 'ein vergessener Teddy', sfx: 'A plush toy squeaking when it is squeezed' },
      { id: 'wurm', icon: '🐛', name: 'ein dicker Bücherwurm', sfx: 'A caterpillar munching on paper, tiny crunchy bites' }
    ],
    markt: [
      { id: 'ziege', icon: '🐐', name: 'eine Ziege, die Salat frisst', sfx: 'A goat bleating and then munching crunchy lettuce' },
      { id: 'aepfel', icon: '🍎', name: 'ein Karren voller Äpfel', sfx: 'Apples rolling and bumping inside a wooden cart' },
      { id: 'ballon', icon: '🎈', name: 'ein roter Luftballon', sfx: 'A balloon squeaking as it is rubbed, then a soft pop' },
      { id: 'huhn', icon: '🐔', name: 'ein Huhn auf Spaziergang', sfx: 'A hen clucking and scratching on cobblestones' }
    ],
    garten: [
      { id: 'schnecke', icon: '🐌', name: 'eine sehr langsame Schnecke', sfx: 'A slow wet squelchy slide, comical and tiny' },
      { id: 'schmetterling', icon: '🦋', name: 'ein blauer Schmetterling', sfx: 'Soft fluttering of delicate wings, a gentle chime' },
      { id: 'sonnenblume', icon: '🌻', name: 'eine riesige Sonnenblume', sfx: 'A big plant swaying in a breeze, leaves rustling' },
      { id: 'kaefer', icon: '🐞', name: 'ein Marienkäfer', sfx: 'A tiny beetle buzzing past, then landing' }
    ],
    turm: [
      { id: 'fledermaus', icon: '🦇', name: 'eine Fledermaus', sfx: 'A bat squeaking and flapping past' },
      { id: 'taube', icon: '🕊️', name: 'eine weiße Taube', sfx: 'A dove cooing, a soft flutter of wings' },
      { id: 'netz', icon: '🕸️', name: 'ein riesiges Spinnennetz', sfx: 'A spider web twanging like a tiny harp string' },
      { id: 'wecker', icon: '⏰', name: 'ein klingelnder Wecker', sfx: 'A loud old fashioned alarm clock ringing for two seconds' }
    ],
    bruecke: [
      { id: 'enten', icon: '🦆', name: 'eine Entenfamilie', sfx: 'A duck family quacking, one small duckling peeping' },
      { id: 'frosch', icon: '🐸', name: 'ein singender Frosch', sfx: 'A frog croaking three times near water' },
      { id: 'fisch', icon: '🐟', name: 'ein springender Fisch', sfx: 'A fish jumping out of water with a splash' },
      { id: 'angel', icon: '🎣', name: 'eine Angel ohne Fisch', sfx: 'A fishing reel whirring and a line plopping into water' }
    ],
    wirtshaus: [
      { id: 'geige', icon: '🎻', name: 'ein Geiger, der übt', sfx: 'A violin playing a short wobbly cheerful tune' },
      { id: 'katze', icon: '🐈', name: 'eine schlafende Katze', sfx: 'A cat purring deeply, very close' },
      { id: 'kaese', icon: '🧀', name: 'ein riesiges Stück Käse', sfx: 'A knife cutting through a big round cheese, a cheerful clink' },
      { id: 'tanz', icon: '🕺', name: 'ein tanzender Gast', sfx: 'Stomping happy dance steps on a wooden floor' }
    ],
    schmiede: [
      { id: 'pferd', icon: '🐎', name: 'ein Pferd, das Hufeisen anprobiert', sfx: 'A horse snorting and stamping a hoof' },
      { id: 'funken', icon: '🎇', name: 'ein Funkenregen', sfx: 'Sparks hissing and crackling from a hot anvil' },
      { id: 'schild', icon: '🛡️', name: 'ein glänzender Schild', sfx: 'A hammer tapping a metal shield with a ringing clang' },
      { id: 'gold', icon: '💰', name: 'ein Beutel Gold', sfx: 'A pouch of coins jingling when it is shaken' }
    ]
  };

  /* Die Fälle. Jeder hat einen festen Tatort. */
  var CASES = [
    { id: 'laterne', title: 'Die Sternenlaterne', crime: 'turm', loot: 'die Sternenlaterne', lootIcon: '🏮',
      intro: 'Kicherwald, mitten in der Nacht. Im Uhrturm leuchtete hundert Jahre lang die Sternenlaterne. Jetzt ist der Turm dunkel, und die Laterne ist weg. Einer von euch war es. Ich bin Kommissar Tavi, und ich finde ihn.',
      solved: 'Fall gelöst. Die Sternenlaterne leuchtet wieder, und Kicherwald findet nachts nach Hause. Zumindest bis zum nächsten Rätsel.',
      escaped: 'Und so bleibt die Sternenlaterne verschwunden. Irgendwo in Kicherwald brennt heute Nacht ein Licht, das nicht hierher gehört. Die Akte bleibt offen.' },
    { id: 'kuchen', title: 'Der Geburtstagskuchen des Königs', crime: 'baeckerei', loot: 'der Geburtstagskuchen des Königs', lootIcon: '🎂',
      intro: 'Kicherwald, mitten in der Nacht. In der Bäckerei stand der Geburtstagskuchen des Königs, drei Stockwerke hoch. Jetzt liegen dort nur noch Krümel. Einer von euch hat Zucker an den Fingern. Ich bin Kommissar Tavi, und ich finde ihn.',
      solved: 'Fall gelöst. Der Kuchen ist zurück, ein kleines Stück fehlt, und der König ist gnädig. Alle dürfen mitessen.',
      escaped: 'Der Kuchen ist fort, und der König feiert mit einem Brötchen. Irgendwo in Kicherwald sitzt jemand mit vollem Bauch und leerem Gewissen. Die Akte bleibt offen.' },
    { id: 'rezept', title: 'Das goldene Rezeptbuch', crime: 'wirtshaus', loot: 'das goldene Rezeptbuch', lootIcon: '📒',
      intro: 'Kicherwald, mitten in der Nacht. Im Wirtshaus lag das goldene Rezeptbuch mit dem Geheimnis der berühmten Linsensuppe. Jetzt ist die Truhe leer. Einer von euch hat plötzlich großen Appetit. Ich bin Kommissar Tavi, und ich finde ihn.',
      solved: 'Fall gelöst. Das Rezeptbuch liegt wieder in der Truhe, und die Linsensuppe gelingt weiter wie immer. Fast.',
      escaped: 'Das Rezeptbuch bleibt verschwunden. Irgendwo in Kicherwald köchelt heute eine Suppe, die verdächtig gut schmeckt. Die Akte bleibt offen.' },
    { id: 'mondstein', title: 'Der Mondstein', crime: 'bibliothek', loot: 'der Mondstein', lootIcon: '💎',
      intro: 'Kicherwald, mitten in der Nacht. In der Bibliothek lag der Mondstein, der leise summt, wenn jemand die Wahrheit sagt. Jetzt liegt dort nur noch die Glashaube. Einer von euch hat ihn eingesteckt. Ich bin Kommissar Tavi, und ich finde ihn.',
      solved: 'Fall gelöst. Der Mondstein summt wieder unter seiner Haube, und diesmal summt er zufrieden.',
      escaped: 'Der Mondstein bleibt verschwunden. In Kicherwald summt heute Nacht etwas, und niemand weiß, wo. Die Akte bleibt offen.' },
    { id: 'glocke', title: 'Die Marktglocke', crime: 'markt', loot: 'die Marktglocke', lootIcon: '🔔',
      intro: 'Kicherwald, mitten in der Nacht. Auf dem Marktplatz hing die Marktglocke, die jeden Morgen den Handel einläutet. Jetzt hängt dort nur noch das Seil. Einer von euch hat sehr leise Schuhe. Ich bin Kommissar Tavi, und ich finde ihn.',
      solved: 'Fall gelöst. Die Marktglocke hängt wieder am Seil, und der Handel beginnt pünktlich. Wie ein Uhrwerk.',
      escaped: 'Die Marktglocke bleibt verschwunden. Morgen früh wird es auf dem Markt sehr leise sein, und einer von euch weiß, warum. Die Akte bleibt offen.' },
    { id: 'honig', title: 'Der Honigtopf des Jahres', crime: 'garten', loot: 'der Honigtopf des Jahres', lootIcon: '🍯',
      intro: 'Kicherwald, mitten in der Nacht. Im Kräutergarten stand der Honigtopf des Jahres, bewacht von zwei Bienen. Jetzt ist er weg, und die Bienen sind sehr böse. Einer von euch klebt. Ich bin Kommissar Tavi, und ich finde ihn.',
      solved: 'Fall gelöst. Der Honigtopf ist zurück, die Bienen sind versöhnt, und der Sommer schmeckt wieder wie früher.',
      escaped: 'Der Honigtopf bleibt verschwunden. Irgendwo in Kicherwald klebt jemand sehr zufrieden an seinem Löffel. Die Akte bleibt offen.' },
    { id: 'hufeisen', title: 'Das Glückshufeisen', crime: 'schmiede', loot: 'das Glückshufeisen', lootIcon: '🍀',
      intro: 'Kicherwald, mitten in der Nacht. Über der Tür der Schmiede hing das Glückshufeisen, das das ganze Dorf zusammenhält. Jetzt hängt dort nur noch ein Nagel. Einer von euch hat plötzlich viel Glück. Ich bin Kommissar Tavi, und ich finde ihn.',
      solved: 'Fall gelöst. Das Hufeisen hängt wieder über der Tür, und das Dorf hält wieder zusammen. Nagel inbegriffen.',
      escaped: 'Das Glückshufeisen bleibt verschwunden. Wer es hat, hat Glück. Und das Dorf? Nun ja. Die Akte bleibt offen.' },
    { id: 'spieluhr', title: 'Die Spieluhr der Brücke', crime: 'bruecke', loot: 'die Spieluhr der Brücke', lootIcon: '🎶',
      intro: 'Kicherwald, mitten in der Nacht. An der alten Brücke hing die Spieluhr, die jeden Abend das Brückenlied spielt. Heute verstummte sie mitten im Lied. Einer von euch summt auffällig die zweite Strophe. Ich bin Kommissar Tavi, und ich finde ihn.',
      solved: 'Fall gelöst. Die Spieluhr hängt wieder an der Brücke und spielt die zweite Strophe zu Ende. Es war höchste Zeit.',
      escaped: 'Die Spieluhr bleibt verschwunden. Das Brückenlied bleibt unvollendet, und irgendwo spielt jemand heimlich die zweite Strophe. Die Akte bleibt offen.' }
  ];

  /* Stufen für die Auswahl */
  var LEVEL_INFO = {
    mini: { icon: '🐣', n: 'Mini-Detektive', age: 'ab 5', d: 'Alles per Bild und Stimme. 2 Akte. Das Dorf zeigt Widersprüche an. Ein Unschuldiger war auch allein.' },
    junior: { icon: '🔍', n: 'Junior-Detektive', age: 'ab 7', d: '3 Akte. Das Dorf zeigt Widersprüche an. Zwei Anklagen.' },
    detektiv: { icon: '🕵️', n: 'Detektiv', age: 'ab 10', d: '3 Akte. Keine Hilfen, eine Anklage. Auch das Geschlecht ist eine Spur.' },
    meister: { icon: '🎩', n: 'Meisterdetektiv', age: 'Erwachsene', d: 'Zwei Unschuldige ohne Zeugen, drei Spuren, kürzere Verhöre.' }
  };

  /* ---------- Erzähler (Kommissar Tavi), öffentlich, namenlos ---------- */
  var KOM = {};
  function add(id, text) { KOM[id] = text; }
  CASES.forEach(function (c) { add('kom.case.' + c.id + '.intro', c.intro); add('kom.case.' + c.id + '.solved', c.solved); add('kom.case.' + c.id + '.escaped', c.escaped); });

  add('kom.welcome', 'Willkommen in Kicherwald! Hier ist heute Nacht etwas verschwunden, und einer von euch war es. Ich bin Kommissar Tavi. Tippt auf den goldenen Knopf, dann fangen wir an.');
  add('kom.tour.1', 'In Kicherwald ist in der Nacht etwas verschwunden. Jemand hat es gestohlen. Und dieser Jemand sitzt gerade mit euch am Tisch.');
  add('kom.tour.2', 'Jeder bekommt eine Figur und eine Nummer. Merkt euch beides. Jede Figur hat einen farbigen Rand und sogar ihre eigene Stimme.');
  add('kom.tour.3', 'Dann klingelt das Geheimtelefon. Haltet das Handy ans Ohr, und ich flüstere euch zu, wo ihr wart und wen ihr dort gesehen habt.');
  add('kom.tour.4', 'Alle sagen die Wahrheit. Nur der Dieb muss flunkern. Er denkt sich einen Ort aus, an dem er angeblich war. Aber er weiß nicht, was man dort gesehen hat.');
  add('kom.tour.5', 'Dann rufe ich zwei Zeugen auf, die angeblich am selben Ort waren. Auf drei zeigen beide auf das Bild, das sie dort gesehen haben. Wer flunkert, muss raten.');
  add('kom.tour.6', 'Am Ende zeigen alle auf drei auf den Dieb. Habt ihr ihn erwischt, gewinnt ihr zusammen. Wenn nicht, lacht er zuletzt.');

  /* Erklär-Knopf: jeder Schritt hat eine kurze Sprechhilfe */
  add('kom.help.setup', 'Wie viele spielen mit? Tippt auf die Zahl. Dann sucht ihr eine Stufe aus. Für den Anfang nehmt ihr die Mini-Detektive.');
  add('kom.help.cast', 'Das Handy zeigt dir deine Figur und deine Nummer. Schau sie dir gut an, dann gibst du es weiter.');
  add('kom.help.case', 'Hier hört ihr, was gestohlen wurde und wo. Tippt auf den goldenen Knopf, wenn ihr bereit seid.');
  add('kom.help.act', 'Gleich geht das Geheimtelefon reihum. Tippt auf den goldenen Knopf, wenn ihr bereit seid.');
  add('kom.help.hand', 'Gib das Handy an die Nummer, die auf dem Bildschirm steht. Alle anderen schauen weg.');
  add('kom.help.whisper', 'Halte das Handy ans Ohr. Ich flüstere dir, wo du warst. Tippe auf den goldenen Knopf, wenn du fertig bist.');
  add('kom.help.lie', 'Such dir einen Ort aus, an dem du angeblich warst. Du darfst auch Figuren antippen, die angeblich bei dir waren. Dann tippe auf den goldenen Knopf.');
  add('kom.help.announce', 'Jetzt hören alle, was du sagst. Danach gibst du das Handy weiter.');
  add('kom.help.talk', 'Jetzt wird geredet. Schaut auf die Dorfkarte: Wer war wo? Tippt auf eine Figur, dann höre ich ihre Aussage noch einmal vor.');
  add('kom.help.duel', 'Legt das Handy in die Mitte. Auf drei zeigen die beiden Zeugen auf das Bild, das sie dort gesehen haben.');
  add('kom.help.vote', 'Besprecht euch. Dann zähle ich runter, und alle zeigen gleichzeitig auf den, den sie für den Dieb halten.');
  add('kom.help.point', 'Tippt auf die Figur, auf die die meisten gezeigt haben.');
  add('kom.help.reveal', 'Gleich dreht sich die Karte um.');
  add('kom.help.end', 'Hier seht ihr, was wirklich geschah. Tippt auf den goldenen Knopf für einen neuen Fall.');

  /* Besetzung */
  add('kom.cast.start', 'Die Besetzung wird ausgelost. Jeder bekommt eine Figur und eine Nummer. Gib das Handy rum, immer im Kreis.');
  add('kom.cast.macke', 'Typische Macke:');
  add('kom.cast.pass.1', 'Gut. Gib das Handy an die nächste Person im Kreis.');
  add('kom.cast.pass.2', 'Weiterreichen, bitte. Der Nächste im Kreis ist dran.');
  add('kom.cast.done', 'Die Besetzung steht! Jeder kennt seine Figur und seine Nummer. Das sind eure Verdächtigen.');

  /* Akte */
  add('kom.act.0.1', 'Der Abend in Kicherwald. Die Hühner gehen schlafen, die Katzen erst später. Jeder ist irgendwo, und jeder sieht jemanden.');
  add('kom.act.0.2', 'Es wird Abend im Dorf. Die Laternen gehen an, der Bäcker gähnt, und alle gehen ihrer Wege. Gleich erfahrt ihr, wo ihr wart.');
  add('kom.act.0.3', 'Der Abend beginnt. Im Wirtshaus wird gelacht, auf der Brücke geangelt, und irgendwo ist jemand ziemlich leise.');
  add('kom.act.1.pre', 'Es wird Mitternacht. Zählt die Glockenschläge mit!');
  add('kom.act.1.post.1', 'Zwölf! Und genau jetzt ist es passiert. Das Geheimtelefon klingelt wieder.');
  add('kom.act.1.post.2', 'Zwölf Schläge. Irgendwo in Kicherwald war jemand sehr, sehr leise.');
  add('kom.act.2.1', 'Das Morgengrauen. Der Hahn kräht, der Nebel zieht ab, und alle sind müde. Wo wart ihr jetzt?');
  add('kom.act.2.2', 'Draußen wird es hell. Der Bäcker schimpft, die Vögel singen, und niemand hat gut geschlafen.');
  add('kom.act.done.0', 'Der Abend ist notiert. Schaut auf die Dorfkarte: Wer war wo?');
  add('kom.act.done.1', 'Mitternacht ist notiert. Nur noch das Morgengrauen.');
  add('kom.act.done.last', 'Alle Aussagen sind notiert. Jetzt beginnt das Verhör.');

  /* Weitergeben und Aussagen */
  add('kom.hand.pre.1', 'Das Geheimtelefon klingelt für:');
  add('kom.hand.pre.2', 'Gib das Handy an:');
  add('kom.hand.pre.3', 'Der nächste Anruf ist für:');
  add('kom.hand.post', 'Handy ans Ohr! Alle anderen schauen weg.');
  add('kom.hand.first', 'Gleich geht das Geheimtelefon reihum. Wer dran ist, hält das Handy ans Ohr, und ich flüstere ihm etwas zu.');
  add('kom.ann.end.1', 'Notiert.');
  add('kom.ann.end.2', 'Das steht jetzt im Protokoll.');
  add('kom.ann.end.3', 'Zur Kenntnis genommen.');
  add('kom.ann.with', 'Dabei:');
  add('kom.ann.alone', 'Ganz allein.');
  add('kom.and', 'und');

  /* Verhör */
  add('kom.round.1', 'Das Verhör beginnt. Schaut auf die Dorfkarte. Wer war wo? Und wer war nicht dort, wo er sagt?');
  add('kom.round.2', 'Zweite Runde. Wer jetzt noch ganz ruhig bleibt, hat entweder nichts zu verbergen oder sehr viel.');
  add('kom.round.3', 'Dritte Runde. Die Zeit wird knapp. Gleich ist Anklage.');
  add('kom.einspruch.1', 'Einspruch!');
  add('kom.einspruch.2', 'Moment mal!');
  add('kom.einspruch.3', 'Das riecht nach einem Widerspruch!');
  add('kom.einspruch.more', 'Und es gibt noch mehr Widersprüche.');
  add('kom.einspruch.out.1', 'sind sich nicht einig.');
  add('kom.einspruch.out.2', 'erzählen nicht dasselbe.');
  add('kom.einspruch.out.3', 'passen nicht zusammen.');
  add('kom.alone.pre', 'Der Gerichtsschreiber meldet: Um Mitternacht hat niemand gesehen:');
  add('kom.alone.post.1', 'Das kann Zufall sein. Muss es aber nicht.');
  add('kom.alone.post.2', 'Wer allein ist, hat keinen Zeugen. Das ist verdächtig, aber nicht verboten.');
  add('kom.time.10', 'Nur noch zehn Sekunden.');
  add('kom.time.up', 'Die Zeit ist um.');

  /* Zeugen-Duell */
  add('kom.duel.call.1', 'Zeugen-Duell!');
  add('kom.duel.call.2', 'Ich rufe zwei Zeugen auf!');
  add('kom.duel.call.3', 'Achtung, Zeugen-Duell!');
  add('kom.duel.who', 'Ich rufe auf:');
  add('kom.duel.ask', 'Was habt ihr dort gesehen? Legt das Handy in die Mitte. Auf drei zeigt ihr beide auf euer Bild.');
  add('kom.duel.same.1', 'Gleiche Antwort! Das passt.');
  add('kom.duel.same.2', 'Beide zeigen aufs selbe Bild. Verdächtig einig.');
  add('kom.duel.same.3', 'Zwei Zeugen, ein Bild. Schön.');
  add('kom.duel.diff.1', 'Verschiedene Bilder! Da stimmt etwas nicht. Einer hat sich geirrt oder geflunkert.');
  add('kom.duel.diff.2', 'Zwei Zeugen, zwei Bilder. Das gefällt mir nicht.');
  add('kom.duel.diff.3', 'Aha. Da hat jemand geraten.');
  add('kom.duel.none', 'Heute gibt es keine zwei Zeugen am selben Ort. Dann fragt euch gegenseitig.');

  /* Fragekarten fürs Verhör, mit Bild */
  var PROMPTS = [
    { icon: '🗣️', text: 'Alle machen die Stimme ihrer Figur nach und sagen: Ich war es nicht!' },
    { icon: '👂', text: 'Frag die Figur neben dir: Wer hat dich gesehen?' },
    { icon: '✋', text: 'Wer war um Mitternacht nicht allein? Alle, die nicht allein waren, melden sich!' },
    { icon: '🔊', text: 'Alle machen gleichzeitig das Geräusch nach, das an ihrem Ort zu hören war.' },
    { icon: '👀', text: 'Alle schauen reihum drei Sekunden in die Augen. Wer zuerst lacht, ist verdächtig!' },
    { icon: '🧭', text: 'Erzähl in einem Satz, wie du vom Abend zur Mitternacht gekommen bist.' },
    { icon: '🎭', text: 'Spiel die Macke deiner Figur vor. Die anderen schauen ganz genau hin.' },
    { icon: '🤝', text: 'Wer war am Abend mit jemandem zusammen? Zeigt auf euren Abend-Begleiter.' },
    { icon: '👆', text: 'Probe-Zeigen! Auf drei zeigen alle auf ihren Verdächtigen. Noch ist es keine Anklage.' },
    { icon: '👃', text: 'Beschreibe in drei Wörtern, wie es um Mitternacht an deinem Ort roch.' }
  ];
  PROMPTS.forEach(function (p, i) { add('kom.prompt.' + (i + 1), p.text); });

  /* Spuren */
  add('kom.spur.next.1', 'Das Labor meldet eine Spur.');
  add('kom.spur.next.2', 'Eilmeldung aus dem Labor!');
  add('kom.spur.next.3', 'Das Labor hat etwas gefunden.');
  var SPUR = {
    fam: { Blau: 'Am Tatort liegt ein blauer Faden.', Braun: 'Am Tatort liegt ein brauner Faden.', Gelb: 'Am Tatort liegt ein gelber Faden.', Weiß: 'Am Tatort liegt ein weißer Faden.', Rot: 'Am Tatort liegt ein roter Faden.',
      Grau: 'Am Tatort liegt ein grauer Faden.', Grün: 'Am Tatort liegt ein grüner Faden.', Lila: 'Am Tatort liegt ein lilafarbener Faden.', Schwarz: 'Am Tatort liegt ein schwarzer Faden.', Rosa: 'Am Tatort liegt ein rosa Faden.', Orange: 'Am Tatort liegt ein orangefarbener Faden.' },
    szc: { klein: 'Die Fußspuren sind winzig. Der Dieb ist klein.', mittel: 'Die Fußspuren sind ganz normal groß. Der Dieb ist mittelgroß.', groß: 'Die Fußspuren sind riesig. Der Dieb ist groß.' },
    spc: { Mensch: 'Es gibt Schuhabdrücke. Der Dieb ist ein Mensch.', Tier: 'Es gibt Pfotenabdrücke. Der Dieb ist ein Tier.', Zauberwesen: 'Es glitzert am Tatort. Der Dieb ist ein Zauberwesen.' },
    gdr: { männlich: 'Jemand hat eine tiefe Stimme gehört. Der Dieb ist männlich.', weiblich: 'Jemand hat eine helle Stimme gehört. Der Dieb ist weiblich.', neutral: 'Jemand hat eine Stimme gehört, die weder tief noch hell war. Der Dieb ist weder Mann noch Frau.' }
  };
  var SPUR_LABEL = { fam: 'Kennfarbe', szc: 'Größe', spc: 'Art', gdr: 'Geschlecht' };
  var SPUR_ICON = { fam: '🎨', szc: '📏', spc: '🐾', gdr: '🚻' };
  var SPC_ICON = { Mensch: '🧍', Tier: '🐾', Zauberwesen: '✨' };
  var GDR_ICON = { männlich: '♂️', weiblich: '♀️', neutral: '⚪' };
  Object.keys(SPUR).forEach(function (k) { Object.keys(SPUR[k]).forEach(function (v) { add('kom.spur.' + k + '.' + v, SPUR[k][v]); }); });

  /* Anklage und Auflösung */
  add('kom.accuse.1', 'Jetzt ist es Zeit für die Anklage. Wer war es? Auf drei zeigt ihr alle auf euren Verdächtigen.');
  add('kom.vote', 'Drei. Zwei. Eins. Zeigt!');
  add('kom.reveal.ask', 'Tritt vor. Ist das der Dieb? Tippt auf den goldenen Knopf, dann dreht sich die Karte um.');
  add('kom.accuse.2', 'Trommelwirbel! Die Karte wird umgedreht.');
  add('kom.guilty.1', 'Schuldig! Der Dieb ist überführt.');
  add('kom.guilty.2', 'Erwischt! Das war der Dieb.');
  add('kom.guilty.3', 'Und der Vorhang fällt: Das ist der Dieb.');
  add('kom.innocent.1', 'Unschuldig! Das war der Falsche.');
  add('kom.innocent.2', 'Falsch! Der Verdächtige ist unschuldig, aber ein bisschen beleidigt.');
  add('kom.innocent.3', 'Autsch. Das war der Falsche.');
  add('kom.second', 'Eine falsche Fährte. Ihr habt noch eine Anklage, aber nur diese eine.');
  add('kom.rebuild', 'Hier ist, was in dieser Nacht wirklich geschah.');

  /* ---------- Flüstertexte (Geheimtelefon, privat) ---------- */
  var W = {};
  function addW(id, text) { W[id] = text; }
  addW('w.with.1', 'Bei dir war:');
  addW('w.with.n', 'Bei dir waren:');
  addW('w.alone', 'Du warst ganz allein.');
  addW('w.saw', 'Du hast dort gesehen:');
  addW('w.and', 'und');
  addW('w.remember', 'Merk dir das gut.');
  addW('w.loner', 'Allein um Mitternacht? Das sieht verdächtig aus. Aber du bist unschuldig. Bleib ruhig.');
  addW('w.culprit.1', 'Psst. Du warst es. Du warst um Mitternacht ganz allein am Tatort und hast es mitgenommen. Niemand hat dich gesehen.');
  addW('w.culprit.2', 'Such dir jetzt ein Alibi aus. Tippe auf einen Ort, an dem du angeblich warst.');
  addW('w.culprit.3', 'Gut. Du darfst auch Figuren antippen, die angeblich bei dir waren. Aber Vorsicht: Die wissen, wo sie wirklich waren.');
  addW('w.culprit.ready', 'Fertig? Dann tippe auf den goldenen Knopf. Ab jetzt musst du so tun, als wäre alles wahr.');

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function placeWhisper(id) { return 'Du warst ' + PLACES[id].at + '.'; }
  function placePublic(id) { return cap(PLACES[id].at) + '.'; }

  /* Eigenschaften-Vorschau für das Talea-Eigenschaftensystem (Beispiel, wird nicht gespeichert) */
  function traitFor(role, won) {
    if (role === 'culprit') return won ? { trait: 'Kreativität', icon: '🎨', why: 'hat ein Alibi erfunden, das bis zum Schluss gehalten hat' } : { trait: 'Mut', icon: '🦁', why: 'hat sich dem Verhör gestellt und die Wahrheit gestanden' };
    return won ? { trait: 'Logik', icon: '🔢', why: 'hat mit den anderen Widersprüche aufgedeckt und den Täter gefunden' } : { trait: 'Ausdauer', icon: '🧗', why: 'hat bis zum Schluss mitgerätselt, auch als es schwer wurde' };
  }

  /* Tags für ElevenLabs (Audio-Tags am Textanfang) */
  function tavTag(id) {
    if (/einspruch\.\d$/.test(id)) return '[sharp, sudden]';
    if (/duel\.call|kom\.vote|guilty/.test(id)) return '[energetic, dramatic]';
    if (/case\.[a-z]+\.intro/.test(id)) return '[calm, slow, noir narrator]';
    if (/escaped$/.test(id)) return '[quietly, a little wry]';
    if (/solved$/.test(id)) return '[warm, relieved]';
    if (/innocent|diff|alone/.test(id)) return '[dry, amused]';
    if (/tour|help|welcome/.test(id)) return '[friendly, clear, patient]';
    return '[calm, measured]';
  }
  var CHAR_TAGS = { intro: '[confident, in character]', stmt: '[calm, matter-of-fact]', deny: '[indignant]', confess: '[quietly, resigned]', smug: '[smug, quietly laughing]' };

  /* Die gesamte Sprechliste. prio: 1 = Kern, 2 = Figuren-Auftritt und Fallenden, 3 = Zugaben */
  function clips(chars) {
    var R = {};
    function put(id, text, o) {
      var e = { text: text, voice: 'Kommissar Tavi', kind: 'tavi', tag: '[calm, measured]', prio: 1, whisper: false };
      if (o) Object.keys(o).forEach(function (k) { e[k] = o[k]; });
      R[id] = e;
    }
    Object.keys(KOM).forEach(function (id) { put(id, KOM[id], { tag: tavTag(id), prio: /\.(solved|escaped)$/.test(id) ? 2 : 1 }); });
    NUM_WORDS.forEach(function (w, i) { var t = 'Nummer ' + w + '.', tc = 'Nummer ' + w + ',';
      put('num.' + (i + 1), t, { kind: 'zahl', tag: '[clear, announcer]' }); put('w.num.' + (i + 1), t, { kind: 'zahl', tag: '[whispers]', whisper: true });
      put('numc.' + (i + 1), tc, { kind: 'zahl', tag: '[clear, announcer, continuing]' }); put('w.numc.' + (i + 1), tc, { kind: 'zahl', tag: '[whispers, continuing]', whisper: true }); });
    SLOTS.forEach(function (s) { put('act.' + s.id, s.pub, { kind: 'akt', tag: '[clear, announcer]' }); put('w.act.' + s.id, s.whisper, { kind: 'akt', tag: '[whispers]', whisper: true }); });
    Object.keys(PLACES).forEach(function (id) { put('place.' + id, placePublic(id), { kind: 'ort', tag: '[clear, announcer]' }); put('w.place.' + id, placeWhisper(id), { kind: 'ort', tag: '[whispers]', whisper: true }); });
    Object.keys(SIGHTS).forEach(function (pid) { SIGHTS[pid].forEach(function (s) { var t = cap(s.name) + '.'; put('sight.' + s.id, t, { kind: 'bild', tag: '[clear, curious]', sfx: s.sfx }); put('w.sight.' + s.id, t, { kind: 'bild', tag: '[whispers]', whisper: true, sfx: s.sfx }); }); });
    Object.keys(W).forEach(function (id) { put(id, W[id], { tag: '[whispers]', whisper: true, kind: 'flüstern' }); });
    (chars || []).forEach(function (c) {
      put('name.' + c.s, c.n + '.', { kind: 'name', tag: '[clear, announcer]' });
      put('character.' + c.s + '.quirk', cap(c.q) + '.', { kind: 'macke', tag: '[amused, dry]', prio: 3 });
      ['intro', 'stmt', 'deny', 'confess', 'smug'].forEach(function (k) {
        put('character.' + c.s + '.' + k, c[k], { voice: c.n, kind: 'figur', tag: CHAR_TAGS[k], prio: (k === 'intro' || k === 'stmt') ? 2 : 3, voiceDesign: c.voice, note: 'Figur ' + c.n + ', Zeile „' + k + '“' });
      });
    });
    return R;
  }

  /* Varianten: kom.act.0.1, kom.act.0.2 ... */
  function variants(prefix) { var out = [], i = 1; while (KOM[prefix + '.' + i]) { out.push(prefix + '.' + i); i++; } return out; }

  return { SLOTS: SLOTS, PLACES: PLACES, SIGHTS: SIGHTS, CASES: CASES, KOM: KOM, W: W, PROMPTS: PROMPTS, SPUR: SPUR, SPUR_LABEL: SPUR_LABEL, SPUR_ICON: SPUR_ICON, SPC_ICON: SPC_ICON, GDR_ICON: GDR_ICON,
    LEVEL_INFO: LEVEL_INFO, NUM_WORDS: NUM_WORDS, clips: clips, variants: variants, traitFor: traitFor, cap: cap };
});
