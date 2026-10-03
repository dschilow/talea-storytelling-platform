'use strict';
/* Seltene Bildschirme bei schmaler Breite: Setup mit Details, Kurz-Tour, Regeln, Besetzungs-Overlay, Hand-off, Dorfkarte mit 8 Spielern. */
var path = require('path'), { pathToFileURL } = require('url'), launch = require('./pw.js');
var W = +process.argv[2] || 340;
(async () => {
  var b = await launch(), errs = [];
  var ctx = await b.newContext({ viewport: { width: W, height: 780 } });
  var p = await ctx.newPage();
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto(pathToFileURL(path.resolve('out/Mitternachts-Alibi.html')).href);
  await p.evaluate(() => { var T = document.getElementById('talea-alibi').taleaTest; T.setFast(true); T.setup.count = 8; T.setup.level = 'meister'; T.render(); });
  await p.evaluate(() => document.querySelector('#talea-alibi .km-short').open = true);
  await p.screenshot({ path: 'shots/w' + W + '-01-setup.png', fullPage: true });
  await p.click('[data-a=tour]'); await p.waitForTimeout(50);
  await p.screenshot({ path: 'shots/w' + W + '-02-tour1.png', fullPage: true });
  for (var k = 0; k < 2; k++) await p.click('[data-a=tourNext]');
  await p.screenshot({ path: 'shots/w' + W + '-03-tour3.png', fullPage: true });
  await p.click('[data-a=closeOverlay]');
  await p.click('[data-a=rules]'); await p.waitForTimeout(50);
  await p.screenshot({ path: 'shots/w' + W + '-04-rules.png', fullPage: true });
  await p.click('[data-a=closeOverlay]');
  await p.click('[data-a=begin]');
  // alle 8 Karten ziehen
  for (var i = 0; i < 8; i++) { await p.click('[data-a=castShow]'); if (i === 3) await p.screenshot({ path: 'shots/w' + W + '-05-cast4.png', fullPage: true }); await p.click('[data-a=castNext]'); }
  await p.screenshot({ path: 'shots/w' + W + '-06-wall.png', fullPage: true });
  await p.click('[data-a=cast]'); await p.waitForTimeout(50);
  await p.screenshot({ path: 'shots/w' + W + '-07-castoverlay.png', fullPage: true });
  await p.click('[data-a=closeOverlay]');
  await p.click('[data-a=toCase]'); await p.click('[data-a=toAct]'); await p.click('[data-a=actGo]');
  await p.screenshot({ path: 'shots/w' + W + '-08-hand.png', fullPage: true });
  // Abend komplett durchspielen, dann Karte zeigen
  for (var n = 0; n < 8; n++) { await p.click('[data-a=handAnswer]'); await p.click('[data-a=toAnnounce]'); if (n === 7) await p.screenshot({ path: 'shots/w' + W + '-09-announce8.png', fullPage: true }); await p.click('[data-a=annNext]'); }
  await p.screenshot({ path: 'shots/w' + W + '-10-done8.png', fullPage: true });
  var wid = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log('Breite:', JSON.stringify(wid), wid.sw > wid.cw ? 'HORIZONTALES SCROLLEN!' : 'ok');
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
