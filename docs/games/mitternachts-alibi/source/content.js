/* Mitternachts-Alibi: Orte, Details, Fälle, Erzählertexte (Kommissar Tavi), Spur-Sätze.
 * Regel für alle gesprochenen Zeilen: KEINE Spielernamen und keine Figurennamen. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KMContent = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SLOTS = [
    { id: 0, name: 'Abend', time: '19 Uhr', icon: '🌆' },
    { id: 1, name: 'Mitternacht', time: '24 Uhr', icon: '🌙' },
    { id: 2, name: 'Morgengrauen', time: '5 Uhr', icon: '🌅' }
  ];

  var PLACES = {
    baeckerei: { name: 'die Bäckerei', at: 'in der Bäckerei', icon: '🥖', short: 'Bäckerei' },
    bibliothek: { name: 'die Bibliothek', at: 'in der Bibliothek', icon: '📚', short: 'Bibliothek' },
    markt: { name: 'der Marktplatz', at: 'auf dem Marktplatz', icon: '🧺', short: 'Marktplatz' },
    garten: { name: 'der Kräutergarten', at: 'im Kräutergarten', icon: '🌿', short: 'Garten' },
    turm: { name: 'der Uhrturm', at: 'im Uhrturm', icon: '🕰️', short: 'Uhrturm' },
    bruecke: { name: 'die alte Brücke', at: 'auf der alten Brücke', icon: '🌉', short: 'Brücke' },
    wirtshaus: { name: 'das Wirtshaus', at: 'im Wirtshaus', icon: '🍲', short: 'Wirtshaus' },
    schmiede: { name: 'die Schmiede', at: 'in der Schmiede', icon: '🔨', short: 'Schmiede' }
  };

  /* Details: Wer an diesem Ort zu dieser Zeit war, kennt diese Kleinigkeit. Der Täter kennt sie nicht. */
  var DETAILS = {
    baeckerei: [
      [{ q: 'Was lag zum Abkühlen auf dem Fensterbrett?', a: 'Ein Blech Zimtschnecken' }, { q: 'Welches Lied hat der Bäcker beim Kneten gesummt?', a: 'Ein Wiegenlied' }],
      [{ q: 'Was hat in der Backstube leise geknistert?', a: 'Der Ofen, der noch nachglühte' }, { q: 'Wer schlief auf dem Mehlsack?', a: 'Eine Katze' }],
      [{ q: 'Was duftete aus dem Ofen?', a: 'Frische Brötchen' }, { q: 'Was stand ganz vorn im Schaufenster?', a: 'Eine Brezel so groß wie ein Wagenrad' }]
    ],
    bibliothek: [
      [{ q: 'Welches Buch lag aufgeschlagen auf dem Lesepult?', a: 'Ein Atlas mit einer fehlenden Seite' }, { q: 'Was hat die Bibliothekarin gestempelt?', a: 'Einen Stapel Mahnungen' }],
      [{ q: 'Was raschelte zwischen den Regalen?', a: 'Eine Maus, die Seiten umblätterte' }, { q: 'Was leuchtete im obersten Regal?', a: 'Ein einzelnes Glühwürmchen' }],
      [{ q: 'Was lag vor der Eingangstür?', a: 'Die Zeitung von gestern' }, { q: 'Welche Uhr tickte zu laut?', a: 'Die Standuhr neben dem Globus' }]
    ],
    markt: [
      [{ q: 'Was hat der Gemüsehändler gerufen?', a: 'Kürbisse zum halben Preis' }, { q: 'Welche Farben hatte der Sonnenschirm am Käsestand?', a: 'Gelb-weiß gestreift' }],
      [{ q: 'Was wurde gerade abgebaut?', a: 'Der Stand mit den Äpfeln' }, { q: 'Wer stand am Brunnen und hat nichts getan?', a: 'Ein herrenloser Esel' }],
      [{ q: 'Womit hat der Fischhändler geworben?', a: 'Mit frischem Lachs' }, { q: 'Was lag verloren auf dem Pflaster?', a: 'Ein einzelner Handschuh' }]
    ],
    garten: [
      [{ q: 'Welche Blume ging gerade zu?', a: 'Der Löwenzahn' }, { q: 'Was hat die Gärtnerin gegossen?', a: 'Die Tomaten' }],
      [{ q: 'Welches Tier saß auf dem Zaun?', a: 'Eine Eule' }, { q: 'Was glitzerte im Gras?', a: 'Tautropfen' }],
      [{ q: 'Welcher Vogel hat als Erster gesungen?', a: 'Eine Amsel' }, { q: 'Was hing über den Beeten?', a: 'Nebel' }]
    ],
    turm: [
      [{ q: 'Wie viele Stufen hat die Wendeltreppe?', a: 'Neunundneunzig' }, { q: 'Was hat der Turmwächter poliert?', a: 'Das Zifferblatt' }],
      [{ q: 'Wie oft hat die Turmuhr geschlagen?', a: 'Zwölfmal, aber das letzte Mal zu spät' }, { q: 'Was flatterte durchs Fenster?', a: 'Eine Fledermaus' }],
      [{ q: 'Was sah man von ganz oben?', a: 'Die Sonne über dem Nebelmeer' }, { q: 'Was hing an der Glocke?', a: 'Ein Spinnennetz' }]
    ],
    bruecke: [
      [{ q: 'Wer hat am Geländer geangelt?', a: 'Ein Junge mit einem leeren Eimer' }, { q: 'Was schwamm unter der Brücke?', a: 'Eine Entenfamilie' }],
      [{ q: 'Was spiegelte sich im Wasser?', a: 'Der volle Mond' }, { q: 'Was knarrte unter den Planken?', a: 'Eine lockere Bohle' }],
      [{ q: 'Was lag im Nebel unter der Brücke?', a: 'Ein umgekipptes Ruderboot' }, { q: 'Welches Tier ist über die Brücke gelaufen?', a: 'Ein Igel' }]
    ],
    wirtshaus: [
      [{ q: 'Was stand heute auf der Tafel?', a: 'Linsensuppe mit Würstchen' }, { q: 'Wer hat Laute gespielt?', a: 'Ein reisender Geschichtenerzähler' }],
      [{ q: 'Was brannte noch im Kamin?', a: 'Ein einzelner Holzscheit' }, { q: 'Was hat der Wirt gerade gewischt?', a: 'Den Tresen, zum dritten Mal' }],
      [{ q: 'Wie roch es im Schankraum?', a: 'Nach Kaffee und kaltem Rauch' }, { q: 'Was lag unter einem Tisch?', a: 'Ein schnarchender Hund' }]
    ],
    schmiede: [
      [{ q: 'Was hat der Schmied geschmiedet?', a: 'Ein Hufeisen' }, { q: 'Welche Farbe hatte das Eisen in der Glut?', a: 'Orangerot' }],
      [{ q: 'Was hat im Wasserfass gezischt?', a: 'Ein glühender Nagel' }, { q: 'Wer lag neben dem Amboss?', a: 'Ein Kater' }],
      [{ q: 'Was hat zuerst geklungen?', a: 'Der Hammer auf dem Amboss' }, { q: 'Was hing an der Wand?', a: 'Eine Reihe Zangen' }]
    ]
  };

  /* Die Fälle. Jeder hat einen festen Tatort und eigene Erzähler-Texte. */
  var CASES = [
    { id: 'laterne', title: 'Die Sternenlaterne', crime: 'turm', loot: 'die Sternenlaterne',
      intro: 'Kicherwald, kurz nach Mitternacht. Im Uhrturm brannte seit hundert Jahren die Sternenlaterne, das Licht, das jeden Heimkehrer sicher durch die Gassen führt. Heute Nacht ist sie verschwunden. Keine Tür aufgebrochen, keine Treppe aufgewühlt. Wer das getan hat, kannte den Turm. Jeder von euch hat einen Abend hinter sich, und einer von euch hat eine Lücke darin. Ich bin Kommissar Tavi. Ihr seid meine Verdächtigen. Fangen wir an.',
      solved: 'Fall gelöst. Die Sternenlaterne leuchtet wieder, und Kicherwald findet nachts nach Hause. Zumindest bis zum nächsten Rätsel.',
      escaped: 'Und so bleibt die Sternenlaterne verschwunden. Irgendwo in Kicherwald brennt heute Nacht ein Licht, das nicht hierher gehört. Die Akte bleibt offen.' },
    { id: 'kuchen', title: 'Der Geburtstagskuchen des Königs', crime: 'baeckerei', loot: 'der Geburtstagskuchen des Königs',
      intro: 'Kicherwald, kurz nach Mitternacht. Der Geburtstagskuchen des Königs stand fertig in der Bäckerei, drei Stockwerke hoch, mit einer Krone aus Zucker. Morgen früh sollte er das ganze Dorf überraschen. Jetzt steht dort nur noch ein Teller mit Krümeln und eine Menge Fragen. Ich bin Kommissar Tavi. Ihr seid meine Verdächtigen, und einer von euch hat Zucker an den Händen. Fangen wir an.',
      solved: 'Fall gelöst. Der Kuchen ist zurück, ein kleines Stück fehlt, und der König ist gnädig. Alle dürfen mitessen.',
      escaped: 'Der Kuchen ist fort, und der König feiert mit einem Brötchen. Irgendwo in Kicherwald sitzt jemand mit vollem Bauch und leerem Gewissen. Die Akte bleibt offen.' },
    { id: 'rezept', title: 'Das goldene Rezeptbuch', crime: 'wirtshaus', loot: 'das goldene Rezeptbuch',
      intro: 'Kicherwald, kurz nach Mitternacht. Im Wirtshaus lag in einer Truhe unter dem Tresen das goldene Rezeptbuch, darin das Geheimnis der berühmten Linsensuppe. Die Truhe ist leer. Ein Rezept lässt sich nicht wegzaubern, nur klauen. Ich bin Kommissar Tavi. Ihr seid meine Verdächtigen, und einer von euch hat plötzlich sehr viel Appetit. Fangen wir an.',
      solved: 'Fall gelöst. Das Rezeptbuch liegt wieder in der Truhe, und die Linsensuppe gelingt weiter wie immer. Fast.',
      escaped: 'Das Rezeptbuch bleibt verschwunden. Irgendwo in Kicherwald köchelt heute eine Suppe, die verdächtig gut schmeckt. Die Akte bleibt offen.' },
    { id: 'mondstein', title: 'Der Mondstein', crime: 'bibliothek', loot: 'der Mondstein',
      intro: 'Kicherwald, kurz nach Mitternacht. In der Bibliothek lag unter einer Glashaube der Mondstein, der leise summt, wenn jemand die Wahrheit sagt. Jetzt liegt dort nur noch die Glashaube. Das ist beinahe komisch, denn ausgerechnet heute werdet ihr alle die Wahrheit sagen wollen. Ich bin Kommissar Tavi. Ihr seid meine Verdächtigen, und einer von euch hat den Stein bei sich. Fangen wir an.',
      solved: 'Fall gelöst. Der Mondstein summt wieder unter seiner Haube, und diesmal summt er zufrieden.',
      escaped: 'Der Mondstein bleibt verschwunden. In Kicherwald summt heute Nacht etwas, und niemand weiß, wo. Die Akte bleibt offen.' },
    { id: 'glocke', title: 'Die Marktglocke', crime: 'markt', loot: 'die Marktglocke',
      intro: 'Kicherwald, kurz nach Mitternacht. Die Marktglocke läutet jeden Morgen den Handel ein. Morgen früh bleibt es still, denn die Glocke ist fort. Nur das Seil hängt noch da, und es schwingt, als hätte jemand gerade losgelassen. Ich bin Kommissar Tavi. Ihr seid meine Verdächtigen, und einer von euch hat sehr leise Schuhe. Fangen wir an.',
      solved: 'Fall gelöst. Die Marktglocke hängt wieder am Seil, und der Handel beginnt pünktlich. Wie ein Uhrwerk.',
      escaped: 'Die Marktglocke bleibt verschwunden. Morgen früh wird es auf dem Markt sehr leise sein, und einer von euch weiß, warum. Die Akte bleibt offen.' },
    { id: 'honig', title: 'Der Honigtopf des Jahres', crime: 'garten', loot: 'der Honigtopf des Jahres',
      intro: 'Kicherwald, kurz nach Mitternacht. Im Kräutergarten stand unter einem Tuch der Honigtopf des Jahres, voll mit Honig, der nach Sommer schmeckt, bewacht von zwei Bienen. Der Topf ist weg, das Tuch liegt im Beet, und die Bienen sind, wie soll ich sagen, nicht kooperativ. Ich bin Kommissar Tavi. Ihr seid meine Verdächtigen, und einer von euch klebt. Fangen wir an.',
      solved: 'Fall gelöst. Der Honigtopf ist zurück, die Bienen sind versöhnt, und der Sommer schmeckt wieder wie früher.',
      escaped: 'Der Honigtopf bleibt verschwunden. Irgendwo in Kicherwald klebt jemand sehr zufrieden an seinem Löffel. Die Akte bleibt offen.' },
    { id: 'hufeisen', title: 'Das Glückshufeisen', crime: 'schmiede', loot: 'das Glückshufeisen',
      intro: 'Kicherwald, kurz nach Mitternacht. Über der Tür der Schmiede hing seit der ersten Lehrzeit das Glückshufeisen, und das ganze Dorf glaubt, es halte alles zusammen. Jetzt hängt dort nur noch ein Nagel. Ich bin Kommissar Tavi. Ihr seid meine Verdächtigen, und einer von euch hat in letzter Zeit auffällig viel Glück. Fangen wir an.',
      solved: 'Fall gelöst. Das Hufeisen hängt wieder über der Tür, und das Dorf hält wieder zusammen. Nagel inbegriffen.',
      escaped: 'Das Glückshufeisen bleibt verschwunden. Wer es hat, hat Glück. Und das Dorf? Nun ja. Die Akte bleibt offen.' },
    { id: 'spieluhr', title: 'Die Spieluhr der Brücke', crime: 'bruecke', loot: 'die Spieluhr der Brücke',
      intro: 'Kicherwald, kurz nach Mitternacht. An der alten Brücke hing eine Spieluhr, die jeden Abend das Brückenlied spielt. Heute Nacht verstummte sie mitten in der zweiten Strophe. Jemand hat sie abgenommen, mitten im Lied. Das gehört sich nicht. Ich bin Kommissar Tavi. Ihr seid meine Verdächtigen, und einer von euch summt auffällig die zweite Strophe. Fangen wir an.',
      solved: 'Fall gelöst. Die Spieluhr hängt wieder an der Brücke und spielt die zweite Strophe zu Ende. Es war höchste Zeit.',
      escaped: 'Die Spieluhr bleibt verschwunden. Das Brückenlied bleibt unvollendet, und irgendwo spielt jemand heimlich die zweite Strophe. Die Akte bleibt offen.' }
  ];

  /* Gesprochene Erzähler-Zeilen (Kommissar Tavi), namenlos */
  var KOM = {};
  function add(id, text) { KOM[id] = text; }
  CASES.forEach(function (c) { add('kom.case.' + c.id + '.intro', c.intro); add('kom.case.' + c.id + '.solved', c.solved); add('kom.case.' + c.id + '.escaped', c.escaped); });
  add('kom.cast', 'Die Besetzung wird ausgelost. Jeder bekommt eine Figur. Hört gut zu, wenn sie sich vorstellt.');
  add('kom.cast.done', 'Die Besetzung steht. Das sind eure Verdächtigen für diese Nacht.');
  add('kom.dossier.1', 'Die Akten werden verteilt. Jeder liest seine allein. Das Handy wandert von Hand zu Hand.');
  add('kom.dossier.done', 'Alle Akten sind gelesen. Jetzt beginnen die Aussagen.');
  add('kom.pass.1', 'Gib das Handy an die Person, deren Name auf dem Bildschirm steht. Alle anderen schauen weg.');
  add('kom.pass.2', 'Weiterreichen, bitte. Nur wer auf dem Bildschirm steht, schaut hin.');
  add('kom.stmt.start', 'Die Zeugen treten nacheinander vor. Jeder erzählt seinen Abend, und der Gerichtsschreiber notiert.');
  add('kom.stmt.noted.1', 'Notiert.');
  add('kom.stmt.noted.2', 'Zur Kenntnis genommen.');
  add('kom.stmt.noted.3', 'Das steht jetzt im Protokoll.');
  add('kom.stmt.done', 'Alle Aussagen sind im Protokoll. Das Kreuzverhör beginnt.');
  add('kom.round.1', 'Erste Runde. Fragt nach, vergleicht, prüft. Und achtet auf die Kleinigkeiten.');
  add('kom.round.2', 'Zweite Runde. Wer jetzt noch ruhig bleibt, hat entweder nichts zu verbergen oder viel.');
  add('kom.round.3', 'Dritte Runde. Die Zeit wird knapp. Bald ist es Zeit für die Anklage.');
  add('kom.einspruch.1', 'Einspruch! Da stimmt etwas nicht.');
  add('kom.einspruch.2', 'Einspruch! Zwei Aussagen passen nicht zusammen.');
  add('kom.einspruch.3', 'Moment. Das klingt nach einem Widerspruch.');
  add('kom.alone', 'Der Gerichtsschreiber merkt an: Für eine Person gibt es um Mitternacht keinen Zeugen.');
  add('kom.duel', 'Zeugen-Duell! Zwei Zeugen antworten gleichzeitig auf dieselbe Frage. Auf drei.');
  add('kom.time.10', 'Nur noch zehn Sekunden.');
  add('kom.time.up', 'Die Zeit ist um.');
  add('kom.spur.next', 'Das Labor meldet eine neue Spur.');
  add('kom.accuse.1', 'Jetzt ist es Zeit für die Anklage. Wer war es? Auf drei zeigt ihr alle auf euren Verdächtigen.');
  add('kom.vote', 'Drei. Zwei. Eins. Zeigt!');
  add('kom.accuse.2', 'Der Verdächtige tritt vor. Und die Karte wird umgedreht.');
  add('kom.guilty', 'Schuldig! Der Täter ist überführt.');
  add('kom.innocent', 'Unschuldig! Das war der Falsche.');
  add('kom.second', 'Eine falsche Fährte. Der Kommissar gewährt eine zweite Anklage, aber nur eine.');
  add('kom.awards', 'Und nun die Auszeichnungen des Abends.');
  add('kom.rebuild', 'Hier ist, was in dieser Nacht wirklich geschah.');

  /* Spur-Sätze: Das Labor meldet eine Eigenschaft des Täters */
  var SPUR = {
    fam: { Blau: 'Am Tatort liegt ein blauer Faden.', Braun: 'Am Tatort liegt ein brauner Faden.', Gelb: 'Am Tatort liegt ein gelber Faden.', Weiß: 'Am Tatort liegt ein weißer Faden.', Rot: 'Am Tatort liegt ein roter Faden.',
      Grau: 'Am Tatort liegt ein grauer Faden.', Grün: 'Am Tatort liegt ein grüner Faden.', Lila: 'Am Tatort liegt ein lilafarbener Faden.', Schwarz: 'Am Tatort liegt ein schwarzer Faden.', Rosa: 'Am Tatort liegt ein rosa Faden.', Orange: 'Am Tatort liegt ein orangefarbener Faden.' },
    szc: { klein: 'Die Fußspuren im Staub sind winzig. Der Täter ist klein.', mittel: 'Die Fußspuren sind von ganz gewöhnlicher Größe. Der Täter ist weder klein noch riesig.', groß: 'Die Fußspuren sind riesig, und die Tür wurde nur mit Mühe passiert. Der Täter ist groß.' },
    spc: { Mensch: 'Die Abdrücke stammen eindeutig von Schuhen. Der Täter ist ein Mensch.', Tier: 'Am Tatort liegen Pfotenabdrücke. Der Täter ist ein Tier.', Zauberwesen: 'Am Tatort liegt Glitzerstaub und ein Hauch von Zauber. Der Täter ist ein Zauberwesen.' },
    gdr: { männlich: 'Ein Nachbar hat durchs Fenster eine tiefe Stimme gehört. Der Täter ist männlich.', weiblich: 'Ein Nachbar hat durchs Fenster eine Frauenstimme gehört. Der Täter ist weiblich.', neutral: 'Ein Nachbar hat durchs Fenster eine Stimme gehört, die er weder einem Er noch einer Sie zuordnen konnte. Der Täter ist weder männlich noch weiblich.' }
  };
  var SPUR_LABEL = { fam: 'Kennfarbe', szc: 'Größe', spc: 'Art', gdr: 'Geschlecht' };
  Object.keys(SPUR).forEach(function (k) { Object.keys(SPUR[k]).forEach(function (v) { add('kom.spur.' + k + '.' + v, SPUR[k][v]); }); });

  /* Fragekarten für das Kreuzverhör */
  var PROMPTS = [
    'Reihum: Wen habt ihr am Abend am längsten gesehen? Jeder nennt eine Person.',
    'Fragt jemanden: Was hast du im Morgengrauen als Erstes gehört?',
    'Wer behauptet, um Mitternacht nicht allein gewesen zu sein? Alle melden sich. Wer fehlt?',
    'Jeder nennt einen Ort, an dem er garantiert nicht war. Stimmt das mit der Tafel überein?',
    'Fragt eine Person nach ihrem Weg: Wie bist du vom Abend zur Mitternacht gekommen?',
    'Wer hat sein Alibi mit den meisten Einzelheiten erzählt? Prüft eine davon.',
    'Fragt den Nachbarn zur Linken: Wer kann bestätigen, dass du dort warst?',
    'Jeder beschreibt in einem Satz, was sein Nachbar zur Rechten am Abend getan hat.',
    'Spielt eure Figur: Wie würde sie ihr Alibi mit ihrem Lieblingsspruch einleiten?',
    'Fragt jemanden: Was war das Auffälligste an deinem Ort um Mitternacht?'
  ];

  /* Eigenschaften-Vorschau: was der Avatar des Spielers bekommen könnte (Beispiel, wird nicht gespeichert) */
  function traitFor(role, won) {
    if (role === 'culprit') return won ? { trait: 'Kreativität', icon: '🎨', why: 'hat ein Alibi erfunden, das bis zum Schluss gehalten hat' } : { trait: 'Mut', icon: '🦁', why: 'hat sich dem Verhör gestellt und die Wahrheit gestanden' };
    return won ? { trait: 'Logik', icon: '🔢', why: 'hat mit den anderen Widersprüche aufgedeckt und den Täter gefunden' } : { trait: 'Ausdauer', icon: '🧗', why: 'hat bis zum Schluss mitgerätselt, auch als es schwer wurde' };
  }

  return { SLOTS: SLOTS, PLACES: PLACES, DETAILS: DETAILS, CASES: CASES, KOM: KOM, SPUR: SPUR, SPUR_LABEL: SPUR_LABEL, PROMPTS: PROMPTS, traitFor: traitFor };
});
