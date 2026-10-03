/* Automatisch übernommen aus dem geprüften Prototyp (docs/games/mitternachts-alibi-v2/source/content.js).
 * Alle gesprochenen Zeilen sind namenlos (keine Spielernamen). Nicht von Hand auseinanderlaufen lassen:
 * Stimmen.json für ElevenLabs entsteht aus derselben Liste. */

export const SLOTS = [
  {
    "id": 0,
    "name": "Abend",
    "time": "19 Uhr",
    "icon": "🌆",
    "pub": "Der Abend.",
    "whisper": "Der Abend."
  },
  {
    "id": 1,
    "name": "Mitternacht",
    "time": "24 Uhr",
    "icon": "🌙",
    "pub": "Mitternacht.",
    "whisper": "Mitternacht."
  },
  {
    "id": 2,
    "name": "Morgengrauen",
    "time": "5 Uhr",
    "icon": "🌅",
    "pub": "Das Morgengrauen.",
    "whisper": "Das Morgengrauen."
  }
] as const;

export const PLACES = {
  "baeckerei": {
    "name": "die Bäckerei",
    "at": "in der Bäckerei",
    "icon": "🥖",
    "short": "Bäckerei",
    "color": "#c8782f"
  },
  "bibliothek": {
    "name": "die Bibliothek",
    "at": "in der Bibliothek",
    "icon": "📚",
    "short": "Bibliothek",
    "color": "#7a5aa6"
  },
  "markt": {
    "name": "der Marktplatz",
    "at": "auf dem Marktplatz",
    "icon": "🧺",
    "short": "Marktplatz",
    "color": "#b8473f"
  },
  "garten": {
    "name": "der Kräutergarten",
    "at": "im Kräutergarten",
    "icon": "🌿",
    "short": "Garten",
    "color": "#3f8f55"
  },
  "turm": {
    "name": "der Uhrturm",
    "at": "im Uhrturm",
    "icon": "🕰️",
    "short": "Uhrturm",
    "color": "#4a6f9a"
  },
  "bruecke": {
    "name": "die alte Brücke",
    "at": "auf der alten Brücke",
    "icon": "🌉",
    "short": "Brücke",
    "color": "#2f8c8c"
  },
  "wirtshaus": {
    "name": "das Wirtshaus",
    "at": "im Wirtshaus",
    "icon": "🍲",
    "short": "Wirtshaus",
    "color": "#b9892b"
  },
  "schmiede": {
    "name": "die Schmiede",
    "at": "in der Schmiede",
    "icon": "🔨",
    "short": "Schmiede",
    "color": "#8b4a3a"
  }
} as const;

export const SIGHTS = {
  "baeckerei": [
    {
      "id": "maus",
      "icon": "🐭",
      "name": "eine Maus im Mehlsack",
      "sfx": "A tiny mouse squeaking twice, close"
    },
    {
      "id": "hoernchen",
      "icon": "🥐",
      "name": "ein riesiges Hörnchen",
      "sfx": "A crunchy bite into a big flaky croissant"
    },
    {
      "id": "kekse",
      "icon": "🍪",
      "name": "ein Teller Kekse",
      "sfx": "A plate of cookies sliding onto a wooden table"
    },
    {
      "id": "ofen",
      "icon": "🔥",
      "name": "ein Ofen, der Funken sprüht",
      "sfx": "A bread oven crackling and popping with sparks"
    }
  ],
  "bibliothek": [
    {
      "id": "eule",
      "icon": "🦉",
      "name": "eine Eule auf dem Regal",
      "sfx": "An owl hooting softly twice"
    },
    {
      "id": "kerze",
      "icon": "🕯️",
      "name": "eine flackernde Kerze",
      "sfx": "A candle flame flickering, a tiny breath of wind"
    },
    {
      "id": "teddy",
      "icon": "🧸",
      "name": "ein vergessener Teddy",
      "sfx": "A plush toy squeaking when it is squeezed"
    },
    {
      "id": "wurm",
      "icon": "🐛",
      "name": "ein dicker Bücherwurm",
      "sfx": "A caterpillar munching on paper, tiny crunchy bites"
    }
  ],
  "markt": [
    {
      "id": "ziege",
      "icon": "🐐",
      "name": "eine Ziege, die Salat frisst",
      "sfx": "A goat bleating and then munching crunchy lettuce"
    },
    {
      "id": "aepfel",
      "icon": "🍎",
      "name": "ein Karren voller Äpfel",
      "sfx": "Apples rolling and bumping inside a wooden cart"
    },
    {
      "id": "ballon",
      "icon": "🎈",
      "name": "ein roter Luftballon",
      "sfx": "A balloon squeaking as it is rubbed, then a soft pop"
    },
    {
      "id": "huhn",
      "icon": "🐔",
      "name": "ein Huhn auf Spaziergang",
      "sfx": "A hen clucking and scratching on cobblestones"
    }
  ],
  "garten": [
    {
      "id": "schnecke",
      "icon": "🐌",
      "name": "eine sehr langsame Schnecke",
      "sfx": "A slow wet squelchy slide, comical and tiny"
    },
    {
      "id": "schmetterling",
      "icon": "🦋",
      "name": "ein blauer Schmetterling",
      "sfx": "Soft fluttering of delicate wings, a gentle chime"
    },
    {
      "id": "sonnenblume",
      "icon": "🌻",
      "name": "eine riesige Sonnenblume",
      "sfx": "A big plant swaying in a breeze, leaves rustling"
    },
    {
      "id": "kaefer",
      "icon": "🐞",
      "name": "ein Marienkäfer",
      "sfx": "A tiny beetle buzzing past, then landing"
    }
  ],
  "turm": [
    {
      "id": "fledermaus",
      "icon": "🦇",
      "name": "eine Fledermaus",
      "sfx": "A bat squeaking and flapping past"
    },
    {
      "id": "taube",
      "icon": "🕊️",
      "name": "eine weiße Taube",
      "sfx": "A dove cooing, a soft flutter of wings"
    },
    {
      "id": "netz",
      "icon": "🕸️",
      "name": "ein riesiges Spinnennetz",
      "sfx": "A spider web twanging like a tiny harp string"
    },
    {
      "id": "wecker",
      "icon": "⏰",
      "name": "ein klingelnder Wecker",
      "sfx": "A loud old fashioned alarm clock ringing for two seconds"
    }
  ],
  "bruecke": [
    {
      "id": "enten",
      "icon": "🦆",
      "name": "eine Entenfamilie",
      "sfx": "A duck family quacking, one small duckling peeping"
    },
    {
      "id": "frosch",
      "icon": "🐸",
      "name": "ein singender Frosch",
      "sfx": "A frog croaking three times near water"
    },
    {
      "id": "fisch",
      "icon": "🐟",
      "name": "ein springender Fisch",
      "sfx": "A fish jumping out of water with a splash"
    },
    {
      "id": "angel",
      "icon": "🎣",
      "name": "eine Angel ohne Fisch",
      "sfx": "A fishing reel whirring and a line plopping into water"
    }
  ],
  "wirtshaus": [
    {
      "id": "geige",
      "icon": "🎻",
      "name": "ein Geiger, der übt",
      "sfx": "A violin playing a short wobbly cheerful tune"
    },
    {
      "id": "katze",
      "icon": "🐈",
      "name": "eine schlafende Katze",
      "sfx": "A cat purring deeply, very close"
    },
    {
      "id": "kaese",
      "icon": "🧀",
      "name": "ein riesiges Stück Käse",
      "sfx": "A knife cutting through a big round cheese, a cheerful clink"
    },
    {
      "id": "tanz",
      "icon": "🕺",
      "name": "ein tanzender Gast",
      "sfx": "Stomping happy dance steps on a wooden floor"
    }
  ],
  "schmiede": [
    {
      "id": "pferd",
      "icon": "🐎",
      "name": "ein Pferd, das Hufeisen anprobiert",
      "sfx": "A horse snorting and stamping a hoof"
    },
    {
      "id": "funken",
      "icon": "🎇",
      "name": "ein Funkenregen",
      "sfx": "Sparks hissing and crackling from a hot anvil"
    },
    {
      "id": "schild",
      "icon": "🛡️",
      "name": "ein glänzender Schild",
      "sfx": "A hammer tapping a metal shield with a ringing clang"
    },
    {
      "id": "gold",
      "icon": "💰",
      "name": "ein Beutel Gold",
      "sfx": "A pouch of coins jingling when it is shaken"
    }
  ]
} as const;

export const CASES = [
  {
    "id": "laterne",
    "title": "Die Sternenlaterne",
    "crime": "turm",
    "loot": "die Sternenlaterne",
    "lootIcon": "🏮",
    "intro": "Kicherwald, mitten in der Nacht. Im Uhrturm leuchtete hundert Jahre lang die Sternenlaterne. Jetzt ist der Turm dunkel, und die Laterne ist weg. Einer von euch war es. Ich bin Kommissar Tavi, und ich finde ihn.",
    "solved": "Fall gelöst. Die Sternenlaterne leuchtet wieder, und Kicherwald findet nachts nach Hause. Zumindest bis zum nächsten Rätsel.",
    "escaped": "Und so bleibt die Sternenlaterne verschwunden. Irgendwo in Kicherwald brennt heute Nacht ein Licht, das nicht hierher gehört. Die Akte bleibt offen."
  },
  {
    "id": "kuchen",
    "title": "Der Geburtstagskuchen des Königs",
    "crime": "baeckerei",
    "loot": "der Geburtstagskuchen des Königs",
    "lootIcon": "🎂",
    "intro": "Kicherwald, mitten in der Nacht. In der Bäckerei stand der Geburtstagskuchen des Königs, drei Stockwerke hoch. Jetzt liegen dort nur noch Krümel. Einer von euch hat Zucker an den Fingern. Ich bin Kommissar Tavi, und ich finde ihn.",
    "solved": "Fall gelöst. Der Kuchen ist zurück, ein kleines Stück fehlt, und der König ist gnädig. Alle dürfen mitessen.",
    "escaped": "Der Kuchen ist fort, und der König feiert mit einem Brötchen. Irgendwo in Kicherwald sitzt jemand mit vollem Bauch und leerem Gewissen. Die Akte bleibt offen."
  },
  {
    "id": "rezept",
    "title": "Das goldene Rezeptbuch",
    "crime": "wirtshaus",
    "loot": "das goldene Rezeptbuch",
    "lootIcon": "📒",
    "intro": "Kicherwald, mitten in der Nacht. Im Wirtshaus lag das goldene Rezeptbuch mit dem Geheimnis der berühmten Linsensuppe. Jetzt ist die Truhe leer. Einer von euch hat plötzlich großen Appetit. Ich bin Kommissar Tavi, und ich finde ihn.",
    "solved": "Fall gelöst. Das Rezeptbuch liegt wieder in der Truhe, und die Linsensuppe gelingt weiter wie immer. Fast.",
    "escaped": "Das Rezeptbuch bleibt verschwunden. Irgendwo in Kicherwald köchelt heute eine Suppe, die verdächtig gut schmeckt. Die Akte bleibt offen."
  },
  {
    "id": "mondstein",
    "title": "Der Mondstein",
    "crime": "bibliothek",
    "loot": "der Mondstein",
    "lootIcon": "💎",
    "intro": "Kicherwald, mitten in der Nacht. In der Bibliothek lag der Mondstein, der leise summt, wenn jemand die Wahrheit sagt. Jetzt liegt dort nur noch die Glashaube. Einer von euch hat ihn eingesteckt. Ich bin Kommissar Tavi, und ich finde ihn.",
    "solved": "Fall gelöst. Der Mondstein summt wieder unter seiner Haube, und diesmal summt er zufrieden.",
    "escaped": "Der Mondstein bleibt verschwunden. In Kicherwald summt heute Nacht etwas, und niemand weiß, wo. Die Akte bleibt offen."
  },
  {
    "id": "glocke",
    "title": "Die Marktglocke",
    "crime": "markt",
    "loot": "die Marktglocke",
    "lootIcon": "🔔",
    "intro": "Kicherwald, mitten in der Nacht. Auf dem Marktplatz hing die Marktglocke, die jeden Morgen den Handel einläutet. Jetzt hängt dort nur noch das Seil. Einer von euch hat sehr leise Schuhe. Ich bin Kommissar Tavi, und ich finde ihn.",
    "solved": "Fall gelöst. Die Marktglocke hängt wieder am Seil, und der Handel beginnt pünktlich. Wie ein Uhrwerk.",
    "escaped": "Die Marktglocke bleibt verschwunden. Morgen früh wird es auf dem Markt sehr leise sein, und einer von euch weiß, warum. Die Akte bleibt offen."
  },
  {
    "id": "honig",
    "title": "Der Honigtopf des Jahres",
    "crime": "garten",
    "loot": "der Honigtopf des Jahres",
    "lootIcon": "🍯",
    "intro": "Kicherwald, mitten in der Nacht. Im Kräutergarten stand der Honigtopf des Jahres, bewacht von zwei Bienen. Jetzt ist er weg, und die Bienen sind sehr böse. Einer von euch klebt. Ich bin Kommissar Tavi, und ich finde ihn.",
    "solved": "Fall gelöst. Der Honigtopf ist zurück, die Bienen sind versöhnt, und der Sommer schmeckt wieder wie früher.",
    "escaped": "Der Honigtopf bleibt verschwunden. Irgendwo in Kicherwald klebt jemand sehr zufrieden an seinem Löffel. Die Akte bleibt offen."
  },
  {
    "id": "hufeisen",
    "title": "Das Glückshufeisen",
    "crime": "schmiede",
    "loot": "das Glückshufeisen",
    "lootIcon": "🍀",
    "intro": "Kicherwald, mitten in der Nacht. Über der Tür der Schmiede hing das Glückshufeisen, das das ganze Dorf zusammenhält. Jetzt hängt dort nur noch ein Nagel. Einer von euch hat plötzlich viel Glück. Ich bin Kommissar Tavi, und ich finde ihn.",
    "solved": "Fall gelöst. Das Hufeisen hängt wieder über der Tür, und das Dorf hält wieder zusammen. Nagel inbegriffen.",
    "escaped": "Das Glückshufeisen bleibt verschwunden. Wer es hat, hat Glück. Und das Dorf? Nun ja. Die Akte bleibt offen."
  },
  {
    "id": "spieluhr",
    "title": "Die Spieluhr der Brücke",
    "crime": "bruecke",
    "loot": "die Spieluhr der Brücke",
    "lootIcon": "🎶",
    "intro": "Kicherwald, mitten in der Nacht. An der alten Brücke hing die Spieluhr, die jeden Abend das Brückenlied spielt. Heute verstummte sie mitten im Lied. Einer von euch summt auffällig die zweite Strophe. Ich bin Kommissar Tavi, und ich finde ihn.",
    "solved": "Fall gelöst. Die Spieluhr hängt wieder an der Brücke und spielt die zweite Strophe zu Ende. Es war höchste Zeit.",
    "escaped": "Die Spieluhr bleibt verschwunden. Das Brückenlied bleibt unvollendet, und irgendwo spielt jemand heimlich die zweite Strophe. Die Akte bleibt offen."
  }
] as const;

export const KOM = {
  "kom.case.laterne.intro": "Kicherwald, mitten in der Nacht. Im Uhrturm leuchtete hundert Jahre lang die Sternenlaterne. Jetzt ist der Turm dunkel, und die Laterne ist weg. Einer von euch war es. Ich bin Kommissar Tavi, und ich finde ihn.",
  "kom.case.laterne.solved": "Fall gelöst. Die Sternenlaterne leuchtet wieder, und Kicherwald findet nachts nach Hause. Zumindest bis zum nächsten Rätsel.",
  "kom.case.laterne.escaped": "Und so bleibt die Sternenlaterne verschwunden. Irgendwo in Kicherwald brennt heute Nacht ein Licht, das nicht hierher gehört. Die Akte bleibt offen.",
  "kom.case.kuchen.intro": "Kicherwald, mitten in der Nacht. In der Bäckerei stand der Geburtstagskuchen des Königs, drei Stockwerke hoch. Jetzt liegen dort nur noch Krümel. Einer von euch hat Zucker an den Fingern. Ich bin Kommissar Tavi, und ich finde ihn.",
  "kom.case.kuchen.solved": "Fall gelöst. Der Kuchen ist zurück, ein kleines Stück fehlt, und der König ist gnädig. Alle dürfen mitessen.",
  "kom.case.kuchen.escaped": "Der Kuchen ist fort, und der König feiert mit einem Brötchen. Irgendwo in Kicherwald sitzt jemand mit vollem Bauch und leerem Gewissen. Die Akte bleibt offen.",
  "kom.case.rezept.intro": "Kicherwald, mitten in der Nacht. Im Wirtshaus lag das goldene Rezeptbuch mit dem Geheimnis der berühmten Linsensuppe. Jetzt ist die Truhe leer. Einer von euch hat plötzlich großen Appetit. Ich bin Kommissar Tavi, und ich finde ihn.",
  "kom.case.rezept.solved": "Fall gelöst. Das Rezeptbuch liegt wieder in der Truhe, und die Linsensuppe gelingt weiter wie immer. Fast.",
  "kom.case.rezept.escaped": "Das Rezeptbuch bleibt verschwunden. Irgendwo in Kicherwald köchelt heute eine Suppe, die verdächtig gut schmeckt. Die Akte bleibt offen.",
  "kom.case.mondstein.intro": "Kicherwald, mitten in der Nacht. In der Bibliothek lag der Mondstein, der leise summt, wenn jemand die Wahrheit sagt. Jetzt liegt dort nur noch die Glashaube. Einer von euch hat ihn eingesteckt. Ich bin Kommissar Tavi, und ich finde ihn.",
  "kom.case.mondstein.solved": "Fall gelöst. Der Mondstein summt wieder unter seiner Haube, und diesmal summt er zufrieden.",
  "kom.case.mondstein.escaped": "Der Mondstein bleibt verschwunden. In Kicherwald summt heute Nacht etwas, und niemand weiß, wo. Die Akte bleibt offen.",
  "kom.case.glocke.intro": "Kicherwald, mitten in der Nacht. Auf dem Marktplatz hing die Marktglocke, die jeden Morgen den Handel einläutet. Jetzt hängt dort nur noch das Seil. Einer von euch hat sehr leise Schuhe. Ich bin Kommissar Tavi, und ich finde ihn.",
  "kom.case.glocke.solved": "Fall gelöst. Die Marktglocke hängt wieder am Seil, und der Handel beginnt pünktlich. Wie ein Uhrwerk.",
  "kom.case.glocke.escaped": "Die Marktglocke bleibt verschwunden. Morgen früh wird es auf dem Markt sehr leise sein, und einer von euch weiß, warum. Die Akte bleibt offen.",
  "kom.case.honig.intro": "Kicherwald, mitten in der Nacht. Im Kräutergarten stand der Honigtopf des Jahres, bewacht von zwei Bienen. Jetzt ist er weg, und die Bienen sind sehr böse. Einer von euch klebt. Ich bin Kommissar Tavi, und ich finde ihn.",
  "kom.case.honig.solved": "Fall gelöst. Der Honigtopf ist zurück, die Bienen sind versöhnt, und der Sommer schmeckt wieder wie früher.",
  "kom.case.honig.escaped": "Der Honigtopf bleibt verschwunden. Irgendwo in Kicherwald klebt jemand sehr zufrieden an seinem Löffel. Die Akte bleibt offen.",
  "kom.case.hufeisen.intro": "Kicherwald, mitten in der Nacht. Über der Tür der Schmiede hing das Glückshufeisen, das das ganze Dorf zusammenhält. Jetzt hängt dort nur noch ein Nagel. Einer von euch hat plötzlich viel Glück. Ich bin Kommissar Tavi, und ich finde ihn.",
  "kom.case.hufeisen.solved": "Fall gelöst. Das Hufeisen hängt wieder über der Tür, und das Dorf hält wieder zusammen. Nagel inbegriffen.",
  "kom.case.hufeisen.escaped": "Das Glückshufeisen bleibt verschwunden. Wer es hat, hat Glück. Und das Dorf? Nun ja. Die Akte bleibt offen.",
  "kom.case.spieluhr.intro": "Kicherwald, mitten in der Nacht. An der alten Brücke hing die Spieluhr, die jeden Abend das Brückenlied spielt. Heute verstummte sie mitten im Lied. Einer von euch summt auffällig die zweite Strophe. Ich bin Kommissar Tavi, und ich finde ihn.",
  "kom.case.spieluhr.solved": "Fall gelöst. Die Spieluhr hängt wieder an der Brücke und spielt die zweite Strophe zu Ende. Es war höchste Zeit.",
  "kom.case.spieluhr.escaped": "Die Spieluhr bleibt verschwunden. Das Brückenlied bleibt unvollendet, und irgendwo spielt jemand heimlich die zweite Strophe. Die Akte bleibt offen.",
  "kom.welcome": "Willkommen in Kicherwald! Hier ist heute Nacht etwas verschwunden, und einer von euch war es. Ich bin Kommissar Tavi. Tippt auf den goldenen Knopf, dann fangen wir an.",
  "kom.tour.1": "In Kicherwald ist in der Nacht etwas verschwunden. Jemand hat es gestohlen. Und dieser Jemand sitzt gerade mit euch am Tisch.",
  "kom.tour.2": "Jeder bekommt eine Figur und eine Nummer. Merkt euch beides. Jede Figur hat einen farbigen Rand und sogar ihre eigene Stimme.",
  "kom.tour.3": "Dann klingelt das Geheimtelefon. Haltet das Handy ans Ohr, und ich flüstere euch zu, wo ihr wart und wen ihr dort gesehen habt.",
  "kom.tour.4": "Alle sagen die Wahrheit. Nur der Dieb muss flunkern. Er denkt sich einen Ort aus, an dem er angeblich war. Aber er weiß nicht, was man dort gesehen hat.",
  "kom.tour.5": "Dann rufe ich zwei Zeugen auf, die angeblich am selben Ort waren. Auf drei zeigen beide auf das Bild, das sie dort gesehen haben. Wer flunkert, muss raten.",
  "kom.tour.6": "Am Ende zeigen alle auf drei auf den Dieb. Habt ihr ihn erwischt, gewinnt ihr zusammen. Wenn nicht, lacht er zuletzt.",
  "kom.help.setup": "Wie viele spielen mit? Tippt auf die Zahl. Dann sucht ihr eine Stufe aus. Für den Anfang nehmt ihr die Mini-Detektive.",
  "kom.help.cast": "Das Handy zeigt dir deine Figur und deine Nummer. Schau sie dir gut an, dann gibst du es weiter.",
  "kom.help.case": "Hier hört ihr, was gestohlen wurde und wo. Tippt auf den goldenen Knopf, wenn ihr bereit seid.",
  "kom.help.act": "Gleich geht das Geheimtelefon reihum. Tippt auf den goldenen Knopf, wenn ihr bereit seid.",
  "kom.help.hand": "Gib das Handy an die Nummer, die auf dem Bildschirm steht. Alle anderen schauen weg.",
  "kom.help.whisper": "Halte das Handy ans Ohr. Ich flüstere dir, wo du warst. Tippe auf den goldenen Knopf, wenn du fertig bist.",
  "kom.help.lie": "Such dir einen Ort aus, an dem du angeblich warst. Du darfst auch Figuren antippen, die angeblich bei dir waren. Dann tippe auf den goldenen Knopf.",
  "kom.help.announce": "Jetzt hören alle, was du sagst. Danach gibst du das Handy weiter.",
  "kom.help.talk": "Jetzt wird geredet. Schaut auf die Dorfkarte: Wer war wo? Tippt auf eine Figur, dann höre ich ihre Aussage noch einmal vor.",
  "kom.help.duel": "Legt das Handy in die Mitte. Auf drei zeigen die beiden Zeugen auf das Bild, das sie dort gesehen haben.",
  "kom.help.vote": "Besprecht euch. Dann zähle ich runter, und alle zeigen gleichzeitig auf den, den sie für den Dieb halten.",
  "kom.help.point": "Tippt auf die Figur, auf die die meisten gezeigt haben.",
  "kom.help.reveal": "Gleich dreht sich die Karte um.",
  "kom.help.end": "Hier seht ihr, was wirklich geschah. Tippt auf den goldenen Knopf für einen neuen Fall.",
  "kom.cast.start": "Die Besetzung wird ausgelost. Jeder bekommt eine Figur und eine Nummer. Gib das Handy rum, immer im Kreis.",
  "kom.cast.macke": "Typische Macke:",
  "kom.cast.pass.1": "Gut. Gib das Handy an die nächste Person im Kreis.",
  "kom.cast.pass.2": "Weiterreichen, bitte. Der Nächste im Kreis ist dran.",
  "kom.cast.done": "Die Besetzung steht! Jeder kennt seine Figur und seine Nummer. Das sind eure Verdächtigen.",
  "kom.act.0.1": "Der Abend in Kicherwald. Die Hühner gehen schlafen, die Katzen erst später. Jeder ist irgendwo, und jeder sieht jemanden.",
  "kom.act.0.2": "Es wird Abend im Dorf. Die Laternen gehen an, der Bäcker gähnt, und alle gehen ihrer Wege. Gleich erfahrt ihr, wo ihr wart.",
  "kom.act.0.3": "Der Abend beginnt. Im Wirtshaus wird gelacht, auf der Brücke geangelt, und irgendwo ist jemand ziemlich leise.",
  "kom.act.1.pre": "Es wird Mitternacht. Zählt die Glockenschläge mit!",
  "kom.act.1.post.1": "Zwölf! Und genau jetzt ist es passiert. Das Geheimtelefon klingelt wieder.",
  "kom.act.1.post.2": "Zwölf Schläge. Irgendwo in Kicherwald war jemand sehr, sehr leise.",
  "kom.act.2.1": "Das Morgengrauen. Der Hahn kräht, der Nebel zieht ab, und alle sind müde. Wo wart ihr jetzt?",
  "kom.act.2.2": "Draußen wird es hell. Der Bäcker schimpft, die Vögel singen, und niemand hat gut geschlafen.",
  "kom.act.done.0": "Der Abend ist notiert. Schaut auf die Dorfkarte: Wer war wo?",
  "kom.act.done.1": "Mitternacht ist notiert. Nur noch das Morgengrauen.",
  "kom.act.done.last": "Alle Aussagen sind notiert. Jetzt beginnt das Verhör.",
  "kom.hand.pre.1": "Das Geheimtelefon klingelt für:",
  "kom.hand.pre.2": "Gib das Handy an:",
  "kom.hand.pre.3": "Der nächste Anruf ist für:",
  "kom.hand.post": "Handy ans Ohr! Alle anderen schauen weg.",
  "kom.hand.first": "Gleich geht das Geheimtelefon reihum. Wer dran ist, hält das Handy ans Ohr, und ich flüstere ihm etwas zu.",
  "kom.ann.end.1": "Notiert.",
  "kom.ann.end.2": "Das steht jetzt im Protokoll.",
  "kom.ann.end.3": "Zur Kenntnis genommen.",
  "kom.ann.with": "Dabei:",
  "kom.ann.alone": "Ganz allein.",
  "kom.and": "und",
  "kom.round.1": "Das Verhör beginnt. Schaut auf die Dorfkarte. Wer war wo? Und wer war nicht dort, wo er sagt?",
  "kom.round.2": "Zweite Runde. Wer jetzt noch ganz ruhig bleibt, hat entweder nichts zu verbergen oder sehr viel.",
  "kom.round.3": "Dritte Runde. Die Zeit wird knapp. Gleich ist Anklage.",
  "kom.einspruch.1": "Einspruch!",
  "kom.einspruch.2": "Moment mal!",
  "kom.einspruch.3": "Das riecht nach einem Widerspruch!",
  "kom.einspruch.more": "Und es gibt noch mehr Widersprüche.",
  "kom.einspruch.out.1": "sind sich nicht einig.",
  "kom.einspruch.out.2": "erzählen nicht dasselbe.",
  "kom.einspruch.out.3": "passen nicht zusammen.",
  "kom.alone.pre": "Der Gerichtsschreiber meldet: Um Mitternacht hat niemand gesehen:",
  "kom.alone.post.1": "Das kann Zufall sein. Muss es aber nicht.",
  "kom.alone.post.2": "Wer allein ist, hat keinen Zeugen. Das ist verdächtig, aber nicht verboten.",
  "kom.time.10": "Nur noch zehn Sekunden.",
  "kom.time.up": "Die Zeit ist um.",
  "kom.duel.call.1": "Zeugen-Duell!",
  "kom.duel.call.2": "Ich rufe zwei Zeugen auf!",
  "kom.duel.call.3": "Achtung, Zeugen-Duell!",
  "kom.duel.who": "Ich rufe auf:",
  "kom.duel.ask": "Was habt ihr dort gesehen? Legt das Handy in die Mitte. Auf drei zeigt ihr beide auf euer Bild.",
  "kom.duel.same.1": "Gleiche Antwort! Das passt.",
  "kom.duel.same.2": "Beide zeigen aufs selbe Bild. Verdächtig einig.",
  "kom.duel.same.3": "Zwei Zeugen, ein Bild. Schön.",
  "kom.duel.diff.1": "Verschiedene Bilder! Da stimmt etwas nicht. Einer hat sich geirrt oder geflunkert.",
  "kom.duel.diff.2": "Zwei Zeugen, zwei Bilder. Das gefällt mir nicht.",
  "kom.duel.diff.3": "Aha. Da hat jemand geraten.",
  "kom.duel.none": "Heute gibt es keine zwei Zeugen am selben Ort. Dann fragt euch gegenseitig.",
  "kom.prompt.1": "Alle machen die Stimme ihrer Figur nach und sagen: Ich war es nicht!",
  "kom.prompt.2": "Frag die Figur neben dir: Wer hat dich gesehen?",
  "kom.prompt.3": "Wer war um Mitternacht nicht allein? Alle, die nicht allein waren, melden sich!",
  "kom.prompt.4": "Alle machen gleichzeitig das Geräusch nach, das an ihrem Ort zu hören war.",
  "kom.prompt.5": "Alle schauen reihum drei Sekunden in die Augen. Wer zuerst lacht, ist verdächtig!",
  "kom.prompt.6": "Erzähl in einem Satz, wie du vom Abend zur Mitternacht gekommen bist.",
  "kom.prompt.7": "Spiel die Macke deiner Figur vor. Die anderen schauen ganz genau hin.",
  "kom.prompt.8": "Wer war am Abend mit jemandem zusammen? Zeigt auf euren Abend-Begleiter.",
  "kom.prompt.9": "Probe-Zeigen! Auf drei zeigen alle auf ihren Verdächtigen. Noch ist es keine Anklage.",
  "kom.prompt.10": "Beschreibe in drei Wörtern, wie es um Mitternacht an deinem Ort roch.",
  "kom.spur.next.1": "Das Labor meldet eine Spur.",
  "kom.spur.next.2": "Eilmeldung aus dem Labor!",
  "kom.spur.next.3": "Das Labor hat etwas gefunden.",
  "kom.spur.fam.Blau": "Am Tatort liegt ein blauer Faden.",
  "kom.spur.fam.Braun": "Am Tatort liegt ein brauner Faden.",
  "kom.spur.fam.Gelb": "Am Tatort liegt ein gelber Faden.",
  "kom.spur.fam.Weiß": "Am Tatort liegt ein weißer Faden.",
  "kom.spur.fam.Rot": "Am Tatort liegt ein roter Faden.",
  "kom.spur.fam.Grau": "Am Tatort liegt ein grauer Faden.",
  "kom.spur.fam.Grün": "Am Tatort liegt ein grüner Faden.",
  "kom.spur.fam.Lila": "Am Tatort liegt ein lilafarbener Faden.",
  "kom.spur.fam.Schwarz": "Am Tatort liegt ein schwarzer Faden.",
  "kom.spur.fam.Rosa": "Am Tatort liegt ein rosa Faden.",
  "kom.spur.fam.Orange": "Am Tatort liegt ein orangefarbener Faden.",
  "kom.spur.szc.klein": "Die Fußspuren sind winzig. Der Dieb ist klein.",
  "kom.spur.szc.mittel": "Die Fußspuren sind ganz normal groß. Der Dieb ist mittelgroß.",
  "kom.spur.szc.groß": "Die Fußspuren sind riesig. Der Dieb ist groß.",
  "kom.spur.spc.Mensch": "Es gibt Schuhabdrücke. Der Dieb ist ein Mensch.",
  "kom.spur.spc.Tier": "Es gibt Pfotenabdrücke. Der Dieb ist ein Tier.",
  "kom.spur.spc.Zauberwesen": "Es glitzert am Tatort. Der Dieb ist ein Zauberwesen.",
  "kom.spur.gdr.männlich": "Jemand hat eine tiefe Stimme gehört. Der Dieb ist männlich.",
  "kom.spur.gdr.weiblich": "Jemand hat eine helle Stimme gehört. Der Dieb ist weiblich.",
  "kom.spur.gdr.neutral": "Jemand hat eine Stimme gehört, die weder tief noch hell war. Der Dieb ist weder Mann noch Frau.",
  "kom.accuse.1": "Jetzt ist es Zeit für die Anklage. Wer war es? Auf drei zeigt ihr alle auf euren Verdächtigen.",
  "kom.vote": "Drei. Zwei. Eins. Zeigt!",
  "kom.reveal.ask": "Tritt vor. Ist das der Dieb? Tippt auf den goldenen Knopf, dann dreht sich die Karte um.",
  "kom.accuse.2": "Trommelwirbel! Die Karte wird umgedreht.",
  "kom.guilty.1": "Schuldig! Der Dieb ist überführt.",
  "kom.guilty.2": "Erwischt! Das war der Dieb.",
  "kom.guilty.3": "Und der Vorhang fällt: Das ist der Dieb.",
  "kom.innocent.1": "Unschuldig! Das war der Falsche.",
  "kom.innocent.2": "Falsch! Der Verdächtige ist unschuldig, aber ein bisschen beleidigt.",
  "kom.innocent.3": "Autsch. Das war der Falsche.",
  "kom.second": "Eine falsche Fährte. Ihr habt noch eine Anklage, aber nur diese eine.",
  "kom.rebuild": "Hier ist, was in dieser Nacht wirklich geschah."
} as const;

export const WHISPER = {
  "w.with.1": "Bei dir war:",
  "w.with.n": "Bei dir waren:",
  "w.alone": "Du warst ganz allein.",
  "w.saw": "Du hast dort gesehen:",
  "w.and": "und",
  "w.remember": "Merk dir das gut.",
  "w.loner": "Allein um Mitternacht? Das sieht verdächtig aus. Aber du bist unschuldig. Bleib ruhig.",
  "w.culprit.1": "Psst. Du warst es. Du warst um Mitternacht ganz allein am Tatort und hast es mitgenommen. Niemand hat dich gesehen.",
  "w.culprit.2": "Such dir jetzt ein Alibi aus. Tippe auf einen Ort, an dem du angeblich warst.",
  "w.culprit.3": "Gut. Du darfst auch Figuren antippen, die angeblich bei dir waren. Aber Vorsicht: Die wissen, wo sie wirklich waren.",
  "w.culprit.ready": "Fertig? Dann tippe auf den goldenen Knopf. Ab jetzt musst du so tun, als wäre alles wahr."
} as const;

export const PROMPTS = [
  {
    "icon": "🗣️",
    "text": "Alle machen die Stimme ihrer Figur nach und sagen: Ich war es nicht!"
  },
  {
    "icon": "👂",
    "text": "Frag die Figur neben dir: Wer hat dich gesehen?"
  },
  {
    "icon": "✋",
    "text": "Wer war um Mitternacht nicht allein? Alle, die nicht allein waren, melden sich!"
  },
  {
    "icon": "🔊",
    "text": "Alle machen gleichzeitig das Geräusch nach, das an ihrem Ort zu hören war."
  },
  {
    "icon": "👀",
    "text": "Alle schauen reihum drei Sekunden in die Augen. Wer zuerst lacht, ist verdächtig!"
  },
  {
    "icon": "🧭",
    "text": "Erzähl in einem Satz, wie du vom Abend zur Mitternacht gekommen bist."
  },
  {
    "icon": "🎭",
    "text": "Spiel die Macke deiner Figur vor. Die anderen schauen ganz genau hin."
  },
  {
    "icon": "🤝",
    "text": "Wer war am Abend mit jemandem zusammen? Zeigt auf euren Abend-Begleiter."
  },
  {
    "icon": "👆",
    "text": "Probe-Zeigen! Auf drei zeigen alle auf ihren Verdächtigen. Noch ist es keine Anklage."
  },
  {
    "icon": "👃",
    "text": "Beschreibe in drei Wörtern, wie es um Mitternacht an deinem Ort roch."
  }
] as const;

export const SPUR_LABEL = {
  "fam": "Kennfarbe",
  "szc": "Größe",
  "spc": "Art",
  "gdr": "Geschlecht"
} as const;

export const SPC_ICON = {
  "Mensch": "🧍",
  "Tier": "🐾",
  "Zauberwesen": "✨"
} as const;

export const GDR_ICON = {
  "männlich": "♂️",
  "weiblich": "♀️",
  "neutral": "⚪"
} as const;

export const LEVEL_INFO = {
  "mini": {
    "icon": "🐣",
    "n": "Mini-Detektive",
    "age": "ab 5",
    "d": "Alles per Bild und Stimme. 2 Akte. Das Dorf zeigt Widersprüche an. Ein Unschuldiger war auch allein."
  },
  "junior": {
    "icon": "🔍",
    "n": "Junior-Detektive",
    "age": "ab 7",
    "d": "3 Akte. Das Dorf zeigt Widersprüche an. Zwei Anklagen."
  },
  "detektiv": {
    "icon": "🕵️",
    "n": "Detektiv",
    "age": "ab 10",
    "d": "3 Akte. Keine Hilfen, eine Anklage. Auch das Geschlecht ist eine Spur."
  },
  "meister": {
    "icon": "🎩",
    "n": "Meisterdetektiv",
    "age": "Erwachsene",
    "d": "Zwei Unschuldige ohne Zeugen, drei Spuren, kürzere Verhöre."
  }
} as const;

export const NUM_WORDS = [
  "eins",
  "zwei",
  "drei",
  "vier",
  "fünf",
  "sechs",
  "sieben",
  "acht"
] as const;

