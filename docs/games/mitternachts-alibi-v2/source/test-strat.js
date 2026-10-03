'use strict';
/* Wie gut sind die Täter-Strategien? Und wie oft entscheidet schon die erste Spur? */
var E = require('./engine.js'), pool = require('./chars-ma.json');
var PLACES8 = ['baeckerei', 'bibliothek', 'markt', 'garten', 'turm', 'bruecke', 'wirtshaus', 'schmiede'];
var STRATS = ['allein-leer', 'mit-gruppe', 'mit-einem', 'ort-ohne-nennung', 'einzelner-gerahmt', 'zufall'];
console.log('Stufe | Strategie | Kandidaten nur aus Aussagen (Ø) | Täter sofort eindeutig | Spuren nötig (Ø) | erste Spur entscheidet schon');
['mini', 'junior', 'detektiv', 'meister'].forEach(function (lv) {
  STRATS.forEach(function (st) {
    var N = 6, rng = E.mulberry(77), names = ['a', 'b', 'c', 'd', 'e', 'f'], places = PLACES8.slice(0, 5); places[4] = 'turm'; var cnt = 0, base = 0, uniq = 0, need = 0, first = 0, withSpur = 0, n = 4000;
    for (var g = 0; g < n; g++) {
      var W = E.generate({ names: names, pool: pool, level: lv, places: places, crimePlace: 'turm', rng: rng });
      if (st === 'einzelner-gerahmt' && !W.loners.length) continue;
      var claims = W.players.map(function (p) { return E.truthClaim(W, p.id); }); claims[W.culprit] = E.culpritStrategy(W, st, rng);
      var b = E.candidates(W, claims, []); base += b.length; cnt++;
      if (b.length === 1) { uniq++; continue; }
      withSpur++;
      var full = E.pickSpuren(W, claims, E.LEVELS[lv].spuren, rng);
      if (full && E.candidates(W, claims, full.slice(0, 1)).length === 1) first++;
      for (var k = 1; k <= E.LEVELS[lv].spuren; k++) { var sp = E.pickSpuren(W, claims, k, rng); if (sp && E.candidates(W, claims, sp).length === 1) { need += k; break; } }
    }
    if (!cnt) { console.log(lv.padEnd(8) + ' | ' + st.padEnd(18) + ' | (kein Einzelner in dieser Stufe)'); return; }
    console.log(lv.padEnd(8) + ' | ' + st.padEnd(18) + ' | ' + (base / cnt).toFixed(2) + ' | ' + (100 * uniq / cnt).toFixed(0) + '% | ' + (need / Math.max(1, cnt - uniq)).toFixed(2) + ' | ' + (withSpur ? (100 * first / withSpur).toFixed(0) + '%' : '-'));
  });
});
