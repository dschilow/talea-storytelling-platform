/* Mitternachts-Alibi: Oberfläche. Nutzt KMEngine (Rätsel), KMContent (Texte), KM_CHARS und KM_IMAGES (vom Build eingefügt). */
(function () {
  'use strict';
  var E = KMEngine, C = KMContent, TC = E.TC;
  var ROOT = document.getElementById('talea-alibi');
  var STAGE = ROOT.querySelector('#stage'), HELP = ROOT.querySelector('#explain'), OVER = ROOT.querySelector('#overlay');
  var CHARS = KM_CHARS, IMG = KM_IMAGES, FAST = false;
  var COLORS = { Blau: '#4a78d8', Braun: '#8a6240', Gelb: '#e2b93b', Weiß: '#f2efe6', Rot: '#d24b45', Grau: '#9aa1a8', Grün: '#4f9b60', Lila: '#8d62c9', Schwarz: '#2a2a30', Rosa: '#eb8fb4', Orange: '#ee8a3c' };

  /* ---------- Hilfen ---------- */
  function $(id) { return ROOT.querySelector('#' + id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, FAST ? 0 : ms); }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function img(c) { return IMG[c.s] || ('data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#3a2f26"/><text x="50" y="64" font-size="46" text-anchor="middle">🕵️</text></svg>')); }
  function list(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1]; }
  function P(i) { return S.W.players[i]; }
  function pname(i) { return esc(P(i).ch.n); }
  function place(id) { return C.PLACES[id]; }

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
    page: function () { noise(0, .22, .05, 2600); }
  };
  function sfx(n) { if (soundOn && !FAST) { try { SFX[n](); } catch (e) { } } }
  function vib(p) { try { if (soundOn && !FAST && navigator.vibrate) navigator.vibrate(p); } catch (e) { } }

  /* ---------- Stimmen ---------- */
  var CLIPS = {};
  Object.keys(C.KOM).forEach(function (id) { CLIPS[id] = C.KOM[id]; });
  CHARS.forEach(function (c) { ['intro', 'stmt', 'deny', 'confess', 'smug'].forEach(function (k) { CLIPS['character.' + c.s + '.' + k] = c[k]; }); });
  var recorded = {}, activeAudio = null, seq = 0;
  function stopVoice() { seq++; if (activeAudio) { try { activeAudio.pause(); } catch (e) { } activeAudio = null; } if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) { } } }
  function voices() { try { return window.speechSynthesis.getVoices().filter(function (v) { return /^de/i.test(v.lang); }); } catch (e) { return []; } }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function estimate(t) { return Math.min(5200, 500 + (t || '').length * 42); }
  function say(parts) {
    stopVoice(); var my = seq, i = 0;
    parts = (Array.isArray(parts) ? parts : [parts]).filter(Boolean);
    return new Promise(function (resolve) {
      function next() {
        if (my !== seq) return resolve(false);
        if (i >= parts.length) return resolve(true);
        var p = parts[i++], id = p.id, ch = p.c, text = '';
        if (ch) { id = 'character.' + ch.s + '.' + p.k; text = ch[p.k]; } else text = C.KOM[id] || CLIPS[id] || '';
        if (FAST) return next();
        if (!soundOn || !text) return setTimeout(next, estimate(text));
        var finished = false;
        function done() { if (finished) return; finished = true; next(); }
        function fallback() {
          if (my !== seq) return resolve(false);
          if (!('speechSynthesis' in window)) return setTimeout(done, estimate(text));
          try {
            var u = new SpeechSynthesisUtterance(text), vs = voices(); u.lang = 'de-DE'; if (vs.length) u.voice = vs[ch ? hash(ch.n) % vs.length : 0];
            if (ch) { var base = ch.gdr === 'weiblich' ? 1.25 : ch.gdr === 'männlich' ? .8 : 1.05; u.pitch = Math.max(.2, Math.min(2, base + ((hash(ch.n) % 30) - 15) / 100)); u.rate = .95; } else { u.pitch = .85; u.rate = .95; }
            u.onend = done; u.onerror = done; window.speechSynthesis.speak(u); setTimeout(done, estimate(text) + 5000);
          } catch (e) { setTimeout(done, estimate(text)); }
        }
        if (id && recorded[id]) {
          try { activeAudio = new Audio(recorded[id]); activeAudio.onended = done; activeAudio.onerror = fallback; var pr = activeAudio.play(); if (pr && pr.catch) pr.catch(function () { setStatus('Aufnahme konnte nicht abgespielt werden · Browser-Probestimme'); fallback(); }); } catch (e) { fallback(); }
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
      if (!CLIPS[id] || file.size > 12 * 1024 * 1024) { ignored++; continue; }
      try { recorded[id] = await new Promise(function (resolve, reject) { var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.onerror = reject; r.readAsDataURL(file); }); loaded++; } catch (err) { ignored++; }
    }
    setStatus(Object.keys(recorded).length + ' passende Aufnahmen geladen' + (ignored ? ' · ' + ignored + ' Dateien übersprungen' : '') + '. Fehlende Einsätze: Browser-Probestimme.');
  });
  $('km-audio-test').addEventListener('click', function () { soundOn = true; actx(); say([{ id: 'kom.cast' }]); });
  $('km-audio-stop').addEventListener('click', stopVoice);
  $('km-audio-catalog').innerHTML = Object.keys(CLIPS).map(function (id) { return '<div class="km-clip"><code>' + id + '.mp3</code><p>' + esc(CLIPS[id]) + '</p></div>'; }).join('');

  /* ---------- Zustand ---------- */
  var setup = { names: ['Papa', 'Mama', 'Mia', 'Ben', 'Oma', 'Opa'], level: 'kinder', caseId: 'zufall' };
  (function () { var s = store('alibi-setup-v1'); if (s) { try { var o = JSON.parse(s); if (Array.isArray(o.names) && o.names.length >= 4) setup.names = o.names.slice(0, 8); if (E.LEVELS[o.level]) setup.level = o.level; if (o.caseId) setup.caseId = o.caseId; } catch (e) { } } })();
  var S = { W: null, phase: 'setup', overlay: null };
  var timer = null;
  function resetFlow() {
    S.caseDef = null; S.claims = []; S.order = []; S.ord = 0; S.stmtSub = 'intro'; S.castIdx = 0; S.castShown = false; S.passIdx = 0; S.passShown = false;
    S.round = 1; S.spuren = []; S.spurShown = 0; S.roundSub = 'talk'; S.talkLeft = 0; S.talkRun = false; S.prompt = 0; S.duel = null; S.details = {};
    S.voteSub = 'ready'; S.count = 0; S.sel = []; S.accused = null; S.cleared = []; S.attempt = 1; S.revealSub = 'ask'; S.draft = { place: null, comp: [] }; S.awards = null; S.mtoken = 0; S.finalCaught = null;
  }
  resetFlow();

  function L() { return E.LEVELS[S.W.level]; }
  function recorded_() { return S.claims.filter(function (c) { return c; }).length; }
  function allRecorded() { return recorded_() === S.W.N; }

  /* ---------- Bausteine ---------- */
  function bar(label) {
    return '<div class="km-bar"><span class="km-phase">' + esc(label) + '</span><div class="km-tools"><button class="km-ico" data-a="sound" aria-pressed="' + soundOn + '" aria-label="Ton ' + (soundOn ? 'ausschalten' : 'einschalten') + '">' + (soundOn ? '🔊' : '🔇') + '</button>' +
      '<button class="km-ico" data-a="rules" aria-label="Regeln lesen">📖</button>' + (S.W ? '<button class="km-ico" data-a="cast" aria-label="Besetzung ansehen">🎭</button><button class="km-ico" data-a="quit" aria-label="Neues Spiel">↺</button>' : '') + '</div></div>';
  }
  function chips(ch) { return '<span class="km-chip"><i style="background:' + (COLORS[ch.fam] || '#999') + '"></i>' + esc(ch.fam) + '</span><span class="km-chip">' + esc(ch.szc) + '</span><span class="km-chip">' + esc(ch.spc) + '</span><span class="km-chip">' + esc(ch.gdr) + '</span>'; }
  function polaroid(i, o) {
    o = o || {}; var p = P(i), cls = 'km-pol' + (o.sel ? ' sel' : '') + (o.dim ? ' dim' : '') + (o.cleared ? ' cleared' : '');
    var tag = o.click ? 'button type="button" data-pid="' + i + '"' + (o.dis ? ' disabled' : '') + (o.sel ? ' aria-pressed="true"' : '') : 'div';
    return '<' + tag + ' class="' + cls + '" aria-label="' + esc(p.ch.n + ', gespielt von ' + p.name) + '">' + (o.cleared ? '<span class="km-stamp mini">unschuldig</span>' : '') + '<span class="im"><img src="' + img(p.ch) + '" alt="" loading="lazy"></span><span class="cap">' + esc(p.ch.n) + '</span><span class="who">' + esc(p.name) + '</span>' + (o.chips ? '<span class="chips">' + chips(p.ch) + '</span>' : '') + '</' + (o.click ? 'button' : 'div') + '>';
  }
  function pgrid(ids, f) { return '<div class="km-grid">' + ids.map(function (i) { return polaroid(i, f(i)); }).join('') + '</div>'; }
  function explain(title, html, rule) { HELP.innerHTML = '<div class="eb">Was hier passiert</div><h4>' + esc(title) + '</h4>' + html + (rule ? '<div class="rule">' + rule + '</div>' : ''); }
  function kom(t) { return '<div class="km-say"><span class="who">Kommissar Tavi</span>' + t + '</div>'; }
  function ids() { return S.W.players.map(function (p) { return p.id; }); }
  function mini(i) { return '<img class="km-av" src="' + img(P(i).ch) + '" alt="' + esc(P(i).ch.n) + '" title="' + esc(P(i).ch.n) + '">'; }

  /* ---------- Tafel (öffentliches Protokoll) ---------- */
  function matchesSpuren(i) { return S.spuren.slice(0, S.spurShown).every(function (sp) { return E.matches(P(i).ch, sp); }); }
  function tafel(o) {
    o = o || {}; var W = S.W, conf = (L().flags && recorded_() >= 2) ? E.conflicts(W, S.claims) : [], bad = {};
    conf.forEach(function (c) { bad[c.t + ':' + c.a] = 1; bad[c.t + ':' + c.b] = 1; });
    var vouchless = (L().flags && allRecorded()) ? E.unvouched(W, S.claims, TC) : [];
    var h = '<div class="km-tafel" role="table" aria-label="Protokoll der Aussagen"><div class="km-trow head" role="row"><span class="c0"></span>' + C.SLOTS.map(function (s) { return '<span class="c" role="columnheader">' + s.icon + '<small>' + s.name + '</small></span>'; }).join('') + '</div>';
    W.players.forEach(function (p) {
      var cl = S.claims[p.id], dim = !matchesSpuren(p.id), isCleared = S.cleared.indexOf(p.id) >= 0;
      h += '<div class="km-trow' + (dim ? ' dim' : '') + (o.hi === p.id ? ' hi' : '') + '" role="row"><span class="c0"><img src="' + img(p.ch) + '" alt=""><b>' + esc(p.ch.n) + '</b>' + (isCleared ? '<em class="ok">✓ unschuldig</em>' : vouchless.indexOf(p.id) >= 0 ? '<em class="warn">ohne Zeugen um Mitternacht</em>' : '<em>' + esc(p.name) + '</em>') + '</span>';
      for (var t = 0; t < 3; t++) {
        if (!cl) { h += '<span class="c empty" role="cell">–</span>'; continue; }
        var cc = cl[t], pl = place(cc.place);
        h += '<span class="c' + (bad[t + ':' + p.id] ? ' bad' : '') + '" role="cell"><span class="pl" title="' + esc(pl.name) + '">' + pl.icon + '</span><small>' + esc(pl.short) + '</small><span class="avs">' + (cc.comp.length ? cc.comp.map(mini).join('') : '<em>allein</em>') + '</span></span>';
      }
      h += '</div>';
    });
    h += '</div>';
    if (conf.length) h += '<div class="km-flags"><b>⚠️ Widersprüche im Protokoll</b>' + conf.map(function (c) { return '<p>' + C.SLOTS[c.t].icon + ' ' + C.SLOTS[c.t].name + ': ' + pname(c.a) + ' und ' + pname(c.b) + ' erzählen nicht dasselbe.</p>'; }).join('') + '</div>';
    return h;
  }

  /* ---------- Darstellung ---------- */
  function render() {
    if (S.press) { S.deferred = true; return; }
    var G = S.W;
    STAGE.className = 'km-stage' + (S.phase === 'end' ? ' km-end' : '');
    if (!G) renderSetup();
    else ({ cast: renderCast, caseIntro: renderCaseIntro, dossier: renderDossier, stmts: renderStmts, round: renderRound, vote: renderVote, reveal: renderReveal, end: renderEnd })[S.phase]();
    renderOverlay();
  }

  function renderSetup() {
    var names = cleanNames(), N = names.length, lv = E.LEVELS[setup.level];
    var LV = { kinder: ['Kinder-Fall', 'ab 7', 'Jeder hat einen Zeugen, nur der Täter nicht. Das Protokoll zeigt Widersprüche an. Zwei Spuren.'], detektiv: ['Detektiv', 'ab 10', 'Ein Unschuldiger hat ebenfalls keinen Zeugen. Keine Hilfen, zwei Spuren.'], meister: ['Meisterdetektiv', 'Erwachsene', 'Zwei Unschuldige ohne Zeugen, keine Hilfen, drei Spuren, kürzere Verhöre.'] };
    var opts = '<option value="zufall"' + (setup.caseId === 'zufall' ? ' selected' : '') + '>Zufälliger Fall</option>' + C.CASES.map(function (c) { return '<option value="' + c.id + '"' + (setup.caseId === c.id ? ' selected' : '') + '>' + esc(c.title) + '</option>'; }).join('');
    STAGE.innerHTML = bar('Vorbereitung') +
      '<div class="km-center"><h2 class="km-title">Wer spielt mit?</h2><p class="km-sub">4 bis 8 Spieler an einem Handy. Jeder bekommt zufällig eine Talea-Figur mit eigener Geschichte und eigener Stimme.</p></div>' +
      '<div class="km-center"><div class="km-names">' + setup.names.map(function (n, i) { return '<div class="km-nrow"><input id="nm' + i + '" value="' + esc(n) + '" aria-label="Spieler ' + (i + 1) + '" maxlength="14" placeholder="Name" autocomplete="off"><button class="x" data-a="rm" data-i="' + i + '" aria-label="Spieler ' + (i + 1) + ' entfernen"' + (setup.names.length <= 4 ? ' disabled' : '') + '>✕</button></div>'; }).join('') + '</div><button class="km-mini" data-a="add"' + (setup.names.length >= 8 ? ' disabled' : '') + '>+ Spieler</button></div>' +
      '<div class="km-center"><span class="km-lbl">Schwierigkeit</span><div class="km-seg" role="radiogroup" aria-label="Schwierigkeit">' + Object.keys(LV).map(function (k) { return '<button role="radio" data-level="' + k + '" aria-checked="' + (k === setup.level) + '"><span>' + LV[k][0] + '</span><span class="age">' + LV[k][1] + '</span><small>' + LV[k][2] + '</small></button>'; }).join('') + '</div></div>' +
      '<div class="km-center"><label class="km-lbl" for="caseSel">Der Fall</label><select id="caseSel" class="km-select">' + opts + '</select></div>' +
      '<div class="km-center"><details class="km-short"' + (store('alibi-seen-v1') ? '' : ' open') + '><summary>So funktioniert das Rätsel</summary><ol>' +
      '<li><b>Besetzung:</b> Jeder bekommt zufällig eine Figur. Ihre Kurzgeschichte und ihre Stimme gehören ab jetzt zu dir.</li>' +
      '<li><b>Fall:</b> Kommissar Tavi erzählt, was in dieser Nacht gestohlen wurde. Einer von euch war es.</li>' +
      '<li><b>Akten:</b> Das Handy geht reihum. Jeder liest allein, wo er am Abend, um Mitternacht und im Morgengrauen war und wer dabei war. Der Täter war um Mitternacht allein am Tatort.</li>' +
      '<li><b>Aussagen:</b> Jeder erzählt seinen Abend. Alle sagen die Wahrheit, nur der Täter lügt und muss sich ein Alibi ausdenken.</li>' +
      '<li><b>Kreuzverhör:</b> Vergleicht die Aussagen, stellt Fragen, prüft Einzelheiten. Das Labor liefert Spuren zum Täter.</li>' +
      '<li><b>Anklage:</b> Auf „Zeigt!“ zeigen alle auf den Täter.</li></ol></details></div>' +
      '<div class="km-row"><button class="km-btn big" data-a="begin">Besetzung auslosen</button></div>' +
      '<div class="km-center"><button class="km-mini" data-a="rules">📖 Alle Regeln lesen</button></div>';
    explain('Vorbereitung', '<p>Gebt eure Namen ein und wählt die Schwierigkeit. Für die erste Runde empfehle ich den <b>Kinder-Fall</b>, auch für Erwachsene.</p><p>' + N + ' Spieler: ' + (N <= 6 ? '5' : '6') + ' Orte, ' + lv.spuren + ' Spuren aus dem Labor.</p>', 'Niemand muss Spielleiter sein. Kommissar Tavi führt durch den Abend.');
  }
  function cleanNames() {
    var seen = {}, out = [];
    setup.names.forEach(function (n) { n = (n || '').trim().slice(0, 14); if (!n) return; var base = n, k = 2; while (seen[n.toLowerCase()]) n = base + ' ' + k++; seen[n.toLowerCase()] = 1; out.push(n); });
    return out;
  }

  /* --- Besetzung --- */
  function renderCast() {
    var W = S.W, h = bar('Die Besetzung');
    if (S.castIdx >= W.N) {
      h += '<div class="km-center"><h2 class="km-title">Die Besetzung steht</h2><p class="km-sub">Das sind eure Verdächtigen. Merkt euch die Gesichter und die Stimmen.</p></div>' + pgrid(ids(), function () { return { chips: false }; }) + '<div class="km-row"><button class="km-btn big" data-a="toCase">Zum Fall</button></div>';
      STAGE.innerHTML = h; explain('Die Besetzung', '<p>Alle Figuren sind öffentlich. Jede Figur hat eine Kennfarbe, eine Größe, eine Art und ein Geschlecht. Diese Merkmale brauchst du später für die Spuren.</p>', 'Tippt auf 🎭, um die Besetzung jederzeit nachzuschlagen.'); return;
    }
    var i = S.castIdx, p = W.players[i];
    if (!S.castShown) h += '<div class="km-center" style="padding-top:18px"><div class="km-deck" aria-hidden="true">🃏</div><h2 class="km-title">Für ' + esc(p.name) + ' wird gezogen …</h2><div class="km-row"><button class="km-btn big" data-a="castShow">Figur ziehen</button></div></div>';
    else h += '<div class="km-center"><h2 class="km-title">' + esc(p.name) + ' spielt …</h2><div class="km-bigcard"><img src="' + img(p.ch) + '" alt="' + esc(p.ch.n) + '"><div class="cname">' + esc(p.ch.n) + '</div><div class="chips">' + chips(p.ch) + '</div><p class="story">' + esc(p.ch.story) + '</p></div>' + kom('„' + esc(p.ch.intro) + '“') + '<div class="km-row"><button class="km-btn" data-a="castNext">' + (i < W.N - 1 ? 'Nächste Figur' : 'Alle ansehen') + '</button></div></div>';
    STAGE.innerHTML = h;
    explain('Die Besetzung', '<p>Der Zufall teilt jedem eine Figur zu. Die Figur stellt sich in ihrer eigenen Stimme vor, und ihre Kurzgeschichte gehört ab jetzt zu deiner Rolle.</p>', 'Spielt eure Figur! Redet wie sie, reagiert wie sie. Das macht den Abend lustig.');
  }

  /* --- Fall --- */
  function renderCaseIntro() {
    var W = S.W, cd = S.caseDef, h = bar('Der Fall');
    h += '<div class="km-file"><div class="km-tape"></div><div class="km-casestamp">FALL</div><h2 class="km-casetitle">' + esc(cd.title) + '</h2><p class="km-loot">Gestohlen: <b>' + esc(cd.loot) + '</b></p>' +
      '<p class="km-scene">Tatort: ' + place(W.crimePlace).icon + ' ' + esc(place(W.crimePlace).name) + '<br>Tatzeit: ' + C.SLOTS[TC].icon + ' ' + C.SLOTS[TC].name + '</p>' +
      '<div class="km-map" aria-label="Die Orte">' + W.places.map(function (pid) { var pl = place(pid); return '<span class="km-tile' + (pid === W.crimePlace ? ' crime' : '') + '"><b>' + pl.icon + '</b><small>' + esc(pl.short) + '</small></span>'; }).join('') + '</div>' +
      '<div class="km-times">' + C.SLOTS.map(function (s) { return '<span>' + s.icon + ' ' + s.name + ' <small>' + s.time + '</small></span>'; }).join('') + '</div></div>' +
      '<div class="km-onair"><i></i> Kommissar Tavi spricht</div><p class="km-sub">' + esc(cd.intro) + '</p><div class="km-row"><button class="km-btn big" data-a="toDossier">Akten verteilen</button></div>';
    STAGE.innerHTML = h;
    explain('Der Fall', '<p>In dieser Nacht ist etwas verschwunden. Alle Verdächtigen waren an drei Zeitpunkten an irgendeinem der Orte. Um Mitternacht war nur der Täter am Tatort, und er war allein.</p>', 'Merkt euch: Es gibt <b>drei Zeitpunkte</b> und <b>' + W.places.length + ' Orte</b>. Wer am selben Ort war, hat sich gesehen.');
  }

  /* --- Akten (privat) --- */
  function rowHtml(i, t, o) {
    var W = S.W, pid = W.pos[i][t], pl = place(pid), comp = W.comp[i][t], qa = C.DETAILS[pid][t][S.details[t][pid]];
    var isCrime = (i === W.culprit && t === TC);
    if (isCrime) return '<div class="km-arow crime"><div class="when">' + C.SLOTS[t].icon + ' ' + C.SLOTS[t].name + '</div><div class="what"><b>TATORT: ' + pl.icon + ' ' + esc(pl.name) + '</b><span>Du warst allein hier und hast ' + esc(S.caseDef.loot) + ' mitgenommen.</span><small>Was du dort bemerkt hast: ' + esc(qa.a) + '</small></div></div>';
    return '<div class="km-arow"><div class="when">' + C.SLOTS[t].icon + ' ' + C.SLOTS[t].name + '</div><div class="what"><b>' + pl.icon + ' ' + esc(pl.name) + '</b><span>' + (comp.length ? 'Mit: ' + esc(comp.map(function (c) { return P(c).ch.n; }).join(', ')) : 'Du warst allein.') + '</span><small>Falls jemand fragt: ' + esc(qa.q) + ' – ' + esc(qa.a) + '.</small></div></div>';
  }
  function renderDossier() {
    var W = S.W, p = W.players[S.passIdx], h = bar('Akten');
    if (!S.passShown) h += '<div class="km-center" style="padding-top:20px"><h2 class="km-title">Gib das Handy an ' + esc(p.name) + '</h2><p class="km-sub">Nur ' + esc(p.name) + ' schaut hin. Alle anderen gucken weg.</p><div class="km-row"><button class="km-btn big" data-a="dossierShow">Ich bin ' + esc(p.name) + '</button></div></div>';
    else {
      var cul = p.id === W.culprit;
      h += '<div class="km-dossier"><div class="km-stamp big">Streng geheim</div><div class="head"><img src="' + img(p.ch) + '" alt=""><div><h3>' + esc(p.ch.n) + '</h3><small>gespielt von ' + esc(p.name) + '</small><div class="chips">' + chips(p.ch) + '</div></div></div>' +
        '<p class="story">' + esc(p.ch.story) + '</p><p class="quirk">Rollenspiel-Tipp: ' + esc(p.ch.q.charAt(0).toUpperCase() + p.ch.q.slice(1)) + '.</p>' +
        (cul ? '<div class="km-role bad"><b>Du bist der Täter.</b> Du warst um Mitternacht allein am Tatort. Alle anderen sagen die Wahrheit, nur du lügst. Dein Alibi legst du fest, wenn du an der Reihe bist. Tipp: Hör den anderen gut zu.</div>' : '<div class="km-role"><b>Du bist unschuldig.</b> Sag die Wahrheit, achte auf Widersprüche und hilf, den Täter zu finden.</div>') +
        '<h4>Dein Abend</h4>' + [0, 1, 2].map(function (t) { return rowHtml(p.id, t); }).join('') + '</div>' +
        '<div class="km-row"><button class="km-btn" data-a="dossierNext">Verdecken und ' + (S.passIdx < W.N - 1 ? 'weitergeben' : 'in die Mitte legen') + '</button></div>';
    }
    STAGE.innerHTML = h;
    explain('Die Akte', '<p>Das Handy geht reihum. Lies deinen Abend genau: Ort, Begleitung und die kleine Einzelheit, die nur Anwesende kennen.</p><p>Wenn dich später jemand fragt, was am Ort los war, antwortest du mit dieser Einzelheit.</p>', 'Prägt euch alles ein. Gleich müsst ihr es erzählen, ohne auf das Handy zu schauen.');
  }

  /* --- Aussagen --- */
  function renderStmts() {
    var W = S.W, i = S.order[S.ord], p = W.players[i], h = bar('Zeugenstand ' + (S.ord + 1) + ' von ' + W.N);
    if (S.stmtSub === 'intro') {
      h += '<div class="km-center"><h2 class="km-title">Zeugenstand</h2><div style="max-width:200px;width:100%">' + polaroid(i, { chips: true }) + '</div>' + kom('„' + esc(p.ch.stmt) + '“') +
        '<p class="km-sub">' + esc(p.name) + ', nimm das Handy und lies deine Aussage noch einmal.</p><div class="km-row"><button class="km-btn big" data-a="stmtOpen">Zeugenstand betreten</button></div></div>';
    } else if (S.stmtSub === 'private') {
      var cul = i === W.culprit, d = S.draft;
      h += '<div class="km-dossier"><div class="km-stamp big">Streng geheim</div><div class="head"><img src="' + img(p.ch) + '" alt=""><div><h3>' + esc(p.ch.n) + '</h3><small>Deine Aussage</small></div></div>';
      [0, 1, 2].forEach(function (t) {
        if (cul && t === TC) {
          var claimed = {}; S.claims.forEach(function (c) { if (c) claimed[c[TC].place] = (claimed[c[TC].place] || 0) + 1; });
          h += '<div class="km-arow crime"><div class="when">' + C.SLOTS[t].icon + ' ' + C.SLOTS[t].name + '</div><div class="what"><b>Dein Alibi (frei gewählt)</b><span>Wo warst du angeblich? Hinter jedem Ort steht, wie viele Zeugen bisher behauptet haben, dort gewesen zu sein.</span>' +
            '<div class="km-places">' + W.places.filter(function (x) { return x !== W.crimePlace; }).map(function (x) { var pl = place(x); return '<button class="km-pbtn' + (d.place === x ? ' sel' : '') + '" data-a="draftPlace" data-v="' + x + '"><b>' + pl.icon + '</b>' + esc(pl.short) + '<small>' + (claimed[x] ? claimed[x] + ' genannt' : 'niemand') + '</small></button>'; }).join('') + '</div>' +
            '<span>Mit wem? (nicht nötig)</span><div class="km-comp">' + ids().filter(function (x) { return x !== i; }).map(function (x) { return '<button class="km-cbtn' + (d.comp.indexOf(x) >= 0 ? ' sel' : '') + '" data-a="draftComp" data-v="' + x + '">' + mini(x) + esc(P(x).ch.n) + '</button>'; }).join('') + '</div>' +
            '<small class="sum">' + (d.place ? 'Du sagst: „Um Mitternacht war ich ' + esc(place(d.place).at) + (d.comp.length ? ', zusammen mit ' + esc(list(d.comp.map(function (x) { return P(x).ch.n; }))) : ', allein') + '.“' : 'Wähle einen Ort.') + '</small></div></div>';
        } else {
          var pid = W.pos[i][t], pl = place(pid), comp = W.comp[i][t], qa = C.DETAILS[pid][t][S.details[t][pid]];
          h += '<div class="km-arow"><div class="when">' + C.SLOTS[t].icon + ' ' + C.SLOTS[t].name + '</div><div class="what"><b>' + pl.icon + ' ' + esc(pl.name) + '</b><span>' + (comp.length ? 'Mit: ' + esc(comp.map(function (c) { return P(c).ch.n; }).join(', ')) : 'Allein.') + '</span><small>' + esc(qa.q) + ' – ' + esc(qa.a) + '.</small></div></div>';
        }
      });
      h += '</div><div class="km-row"><button class="km-btn big" data-a="stmtSubmit"' + (cul && !d.place ? ' disabled' : '') + '>Aussage ablegen</button></div>';
    } else {
      h += '<div class="km-center"><h2 class="km-title">Aussage notiert</h2></div>' + tafel({ hi: i }) + kom(esc(p.ch.n) + ', erzähle jetzt deinen Abend laut und mit Einzelheiten. Die anderen dürfen nachfragen.') + '<div class="km-row"><button class="km-btn big" data-a="stmtNext">' + (S.ord < W.N - 1 ? 'Nächster Zeuge' : 'Zum Kreuzverhör') + '</button></div>';
    }
    STAGE.innerHTML = h;
    explain('Die Aussagen', S.stmtSub === 'noted' ? '<p>Das Protokoll zeigt, was jeder <b>behauptet</b>. Es zeigt nicht, ob es stimmt.</p>' : '<p>Jeder Zeuge liest seinen Abend allein, legt dann die Aussage ab und erzählt sie anschließend laut mit den Einzelheiten aus seiner Akte.</p>', 'Der Täter wählt sein Alibi erst jetzt, nachdem er die anderen gehört hat. Wer später dran ist, weiß mehr.');
  }

  /* --- Kreuzverhör --- */
  function mmss(n) { var mm = Math.floor(n / 60), ss = n % 60; return mm + ':' + (ss < 10 ? '0' : '') + ss; }
  function newPrompt() { S.prompt = Math.floor(Math.random() * C.PROMPTS.length); var d = []; for (var t = 0; t < 3; t++) d = d.concat(E.duels(S.W, S.claims, t, Math.random)); S.duel = d.length ? d[Math.floor(Math.random() * d.length)] : null; }
  function renderRound() {
    var W = S.W, h = bar('Kreuzverhör ' + S.round + ' von ' + L().spuren);
    if (S.roundSub === 'talk') {
      h += '<div class="km-center"><div class="km-clock' + (S.talkLeft <= 10 && S.talkRun ? ' low' : '') + '" id="tmr">' + mmss(S.talkLeft) + '</div><div class="km-row"><button class="km-btn ghost" data-a="talkToggle">' + (S.talkRun ? 'Pause' : (S.talkLeft === 0 ? 'Zeit ist um' : 'Uhr starten')) + '</button></div></div>' +
        tafel() + spurPanel() +
        '<div class="km-card"><span class="km-lbl">Fragekarte</span><p>' + esc(C.PROMPTS[S.prompt]) + '</p>' +
        (S.duel ? '<span class="km-lbl" style="margin-top:8px">Zeugen-Duell</span><p>' + place(S.duel.place).icon + ' ' + C.SLOTS[S.duel.t].icon + ' <b>' + esc(list(S.duel.who.map(function (x) { return P(x).ch.n; }))) + '</b> behaupten, ' + esc(place(S.duel.place).at) + ' gewesen zu sein (' + C.SLOTS[S.duel.t].name + '). Alle antworten gleichzeitig auf drei: <i>' + esc(C.DETAILS[S.duel.place][S.duel.t][S.details[S.duel.t][S.duel.place]].q) + '</i></p>' : '') +
        '<button class="km-mini" data-a="newPrompt">Neue Karte</button></div>' +
        '<div class="km-row"><button class="km-btn big" data-a="getSpur">' + (S.round < L().spuren ? 'Spur anfordern' : 'Letzte Spur anfordern') + '</button>' + (S.spurShown >= 1 ? '<button class="km-btn ghost" data-a="toVote">Jetzt anklagen</button>' : '') + '</div>';
    } else {
      var sp = S.spuren[S.spurShown - 1];
      h += '<div class="km-center"><h2 class="km-title">Spur ' + S.spurShown + ' von ' + L().spuren + '</h2></div><div class="km-lab"><div class="km-stamp big gold">Laborbericht</div><p class="txt">' + esc(C.KOM['kom.spur.' + sp.k + '.' + sp.v]) + '</p><p class="chip-line">' + C.SPUR_LABEL[sp.k] + ': <b>' + esc(sp.v) + '</b></p></div>' + tafel() + spurPanel() +
        '<div class="km-row"><button class="km-btn big" data-a="afterSpur">' + (S.round < L().spuren ? 'Nächste Verhörrunde' : 'Zur Anklage') + '</button>' + (S.round < L().spuren ? '<button class="km-btn ghost" data-a="toVote">Jetzt anklagen</button>' : '') + '</div>';
    }
    STAGE.innerHTML = h;
    explain('Kreuzverhör', '<p>Schaut ins Protokoll: Wer war wann wo und mit wem? Wenn zwei Aussagen nicht zusammenpassen, lügt mindestens einer.</p><p><b>Trick:</b> Wer um Mitternacht von niemandem genannt wird, hat keinen Zeugen. Die Figuren aus den Spuren, die nicht passen, werden im Protokoll abgeblendet.</p>', L().flags ? 'Im Kinder-Fall markiert das Protokoll Widersprüche und Personen ohne Zeugen selbst.' : 'Auf dieser Stufe markiert das Protokoll nichts. Ihr müsst die Widersprüche selbst finden.');
  }
  function spurPanel() {
    if (!S.spurShown) return '<div class="km-spurs empty">Noch keine Spuren. Nach jeder Verhörrunde meldet das Labor eine.</div>';
    return '<div class="km-spurs"><b>Spuren bisher</b>' + S.spuren.slice(0, S.spurShown).map(function (sp) { return '<span class="km-chip gold">' + C.SPUR_LABEL[sp.k] + ': ' + esc(sp.v) + '</span>'; }).join('') + '</div>';
  }

  /* --- Anklage --- */
  function renderVote() {
    var W = S.W, h = bar('Anklage');
    function g() { return pgrid(ids(), function (i) { var ok = S.cleared.indexOf(i) < 0; return { click: true, dis: !ok, dim: !ok, sel: S.sel.indexOf(i) >= 0, cleared: !ok }; }); }
    if (S.voteSub === 'ready') h += '<div class="km-center" style="padding-top:12px"><h2 class="km-title">Wer war es?</h2><p class="km-sub">' + (S.attempt === 2 ? 'Zweite und letzte Anklage. Sprecht euch noch einmal ab.' : 'Besprecht euch noch kurz. Dann zählt Tavi runter, und alle zeigen gleichzeitig auf den Täter.') + '</p>' + spurPanel() + '<div class="km-row"><button class="km-btn big" data-a="startCount">Los: Drei, zwei, eins …</button></div></div>';
    else if (S.voteSub === 'count') h += '<div class="km-center" style="padding-top:36px"><div class="km-count" id="cnt">' + (S.count || '') + '</div><p class="km-sub">Finger bereit!</p></div>';
    else h += '<div class="km-center"><div class="km-zeigt">ZEIGT!</div><div class="km-instr">Wer hat die meisten Finger?</div></div>' + g() + '<div class="km-row"><button class="km-btn" data-a="accuse"' + (S.sel.length === 1 ? '' : ' disabled') + '>' + (S.sel.length === 1 ? esc(P(S.sel[0]).ch.n) + ' anklagen' : 'Anklagen') + '</button><button class="km-btn ghost" data-a="tie">Gleichstand: noch einmal zeigen</button></div>';
    STAGE.innerHTML = h;
    explain('Die Anklage', '<p>Das Zeigen passiert am Tisch. Danach tippt jemand an, wer die meisten Finger hat.</p><ul><li>' + (L().flags ? 'Die erste Anklage darf falsch sein: Es gibt eine zweite.' : 'Es gibt nur <b>eine</b> Anklage. Falsch heißt: Der Täter entkommt.') + '</li><li>Gleichstand: einfach noch einmal zeigen.</li></ul>', 'Wer um Mitternacht keinen Zeugen hat und zu den Spuren passt, ist verdächtig.');
  }

  /* --- Enthüllung --- */
  function renderReveal() {
    var W = S.W, p = P(S.accused), kob = S.accused === W.culprit, m = S.revealSub, h = bar('Enthüllung');
    var front = '<div class="km-face front"><img src="' + img(p.ch) + '" alt=""><div class="cname">' + esc(p.ch.n) + '</div><small>' + esc(p.name) + '</small></div>';
    var back = '<div class="km-face back ' + (kob ? 'bad' : 'ok') + '"><img src="' + img(p.ch) + '" alt=""><div class="cname">' + esc(p.ch.n) + '</div><small>' + esc(p.name) + '</small><div class="km-stamp slam ' + (kob ? 'red' : 'green') + '">' + (kob ? 'Überführt' : 'Unschuldig') + '</div></div>';
    h += '<div class="km-center"><h2 class="km-title">' + esc(p.ch.n) + ', treten Sie vor.</h2><div class="km-flipwrap"><div class="km-flip' + (m === 'drum' ? ' shaking' : '') + '" id="flip">' + front + back + '</div></div>';
    if (m === 'ask') h += kom('Ist das der Täter?') + '<div class="km-row"><button class="km-btn big" data-a="flip">Karte umdrehen</button></div>';
    else if (m === 'drum') h += '<p class="km-sub">Trommelwirbel …</p>';
    else h += '<div class="km-it"><span class="k">' + esc(p.ch.n) + '</span><div class="km-quote">„' + esc(kob ? p.ch.confess : p.ch.deny) + '“</div></div><div class="km-row"><button class="km-btn big" data-a="afterReveal">' + (kob || S.attempt >= (L().flags ? 2 : 1) ? 'Auflösung' : 'Zweite Anklage') + '</button></div>';
    h += '</div>';
    STAGE.innerHTML = h;
    if (m === 'shown') setTimeout(function () { var f = $('flip'); if (f) f.classList.add('turned'); }, 60);
    explain('Die Enthüllung', m === 'shown' ? (kob ? '<p>Der Täter ist überführt. Er gesteht in der Stimme seiner Figur.</p>' : '<p>Der Angeklagte ist unschuldig und wird im Protokoll entlastet.</p>') : '<p>Gleich dreht sich die Karte um. Trommelwirbel.</p>', '');
  }

  /* --- Ende --- */
  function rebuildHtml() {
    var W = S.W, h = '';
    [0, 1, 2].forEach(function (t) {
      var byPlace = {}; ids().forEach(function (i) { (byPlace[W.pos[i][t]] = byPlace[W.pos[i][t]] || []).push(i); });
      h += '<div class="km-rb"><h5>' + C.SLOTS[t].icon + ' ' + C.SLOTS[t].name + ' · ' + C.SLOTS[t].time + '</h5>' + Object.keys(byPlace).map(function (pid) {
        var pl = place(pid), whoNow = byPlace[pid], qa = C.DETAILS[pid][t][S.details[t][pid]], crime = (pid === W.crimePlace && t === TC);
        return '<div class="km-rbrow' + (crime ? ' crime' : '') + '"><b>' + pl.icon + ' ' + esc(pl.short) + '</b><span>' + whoNow.map(mini).join('') + esc(list(whoNow.map(function (i) { return P(i).ch.n; }))) + '</span><small>' + (crime ? 'Der Täter war allein hier und nahm ' + esc(S.caseDef.loot) + ' mit.' : esc(qa.q) + ' – ' + esc(qa.a) + '.') + '</small></div>';
      }).join('') + '</div>';
    });
    var cl = S.claims[W.culprit][TC];
    h += '<div class="km-it"><span class="k">Das falsche Alibi</span>' + pname(W.culprit) + ' behauptete, um Mitternacht ' + esc(place(cl.place).at) + (cl.comp.length ? ' gewesen zu sein, zusammen mit ' + esc(list(cl.comp.map(function (x) { return P(x).ch.n; }))) : ' gewesen zu sein, allein') + '.</div>';
    return h;
  }
  function renderEnd() {
    var W = S.W, won = S.finalCaught, cu = W.culprit, h = bar('Abspann');
    if (!S.awards) S.awards = makeAwards();
    h += '<div class="km-center"><div class="km-win ' + (won ? 'dorf' : 'kob') + '">' + (won ? 'Fall gelöst!' : 'Der Täter entkommt!') + '</div></div>' +
      kom(esc(won ? S.caseDef.solved : S.caseDef.escaped)) +
      (won ? '' : '<div class="km-it"><span class="k">' + esc(P(cu).ch.n) + '</span><div class="km-quote">„' + esc(P(cu).ch.smug) + '“</div></div>') +
      '<div class="km-center"><div class="km-lbl">Der Täter war</div><div style="max-width:200px;width:100%">' + polaroid(cu, {}) + '</div></div>' +
      '<div class="km-center"><div class="km-lbl">Die Rekonstruktion: was wirklich geschah</div><div class="km-rebuild">' + rebuildHtml() + '</div></div>' +
      '<div class="km-center"><div class="km-lbl">Die Auszeichnungen</div><div class="km-awards">' + W.players.map(function (p) { var a = S.awards[p.id], t = C.traitFor(p.id === cu ? 'culprit' : 'innocent', p.id === cu ? !won : won); return '<div class="km-award"><img src="' + img(p.ch) + '" alt=""><div><div class="tt"><span class="ic">' + a.icon + '</span>' + esc(a.title) + ' · ' + esc(p.name) + ' als ' + esc(p.ch.n) + '</div><div class="ww">' + esc(a.why) + '</div><div class="gr">' + t.icon + ' ' + t.trait + ' +1 (Beispiel für den Avatar): ' + esc(p.name) + ' ' + esc(t.why) + '.</div></div></div>'; }).join('') + '</div></div>' +
      '<div class="km-row"><button class="km-btn" data-a="again">Neuer Fall, gleiche Runde</button><button class="km-btn ghost" data-a="quit">Neue Runde einrichten</button></div>';
    STAGE.innerHTML = h;
    explain('Abspann', '<p>Die Rekonstruktion zeigt, wo jeder wirklich war und welche Einzelheit er dort erlebt hat. Vergleicht sie mit dem falschen Alibi des Täters.</p><p>In der Talea-App würde jetzt jeder Avatar ein kleines Eigenschafts-Update mit Begründung bekommen. Hier sind es nur Beispiele.</p>', 'Spielt gleich noch einen Fall: Besetzung, Täter und Orte werden neu gemischt.');
  }
  function makeAwards() {
    var W = S.W, cu = W.culprit, won = S.finalCaught, out = {}, pool = [
      { icon: '🔎', title: 'Scharfer Blick', why: 'Hat jede Kleinigkeit im Protokoll gesehen.' }, { icon: '🎭', title: 'Beste Rolle', why: 'Hat die Figur bis zum Schluss durchgehalten.' },
      { icon: '🧐', title: 'Detailverliebt', why: 'Hat nach den Einzelheiten gefragt, die niemand erwartet hat.' }, { icon: '🕊️', title: 'Stimme der Vernunft', why: 'Hat Ruhe in die Verhöre gebracht.' },
      { icon: '⏱️', title: 'Schnellster Verdacht', why: 'Hatte schon beim ersten Zeugen eine Meinung.' }, { icon: '☕', title: 'Ruhiger Pol', why: 'Hat zugehört, während andere durcheinanderredeten.' },
      { icon: '🗝️', title: 'Meister der Ausreden', why: 'Hat ein Alibi so erzählt, dass man es fast geglaubt hätte.' }, { icon: '📜', title: 'Protokoll-Profi', why: 'Hat im Protokoll nachgeschaut, bevor jemand fragen konnte.' }
    ];
    var rest = pool.slice().sort(function () { return Math.random() - .5; });
    W.players.forEach(function (p) {
      if (p.id === cu) out[p.id] = won ? { icon: '🪤', title: 'Zerknirschter Täter', why: 'Wurde überführt und hat in der Stimme der Figur gestanden.' } : { icon: '🏴‍☠️', title: 'Meisterdieb', why: 'Ist dem Dorf durch die Finger geschlüpft.' };
      else if (S.cleared.indexOf(p.id) >= 0) out[p.id] = { icon: '😇', title: 'Tapferer Unschuldiger', why: 'Wurde fälschlich angeklagt und hat es mit Würde getragen.' };
      else out[p.id] = rest.shift() || pool[0];
    });
    return out;
  }

  /* --- Overlay: Regeln & Besetzung --- */
  function renderOverlay() {
    if (!S.overlay) { OVER.hidden = true; OVER.innerHTML = ''; return; }
    OVER.hidden = false; OVER.className = 'km-overlay';
    var h = '<div class="km-over" role="dialog" aria-modal="true"><div class="km-row" style="justify-content:space-between;align-items:center"><h2>' + (S.overlay === 'rules' ? 'Die Regeln' : 'Die Besetzung') + '</h2><button class="km-btn ghost" data-a="closeOverlay">Schließen</button></div>';
    if (S.overlay === 'cast' && S.W) h += '<p>Alle Figuren sind öffentlich. Tippt auf eine Figur, um ihre Stimme zu hören.</p><div class="km-grid">' + ids().map(function (i) { return '<div class="km-castcard"><button class="km-pol" data-a="castVoice" data-v="' + i + '">' + '<span class="im"><img src="' + img(P(i).ch) + '" alt=""></span><span class="cap">' + esc(P(i).ch.n) + '</span><span class="who">' + esc(P(i).name) + '</span><span class="chips">' + chips(P(i).ch) + '</span></button><p class="story">' + esc(P(i).ch.story) + '</p></div>'; }).join('') + '</div>';
    else h += rulesHtml();
    OVER.innerHTML = h + '</div>';
  }
  function rulesHtml() {
    return '<div class="km-goldbox"><p><b>Worum geht’s?</b> In Kicherwald ist in der Nacht etwas gestohlen worden. Einer von euch war es. Alle sind Verdächtige und spielen eine Talea-Figur mit eigener Geschichte und Stimme.</p><p><b>Das Dorf gewinnt,</b> wenn es den Täter anklagt. <b>Der Täter gewinnt,</b> wenn er unentdeckt bleibt.</p></div>' +
      '<h3>Das Prinzip: Alibi</h3><p>Es gibt drei Zeitpunkte: <b>Abend, Mitternacht, Morgengrauen</b>. Zu jedem Zeitpunkt war jeder an einem Ort, allein oder mit anderen. Wer am selben Ort war, hat sich gesehen.</p><p>Jeder weiß nur, wo <b>er selbst</b> war und <b>wer dabei war</b>. Um Mitternacht war nur der Täter am Tatort, und zwar allein.</p>' +
      '<h3>Der Ablauf</h3><ol><li><b>Besetzung.</b> Jeder zieht eine Figur. Sie stellt sich in ihrer Stimme vor.</li><li><b>Der Fall.</b> Kommissar Tavi erzählt, was verschwunden ist und wo.</li><li><b>Akten.</b> Das Handy geht reihum. Jeder liest allein seinen Abend: Orte, Begleiter und eine Einzelheit pro Ort. Der Täter liest, dass er allein am Tatort war.</li><li><b>Aussagen.</b> Jeder tritt in den Zeugenstand und erzählt seinen Abend. Alle sagen die Wahrheit. Nur der Täter muss sein Mitternachts-Alibi erfinden: einen Ort und, wenn er will, Begleiter. Er wählt das erst, wenn er an der Reihe ist und die anderen gehört hat.</li><li><b>Kreuzverhör.</b> Vergleicht das Protokoll, stellt Fragen, macht Zeugen-Duelle. Nach jeder Runde meldet das Labor eine Spur zum Täter.</li><li><b>Anklage.</b> Alle zeigen gleichzeitig auf den Täter.</li></ol>' +
      '<h3>So findet ihr den Täter</h3><ul><li><b>Wer hat keinen Zeugen?</b> Jeder Unschuldige wird um Mitternacht von jemandem bestätigt, der mit ihm zusammen war. Der Täter wird von niemandem genannt.</li><li><b>Widersprüche.</b> Sagt jemand „Ich war mit dir im Garten“, und du warst dort mit ganz anderen, dann stimmt eine Aussage nicht. Wer wird von einer dritten Person bestätigt? Der sagt die Wahrheit.</li><li><b>Zeugen-Duell.</b> Wer wirklich an einem Ort war, kennt die Einzelheit dort. Der Täter muss raten.</li><li><b>Spuren.</b> Das Labor nennt Kennfarbe, Größe, Art oder Geschlecht des Täters. Figuren, auf die das nicht passt, werden im Protokoll abgeblendet.</li></ul>' +
      '<h3>Die Stufen</h3><ul><li><b>Kinder-Fall:</b> Das Protokoll markiert Widersprüche und Personen ohne Zeugen. Zwei Spuren, zwei Anklagen.</li><li><b>Detektiv:</b> Auch ein Unschuldiger hat um Mitternacht keinen Zeugen. Keine Markierungen. Zwei Spuren, eine Anklage.</li><li><b>Meisterdetektiv:</b> Zwei Unschuldige ohne Zeugen, drei Spuren, kürzere Verhöre, eine Anklage.</li></ul>' +
      '<h3>Häufige Fragen</h3><details><summary>Darf der Täter lügen?</summary><p>Er muss sogar. Sein Alibi für Mitternacht ist erfunden. Alles andere in seiner Aussage ist wahr.</p></details><details><summary>Lügen die Unschuldigen auch?</summary><p>Nein. Alle Unschuldigen sagen die Wahrheit. Das ist die Grundregel des Rätsels.</p></details><details><summary>Kann man den Täter wirklich immer finden?</summary><p>Ja. Jeder Fall wird vor dem Spiel geprüft: Mit allen Aussagen und Spuren bleibt genau ein Verdächtiger übrig, egal welches Alibi der Täter wählt.</p></details><details><summary>Warum sagt Kommissar Tavi keine Namen?</summary><p>Die Sprecher-Aufnahmen sind vorproduziert. Deshalb stehen Namen auf dem Bildschirm und nicht in der Sprachausgabe.</p></details><details><summary>Was ist mit dem Rollenspiel-Tipp?</summary><p>Jede Figur hat eine Macke. Spielt sie nach, das macht den Abend lustig. Der Tipp verrät nichts über die Schuld.</p></details>';
  }

  /* ---------- Ablauf ---------- */
  function startGame() {
    var names = cleanNames();
    if (names.length < 4) { var p = document.createElement('p'); p.className = 'km-note'; p.textContent = 'Ihr braucht mindestens 4 Spieler mit Namen.'; STAGE.appendChild(p); return; }
    setup.names = names; store('alibi-setup-v1', JSON.stringify(setup)); store('alibi-seen-v1', '1');
    newCase(names); S.phase = 'cast'; render(); say([{ id: 'kom.cast' }]);
  }
  function newCase(names) {
    resetFlow();
    var cd = setup.caseId === 'zufall' ? pick(C.CASES) : (C.CASES.filter(function (c) { return c.id === setup.caseId; })[0] || pick(C.CASES));
    var all = Object.keys(C.PLACES).filter(function (x) { return x !== cd.crime; }), nPl = names.length <= 6 ? 5 : 6;
    var places = [cd.crime].concat(E.shuffle(all, Math.random).slice(0, nPl - 1));
    S.caseDef = cd; S.W = E.generate({ names: names, pool: CHARS, level: setup.level, places: places, crimePlace: cd.crime, rng: Math.random });
    for (var t = 0; t < 3; t++) { S.details[t] = {}; places.forEach(function (x) { S.details[t][x] = Math.floor(Math.random() * 2); }); }
    S.order = E.shuffle(ids(), Math.random);
    S.claims = names.map(function () { return null; });
  }
  function startDossier() { S.phase = 'dossier'; S.passIdx = 0; S.passShown = false; render(); say([{ id: 'kom.dossier.1' }]); }
  function startStmts() { S.phase = 'stmts'; S.ord = 0; S.stmtSub = 'intro'; render(); say([{ id: 'kom.stmt.start' }, { c: P(S.order[0]).ch, k: 'stmt' }]); }
  function submitClaim() {
    var W = S.W, i = S.order[S.ord];
    if (i === W.culprit) S.claims[i] = E.culpritClaim(W, S.draft.place, S.draft.comp); else S.claims[i] = E.truthClaim(W, i);
    S.stmtSub = 'noted'; S.draft = { place: null, comp: [] }; render(); sfx('stamp'); vib(60);
    say([{ id: 'kom.stmt.noted.' + (1 + Math.floor(Math.random() * 3)) }]);
  }
  function nextStmt() {
    if (S.ord < S.W.N - 1) { S.ord++; S.stmtSub = 'intro'; render(); say([{ c: P(S.order[S.ord]).ch, k: 'stmt' }]); return; }
    // alle Aussagen da: Spuren festlegen und Verhör beginnen
    var W = S.W, sp = E.pickSpuren(W, S.claims, L().spuren, Math.random);
    if (!sp) { sp = E.SPUR_KEYS.slice(0, L().spuren).map(function (k) { return { k: k, v: P(W.culprit).ch[k] }; }); }
    S.spuren = sp; S.spurShown = 0; S.round = 1; S.roundSub = 'talk'; S.talkLeft = L().talk; S.talkRun = false; newPrompt();
    S.phase = 'round'; render();
    var parts = [{ id: 'kom.stmt.done' }, { id: 'kom.round.1' }];
    if (L().flags) { var cf = E.conflicts(W, S.claims); if (cf.length) { parts.push({ id: 'kom.einspruch.' + (1 + Math.floor(Math.random() * 3)) }); sfx('sting'); } else if (E.unvouched(W, S.claims, TC).length) parts.push({ id: 'kom.alone' }); }
    say(parts);
  }
  function getSpur() {
    stopTimer(); S.talkRun = false; S.spurShown++; S.roundSub = 'spur'; render(); sfx('stamp'); vib(80);
    var sp = S.spuren[S.spurShown - 1]; say([{ id: 'kom.spur.next' }, { id: 'kom.spur.' + sp.k + '.' + sp.v }]);
  }
  function afterSpur() {
    if (S.round < L().spuren) { S.round++; S.roundSub = 'talk'; S.talkLeft = L().talk; S.talkRun = false; newPrompt(); render(); say([{ id: 'kom.round.' + Math.min(3, S.round) }]); }
    else toVote();
  }
  function toVote() { stopTimer(); S.talkRun = false; S.phase = 'vote'; S.voteSub = 'ready'; S.sel = []; render(); say([{ id: S.attempt === 2 ? 'kom.second' : 'kom.accuse.1' }]); }

  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function startTimer() {
    stopTimer();
    timer = setInterval(function () {
      if (!S.W || S.phase !== 'round' || S.roundSub !== 'talk') { stopTimer(); return; }
      if (S.talkLeft > 0) S.talkLeft--;
      var t = $('tmr'); if (t) { t.textContent = mmss(S.talkLeft); t.classList.toggle('low', S.talkLeft <= 10 && S.talkLeft > 0); }
      if (S.talkLeft > 0 && S.talkLeft <= 10) sfx('tick');
      if (S.talkLeft === 10) say([{ id: 'kom.time.10' }]);
      if (S.talkLeft === 0) { stopTimer(); S.talkRun = false; sfx('gavel'); vib([300]); render(); say([{ id: 'kom.time.up' }]); }
    }, 1000);
  }
  async function startCount() {
    S.voteSub = 'count'; S.count = 3; render(); say([{ id: 'kom.vote' }]);
    for (var n = 3; n >= 1; n--) { S.count = n; var c = $('cnt'); if (c) { c.textContent = n; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; } sfx('knock'); vib(40); await sleep(900); if (S.phase !== 'vote' || S.voteSub !== 'count') return; }
    S.voteSub = 'point'; S.sel = []; render(); sfx('drum'); vib([60, 40, 200]);
  }
  async function doFlip() {
    S.revealSub = 'drum'; render(); sfx('drum'); vib([80, 50, 80, 50, 300]); say([{ id: 'kom.accuse.2' }]);
    await sleep(1700); if (S.phase !== 'reveal') return;
    var W = S.W, kob = S.accused === W.culprit; S.revealSub = 'shown'; render();
    if (kob) { sfx('stamp'); setTimeout(function () { sfx('fanfare'); }, 500); vib([200, 80, 200]); say([{ id: 'kom.guilty' }, { c: P(S.accused).ch, k: 'confess' }]); }
    else { S.cleared.push(S.accused); sfx('stamp'); setTimeout(function () { sfx('sad'); }, 500); vib([300, 100, 300]); say([{ id: 'kom.innocent' }, { c: P(S.accused).ch, k: 'deny' }]); }
  }
  function toEnd(caught) {
    S.finalCaught = caught; S.phase = 'end'; S.awards = null; stopTimer(); render();
    var cd = S.caseDef, parts = caught ? [{ id: 'kom.case.' + cd.id + '.solved' }] : [{ c: P(S.W.culprit).ch, k: 'smug' }, { id: 'kom.case.' + cd.id + '.escaped' }];
    if (caught) sfx('fanfare'); else sfx('sad'); say(parts.concat([{ id: 'kom.rebuild' }]));
  }

  /* ---------- Ereignisse ---------- */
  ROOT.addEventListener('click', function (e) {
    var pc = e.target.closest('[data-pid]'), b = e.target.closest('[data-a],[data-level]');
    if (pc && !pc.disabled) { if (S.phase === 'vote' && S.voteSub === 'point') { var id = +pc.getAttribute('data-pid'); S.sel = (S.sel[0] === id) ? [] : [id]; sfx('pop'); render(); } return; }
    if (!b || b.disabled) return;
    var G = S.W; actx();
    if (b.hasAttribute('data-level')) { readNames(); setup.level = b.getAttribute('data-level'); render(); return; }
    var a = b.getAttribute('data-a');
    switch (a) {
      case 'sound': soundOn = !soundOn; if (!soundOn) stopVoice(); render(); break;
      case 'rules': S.overlay = 'rules'; render(); break;
      case 'cast': S.overlay = 'cast'; render(); break;
      case 'castVoice': say([{ c: P(+b.getAttribute('data-v')).ch, k: 'intro' }]); break;
      case 'closeOverlay': S.overlay = null; render(); break;
      case 'quit': if (S.quitArmed > Date.now() || !G || S.phase === 'end') { stopVoice(); stopTimer(); S.W = null; S.phase = 'setup'; S.quitArmed = 0; resetFlow(); S.overlay = null; render(); } else { S.quitArmed = Date.now() + 3500; b.textContent = '✔'; setTimeout(function () { S.quitArmed = 0; if (b.isConnected) b.textContent = '↺'; }, 3600); } break;
      case 'add': readNames(); if (setup.names.length < 8) setup.names.push(''); render(); break;
      case 'rm': readNames(); setup.names.splice(+b.getAttribute('data-i'), 1); render(); break;
      case 'begin': readNames(); startGame(); break;
      case 'castShow': S.castShown = true; render(); sfx('page'); say([{ c: P(S.castIdx).ch, k: 'intro' }]); break;
      case 'castNext': S.castIdx++; S.castShown = false; render(); if (S.castIdx >= G.N) say([{ id: 'kom.cast.done' }]); else stopVoice(); break;
      case 'toCase': S.phase = 'caseIntro'; render(); sfx('page'); say([{ id: 'kom.case.' + S.caseDef.id + '.intro' }]); break;
      case 'toDossier': startDossier(); break;
      case 'dossierShow': S.passShown = true; sfx('page'); render(); break;
      case 'dossierNext': if (S.passIdx < G.N - 1) { S.passIdx++; S.passShown = false; render(); say([{ id: 'kom.pass.' + (1 + Math.floor(Math.random() * 2)) }]); } else { say([{ id: 'kom.dossier.done' }]); startStmts(); } break;
      case 'stmtOpen': S.stmtSub = 'private'; S.draft = { place: null, comp: [] }; sfx('page'); render(); break;
      case 'draftPlace': S.draft.place = b.getAttribute('data-v'); sfx('pop'); render(); break;
      case 'draftComp': var cid = +b.getAttribute('data-v'), ix = S.draft.comp.indexOf(cid); if (ix >= 0) S.draft.comp.splice(ix, 1); else if (S.draft.comp.length < 3) S.draft.comp.push(cid); sfx('pop'); render(); break;
      case 'stmtSubmit': submitClaim(); break;
      case 'stmtNext': nextStmt(); break;
      case 'talkToggle': if (S.talkLeft === 0) break; S.talkRun = !S.talkRun; if (S.talkRun) startTimer(); else stopTimer(); render(); break;
      case 'newPrompt': newPrompt(); render(); if (S.duel) say([{ id: 'kom.duel' }]); break;
      case 'getSpur': getSpur(); break;
      case 'afterSpur': afterSpur(); break;
      case 'toVote': toVote(); break;
      case 'startCount': startCount(); break;
      case 'tie': S.voteSub = 'ready'; S.sel = []; render(); break;
      case 'accuse': S.accused = S.sel[0]; S.revealSub = 'ask'; S.phase = 'reveal'; render(); break;
      case 'flip': doFlip(); break;
      case 'afterReveal': if (S.accused === G.culprit) toEnd(true); else if (S.attempt >= (L().flags ? 2 : 1)) toEnd(false); else { S.attempt++; toVote(); } break;
      case 'again': stopVoice(); stopTimer(); var nm = G.players.map(function (p) { return p.name; }); setup.names = nm; S.overlay = null; newCase(nm); S.phase = 'cast'; render(); say([{ id: 'kom.cast' }]); break;
    }
  });
  ROOT.addEventListener('pointerdown', function () { S.press = true; clearTimeout(S.pressT); S.pressT = setTimeout(function () { S.press = false; if (S.deferred) { S.deferred = false; render(); } }, 1500); }, true);
  function pressEnd() { S.press = false; clearTimeout(S.pressT); if (S.deferred) setTimeout(function () { if (S.deferred && !S.press) { S.deferred = false; render(); } }, 30); }
  ROOT.addEventListener('pointerup', pressEnd, true); ROOT.addEventListener('pointercancel', pressEnd, true);
  ROOT.addEventListener('input', function (e) { if (e.target.id && e.target.id.indexOf('nm') === 0) setup.names[+e.target.id.slice(2)] = e.target.value; });
  ROOT.addEventListener('change', function (e) { if (e.target.id === 'caseSel') setup.caseId = e.target.value; });
  function readNames() { setup.names = setup.names.map(function (n, i) { var el = $('nm' + i); return el ? el.value : n; }); var cs = $('caseSel'); if (cs) setup.caseId = cs.value; }
  document.addEventListener('visibilitychange', function () { if (document.hidden) { stopVoice(); if (S.talkRun) { S.talkRun = false; stopTimer(); if (S.phase === 'round') render(); } } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.overlay) { S.overlay = null; render(); } });
  if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function () { }; } catch (e) { } }
  render();
  ROOT.taleaTest = { S: S, E: E, C: C, setup: setup, setFast: function (v) { FAST = !!v; ROOT.classList.toggle('fast', FAST); }, render: render, get W() { return S.W; }, say: say, recorded: recorded, CLIPS: CLIPS, CHARS: CHARS };
})();
