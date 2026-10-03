'use strict';
var B = require('./bots.js');
var pool = require('./chars.json').filter(function (c) { return c.a !== 'kobold'; });
var CASUAL = { theta: 0.35, agree: 0.5, claimFalse: 0.2 }, COMP = {};
var n = +process.argv[2] || 4000;
var out = [];
['erste', 'voll', 'profi'].forEach(function (lv) {
  console.log('=== ' + lv);
  console.log('N | kompetent: Dorf% Nächte 1-Nacht% knapp% falsch/Partie | menschlich: Dorf% Nächte knapp%');
  [4, 5, 6, 7, 8, 9].forEach(function (N) {
    var a = B.run(n, N, lv, null, COMP, 31, pool), c = B.run(n, N, lv, null, CASUAL, 31, pool);
    console.log(N + ' | ' + (100 * a.dorf / a.n).toFixed(0).padStart(3) + '%  ' + (a.nights / a.n).toFixed(1) + '  ' + (100 * a.early / a.n).toFixed(0).padStart(2) + '%  ' + (100 * a.close / a.n).toFixed(0).padStart(3) + '%  ' + (a.wrong / a.n).toFixed(1) + ' | ' + (100 * c.dorf / c.n).toFixed(0).padStart(3) + '%  ' + (c.nights / c.n).toFixed(1) + '  ' + (100 * c.close / c.n).toFixed(0).padStart(3) + '%');
    out.push({ lv: lv, N: N, comp: { dorf: a.dorf / a.n, nights: a.nights / a.n, early: a.early / a.n, close: a.close / a.n }, casual: { dorf: c.dorf / c.n, nights: c.nights / c.n, close: c.close / c.n } });
  });
});
require('fs').writeFileSync('final-sim.json', JSON.stringify(out, null, 1));
