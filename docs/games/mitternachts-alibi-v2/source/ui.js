/* Mitternachts-Alibi v2: Oberfläche. Alles ist Bild plus Stimme. Privates kommt als Flüstern ans Ohr (Geheimtelefon),
 * Öffentliches spricht Kommissar Tavi laut. Nutzt KMEngine (Rätsel), KMContent (Texte, Sprechliste), KM_CHARS und KM_IMAGES (vom Build eingefügt). */
(function () {
  'use strict';
  var E = KMEngine, C = KMContent, TC = E.TC;
  var ROOT = document.getElementById('talea-alibi');
  var STAGE = ROOT.querySelector('#stage'), HELP = ROOT.querySelector('#explain'), OVER = ROOT.querySelector('#overlay');
  var CHARS = KM_CHARS, IMG = KM_IMAGES, FAST = false;
  var COLORS = { Blau: '#4a78d8', Braun: '#8a6240', Gelb: '#e2b93b', Weiß: '#f2efe6', Rot: '#d24b45', Grau: '#9aa1a8', Grün: '#4f9b60', Lila: '#8d62c9', Schwarz: '#2a2a30', Rosa: '#eb8fb4', Orange: '#ee8a3c' };
  var CLIPS = C.clips(CHARS);
  var privVol = 0.4, GAP = 140;

  /* ---------- Hilfen ---------- */
  function $(id) { return ROOT.querySelector('#' + id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, FAST ? 0 : ms); }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function img(c) { return IMG[c.s] || ('data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#3a2f26"/><text x="50" y="64" font-size="46" text-anchor="middle">🕵️</text></svg>')); }
  function list(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1]; }
  function P(i) { return S.W.players[i]; }
  function place(id) { return C.PLACES[id]; }
  function ids() { return S.W.players.map(function (p) { return p.id; }); }
  function typed(i) { return !/^Nr\. \d+$/.test(P(i).name); }
  function who(i) { return esc(P(i).ch.n) + (typed(i) ? ' · ' + esc(P(i).name) : ''); }
  /* Zahlenliste für die Sprache: Nummer eins, Nummer zwei, und Nummer drei. (Komma-Varianten klingen natürlicher) */
  function numList(list, whisper) {
    var parts = [], pre = whisper ? 'w.' : '', and = whisper ? 'w.and' : 'kom.and';
    list.forEach(function (x, k) { var last = k === list.length - 1; if (last && list.length > 1) parts.push(and); parts.push({ hl: x }, pre + (last ? 'num.' : 'numc.') + (x + 1)); });
    return parts;
  }
  function rotate(a, k) { return a.slice(k).concat(a.slice(0, k)); }
  function pickVar(prefix) { return pick(C.variants(prefix)); }
  function L() { return E.LEVELS[S.W ? S.W.level : setup.level]; }
  function T() { return S.W ? S.W.T : L().acts; }

  /* ---------- Ton ---------- */
  var AC = null, soundOn = true;
  function actx() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) { } } return AC; }
  function tone(f, when, dur, type, vol, to) { var a = actx(); if (!a) return; var t = a.currentTime + when, o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05); }
  function noise(when, dur, vol, cut) { var a = actx(); if (!a) return; var b = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); var s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut || 1200; s.buffer = b; g.gain.value = vol || 0.1; s.connect(f); f.connect(g); g.connect(a.destination); s.start(a.currentTime + when); }
  var SFX = {
    stamp: function () { noise(0, .14, .18, 500); tone(95, 0, .22, 'sine', .16, 55); },
    type: function () { noise(0, .04, .06, 3000); tone(1800, 0, .03, 'square', .02); },
    gavel: function () { tone(160, 0, .1, 'square', .1, 90); noise(0, .1, .12, 800); },
    chime: function () { tone(880, 0, .3, 'sine', .06); tone(1320, .12, .35, 'sine', .05); },
    tick: function () { tone(1400, 0, .04, 'square', .03); },
    knock: function () { tone(110, 0, .12, 'sine', .14, 60); },
    sting: function () { [196, 233, 277].forEach(function (f, i) { tone(f, i * .09, .5, 'sawtooth', .04); }); },
    drum: function () { noise(0, 1.3, .13, 700); tone(70, 0, .8, 'sine', .12, 50); },
    fanfare: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * .12, .34, 'triangle', .07); }); },
    sad: function () { [392, 370, 349, 294].forEach(function (f, i) { tone(f, i * .28, .4, 'sawtooth', .045); }); },
    pop: function () { tone(520, 0, .09, 'triangle', .06, 260); },
    creak: function () { tone(200, 0, .5, 'sawtooth', .04, 70); },
    page: function () { noise(0, .22, .05, 2600); },
    bell: function () { [196, 392, 588, 784].forEach(function (f, k) { tone(f, 0, 1.5 - k * .22, 'sine', .09 / (k + 1)); }); },
    ring: function () { for (var k = 0; k < 3; k++) { tone(880, k * .3, .1, 'square', .03); tone(660, k * .3 + .12, .1, 'square', .03); } },
    whoosh: function () { noise(0, .3, .07, 2600); },
    cheer: function () { noise(0, .9, .08, 3600); [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * .1, .3, 'triangle', .05); }); },
    boo: function () { tone(160, 0, .7, 'sawtooth', .05, 100); }
  };
  function fxPlay(id, vol, loop) { if (!recorded[id]) return null; try { var a = new Audio(recorded[id]); a.volume = vol; a.loop = !!loop; var pr = a.play(); if (pr && pr.catch) pr.catch(function () { }); return a; } catch (e) { return null; } }
  var ambAudio = null;
  function stopAmb() { if (ambAudio) { try { ambAudio.pause(); } catch (e) { } ambAudio = null; } }
  function setAmb(id) { stopAmb(); if (soundOn && !FAST && recorded[id]) ambAudio = fxPlay(id, .18, true); }
  function sfx(n) { if (soundOn && !FAST) { if (recorded['fx.' + n]) { fxPlay('fx.' + n, 1); return; } try { SFX[n](); } catch (e) { } } }
  function vib(p) { try { if (soundOn && !FAST && navigator.vibrate) navigator.vibrate(p); } catch (e) { } }

  /* ---------- Stimmen ---------- */
  var recorded = {}, activeAudio = null, seq = 0, LOG = [];
  function stopVoice() { seq++; setHL(null); if (activeAudio) { try { activeAudio.pause(); } catch (e) { } activeAudio = null; } if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) { } } }
  function voices() { try { return window.speechSynthesis.getVoices().filter(function (v) { return /^de/i.test(v.lang); }); } catch (e) { return []; } }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function estimate(t) { return Math.min(6500, 500 + (t || '').length * 42); }
  function setHL(x) { S.hl = (x === null || x === undefined) ? null : [].concat(x); applyHL(); }
  function applyHL() {
    var old = STAGE.querySelectorAll('.hl'); for (var i = 0; i < old.length; i++) old[i].classList.remove('hl');
    if (S.hl) S.hl.forEach(function (id) { var els = STAGE.querySelectorAll('[data-hl="' + id + '"]'); for (var k = 0; k < els.length; k++) els[k].classList.add('hl'); });
  }
  function subState() { return S.phase === 'act' ? S.actSub : S.phase === 'round' ? S.roundSub : S.phase === 'vote' ? S.voteSub : S.phase === 'reveal' ? S.revealSub : S.phase === 'cast' ? S.castSub : ''; }
  /* parts: Text-IDs, {id}, {c: Figur, k: Zeilenart}, {sfx}, {hl: Nummern}, {pause}, {fn}. opt.priv = Flüsterlautstärke (Geheimtelefon). */
  function say(parts, opt) {
    opt = opt || {}; stopVoice(); var my = seq, i = 0, vol = opt.priv ? privVol : 1;
    parts = (Array.isArray(parts) ? parts : [parts]).filter(function (p) { return p !== null && p !== undefined && p !== false; }).map(function (p) { return typeof p === 'string' ? { id: p } : p; });
    LOG.push({ fx: parts.filter(function (p) { return p.fx; }).map(function (p) { return p.fx; }), ids: parts.filter(function (p) { return p.id || p.c; }).map(function (p) { return p.c ? 'character.' + p.c.s + '.' + p.k : p.id; }), priv: !!opt.priv, phase: S.phase, sub: subState() });
    return new Promise(function (resolve) {
      function next() {
        if (my !== seq) return resolve(false);
        if (i >= parts.length) { setHL(null); return resolve(true); }
        var p = parts[i++];
        if (p.fn) { try { p.fn(); } catch (e) { } return next(); }
        if (p.hl !== undefined) { setHL(p.hl); return next(); }
        if (p.sfx) { sfx(p.sfx); return FAST ? next() : setTimeout(next, p.wait || 170); }
        if (p.pause) return FAST ? next() : setTimeout(next, p.pause);
        if (p.fx) { if (!FAST && soundOn) fxPlay(p.fx, vol); return FAST ? next() : setTimeout(next, recorded[p.fx] ? 1500 : 0); }
        var id = p.c ? 'character.' + p.c.s + '.' + p.k : p.id, clip = CLIPS[id], text = clip ? clip.text : '';
        if (FAST) return next();
        if (!soundOn || !text) return setTimeout(next, estimate(text));
        var finished = false;
        function done() { if (finished) return; finished = true; setTimeout(next, GAP); }
        function fallback() {
          if (my !== seq) return resolve(false);
          if (!('speechSynthesis' in window)) return setTimeout(done, estimate(text));
          try {
            var u = new SpeechSynthesisUtterance(text), vs = voices(), ch = p.c; u.lang = 'de-DE'; u.volume = vol; if (vs.length) u.voice = vs[ch ? hash(ch.n) % vs.length : 0];
            if (ch) { var base = ch.gdr === 'weiblich' ? 1.25 : ch.gdr === 'männlich' ? .8 : 1.05; u.pitch = Math.max(.2, Math.min(2, base + ((hash(ch.n) % 30) - 15) / 100)); u.rate = .95; } else { u.pitch = .85; u.rate = opt.priv ? .88 : .95; }
            u.onend = done; u.onerror = done; window.speechSynthesis.speak(u); setTimeout(done, estimate(text) + 5000);
          } catch (e) { setTimeout(done, estimate(text)); }
        }
        if (id && recorded[id]) {
          try { activeAudio = new Audio(recorded[id]); activeAudio.volume = vol; activeAudio.onended = done; activeAudio.onerror = fallback; var pr = activeAudio.play(); if (pr && pr.catch) pr.catch(function () { setStatus('Aufnahme konnte nicht abgespielt werden · Browser-Probestimme'); fallback(); }); } catch (e) { fallback(); }
        } else fallback();
      }
      next();
    });
  }
  function setStatus(t) { var s = $('km-audio-status'); if (s) s.textContent = t; }
  $('km-audio-files').addEventListener('change', async function (e) {
    stopVoice(); var loaded = 0, ignored = 0;
    for (var file of Array.from(e.target.files)) {
      var id = file.name.replace(/\.(mp3|wav|ogg)$/i, '');
      if ((!CLIPS[id] && !/^(fx|amb|music)./.test(id)) || file.size > 12 * 1024 * 1024) { ignored++; continue; }
      try { recorded[id] = await new Promise(function (resolve, reject) { var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.onerror = reject; r.readAsDataURL(file); }); loaded++; } catch (err) { ignored++; }
    }
    setStatus(Object.keys(recorded).length + ' von ' + Object.keys(CLIPS).length + ' Aufnahmen geladen' + (ignored ? ' · ' + ignored + ' Dateien übersprungen' : '') + '. Fehlende Einsätze: Browser-Probestimme.');
  });
  $('km-audio-test').addEventListener('click', function () { soundOn = true; actx(); say(['kom.welcome']); });
  $('km-audio-stop').addEventListener('click', stopVoice);
  $('km-audio-priv').addEventListener('input', function (e) { privVol = Math.max(.1, Math.min(1, +e.target.value / 100)); var o = $('km-audio-privv'); if (o) o.textContent = Math.round(privVol * 100) + ' %'; });
  $('km-audio-privtest').addEventListener('click', function () { soundOn = true; actx(); say(['w.place.garten', 'w.alone'], { priv: true }); });
  $('km-audio-catalog').innerHTML = Object.keys(CLIPS).filter(function (id) { return !/^character\./.test(id) || /\.intro$/.test(id); }).map(function (id) { return '<div class="km-clip"><code>' + id + '.mp3</code><p>' + esc(CLIPS[id].text) + '</p></div>'; }).join('');

  /* ---------- Zustand ---------- */
  var setup = { count: 5, level: 'mini', caseId: 'zufall', names: ['', '', '', '', '', '', '', ''] };
  (function () { var s = store('alibi2-setup'); if (s) { try { var o = JSON.parse(s); if (o.count >= 4 && o.count <= 8) setup.count = o.count; if (E.LEVELS[o.level]) setup.level = o.level; if (o.caseId) setup.caseId = o.caseId; if (Array.isArray(o.names)) setup.names = o.names.slice(0, 8).concat(['', '', '', '', '', '', '', '']).slice(0, 8); } catch (e) { } } })();
  var S = { W: null, phase: 'setup', overlay: null, tourIdx: 1 };
  var timer = null, introToken = 0;
  function resetFlow() {
    S.caseDef = null; S.claims = []; S.sights = {}; S.castIdx = 0; S.castSub = 'draw'; S.act = 0; S.actSub = 'intro'; S.actOrder = []; S.actIdx = 0; S.draft = { place: null, comp: [] }; S.hidden = false; S.lieTold = false; S.newRes = null; S.bell = 0;
    S.round = 1; S.spuren = []; S.spurShown = 0; S.roundSub = 'talk'; S.talkLeft = 0; S.talkRun = false; S.prompt = 0; S.duel = null; S.duelLog = []; S.duelSeen = {}; S.flags = null; S.tab = TC;
    S.voteSub = 'ready'; S.count = 0; S.sel = []; S.accused = null; S.cleared = []; S.attempt = 1; S.revealSub = 'ask'; S.awards = null; S.finalCaught = null; S.hl = null;
  }
  resetFlow();
  function recordedClaims() { return S.claims.filter(function (c) { return c && c.length === S.W.T; }).length; }

  /* ---------- Bausteine ---------- */
  function bar(label) {
    return '<div class="km-bar"><span class="km-phase">' + esc(label) + '</span><div class="km-tools"><button class="km-ico" data-a="help" aria-label="Tavi erklärt diesen Schritt">❓</button><button class="km-ico" data-a="sound" aria-pressed="' + soundOn + '" aria-label="Ton ' + (soundOn ? 'ausschalten' : 'einschalten') + '">' + (soundOn ? '🔊' : '🔇') + '</button>' +
      '<button class="km-ico" data-a="rules" aria-label="Regeln und neues Spiel">📖</button>' + (S.W ? '<button class="km-ico" data-a="cast" aria-label="Besetzung ansehen">🎭</button>' : '') + '</div></div>';
  }
  function ring(ch) { return COLORS[ch.fam] || '#999'; }
  /* Gesicht mit Nummer und farbigem Rand (Kennfarbe) */
  function face(i, sz, o) {
    o = o || {}; var ch = P(i).ch;
    return '<span class="km-fc s' + sz + (o.dim ? ' dim' : '') + '" style="--ring:' + ring(ch) + '" data-hl="' + i + '"><img src="' + img(ch) + '" alt="Nummer ' + (i + 1) + ', ' + esc(ch.n) + '"><b class="no">' + (i + 1) + '</b></span>';
  }
  function bars(szc) { var n = { klein: 1, mittel: 2, 'groß': 3 }[szc] || 2; return '<span class="km-bars" title="' + esc(szc) + '">' + [1, 2, 3].map(function (k) { return '<i class="' + (k <= n ? 'on' : '') + '" style="height:' + (5 + k * 5) + 'px"></i>'; }).join('') + '</span>'; }
  function traits(ch, g) { return '<span class="km-tr"><span class="km-sw" style="background:' + ring(ch) + '" title="' + esc(ch.fam) + '"></span>' + bars(ch.szc) + '<span class="ti" title="' + esc(ch.spc) + '">' + C.SPC_ICON[ch.spc] + '</span>' + (g ? '<span class="ti" title="' + esc(ch.gdr) + '">' + C.GDR_ICON[ch.gdr] + '</span>' : '') + '</span>'; }
  function showG() { return L().keys.indexOf('gdr') >= 0; }
  function pcard(id, o) {
    o = o || {}; var pl = place(id), sg = o.sight;
    return '<span class="km-pc' + (o.big ? ' big' : '') + (o.crime ? ' crime' : '') + '" style="--pc:' + pl.color + '"><b>' + pl.icon + '</b><small>' + esc(pl.short) + '</small>' + (sg ? '<em class="sg">' + sg.icon + '</em>' : '') + '</span>';
  }
  function pol(i, o) {
    o = o || {}; var p = P(i), cls = 'km-pol' + (o.sel ? ' sel' : '') + (o.dim ? ' dim' : '') + (o.cleared ? ' cleared' : '');
    var tag = o.click ? 'button type="button" data-pid="' + i + '"' + (o.dis ? ' disabled' : '') + (o.sel ? ' aria-pressed="true"' : '') : 'div';
    return '<' + tag + ' class="' + cls + '" style="--ring:' + ring(p.ch) + '" aria-label="Nummer ' + (i + 1) + ', ' + esc(p.ch.n) + '">' + (o.cleared ? '<span class="km-stamp mini">unschuldig</span>' : '') + '<span class="im"><img src="' + img(p.ch) + '" alt=""><b class="no">' + (i + 1) + '</b></span><span class="cap">' + esc(p.ch.n) + '</span>' + (typed(i) ? '<span class="who">' + esc(p.name) + '</span>' : '') + '</' + (o.click ? 'button' : 'div') + '>';
  }
  function pgrid(a, f) { return '<div class="km-grid">' + a.map(function (i) { return pol(i, f(i)); }).join('') + '</div>'; }
  function wall() { return '<div class="km-wall">' + ids().map(function (i) { var ch = P(i).ch; return '<div class="km-wc">' + face(i, 72) + '<b>' + esc(ch.n) + '</b>' + (typed(i) ? '<small>' + esc(P(i).name) + '</small>' : '') + traits(ch, showG()) + '</div>'; }).join('') + '</div>'; }
  function explain(title, html) { HELP.innerHTML = '<div class="eb">Für Große</div><h4>' + esc(title) + '</h4>' + html; }
  function say_(t) { return '<div class="km-onair"><i></i> ' + t + '</div>'; }
  function cta(a, icon, text, o) { o = o || {}; return '<button class="km-btn' + (o.ghost ? ' ghost' : ' big') + '" data-a="' + a + '"' + (o.dis ? ' disabled' : '') + (o.v !== undefined ? ' data-v="' + o.v + '"' : '') + '><span class="ic">' + icon + '</span> ' + text + '</button>'; }

  /* ---------- Dorfkarte (öffentlich): wer war wann wo ---------- */
  function matchesSpuren(i) { return S.spuren.slice(0, S.spurShown).every(function (sp) { return E.matches(P(i).ch, sp); }); }
  function village(o) {
    var W = S.W, t = o.t, truth = !!o.truth, byPlace = {}, flags = (!truth && S.flags && t === TC) ? S.flags : null, bad = {}, alone = {};
    W.places.forEach(function (p) { byPlace[p] = []; });
    W.players.forEach(function (p) { var c = truth ? { place: W.pos[p.id][t], comp: W.comp[p.id][t] } : (S.claims[p.id] || [])[t]; if (c) byPlace[c.place].push({ i: p.id, c: c }); });
    if (flags) { flags.conf.forEach(function (c) { bad[c.a] = 1; bad[c.b] = 1; }); flags.alone.forEach(function (i) { alone[i] = 1; }); }
    var h = '<div class="km-vmap">';
    if (o.tabs) h += '<div class="km-vtabs" role="tablist">' + E.range(W.T).map(function (k) { var s = C.SLOTS[k]; return '<button role="tab" class="' + (k === t ? 'on' : '') + '" data-a="tab" data-v="' + k + '" aria-selected="' + (k === t) + '">' + s.icon + '<small>' + s.name + '</small></button>'; }).join('') + '</div>';
    h += '<div class="km-vgrid">';
    W.places.forEach(function (pid) {
      var pl = place(pid), crime = (pid === W.crimePlace && t === TC), sg = truth ? C.SIGHTS[pid][S.sights[t][pid]] : null;
      h += '<div class="km-vplace' + (crime ? ' crime' : '') + '" style="--pc:' + pl.color + '"><div class="vph"><b>' + pl.icon + '</b><small>' + esc(pl.short) + '</small>' + (crime ? '<em class="loot">' + S.caseDef.lootIcon + '</em>' : '') + (sg ? '<em class="sg">' + sg.icon + '</em>' : '') + '</div><div class="vpb">';
      byPlace[pid].forEach(function (r) {
        var i = r.i, dim = !truth && !matchesSpuren(i), cl = S.cleared.indexOf(i) >= 0;
        var chips = truth ? '' : (r.c.comp.length ? r.c.comp.map(function (x) { return face(x, 20); }).join('') : '<span class="solo" title="allein">🧍</span>');
        h += '<' + (truth ? 'div' : 'button type="button" data-res="' + i + '" data-t="' + t + '"') + ' class="km-res' + (dim ? ' dim' : '') + (bad[i] ? ' bad' : '') + (alone[i] ? ' alone' : '') + (S.newRes === i && o.isNew ? ' new' : '') + (cl ? ' cleared' : '') + '">' + face(i, 36, { dim: dim }) + (truth ? '' : '<span class="rc">' + chips + '</span>') + (bad[i] ? '<i class="flag" title="Einspruch">⚡</i>' : alone[i] ? '<i class="flag" title="ohne Zeugen">👻</i>' : '') + '</' + (truth ? 'div' : 'button') + '>';
      });
      if (!byPlace[pid].length) h += '<span class="empty">·</span>';
      h += '</div></div>';
    });
    h += '</div>';
    if (flags && (flags.conf.length || flags.alone.length)) h += '<div class="km-legend">' + (flags.conf.length ? '<span>⚡ Einspruch</span>' : '') + (flags.alone.length ? '<span>👻 keiner hat sie gesehen</span>' : '') + '</div>';
    return h + '</div>';
  }

  /* ---------- Darstellung ---------- */
  function render() {
    if (S.press) { S.deferred = true; return; }
    STAGE.className = 'km-stage' + (S.phase === 'end' ? ' km-end' : '') + (S.phase === 'act' && S.actSub === 'whisper' ? ' km-priv' : '');
    if (!S.W) renderSetup();
    else ({ cast: renderCast, caseIntro: renderCaseIntro, act: renderAct, round: renderRound, vote: renderVote, reveal: renderReveal, end: renderEnd })[S.phase]();
    renderOverlay(); applyHL();
  }

  function renderSetup() {
    var N = setup.count, lv = E.LEVELS[setup.level], seen = store('alibi2-seen');
    var opts = '<option value="zufall"' + (setup.caseId === 'zufall' ? ' selected' : '') + '>Zufälliger Fall</option>' + C.CASES.map(function (c) { return '<option value="' + c.id + '"' + (setup.caseId === c.id ? ' selected' : '') + '>' + esc(c.title) + '</option>'; }).join('');
    STAGE.innerHTML = bar('Vorbereitung') +
      '<div class="km-center"><h2 class="km-title">Wer spielt mit?</h2><div class="km-nums" role="radiogroup" aria-label="Anzahl der Spieler">' + [4, 5, 6, 7, 8].map(function (n) { return '<button role="radio" class="km-num' + (n === N ? ' on' : '') + '" data-count="' + n + '" aria-checked="' + (n === N) + '">' + n + '</button>'; }).join('') + '</div>' +
      '<div class="km-heads" aria-hidden="true">' + ['🧒', '👧', '👨', '👩', '🧓', '👴', '👵', '🧑'].slice(0, N).join('') + '</div></div>' +
      '<div class="km-center"><span class="km-lbl">Welche Stufe?</span><div class="km-seg" role="radiogroup" aria-label="Stufe">' + Object.keys(E.LEVELS).map(function (k) { var li = C.LEVEL_INFO[k]; return '<button role="radio" data-level="' + k + '" aria-checked="' + (k === setup.level) + '"><span class="lic">' + li.icon + '</span><span class="ln">' + esc(li.n) + '</span><span class="age">' + esc(li.age) + '</span><small>' + esc(li.d) + '</small></button>'; }).join('') + '</div></div>' +
      '<div class="km-phonehint" aria-hidden="true"><span>📞</span><span>👂</span><span>🤫</span></div><p class="km-sub">Geheimes flüstert Tavi ins Ohr. Handy ans Ohr halten oder Kopfhörer benutzen.</p>' +
      '<div class="km-row">' + cta('begin', '🎭', 'Los geht’s') + '</div>' +
      '<div class="km-row">' + cta('tour', '🎬', 'Kurz erklärt, mit Stimme', { ghost: true }) + '</div>' +
      '<div class="km-center"><details class="km-short"><summary>Mehr Einstellungen (für Große)</summary><label class="km-lbl" for="caseSel">Der Fall</label><select id="caseSel" class="km-select">' + opts + '</select>' +
      '<span class="km-lbl" style="margin-top:12px;display:block">Namen (freiwillig, nur für die Anzeige)</span><div class="km-names">' + E.range(N).map(function (i) { return '<div class="km-nrow"><input id="nm' + i + '" value="' + esc(setup.names[i] || '') + '" aria-label="Name von Spieler ' + (i + 1) + '" maxlength="14" placeholder="Nr. ' + (i + 1) + '" autocomplete="off"></div>'; }).join('') + '</div></details></div>';
    explain('Vorbereitung', '<p>Wählt die Zahl der Spieler und die Stufe. Für die erste Runde empfiehlt sich die Stufe Mini-Detektive, auch für Erwachsene. Es muss niemand lesen können: Alles wird von Kommissar Tavi gesprochen, Geheimes wird ins Ohr geflüstert.</p><p>' + N + ' Spieler: ' + (N <= 6 ? '5' : '6') + ' Orte, ' + lv.acts + ' Akte, ' + lv.spuren + ' Spuren.</p>');
  }

  /* --- Besetzung --- */
  function renderCast() {
    var W = S.W, h = bar('Besetzung');
    if (S.castIdx >= W.N) {
      h += '<div class="km-center"><h2 class="km-title">Die Besetzung steht</h2><p class="km-sub">Merkt euch eure Nummer, euer Gesicht und den farbigen Rand.</p></div>' + wall() + '<div class="km-row">' + cta('toCase', '🔎', 'Zum Fall') + '</div>';
      explain('Die Besetzung', '<p>Alle Figuren sind öffentlich. Der farbige Rand ist die Kennfarbe, daneben stehen Größe (Balken) und Art. Diese Merkmale brauchen die Spuren später.</p>');
    } else if (S.castSub === 'draw') {
      h += '<div class="km-center" style="padding-top:10px"><div class="km-deck" aria-hidden="true">🃏</div><div class="km-numbig">Nummer ' + (S.castIdx + 1) + '</div><p class="km-sub">Wer das Handy hat, zieht die Karte. Alle schauen zu.</p><div class="km-row">' + cta('castShow', '🃏', 'Karte ziehen') + '</div></div>';
      explain('Die Besetzung', '<p>Der Zufall teilt jedem eine Figur zu. Das Handy geht im Kreis, wer es hat, zieht die nächste Karte. Die Nummer entspricht der Reihenfolge im Kreis.</p>');
    } else {
      var i = S.castIdx, p = P(i), ch = p.ch;
      h += '<div class="km-center"><div class="km-numbig">Nummer ' + (i + 1) + '</div><div class="km-bigcard" style="--ring:' + ring(ch) + '"><div class="pic"><img src="' + img(ch) + '" alt="' + esc(ch.n) + '"></div><div class="cname">' + esc(ch.n) + '</div>' + traits(ch, showG()) + (typed(i) ? '<small class="by">gespielt von ' + esc(p.name) + '</small>' : '') + '<p class="story">' + esc(ch.story) + '</p></div>' +
        '<div class="km-say"><span class="who">' + esc(ch.n) + '</span>„' + esc(ch.intro) + '“</div><div class="km-say"><span class="who">Typische Macke</span>' + esc(C.cap(ch.q)) + '.</div><div class="km-row">' + cta('castNext', '➡️', i < W.N - 1 ? 'Weitergeben' : 'Alle ansehen') + '</div></div>';
      explain('Die Besetzung', '<p>Die Figur stellt sich in ihrer eigenen Stimme vor. Kommissar Tavi nennt danach ihre Macke. Spielt sie mit: Das macht den Abend lustig.</p>');
    }
    STAGE.innerHTML = h;
  }

  /* --- Fall --- */
  function renderCaseIntro() {
    var W = S.W, cd = S.caseDef;
    STAGE.innerHTML = bar('Der Fall') +
      '<div class="km-file"><div class="km-tape"></div><div class="km-casestamp">FALL</div><div class="km-casepics"><span class="loot">' + cd.lootIcon + '</span><span class="arr">⬅️</span>' + pcard(W.crimePlace, { big: true, crime: true }) + '</div><h2 class="km-casetitle">' + esc(cd.title) + '</h2><p class="km-loot">Gestohlen: <b>' + esc(cd.loot) + '</b></p>' +
      '<div class="km-times">' + E.range(W.T).map(function (k) { var s = C.SLOTS[k]; return '<span>' + s.icon + ' ' + s.name + (k === TC ? ' · Tatzeit' : '') + '</span>'; }).join('') + '</div></div>' +
      say_('Kommissar Tavi spricht') + '<p class="km-sub">' + esc(cd.intro) + '</p><div class="km-row">' + cta('toAct', C.SLOTS[0].icon, 'Der Abend beginnt') + '</div>';
    explain('Der Fall', '<p>In dieser Nacht ist etwas verschwunden. Es gibt ' + W.T + ' Akte, und überall sind ' + W.places.length + ' Orte im Spiel. Um Mitternacht war nur der Täter am Tatort, und er war allein.</p>');
  }

  /* --- Akte --- */
  function curP() { return S.actOrder[S.actIdx]; }
  function renderAct() {
    var sub = S.actSub;
    if (sub === 'intro') return renderActIntro();
    if (sub === 'hand') return renderHand();
    if (sub === 'whisper') return (curP() === S.W.culprit && S.act === TC) ? renderLie() : renderWhisper();
    if (sub === 'announce') return renderAnnounce();
    return renderActDone();
  }
  function actBar() { return bar(C.SLOTS[S.act].icon + ' Akt ' + (S.act + 1) + '/' + S.W.T); }
  function renderActIntro() {
    var t = S.act, s = C.SLOTS[t];
    STAGE.innerHTML = actBar() + '<div class="km-center"><div class="km-sky s' + t + '" aria-hidden="true"><span class="sun">' + s.icon + '</span></div><h2 class="km-title">' + (t === 0 ? 'Der Abend' : s.name) + '</h2><p class="km-sub">' + s.time + '</p>' +
      (t === TC ? '<div class="km-bell" id="bellcnt" aria-live="polite">' + (S.bell || '🔔') + '</div>' : '') + '<div class="km-row">' + cta('actGo', '📞', 'Das Geheimtelefon klingelt') + '</div></div>';
    explain(s.name, '<p>Jeder Akt hat eine Handy-Runde: Jeder hört im Geheimtelefon, wo er war, und danach sagt Kommissar Tavi laut, was er behauptet. Alle sagen die Wahrheit, nur der Täter erfindet sein Alibi für Mitternacht.</p>');
  }
  function renderHand() {
    var i = curP(), n = S.W.N;
    STAGE.innerHTML = actBar() + '<div class="km-center"><div class="km-ringer" aria-hidden="true">📞</div><div class="km-handface">' + face(i, 160) + '</div><h2 class="km-title">Nummer ' + (i + 1) + '</h2><p class="km-sub">' + who(i) + '</p><p class="km-sub">Handy ans Ohr! Alle anderen schauen weg.</p>' + '<div class="km-pips" aria-hidden="true">' + S.actOrder.map(function (x, k) { return '<i class="' + (k < S.actIdx ? 'done' : k === S.actIdx ? 'cur' : '') + '"></i>'; }).join('') + '</div><div class="km-row">' + cta('handAnswer', '📞', 'Ich bin’s') + '</div></div>';
    explain('Weitergeben', '<p>Das Handy geht reihum. Wer dran ist, nimmt ab und hält es ans Ohr. Alle anderen schauen weg. Die Reihenfolge wechselt in jedem Akt.</p>');
  }
  function roleBanner(i, t) {
    var W = S.W; if (t === TC && W.loners.indexOf(i) >= 0) return '<div class="km-role warn">🤨 Allein um Mitternacht, das sieht verdächtig aus. Aber du bist unschuldig!</div>';
    return '';
  }
  function renderWhisper() {
    var W = S.W, i = curP(), t = S.act, p = P(i), pid = W.pos[i][t], comp = W.comp[i][t], sg = C.SIGHTS[pid][S.sights[t][pid]];
    var h = actBar() + '<div class="km-center"><div class="km-earicon" aria-hidden="true">📞👂</div><p class="km-sub">Handy ans Ohr. Nur du hörst Tavi flüstern.</p></div>';
    if (S.hidden) h += '<button class="km-cover" data-a="unhide"><span>🙈</span>Tippe zum Aufdecken</button>';
    else h += '<div class="km-secret"><div class="km-who">' + face(i, 72) + '<div><b>Nummer ' + (i + 1) + '</b><small>' + esc(p.ch.n) + '</small></div></div><div class="km-actrow">' + C.SLOTS[t].icon + ' <b>' + C.SLOTS[t].name + '</b></div>' +
      '<div class="km-where">' + pcard(pid, { big: true }) + '<div class="km-with">' + (comp.length ? '<span class="lbl">Bei dir:</span>' + comp.map(function (c) { return face(c, 48); }).join('') : '<span class="alone">🧍<small>allein</small></span>') + '</div></div>' +
      '<div class="km-sight"><span class="ic">' + sg.icon + '</span><div><small>Das hast du dort gesehen:</small><b>' + esc(C.cap(sg.name)) + '</b></div></div>' + roleBanner(i, t) + '</div>';
    h += '<div class="km-row">' + cta('whisperAgain', '🔁', 'Nochmal hören', { ghost: true }) + cta('hide', '🙈', 'Verdecken', { ghost: true }) + '</div><div class="km-row">' + cta('toAnnounce', '✅', 'Fertig') + '</div>';
    STAGE.innerHTML = h;
    explain('Geheimtelefon', '<p>Der Spieler hört seinen Ort, seine Begleiter und das Bild vom Ort. Das Bild ist später für das Zeugen-Duell wichtig. Dieselben Informationen stehen auf dem Bildschirm.</p>');
  }
  function renderLie() {
    var W = S.W, i = curP(), d = S.draft, p = P(i), claimed = {};
    S.claims.forEach(function (c) { if (c && c[TC]) claimed[c[TC].place] = (claimed[c[TC].place] || 0) + 1; });
    var h = actBar() + '<div class="km-center"><div class="km-earicon" aria-hidden="true">📞👂🤫</div><p class="km-sub">Handy ans Ohr. Nur du hörst Tavi flüstern.</p></div>';
    if (S.hidden) h += '<button class="km-cover" data-a="unhide"><span>🙈</span>Tippe zum Aufdecken</button>';
    else {
      h += '<div class="km-secret bad"><div class="km-who">' + face(i, 72) + '<div><b>Nummer ' + (i + 1) + '</b><small>Du warst es! 🤫</small></div></div>' +
        '<div class="km-where">' + pcard(W.crimePlace, { big: true, crime: true }) + '<div class="km-with"><span class="loot">' + S.caseDef.lootIcon + '</span><span class="alone">🧍<small>allein</small></span></div></div>' +
        '<h4>Dein Alibi: Wo warst du angeblich?</h4><div class="km-places">' + W.places.filter(function (x) { return x !== W.crimePlace; }).map(function (x) { var pl = place(x); return '<button class="km-pbtn' + (d.place === x ? ' sel' : '') + '" style="--pc:' + pl.color + '" data-a="draftPlace" data-v="' + x + '"><b>' + pl.icon + '</b><span>' + esc(pl.short) + '</span><small>' + (claimed[x] ? '●'.repeat(Math.min(4, claimed[x])) : '·') + '</small></button>'; }).join('') + '</div>' +
        '<h4>Wer war angeblich bei dir? (freiwillig)</h4><div class="km-comp">' + ids().filter(function (x) { return x !== i; }).map(function (x) { return '<button class="km-cbtn' + (d.comp.indexOf(x) >= 0 ? ' sel' : '') + '" data-a="draftComp" data-v="' + x + '" aria-pressed="' + (d.comp.indexOf(x) >= 0) + '">' + face(x, 36) + '</button>'; }).join('') + '</div>' +
        '<div class="km-sum">' + (d.place ? '<span>Du sagst:</span>' + pcard(d.place, {}) + (d.comp.length ? d.comp.map(function (x) { return face(x, 36); }).join('') : '<span class="alone">🧍 allein</span>') : '<span>Tippe auf einen Ort.</span>') + '</div></div>';
    }
    h += '<div class="km-row">' + cta('whisperAgain', '🔁', 'Nochmal hören', { ghost: true }) + cta('hide', '🙈', 'Verdecken', { ghost: true }) + '</div><div class="km-row">' + cta('toAnnounce', '✅', 'Aussage abgeben', { dis: !d.place }) + '</div>';
    STAGE.innerHTML = h;
    explain('Das Alibi des Täters', '<p>Der Täter wählt erst jetzt, wo er angeblich war. Die Punkte hinter den Orten zeigen, wie oft ein Ort in diesem Akt schon genannt wurde. Wer Begleiter nennt, riskiert, dass diese widersprechen.</p>');
  }
  function renderAnnounce() {
    var W = S.W, i = curP(), t = S.act, c = S.claims[i][t], last = S.actIdx >= W.N - 1;
    STAGE.innerHTML = actBar() + '<div class="km-center">' + say_('Kommissar Tavi spricht') + '<div class="km-annbig">' + face(i, 120) + '</div><h2 class="km-title">Nummer ' + (i + 1) + '</h2><p class="km-sub">' + who(i) + '</p>' +
      '<div class="km-where">' + pcard(c.place, { big: true }) + '<div class="km-with">' + (c.comp.length ? '<span class="lbl">Dabei:</span>' + c.comp.map(function (x) { return face(x, 48); }).join('') : '<span class="alone">🧍<small>allein</small></span>') + '</div></div></div>' +
      village({ t: t, isNew: true }) + '<div class="km-row">' + cta('annNext', '➡️', last ? 'Weiter' : 'Weitergeben') + '</div>';
    explain('Die Aussage', '<p>Kommissar Tavi sagt laut, was die Figur behauptet. Das gilt für alle gleich, auch für den Täter. Auf der Dorfkarte erscheint die Figur an ihrem Ort.</p>');
  }
  function renderActDone() {
    var t = S.act, last = t >= S.W.T - 1;
    STAGE.innerHTML = actBar() + '<div class="km-center"><h2 class="km-title">' + C.SLOTS[t].icon + ' ' + (t === 0 ? 'Der Abend' : C.SLOTS[t].name) + ' ist notiert</h2></div>' + village({ t: t }) + '<div class="km-row">' + cta('actDoneNext', last ? '🔎' : C.SLOTS[t + 1].icon, last ? 'Zum Verhör' : (t === 0 ? 'Weiter zur Mitternacht' : 'Weiter zum Morgengrauen')) + '</div>';
    explain('Dorfkarte', '<p>Jeder Ort ist eine Karte. Wer behauptet, dort gewesen zu sein, steht darin. Die kleinen Gesichter daneben sind die Begleiter, die er genannt hat. Tippt auf eine Figur, dann spricht Tavi ihre Aussage noch einmal.</p>');
  }

  /* --- Verhör --- */
  function mmss(n) { var mm = Math.floor(n / 60), ss = n % 60; return mm + ':' + (ss < 10 ? '0' : '') + ss; }
  function newPrompt() { var n = C.PROMPTS.length, k = Math.floor(Math.random() * n); if (k === S.prompt) k = (k + 1) % n; S.prompt = k; }
  function pickDuel() {
    var W = S.W, pool = [];
    for (var t = 0; t < W.T; t++) E.duels(W, S.claims, t, Math.random).forEach(function (d) {
      var w = E.shuffle(d.who, Math.random); for (var a = 0; a < w.length; a++) for (var b = a + 1; b < w.length; b++) { var key = t + ':' + d.place + ':' + Math.min(w[a], w[b]) + ':' + Math.max(w[a], w[b]); pool.push({ t: t, place: d.place, a: w[a], b: w[b], key: key }); }
    });
    var fresh = pool.filter(function (x) { return !S.duelSeen[x.key]; }); if (fresh.length) pool = fresh;
    if (!pool.length) return null;
    var d = pick(pool); d.opts = E.shuffle(C.SIGHTS[d.place].map(function (s, k) { return { k: k, s: s }; }), Math.random); d.step = 'call'; d.res = null; return d;
  }
  function trail() { return S.duelLog.length ? '<div class="km-duels"><span class="km-lbl">Zeugen-Duelle</span>' + S.duelLog.map(function (d) { return '<span class="dl ' + d.res + '">' + face(d.a, 24) + face(d.b, 24) + (d.res === 'same' ? '✅' : '❌') + '</span>'; }).join('') + '</div>' : ''; }
  function renderRound() {
    if (S.roundSub === 'duel') return renderDuel();
    var W = S.W, h = bar('Verhör ' + S.round + ' von ' + L().spuren);
    if (S.roundSub === 'talk') {
      var pr = C.PROMPTS[S.prompt];
      h += '<div class="km-center"><div class="km-clock' + (S.talkLeft <= 10 && S.talkRun ? ' low' : '') + '" id="tmr">' + mmss(S.talkLeft) + '</div><div class="km-prog"><i id="tbar" style="width:' + Math.round(100 * S.talkLeft / L().talk) + '%"></i></div><div class="km-row">' + cta('talkToggle', S.talkRun ? '⏸️' : '⏱️', S.talkRun ? 'Pause' : (S.talkLeft === 0 ? 'Zeit ist um' : 'Uhr starten'), { ghost: true, dis: S.talkLeft === 0 }) + '</div></div>' +
        village({ t: S.tab, tabs: true }) + trail() + spurPanel() +
        '<div class="km-card"><span class="km-lbl">Fragekarte</span><div class="km-prompt"><span class="pi">' + pr.icon + '</span><p>' + esc(pr.text) + '</p></div><div class="km-row"><button class="km-mini" data-a="speakPrompt">🔊 Vorlesen</button><button class="km-mini" data-a="newPrompt">🔄 Neue Karte</button></div></div>' +
        '<div class="km-row">' + cta('duel', '🔎', 'Zeugen aufrufen', { ghost: true }) + cta('getSpur', '🔬', S.round < L().spuren ? 'Spur anfordern' : 'Letzte Spur anfordern') + '</div>' +
        (S.spurShown >= 1 ? '<div class="km-row">' + cta('toVote', '👆', 'Jetzt anklagen', { ghost: true }) + '</div>' : '');
    } else {
      var sp = S.spuren[S.spurShown - 1];
      h += '<div class="km-center"><h2 class="km-title">Spur ' + S.spurShown + ' von ' + L().spuren + '</h2></div><div class="km-lab"><div class="km-stamp big gold">Labor</div>' + spurPic(sp) + '<p class="txt">' + esc(C.KOM['kom.spur.' + sp.k + '.' + sp.v]) + '</p></div>' + village({ t: S.tab, tabs: true }) + spurPanel() +
        '<div class="km-row">' + cta('afterSpur', S.round < L().spuren ? '🔎' : '👆', S.round < L().spuren ? 'Nächste Verhörrunde' : 'Zur Anklage') + '</div>' + (S.round < L().spuren ? '<div class="km-row">' + cta('toVote', '👆', 'Jetzt anklagen', { ghost: true }) + '</div>' : '');
    }
    STAGE.innerHTML = h;
    explain('Verhör', '<p>Schaut auf die Dorfkarte: Wer war wo, und wen hat er als Begleiter genannt? Wenn zwei Aussagen nicht zusammenpassen, flunkert mindestens einer. Wer um Mitternacht von niemandem genannt wird, hat keinen Zeugen. Figuren, auf die eine Spur nicht passt, werden abgeblendet.</p>' + (L().flags ? '<p>In dieser Stufe markiert das Dorf Widersprüche (⚡) und fehlende Zeugen (👻) selbst.</p>' : '<p>In dieser Stufe markiert das Dorf nichts. Ihr müsst die Widersprüche selbst finden.</p>'));
  }
  function spurPic(sp) {
    var v = sp.v, big;
    if (sp.k === 'fam') big = '<span class="sw" style="background:' + (COLORS[v] || '#999') + '"></span>';
    else if (sp.k === 'szc') big = '<span class="ladder">' + bars(v) + '</span>';
    else if (sp.k === 'spc') big = '<span class="ic">' + C.SPC_ICON[v] + '</span>';
    else big = '<span class="ic">' + C.GDR_ICON[v] + '</span>';
    return '<div class="km-spurpic">' + big + '<small>' + C.SPUR_LABEL[sp.k] + ': <b>' + esc(v) + '</b></small></div>';
  }
  function spurPanel() {
    if (!S.spurShown) return '<div class="km-spurs empty">🔬 Noch keine Spuren. Nach jeder Runde meldet das Labor eine.</div>';
    return '<div class="km-spurs"><b>🔬 Spuren</b>' + S.spuren.slice(0, S.spurShown).map(function (sp) { var v = sp.v, pic = sp.k === 'fam' ? '<i class="sw" style="background:' + (COLORS[v] || '#999') + '"></i>' : sp.k === 'szc' ? bars(v) : sp.k === 'spc' ? C.SPC_ICON[v] : C.GDR_ICON[v]; return '<span class="km-chip gold">' + pic + ' ' + esc(v) + '</span>'; }).join('') + '</div>';
  }
  function renderDuel() {
    var d = S.duel, h = bar('Zeugen-Duell'), s = C.SLOTS[d.t];
    h += '<div class="km-center"><div class="km-duelhead">' + face(d.a, 96) + '<span class="vs">⚔️</span>' + face(d.b, 96) + '</div><p class="km-sub">Nummer ' + (d.a + 1) + ' und Nummer ' + (d.b + 1) + '</p><div class="km-where center"><span class="km-acticon">' + s.icon + '</span>' + pcard(d.place, { big: true }) + '</div></div>';
    h += '<div class="km-center"><span class="km-lbl">Was habt ihr dort gesehen?</span><div class="km-opts">' + d.opts.map(function (o, n) { return '<button class="km-opt" data-a="sightTap" data-v="' + o.k + '" aria-label="Bild ' + (n + 1) + ': ' + esc(o.s.name) + '"><span class="n">' + (n + 1) + '</span><span class="ic">' + o.s.icon + '</span><small>' + esc(C.cap(o.s.name)) + '</small></button>'; }).join('') + '</div></div>';
    if (d.step === 'call') h += '<p class="km-sub">📱 Legt das Handy in die Mitte. Auf drei zeigen beide Zeugen auf ihr Bild.</p><div class="km-row">' + cta('duelGo', '▶️', 'Los: drei, zwei, eins') + '</div>';
    else if (d.step === 'count') h += '<div class="km-center"><div class="km-count" id="cnt">' + (S.count || '') + '</div></div>';
    else if (d.step === 'show') h += '<div class="km-center"><div class="km-zeigt">ZEIGT!</div><p class="km-instr">Zeigen beide auf dasselbe Bild?</p></div><div class="km-row">' + cta('duelRes', '✅', 'Ja, gleich', { v: 'same' }) + cta('duelRes', '❌', 'Nein, verschieden', { v: 'diff', ghost: true }) + '</div>';
    else h += '<div class="km-center"><div class="km-duelres ' + d.res + '">' + (d.res === 'same' ? '✅ Gleiche Antwort' : '❌ Verschieden') + '</div></div><div class="km-row">' + cta('duelClose', '🔎', 'Zurück zum Verhör') + '</div>';
    STAGE.innerHTML = h;
    explain('Zeugen-Duell', '<p>Zwei Figuren behaupten, am selben Ort gewesen zu sein. Wer wirklich dort war, kennt das Bild. Der Täter muss raten. Das Ergebnis klärt nicht, wer recht hat: Auch Unschuldige können etwas vergessen. Es ist nur ein Hinweis.</p>');
  }

  /* --- Anklage --- */
  function renderVote() {
    function g() { return pgrid(ids(), function (i) { var ok = S.cleared.indexOf(i) < 0; return { click: true, dis: !ok, dim: !ok, sel: S.sel.indexOf(i) >= 0, cleared: !ok }; }); }
    var h = bar('Anklage');
    if (S.voteSub === 'ready') h += '<div class="km-center" style="padding-top:12px"><h2 class="km-title">Wer war es?</h2><p class="km-sub">' + (S.attempt === 2 ? 'Zweite und letzte Anklage. Sprecht euch noch einmal ab.' : 'Besprecht euch kurz. Dann zählt Tavi runter, und alle zeigen gleichzeitig auf den Dieb.') + '</p>' + spurPanel() + '<div class="km-row">' + cta('startCount', '👆', 'Los: drei, zwei, eins') + '</div></div>';
    else if (S.voteSub === 'count') h += '<div class="km-center" style="padding-top:36px"><div class="km-count" id="cnt">' + (S.count || '') + '</div><p class="km-sub">Finger bereit!</p></div>';
    else h += '<div class="km-center"><div class="km-zeigt">ZEIGT!</div><div class="km-instr">Auf wen zeigen die meisten?</div></div>' + g() + '<div class="km-row"><button class="km-btn big" data-a="accuse"' + (S.sel.length === 1 ? '' : ' disabled') + '><span class="ic">👆</span> ' + (S.sel.length === 1 ? 'Nummer ' + (S.sel[0] + 1) + ' anklagen' : 'Anklagen') + '</button></div><div class="km-row">' + cta('tie', '🔁', 'Gleichstand: noch einmal zeigen', { ghost: true }) + '</div>';
    STAGE.innerHTML = h;
    explain('Die Anklage', '<p>Das Zeigen passiert am Tisch. Danach tippt jemand die Figur an, auf die die meisten gezeigt haben.</p><ul><li>' + (L().tries > 1 ? 'Die erste Anklage darf falsch sein: Es gibt eine zweite.' : 'Es gibt nur <b>eine</b> Anklage. Falsch heißt: Der Täter entkommt.') + '</li><li>Gleichstand: einfach noch einmal zeigen.</li></ul>');
  }

  /* --- Enthüllung --- */
  function renderReveal() {
    var W = S.W, p = P(S.accused), kob = S.accused === W.culprit, m = S.revealSub, h = bar('Enthüllung');
    var front = '<div class="km-face front"><img src="' + img(p.ch) + '" alt=""><div class="cname">' + esc(p.ch.n) + '</div><small>Nummer ' + (S.accused + 1) + '</small></div>';
    var back = '<div class="km-face back ' + (kob ? 'bad' : 'ok') + '"><img src="' + img(p.ch) + '" alt=""><div class="cname">' + esc(p.ch.n) + '</div><small>Nummer ' + (S.accused + 1) + '</small><div class="km-stamp slam ' + (kob ? 'red' : 'green') + '">' + (kob ? 'Überführt' : 'Unschuldig') + '</div></div>';
    h += '<div class="km-center"><h2 class="km-title">Nummer ' + (S.accused + 1) + ', ' + esc(p.ch.n) + ', tritt vor.</h2><div class="km-flipwrap"><div class="km-flip' + (m === 'drum' ? ' shaking' : '') + '" id="flip">' + front + back + '</div></div>';
    if (m === 'ask') h += '<div class="km-say"><span class="who">Kommissar Tavi</span>Ist das der Täter?</div><div class="km-row">' + cta('flip', '🃏', 'Karte umdrehen') + '</div>';
    else if (m === 'drum') h += '<p class="km-sub">Trommelwirbel …</p>';
    else h += '<div class="km-it"><span class="k">' + esc(p.ch.n) + '</span><div class="km-quote">„' + esc(kob ? p.ch.confess : p.ch.deny) + '“</div></div><div class="km-row">' + cta('afterReveal', kob || S.attempt >= L().tries ? '🔎' : '🔁', kob || S.attempt >= L().tries ? 'Auflösung' : 'Zweite Anklage') + '</div>';
    h += '</div>';
    STAGE.innerHTML = h;
    if (m === 'shown') setTimeout(function () { var f = $('flip'); if (f) f.classList.add('turned'); }, 60);
    explain('Die Enthüllung', m === 'shown' ? (kob ? '<p>Der Täter ist überführt. Er gesteht in der Stimme seiner Figur.</p>' : '<p>Der Angeklagte ist unschuldig und wird auf der Dorfkarte entlastet.</p>') : '<p>Gleich dreht sich die Karte um. Trommelwirbel.</p>');
  }

  /* --- Abspann --- */
  function rebuildHtml() {
    var W = S.W, h = '';
    E.range(W.T).forEach(function (t) { h += '<div class="km-rb"><h5>' + C.SLOTS[t].icon + ' ' + C.SLOTS[t].name + ' · ' + C.SLOTS[t].time + '</h5>' + village({ t: t, truth: true }) + '</div>'; });
    var cl = S.claims[W.culprit][TC];
    h += '<div class="km-it"><span class="k">Das falsche Alibi</span><div class="km-sum">' + face(W.culprit, 36) + '<span>behauptete:</span>' + pcard(cl.place, {}) + (cl.comp.length ? cl.comp.map(function (x) { return face(x, 36); }).join('') : '<span class="alone">🧍 allein</span>') + '</div></div>';
    return h;
  }
  function makeAwards() {
    var W = S.W, cu = W.culprit, won = S.finalCaught, out = {}, pool = [
      { icon: '🔎', title: 'Scharfer Blick', why: 'Hat jede Kleinigkeit auf der Dorfkarte gesehen.' }, { icon: '🎭', title: 'Beste Rolle', why: 'Hat die Figur bis zum Schluss durchgehalten.' },
      { icon: '🧐', title: 'Detailverliebt', why: 'Hat sich jedes Bild vom Ort gemerkt.' }, { icon: '🕊️', title: 'Stimme der Vernunft', why: 'Hat Ruhe in die Verhöre gebracht.' },
      { icon: '⏱️', title: 'Schnellster Verdacht', why: 'Hatte schon beim ersten Zeugen eine Meinung.' }, { icon: '☕', title: 'Ruhiger Pol', why: 'Hat zugehört, während andere durcheinanderredeten.' },
      { icon: '🗝️', title: 'Meister der Ausreden', why: 'Hat ein Alibi so erzählt, dass man es fast geglaubt hätte.' }, { icon: '📞', title: 'Bester Zuhörer', why: 'Hat im Geheimtelefon genau hingehört.' }
    ];
    var rest = pool.slice().sort(function () { return Math.random() - .5; });
    W.players.forEach(function (p) {
      if (p.id === cu) out[p.id] = won ? { icon: '🪤', title: 'Zerknirschter Täter', why: 'Wurde überführt und hat in der Stimme der Figur gestanden.' } : { icon: '🏴‍☠️', title: 'Meisterdieb', why: 'Ist dem Dorf durch die Finger geschlüpft.' };
      else if (S.cleared.indexOf(p.id) >= 0) out[p.id] = { icon: '😇', title: 'Tapferer Unschuldiger', why: 'Wurde fälschlich angeklagt und hat es mit Würde getragen.' };
      else out[p.id] = rest.shift() || pool[0];
    });
    return out;
  }
  function renderEnd() {
    var W = S.W, won = S.finalCaught, cu = W.culprit, h = bar('Abspann');
    if (!S.awards) S.awards = makeAwards();
    h += '<div class="km-center"><div class="km-win ' + (won ? 'dorf' : 'kob') + '">' + (won ? 'Fall gelöst!' : 'Der Dieb entkommt!') + '</div></div>' +
      '<div class="km-say"><span class="who">Kommissar Tavi</span>' + esc(won ? S.caseDef.solved : S.caseDef.escaped) + '</div>' +
      '<div class="km-center"><div class="km-lbl">Der Dieb war</div><div style="max-width:220px;width:100%">' + pol(cu, {}) + '</div></div>' +
      '<div class="km-center"><div class="km-lbl">Die Rekonstruktion: was wirklich geschah</div><div class="km-rebuild">' + rebuildHtml() + '</div></div>' +
      '<div class="km-center"><div class="km-lbl">Die Auszeichnungen</div><div class="km-awards">' + W.players.map(function (p) { var a = S.awards[p.id], t = C.traitFor(p.id === cu ? 'culprit' : 'innocent', p.id === cu ? !won : won); return '<div class="km-award">' + face(p.id, 48) + '<div><div class="tt"><span class="ic">' + a.icon + '</span>' + esc(a.title) + '</div><div class="ww">' + esc(a.why) + '</div><div class="gr">' + t.icon + ' ' + t.trait + ' +1 (Beispiel für den Avatar): ' + esc(P(p.id).ch.n) + ' ' + esc(t.why) + '.</div></div></div>'; }).join('') + '</div></div>' +
      '<div class="km-row">' + cta('again', '🎲', 'Neuer Fall mit neuer Besetzung') + '</div><div class="km-row">' + cta('quit', '🏠', 'Zurück zum Anfang', { ghost: true }) + '</div>';
    STAGE.innerHTML = h;
    explain('Abspann', '<p>Die Rekonstruktion zeigt für jeden Akt, wo jeder wirklich war und welches Bild er dort gesehen hat. Vergleicht sie mit dem falschen Alibi des Täters.</p><p>In der Talea-App würde jetzt jeder Avatar ein kleines Eigenschafts-Update mit Begründung bekommen. Hier sind es nur Beispiele.</p>');
  }

  /* --- Overlays: Regeln, Besetzung, Kurz-Tour --- */
  var TOUR = [
    { pic: ['🌙', '🏰', '❓'], cap: 'In Kicherwald ist etwas verschwunden. Einer von euch war es.' },
    { pic: ['🎭', '🔢', '🎨'], cap: 'Jeder bekommt eine Figur, eine Nummer und einen farbigen Rand.' },
    { pic: ['📞', '👂', '🤫'], cap: 'Geheimtelefon: Handy ans Ohr. Tavi flüstert dir, wo du warst und wen du gesehen hast.' },
    { pic: ['🗣️', '✅', '🤥'], cap: 'Alle sagen die Wahrheit. Nur der Dieb flunkert.' },
    { pic: ['🖼️', '☝️', '☝️'], cap: 'Zeugen-Duell: Auf drei zeigen zwei Zeugen auf ihr Bild. Wer flunkert, muss raten.' },
    { pic: ['👆', '👆', '😱'], cap: 'Am Ende zeigen alle auf den Dieb.' }
  ];
  function renderOverlay() {
    if (!S.overlay) { OVER.hidden = true; OVER.innerHTML = ''; return; }
    OVER.hidden = false; OVER.className = 'km-overlay';
    var h = '<div class="km-over" role="dialog" aria-modal="true"><div class="km-row" style="justify-content:space-between;align-items:center"><h2>' + (S.overlay === 'rules' ? 'Die Regeln' : S.overlay === 'tour' ? 'Kurz erklärt' : 'Die Besetzung') + '</h2><button class="km-btn ghost" data-a="closeOverlay">✕ Schließen</button></div>';
    if (S.overlay === 'cast' && S.W) h += '<p>Alle Figuren sind öffentlich. Tippt auf ein Gesicht, um die Stimme zu hören.</p><div class="km-wall">' + ids().map(function (i) { var ch = P(i).ch; return '<div class="km-wc"><button class="km-wbtn" data-a="castVoice" data-v="' + i + '" aria-label="Stimme von ' + esc(ch.n) + ' hören">' + face(i, 72) + '</button><b>' + esc(ch.n) + '</b>' + (typed(i) ? '<small>' + esc(P(i).name) + '</small>' : '') + traits(ch, showG()) + '</div>'; }).join('') + '</div>';
    else if (S.overlay === 'tour') {
      var k = S.tourIdx, sl = TOUR[k - 1];
      h += '<div class="km-tour"><div class="km-tourpic" aria-hidden="true">' + sl.pic.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><p class="km-tourcap">' + esc(sl.cap) + '</p><div class="km-pips">' + TOUR.map(function (x, n) { return '<i class="' + (n + 1 === k ? 'cur' : n + 1 < k ? 'done' : '') + '"></i>'; }).join('') + '</div><div class="km-row">' + (k > 1 ? cta('tourPrev', '⬅️', 'Zurück', { ghost: true }) : '') + (k < TOUR.length ? cta('tourNext', '➡️', 'Weiter') : cta('closeOverlay', '🎭', 'Los geht’s')) + '</div></div>';
    } else h += rulesHtml();
    OVER.innerHTML = h + '</div>';
  }
  function rulesHtml() {
    return '<div class="km-row">' + cta('tour', '🎬', 'Kurz erklärt, mit Bildern und Stimme', { ghost: true }) + (S.W ? cta('quit', '🏠', 'Neues Spiel', { ghost: true }) : '') + '</div>' +
      '<div class="km-goldbox"><p><b>Worum geht’s?</b> In Kicherwald ist in der Nacht etwas gestohlen worden. Einer von euch war es. Jeder spielt eine Talea-Figur mit eigener Geschichte und Stimme.</p><p><b>Das Dorf gewinnt,</b> wenn es den Täter anklagt. <b>Der Täter gewinnt,</b> wenn er unentdeckt bleibt.</p></div>' +
      '<h3>Niemand muss lesen können</h3><p>Kommissar Tavi spricht alles, und alles hat ein Bild. Geheimes kommt per <b>Geheimtelefon</b> ans Ohr: Handy ans Ohr halten oder Kopfhörer benutzen. Die Flüsterlautstärke stellt ihr oben unter „Stimmen &amp; Audio“ ein.</p>' +
      '<h3>Das Prinzip: Alibi</h3><p>Die Nacht hat 2 oder 3 Akte: <b>Abend, Mitternacht, Morgengrauen</b>. In jedem Akt war jeder an einem Ort, allein oder mit anderen. Wer am selben Ort war, hat sich gesehen und kennt das <b>Bild vom Ort</b> (zum Beispiel eine Entenfamilie). Um Mitternacht war nur der Täter am Tatort, und zwar allein.</p>' +
      '<h3>Der Ablauf</h3><ol><li><b>Besetzung.</b> Das Handy geht im Kreis. Jeder zieht eine Figur und bekommt eine Nummer.</li><li><b>Der Fall.</b> Tavi erzählt, was verschwunden ist und wo.</li><li><b>Akte.</b> In jedem Akt klingelt das Geheimtelefon reihum. Wer dran ist, hält das Handy ans Ohr und hört, wo er war, wer bei ihm war und was er gesehen hat. Dann sagt Tavi laut, was die Figur behauptet. Auf der Dorfkarte erscheint sie an ihrem Ort. <b>Der Täter</b> wählt sein Alibi für Mitternacht frei, erst wenn er dran ist.</li><li><b>Verhör.</b> Vergleicht die Dorfkarte, stellt Fragen, macht Zeugen-Duelle. Nach jeder Runde meldet das Labor eine Spur.</li><li><b>Anklage.</b> Alle zeigen gleichzeitig auf den Täter.</li></ol>' +
      '<h3>So findet ihr den Täter</h3><ul><li><b>Wer hat keinen Zeugen?</b> Jeder Unschuldige wird um Mitternacht von jemandem bestätigt, der mit ihm war. Der Täter wird von niemandem genannt.</li><li><b>Widersprüche.</b> Sagt jemand „Ich war mit Nummer 3 im Garten“, und Nummer 3 war woanders, stimmt eine Aussage nicht.</li><li><b>Zeugen-Duell.</b> Wer wirklich an einem Ort war, kennt das Bild dort. Der Täter muss raten. Auch Unschuldige können etwas vergessen, deshalb ist es nur ein Hinweis.</li><li><b>Spuren.</b> Das Labor nennt Kennfarbe (farbiger Rand), Größe (Balken), Art oder Geschlecht des Täters. Figuren, auf die das nicht passt, werden abgeblendet.</li></ul>' +
      '<h3>Die Stufen</h3><ul>' + Object.keys(E.LEVELS).map(function (k) { var li = C.LEVEL_INFO[k]; return '<li><b>' + li.icon + ' ' + esc(li.n) + ' (' + esc(li.age) + '):</b> ' + esc(li.d) + '</li>'; }).join('') + '</ul>' +
      '<h3>Häufige Fragen</h3><details><summary>Darf der Täter lügen?</summary><p>Er muss sogar. Sein Alibi für Mitternacht ist erfunden. Alles andere ist wahr.</p></details><details><summary>Lügen die Unschuldigen auch?</summary><p>Nein. Das ist die Grundregel.</p></details><details><summary>Kann man den Täter wirklich finden?</summary><p>Ja. Jeder Fall wird vor dem Spiel geprüft: Mit allen Aussagen und Spuren bleibt genau ein Verdächtiger übrig, egal welches Alibi der Täter wählt.</p></details><details><summary>Was, wenn andere beim Geheimtelefon mithören?</summary><p>Das Handy flüstert leise. Haltet es ans Ohr oder nehmt Kopfhörer. Wer wirklich spähen will, kann es, deshalb: Alle anderen schauen weg und halten sich die Ohren zu.</p></details>';
  }

  /* ---------- Ablauf ---------- */
  function startGame() {
    var N = setup.count, names = E.range(N).map(function (i) { return (setup.names[i] || '').trim().slice(0, 14) || ('Nr. ' + (i + 1)); });
    store('alibi2-setup', JSON.stringify(setup)); store('alibi2-seen', '1');
    newCase(names); S.phase = 'cast'; S.castIdx = 0; S.castSub = 'draw'; render(); say(['kom.cast.start']);
  }
  function newCase(names) {
    resetFlow();
    var cd = setup.caseId === 'zufall' ? pick(C.CASES) : (C.CASES.filter(function (c) { return c.id === setup.caseId; })[0] || pick(C.CASES));
    var all = Object.keys(C.PLACES).filter(function (x) { return x !== cd.crime; }), nPl = names.length <= 6 ? 5 : 6;
    var places = [cd.crime].concat(E.shuffle(all, Math.random).slice(0, nPl - 1));
    S.caseDef = cd; S.W = E.generate({ names: names, pool: CHARS, level: setup.level, places: places, crimePlace: cd.crime, rng: Math.random });
    for (var t = 0; t < S.W.T; t++) { S.sights[t] = {}; places.forEach(function (x) { S.sights[t][x] = Math.floor(Math.random() * 4); }); }
    S.claims = names.map(function () { return []; });
  }
  function castParts(i) { var ch = P(i).ch; return [{ hl: i }, 'num.' + (i + 1), { c: ch, k: 'intro' }, 'kom.cast.macke', 'character.' + ch.s + '.quirk']; }
  function startAct() {
    S.phase = 'act'; S.actSub = 'intro'; S.actIdx = 0; S.bell = 0; render(); runIntro();
  }
  function stopIntro() { introToken++; }
  async function runIntro() {
    var my = ++introToken, t = S.act; setAmb(['amb.evening', 'amb.midnight', 'amb.dawn'][t]);
    if (t === TC) {
      await say(['kom.act.1.pre']); if (my !== introToken) return;
      for (var n = 1; n <= 12; n++) { S.bell = n; var b = $('bellcnt'); if (b) { b.textContent = n; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; } sfx('bell'); vib(30); await sleep(950); if (my !== introToken) return; }
      await say([pickVar('kom.act.1.post')]);
    } else say([pickVar('kom.act.' + t)]);
  }
  function handParts(first) { var i = curP(), parts = []; if (first && S.act === 0) parts.push('kom.hand.first'); parts.push({ hl: i }, first ? 'kom.hand.pre.1' : pick(['kom.hand.pre.2', 'kom.hand.pre.3']), 'num.' + (i + 1), { hl: null }); if (first) parts.push('kom.hand.post'); return parts; }
  function actGo() { stopIntro(); S.actSub = 'hand'; S.actOrder = rotate(E.range(S.W.N), Math.floor(Math.random() * S.W.N)); S.actIdx = 0; render(); sfx('ring'); vib([60, 40, 60]); say(handParts(true)); }
  function whisperParts(i, t) {
    var W = S.W, pid = W.pos[i][t], comp = W.comp[i][t], sg = C.SIGHTS[pid][S.sights[t][pid]], parts = ['w.act.' + t, 'w.place.' + pid];
    if (comp.length) { parts.push(comp.length === 1 ? 'w.with.1' : 'w.with.n'); parts = parts.concat(numList(comp, true)); } else parts.push('w.alone');
    parts.push('w.saw', 'w.sight.' + sg.id, { fx: 'fx.sight.' + sg.id });
    if (t === TC && W.loners.indexOf(i) >= 0) parts.push('w.loner');
    parts.push('w.remember'); return parts;
  }
  function whisperSay() { var i = curP(); if (i === S.W.culprit && S.act === TC) say(['w.culprit.1', 'w.culprit.2'], { priv: true }); else say(whisperParts(i, S.act), { priv: true }); }
  function handAnswer() { S.actSub = 'whisper'; S.hidden = false; S.draft = { place: null, comp: [] }; S.lieTold = false; render(); sfx('page'); whisperSay(); }
  function commitClaim(i, t) { var W = S.W; S.claims[i][t] = (i === W.culprit && t === TC) ? { place: S.draft.place, comp: S.draft.comp.slice() } : { place: W.pos[i][t], comp: W.comp[i][t].slice() }; }
  function annParts(i, t, replay) {
    var c = S.claims[i][t], parts = [];
    if (!replay) { parts.push({ sfx: 'type' }); if (t === TC) parts.push({ c: P(i).ch, k: 'stmt' }); }
    parts.push({ hl: i }, 'num.' + (i + 1), 'name.' + P(i).ch.s, { hl: null }, 'place.' + c.place);
    if (c.comp.length) { parts.push('kom.ann.with'); parts = parts.concat(numList(c.comp, false)); } else parts.push('kom.ann.alone');
    if (!replay) parts.push({ hl: null }, pickVar('kom.ann.end'));
    return parts;
  }
  function toAnnounce() { var i = curP(), t = S.act; commitClaim(i, t); S.actSub = 'announce'; S.newRes = i; stopVoice(); render(); sfx('stamp'); vib(60); say(annParts(i, t)); }
  function annNext() {
    stopVoice(); S.newRes = null;
    if (S.actIdx < S.W.N - 1) { S.actIdx++; S.actSub = 'hand'; S.hidden = false; render(); sfx('ring'); say(handParts(false)); return; }
    S.actSub = 'done'; render(); say([S.act >= S.W.T - 1 ? 'kom.act.done.last' : 'kom.act.done.' + S.act]);
  }
  function actDoneNext() {
    stopVoice();
    if (S.act < S.W.T - 1) { S.act++; S.actSub = 'intro'; S.actIdx = 0; S.bell = 0; render(); runIntro(); return; }
    startRound();
  }
  function computeFlags() {
    var W = S.W; if (!L().flags) return null;
    var seen = {}, conf = E.conflicts(W, S.claims).filter(function (c) { var k = c.a + ':' + c.b; if (seen[k]) return false; seen[k] = 1; return c.t === TC; });
    return { conf: conf, alone: E.unvouched(W, S.claims, TC) };
  }
  function flagParts() {
    var f = S.flags, parts = []; if (!f) return parts;
    if (f.conf.length) { var k = 1 + Math.floor(Math.random() * 3), c0 = f.conf[0]; parts.push('kom.einspruch.' + k, { hl: [c0.a, c0.b] }, 'numc.' + (c0.a + 1), 'kom.and', 'numc.' + (c0.b + 1), { hl: null }, 'kom.einspruch.out.' + k); if (f.conf.length > 1) parts.push('kom.einspruch.more'); }
    if (f.alone.length) { parts.push('kom.alone.pre'); parts = parts.concat(numList(f.alone, false)); parts.push({ hl: null }, pickVar('kom.alone.post')); }
    return parts;
  }
  function startRound() {
    var W = S.W, sp = E.pickSpuren(W, S.claims, L().spuren, Math.random);
    if (!sp) sp = L().keys.slice(0, L().spuren).map(function (k) { return { k: k, v: P(W.culprit).ch[k] }; });
    stopAmb(); S.spuren = sp; S.spurShown = 0; S.round = 1; S.roundSub = 'talk'; S.talkLeft = L().talk; S.talkRun = false; S.flags = computeFlags(); S.tab = TC; newPrompt(); S.phase = 'round'; render();
    say(['kom.round.1'].concat(flagParts()));
  }
  function getSpur() { stopTimer(); S.talkRun = false; S.spurShown++; S.roundSub = 'spur'; render(); sfx('stamp'); vib(80); var sp = S.spuren[S.spurShown - 1]; say([pickVar('kom.spur.next'), 'kom.spur.' + sp.k + '.' + sp.v]); }
  function afterSpur() { if (S.round < L().spuren) { S.round++; S.roundSub = 'talk'; S.talkLeft = L().talk; S.talkRun = false; newPrompt(); render(); say(['kom.round.' + Math.min(3, S.round)]); } else toVote(); }
  function toVote() { stopTimer(); S.talkRun = false; S.phase = 'vote'; S.voteSub = 'ready'; S.sel = []; render(); say([S.attempt === 2 ? 'kom.second' : 'kom.accuse.1']); }
  function callDuel() {
    var d = pickDuel(); if (!d) { say(['kom.duel.none']); return; }
    stopTimer(); S.talkRun = false; S.duel = d; S.roundSub = 'duel'; render(); sfx('sting');
    say([pickVar('kom.duel.call'), 'kom.duel.who'].concat(numList([d.a, d.b], false), [{ hl: null }, 'act.' + d.t, 'place.' + d.place, 'kom.duel.ask']));
  }
  async function duelGo() {
    var d = S.duel; d.step = 'count'; S.count = 3; render(); say(['kom.vote']);
    for (var n = 3; n >= 1; n--) { S.count = n; var c = $('cnt'); if (c) { c.textContent = n; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; } sfx('knock'); vib(40); await sleep(900); if (S.phase !== 'round' || S.duel !== d || d.step !== 'count') return; }
    d.step = 'show'; render(); sfx('drum'); vib([60, 40, 200]);
  }
  function duelRes(res) { var d = S.duel; d.res = res; d.step = 'result'; S.duelSeen[d.key] = 1; S.duelLog.push({ a: d.a, b: d.b, res: res, t: d.t, place: d.place }); render(); sfx(res === 'same' ? 'chime' : 'sting'); say([pickVar('kom.duel.' + res)]); }

  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function startTimer() {
    stopTimer();
    timer = setInterval(function () {
      if (!S.W || S.phase !== 'round' || S.roundSub !== 'talk') { stopTimer(); return; }
      if (S.talkLeft > 0) S.talkLeft--;
      var t = $('tmr'); if (t) { t.textContent = mmss(S.talkLeft); t.classList.toggle('low', S.talkLeft <= 10 && S.talkLeft > 0); }
      var b = $('tbar'); if (b) b.style.width = Math.round(100 * S.talkLeft / L().talk) + '%';
      if (S.talkLeft > 0 && S.talkLeft <= 10) sfx('tick');
      if (S.talkLeft === 10) say(['kom.time.10']);
      if (S.talkLeft === 0) { stopTimer(); S.talkRun = false; sfx('gavel'); vib([300]); render(); say(['kom.time.up']); }
    }, 1000);
  }
  async function startCount() {
    S.voteSub = 'count'; S.count = 3; render(); say(['kom.vote']);
    for (var n = 3; n >= 1; n--) { S.count = n; var c = $('cnt'); if (c) { c.textContent = n; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; } sfx('knock'); vib(40); await sleep(900); if (S.phase !== 'vote' || S.voteSub !== 'count') return; }
    S.voteSub = 'point'; S.sel = []; render(); sfx('drum'); vib([60, 40, 200]); say(['kom.help.point']);
  }
  async function doFlip() {
    S.revealSub = 'drum'; render(); sfx('drum'); vib([80, 50, 80, 50, 300]); say(['kom.accuse.2']);
    await sleep(1700); if (S.phase !== 'reveal') return;
    var W = S.W, kob = S.accused === W.culprit; S.revealSub = 'shown'; render();
    if (kob) { sfx('stamp'); setTimeout(function () { sfx('cheer'); }, 500); vib([200, 80, 200]); say([pickVar('kom.guilty'), { c: P(S.accused).ch, k: 'confess' }]); }
    else { S.cleared.push(S.accused); sfx('stamp'); setTimeout(function () { sfx('boo'); }, 500); vib([300, 100, 300]); say([pickVar('kom.innocent'), { c: P(S.accused).ch, k: 'deny' }]); }
  }
  function toEnd(caught) {
    S.finalCaught = caught; S.phase = 'end'; S.awards = null; stopTimer(); render();
    var cd = S.caseDef, parts = caught ? ['kom.case.' + cd.id + '.solved'] : [{ c: P(S.W.culprit).ch, k: 'smug' }, 'kom.case.' + cd.id + '.escaped'];
    if (caught) sfx('fanfare'); else sfx('sad'); say(parts.concat(['kom.rebuild']));
  }
  function helpIds() {
    var ph = S.phase, sub = subState();
    if (!S.W) return { id: 'kom.help.setup' };
    if (ph === 'cast') return { id: 'kom.help.cast' };
    if (ph === 'caseIntro') return { id: 'kom.help.case' };
    if (ph === 'act') return sub === 'intro' ? { id: 'kom.help.act' } : sub === 'hand' ? { id: 'kom.help.hand' } : sub === 'whisper' ? { id: (curP() === S.W.culprit && S.act === TC) ? 'kom.help.lie' : 'kom.help.whisper', priv: true } : { id: 'kom.help.announce' };
    if (ph === 'round') return { id: sub === 'duel' ? 'kom.help.duel' : 'kom.help.talk' };
    if (ph === 'vote') return { id: sub === 'point' ? 'kom.help.point' : 'kom.help.vote' };
    if (ph === 'reveal') return { id: 'kom.help.reveal' };
    return { id: 'kom.help.end' };
  }

  /* ---------- Ereignisse ---------- */
  ROOT.addEventListener('click', function (e) {
    var pc = e.target.closest('[data-pid]'), res = e.target.closest('[data-res]'), cn = e.target.closest('[data-count]'), b = e.target.closest('[data-a],[data-level]');
    if (pc && !pc.disabled) { if (S.phase === 'vote' && S.voteSub === 'point') { var id = +pc.getAttribute('data-pid'); S.sel = (S.sel[0] === id) ? [] : [id]; sfx('pop'); render(); } return; }
    if (cn) { readNames(); setup.count = +cn.getAttribute('data-count'); sfx('pop'); render(); return; }
    if (res && !res.disabled) { var ri = +res.getAttribute('data-res'), rt = +res.getAttribute('data-t'); actx(); if (S.claims[ri] && S.claims[ri][rt]) say(annParts(ri, rt, true)); return; }
    if (!b || b.disabled) return;
    var G = S.W; actx();
    if (b.hasAttribute('data-level')) { readNames(); setup.level = b.getAttribute('data-level'); sfx('pop'); render(); return; }
    var a = b.getAttribute('data-a'), v = b.getAttribute('data-v');
    switch (a) {
      case 'sound': soundOn = !soundOn; if (!soundOn) stopVoice(); render(); break;
      case 'help': { var hp = helpIds(); say([hp.id], { priv: !!hp.priv }); break; }
      case 'rules': S.overlay = 'rules'; render(); break;
      case 'cast': S.overlay = 'cast'; render(); break;
      case 'tour': S.overlay = 'tour'; S.tourIdx = 1; render(); say(['kom.tour.1']); break;
      case 'tourNext': S.tourIdx = Math.min(TOUR.length, S.tourIdx + 1); render(); say(['kom.tour.' + S.tourIdx]); break;
      case 'tourPrev': S.tourIdx = Math.max(1, S.tourIdx - 1); render(); say(['kom.tour.' + S.tourIdx]); break;
      case 'castVoice': say([{ c: P(+v).ch, k: 'intro' }]); break;
      case 'closeOverlay': stopVoice(); S.overlay = null; render(); break;
      case 'quit': if (S.quitArmed > Date.now() || !G || S.phase === 'end') { stopVoice(); stopTimer(); stopIntro(); stopAmb(); S.W = null; S.phase = 'setup'; S.quitArmed = 0; resetFlow(); S.overlay = null; render(); } else { S.quitArmed = Date.now() + 3500; var qold = b.innerHTML; b.innerHTML = '<span class="ic">❗</span> Wirklich beenden?'; setTimeout(function () { S.quitArmed = 0; if (b.isConnected) b.innerHTML = qold; }, 3600); } break;
      case 'begin': readNames(); startGame(); break;
      case 'castShow': S.castSub = 'shown'; render(); sfx('page'); say(castParts(S.castIdx)); break;
      case 'castNext': S.castIdx++; S.castSub = 'draw'; render(); if (S.castIdx >= G.N) say(['kom.cast.done']); else say([pickVar('kom.cast.pass')]); break;
      case 'toCase': S.phase = 'caseIntro'; render(); sfx('page'); say(['kom.case.' + S.caseDef.id + '.intro']); break;
      case 'toAct': S.act = 0; startAct(); break;
      case 'actGo': actGo(); break;
      case 'handAnswer': handAnswer(); break;
      case 'whisperAgain': whisperSay(); break;
      case 'hide': S.hidden = true; render(); break;
      case 'unhide': S.hidden = false; render(); break;
      case 'draftPlace': S.draft.place = v; sfx('pop'); render(); if (!S.lieTold) { S.lieTold = true; say(['place.' + v, 'w.culprit.3', 'w.culprit.ready'], { priv: true }); } else say(['place.' + v], { priv: true }); break;
      case 'draftComp': { var cid = +v, ix = S.draft.comp.indexOf(cid); if (ix >= 0) S.draft.comp.splice(ix, 1); else if (S.draft.comp.length < 3) S.draft.comp.push(cid); sfx('pop'); render(); say(['w.num.' + (cid + 1)], { priv: true }); break; }
      case 'toAnnounce': toAnnounce(); break;
      case 'annNext': annNext(); break;
      case 'actDoneNext': actDoneNext(); break;
      case 'tab': S.tab = +v; render(); break;
      case 'talkToggle': if (S.talkLeft === 0) break; S.talkRun = !S.talkRun; if (S.talkRun) startTimer(); else stopTimer(); render(); break;
      case 'newPrompt': newPrompt(); render(); say(['kom.prompt.' + (S.prompt + 1)]); break;
      case 'speakPrompt': say(['kom.prompt.' + (S.prompt + 1)]); break;
      case 'duel': callDuel(); break;
      case 'duelGo': duelGo(); break;
      case 'duelRes': duelRes(v); break;
      case 'duelClose': S.roundSub = 'talk'; S.duel = null; render(); break;
      case 'sightTap': { var sg = null; if (S.duel) S.duel.opts.forEach(function (o) { if (o.k === +v) sg = o.s; }); if (sg) { sfx('pop'); say(['sight.' + sg.id, { fx: 'fx.sight.' + sg.id }]); } break; }
      case 'getSpur': getSpur(); break;
      case 'afterSpur': afterSpur(); break;
      case 'toVote': toVote(); break;
      case 'startCount': startCount(); break;
      case 'tie': S.voteSub = 'ready'; S.sel = []; render(); break;
      case 'accuse': S.accused = S.sel[0]; S.revealSub = 'ask'; S.phase = 'reveal'; render(); say([{ hl: S.accused }, 'num.' + (S.accused + 1), 'name.' + P(S.accused).ch.s, { hl: null }, 'kom.reveal.ask']); break;
      case 'flip': doFlip(); break;
      case 'afterReveal': if (S.accused === G.culprit) toEnd(true); else if (S.attempt >= L().tries) toEnd(false); else { S.attempt++; toVote(); } break;
      case 'again': { stopVoice(); stopTimer(); stopIntro(); var nm = G.players.map(function (p) { return p.name; }); S.overlay = null; newCase(nm); S.phase = 'cast'; S.castIdx = 0; S.castSub = 'draw'; render(); say(['kom.cast.start']); break; }
    }
  });
  ROOT.addEventListener('pointerdown', function () { S.press = true; clearTimeout(S.pressT); S.pressT = setTimeout(function () { S.press = false; if (S.deferred) { S.deferred = false; render(); } }, 1500); }, true);
  function pressEnd() { S.press = false; clearTimeout(S.pressT); if (S.deferred) setTimeout(function () { if (S.deferred && !S.press) { S.deferred = false; render(); } }, 30); }
  ROOT.addEventListener('pointerup', pressEnd, true); ROOT.addEventListener('pointercancel', pressEnd, true);
  ROOT.addEventListener('input', function (e) { if (e.target.id && e.target.id.indexOf('nm') === 0) setup.names[+e.target.id.slice(2)] = e.target.value; });
  ROOT.addEventListener('change', function (e) { if (e.target.id === 'caseSel') setup.caseId = e.target.value; });
  function readNames() { setup.names = setup.names.map(function (n, i) { var el = $('nm' + i); return el ? el.value : n; }); var cs = $('caseSel'); if (cs) setup.caseId = cs.value; }
  document.addEventListener('visibilitychange', function () { if (document.hidden) { stopVoice(); if (S.talkRun) { S.talkRun = false; stopTimer(); if (S.phase === 'round') render(); } } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.overlay) { stopVoice(); S.overlay = null; render(); } });
  if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function () { }; } catch (e) { } }
  render();
  ROOT.taleaTest = { S: S, E: E, C: C, setup: setup, setFast: function (v) { FAST = !!v; ROOT.classList.toggle('fast', FAST); }, render: render, get W() { return S.W; }, say: say, recorded: recorded, CLIPS: CLIPS, CHARS: CHARS, LOG: LOG, get privVol() { return privVol; }, subState: subState, curP: curP };
})();
