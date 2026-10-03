/* Kobold-Nacht: Oberfläche. Nutzt KNEngine (Regeln), KNContent (Texte), KN_CHARS und KN_IMAGES (Daten, vom Build eingefügt). */
(function () {
  'use strict';
  var E = KNEngine, C = KNContent, AB = E.AB;
  C.setAbilities(AB);
  var ROOT = document.getElementById('talea-kichernacht');
  var STAGE = ROOT.querySelector('#stage'), HELP = ROOT.querySelector('#explain'), OVER = ROOT.querySelector('#overlay');
  var CHARS = KN_CHARS, IMG = KN_IMAGES;
  var KICHER = CHARS.filter(function (c) { return c.a === 'kobold'; })[0];
  var POOL = CHARS.filter(function (c) { return c.a !== 'kobold'; });
  var FAST = false;

  /* ---------- Hilfen ---------- */
  function $(id) { return ROOT.querySelector('#' + id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, FAST ? 0 : ms); }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function img(c) { return IMG[c.s] || ('data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#2a3873"/><text x="50" y="64" font-size="46" text-anchor="middle">✨</text></svg>')); }
  function pid(p) { return E.P(S.G, p); }

  /* ---------- Ton ---------- */
  var AC = null, soundOn = true;
  function actx() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) { } } return AC; }
  function tone(f, when, dur, type, vol, to) { var a = actx(); if (!a) return; var t = a.currentTime + when, o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05); }
  function noise(when, dur, vol, cut) { var a = actx(); if (!a) return; var b = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) { d[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(i / (a.sampleRate / 38) * Math.PI * 2)); } var s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut || 900; s.buffer = b; g.gain.value = vol || 0.12; s.connect(f); f.connect(g); g.connect(a.destination); s.start(a.currentTime + when); }
  var SFX = {
    creak: function () { tone(210, 0, .6, 'sawtooth', .045, 70); tone(150, .25, .5, 'sawtooth', .04, 60); },
    croak: function () { tone(140, 0, .2, 'square', .06, 95); tone(130, .26, .24, 'square', .06, 85); tone(150, .56, .2, 'square', .05, 100); },
    drum: function () { noise(0, 1.5, .15); tone(70, 0, .9, 'sine', .12, 50); },
    thud: function () { tone(90, 0, .35, 'sine', .15, 45); noise(0, .2, .1, 400); },
    fanfare: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * .12, .34, 'triangle', .07); }); },
    sad: function () { [392, 370, 349, 294].forEach(function (f, i) { tone(f, i * .28, .4, 'sawtooth', .045); }); },
    chime: function () { tone(880, 0, .3, 'sine', .06); tone(1320, .12, .35, 'sine', .05); },
    owl: function () { tone(420, 0, .35, 'sine', .05, 380); tone(400, .5, .5, 'sine', .05, 330); },
    hat: function () { [660, 880, 990, 1320, 1760].forEach(function (f, i) { tone(f, i * .06, .2, 'triangle', .05); }); },
    tick: function () { tone(1400, 0, .05, 'square', .03); },
    knock: function () { tone(110, 0, .12, 'sine', .14, 60); },
    pop: function () { tone(520, 0, .09, 'triangle', .06, 260); },
    sparkle: function () { [1568, 1976, 2349].forEach(function (f, i) { tone(f, i * .07, .15, 'sine', .03); }); },
    whoosh: function () { noise(0, .5, .08, 2400); }
  };
  function sfx(n) { if (soundOn && !FAST) { try { SFX[n](); } catch (e) { } } }
  function vib(p) { try { if (soundOn && !FAST && navigator.vibrate) navigator.vibrate(p); } catch (e) { } }

  /* ---------- Stimmen ---------- */
  var CLIPS = {};
  Object.keys(C.TAVI).forEach(function (id) { CLIPS[id] = C.TAVI[id]; });
  CHARS.forEach(function (c) { CLIPS['character.' + c.s + '.quote'] = c.p; if (c.a !== 'kobold') CLIPS['character.' + c.s + '.murmur'] = c.p; });
  var recorded = {}, activeAudio = null, seq = 0;
  function stopVoice() { seq++; if (activeAudio) { try { activeAudio.pause(); } catch (e) { } activeAudio = null; } if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) { } } }
  function voices() { try { return window.speechSynthesis.getVoices().filter(function (v) { return /^de/i.test(v.lang); }); } catch (e) { return []; } }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function estimate(t) { return Math.min(4200, 500 + (t || '').length * 42); }
  function say(parts) {
    stopVoice(); var my = seq, i = 0;
    parts = (Array.isArray(parts) ? parts : [parts]).filter(Boolean);
    return new Promise(function (resolve) {
      function next() {
        if (my !== seq) return resolve(false);
        if (i >= parts.length) return resolve(true);
        var p = parts[i++], id = p.id, text = p.text, ch = p.c;
        if (ch) { id = 'character.' + ch.s + (p.murmur ? '.murmur' : '.quote'); text = ch.p; if (p.murmur && !recorded[id]) id = 'character.' + ch.s + '.quote'; }
        if (id && !text) text = C.TAVI[id] || CLIPS[id] || '';
        if (FAST) return next();
        if (!soundOn || !text) return setTimeout(next, estimate(text));
        var finished = false;
        function done() { if (finished) return; finished = true; next(); }
        function fallback() {
          if (my !== seq) return resolve(false);
          if (!('speechSynthesis' in window)) return setTimeout(done, estimate(text));
          try {
            var u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; var vs = voices(); if (vs.length) u.voice = vs[ch ? hash(ch.n) % vs.length : 0];
            if (ch) { var base = ch.g === 'female' ? 1.3 : ch.g === 'male' ? .78 : 1.05; u.pitch = Math.max(.2, Math.min(2, base + ((hash(ch.n) % 30) - 15) / 100)); u.rate = p.murmur ? .78 : .95; if (p.murmur) { u.pitch *= .8; u.volume = .6; } }
            else { u.pitch = 1; u.rate = 1; }
            u.onend = done; u.onerror = done; window.speechSynthesis.speak(u);
            setTimeout(done, estimate(text) + 5000);
          } catch (e) { setTimeout(done, estimate(text)); }
        }
        if (id && recorded[id]) {
          try { activeAudio = new Audio(recorded[id]); activeAudio.onended = done; activeAudio.onerror = fallback; var pr = activeAudio.play(); if (pr && pr.catch) pr.catch(function () { setStatus('Aufnahme konnte nicht abgespielt werden · Browser-Probestimme'); fallback(); }); } catch (e) { fallback(); }
        } else fallback();
      }
      next();
    });
  }
  function setStatus(t) { var s = $('kn-audio-status'); if (s) s.textContent = t; }
  function catalogHtml() { return Object.keys(CLIPS).map(function (id) { return '<div class="kn-clip"><code>' + id + '.mp3</code><p>' + esc(CLIPS[id]) + '</p></div>'; }).join(''); }
  $('kn-audio-files').addEventListener('change', async function (e) {
    stopVoice(); var loaded = 0, ignored = 0;
    for (var file of Array.from(e.target.files)) {
      var id = file.name.replace(/\.(mp3|wav|ogg)$/i, '');
      if (!CLIPS[id] || file.size > 12 * 1024 * 1024) { ignored++; continue; }
      try { recorded[id] = await new Promise(function (resolve, reject) { var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.onerror = reject; r.readAsDataURL(file); }); loaded++; } catch (err) { ignored++; }
    }
    setStatus(Object.keys(recorded).length + ' passende Aufnahmen geladen' + (ignored ? ' · ' + ignored + ' Dateien übersprungen' : '') + '. Fehlende Einsätze: Browser-Probestimme.');
  });
  $('kn-audio-test').addEventListener('click', function () { soundOn = true; actx(); say([{ id: 'tavi.night.1' }]); });
  $('kn-audio-stop').addEventListener('click', stopVoice);
  $('kn-audio-catalog').innerHTML = catalogHtml();

  /* ---------- Zustand ---------- */
  var setup = { names: ['Papa', 'Mama', 'Mia', 'Ben', 'Oma', 'Opa'], level: 'erste', pranks: true };
  (function () { var s = store('kobold-setup-v4'); if (s) { try { var o = JSON.parse(s); if (Array.isArray(o.names) && o.names.length >= 4) setup.names = o.names.slice(0, 9); if (E.LEVELS[o.level]) setup.level = o.level; if (typeof o.pranks === 'boolean') setup.pranks = o.pranks; } catch (e) { } } })();
  var S = { G: null, phase: 'setup', overlay: null, helpOpen: true, quitArmed: 0 };
  function resetFlow() { S.sel = []; S.stepIdx = 0; S.sub = 'call'; S.drawIdx = 0; S.drawShown = false; S.passIdx = 0; S.passShown = false; S.mstage = 0; S.mdone = false; S.mtoken = 0; S.prank = null; S.frogTask = null; S.usedPranks = []; S.voteSub = 'ready'; S.count = 0; S.accused = null; S.revealSub = 'ask'; S.talkLeft = 0; S.talkRun = false; S.redeLeft = 0; S.result = null; S.note = ''; S.nightLine = ''; S.awards = null; S.hitDoors = 0; S.fogShown = false; S.pending = null; }
  resetFlow();
  var timer = null;

  var ABDESC = {
    schluessel: 'Schaut einmal im Spiel (ab der 2. Nacht) bei einem Spieler nach: Kobold oder nicht?',
    laterne: 'Beschützt jede Nacht einen Spieler vor dem Froschzauber, nie zweimal hintereinander denselben.',
    trost: 'Sieht jede Nacht, wen die Kobolde verhexen wollen, und kann einmal im Spiel retten.',
    spur: 'Prüft einmal im Spiel (ab der 2. Nacht) zwei Spieler: Wie viele Kobolde sind darunter, 0, 1 oder 2?',
    honig: 'Stellt einmal im Spiel eine Falle vor ein Haus. Kommen die Kobolde dorthin, platzt der Zauber, und eine Spur führt zu zwei Namen. Einer davon ist ein Kobold.',
    buch: 'Erfährt in der ersten Nacht einen Namen, der sicher zum Dorf gehört.',
    rede: 'Darf einmal im Spiel eine Minute ungestört reden. An diesem Tag zählt der Finger doppelt.',
    glocke: 'Entscheidet bei jedem Gleichstand, wer entlarvt wird.',
    dick: 'Der erste Froschzauber gegen ihn prallt ab.'
  };
  function cleanNames() {
    var seen = {}, out = [];
    setup.names.forEach(function (n) { n = (n || '').trim().slice(0, 14); if (!n) return; var base = n, k = 2; while (seen[n.toLowerCase()]) { n = base + ' ' + k++; } seen[n.toLowerCase()] = 1; out.push(n); });
    return out;
  }

  /* ---------- Bausteine ---------- */
  function doorSvg(on, hit) { return '<svg class="kn-door' + (on ? '' : ' gone') + (hit ? ' hit' : '') + '" viewBox="0 0 24 34" aria-hidden="true"><rect class="b" x="2" y="2" width="20" height="30" rx="5"/><circle class="k" cx="16" cy="18" r="2.8"/></svg>'; }
  function bar(label) {
    var G = S.G, d = '';
    if (G) for (var i = 0; i < G.max; i++) d += doorSvg(i < G.handles, S.hitDoors && i >= G.handles && i < G.handles + S.hitDoors);
    return '<div class="kn-bar"><div class="kn-doors' + (G && G.handles <= 2 ? ' low' : '') + '" role="img" aria-label="Türgriffe: ' + (G ? G.handles : 0) + ' von ' + (G ? G.max : 0) + '">' + d + '</div><span class="kn-phase">' + esc(label) + '</span>' +
      '<div class="kn-tools"><button class="kn-ico" data-a="sound" aria-pressed="' + soundOn + '" aria-label="Ton ' + (soundOn ? 'ausschalten' : 'einschalten') + '">' + (soundOn ? '🔊' : '🔇') + '</button>' +
      '<button class="kn-ico" data-a="rules" aria-label="Alle Regeln lesen">📖</button>' +
      (G ? '<button class="kn-ico" data-a="village" aria-label="Dorf ansehen">🏘️</button><button class="kn-ico" data-a="quit" aria-label="Neues Spiel">' + (S.quitArmed > Date.now() ? '✔' : '↺') + '</button>' : '') + '</div></div>';
  }
  function abLine(p) { var a = AB[p.ab]; return a.i + ' ' + a.name + ' <span class="t">' + (a.when === 'night' ? '🌙 Nacht' : '☀️ Tag') + '</span>'; }
  function pcard(p, o) {
    o = o || {};
    var cls = 'kn-pc' + (p.frog && !o.team ? ' frog' : '') + (p.caught ? ' caught' : '') + (o.dim ? ' dim' : '') + (o.sel ? ' sel' : '');
    var badge = '';
    if (o.team) badge = p.team === 'kobold' ? '<span class="kn-badge kob">Kobold</span>' : '<span class="kn-badge ok">Dorf</span>';
    else if (p.caught) badge = '<span class="kn-badge ok">entzaubert</span>';
    else if (p.frog) badge = '<span class="kn-badge frog">Frosch</span>';
    else if (p.cleared) badge = '<span class="kn-badge ok">✓ unschuldig</span>';
    var tag = o.click ? 'button type="button" data-pid="' + p.id + '"' + (o.dis ? ' disabled' : '') + (o.sel ? ' aria-pressed="true"' : '') : 'div';
    return '<' + tag + ' class="' + cls + '" aria-label="' + esc(p.name + ', ' + p.ch.n + ', ' + AB[p.ab].name) + '">' + badge +
      '<span class="im"><img src="' + img(p.ch) + '" alt="" loading="lazy"></span><span class="pn">' + esc(p.name) + '</span><span class="cn">' + esc(p.ch.n) + '</span>' +
      '<span class="ab">' + abLine(p) + '</span>' + (o.phrase ? '<span class="phr">„' + esc(p.ch.p) + '“</span>' : '') + '</' + (o.click ? 'button' : 'div') + '>';
  }
  function grid(list, f, small) { return '<div class="kn-grid' + (small ? ' small' : '') + '">' + list.map(function (p) { return pcard(p, f(p)); }).join('') + '</div>'; }
  function sayBox(t, who) { return '<div class="kn-say">' + (who ? '<span class="who">' + esc(who) + '</span>' : '') + t + '</div>'; }
  function explain(title, html, rule) { HELP.innerHTML = '<div class="eb">Was hier passiert</div><h4>' + esc(title) + '</h4>' + html + (rule ? '<div class="rule">' + rule + '</div>' : ''); }
  function nameOf(id) { return esc(pid(id).name); }
  function costWord(n) { return n === 1 ? 'einen Türgriff' : n + ' Türgriffe'; }

  /* ---------- Darstellung ---------- */
  function render() {
    if (S.press) { S.deferred = true; return; }
    var G = S.G;
    STAGE.className = 'kn-stage' + ((S.phase === 'night' || S.phase === 'nightIntro') ? ' kn-dark' : '') + (G && S.phase !== 'setup' && S.phase !== 'end' ? (E.mood(G) === 'last' ? ' kn-last' : E.mood(G) === 'tense' ? ' kn-tense' : '') : '');
    if (!G) renderSetup();
    else ({ draw: renderDraw, board: renderBoard, pass: renderPass, nightIntro: renderNightIntro, night: renderNight, morning: renderMorning, day: renderDay, vote: renderVote, reveal: renderReveal, evening: renderEvening, end: renderEnd })[S.phase]();
    renderOverlay();
  }

  function renderSetup() {
    var names = cleanNames(), N = names.length, cfg = E.configFor(setup.level, Math.max(4, N)).rules;
    var info = '<b>' + N + ' Spieler:</b> ' + cfg.kobolds + ' Kobold' + (cfg.kobolds > 1 ? 'e' : '') + ' · ' + cfg.handles + ' Türgriffe · falsche Anklage −' + cfg.wrongCost + (cfg.fogUses ? ' · Streiche: Nebel' + (cfg.imitateUses ? ' und Stimme klauen' : '') : '') + (N <= 4 ? '<br>Mit 4 Spielern gibt es kein Schlüsselloch und keinen Spurenleser.' : '');
    var LV = { erste: ['Erste Partie', 'ab 6', 'Zum Kennenlernen: weniger Kobolde, falsche Anklagen sind nicht so teuer.'], voll: ['Volles Spiel', 'ab 8', 'Mehr Kobolde, Nebel-Streich, falsche Anklagen kosten zwei Türgriffe.'], profi: ['Profi-Nacht', 'ab 10', 'Wie das volle Spiel, dazu Stimme klauen, mehr Nebel und nur 2 Minuten Beratung.'] };
    STAGE.innerHTML = bar('Vorbereitung') +
      '<div class="kn-center"><h2 class="kn-call gold">Wer spielt mit?</h2><p class="kn-sub">4 bis 9 Spieler an einem Handy. Allein kannst du alles mit den Beispielnamen ausprobieren.</p></div>' +
      '<div class="kn-center"><div class="kn-names">' + setup.names.map(function (n, i) { return '<div class="kn-nrow"><input id="nm' + i + '" value="' + esc(n) + '" aria-label="Spieler ' + (i + 1) + '" maxlength="14" placeholder="Name" autocomplete="off"><button class="x" data-a="rm" data-i="' + i + '" aria-label="Spieler ' + (i + 1) + ' entfernen"' + (setup.names.length <= 4 ? ' disabled' : '') + '>✕</button></div>'; }).join('') + '</div>' +
      '<button class="kn-mini" data-a="add"' + (setup.names.length >= 9 ? ' disabled' : '') + '>+ Spieler</button></div>' +
      '<div class="kn-center"><span class="kn-lbl">Stufe</span><div class="kn-seg" role="radiogroup" aria-label="Stufe">' + Object.keys(LV).map(function (k) { return '<button role="radio" data-level="' + k + '" aria-checked="' + (k === setup.level) + '"><span>' + LV[k][0] + '</span><span class="age">' + LV[k][1] + '</span><small>' + LV[k][2] + '</small></button>'; }).join('') + '</div><div class="kn-levelinfo">' + info + '</div></div>' +
      '<div class="kn-center"><label class="kn-switch"><input type="checkbox" id="pranks"' + (setup.pranks ? ' checked' : '') + '> Kichers Streiche des Tages (lustige Spaßregeln für die Beratung)</label></div>' +
      '<div class="kn-center"><details class="kn-short"' + (store('kobold-seen-v4') ? '' : ' open') + '><summary>So geht’s in einer Minute</summary><ol>' +
      '<li><b>Zauberhut:</b> Jeder bekommt zufällig eine Talea-Figur mit einer Fähigkeit. Figur und Fähigkeit sieht jeder.</li>' +
      '<li><b>Geheime Karte:</b> Das Handy geht reihum. Jeder sieht allein, ob er zum Dorf gehört oder ein Kicherkobold ist.</li>' +
      '<li><b>Nacht:</b> Augen zu, Ohren auf! Das Handy ruft erst die Kobolde, dann die Helfer. Wer gerufen wird, schaut kurz und tippt.</li>' +
      '<li><b>Morgen:</b> Ein Türgriff fehlt, vielleicht quakt ein Frosch, und jemand hat im Schlaf gemurmelt.</li>' +
      '<li><b>Tag:</b> Beraten, schwindeln, aufdecken. Auf „Zeigt!“ zeigen alle auf einen Verdächtigen.</li></ol>' +
      '<p class="kn-sub" style="text-align:left;margin-bottom:10px">Ziel: Das Dorf fängt alle Kobolde, bevor der letzte Türgriff weg ist.</p></details></div>' +
      '<div class="kn-row"><button class="kn-btn big" data-a="begin">Zauberhut öffnen</button></div>' +
      '<div class="kn-center"><button class="kn-mini" data-a="rules">📖 Alle Regeln lesen</button></div>';
    explain('Vorbereitung', '<p>Gebt eure Namen ein und wählt eine Stufe. Für die erste Runde empfehle ich die <b>Erste Partie</b>.</p><ul><li>4–6 Spieler: 1–2 Kobolde</li><li>7–9 Spieler: 2 Kobolde</li></ul>', 'Ihr braucht keinen Spielleiter. Das Handy liegt später in der Mitte und erzählt.');
  }

  function renderDraw() {
    var G = S.G, p = G.players[S.drawIdx], h = bar('Der Zauberhut');
    if (!S.drawShown) {
      h += '<div class="kn-center" style="padding-top:12px"><div class="kn-hat" id="hat" aria-hidden="true">🎩</div><h2 class="kn-call">Für ' + esc(p.name) + ' greift der Zauberhut hinein …</h2><div class="kn-row"><button class="kn-btn big" data-a="drawShow">Ziehen!</button></div></div>';
    } else {
      var a = AB[p.ab];
      h += '<div class="kn-center"><h2 class="kn-call">' + esc(p.name) + ' ist …</h2><div class="kn-bigcard"><img src="' + img(p.ch) + '" alt="' + esc(p.ch.n) + '"><div class="cname">' + esc(p.ch.n) + '</div><div class="abil">' + a.i + ' ' + a.name + ' · ' + (a.when === 'night' ? '🌙 Nachthelfer' : '☀️ Taghelfer') + '<small>' + esc(ABDESC[p.ab]) + '</small></div></div>' +
        sayBox('„' + esc(p.ch.p) + '“', p.ch.n) + '<div class="kn-row"><button class="kn-btn" data-a="drawNext">' + (S.drawIdx < G.players.length - 1 ? 'Nächste Figur' : 'Alle Figuren ansehen') + '</button></div></div>';
    }
    STAGE.innerHTML = h;
    explain('Der Zauberhut', '<p>Jeder bekommt zufällig eine Figur aus dem Talea-Figuren-Pool. Die Figur bringt eine Fähigkeit mit, die zu einer Talea-Eigenschaft passt.</p><p>Die Figur stellt sich mit ihrem Lieblingsspruch vor. <b>Gut hinhören</b>: Genau diese Sprüche murmeln die Figuren nachts im Schlaf.</p>', 'Figur und Fähigkeit sind öffentlich. Wer ein Kobold ist, kommt erst im nächsten Schritt und bleibt geheim.');
  }
  function renderBoard() {
    var G = S.G;
    STAGE.innerHTML = bar('Das Dorf') + '<div class="kn-center"><h2 class="kn-call">Das ist Kicherwald</h2><p class="kn-sub">Unter euch ' + (G.k === 1 ? 'versteckt sich <b>1 Kobold</b>' : 'verstecken sich <b>' + G.k + ' Kobolde</b>') + '. ' + G.max + ' Türgriffe hängen noch an den Türen.</p></div>' +
      grid(G.players, function () { return { phrase: true }; }) + '<div class="kn-row"><button class="kn-btn big" data-a="toPass">Geheime Karten verteilen</button></div>';
    explain('Das Dorf', '<p>Schaut euch die Figuren gut an. <b>🌙 Nachthelfer</b> werden nachts geweckt. <b>☀️ Taghelfer</b> schlafen nachts durch.</p><p>Alle Figuren können im Schlaf murmeln. Kobolde tun es doppelt so oft.</p>', 'Merkt euch die Gesichter und die Sprüche. Beides braucht ihr morgen früh.');
  }
  function renderPass() {
    var G = S.G, p = G.players[S.passIdx], h = bar('Geheime Karten');
    if (!S.passShown) {
      h += '<div class="kn-center" style="padding-top:20px"><h2 class="kn-call">Gib das Handy an ' + esc(p.name) + '</h2><p class="kn-sub">Nur ' + esc(p.name) + ' schaut hin. Alle anderen gucken weg.</p><div class="kn-row"><button class="kn-btn big" data-a="passShow">Ich bin ' + esc(p.name) + '</button></div></div>';
    } else {
      var kob = p.team === 'kobold', a = AB[p.ab], mates = E.activeKobolds(G).filter(function (q) { return q.id !== p.id; });
      h += '<div class="kn-center"><div class="kn-bigcard ' + (kob ? 'kob' : 'dorf') + '"><img src="' + img(kob ? KICHER : p.ch) + '" alt=""><div class="team ' + (kob ? 'kob' : 'dorf') + '">' + (kob ? 'Du bist ein Kicherkobold!' : 'Du gehörst zum Dorf') + '</div></div>' +
        '<div class="kn-secret">' + (kob ? 'Kicher steckt in dir. Nachts verwandelt ihr Mitspieler in Frösche, tagsüber tust du ganz unschuldig. <b>Ihr gewinnt, wenn der letzte Türgriff weg ist.</b>' + (mates.length ? '<br><br>Dein Komplize: <b>' + esc(mates.map(function (m) { return m.name + ' (' + m.ch.n + ')'; }).join(', ')) + '</b>' : '<br><br>Du bist der einzige Kobold.') : 'Finde die Kobolde, bevor der letzte Türgriff weg ist. <b>Das Dorf gewinnt, wenn alle Kobolde entlarvt sind.</b>') +
        '<br><br>Deine Fähigkeit: <b>' + a.i + ' ' + a.name + '</b>. ' + esc(ABDESC[p.ab]) + (kob ? ' Du darfst sie benutzen und über das Ergebnis lügen.' : '') + '</div>' +
        '<div class="kn-row"><button class="kn-btn" data-a="passNext">Verdecken und ' + (S.passIdx < G.players.length - 1 ? 'weitergeben' : 'in die Mitte legen') + '</button></div></div>';
    }
    STAGE.innerHTML = h;
    explain('Die geheime Karte', '<p>Das Handy geht reihum. Jeder sieht allein, ob er zum Dorf gehört oder ein Kobold ist. Bei zwei Kobolden sieht jeder Kobold den Komplizen.</p><p>Wenn du allein testest: einfach alle Karten durchklicken.</p>', 'Kobolde behalten ihre Figur und ihre Fähigkeit. Hexe Griselda bleibt Hexe Griselda, sie steht nur heimlich auf Kichers Seite.');
  }
  function renderNightIntro() {
    STAGE.innerHTML = bar('Nacht ' + S.G.night) + '<div class="kn-center" style="padding-top:26px"><h2 class="kn-call gold big">Augen zu.<br>Ohren auf.</h2>' + sayBox(esc(S.nightLine), 'Tavi') +
      '<p class="kn-sub">Legt das Handy in die Mitte. Wer aufgerufen wird, öffnet kurz die Augen, tippt und schließt sie wieder.</p><div class="kn-row"><button class="kn-btn big" data-a="nightGo">Alle Augen sind zu</button></div></div>';
    explain('Die Nacht beginnt', '<p>Jetzt ist das Handy der Spielleiter. Es ruft nacheinander die Kobolde und dann die Nachthelfer 🌙, immer in derselben Reihenfolge.</p>', 'Wer nicht gerufen wird, hält die Augen zu und lauscht. Tippgeräusche überhört man höflich.');
  }

  function stepCall(ab) { return ab === 'kobold' ? (S.G.k === 1 ? 'Kobold, öffne die Augen.' : 'Kobolde, öffnet die Augen.') : AB[ab].i + ' ' + AB[ab].name + ', öffne die Augen.'; }
  var IDLE = {
    early: { schluessel: 'Heute noch nicht! In der ersten Nacht putzt das Schlüsselloch noch seine Brille. Ab der zweiten Nacht darfst du schauen.', spur: 'Heute noch nicht! In der ersten Nacht spitzt der Spurenleser noch seine Bleistifte. Ab der zweiten Nacht darfst du lesen.' },
    used: 'Deine Fähigkeit ist schon verbraucht.', late: 'Der Bücherwurm liest nur in der ersten Nacht.', nobody: 'Es gibt heute niemanden, den du prüfen kannst.',
    fog: '🌫️ Nebel! Ein dicker Nebel hängt über dem Dorf, und du siehst heute nichts. Deine Fähigkeit bleibt dir erhalten. Du darfst morgen allen erzählen, dass Kicher Angst vor dir hat.'
  };
  function renderNight() {
    var G = S.G, ab = G.steps[S.stepIdx], h = bar('Nacht ' + G.night), holder = ab === 'kobold' ? null : E.holder(G, ab), ex = '', rule = '';
    var head = '<h2 class="kn-call">' + esc(stepCall(ab)) + '</h2>';
    function pgrid(opts, f) { return grid(G.players, function (p) { var ok = opts.indexOf(p.id) >= 0; return { click: true, dis: !ok, dim: !ok, sel: S.sel.indexOf(p.id) >= 0 }; }, G.players.length > 6); }
    if (S.sub === 'call') {
      h += '<div class="kn-center">' + head + '</div>';
      if (ab === 'kobold') {
        var opts = E.options(G, 'kobold');
        h += '<div class="kn-instr">Wen verwandelt ihr heute in einen Frosch?</div>' + (G.night === 1 && G.k > 1 ? '<p class="kn-sub">Ihr seid ein Team: <b>' + esc(E.activeKobolds(G).map(function (p) { return p.name; }).join(' und ')) + '</b>.</p>' : '') +
          (G.lastVictim != null ? '<p class="kn-sub">' + nameOf(G.lastVictim) + ' war gestern dran und ist heute tabu.</p>' : '') + pgrid(opts) +
          '<div class="kn-row"><button class="kn-btn" data-a="nightPick"' + (S.sel.length === 1 ? '' : ' disabled') + '>Verhexen</button></div>';
        ex = '<p>Die Kobolde tippen gemeinsam auf ein Opfer. Es darf auch ein Kobold sein, wenn ihr eine falsche Fährte legen wollt.</p>';
        rule = 'Das Opfer wacht morgen als Frosch auf, außer Laterne, Honigfalle, Trostpflaster oder Dickkopf verhindern es.';
      } else {
        var why = E.blocked(G, ab);
        if (why || E.fogged(G, ab)) {
          var msg = why ? (why === 'early' ? IDLE.early[ab] : IDLE[why]) : IDLE.fog;
          h += '<div class="kn-instr">' + esc(holder.name) + ' (' + esc(holder.ch.n) + ')</div><div class="kn-say">' + esc(msg) + '</div><p class="kn-sub">Tippe trotzdem auf „Fertig“, damit niemand etwas merkt.</p><div class="kn-row"><button class="kn-btn" data-a="nightDone">Fertig</button></div>';
          ex = '<p>Jede Fähigkeit wird jede Nacht aufgerufen, auch wenn sie nichts tun kann. Sonst würde man am Ablauf hören, was los ist.</p>';
        } else if (ab === 'laterne' || ab === 'honig' || ab === 'schluessel') {
          var q = { laterne: 'Wen beschützt du heute Nacht?', honig: 'Vor welches Haus stellst du deine Falle?', schluessel: 'Bei wem schaust du durchs Schlüsselloch?' }[ab];
          h += '<div class="kn-instr">' + esc(holder.name) + ': ' + q + '</div>' + pgrid(E.options(G, ab)) +
            '<div class="kn-row"><button class="kn-btn" data-a="nightPick"' + (S.sel.length === 1 ? '' : ' disabled') + '>Bestätigen</button>' + (ab === 'honig' ? '<button class="kn-btn ghost" data-a="nightSkip">Heute keine Falle</button>' : '') + '</div>';
          ex = { laterne: '<p>Die Laterne schützt einen Spieler, auch sich selbst. Nicht zweimal hintereinander denselben' + (G.lastLantern != null ? ', deshalb ist ' + nameOf(G.lastLantern) + ' heute ausgegraut' : '') + '.</p>', honig: '<p>Die Honigfalle gibt es nur einmal im Spiel. Schlagen die Kobolde genau dort zu, platzt ihr Zauber, und morgen führt eine Spur zu zwei Namen. Einer davon ist ein Kobold.</p>', schluessel: '<p>Das Schlüsselloch darf einmal im Spiel jemanden prüfen und erfährt das Ergebnis nur für sich. Morgen entscheidet es selbst, ob und wie es das erzählt.</p>' }[ab];
          if (ab === 'schluessel' && holder.team === 'kobold') ex += '<p><b>Hier ist das Schlüsselloch selbst ein Kobold.</b> Es kann morgen behaupten, was es will.</p>';
        } else if (ab === 'trost') {
          h += '<div class="kn-instr">' + esc(holder.name) + ': Die Kobolde wollen ' + nameOf(G.nd.target) + ' verhexen.</div><div style="max-width:190px;margin:0 auto;width:100%">' + pcard(pid(G.nd.target)) + '</div><p class="kn-sub">Du kannst einmal im Spiel retten.</p><div class="kn-row"><button class="kn-btn" data-a="heal">Retten</button><button class="kn-btn ghost" data-a="nightDone">Nicht retten</button></div>';
          ex = '<p>Das Trostpflaster sieht jede Nacht das Opfer der Kobolde. Retten kann es nur einmal im ganzen Spiel, also gut überlegen.</p>';
        } else if (ab === 'spur') {
          h += '<div class="kn-instr">' + esc(holder.name) + ': Wähle zwei Spieler.</div>' + pgrid(E.options(G, 'spur')) + '<div class="kn-row"><button class="kn-btn" data-a="nightPick"' + (S.sel.length === 2 ? '' : ' disabled') + '>Spur lesen</button></div>';
          ex = '<p>Der Spurenleser darf einmal im Spiel zwei Spieler prüfen. Er erfährt die Zahl der Kobolde darunter, aber keine Namen.</p>';
        } else if (ab === 'buch') {
          h += '<div class="kn-instr">' + esc(holder.name) + ', schau in dein Buch.</div><div class="kn-row"><button class="kn-btn big" data-a="book">Buch aufschlagen</button></div>';
          ex = '<p>Der Bücherwurm erfährt nur in der ersten Nacht einen Namen, der sicher zum Dorf gehört.</p>';
        }
      }
    } else if (S.sub === 'prank') {
      h += '<div class="kn-center"><h2 class="kn-call">Kichers Streich?</h2><p class="kn-sub">Ihr dürft jetzt einen Streich spielen. Pro Nacht höchstens einen.</p></div><div class="kn-row" style="flex-direction:column;align-items:stretch">' +
        (G.fogLeft > 0 ? '<button class="kn-btn" data-a="prankFog">🌫️ Nebel<small>(' + G.fogLeft + ' übrig)</small></button><p class="kn-sub">Eine Nachtfähigkeit sieht heute nichts. Sie bleibt dem Besitzer erhalten.</p>' : '') +
        (G.imitLeft > 0 ? '<button class="kn-btn" data-a="prankImit">🎭 Stimme klauen<small>(' + G.imitLeft + ' übrig)</small></button><p class="kn-sub">Morgen früh murmelt eine Figur, die ihr aussucht, auch wenn sie gar nicht wach war.</p>' : '') +
        '<button class="kn-btn ghost" data-a="nightDone">Heute nicht</button></div>';
      ex = '<p>Kichers Streiche gibt es nur im Vollen Spiel und in der Profi-Nacht. Sie sind begrenzt, also gut aufheben.</p>';
    } else if (S.sub === 'fogTarget') {
      var abl = E.FOGGABLE.filter(function (a) { return E.holder(G, a); });
      h += '<div class="kn-center"><h2 class="kn-call">🌫️ Wessen Fähigkeit vernebelt ihr?</h2></div><div class="kn-row" style="flex-direction:column;align-items:stretch">' +
        abl.map(function (a) { var hh = E.holder(G, a); return '<button class="kn-btn ghost" data-a="fogPick" data-ab="' + a + '">' + AB[a].i + ' ' + AB[a].name + '<small>' + esc(hh.name) + '</small></button>'; }).join('') + '<button class="kn-btn ghost" data-a="prankBack">Zurück</button></div>';
      ex = '<p>Die vernebelte Fähigkeit funktioniert heute Nacht nicht. Der Besitzer merkt es aber und weiß dann, dass Kicher ihn fürchtet.</p>';
    } else if (S.sub === 'imitTarget') {
      var cand = G.players.filter(function (p) { return !E.revealed(p); }).map(function (p) { return p.id; });
      h += '<div class="kn-center"><h2 class="kn-call">🎭 Wessen Stimme klaut ihr?</h2></div>' + pgrid(cand) + '<div class="kn-row"><button class="kn-btn" data-a="imitPick"' + (S.sel.length === 1 ? '' : ' disabled') + '>Stimme klauen</button><button class="kn-btn ghost" data-a="prankBack">Zurück</button></div>';
      ex = '<p>Morgen früh hört das Dorf den Lieblingsspruch dieser Figur im Schlaf. So könnt ihr einen Unschuldigen verdächtig machen.</p>';
    } else if (S.sub === 'result') {
      var r = S.result;
      h += '<div class="kn-center"><h2 class="kn-call gold">' + r.title + '</h2>' + (r.p ? '<div style="max-width:190px;width:100%">' + pcard(r.p, { team: r.team }) + '</div>' : '') + '<p class="kn-sub">' + r.sub + '</p><div class="kn-row"><button class="kn-btn" data-a="nightDone">Gemerkt. Augen zu.</button></div></div>';
      ex = '<p>Dieses Ergebnis sieht nur die aufgerufene Person. Alle anderen haben die Augen zu.</p>';
    }
    h += '<div class="kn-note" aria-live="polite">' + esc(S.note || '') + '</div>';
    STAGE.innerHTML = h;
    explain('Nacht ' + G.night + ' · ' + (ab === 'kobold' ? 'Kobolde' : AB[ab].name) + ' (' + (S.stepIdx + 1) + ' von ' + G.steps.length + ')', ex, rule);
  }

  function spellText(m) {
    if (m.how === 'frog') return 'Als ' + esc(m.victim.name) + ' heute aufwachte, kam nur ein Quaken heraus. <b>' + esc(m.victim.name) + ' ist ein Frosch!</b> Bis heute Abend: nicht sprechen, nicht abstimmen. Quaken und Zeichensprache sind erlaubt.';
    if (m.how === 'laterne') return 'Die Kobolde schlichen zu einem Haus, aber dort brannte eine Laterne. Niemand wurde verhext.';
    if (m.how === 'honig') return 'Klatsch! Die Kobolde sind in eine Honigfalle getreten. Der Zauber ist geplatzt, und eine klebrige Spur führt zu <b>' + esc(m.honey.map(function (i) { return pid(i).name; }).join(' und ')) + '</b>. Einer von beiden ist ein Kobold!';
    if (m.how === 'trost') return 'Jemand sollte verhext werden, aber ein Trostpflaster hat es verhindert. Niemand ist ein Frosch.';
    if (m.how === 'dick') return 'Der Zauber traf ' + esc(m.victim.name) + ' und prallte ab. <b>' + esc(m.victim.name) + ' hat einen Dickkopf!</b>';
    return '';
  }
  function renderMorning() {
    var G = S.G, m = G.morning, st = S.mstage, items = [];
    function it(n, html, cls) { return '<div class="kn-it' + (cls ? ' ' + cls : '') + (st === n ? '' : ' old') + '">' + html + '</div>'; }
    var low = G.handles <= 2;
    items.push(it(0, '<span class="k">Türgriffe</span><div class="kn-knarrz">KNARRZ!</div><p style="text-align:center">Kicher hat einen Türgriff geklaut. Noch <b>' + G.handles + ' von ' + G.max + '</b>.' + (G.handles === 1 ? ' Das ist der letzte!' : low ? ' Jetzt wird es eng.' : '') + '</p>'));
    if (st >= 1 && !G.winner) items.push(it(1, '<span class="k">Der Zauber</span>' + spellText(m)));
    if (st >= 2 && !G.winner) items.push(it(2, '<span class="k">Ohren auf! Im Schlaf gemurmelt</span><div class="kn-murmur">„' + esc(m.mur.ch.p) + '“</div><div class="kn-row"><button class="kn-mini" data-a="replayMur">Nochmal hören</button></div>'));
    if (st >= 3 && !G.winner && S.prank) items.push(it(3, '<span class="k">Kichers Streich des Tages</span><div class="ttl">' + esc(S.prank.t) + '</div>' + esc(S.prank.x), 'prank'));
    if (st >= 3 && !G.winner && S.frogTask) items.push(it(3, '<span class="k">Aufgabe für den Frosch (' + esc(m.victim.name) + ')</span>' + esc(S.frogTask.text), 'frogtask'));
    var btn = G.winner ? '<button class="kn-btn big" data-a="morningEnd">Weiter</button>' : (S.mdone ? '<button class="kn-btn big" data-a="toDay">Beratung starten</button>' : '<button class="kn-btn ghost" data-a="morningSkip">Überspringen</button>');
    STAGE.innerHTML = bar('Morgen ' + G.night) + '<div class="kn-center"><h2 class="kn-call gold">Guten Morgen, Kicherwald!</h2></div><div class="kn-report">' + items.join('') + '</div>' +
      (S.mdone ? grid(G.players, function () { return {}; }, G.players.length > 6) : '') + '<div class="kn-row">' + btn + '</div>';
    explain('Der Morgen', '<p>Jede Nacht fehlt ein Türgriff. Dazu erfahrt ihr, ob jemand verhext wurde, und hört das Gemurmel.</p><p>Wessen Spruch war das? Mit 🏘️ oben könnt ihr alle Sprüche nachhören.</p>', '<b>Tipp:</b> Kobolde murmeln doppelt so oft wie alle anderen. Ein Spruch ist eine Spur, kein Beweis. Wenn dieselbe Figur zweimal murmelt, wird es verdächtig.');
  }

  function timeStr(n) { var mm = Math.floor(n / 60), ss = n % 60; return mm + ':' + (ss < 10 ? '0' : '') + ss; }
  function finaleBanner() {
    var G = S.G;
    if (G.handles <= 1) return '<div class="kn-finale">⚠️ Letzter Tag! Heute Nacht holt Kicher den letzten Türgriff. Entlarvt jetzt alle Kobolde!</div>';
    if (E.finale(G)) return '<div class="kn-finale">⚠️ Achtung: Eine falsche Anklage kostet jetzt das ganze Spiel!</div>';
    return '';
  }
  function renderDay() {
    var G = S.G, frogs = G.players.filter(function (p) { return p.frog; }), rh = E.holder(G, 'rede'), canRede = E.canRede(G);
    var h = bar('Tag ' + G.night) + '<div class="kn-center"><h2 class="kn-call">Beratung</h2><div class="kn-timer' + (S.talkLeft <= 10 && S.talkRun ? ' low' : '') + '" id="tmr">' + timeStr(S.talkLeft) + '</div>' +
      (S.redeLeft > 0 ? '<div class="kn-instr">🔤 Redestein: ' + esc(rh.name) + ' redet. Niemand unterbricht!</div><div class="kn-redebar"><span id="rbar" style="width:' + (S.redeLeft / 60 * 100) + '%"></span></div>' : '') +
      '<div class="kn-row"><button class="kn-btn ghost" data-a="talkToggle">' + (S.talkRun ? 'Pause' : (S.talkLeft === 0 ? 'Zeit ist um' : 'Uhr starten')) + '</button>' + (canRede ? '<button class="kn-btn ghost" data-a="rede">🔤 ' + esc(rh.name) + ' legt den Redestein</button>' : '') + '</div></div>' +
      finaleBanner() +
      (S.prank ? '<div class="kn-it prank old"><span class="k">Kichers Streich des Tages</span><div class="ttl">' + esc(S.prank.t) + '</div>' + esc(S.prank.x) + '</div>' : '') +
      (S.frogTask ? '<div class="kn-it frogtask old"><span class="k">Aufgabe für den Frosch (' + esc(G.morning.victim.name) + ')</span>' + esc(S.frogTask.text) + '</div>' : '') +
      (frogs.length ? '<p class="kn-sub">🐸 ' + esc(frogs.map(function (f) { return f.name; }).join(', ')) + ' darf heute nur quaken.</p>' : '') +
      grid(G.players, function () { return {}; }, G.players.length > 6) + '<div class="kn-row"><button class="kn-btn big" data-a="toVote">Jetzt wird gezeigt</button></div>';
    STAGE.innerHTML = h;
    explain('Der Tag', '<p>Jetzt redet ihr. Typische Fragen:</p><ul><li>„Schlüsselloch, wen hast du angeschaut?“</li><li>„Wessen Spruch war das gestern Nacht?“</li><li>„Warum haben die Kobolde ausgerechnet den Frosch gewählt?“</li></ul><p>Jeder darf lügen. Kobolde tun es bestimmt.</p>', (G.L.talk / 60) + ' Minuten Zeit. Die Uhr ist nur ein Vorschlag, ihr könnt jederzeit zum Zeigen gehen.');
  }
  function renderVote() {
    var G = S.G, h = bar('Zeigen');
    function g() { return grid(G.players, function (p) { var ok = !E.revealed(p); return { click: true, dis: !ok, dim: !ok, sel: S.sel.indexOf(p.id) >= 0 }; }, G.players.length > 6); }
    if (S.voteSub === 'ready') {
      h += '<div class="kn-center" style="padding-top:14px"><h2 class="kn-call">Bereit zum Zeigen?</h2><p class="kn-sub">Gleich zählt Tavi runter. Auf „Zeigt!“ zeigen alle gleichzeitig mit dem Finger auf einen Verdächtigen. Wer niemanden verdächtigt, zeigt nach oben. Frösche zeigen nicht.</p>' + finaleBanner() + '<div class="kn-row"><button class="kn-btn big" data-a="startCount">Los: Drei, zwei, eins …</button></div></div>';
    } else if (S.voteSub === 'count') {
      h += '<div class="kn-center" style="padding-top:40px"><div class="kn-count" id="cnt">' + (S.count || '') + '</div><p class="kn-sub">Hände bereit!</p></div>';
    } else if (S.voteSub === 'point') {
      h += '<div class="kn-center"><div class="kn-zeigt">ZEIGT!</div><div class="kn-instr">Wer hat die meisten Finger?</div></div>' + finaleBanner() + g() +
        '<div class="kn-row"><button class="kn-btn" data-a="accuse"' + (S.sel.length === 1 ? '' : ' disabled') + '>' + (S.sel.length === 1 ? esc(pid(S.sel[0]).name) + ' entlarven' : 'Entlarven') + '</button><button class="kn-btn ghost" data-a="tie">Gleichstand</button><button class="kn-btn ghost" data-a="nobody">Die meisten zeigen nach oben</button></div>';
    } else if (S.voteSub === 'tie') {
      var gl = E.holder(G, 'glocke');
      if (E.canBell(G)) h += '<div class="kn-center"><h2 class="kn-call">🤝 ' + esc(gl.name) + ' läutet die Dorfglocke</h2><div class="kn-instr">Wen von den Gleichstand-Kandidaten entlarven wir?</div></div>' + g() + '<div class="kn-row"><button class="kn-btn" data-a="accuse"' + (S.sel.length === 1 ? '' : ' disabled') + '>Entlarven</button></div>';
      else h += '<div class="kn-center"><h2 class="kn-call">Gleichstand!</h2><p class="kn-sub">' + (gl ? esc(gl.name) + ' ist heute ein Frosch und kann die Dorfglocke nicht läuten.' : 'In diesem Spiel gibt es keine Dorfglocke.') + ' Heute wird niemand entlarvt.</p><div class="kn-row"><button class="kn-btn" data-a="nobodyTie">Weiter</button></div></div>';
    }
    STAGE.innerHTML = h;
    explain('Zeigen', '<p>Das Zeigen passiert am Tisch, nicht auf dem Handy. Danach tippt jemand an, wer die meisten Finger hat.</p><ul><li><b>Ein klarer Verdächtiger:</b> antippen und entlarven.</li><li><b>Gleichstand:</b> Die Dorfglocke entscheidet. Ohne Dorfglocke passiert nichts.</li><li><b>Die meisten zeigen nach oben:</b> Heute wird niemand entlarvt, das kostet nichts.</li></ul>', 'Eine falsche Anklage kostet <b>' + costWord(G.rules.wrongCost) + '</b>. Pro Tag gibt es höchstens eine Entlarvung.');
  }
  function renderReveal() {
    var G = S.G, p = pid(S.accused), kob = p.team === 'kobold', h = bar('Entlarvung'), m = S.revealSub;
    var front = '<div class="kn-face front"><img src="' + img(p.ch) + '" alt=""><div class="cname">' + esc(p.name) + '</div><div class="abil">' + esc(p.ch.n) + '<small>' + AB[p.ab].i + ' ' + AB[p.ab].name + '</small></div></div>';
    var back = '<div class="kn-face back ' + (kob ? 'kob' : 'dorf') + '"><img src="' + img(kob ? KICHER : p.ch) + '" alt=""><div class="team ' + (kob ? 'kob' : 'dorf') + '">' + (kob ? 'Kobold!' : 'Unschuldig!') + '</div></div>';
    h += '<div class="kn-center"><h2 class="kn-call">' + esc(p.name) + ', tritt vor.</h2><div class="kn-flipwrap"><div class="kn-flip' + (m === 'drum' ? ' shaking' : '') + '" id="flip">' + front + back + '</div></div>';
    if (m === 'ask') h += sayBox('Steckt Kicher in dir?', 'Tavi') + '<div class="kn-row"><button class="kn-btn big" data-a="flip">Karte umdrehen</button></div>';
    else if (m === 'drum') h += '<p class="kn-sub">Trommelwirbel …</p>';
    else {
      var cost = S.revealCost, ph = '„' + esc(p.ch.p) + '“';
      h += '<div class="kn-report">' + (kob ? '<div class="kn-it"><span class="k">Kicher</span>„Hihi – ein Trick, ein Klick, ein Glück!“ Kicher fährt aus ' + esc(p.name) + ' heraus und flitzt davon. <b>' + esc(p.name) + ' ist entzaubert</b> und hilft ab jetzt dem Dorf weiter, mit Stimme und Fähigkeit.</div>'
        : '<div class="kn-it"><span class="k">' + esc(p.ch.n) + ' ruft empört</span><div class="kn-murmur">' + ph + '</div><b>' + esc(p.name) + ' ist unschuldig</b> und bekommt das grüne Häkchen. Im Durcheinander ' + (cost === 1 ? 'verschwindet ein Türgriff' : 'verschwinden ' + cost + ' Türgriffe') + ': <b>noch ' + Math.max(0, G.handles) + ' von ' + G.max + '</b>.</div>') + '</div>' +
        '<div class="kn-row"><button class="kn-btn big" data-a="afterReveal">Weiter</button></div>';
    }
    h += '</div>';
    STAGE.innerHTML = h;
    if (m === 'shown') setTimeout(function () { var f = $('flip'); if (f) f.classList.add('turned'); }, 60);
    explain('Die Entlarvung', m === 'shown' ? (kob ? '<p>Kicher wurde aus der Figur vertrieben. Der Spieler hilft ab jetzt dem Dorf, diskutiert und stimmt weiter ab. Seine Fähigkeit bleibt erhalten.</p>' : '<p>Der Spieler ist jetzt eine bewiesene Vertrauensperson und kann nicht noch einmal angeklagt werden. Die falsche Anklage hat aber Türgriffe gekostet.</p>') : '<p>Jetzt deckt das Handy die geheime Karte auf. Ein Trommelwirbel gehört dazu.</p>', '');
  }
  function renderEvening() {
    var G = S.G, last = G.handles <= 1;
    STAGE.innerHTML = bar('Abend') + '<div class="kn-center" style="padding-top:20px"><h2 class="kn-call">Die Sonne geht unter</h2>' + sayBox('Alle Frösche werden wieder normal, und Kicher reibt sich die Hände …' + (last ? ' <b>Wenn jetzt Nacht wird, holt er den letzten Türgriff.</b>' : ' Noch ' + G.handles + ' Türgriffe.'), 'Tavi') + '<div class="kn-row"><button class="kn-btn big" data-a="nextNight">Nacht ' + (G.night + 1) + ' beginnt</button></div></div>';
    explain('Der Abend', '<p>Frösche sind wieder normal. Dann beginnt die nächste Nacht mit derselben Reihenfolge.</p>', '');
  }

  /* ---------- Chronik ---------- */
  function chronHtml() {
    var G = S.G, kobs = G.players.filter(function (p) { return p.team === 'kobold'; }).map(function (p) { return p.name; }).join(' und '), nights = {};
    function N(id) { return '<b>' + esc(pid(id).name) + '</b>'; }
    var out = [];
    G.events.forEach(function (e) {
      var L = [];
      if (e.t === 'night') {
        L.push('Die Kobolde (' + esc(kobs) + ') wollten ' + (e.victim != null ? N(e.victim) : 'niemanden') + ' verhexen.');
        if (e.fog) L.push('🌫️ Kicher vernebelte die Fähigkeit ' + AB[e.fog].name + ' von ' + N(E.holder(G, e.fog).id) + '.');
        if (e.faked) L.push('🎭 Kicher klaute die Stimme von ' + N(e.mur) + '.');
        if (e.lantern != null) L.push(N(E.holder(G, 'laterne').id) + ' (Laterne) beschützte ' + N(e.lantern) + '.');
        if (e.trap != null) L.push(N(E.holder(G, 'honig').id) + ' (Honigfalle) stellte die Falle bei ' + N(e.trap) + ' auf.');
        if (e.heal) L.push(N(E.holder(G, 'trost').id) + ' (Trostpflaster) rettete ' + N(e.victim) + '.');
        if (e.peek != null) L.push(N(E.holder(G, 'schluessel').id) + ' (Schlüsselloch) schaute bei ' + N(e.peek) + ' nach: ' + (e.peekR ? 'Kobold' : 'kein Kobold') + '.');
        if (e.track) L.push(N(E.holder(G, 'spur').id) + ' (Spurenleser) prüfte ' + N(e.track[0]) + ' und ' + N(e.track[1]) + ': ' + e.track[2] + ' Kobold' + (e.track[2] === 1 ? '' : 'e') + '.');
        if (e.book != null) L.push(N(E.holder(G, 'buch').id) + ' (Bücherwurm) erfuhr: ' + N(e.book) + ' gehört zum Dorf.');
        L.push('Ergebnis: ' + ({ frog: 'Der Froschzauber traf ' + (e.victim != null ? N(e.victim) : '') + '.', laterne: 'Die Laterne stoppte den Zauber.', honig: 'Die Honigfalle stoppte den Zauber.', trost: 'Das Trostpflaster stoppte den Zauber.', dick: 'Der Dickkopf stoppte den Zauber.' }[e.how] || 'Kein Zauber.'));
        L.push('Gemurmelt hat: ' + N(e.mur) + ' (' + esc(pid(e.mur).ch.n) + ')' + (e.faked ? ', aber <b>nachgemacht</b> von den Kobolden!' : (pid(e.mur).team === 'kobold' ? ', ein Kobold.' : ', ein Dorfbewohner.')));
        out.push({ h: 'Nacht ' + e.night, l: L });
      } else if (e.kind === 'accuse') {
        out.push({ h: 'Tag ' + e.night, l: [N(e.id) + ' wurde entlarvt: ' + (e.kob ? 'ein Kobold!' : 'unschuldig. ' + (e.cost === 1 ? 'Ein Türgriff ging verloren.' : e.cost + ' Türgriffe gingen verloren.'))] });
      } else out.push({ h: 'Tag ' + e.night, l: [e.kind === 'tie-nobody' ? 'Gleichstand ohne Dorfglocke. Niemand wurde entlarvt.' : 'Niemand wurde entlarvt.'] });
    });
    return out.map(function (c) { return '<div class="n"><h5>' + c.h + '</h5><ul>' + c.l.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></div>'; }).join('');
  }
  function confetti() {
    var cols = ['#f2c75a', '#82e0a9', '#ff9d6e', '#9db6ff', '#ff8fc0'], s = '';
    for (var i = 0; i < 36; i++) s += '<i style="left:' + Math.random() * 100 + '%;background:' + pick(cols) + ';animation-duration:' + (2.4 + Math.random() * 2.4) + 's;animation-delay:' + Math.random() * 1.2 + 's"></i>';
    return '<div class="kn-confetti" aria-hidden="true">' + s + '</div>';
  }
  function renderEnd() {
    var G = S.G, dorf = G.winner === 'dorf';
    if (!S.awards) S.awards = C.awardsFor(G, Math.random);
    var h = bar('Spielende') + (dorf ? confetti() : '') + '<div class="kn-center" style="padding-top:8px"><div class="kn-win ' + (dorf ? 'dorf' : 'kob') + '">' + (dorf ? 'Das Dorf gewinnt!' : 'Kicher gewinnt!') + '</div>' +
      sayBox(dorf ? 'Alle Kobolde sind entzaubert, und ' + G.handles + ' Türgriff' + (G.handles === 1 ? '' : 'e') + ' hängen noch. Kicherwald kann wieder ruhig schlafen.' : 'Der letzte Türgriff ist weg. Kicher tanzt mit seiner Sammlung davon: „Hihi – ein Trick, ein Klick, ein Glück!“', 'Tavi') + '</div>' +
      '<div class="kn-instr">Alle Karten aufgedeckt</div>' + grid(G.players, function () { return { team: true }; }, G.players.length > 6) +
      '<div class="kn-center"><div class="kn-lbl">Die Auszeichnungen</div><div class="kn-awards">' + G.players.map(function (p) { var a = S.awards[p.id], g = C.traitGrowth(G, p); return '<div class="kn-award"><img src="' + img(p.ch) + '" alt=""><div><div class="tt"><span class="ic">' + a.icon + '</span>' + esc(a.title) + ' · ' + esc(p.name) + '</div><div class="ww">' + esc(a.why) + '</div><div class="gr">' + g.icon + ' ' + g.trait + ' +' + g.pts + ' (Beispiel für den Avatar): ' + esc(g.why) + '</div></div></div>'; }).join('') + '</div></div>' +
      '<div class="kn-center"><div class="kn-lbl">Die Chronik: was wirklich geschah</div><div class="kn-chron">' + chronHtml() + '</div><div class="kn-row"><button class="kn-btn" data-a="again">Nochmal, gleiche Spieler</button><button class="kn-btn ghost" data-a="quit">Neue Runde einrichten</button></div></div>';
    STAGE.innerHTML = h;
    explain('Spielende', '<p>Die Chronik zeigt jede Nacht, was wirklich passiert ist: wen die Kobolde wollten, wer geschützt hat, was Schlüsselloch und Spurenleser gesehen haben und wer wirklich gemurmelt hat.</p><p>In der Talea-App würde jetzt jeder Avatar ein kleines Eigenschafts-Update mit Begründung bekommen. Hier sind es nur Beispiele.</p>', 'Spielt gleich noch eine Runde: Der Zauberhut mischt alles neu.');
  }

  /* ---------- Overlays: Regeln & Dorf ---------- */
  function renderOverlay() {
    if (!S.overlay) { OVER.hidden = true; OVER.innerHTML = ''; return; }
    OVER.hidden = false; OVER.className = 'kn-overlay';
    var G = S.G, h = '<div class="kn-over" role="dialog" aria-modal="true"><div class="kn-row" style="justify-content:space-between;align-items:center"><h2>' + (S.overlay === 'rules' ? 'Die Regeln' : 'Das Dorf') + '</h2><button class="kn-btn ghost" data-a="closeOverlay">Schließen</button></div>';
    if (S.overlay === 'village' && G) {
      h += '<p>Alles hier ist öffentlich: Figur, Fähigkeit, Lieblingsspruch. Tippt auf eine Figur, um ihren Spruch zu hören. Geheim ist nur, wer ein Kobold ist.</p>' + grid(G.players, function () { return { click: true, phrase: true }; }, G.players.length > 6);
    } else h += rulesHtml();
    OVER.innerHTML = h + '</div>';
  }
  function rulesHtml() {
    var ex = {}; POOL.forEach(function (c) { if (!ex[c.a]) ex[c.a] = c; });
    var rows = Object.keys(AB).map(function (k) { var c = ex[k]; return '<div class="abrow"><img src="' + img(c) + '" alt=""><div><b>' + AB[k].i + ' ' + AB[k].name + ' · ' + (AB[k].when === 'night' ? '🌙 Nachthelfer' : '☀️ Taghelfer') + ' <span style="color:var(--faint);font-weight:600">(' + AB[k].trait + ')</span></b><span>' + esc(ABDESC[k]) + '</span><span style="display:block;color:var(--faint);margin-top:2px">z. B. ' + esc(c.n) + '</span></div></div>'; }).join('');
    return '<div class="goldbox"><p><b>Worum geht’s?</b> In Kicherwald verschwinden nachts die Türgriffe. Schuld ist Kobold Kicher. Er ist heimlich in einen oder zwei von euch geschlüpft. Alle anderen gehören zum Dorf.</p><p style="margin-top:6px"><b>Das Dorf gewinnt,</b> wenn alle Kobolde entlarvt sind. <b>Die Kobolde gewinnen,</b> wenn der letzte Türgriff weg ist.</p></div>' +
      '<h3>Eine Runde</h3><ol><li><b>Nacht.</b> Alle machen die Augen zu. Das Handy ruft nacheinander erst die Kobolde, dann die Nachthelfer. Wer gerufen wird, öffnet kurz die Augen, tippt etwas an und schließt sie wieder. Alle anderen lauschen: Ohren auf!</li>' +
      '<li><b>Morgen.</b> Ein Türgriff fehlt. Vielleicht quakt jemand, weil er in einen Frosch verwandelt wurde. Und jemand hat im Schlaf gemurmelt: Ihr hört seinen Lieblingsspruch.</li>' +
      '<li><b>Beratung.</b> Ihr redet, schwindelt und verdächtigt. Jeder darf alles behaupten. Nur das Handy sagt immer die Wahrheit.</li>' +
      '<li><b>Zeigen.</b> Das Handy zählt runter: Drei, zwei, eins, zeigt! Alle zeigen gleichzeitig mit dem Finger auf den, den sie für einen Kobold halten. Wer niemanden verdächtigt, zeigt nach oben.</li>' +
      '<li><b>Entlarven.</b> Wer die meisten Finger hat, deckt seine geheime Karte auf. Ein Kobold wird entzaubert und hilft dem Dorf weiter. Ein Unschuldiger bekommt ein grünes Häkchen, aber die falsche Anklage kostet Türgriffe.</li></ol>' +
      '<h3>Das Murmeln: Ohren auf!</h3><p>Jeden Morgen hört ihr den Lieblingsspruch von jemandem, der im Schlaf gemurmelt hat. Kobolde sind nachts aufgeregt und murmeln <b>doppelt so oft</b> wie alle anderen. Der Spruch beweist nichts, aber er ist eine Spur. Murmelt dieselbe Figur in zwei Nächten, solltet ihr hellhörig werden.</p>' +
      '<h3>Frösche und Türgriffe</h3><ul><li>Wer verhext wird, ist bis zum Abend ein <b>Frosch</b>: nicht sprechen, nicht abstimmen, keine Tagesfähigkeit. Quaken und Zeichensprache sind erlaubt. Der Frosch bekommt eine lustige Aufgabe.</li><li>Jede Nacht geht <b>ein Türgriff</b> verloren. Eine <b>falsche Anklage</b> kostet im Vollen Spiel und in der Profi-Nacht <b>zwei</b>, in der Ersten Partie <b>einen</b>.</li><li>Wer <b>entzaubert</b> wurde, gehört jetzt zum Dorf und spielt mit Stimme und Fähigkeit weiter. Niemand scheidet aus.</li></ul>' +
      '<h3>Die neun Fähigkeiten</h3><p>Jede Figur hat genau eine Fähigkeit, die zu einer Talea-Eigenschaft gehört. Sie sind für alle sichtbar. Jede kommt pro Partie höchstens einmal vor.</p>' + rows +
      '<h3>Kichers Streiche</h3><ul><li><b>🌫️ Nebel</b> (Volles Spiel und Profi-Nacht): Die Kobolde blockieren heute Nacht eine Nachtfähigkeit. Der Besitzer merkt es und behält die Fähigkeit.</li><li><b>🎭 Stimme klauen</b> (nur Profi-Nacht): Morgen murmelt eine Figur eurer Wahl, obwohl sie gar nicht wach war.</li><li><b>Streich des Tages:</b> Jeden Tag gibt es eine Spaßregel für die Beratung, zum Beispiel „Heute wird gereimt“. Sie ändert nichts an den Spielregeln und lässt sich beim Einrichten abschalten.</li></ul>' +
      '<h3>Häufige Fragen</h3><details><summary>Darf ich lügen?</summary><p>Ja, alle dürfen alles behaupten. Nur das Handy lügt nie.</p></details><details><summary>Warum sagt Tavi keine Namen?</summary><p>Die Sprecher-Aufnahmen sind vorproduziert. Deshalb stehen Namen auf dem Bildschirm, nicht in der Sprachausgabe.</p></details><details><summary>Muss ich die Augen wirklich zumachen?</summary><p>Ja, ehrlich. Sonst verdirbt ihr euch den Spaß. Wer blinzelt, den sieht Tavi.</p></details><details><summary>Was, wenn der Kobold das Schlüsselloch ist?</summary><p>Dann sieht er die Wahrheit, darf aber alles erzählen. Prüft das mit anderen Hinweisen: Murmeln, Spurenleser, Honigspur.</p></details><details><summary>Warum kann ich in Nacht 1 nicht schauen?</summary><p>Schlüsselloch und Spurenleser sind in der ersten Nacht noch beschäftigt. So gibt es immer mindestens zwei Nächte Spannung.</p></details><details><summary>Wir sind nur vier. Geht das?</summary><p>Ja. Mit vier Spielern gibt es einen Kobold, keine Prüf-Fähigkeiten und sechs Türgriffe.</p></details>';
  }

  /* ---------- Ablauf ---------- */
  function startGame() {
    var names = cleanNames();
    if (names.length < 4) { S.note = 'Ihr braucht mindestens 4 Spieler mit Namen.'; var p = document.createElement('p'); p.className = 'kn-note'; p.textContent = S.note; STAGE.appendChild(p); return; }
    setup.names = names; store('kobold-setup-v4', JSON.stringify(setup)); store('kobold-seen-v4', '1');
    resetFlow(); stopTimer(); S.G = E.create({ names: names, pool: POOL, level: setup.level }); S.phase = 'draw'; render();
  }
  function startNight() {
    var G = S.G; E.nightBegin(G); S.phase = 'nightIntro'; S.stepIdx = 0; S.sub = 'call'; S.sel = []; S.hitDoors = 0; S.result = null; S.note = '';
    var tpl = ['Auch du, {n}. Ich sehe dich blinzeln.', 'Und {n}, ich habe gesehen, dass du geschielt hast.', 'Ich zähle bis drei. {n}, dann sind auch deine Augen zu.', 'Wer hat da gekichert? Ja, {n}, ich meine dich.'];
    S.nightLine = 'Kicherwald schläft ein. Alle schließen die Augen. ' + pick(tpl).replace('{n}', pick(G.players).name);
    render(); sfx('owl'); say((G.night === 1 ? [{ id: 'tavi.pass.done' }] : []).concat([{ id: C.pickId('tavi.night', Math.random) }]));
  }
  function speakCall() { var ab = S.G.steps[S.stepIdx]; say([{ id: ab === 'kobold' ? (S.G.k === 1 ? 'tavi.kobold' : 'tavi.kobolds') : 'tavi.call.' + ab }]); }
  function nextStep() {
    var G = S.G; S.sel = []; S.sub = 'call'; S.result = null; S.note = '';
    if (S.stepIdx < G.steps.length - 1) { S.stepIdx++; render(); speakCall(); return; }
    var before = G.handles; E.resolveNight(G); S.hitDoors = before - G.handles; startMorning();
  }
  function nightPick() {
    var G = S.G, ab = G.steps[S.stepIdx], s = S.sel;
    if (ab === 'kobold') { E.setVictim(G, s[0]); if (G.fogLeft > 0 || G.imitLeft > 0) { S.sub = 'prank'; S.sel = []; render(); return; } return nextStep(); }
    if (ab === 'laterne') { E.setLantern(G, s[0]); return nextStep(); }
    if (ab === 'honig') { E.setTrap(G, s[0]); return nextStep(); }
    if (ab === 'schluessel') {
      var p = pid(s[0]), r = E.peek(G, s[0]);
      S.result = { title: r ? 'Kobold!' : 'Kein Kobold', p: p, team: true, sub: 'Durchs Schlüsselloch siehst du ' + esc(p.name) + (r ? ' mit Kichers Grinsen.' : ' ganz friedlich schlafen.') };
      S.sub = 'result'; render(); return;
    }
    if (ab === 'spur') {
      var a = pid(s[0]), b = pid(s[1]), n = E.trace(G, a.id, b.id);
      S.result = { title: n === 0 ? 'Keine Kobold-Spur' : n === 1 ? 'Eine Kobold-Spur' : 'Zwei Kobold-Spuren', sub: 'Unter ' + esc(a.name) + ' und ' + esc(b.name) + ' ' + (n === 0 ? 'ist kein Kobold.' : n === 1 ? 'ist genau ein Kobold. Welcher, verrät die Spur nicht.' : 'sind beide Kobolde!') };
      S.sub = 'result'; render(); return;
    }
  }
  function nightTap(id) {
    var G = S.G, ab = G.steps[S.stepIdx], max = (S.sub === 'call' && ab === 'spur') ? 2 : 1, i = S.sel.indexOf(id), allowed;
    if (S.sub === 'imitTarget') allowed = G.players.filter(function (p) { return !E.revealed(p); }).map(function (p) { return p.id; }); else if (S.sub === 'call') allowed = E.options(G, ab); else return;
    if (allowed.indexOf(id) < 0) return;
    if (i >= 0) S.sel.splice(i, 1); else { if (S.sel.length >= max) S.sel.shift(); S.sel.push(id); }
    sfx('pop'); render();
  }

  function startMorning() {
    var G = S.G, m = G.morning; S.phase = 'morning'; S.mstage = 0; S.mdone = false; S.sel = [];
    S.prank = null; S.frogTask = null;
    if (!G.winner) {
      if (setup.pranks) { var avail = C.PRANKS.filter(function (p) { return S.usedPranks.indexOf(p.id) < 0; }); if (!avail.length) { S.usedPranks = []; avail = C.PRANKS; } S.prank = pick(avail); S.usedPranks.push(S.prank.id); }
      if (m.how === 'frog') { var i = Math.floor(Math.random() * C.FROGTASKS.length); S.frogTask = { id: C.FROGTASK_IDS[i], text: C.FROGTASKS[i] }; }
    }
    render(); S.hitDoors = 0; sfx('creak'); vib([180, 80, 180]);
    runMorning();
  }
  async function runMorning() {
    var G = S.G, m = G.morning, my = ++S.mtoken;
    function live() { return S.phase === 'morning' && S.mtoken === my; }
    var doorId = G.handles <= 0 ? 'tavi.door.last' : G.handles === 1 ? 'tavi.door.last' : G.handles === 2 ? 'tavi.door.low' : pick(['tavi.door.1', 'tavi.door.2']);
    if (G.winner) { await say([{ id: doorId }]); return; }
    await say([{ id: C.pickId('tavi.morning', Math.random) }, { id: doorId }]); if (!live()) return; await sleep(500); if (!live()) return;
    S.mstage = 1; render(); if (m.how === 'frog') { sfx('croak'); vib([100, 60, 100, 60, 200]); } else if (m.how === 'honig') sfx('whoosh'); else sfx('chime');
    var spell = m.how === 'frog' ? C.pickId('tavi.frog', Math.random) : m.how === 'honig' ? 'tavi.honey' : m.how === 'dick' ? 'tavi.dick' : C.pickId('tavi.protected', Math.random);
    await say([{ id: spell }]); if (!live()) return; await sleep(500); if (!live()) return;
    S.mstage = 2; render(); sfx('owl');
    await say([{ id: C.pickId('tavi.murmur', Math.random) }, { c: m.mur.ch, murmur: true }]); if (!live()) return; await sleep(400); if (!live()) return;
    S.mstage = 3; render();
    var parts = [];
    if (S.prank) parts.push({ id: 'tavi.prank.intro' }, { id: S.prank.id });
    if (S.frogTask) parts.push({ id: 'tavi.frogtask.intro' }, { id: S.frogTask.id });
    if (parts.length) { sfx('sparkle'); await say(parts); if (!live()) return; }
    S.mdone = true; render();
  }
  function startDay() {
    var G = S.G; S.mtoken++; stopVoice(); S.phase = 'day'; S.talkLeft = G.L.talk; S.talkRun = false; S.redeLeft = 0; render();
  }

  /* Beratungs-Uhr: aktualisiert nur die Anzeige, damit Tippen nie verloren geht */
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function startTimer() {
    stopTimer();
    timer = setInterval(function () {
      if (!S.G || S.phase !== 'day') { stopTimer(); return; }
      if (S.redeLeft > 0) { S.redeLeft--; var rb = $('rbar'); if (rb) rb.style.width = (S.redeLeft / 60 * 100) + '%'; if (S.redeLeft === 0) { sfx('chime'); render(); } }
      if (S.talkLeft > 0) S.talkLeft--;
      var t = $('tmr'); if (t) { t.textContent = timeStr(S.talkLeft); t.classList.toggle('low', S.talkLeft <= 10 && S.talkLeft > 0); }
      if (S.talkLeft > 0 && S.talkLeft <= 10) sfx('tick');
      if (S.talkLeft === 10) say([{ id: 'tavi.time.10' }]);
      if (S.talkLeft === 0) { stopTimer(); S.talkRun = false; sfx('chime'); vib([300]); render(); say([{ id: 'tavi.time.up' }]); }
    }, 1000);
  }

  async function startCount() {
    S.voteSub = 'count'; S.count = 3; render(); say([{ id: 'tavi.vote' }]);
    for (var n = 3; n >= 1; n--) { S.count = n; var c = $('cnt'); if (c) { c.textContent = n; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; } sfx('knock'); vib(40); await sleep(900); if (S.phase !== 'vote' || S.voteSub !== 'count') return; }
    S.voteSub = 'point'; S.sel = []; render(); sfx('drum'); vib([60, 40, 200]);
  }
  async function doFlip() {
    S.revealSub = 'drum'; render(); sfx('drum'); vib([80, 50, 80, 50, 80, 50, 300]); say([{ id: 'tavi.accuse.2' }]);
    await sleep(1800); if (S.phase !== 'reveal') return;
    var G = S.G, before = G.handles, kob = E.accuse(G, S.accused), p = pid(S.accused);
    S.revealCost = before - G.handles; S.hitDoors = S.revealCost; S.revealSub = 'shown'; render();
    if (kob) { sfx('fanfare'); vib([200, 80, 200]); say([{ id: C.pickId('tavi.caught', Math.random) }, { c: KICHER }]); }
    else { sfx('thud'); setTimeout(function () { sfx('creak'); }, 350); vib([300, 100, 300]); say([{ id: S.revealCost >= 2 ? 'tavi.innocent.2' : 'tavi.innocent.1' }, { c: p.ch }]); }
  }
  function endGame() {
    var G = S.G; S.phase = 'end'; S.awards = null; stopTimer(); render();
    if (G.winner === 'dorf') { sfx('fanfare'); vib([200, 100, 200, 100, 400]); say([{ id: C.pickId('tavi.win', Math.random) }]); } else { sfx('sad'); say([{ id: C.pickId('tavi.lose', Math.random) }]); }
  }

  /* ---------- Ereignisse ---------- */
  ROOT.addEventListener('click', function (e) {
    var pc = e.target.closest('[data-pid]'), b = e.target.closest('[data-a],[data-level]');
    if (pc && !pc.disabled) {
      var id = +pc.getAttribute('data-pid');
      if (S.overlay === 'village') { actx(); say([{ c: pid(id).ch }]); return; }
      if (S.phase === 'night') nightTap(id); else if (S.phase === 'vote') { S.sel = (S.sel[0] === id) ? [] : [id]; sfx('pop'); render(); }
      return;
    }
    if (!b || b.disabled) return;
    var G = S.G; actx();
    if (b.hasAttribute('data-level')) { readNames(); setup.level = b.getAttribute('data-level'); render(); return; }
    var a = b.getAttribute('data-a');
    switch (a) {
      case 'sound': soundOn = !soundOn; if (!soundOn) stopVoice(); render(); break;
      case 'rules': S.overlay = 'rules'; render(); OVER.scrollIntoView && OVER.scrollIntoView({ block: 'start' }); break;
      case 'village': S.overlay = 'village'; render(); break;
      case 'closeOverlay': S.overlay = null; render(); break;
      case 'quit': if (S.quitArmed > Date.now() || !G || S.phase === 'end') { stopVoice(); stopTimer(); S.G = null; S.phase = 'setup'; S.quitArmed = 0; resetFlow(); S.overlay = null; render(); } else { S.quitArmed = Date.now() + 3500; render(); setTimeout(function () { if (S.quitArmed && S.quitArmed <= Date.now()) { S.quitArmed = 0; render(); } }, 3600); } break;
      case 'add': readNames(); if (setup.names.length < 9) setup.names.push(''); render(); break;
      case 'rm': readNames(); setup.names.splice(+b.getAttribute('data-i'), 1); render(); break;
      case 'begin': readNames(); startGame(); break;
      case 'drawShow': S.drawShown = true; render(); sfx('hat'); var dp = G.players[S.drawIdx]; say([{ id: C.pickId('tavi.draw', Math.random) }, { c: dp.ch }]); break;
      case 'drawNext': if (S.drawIdx < G.players.length - 1) { S.drawIdx++; S.drawShown = false; } else { S.phase = 'board'; say([{ id: 'tavi.board' }]); } render(); break;
      case 'toPass': S.phase = 'pass'; S.passIdx = 0; S.passShown = false; render(); say([{ id: C.pickId('tavi.pass', Math.random) }].filter(function (x) { return x.id; })); break;
      case 'passShow': S.passShown = true; sfx('sparkle'); render(); break;
      case 'passNext': if (S.passIdx < G.players.length - 1) { S.passIdx++; S.passShown = false; render(); say([{ id: 'tavi.pass.1' }]); } else { startNight(); } break;
      case 'nightGo': S.phase = 'night'; S.stepIdx = 0; S.sub = 'call'; S.sel = []; render(); speakCall(); break;
      case 'nightPick': nightPick(); break;
      case 'nightSkip': nextStep(); break;
      case 'nightDone': nextStep(); break;
      case 'prankFog': S.sub = 'fogTarget'; render(); break;
      case 'prankImit': S.sub = 'imitTarget'; S.sel = []; render(); break;
      case 'prankBack': S.sub = 'prank'; S.sel = []; render(); break;
      case 'fogPick': E.setFog(G, b.getAttribute('data-ab')); nextStep(); break;
      case 'imitPick': E.setImitate(G, S.sel[0]); nextStep(); break;
      case 'heal': E.heal(G); nextStep(); break;
      case 'book': var bid = E.book(G), bk = pid(bid), bh = E.holder(G, 'buch'); S.result = { title: 'Sicher im Dorf', p: bk, team: false, sub: 'In deinem Buch steht: ' + esc(bk.name) + ' (' + esc(bk.ch.n) + ') gehört ganz sicher zum Dorf.' + (E.isKob(bh) ? ' Du bist selbst Kobold, du darfst morgen aber auch etwas anderes behaupten.' : '') }; S.sub = 'result'; render(); break;
      case 'replayMur': if (G.morning && G.morning.mur) say([{ c: G.morning.mur.ch, murmur: true }]); break;
      case 'morningSkip': S.mtoken++; stopVoice(); S.mstage = 3; S.mdone = true; render(); break;
      case 'morningEnd': S.mtoken++; stopVoice(); endGame(); break;
      case 'toDay': startDay(); break;
      case 'talkToggle': if (S.talkLeft === 0) break; S.talkRun = !S.talkRun; if (S.talkRun) startTimer(); else stopTimer(); render(); break;
      case 'rede': E.useRede(G); S.redeLeft = 60; sfx('knock'); say([{ id: 'tavi.redestein' }]); if (!S.talkRun && S.talkLeft > 0) { S.talkRun = true; } startTimer(); render(); break;
      case 'toVote': stopTimer(); S.talkRun = false; S.phase = 'vote'; S.voteSub = 'ready'; S.sel = []; render(); if (E.finale(G)) say([{ id: 'tavi.finale' }]); break;
      case 'startCount': startCount(); break;
      case 'tie': S.voteSub = 'tie'; S.sel = []; render(); break;
      case 'nobody': E.nobody(G, 'nobody'); S.phase = 'evening'; render(); say([{ id: C.pickId('tavi.nobody', Math.random) }]); break;
      case 'nobodyTie': E.nobody(G, 'tie-nobody'); S.phase = 'evening'; render(); say([{ id: C.pickId('tavi.nobody', Math.random) }]); break;
      case 'accuse': S.accused = S.sel[0]; S.revealSub = 'ask'; S.phase = 'reveal'; render(); say([{ id: 'tavi.accuse.1' }]); break;
      case 'flip': doFlip(); break;
      case 'afterReveal': S.hitDoors = 0; if (G.winner) endGame(); else { S.phase = 'evening'; render(); say([{ id: 'tavi.evening.1' }]); } break;
      case 'nextNight': startNight(); break;
      case 'again': stopVoice(); stopTimer(); var nm = G.players.map(function (p) { return p.name; }); setup.names = nm; resetFlow(); S.G = E.create({ names: nm, pool: POOL, level: setup.level }); S.phase = 'draw'; S.overlay = null; render(); break;
    }
  });
  /* Neuzeichnen verschieben, solange ein Finger drückt: sonst geht ein Tippen verloren, wenn gerade etwas umblendet. */
  ROOT.addEventListener('pointerdown', function () { S.press = true; clearTimeout(S.pressT); S.pressT = setTimeout(function () { S.press = false; if (S.deferred) { S.deferred = false; render(); } }, 1500); }, true);
  function pressEnd() { S.press = false; clearTimeout(S.pressT); if (S.deferred) setTimeout(function () { if (S.deferred && !S.press) { S.deferred = false; render(); } }, 30); }
  ROOT.addEventListener('pointerup', pressEnd, true); ROOT.addEventListener('pointercancel', pressEnd, true);
  ROOT.addEventListener('input', function (e) { if (e.target.id && e.target.id.indexOf('nm') === 0) setup.names[+e.target.id.slice(2)] = e.target.value; });
  ROOT.addEventListener('change', function (e) { if (e.target.id === 'pranks') { setup.pranks = e.target.checked; } });
    function readNames() { setup.names = setup.names.map(function (n, i) { var el = $('nm' + i); return el ? el.value : n; }); var pr = $('pranks'); if (pr) setup.pranks = pr.checked; }
  document.addEventListener('visibilitychange', function () { if (document.hidden) { stopVoice(); if (S.talkRun) { S.talkRun = false; stopTimer(); if (S.phase === 'day') render(); } } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.overlay) { S.overlay = null; render(); } });

  if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function () { }; } catch (e) { } }
  render();
  ROOT.taleaTest = { S: S, E: E, C: C, setup: setup, setFast: function (v) { FAST = !!v; ROOT.classList.toggle('fast', FAST); }, render: render, get G() { return S.G; }, say: say, recorded: recorded, CLIPS: CLIPS, CHARS: CHARS };
})();
