/* Kobold-Nacht: Spiel-Engine (ohne DOM). Läuft im Browser und in Node (Simulationen).
 * Alles, was Regeln betrifft, steht hier; die Oberfläche ruft nur auf und zeigt an. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KNEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var AB = {
    schluessel: { i: '🔍', trait: 'Neugier', name: 'Schlüsselloch', when: 'night' },
    laterne: { i: '🦁', trait: 'Mut', name: 'Laterne', when: 'night' },
    trost: { i: '💗', trait: 'Empathie', name: 'Trostpflaster', when: 'night' },
    spur: { i: '🔢', trait: 'Logik', name: 'Spurenleser', when: 'night' },
    honig: { i: '🎨', trait: 'Kreativität', name: 'Honigfalle', when: 'night' },
    buch: { i: '🧠', trait: 'Wissen', name: 'Bücherwurm', when: 'night' },
    rede: { i: '🔤', trait: 'Wortschatz', name: 'Redestein', when: 'day' },
    glocke: { i: '🤝', trait: 'Teamgeist', name: 'Dorfglocke', when: 'day' },
    dick: { i: '🧗', trait: 'Ausdauer', name: 'Dickkopf', when: 'day' }
  };
  var NIGHT_ORDER = ['laterne', 'honig', 'trost', 'schluessel', 'spur', 'buch'];
  var DAY_AB = ['rede', 'glocke', 'dick'];
  var FOGGABLE = ['laterne', 'honig', 'trost', 'schluessel', 'spur'];

  var LEVELS = {
    erste: { n: 'Erste Partie', pool: ['schluessel', 'laterne', 'trost', 'buch', 'rede', 'glocke', 'dick'], extra: ['spur', 'honig'], talk: 180 },
    voll: { n: 'Volles Spiel', pool: ['schluessel', 'laterne', 'trost', 'spur', 'honig', 'buch', 'rede', 'glocke', 'dick'], extra: [], talk: 180 },
    profi: { n: 'Profi-Nacht', pool: ['schluessel', 'laterne', 'trost', 'spur', 'honig', 'buch', 'rede', 'glocke', 'dick'], extra: [], talk: 120 }
  };

  /* Basisregeln. configFor() ergänzt sie je Stufe und Spielerzahl (Werte stammen aus den Simulationen). */
  var RULES = {
    handles: 7, kobolds: 1,
    peekUses: 1, traceUses: 1, healUses: 1, trapUses: 1,
    infoFromNight: 2,
    murKob: 2, murOther: 1,
    wrongCost: 1,
    fogUses: 0, imitateUses: 0
  };

  function configFor(level, N) {
    var r = {}, k;
    for (k in RULES) r[k] = RULES[k];
    r.handles = N <= 4 ? 6 : (N <= 6 ? 7 : 9);
    if (level === 'erste') { r.kobolds = N <= 6 ? 1 : 2; r.wrongCost = 1; r.fogUses = 0; r.imitateUses = 0; }
    else if (level === 'voll') { r.kobolds = N <= 4 ? 1 : 2; r.wrongCost = 2; r.fogUses = 1; r.imitateUses = 0; }
    else { r.kobolds = N <= 4 ? 1 : 2; r.wrongCost = 2; r.fogUses = 2; r.imitateUses = 1; }
    var L = {}, base = LEVELS[level] || LEVELS.erste;
    for (k in base) L[k] = base[k];
    if (N <= 4) {
      /* Zu viele Prüf-Fähigkeiten machen kleine Runden zu leicht (Simulation: 98 % Dorfsiege). */
      var noInfo = function (a) { return a !== 'schluessel' && a !== 'spur'; };
      L.req = ['laterne']; L.pool = base.pool.filter(noInfo); L.extra = base.extra.filter(noInfo);
    }
    return { rules: r, levelCfg: L };
  }

  function mulberry(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a, rng) { return a[Math.floor(rng() * a.length)]; }

  function chooseAbilities(N, L, rng) {
    var chosen = (L.req || ['schluessel', 'laterne']).slice();
    var day = shuffle(L.pool.filter(function (a) { return DAY_AB.indexOf(a) >= 0; }), rng).slice(0, N >= 6 ? 2 : 1);
    chosen = chosen.concat(day);
    var rest = shuffle(L.pool.filter(function (a) { return chosen.indexOf(a) < 0; }), rng);
    while (chosen.length < N && rest.length) chosen.push(rest.shift());
    var ex = shuffle(L.extra.slice(), rng);
    while (chosen.length < N && ex.length) chosen.push(ex.shift());
    return shuffle(chosen.slice(0, N), rng);
  }

  function create(o) {
    var rng = o.rng || Math.random, names = o.names, N = names.length, level = o.level || 'erste';
    var cfg = configFor(level, N), rules = cfg.rules, L = o.levelCfg || cfg.levelCfg, k;
    for (k in (o.rules || {})) rules[k] = o.rules[k];
    if (typeof rules.handles === 'function') rules.handles = rules.handles(N);
    if (typeof rules.kobolds === 'function') rules.kobolds = rules.kobolds(N);
    var used = {}, abs = chooseAbilities(N, L, rng);
    var players = names.map(function (nm, i) {
      var opts = o.pool.filter(function (c) { return c.a === abs[i] && !used[c.n]; });
      var c = pick(opts, rng); used[c.n] = 1;
      return { id: i, name: nm, ch: c, ab: abs[i], team: 'dorf', frog: false, caught: false, cleared: false, dickUsed: false,
        uses: { peek: rules.peekUses, trace: rules.traceUses, heal: rules.healUses, trap: rules.trapUses, rede: 1 },
        st: { frogs: 0, wrong: 0, saves: 0, found: 0, murmurs: 0, caught: 0, fogged: 0, rede: 0 } };
    });
    shuffle(players, rng).slice(0, rules.kobolds).forEach(function (p) { p.team = 'kobold'; });
    return { rng: rng, rules: rules, L: L, level: level, players: players, k: rules.kobolds, handles: rules.handles, max: rules.handles,
      night: 0, lastVictim: null, lastLantern: null, fogLeft: rules.fogUses, imitLeft: rules.imitateUses, redeToday: false,
      steps: [], nd: null, morning: null, events: [], winner: null, pub: { murmurs: [], honeys: [], victims: [] } };
  }

  function P(G, id) { return G.players[id]; }
  function isKob(p) { return p.team === 'kobold' && !p.caught; }
  function revealed(p) { return p.caught || p.cleared; }
  function holder(G, ab) { for (var i = 0; i < G.players.length; i++) if (G.players[i].ab === ab) return G.players[i]; return null; }
  function activeKobolds(G) { return G.players.filter(isKob); }
  function finale(G) { return G.handles <= G.rules.wrongCost; }
  function mood(G) { var r = G.handles / G.max; return G.handles <= 1 ? 'last' : (G.handles <= 2 || r <= 0.34) ? 'tense' : 'calm'; }

  function nightBegin(G) {
    G.night++; G.redeToday = false;
    G.players.forEach(function (p) { p.frog = false; });
    G.nd = { target: null, lantern: null, trap: null, heal: false, peek: null, peekR: null, track: null, book: null, imitate: null, fog: null, fogHit: {} };
    G.steps = ['kobold'].concat(NIGHT_ORDER.filter(function (a) { return holder(G, a); }));
    return G.steps;
  }
  function options(G, ab) {
    var me = (ab === 'kobold') ? null : holder(G, ab);
    return G.players.filter(function (p) {
      if (ab === 'kobold') return p.id !== G.lastVictim;
      if (ab === 'laterne') return p.id !== G.lastLantern;
      if (ab === 'honig') return true;
      if (ab === 'schluessel' || ab === 'spur') return p.id !== me.id && !revealed(p);
      return false;
    }).map(function (p) { return p.id; });
  }
  /* Warum ist eine Fähigkeit heute Nacht nicht benutzbar? null = benutzbar. */
  function blocked(G, ab) {
    var h = holder(G, ab); if (!h) return 'none';
    if ((ab === 'schluessel' || ab === 'spur') && G.night < G.rules.infoFromNight) return 'early';
    if (ab === 'schluessel' && h.uses.peek <= 0) return 'used';
    if (ab === 'spur' && h.uses.trace <= 0) return 'used';
    if (ab === 'honig' && h.uses.trap <= 0) return 'used';
    if (ab === 'trost' && h.uses.heal <= 0) return 'used';
    if (ab === 'buch' && G.night !== 1) return 'late';
    if (ab === 'schluessel' && options(G, ab).length < 1) return 'nobody';
    if (ab === 'spur' && options(G, ab).length < 2) return 'nobody';
    return null;
  }
  function available(G, ab) { return blocked(G, ab) === null; }
  function fogged(G, ab) { return G.nd.fog === ab; }

  function setVictim(G, id) { G.nd.target = id; }
  function setFog(G, ab) { G.nd.fog = ab; G.fogLeft--; var h = holder(G, ab); if (h) h.st.fogged++; }
  function setImitate(G, id) { G.nd.imitate = id; G.imitLeft--; }
  function setLantern(G, id) { if (fogged(G, 'laterne')) { G.nd.fogHit.laterne = 1; return false; } G.nd.lantern = id; return true; }
  function setTrap(G, id) { if (fogged(G, 'honig')) { G.nd.fogHit.honig = 1; return false; } holder(G, 'honig').uses.trap--; G.nd.trap = id; return true; }
  function heal(G) { if (fogged(G, 'trost')) { G.nd.fogHit.trost = 1; return false; } holder(G, 'trost').uses.heal--; G.nd.heal = true; return true; }
  function peek(G, id) {
    if (fogged(G, 'schluessel')) { G.nd.fogHit.schluessel = 1; return null; }
    var h = holder(G, 'schluessel'); h.uses.peek--; G.nd.peek = id; var r = isKob(P(G, id)); G.nd.peekR = r;
    if (r && !isKob(h)) h.st.found++; return r;
  }
  function trace(G, a, b) {
    if (fogged(G, 'spur')) { G.nd.fogHit.spur = 1; return null; }
    var h = holder(G, 'spur'); h.uses.trace--; var n = (isKob(P(G, a)) ? 1 : 0) + (isKob(P(G, b)) ? 1 : 0); G.nd.track = [a, b, n];
    if (n > 0 && !isKob(h)) h.st.found++; return n;
  }
  function book(G) {
    var h = holder(G, 'buch');
    var cand = G.players.filter(function (p) { return !isKob(p) && p.id !== h.id; });
    var c = pick(cand, G.rng); G.nd.book = c.id; return c.id;
  }

  function resolveNight(G) {
    var nd = G.nd, v = nd.target != null ? P(G, nd.target) : null, how = null, honey = null, rng = G.rng;
    if (v) {
      if (nd.lantern === v.id) { how = 'laterne'; var lh = holder(G, 'laterne'); if (lh) lh.st.saves++; }
      else if (nd.trap === v.id) {
        how = 'honig';
        var kb = pick(activeKobolds(G), rng);
        var others = G.players.filter(function (p) { return !isKob(p) && !revealed(p) && p.id !== v.id; });
        var o = others.length ? pick(others, rng) : null;
        honey = shuffle([kb].concat(o ? [o] : []), rng).map(function (p) { return p.id; });
        var hh = holder(G, 'honig'); if (hh) hh.st.saves++;
      }
      else if (nd.heal) { how = 'trost'; var th = holder(G, 'trost'); if (th) th.st.saves++; }
      else if (v.ab === 'dick' && !v.dickUsed) { how = 'dick'; v.dickUsed = true; }
      else { how = 'frog'; v.frog = true; v.st.frogs++; }
      G.lastVictim = v.id;
    }
    G.lastLantern = nd.lantern;
    G.handles--;
    var mur = null, faked = false;
    if (nd.imitate != null) { mur = P(G, nd.imitate); faked = true; }
    else {
      var bag = [];
      G.players.forEach(function (p) { if (revealed(p)) return; var w = isKob(p) ? G.rules.murKob : G.rules.murOther; for (var i = 0; i < w; i++) bag.push(p); });
      if (!bag.length) G.players.forEach(function (p) { bag.push(p); });
      mur = pick(bag, rng);
    }
    mur.st.murmurs++;
    G.morning = { victim: v, how: how, honey: honey, mur: mur, faked: faked };
    G.pub.murmurs.push({ night: G.night, who: mur.id });
    if (honey) G.pub.honeys.push({ night: G.night, pair: honey });
    if (v) G.pub.victims.push({ night: G.night, who: v.id, how: how });
    G.events.push({ t: 'night', night: G.night, victim: v ? v.id : null, how: how, honey: honey, mur: mur.id, faked: faked, lantern: nd.lantern, trap: nd.trap, heal: nd.heal,
      peek: nd.peek, peekR: nd.peekR, track: nd.track, book: nd.book, fog: nd.fog, fogHit: nd.fogHit, handles: G.handles });
    checkWin(G);
    return G.morning;
  }
  function checkWin(G) {
    if (G.winner) return G.winner;
    if (activeKobolds(G).length === 0) G.winner = 'dorf';
    else if (G.handles <= 0) G.winner = 'kobold';
    return G.winner;
  }

  function useRede(G) { var h = holder(G, 'rede'); h.uses.rede--; h.st.rede++; G.redeToday = true; }
  function canRede(G) { var h = holder(G, 'rede'); return !!h && !h.frog && h.uses.rede > 0; }
  function canBell(G) { var h = holder(G, 'glocke'); return !!h && !h.frog; }
  function accuse(G, id) {
    var p = P(G, id), kob = isKob(p), cost = 0;
    if (kob) { p.caught = true; p.st.caught++; }
    else { p.cleared = true; p.st.wrong++; cost = G.rules.wrongCost; G.handles -= cost; }
    G.events.push({ t: 'day', night: G.night, kind: 'accuse', id: id, kob: kob, cost: cost, handles: G.handles });
    checkWin(G);
    return kob;
  }
  function nobody(G, why) { G.events.push({ t: 'day', night: G.night, kind: why || 'nobody', handles: G.handles }); }

  return { AB: AB, NIGHT_ORDER: NIGHT_ORDER, DAY_AB: DAY_AB, FOGGABLE: FOGGABLE, LEVELS: LEVELS, RULES: RULES, configFor: configFor,
    mulberry: mulberry, shuffle: shuffle, pick: pick, create: create, P: P, isKob: isKob, revealed: revealed, holder: holder,
    activeKobolds: activeKobolds, finale: finale, mood: mood, nightBegin: nightBegin, blocked: blocked, available: available, fogged: fogged,
    options: options, setVictim: setVictim, setFog: setFog, setImitate: setImitate, setLantern: setLantern, setTrap: setTrap, heal: heal,
    peek: peek, trace: trace, book: book, resolveNight: resolveNight, checkWin: checkWin,
    useRede: useRede, canRede: canRede, canBell: canBell, accuse: accuse, nobody: nobody };
});
