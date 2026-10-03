'use strict';
/* Prüft den Fall-Generator: Ist der Täter immer eindeutig lösbar, egal welches Alibi er wählt? */
var E = require('./engine.js');
var pool = require('./chars-ma.json');
var PLACES8 = ['baeckerei', 'bibliothek', 'markt', 'garten', 'turm', 'bruecke', 'wirtshaus', 'schmiede'];
var STRATS = ['allein-leer', 'mit-gruppe', 'mit-einem', 'ort-ohne-nennung', 'einzelner-gerahmt', 'zufall'];
var n = +process.argv[2] || 3000;
var summary = {};
var problems = {};
['mini', 'junior', 'detektiv', 'meister'].forEach(function (lv) {
  [4, 5, 6, 7, 8].forEach(function (N) {
    var rng = E.mulberry(1000 + N * 7 + lv.length), names = []; for (var i = 0; i < N; i++) names.push('S' + i);
    var places = PLACES8.slice(0, N <= 6 ? 5 : 6), Pc = 'turm'; if (places.indexOf(Pc) < 0) places[0] = Pc;
    var st = { games: 0, attempts: 0, baseUnique: 0, baseSizeSum: 0, needSpur: { 0: 0, 1: 0, 2: 0, 3: 0, x: 0 }, conflictSum: 0, claimsOnlyUnvouched1: 0, fail: 0 };
    for (var g = 0; g < n; g++) {
      var W = E.generate({ names: names, pool: pool, level: lv, places: places, crimePlace: Pc, rng: rng });
      st.attempts += W.attempts;
      var kind = STRATS[g % STRATS.length];
      var claims = W.players.map(function (p) { return E.truthClaim(W, p.id); });
      claims[W.culprit] = E.culpritStrategy(W, kind, rng);
      var base = E.candidates(W, claims, []);
      st.games++; st.baseSizeSum += base.length;
      if (base.indexOf(W.culprit) < 0) { st.fail++; (problems[lv + N + ' Täter nicht in Kandidaten'] = problems[lv + N + ' Täter nicht in Kandidaten'] || []).push(kind); continue; }
      if (base.length === 1) { st.baseUnique++; st.needSpur[0]++; }
      else {
        var need = null;
        for (var k = 1; k <= E.LEVELS[lv].spuren; k++) { var sp = E.pickSpuren(W, claims, k, rng); if (sp) { var c2 = E.candidates(W, claims, sp); if (c2.length === 1 && c2[0] === W.culprit) { need = k; break; } } }
        if (need) st.needSpur[need]++; else { st.needSpur.x++; st.fail++; (problems[lv + N + ' nicht lösbar'] = problems[lv + N + ' nicht lösbar'] || []).push(kind); }
      }
      st.conflictSum += E.conflicts(W, claims).length;
      if (E.unvouched(W, claims, E.TC).length === 1) st.claimsOnlyUnvouched1++;
    }
    summary[lv + ' N=' + N] = st;
  });
});
console.log('Stufe/Spieler | Versuche/Fall | Täter schon aus Aussagen eindeutig | Ø Kandidaten nur Aussagen | Spuren nötig 0/1/2/3 | unlösbar | Ø Widersprüche | genau 1 ohne Zeugen');
Object.keys(summary).forEach(function (k) {
  var s = summary[k], g = s.games;
  console.log(k.padEnd(14) + ' | ' + (s.attempts / g).toFixed(1) + ' | ' + (100 * s.baseUnique / g).toFixed(0) + '% | ' + (s.baseSizeSum / g).toFixed(2) + ' | ' + [0, 1, 2, 3].map(function (i) { return (100 * s.needSpur[i] / g).toFixed(0) + '%'; }).join('/') + ' | ' + s.needSpur.x + ' | ' + (s.conflictSum / g).toFixed(1) + ' | ' + (100 * s.claimsOnlyUnvouched1 / g).toFixed(0) + '%');
});
console.log('Probleme:', Object.keys(problems).length ? problems : 'keine');
