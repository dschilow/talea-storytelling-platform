'use strict';
/* Baut Kobold-Nacht.html (eine Datei), eine Artefakt-Fassung ohne HTML-Hülle und Stimmen.json. */
var fs = require('fs'), path = require('path');
var D = __dirname;
function read(f) { return fs.readFileSync(path.join(D, f), 'utf8'); }

/* ---- Figurentexte: Umschrift (ae/oe/ue) zu echten Umlauten ---- */
var WORDS = { 'Aermelmanschette': 'Ärmelmanschette', 'Fingerknoechel': 'Fingerknöchel', 'Fluegelschlag': 'Flügelschlag', 'Fluestertante': 'Flüstertante',
  'Geraeusch': 'Geräusch', 'Geraeusche-Fresser': 'Geräusche-Fresser', 'Glueck': 'Glück', 'Glueckszeichen': 'Glückszeichen', 'Gluehbirnen': 'Glühbirnen', 'Groesse': 'Größe',
  'Kraeuterbuendel': 'Kräuterbündel', 'Muenze': 'Münze', 'Muenzen': 'Münzen', 'Schachzuege': 'Schachzüge', 'Stueck': 'Stück', 'Trophaeen': 'Trophäen', 'Tuergriffe': 'Türgriffe',
  'Wehmueter': 'Wehmüter', 'Zauberstaebe': 'Zauberstäbe', 'fuehlt': 'fühlt', 'fuers': 'fürs', 'haelt': 'hält', 'hoeher': 'höher', 'hoerbar': 'hörbar', 'hoeren': 'hören',
  'kaemmt': 'kämmt', 'qualmts': 'qualmt’s', 'klaerts': 'klärt’s', 'laesst': 'lässt', 'muesstest': 'müsstest', 'nervoes': 'nervös', 'prueft': 'prüft', 'spaeter': 'später',
  'staendig': 'ständig', 'traegt': 'trägt', 'ueber': 'über', 'ueberall': 'überall', 'veraendert': 'verändert', 'wuerde': 'würde', 'zaehlt': 'zählt', 'gross': 'groß' };
function fixText(t) {
  t = t || '';
  t = t.replace(/[A-Za-zÄÖÜäöüß-]+/g, function (w) { return WORDS[w] || w; });
  return t.replace(/ - /g, ' – ');
}
var raw = JSON.parse(read('chars.json'));
var chars = raw.map(function (c) { return { n: fixText(c.n), s: c.s, a: c.a, p: fixText(c.p), q: fixText(c.q), g: c.g }; });
chars.forEach(function (c) { var m = (c.n + ' ' + c.p + ' ' + c.q).match(/[A-Za-zÄÖÜäöüß-]*(?:ae|oe|ue)[A-Za-zÄÖÜäöüß-]*/g) || []; m = m.filter(function (w) { return !/(aue|eue|oue|que|zuerst|Zuerst|Tuer)/.test(w); }); if (m.length) console.log('Prüfen (evtl. Umschrift):', c.n, m.join(', ')); });
var images = JSON.parse(read('images.json'));
var missing = chars.filter(function (c) { return !images[c.s]; }).map(function (c) { return c.s; });
if (missing.length) throw new Error('Bilder fehlen: ' + missing.join(', '));

/* ---- CSS auf #talea-kichernacht begrenzen ---- */
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
      else out += sel.split(',').map(function (s) { s = s.trim(); return s.indexOf('.kn-root') === 0 ? prefix + s.slice(8) : prefix + ' ' + s; }).join(',') + '{' + body + '}';
      i = j;
    }
    return out;
  }
  return block(css);
}
var css = scopeCss(read('style.css'), '#talea-kichernacht');

/* ---- Stimmen.json ---- */
var Content = require('./content.js');
var voices = {};
Object.keys(Content.TAVI).sort().forEach(function (id) {
  voices[id] = { filename: id + '.mp3', voice: 'Tavi', text: Content.TAVI[id], note: id.indexOf('call') > 0 || id === 'tavi.kobold' || id === 'tavi.kobolds' ? 'ruhig, gedämpft, wie eine Durchsage im Dunkeln' : 'warm, neugierig, leicht schelmisch (Erzähler und Moderator)' };
});
chars.forEach(function (c) {
  voices['character.' + c.s + '.quote'] = { filename: 'character.' + c.s + '.quote.mp3', voice: c.n, text: c.p, note: 'Lieblingsspruch in der Stimme der Figur' };
  if (c.a !== 'kobold') voices['character.' + c.s + '.murmur'] = { filename: 'character.' + c.s + '.murmur.mp3', voice: c.n, text: c.p, eleven: '[sleepily, mumbling] ' + c.p, note: 'Derselbe Spruch, verschlafen genuschelt, etwas leiser (Audio-Tag am Anfang)' };
});
fs.mkdirSync(path.join(D, 'out'), { recursive: true });
fs.writeFileSync(path.join(D, 'out', 'Stimmen.json'), JSON.stringify(voices, null, 2));

/* ---- HTML ---- */
var body = '<div id="talea-kichernacht" class="kn-root">\n' +
  '<header class="kn-head"><div><div class="kn-brand">Talea · Spielprobe</div><h1>Kobold-Nacht</h1></div><div class="kn-tag">Augen zu.<br>Ohren auf.</div></header>\n' +
  '<details class="kn-audio"><summary>🎙 Stimmen &amp; Audio</summary><p>Vorgenerierte ElevenLabs-Dateien laden. Ohne passende Aufnahme hörst du eine Browser-Probestimme. Geheime Karten und private Ergebnisse werden nie vorgelesen.</p>' +
  '<label>MP3 / WAV / OGG auswählen <input id="kn-audio-files" type="file" accept=".mp3,.wav,.ogg" multiple></label><p id="kn-audio-status" aria-live="polite">Keine Aufnahmen geladen · Browser-Probestimme</p>' +
  '<div class="kn-row"><button id="kn-audio-test" class="kn-mini" type="button">Stimme testen</button><button id="kn-audio-stop" class="kn-mini" type="button">Ton stoppen</button></div>' +
  '<details><summary>Dateinamen für deine Aufnahmen</summary><div class="kn-catalog" id="kn-audio-catalog"></div></details></details>\n' +
  '<div class="kn-stage" id="stage" aria-label="Aktueller Spielschritt"></div>\n' +
  '<details class="kn-help" open><summary>Spielhilfe zum aktuellen Schritt</summary><aside id="explain"></aside></details>\n' +
  '<p class="kn-foot">Testversion · Balance per Simulation geprüft, noch nicht mit echten Gruppen</p>\n' +
  '<div id="overlay" hidden></div>\n</div>\n';
var fontLink = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n';
var pageCss = 'html{color-scheme:dark}body{margin:0;background:#070a1a;color:#eef0fa}\n' + css;
var scripts = '<script>var KN_CHARS=' + JSON.stringify(chars) + ';var KN_IMAGES=' + JSON.stringify(images) + ';</script>\n<script>' + read('engine.js') + '</script>\n<script>' + read('content.js') + '</script>\n<script>' + read('ui.js') + '</script>\n';
var full = '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<title>Talea · Kobold-Nacht</title>\n' + fontLink + '<style>' + pageCss + '</style></head>\n<body>\n' + body + scripts + '</body></html>\n';
fs.writeFileSync(path.join(D, 'out', 'Kobold-Nacht.html'), full);
var frag = '<title>Kobold-Nacht</title>\n' + fontLink + '<style>' + pageCss + '</style>\n' + body + scripts;
fs.writeFileSync(path.join(D, 'out', 'artifact.html'), frag);
console.log('Kobold-Nacht.html', Math.round(full.length / 1024) + ' KB;', 'Stimmen:', Object.keys(voices).length, 'Einträge;', 'Zeichen gesamt (ohne Murmeln doppelt):', Object.keys(voices).reduce(function (s, k) { return s + (voices[k].eleven || voices[k].text).length; }, 0));
