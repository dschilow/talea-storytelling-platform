'use strict';
/* Baut Mitternachts-Alibi.html (eine Datei), eine Artefakt-Fassung ohne HTML-Hülle, Stimmen.json und Effekte.json. */
var fs = require('fs'), path = require('path');
var D = __dirname;
function read(f) { return fs.readFileSync(path.join(D, f), 'utf8'); }

var base = JSON.parse(read('chars-ma.json'));
var T = {}; [1, 2, 3, 4, 5, 6].forEach(function (i) { Object.assign(T, require('./text/b' + i + '.js')); });
var chars = base.map(function (c) {
  var t = T[c.s]; if (!t) throw new Error('Text fehlt: ' + c.s);
  return { n: c.n, s: c.s, p: c.p, q: c.q, fam: c.fam, szc: c.szc, spc: c.spc, gdr: c.gdr, story: t.story, intro: t.intro, stmt: t.stmt, deny: t.deny, confess: t.confess, smug: t.smug };
});
var imgFile = [path.join(D, 'images.json'), path.join(D, '..', 'kn4', 'images.json')].filter(function (f) { return fs.existsSync(f); })[0];
if (!imgFile) throw new Error('images.json fehlt (89 Figurenbilder als base64-webp, Schlüssel = Figuren-Slug)');
fs.mkdirSync(path.join(D, 'out'), { recursive: true });
var images = JSON.parse(fs.readFileSync(imgFile, 'utf8'));
var missing = chars.filter(function (c) { return !images[c.s]; }).map(function (c) { return c.s; });
if (missing.length) throw new Error('Bilder fehlen: ' + missing.join(', '));

/* CSS auf #talea-alibi begrenzen */
function scopeCss(css, prefix) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  function block(str) {
    var out = '', i = 0;
    while (i < str.length) {
      var open = str.indexOf('{', i); if (open < 0) break;
      var sel = str.slice(i, open).trim(), depth = 1, j = open + 1;
      while (j < str.length && depth) { if (str[j] === '{') depth++; else if (str[j] === '}') depth--; j++; }
      var body = str.slice(open + 1, j - 1);
      if (/^@media|^@supports/.test(sel)) out += sel + '{' + block(body) + '}';
      else if (/^@/.test(sel)) out += sel + '{' + body + '}';
      else out += sel.split(',').map(function (s) { s = s.trim(); return s.indexOf('.km-root') === 0 ? prefix + s.slice(8) : prefix + ' ' + s; }).join(',') + '{' + body + '}';
      i = j;
    }
    return out;
  }
  return block(css);
}
var css = scopeCss(read('style.css'), '#talea-alibi');

/* Stimmen.json */
var Content = require('./content.js');
var TAGS = { intro: '[confident, in character]', stmt: '[calm, matter-of-fact]', deny: '[indignant]', confess: '[quietly, resigned]', smug: '[smug, quietly laughing]' };
var voices = {};
Object.keys(Content.KOM).sort().forEach(function (id) {
  var tag = /einspruch/.test(id) ? '[sharp, sudden]' : /intro$/.test(id) ? '[calm, slow, noir narrator]' : /escaped$/.test(id) ? '[quietly, a little wry]' : /solved$/.test(id) ? '[warm, relieved]' : '[calm, measured]';
  voices[id] = { filename: id + '.mp3', voice: 'Kommissar Tavi', text: Content.KOM[id], eleven: tag + ' ' + Content.KOM[id], note: 'Erzähler. Ruhige, warme Männerstimme wie im Hörspiel, trockener Humor, keine Albernheit.' };
});
var T2 = {}; Object.keys(T).forEach(function (k) { T2[k] = T[k]; });
chars.forEach(function (c) {
  ['intro', 'stmt', 'deny', 'confess', 'smug'].forEach(function (k) {
    var id = 'character.' + c.s + '.' + k;
    voices[id] = { filename: id + '.mp3', voice: c.n, voiceDesign: T2[c.s].voice, text: c[k], eleven: TAGS[k] + ' ' + c[k], note: 'Figur ' + c.n + ', Zeile „' + k + '“' };
  });
});
var effects = {
  'fx.stamp': 'Dull wooden rubber stamp slamming on paper, close, one hit',
  'fx.type': 'A single mechanical typewriter key strike, dry, close',
  'fx.gavel': 'A wooden judge gavel hitting a block, short',
  'fx.chime': 'Soft brass desk bell, one ring, warm room',
  'fx.tick': 'A single dry clock tick, quiet room',
  'fx.sting': 'Short suspense string sting, three low notes rising, noir',
  'fx.drum': 'Snare drumroll building tension for two seconds, then silence',
  'fx.fanfare': 'Short cozy triumphant brass fanfare, three seconds',
  'fx.sad': 'Short descending muted trombone, wry and disappointed',
  'fx.page': 'Paper dossier page turned, soft rustle',
  'fx.creak': 'A heavy wooden door creaking open slowly',
  'music.bed': 'Cozy detective jazz underscore, brushed drums, upright bass, muted trumpet, slow, nighttime, loopable, instrumental',
  'music.tension': 'Slow suspenseful noir underscore, low strings, ticking clock, loopable, instrumental',
  'music.reveal': 'Dramatic orchestral sting building to a final chord, noir mystery, 6 seconds'
};
fs.mkdirSync(path.join(D, 'out'), { recursive: true });
fs.writeFileSync(path.join(D, 'out', 'Stimmen.json'), JSON.stringify(voices, null, 2));
fs.writeFileSync(path.join(D, 'out', 'Effekte.json'), JSON.stringify(effects, null, 2));

var body = '<div id="talea-alibi" class="km-root">\n' +
  '<header class="km-head"><div><div class="km-brand">Talea · Spielprobe</div><h1>Mitternachts-Alibi</h1></div><div class="km-tag">Wer war es?<br>Einer lügt.</div></header>\n' +
  '<details class="km-audio"><summary>🎙 Stimmen &amp; Audio</summary><p>Vorgenerierte ElevenLabs-Dateien laden. Ohne passende Aufnahme hörst du eine Browser-Probestimme. Private Aussagen werden nie vorgelesen.</p>' +
  '<label>MP3 / WAV / OGG auswählen <input id="km-audio-files" type="file" accept=".mp3,.wav,.ogg" multiple></label><p id="km-audio-status" aria-live="polite">Keine Aufnahmen geladen · Browser-Probestimme</p>' +
  '<div class="km-row"><button id="km-audio-test" class="km-mini" type="button">Stimme testen</button><button id="km-audio-stop" class="km-mini" type="button">Ton stoppen</button></div>' +
  '<details><summary>Dateinamen für deine Aufnahmen</summary><div class="km-catalog" id="km-audio-catalog"></div></details></details>\n' +
  '<div class="km-stage" id="stage" aria-label="Aktueller Spielschritt"></div>\n' +
  '<details class="km-help" open><summary>Spielhilfe zum aktuellen Schritt</summary><aside id="explain"></aside></details>\n' +
  '<p class="km-foot">Testversion · Rätsel per Simulation auf Lösbarkeit geprüft, noch nicht mit echten Gruppen</p>\n' +
  '<div id="overlay" hidden></div>\n</div>\n';
var fontLink = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,600&family=Manrope:wght@400;500;600;700;800&family=Special+Elite&display=swap" rel="stylesheet">\n';
var pageCss = 'html{color-scheme:dark}body{margin:0;background:#0b0907;color:#f3ecdb}\n' + css;
var scripts = '<script>var KM_CHARS=' + JSON.stringify(chars) + ';var KM_IMAGES=' + JSON.stringify(images) + ';</script>\n<script>' + read('engine.js') + '</script>\n<script>' + read('content.js') + '</script>\n<script>' + read('ui.js') + '</script>\n';
var full = '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<title>Talea · Mitternachts-Alibi</title>\n' + fontLink + '<style>' + pageCss + '</style></head>\n<body>\n' + body + scripts + '</body></html>\n';
fs.writeFileSync(path.join(D, 'out', 'Mitternachts-Alibi.html'), full);
fs.writeFileSync(path.join(D, 'out', 'artifact.html'), '<title>Mitternachts-Alibi</title>\n' + fontLink + '<style>' + pageCss + '</style>\n' + body + scripts);
var tot = Object.keys(voices).reduce(function (s, k) { return s + voices[k].text.length; }, 0);
console.log('Mitternachts-Alibi.html', Math.round(full.length / 1024) + ' KB;', 'Stimmen:', Object.keys(voices).length, 'Einträge,', tot, 'Zeichen; Effekte:', Object.keys(effects).length);
