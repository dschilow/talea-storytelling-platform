'use strict';
/* Bereinigt die Figurendaten für das Krimi-Spiel: Umlaute, Kennfarbe, Größe, Art, Geschlecht. */
var fs = require('fs'), path = require('path');
var raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'chars-raw.json'), 'utf8'));

var WORDS = { 'Aermelmanschette': 'Ärmelmanschette', 'Fingerknoechel': 'Fingerknöchel', 'Fluegelschlag': 'Flügelschlag', 'Fluestertante': 'Flüstertante',
  'Geraeusch': 'Geräusch', 'Geraeusche-Fresser': 'Geräusche-Fresser', 'Glueck': 'Glück', 'Glueckszeichen': 'Glückszeichen', 'Gluehbirnen': 'Glühbirnen', 'Groesse': 'Größe',
  'Kraeuterbuendel': 'Kräuterbündel', 'Muenze': 'Münze', 'Muenzen': 'Münzen', 'Schachzuege': 'Schachzüge', 'Stueck': 'Stück', 'Trophaeen': 'Trophäen', 'Tuergriffe': 'Türgriffe',
  'Wehmueter': 'Wehmüter', 'Zauberstaebe': 'Zauberstäbe', 'fuehlt': 'fühlt', 'fuers': 'fürs', 'haelt': 'hält', 'hoeher': 'höher', 'hoerbar': 'hörbar', 'hoeren': 'hören',
  'kaemmt': 'kämmt', 'qualmts': 'qualmt’s', 'klaerts': 'klärt’s', 'laesst': 'lässt', 'muesstest': 'müsstest', 'nervoes': 'nervös', 'prueft': 'prüft', 'spaeter': 'später',
  'staendig': 'ständig', 'traegt': 'trägt', 'ueber': 'über', 'ueberall': 'überall', 'veraendert': 'verändert', 'wuerde': 'würde', 'zaehlt': 'zählt', 'gross': 'groß',
  'Kuenstler': 'Künstler', 'Raeuber': 'Räuber', 'Haendler': 'Händler', 'Baecker': 'Bäcker', 'Koenig': 'König', 'Koenigin': 'Königin' };
function fix(t) { t = t || ''; return t.replace(/[A-Za-zÄÖÜäöüß-]+/g, function (w) { return WORDS[w] || w; }).replace(/ - /g, ' – '); }

function family(c) {
  c = (c || '').toLowerCase();
  if (/schwarz|black|obsidian|russ|anthrazit/.test(c)) return 'Schwarz';
  if (/wei(ß|ss)|white|wolken|creme|elfenbein/.test(c)) return 'Weiß';
  if (/blau|blue|nacht|marine|kobalt|ozean|tinten|petrol|koenig|türkis|tuerkis/.test(c)) return 'Blau';
  if (/gr(ü|ue)n|green|moos|wald|farn|teich|mint|oliv|salbei/.test(c)) return 'Grün';
  if (/lila|purple|violett|mauve|lavendel|magenta/.test(c)) return 'Lila';
  if (/rosa|pink/.test(c)) return 'Rosa';
  if (/rot|red|rost|himbeer|signal|bordeaux|burgund|wein|ziegel/.test(c)) return 'Rot';
  if (/orange|mandarine|lava|kupfer|koralle/.test(c)) return 'Orange';
  if (/gelb|yellow|gold|senf|sonnen|post|honig|bernstein|amber|weizen/.test(c)) return 'Gelb';
  if (/braun|brown|hasel|kastanie|herbst|rinde|erd|karamell|schlamm|leder|beige|pergament|taupe/.test(c)) return 'Braun';
  if (/grau|gr[ae]y|asch|schiefer|staub|stahl|silber|silver|stein|messing/.test(c)) return 'Grau';
  return null;
}
/* Von Hand gesetzt, wo die Daten „any“ sagen oder die Farbe nicht erkannt wird. */
var SPECIES = { 'Astra': 'Zauberwesen', 'Brumm der Steinwächter': 'Zauberwesen', 'Der Zeitweber': 'Zauberwesen', 'Die Alte Eiche': 'Zauberwesen', 'Die Nebelfee': 'Zauberwesen', 'Funkelflug': 'Zauberwesen',
  'Morpheus': 'Zauberwesen', 'Silberfunke': 'Zauberwesen', 'Luna': 'Tier', 'Pip': 'Tier', 'Silberhorn der Hirsch': 'Tier', 'Bäcker Braun': 'Mensch', 'Die Nebelhexe': 'Mensch', 'Frau Müller': 'Mensch',
  'Frau Wellenreiter': 'Mensch', 'Graf Griesgram': 'Mensch', 'Herr Seitenflug': 'Mensch', 'Professor Lichtweis': 'Mensch' };
var GENDER = { 'Astra': 'weiblich', 'Brumm der Steinwächter': 'männlich', 'Der Zeitweber': 'männlich', 'Die Alte Eiche': 'weiblich', 'Die Nebelfee': 'weiblich', 'Funkelflug': 'männlich', 'Morpheus': 'männlich',
  'Silberfunke': 'neutral', 'Luna': 'weiblich', 'Pip': 'neutral', 'Silberhorn der Hirsch': 'männlich', 'Bäcker Braun': 'männlich', 'Die Nebelhexe': 'weiblich', 'Frau Müller': 'weiblich', 'Frau Wellenreiter': 'weiblich',
  'Graf Griesgram': 'männlich', 'Herr Seitenflug': 'männlich', 'Professor Lichtweis': 'männlich' };
var SP_MAP = { human: 'Mensch', humanoid: 'Zauberwesen', animal: 'Tier', magical_creature: 'Zauberwesen', mythical: 'Zauberwesen', elemental: 'Zauberwesen' };
var G_MAP = { male: 'männlich', female: 'weiblich', neutral: 'neutral' };
var SIZE_MAP = { tiny: 'klein', small: 'klein', medium: 'mittel', large: 'groß' };
var COLOR_FIX = { 'Funkelflug': 'Orange', 'Wolke Wuschel': 'Weiß', 'Der Mutlosmacher': 'Grün' };

var out = raw.map(function (c) {
  var f = COLOR_FIX[c.n] || family(c.color) || family(c.color2);
  return { n: fix(c.n), s: c.s, p: fix(c.p), q: fix(c.q), fam: f, szc: SIZE_MAP[c.size] || 'mittel', spc: SPECIES[c.n] || SP_MAP[c.sp] || 'Mensch', gdr: GENDER[c.n] || G_MAP[c.g] || 'neutral',
    role: c.role, arch: c.arch, age: c.age, style: c.style, pers: c.pers, ctx: fix(c.ctx), back: fix(c.back), tags: c.tags };
});
fs.writeFileSync(path.join(__dirname, 'chars-ma.json'), JSON.stringify(out));
function cnt(k) { var m = {}; out.forEach(function (o) { m[o[k]] = (m[o[k]] || 0) + 1; }); return JSON.stringify(m); }
console.log(out.length, 'Figuren');
console.log('Kennfarbe', cnt('fam')); console.log('Größe', cnt('szc')); console.log('Art', cnt('spc')); console.log('Geschlecht', cnt('gdr'));
console.log('Farbe nicht erkannt:', out.filter(function (o) { return !o.fam; }).map(function (o) { return o.n; }));
