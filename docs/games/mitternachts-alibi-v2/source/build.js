'use strict';
/* Baut Mitternachts-Alibi.html (eine Datei), eine Artefakt-Fassung ohne HTML-Hülle, Stimmen.json und Effekte.json. */
var fs = require('fs'), path = require('path');
var D = __dirname;
function read(f) { return fs.readFileSync(path.join(D, f), 'utf8'); }

var base = JSON.parse(read('chars-ma.json'));
var T = {}; [1, 2, 3, 4, 5, 6].forEach(function (i) { Object.assign(T, require('./text/b' + i + '.js')); });
var chars = base.map(function (c) {
  var t = T[c.s]; if (!t) throw new Error('Text fehlt: ' + c.s);
  return { n: c.n, s: c.s, p: c.p, q: c.q, fam: c.fam, szc: c.szc, spc: c.spc, gdr: c.gdr, story: t.story, intro: t.intro, stmt: t.stmt, deny: t.deny, confess: t.confess, smug: t.smug, voice: t.voice };
});
var imgFile = [path.join(D, 'images.json'), path.join(D, '..', 'kn4', 'images.json')].filter(function (f) { return fs.existsSync(f); })[0];
if (!imgFile) throw new Error('images.json fehlt (89 Figurenbilder als base64-webp, Schlüssel = Figuren-Slug)');
fs.mkdirSync(path.join(D, 'out'), { recursive: true });
var images = JSON.parse(fs.readFileSync(imgFile, 'utf8'));
var missing = chars.filter(function (c) { return !images[c.s]; }).map(function (c) { return c.s; });
if (missing.length) throw new Error('Bilder fehlen: ' + missing.join(', '));
/* Die Bilder gehören nur für die Figuren des Pools ins Spiel */
var imgUsed = {}; chars.forEach(function (c) { imgUsed[c.s] = images[c.s]; });

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

/* Stimmen.json: alles, was das Spiel spricht, kommt aus Content.clips() */
var Content = require('./content.js');
var clips = Content.clips(chars);
var voices = {};
Object.keys(clips).sort().forEach(function (id) {
  var c = clips[id], v = { filename: id + '.mp3', voice: c.voice, kind: c.kind, prio: c.prio, text: c.text, eleven: c.tag + ' ' + c.text };
  if (c.whisper) v.whisper = true;
  if (c.voiceDesign) v.voiceDesign = c.voiceDesign;
  v.note = c.note || (c.whisper ? 'Kommissar Tavi, geflüstert, nah am Mikrofon. Wird im Geheimtelefon leise abgespielt.' : c.kind === 'zahl' || c.kind === 'name' || c.kind === 'ort' || c.kind === 'akt' ? 'Kommissar Tavi, klar und gleichmäßig. Kurzer Baustein, wird mit anderen Clips zu einem Satz zusammengesetzt.' : 'Erzähler. Ruhige, warme Männerstimme wie im Hörspiel, trockener Humor, keine Albernheit.');
  if (c.sfx) v.sfx = c.sfx;
  voices[id] = v;
});
var effects = {
  'fx.stamp': 'Dull wooden rubber stamp slamming on paper, close, one hit',
  'fx.type': 'A single mechanical typewriter key strike, dry, close',
  'fx.gavel': 'A wooden judge gavel hitting a block, short',
  'fx.chime': 'Soft brass desk bell, one ring, warm room',
  'fx.tick': 'A single dry clock tick, quiet room',
  'fx.knock': 'A single heavy knock on a wooden door',
  'fx.sting': 'Short suspense string sting, three low notes rising, noir',
  'fx.drum': 'Snare drumroll building tension for two seconds, then silence',
  'fx.fanfare': 'Short cozy triumphant brass fanfare, three seconds',
  'fx.sad': 'Short descending muted trombone, wry and disappointed',
  'fx.cheer': 'A small happy crowd cheering and clapping, two seconds',
  'fx.boo': 'A comical long trombone wah-wah, one note sliding down',
  'fx.page': 'Paper dossier page turned, soft rustle',
  'fx.creak': 'A heavy wooden door creaking open slowly',
  'fx.ring': 'An old rotary telephone ringing twice, muffled as if far away',
  'fx.whoosh': 'A short soft whoosh, like a paper card flying onto a table',
  'fx.bell': 'A single deep church bell strike with a long warm decay (used twelve times for midnight)',
  'fx.rooster': 'A rooster crowing once at dawn, distant',
  'amb.evening': 'Quiet village evening ambience, crickets, a distant tavern laughing, loopable, 30 seconds',
  'amb.midnight': 'Quiet village at night, soft wind, a far owl, a creaking sign, loopable, 30 seconds',
  'amb.dawn': 'Village at dawn, birds waking up, a distant rooster, loopable, 30 seconds',
  'music.bed': 'Cozy detective jazz underscore, brushed drums, upright bass, muted trumpet, slow, nighttime, loopable, instrumental',
  'music.tension': 'Slow suspenseful noir underscore, low strings, ticking clock, loopable, instrumental',
  'music.reveal': 'Dramatic orchestral sting building to a final chord, noir mystery, 6 seconds'
};
Object.keys(Content.SIGHTS).forEach(function (pid) { Content.SIGHTS[pid].forEach(function (s) { effects['fx.sight.' + s.id] = s.sfx + ' (about two seconds, no voice)'; }); });
fs.writeFileSync(path.join(D, 'out', 'Stimmen.json'), JSON.stringify(voices, null, 2));
fs.writeFileSync(path.join(D, 'out', 'Effekte.json'), JSON.stringify(effects, null, 2));

var body = '<div id="talea-alibi" class="km-root">\n' +
  '<header class="km-head"><div><div class="km-brand">Talea · Spielprobe</div><h1>Mitternachts-Alibi</h1></div><div class="km-tag">Wer war es?<br>Einer flunkert.</div></header>\n' +
  '<details class="km-audio"><summary>🎙 Stimmen &amp; Audio</summary><p>Vorgenerierte ElevenLabs-Dateien laden. Ohne passende Aufnahme hörst du eine Browser-Probestimme. Das Geheimtelefon spielt leise.</p>' +
  '<div class="km-priv-row"><label for="km-audio-priv">Flüster-Lautstärke: <b id="km-audio-privv">40 %</b></label><input id="km-audio-priv" type="range" min="10" max="100" value="40"></div>' +
  '<div class="km-row"><button id="km-audio-privtest" class="km-mini" type="button">🤫 Flüstern testen</button><button id="km-audio-test" class="km-mini" type="button">Stimme testen</button><button id="km-audio-stop" class="km-mini" type="button">Ton stoppen</button></div>' +
  '<label>MP3 / WAV / OGG auswählen <input id="km-audio-files" type="file" accept=".mp3,.wav,.ogg" multiple></label><p id="km-audio-status" aria-live="polite">Keine Aufnahmen geladen · Browser-Probestimme</p>' +
  '<details><summary>Dateinamen für deine Aufnahmen</summary><div class="km-catalog" id="km-audio-catalog"></div></details></details>\n' +
  '<div class="km-stage" id="stage" aria-label="Aktueller Spielschritt"></div>\n' +
  '<details class="km-help"><summary>Für Große: Was passiert hier?</summary><aside id="explain"></aside></details>\n' +
  '<p class="km-foot">Testversion v2 · Rätsel per Simulation auf Lösbarkeit geprüft, noch nicht mit echten Gruppen</p>\n' +
  '<div id="overlay" hidden></div>\n</div>\n';
var fontLink = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,600&family=Manrope:wght@400;500;600;700;800&family=Special+Elite&display=swap" rel="stylesheet">\n';
var pageCss = 'html{color-scheme:dark}body{margin:0;background:#0b0907;color:#f3ecdb}\n' + css;
var scripts = '<script>var KM_CHARS=' + JSON.stringify(chars) + ';var KM_IMAGES=' + JSON.stringify(imgUsed) + ';</script>\n<script>' + read('engine.js') + '</script>\n<script>' + read('content.js') + '</script>\n<script>' + read('ui.js') + '</script>\n';
var full = '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<title>Talea · Mitternachts-Alibi</title>\n' + fontLink + '<style>' + pageCss + '</style></head>\n<body>\n' + body + scripts + '</body></html>\n';
fs.writeFileSync(path.join(D, 'out', 'Mitternachts-Alibi.html'), full);
fs.writeFileSync(path.join(D, 'out', 'artifact.html'), '<title>Mitternachts-Alibi</title>\n' + fontLink + '<style>' + pageCss + '</style>\n' + body + scripts);
var tot = Object.keys(voices).reduce(function (s, k) { return s + voices[k].text.length; }, 0), byPrio = {};
Object.keys(voices).forEach(function (k) { var p = voices[k].prio; byPrio[p] = (byPrio[p] || 0) + voices[k].text.length; });
console.log('Mitternachts-Alibi.html', Math.round(full.length / 1024) + ' KB;', 'Stimmen:', Object.keys(voices).length, 'Einträge,', tot, 'Zeichen (Prio', JSON.stringify(byPrio) + '); Effekte:', Object.keys(effects).length);
