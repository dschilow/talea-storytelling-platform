'use strict';
/* Prüft den Import vorgenerierter Aufnahmen: Namen werden erkannt (Sprechtexte, Effekte), Unbekanntes wird übersprungen, Abspielen stürzt nicht ab. */
var fs = require('fs'), path = require('path'), { pathToFileURL } = require('url'), launch = require('./pw.js');
function wav(file, ms) { var sr = 8000, n = Math.floor(sr * ms / 1000), buf = Buffer.alloc(44 + n * 2); buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40); fs.writeFileSync(file, buf); }
(async () => {
  var dir = path.join(__dirname, 'tmp-wav'); fs.mkdirSync(dir, { recursive: true });
  var names = ['kom.welcome', 'w.num.1', 'num.1', 'numc.2', 'fx.stamp', 'fx.sight.maus', 'amb.evening', 'unbekannt.clip', 'sight.maus'];
  names.forEach(function (n) { wav(path.join(dir, n + '.wav'), 120); });
  var b = await launch(), ctx = await b.newContext({ viewport: { width: 400, height: 860 } }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(pathToFileURL(path.resolve('out/Mitternachts-Alibi.html')).href);
  await p.setInputFiles('#km-audio-files', names.map(n => path.join(dir, n + '.wav')));
  await p.waitForTimeout(400);
  var r = await p.evaluate(() => { var T = document.getElementById('talea-alibi').taleaTest; return { ids: Object.keys(T.recorded).sort(), status: document.getElementById('km-audio-status').textContent }; });
  console.log('Importiert:', r.ids.join(', '));
  console.log('Status:', r.status);
  var ok = ['kom.welcome', 'w.num.1', 'num.1', 'numc.2', 'fx.stamp', 'fx.sight.maus', 'amb.evening', 'sight.maus'].every(x => r.ids.indexOf(x) >= 0) && r.ids.indexOf('unbekannt.clip') < 0;
  // Abspielen (nicht schnell): darf nicht abstürzen
  await p.evaluate(async () => { var T = document.getElementById('talea-alibi').taleaTest; T.setFast(false); await T.say(['kom.welcome', 'num.1', { fx: 'fx.sight.maus' }, 'sight.maus']); });
  console.log(ok ? 'IMPORT OK' : 'IMPORT FEHLER', errs.length ? errs : 'keine Konsolenfehler');
  await b.close();
})();
