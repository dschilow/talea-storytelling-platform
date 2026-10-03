/* Kobold-Nacht: Texte, Sprechtexte (Tavi), Streiche, Froschaufgaben, Auszeichnungen.
 * Regel für alle gesprochenen Tavi-Zeilen: KEINE Spielernamen. Namen stehen nur auf dem Bildschirm,
 * damit jede Zeile einmal mit ElevenLabs aufgenommen werden kann. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KNContent = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TAVI = {};
  function add(id, text) { TAVI[id] = text; }

  /* Zauberhut */
  add('tavi.draw.1', 'Der Zauberhut hat gewählt! Schau, welche Figur zu dir kommt.');
  add('tavi.draw.2', 'Ein Wirbel, ein Funkeln, und schon ist es passiert. Das ist deine Figur!');
  add('tavi.draw.3', 'Der Hut kramt, murmelt und zieht … na, wer ist es?');
  add('tavi.draw.4', 'Tada! Der Zauberhut hat sich entschieden, und er diskutiert nicht.');
  add('tavi.board', 'Das ist Kicherwald. Merkt euch die Gesichter und die Sprüche. Gleich schlüpft Kicher in jemanden hinein.');
  add('tavi.pass.1', 'Gib das Handy an die Person, deren Name auf dem Bildschirm steht. Alle anderen schauen weg.');
  add('tavi.pass.2', 'Handy weiterreichen! Nur wer auf dem Bildschirm steht, schaut hin. Alle anderen: Augen auf den Tisch.');
  add('tavi.pass.done', 'Alle kennen ihre geheime Karte. Legt das Handy in die Mitte. Die erste Nacht beginnt.');

  /* Nacht */
  add('tavi.night.1', 'Kicherwald schläft ein. Alle schließen die Augen. Ohren auf!');
  add('tavi.night.2', 'Pssst. Die Nacht legt sich übers Dorf. Augen zu, Ohren auf, und nicht blinzeln!');
  add('tavi.night.3', 'Der Mond geht auf, und Kicher reibt sich die Hände. Augen zu!');
  add('tavi.night.4', 'Gute Nacht, Kicherwald. Wer jetzt blinzelt, den sehe ich. Ich sehe alles!');
  add('tavi.night.5', 'Es wird still im Dorf. Fast zu still. Augen zu, Ohren auf.');
  add('tavi.kobold', 'Kobold, öffne die Augen.');
  add('tavi.kobolds', 'Kobolde, öffnet die Augen.');
  add('tavi.call.laterne', 'Laterne, öffne die Augen.');
  add('tavi.call.honig', 'Honigfalle, öffne die Augen.');
  add('tavi.call.trost', 'Trostpflaster, öffne die Augen.');
  add('tavi.call.schluessel', 'Schlüsselloch, öffne die Augen.');
  add('tavi.call.spur', 'Spurenleser, öffne die Augen.');
  add('tavi.call.buch', 'Bücherwurm, öffne die Augen.');
  add('tavi.dawn.1', 'Der Mond geht unter, die Sonne kommt hoch. Augen auf!');
  add('tavi.dawn.2', 'Es wird hell. Ihr dürft blinzeln, so viel ihr wollt.');

  /* Morgen */
  add('tavi.morning.1', 'Kikeriki! Alle Augen auf. Schaut euch den Morgenbericht an.');
  add('tavi.morning.2', 'Guten Morgen, Kicherwald! Hat jemand gut geschlafen? Ich vermute nicht.');
  add('tavi.morning.3', 'Die Sonne geht auf, und mit ihr eine Überraschung.');
  add('tavi.morning.4', 'Aufwachen! Kicher war wieder unterwegs.');
  add('tavi.door.1', 'Knarrz! Wieder ein Türgriff weniger.');
  add('tavi.door.2', 'Knarrz, knarrz. Kicher sammelt fleißig.');
  add('tavi.door.low', 'Nur noch zwei Türgriffe! Jetzt wird es ernst.');
  add('tavi.door.last', 'Der allerletzte Türgriff! Jetzt oder nie.');
  add('tavi.frog.1', 'Jemand wacht heute als Frosch auf! Quaken und Zeichensprache sind erlaubt. Beim Abstimmen macht der Frosch Pause.');
  add('tavi.frog.2', 'Quak! Ein Frosch im Dorf. Reden geht nicht mehr, aber quaken darf er, so viel er will.');
  add('tavi.frog.3', 'Es hat gequakt! Ein Frosch sitzt beim Frühstück und weiß nicht, wie ihm geschieht.');
  add('tavi.protected.1', 'Der Froschzauber wurde gestoppt. Das war knapp!');
  add('tavi.protected.2', 'Kicher hat daneben gezaubert. Irgendjemand hat gut aufgepasst.');
  add('tavi.dick', 'Peng! Der Zauber ist abgeprallt. Was für ein Dickkopf!');
  add('tavi.honey', 'Klatsch! Eine Honigfalle hat den Zauber gestoppt. Die zwei Namen im Morgenbericht sind die Spur. Einer von beiden ist ein Kobold!');
  add('tavi.murmur.1', 'Im Schlaf hat jemand gemurmelt. Hört genau hin! Aber ein Spruch allein beweist noch nichts.');
  add('tavi.murmur.2', 'Ohren auf! Da murmelt jemand im Traum.');
  add('tavi.murmur.3', 'Pssst. Hört ihr das? Jemand redet im Schlaf.');

  /* Tag */
  add('tavi.day.1', 'Jetzt wird beraten. Erzählt, was ihr wisst. Und was ihr nicht wisst, erzählt ihr einfach trotzdem.');
  add('tavi.day.2', 'Die Beratung beginnt. Jeder darf alles behaupten. Nur ich lüge nie.');
  add('tavi.prank.intro', 'Kichers Streich des Tages!');
  add('tavi.frogtask.intro', 'Und für den Frosch gibt es eine Aufgabe.');
  add('tavi.time.10', 'Nur noch zehn Sekunden!');
  add('tavi.time.up', 'Die Zeit ist um. Jetzt wird gezeigt!');
  add('tavi.redestein', 'Der Redestein ist gelegt. Jetzt hört ihr eine Minute lang nur zu.');
  add('tavi.vote', 'Drei. Zwei. Eins. Zeigt!');
  add('tavi.finale', 'Jetzt gilt es! Wer jetzt falsch zeigt, verliert das Spiel.');
  add('tavi.accuse.1', 'Die verdächtigte Person tritt vor. Steckt Kicher in dir?');
  add('tavi.accuse.2', 'Trommelwirbel! Gleich wissen wir es.');
  add('tavi.caught.1', 'Erwischt! Kicher ist aus der Figur vertrieben. Du hilfst jetzt dem Dorf weiter.');
  add('tavi.caught.2', 'Erwischt! Kicher huscht aus der Figur und ärgert sich schwarz.');
  add('tavi.caught.3', 'Volltreffer! Ein Kobold weniger im Dorf.');
  add('tavi.innocent.1', 'Unschuldig! Knarrz! Im Durcheinander ist noch ein Türgriff verschwunden.');
  add('tavi.innocent.2', 'Unschuldig! Knarrz, knarrz! Gleich zwei Türgriffe sind weg!');
  add('tavi.innocent.3', 'Oje. Falsch gezeigt. Kicher kichert.');
  add('tavi.nobody.1', 'Niemand wird entlarvt. Vorsicht ist besser als ein verlorener Türgriff.');
  add('tavi.nobody.2', 'Alle zeigen nach oben. Mutig ist das nicht, aber klug.');
  add('tavi.evening.1', 'Die Sonne geht unter. Alle Frösche werden wieder normal, und Kicher reibt sich die Hände.');
  add('tavi.win.1', 'Das Dorf gewinnt! Alle Kobolde sind entzaubert. Kicherwald jubelt!');
  add('tavi.win.2', 'Geschafft! Alle Kobolde sind entzaubert. Kicherwald schläft heute ruhig.');
  add('tavi.lose.1', 'Der letzte Türgriff ist weg. Kicher gewinnt! Er tanzt mit seiner Sammlung davon.');
  add('tavi.lose.2', 'Der letzte Türgriff ist weg! Kicher tanzt durchs Dorf. Beim nächsten Mal klappt es bestimmt!');
  add('tavi.awards', 'Und jetzt die Auszeichnungen des Abends!');

  /* Kichers Streiche des Tages: reine Spaßregeln für die Beratung, sie ändern nichts an den Spielregeln. */
  var PRANKS = [
    { t: 'Reimtag', x: 'Heute wird gereimt! Wer nicht reimt, muss einmal quaken.' },
    { t: 'Flüstertag', x: 'Heute wird nur geflüstert. Wer laut wird, muss quaken.' },
    { t: 'Heldentag', x: 'Sprecht heute wie eure Figur! Mindestens einmal muss der Lieblingsspruch fallen.' },
    { t: 'Kichererbsen-Tag', x: 'Das Wort Kobold ist verboten! Sagt stattdessen Kichererbse.' },
    { t: 'Roboter-Tag', x: 'Heute sprecht ihr wie Roboter. Piep, piep.' },
    { t: 'Zeitlupen-Tag', x: 'Alle reden und bewegen sich in Zeitlupe.' },
    { t: 'Piraten-Tag', x: 'Heute sprecht ihr wie Piraten. Arrr!' },
    { t: 'Tier-Tag', x: 'Hängt an jeden Satz ein Tiergeräusch. Euer Lieblingstier darf es sein.' },
    { t: 'Namenstausch', x: 'Heute heißt jeder wie seine Figur! Redet euch nur mit dem Figurennamen an.' },
    { t: 'Sing-Tag', x: 'Singt heute eure Verdächtigungen. Es muss nicht schön klingen.' },
    { t: 'Ehrlichkeitsrunde', x: 'Reihum sagt jeder in einem Satz, wen er heute verdächtigt. Passen gilt nicht.' },
    { t: 'Herz-Tag', x: 'Beim Sprechen liegt die Hand auf dem Herzen. Wer sie wegnimmt, quakt.' },
    { t: 'Nicht-Tag', x: 'Das Wort nicht ist verboten. Wer es sagt, muss einmal quaken.' },
    { t: 'Lächel-Tag', x: 'Alle müssen beim Reden lächeln, auch wenn sie jemanden verdächtigen.' },
    { t: 'Fünf-Wörter-Tag', x: 'Jeder Satz darf höchstens fünf Wörter haben.' },
    { t: 'Opa-Tag', x: 'Sprecht wie uralte Großeltern. Früher, da gab es noch richtige Kobolde.' }
  ];
  PRANKS.forEach(function (p, i) { p.id = 'tavi.prank.' + (i < 9 ? '0' : '') + (i + 1); add(p.id, p.t + '! ' + p.x); });

  /* Froschaufgaben: kleine Pantomime-Aufträge für den Frosch des Tages. */
  var FROGTASKS = [
    'Quake dein Lieblingslied. Die anderen raten, welches.',
    'Zeige nur mit Quaken und Gesten, wen du verdächtigst.',
    'Spiele deine Figur ohne Worte vor. Die anderen raten.',
    'Hüpfe einmal um den Tisch, bevor du dich meldest.',
    'Quake jedes Mal, wenn du glaubst, dass jemand lügt.',
    'Erzähle quakend, was du heute Nacht erlebt hast.',
    'Mach ein Gewitter, nur mit Quaken.'
  ];
  var FROGTASK_IDS = FROGTASKS.map(function (t, i) { var id = 'tavi.frogtask.0' + (i + 1); add(id, t); return id; });

  function variants(prefix) { return Object.keys(TAVI).filter(function (k) { return k.indexOf(prefix + '.') === 0 && /\.\d+$/.test(k); }); }
  function pickId(prefix, rng) { var v = variants(prefix); return v[Math.floor(rng() * v.length)]; }

  /* Auszeichnungen (nur Spaß, aber sie knüpfen an echte Spielereignisse an) */
  var AWARDS = [
    { id: 'frog', icon: '🐸', title: 'Lautester Frosch', test: function (p, G) { return p.st.frogs >= 1; }, score: function (p) { return p.st.frogs * 3; }, why: function (p) { return 'Hat ' + (p.st.frogs === 1 ? 'einmal' : p.st.frogs + '-mal') + ' im Dorf gequakt.'; } },
    { id: 'save', icon: '🛟', title: 'Retter in der Not', test: function (p) { return p.st.saves >= 1; }, score: function (p) { return p.st.saves * 4; }, why: function (p) { return 'Hat ' + (p.st.saves === 1 ? 'einen Zauber' : p.st.saves + ' Zauber') + ' gestoppt.'; } },
    { id: 'peek', icon: '🔍', title: 'Goldenes Schlüsselloch', test: function (p) { return p.st.found >= 1; }, score: function (p) { return p.st.found * 6; }, why: function () { return 'Hat durch Schlüsselloch oder Spur einen echten Kobold-Hinweis gefunden.'; } },
    { id: 'caught', icon: '🕵️', title: 'Frechster Kobold', test: function (p) { return p.team === 'kobold' && !p.caught; }, score: function () { return 8; }, why: function () { return 'Ist dem Dorf bis zum Schluss durch die Finger geschlüpft.'; } },
    { id: 'fall', icon: '🪤', title: 'Guter Verlierer', test: function (p) { return p.caught; }, score: function (p) { return 5 + (p.st.murmurs || 0); }, why: function () { return 'Wurde als Kobold entlarvt und hat danach tapfer dem Dorf geholfen.'; } },
    { id: 'wrong', icon: '😇', title: 'Unschuldslamm', test: function (p) { return p.st.wrong >= 1; }, score: function (p) { return p.st.wrong * 5; }, why: function () { return 'Wurde verdächtigt, war aber unschuldig. Ehrensache.'; } },
    { id: 'murmur', icon: '💤', title: 'Schlafredner', test: function (p) { return p.st.murmurs >= 2; }, score: function (p) { return p.st.murmurs * 2; }, why: function (p) { return 'Hat ' + p.st.murmurs + '-mal im Schlaf gemurmelt.'; } },
    { id: 'fogged', icon: '🌫️', title: 'Nebelkind', test: function (p) { return p.st.fogged >= 1; }, score: function (p) { return p.st.fogged * 4; }, why: function () { return 'Kicher hatte Angst vor dieser Fähigkeit und hat sie vernebelt.'; } },
    { id: 'rede', icon: '🔤', title: 'Redner des Jahres', test: function (p) { return p.st.rede >= 1; }, score: function () { return 3; }, why: function () { return 'Hat eine ganze Minute ungestört geredet.'; } },
    { id: 'dick', icon: '🧱', title: 'Dickschädel', test: function (p) { return p.dickUsed; }, score: function () { return 4; }, why: function () { return 'Der Zauber ist einfach an dieser Figur abgeprallt.'; } }
  ];
  var FALLBACK_AWARDS = [
    { icon: '🍪', title: 'Keks-Kenner', why: 'Hat die ganze Zeit so getan, als wüsste er etwas.' },
    { icon: '👁️', title: 'Meister des Blinzelns', why: 'Tavi hat alles gesehen.' },
    { icon: '🎭', title: 'Beste Nebenrolle', why: 'Ohne dich wäre es still gewesen.' },
    { icon: '🦉', title: 'Nachteule', why: 'Hat bis zum Schluss die Ohren gespitzt.' },
    { icon: '🧦', title: 'Sockenflüsterer', why: 'Niemand weiß, warum. Es passt einfach.' },
    { icon: '🎈', title: 'Stimmungskanone', why: 'Hat dafür gesorgt, dass alle gelacht haben.' }
  ];

  function awardsFor(G, rng) {
    var left = G.players.slice(), res = {}, fb = FALLBACK_AWARDS.slice();
    G.players.forEach(function (p) { res[p.id] = null; });
    var cands = [];
    AWARDS.forEach(function (a) { G.players.forEach(function (p) { if (a.test(p, G)) cands.push({ a: a, p: p, s: a.score(p) + rng() }); }); });
    cands.sort(function (x, y) { return y.s - x.s; });
    var usedAward = {};
    cands.forEach(function (c) { if (res[c.p.id] || usedAward[c.a.id]) return; res[c.p.id] = { icon: c.a.icon, title: c.a.title, why: c.a.why(c.p) }; usedAward[c.a.id] = 1; });
    G.players.forEach(function (p) { if (!res[p.id]) { var i = Math.floor(rng() * fb.length); var f = fb.splice(i, 1)[0] || FALLBACK_AWARDS[0]; res[p.id] = { icon: f.icon, title: f.title, why: f.why }; } });
    return res;
  }

  /* Eigenschaften-Vorschau: was der echte Avatar in Talea später bekommen könnte (hier nur Beispiel). */
  function traitGrowth(G, p) {
    var a = require_ab(p.ab), pts = 0, why = [];
    if (G.winner === 'dorf' && p.team !== 'kobold') { pts++; why.push('hat mit dem Dorf gewonnen'); }
    if (G.winner === 'kobold' && p.team === 'kobold') { pts++; why.push('hat als Kobold gewonnen'); }
    if (p.st.saves) { pts++; why.push('hat ' + (p.st.saves > 1 ? p.st.saves + ' Zauber' : 'einen Zauber') + ' gestoppt'); }
    if (p.st.found) { pts++; why.push('hat Hinweise auf Kobolde gefunden'); }
    if (p.st.frogs) { pts++; why.push('hat als Frosch tapfer gequakt'); }
    if (p.caught) { pts++; why.push('hat nach der Entzauberung weitergeholfen'); }
    if (!pts) { pts = 1; why.push('war bis zum Schluss dabei'); }
    return { trait: a.trait, icon: a.i, pts: Math.min(3, pts), why: p.name + ' ' + why.join(' und ') + '.' };
  }
  var AB_REF = null;
  function require_ab(id) { return AB_REF[id]; }
  function setAbilities(ab) { AB_REF = ab; }

  return { TAVI: TAVI, PRANKS: PRANKS, FROGTASKS: FROGTASKS, FROGTASK_IDS: FROGTASK_IDS, variants: variants, pickId: pickId,
    awardsFor: awardsFor, traitGrowth: traitGrowth, setAbilities: setAbilities };
});
