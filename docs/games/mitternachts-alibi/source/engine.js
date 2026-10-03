/* Mitternachts-Alibi: Spiel-Engine (ohne DOM). Läuft im Browser und in Node.
 *
 * Modell: N Verdächtige, 3 Zeitabschnitte (Abend, Mitternacht, Morgengrauen), mehrere Orte.
 * Jeder weiß nur, wo er selbst war und wer dort war. Der Täter war um Mitternacht allein am Tatort
 * und erfindet dafür ein Alibi. Alle anderen sagen die Wahrheit.
 * Der Löser prüft für jeden Verdächtigen: "Wenn er es war, passen dann alle anderen Aussagen?" */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KMEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TC = 1; // Tatzeit: Mitternacht
  var LEVELS = {
    kinder: { n: 'Kinder-Fall', loners: 0, spuren: 2, flags: true, talk: 180 },
    detektiv: { n: 'Detektiv', loners: 1, spuren: 2, flags: false, talk: 180 },
    meister: { n: 'Meisterdetektiv', loners: 2, spuren: 3, flags: false, talk: 150 }
  };
  var SPUR_KEYS = ['fam', 'szc', 'spc', 'gdr'];

  function mulberry(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a, rng) { return a[Math.floor(rng() * a.length)]; }
  function same(a, b) { if (a.length !== b.length) return false; var x = a.slice().sort(), y = b.slice().sort(); for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false; return true; }

  /* ---------- Besetzung ---------- */
  function cast(names, pool, rng) {
    var chosen = shuffle(pool, rng).slice(0, names.length);
    return names.map(function (nm, i) { return { id: i, name: nm, ch: chosen[i] }; });
  }

  /* Zerlegt eine Anzahl in Gruppen der Größe 2–3 (keine Einzelnen). */
  function groupSizes(r, rng) {
    var out = [];
    while (r > 0) {
      if (r === 2 || r === 3) { out.push(r); break; }
      var s = rng() < 0.55 ? 2 : 3;
      if (r - s === 1) s = (s === 2) ? 3 : 2;
      out.push(s); r -= s;
    }
    return out;
  }
  /* Zerlegt Personen in Gruppen der Größe 1–3 (für die freien Zeitabschnitte). */
  function looseGroups(ids, rng) {
    var left = shuffle(ids, rng), groups = [];
    while (left.length) { var x = rng(), s = x < 0.18 ? 1 : x < 0.68 ? 2 : 3; s = Math.min(s, left.length); groups.push(left.splice(0, s)); }
    return groups;
  }

  /* ---------- Welt ---------- */
  function makeWorld(o) {
    var rng = o.rng || Math.random, players = o.players, N = players.length, L = LEVELS[o.level] || LEVELS.kinder;
    var places = o.places, Pc = o.crimePlace, culprit = o.culprit != null ? o.culprit : Math.floor(rng() * N);
    var Q = places.filter(function (p) { return p !== Pc; });
    var innocents = players.map(function (p) { return p.id; }).filter(function (i) { return i !== culprit; });
    var loners = o.loners != null ? o.loners : L.loners;
    // Einzelne so wählen, dass der Rest in Zweier/Dreier passt
    while (loners > 0 && (innocents.length - loners === 1 || innocents.length - loners < 0)) loners--;
    var shuffled = shuffle(innocents, rng), lonerIds = shuffled.slice(0, loners), rest = shuffled.slice(loners);
    var groups = [], sizes = groupSizes(rest.length, rng), idx = 0;
    sizes.forEach(function (s) { groups.push(rest.slice(idx, idx + s)); idx += s; });
    lonerIds.forEach(function (l) { groups.push([l]); });
    if (groups.length > Q.length) throw new Error('zu wenige Orte');
    var pos = [];
    for (var s = 0; s < N; s++) pos.push([null, null, null]);
    // Mitternacht
    var qs = shuffle(Q, rng);
    groups.forEach(function (g, gi) { g.forEach(function (m) { pos[m][TC] = qs[gi]; }); });
    pos[culprit][TC] = Pc;
    // Abend und Morgengrauen
    [0, 2].forEach(function (t) {
      var gs = looseGroups(players.map(function (p) { return p.id; }), rng);
      while (gs.length > places.length) { gs.sort(function (a, b) { return a.length - b.length; }); var a = gs.shift(); gs[0] = gs[0].concat(a); }
      var ps = shuffle(places, rng);
      gs.forEach(function (g, gi) { g.forEach(function (m) { pos[m][t] = ps[gi]; }); });
    });
    var comp = pos.map(function (row, s) { return row.map(function (p, t) { return players.map(function (q) { return q.id; }).filter(function (u) { return u !== s && pos[u][t] === p; }); }); });
    return { N: N, level: o.level, places: places, crimePlace: Pc, culprit: culprit, pos: pos, comp: comp, loners: lonerIds, players: players, rng: rng };
  }

  /* Wahre Aussage eines Verdächtigen: [{place, comp}, ...] für 3 Zeitabschnitte */
  function truthClaim(W, s) { return [0, 1, 2].map(function (t) { return { place: W.pos[s][t], comp: W.comp[s][t].slice() }; }); }
  /* Standard-Alibi des Täters (für Tests und als Vorgabe): am Tatort-Zeitpunkt woanders */
  function culpritClaim(W, place, comp) { var c = truthClaim(W, W.culprit); c[TC] = { place: place, comp: comp.slice() }; return c; }

  /* ---------- Spuren ---------- */
  function matches(ch, sp) { return ch[sp.k] === sp.v; }
  function spurText(sp) { return { fam: 'Kennfarbe ' + sp.v, szc: 'Größe: ' + sp.v, spc: 'Art: ' + sp.v, gdr: 'Geschlecht: ' + sp.v }[sp.k]; }

  /* ---------- Löser ---------- */
  /* claims: Array (pro Spieler) von Aussagen oder null (noch nicht abgegeben). Nur Abgegebene zählen. */
  function consistent(W, claims, k, spuren) {
    var P = W.players, ids = P.map(function (p) { return p.id; }), O = ids.filter(function (i) { return i !== k && claims[i]; });
    for (var q = 0; q < spuren.length; q++) if (!matches(P[k].ch, spuren[q])) return false;
    for (var t = 0; t < 3; t++) {
      var mentions = [];
      for (var a = 0; a < O.length; a++) {
        var s = O[a], cs = claims[s][t], expected = [];
        for (var b = 0; b < O.length; b++) { var u = O[b]; if (u !== s && claims[u][t].place === cs.place) expected.push(u); }
        var listed = cs.comp.filter(function (u) { return u !== k; });
        // Genannte, die noch nichts abgegeben haben, zählen nicht als Widerspruch
        listed = listed.filter(function (u) { return claims[u]; });
        if (!same(expected, listed)) return false;
        if (cs.comp.indexOf(k) >= 0) mentions.push(s);
      }
      var places = {}; mentions.forEach(function (s) { places[claims[s][t].place] = 1; });
      var keys = Object.keys(places);
      if (keys.length > 1) return false;
      if (keys.length === 1) {
        var p = keys[0];
        for (var c = 0; c < O.length; c++) { var u2 = O[c]; if (claims[u2][t].place === p && claims[u2][t].comp.indexOf(k) < 0) return false; }
        if (t === TC) return false; // k war ja allein am Tatort
      }
    }
    for (var d = 0; d < O.length; d++) if (claims[O[d]][TC].place === W.crimePlace) return false;
    return true;
  }
  function candidates(W, claims, spuren) {
    var out = [];
    for (var k = 0; k < W.N; k++) if (consistent(W, claims, k, spuren || [])) out.push(k);
    return out;
  }
  function subsets(arr, maxSize) {
    var out = [[]];
    (function rec(start, cur) { for (var i = start; i < arr.length; i++) { cur.push(arr[i]); if (cur.length <= maxSize) { out.push(cur.slice()); rec(i + 1, cur); } cur.pop(); } })(0, []);
    return out;
  }
  /* Wählt höchstens n Spuren, die den Täter eindeutig machen. Gibt null zurück, wenn es nicht geht. */
  function pickSpuren(W, claims, n, rng) {
    rng = rng || W.rng;
    var P = W.players, cul = P[W.culprit].ch, all = [];
    SPUR_KEYS.forEach(function (k) { all.push({ k: k, v: cul[k] }); });
    var base = candidates(W, claims, []);
    if (base.indexOf(W.culprit) < 0) return null;
    var best = null;
    subsets(all, n).forEach(function (set) {
      var rem = base.filter(function (c) { return set.every(function (sp) { return matches(P[c].ch, sp); }); });
      if (rem.length !== 1) return;
      // lieber Spuren, die auch insgesamt viele ausschließen (informativ) und möglichst genau n
      var elim = 0; P.forEach(function (p) { if (!set.every(function (sp) { return matches(p.ch, sp); })) elim++; });
      // Ist der Täter schon aus den Aussagen eindeutig: möglichst informative Spuren. Sonst: die kleinste entscheidende Gruppe.
      var score = (base.length > 1 ? -100 * set.length : 0) + elim + rng() * 0.01;
      if (!best || score > best.score) best = { set: set, score: score };
    });
    if (!best) return null;
    var decisive = best.set.slice(), fillers = [], fallback = [], curr = base.slice();
    var rest = shuffle(all.filter(function (a) { return !decisive.some(function (c) { return c.k === a.k; }); }), rng);
    // Füller zuerst: wahre Spuren, die den Täter noch nicht verraten. Die entscheidende Spur kommt zuletzt.
    while (decisive.length + fillers.length < n && rest.length) {
      var f = rest.shift(), after = curr.filter(function (c) { return matches(P[c].ch, f); });
      if (base.length > 1 && after.length < 2) { fallback.push(f); continue; }
      fillers.push(f); curr = after;
    }
    while (decisive.length + fillers.length < n && fallback.length) fillers.push(fallback.shift());
    return fillers.concat(shuffle(decisive, rng));
  }
  /* Kann man im schlimmsten Fall (Täter und alle Einzelnen unentdeckt) mit n Spuren eindeutig lösen? */
  function resolvable(players, culprit, loners, n) {
    var cul = players[culprit].ch, all = SPUR_KEYS.map(function (k) { return { k: k, v: cul[k] }; });
    var cand = [culprit].concat(loners);
    if (cand.length === 1) return true;
    return subsets(all, n).some(function (set) { return cand.filter(function (c) { return set.every(function (sp) { return matches(players[c].ch, sp); }); }).length === 1; });
  }

  /* ---------- Hilfen für die Tafel ---------- */
  function conflicts(W, claims) {
    var out = [], seen = {};
    for (var t = 0; t < 3; t++) for (var s = 0; s < W.N; s++) for (var u = s + 1; u < W.N; u++) {
      if (!claims[s] || !claims[u]) continue;
      var a = claims[s][t], b = claims[u][t], aU = a.comp.indexOf(u) >= 0, bS = b.comp.indexOf(s) >= 0, samePlace = a.place === b.place;
      var bad = (aU && !(samePlace && bS)) || (bS && !(samePlace && aU)) || (samePlace && !(aU && bS));
      if (bad) { var key = t + ':' + s + ':' + u; if (!seen[key]) { seen[key] = 1; out.push({ t: t, a: s, b: u }); } }
    }
    return out;
  }
  /* Wer wird um den Zeitpunkt t von niemandem genannt? (nur Abgegebene zählen als Zeugen) */
  function unvouched(W, claims, t) {
    var out = [];
    for (var s = 0; s < W.N; s++) {
      var named = false;
      for (var u = 0; u < W.N; u++) if (u !== s && claims[u] && claims[u][t].comp.indexOf(s) >= 0) named = true;
      if (!named) out.push(s);
    }
    return out;
  }
  /* Vorschläge für ein Zeugen-Duell: Orte, an denen laut Aussagen mindestens zwei zusammen waren. */
  function duels(W, claims, t, rng) {
    var byPlace = {};
    for (var s = 0; s < W.N; s++) if (claims[s]) { var p = claims[s][t].place; (byPlace[p] = byPlace[p] || []).push(s); }
    var list = [];
    Object.keys(byPlace).forEach(function (p) { if (byPlace[p].length >= 2) list.push({ place: p, t: t, who: byPlace[p] }); });
    return shuffle(list, rng || Math.random);
  }

  /* ---------- Fall erzeugen (mit Prüfung) ---------- */
  function generate(o) {
    var rng = o.rng || Math.random, level = o.level || 'kinder', L = LEVELS[level], names = o.names, N = names.length;
    for (var attempt = 0; attempt < 400; attempt++) {
      var players = cast(names, o.pool, rng), culprit = Math.floor(rng() * N);
      var W;
      try { W = makeWorld({ players: players, level: level, places: o.places, crimePlace: o.crimePlace, culprit: culprit, rng: rng }); } catch (e) { continue; }
      if (!resolvable(players, culprit, W.loners, L.spuren)) continue;
      W.attempts = attempt + 1;
      return W;
    }
    throw new Error('kein lösbarer Fall gefunden');
  }

  /* ---------- Strategien des Täters (für Tests und Bots) ---------- */
  function culpritStrategy(W, kind, rng) {
    var c = W.culprit, Pc = W.crimePlace, others = W.players.map(function (p) { return p.id; }).filter(function (i) { return i !== c; });
    var occupied = {}; others.forEach(function (i) { occupied[W.pos[i][TC]] = (occupied[W.pos[i][TC]] || []).concat([i]); });
    var places = W.places.filter(function (p) { return p !== Pc; });
    var empty = places.filter(function (p) { return !occupied[p]; });
    var groupPlaces = Object.keys(occupied);
    if (kind === 'allein-leer' && empty.length) return culpritClaim(W, pick(empty, rng), []);
    if (kind === 'mit-gruppe' && groupPlaces.length) { var p = pick(groupPlaces, rng); return culpritClaim(W, p, occupied[p]); }
    if (kind === 'mit-einem' && groupPlaces.length) { var p2 = pick(groupPlaces, rng); return culpritClaim(W, p2, [pick(occupied[p2], rng)]); }
    if (kind === 'ort-ohne-nennung' && groupPlaces.length) return culpritClaim(W, pick(groupPlaces, rng), []);
    if (kind === 'einzelner-gerahmt' && W.loners.length) { var l = pick(W.loners, rng); return culpritClaim(W, W.pos[l][TC], [l]); }
    var pl = pick(places, rng), cnt = Math.floor(rng() * 3), cm = shuffle(others, rng).slice(0, cnt);
    return culpritClaim(W, pl, cm);
  }

  return { TC: TC, LEVELS: LEVELS, SPUR_KEYS: SPUR_KEYS, mulberry: mulberry, shuffle: shuffle, pick: pick, cast: cast, makeWorld: makeWorld, truthClaim: truthClaim, culpritClaim: culpritClaim,
    matches: matches, spurText: spurText, consistent: consistent, candidates: candidates, pickSpuren: pickSpuren, resolvable: resolvable,
    conflicts: conflicts, unvouched: unvouched, duels: duels, generate: generate, culpritStrategy: culpritStrategy };
});
