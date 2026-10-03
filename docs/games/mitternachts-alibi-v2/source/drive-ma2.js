'use strict';
/* Spielt Mitternachts-Alibi v2 über die echte Oberfläche (Playwright). Aufruf: node drive-ma2.js <html> <partien> [tag] [spieler] [stufe] [breite]
 * Prüft nebenbei: Fehler, Hänger, Eindeutigkeit des Täters, fehlende Sprech-Clips, ob Privates nur geflüstert wird,
 * ob Öffentliches nie Flüster-Clips benutzt, horizontales Scrollen, und ob jeder besuchte Schritt etwas spricht. */
var path = require('path'), { pathToFileURL } = require('url');
var launch = require('./pw.js');
var file = process.argv[2], games = +process.argv[3] || 1, tag = process.argv[4] || '', nPlayers = +process.argv[5] || 0, level = process.argv[6] || '', width = +process.argv[7] || 400;
var watch = { t: Date.now(), key: '', trail: [] };
var wd = setInterval(function () { if (Date.now() - watch.t > 40000) { console.log('HÄNGT seit 40 s bei:', watch.key, '| Weg:', watch.trail.slice(-12).join(' | ')); process.exit(2); } }, 2000);
(async () => {
  var cover = {}, allClips = null;
  var b = await launch(), errs = [], st = { games: 0, caught: 0, escaped: 0, stuck: 0, uniqOk: 0, uniqBad: 0, soft: 0, duels: 0, duelBadPair: 0, flagMissCulprit: 0, flagGames: 0, overflow: 0, missing: 0, privLeak: 0, pubWhisper: 0, whisperNotPriv: 0, spoken: { pub: 0, priv: 0 }, noSay: {}, phases: {} };
  var ctx = await b.newContext({ viewport: { width: width, height: 860 } });
  for (var g = 0; g < games; g++) {
    var p = await ctx.newPage();
    p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    if (process.env.REAL) await p.addInitScript(() => { window.SpeechSynthesisUtterance = function (t) { this.text = t; }; window.speechSynthesis = { speak: function (u) { window.__spoken = (window.__spoken || 0) + 1; setTimeout(function () { if (u.onend) u.onend(); }, 5); }, cancel: function () { }, getVoices: function () { return []; }, onvoiceschanged: null }; });
    await p.goto(pathToFileURL(path.resolve(file)).href);
    await p.evaluate(({ n, lv, du, pu, re }) => {
      window.__duel = !!du; window.__pure = !!pu; window.__real = !!re;
      var T = document.getElementById('talea-alibi').taleaTest; if (!window.__real) T.setFast(true);
      if (n) T.setup.count = n; if (lv) T.setup.level = lv; T.render();
    }, { n: nPlayers, lv: level, du: !!process.env.DUEL, pu: !!process.env.PURE, re: !!process.env.REAL });
    watch.t = Date.now(); var shots = new Set(), steps = 0, done = false, seenKeys = {}, trail = [];
    while (steps++ < 900 && !done) {
      var info = await p.evaluate(() => {
        if (document.getElementById('talea-alibi').taleaTest.S.overlay) document.getElementById('talea-alibi').taleaTest.S.overlay = null;
        var T = document.getElementById('talea-alibi').taleaTest, S = T.S, W = S.W, q = s => document.querySelector('#talea-alibi ' + s);
        var en = s => [...document.querySelectorAll('#talea-alibi ' + s)].filter(x => !x.disabled && x.offsetParent !== null);
        var pick = a => a[Math.floor(Math.random() * a.length)];
        var click = sel => { var el = q(sel); if (el && !el.disabled) { el.setAttribute('data-hit', '1'); return true; } return false; };
        var clickRandom = sel => { var l = en(sel); if (!l.length) return false; pick(l).setAttribute('data-hit', '1'); return true; };
        var key = S.phase + (W ? ':' + T.subState() : '');
        if (S.phase === 'act' && S.actSub === 'whisper' && W) key += (T.curP() === W.culprit && S.act === 1 ? ':lie' : '');
        key += W && S.phase === 'act' ? ':a' + S.act : '';
        if (W && S.phase === 'round' && S.roundSub === 'duel' && S.duel) key += ':' + S.duel.step;
        var act = 'none';
        function A(n, ok) { if (ok) { act = n; return true; } return false; }
        var sw = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        if (!W) A('begin', click('[data-a=begin]'));
        else switch (S.phase) {
          case 'cast': A('cast', click('[data-a=castShow]') || click('[data-a=castNext]') || click('[data-a=toCase]')); break;
          case 'caseIntro': A('case', click('[data-a=toAct]')); break;
          case 'act':
            if (S.actSub === 'intro') A('actGo', click('[data-a=actGo]'));
            else if (S.actSub === 'hand') A('answer', click('[data-a=handAnswer]'));
            else if (S.actSub === 'whisper') {
              var i = T.curP(), r = window.__pure ? .9 : Math.random();
              if (i === W.culprit && S.act === 1) {
                if (!S.draft.place) A('draftPlace', clickRandom('[data-a=draftPlace]'));
                else if (S.draft.comp.length < 1 && r < .4) A('draftComp', clickRandom('[data-a=draftComp]'));
                else if (r < .1) A('again', click('[data-a=whisperAgain]'));
                else A('announce', click('[data-a=toAnnounce]'));
              } else if (r < .12) A('hide', click('[data-a=hide]') || click('[data-a=unhide]'));
              else if (r < .2) A('again', click('[data-a=whisperAgain]'));
              else if (S.hidden) A('unhide', click('[data-a=unhide]'));
              else A('announce', click('[data-a=toAnnounce]'));
            } else if (S.actSub === 'announce') { if (!window.__pure && Math.random() < .15) A('res', clickRandom('[data-res]')); else A('annNext', click('[data-a=annNext]')); }
            else A('actDone', click('[data-a=actDoneNext]'));
            break;
          case 'round':
            if (S.roundSub === 'duel') {
              var d = S.duel;
              if (d.step === 'call') { if (!window.__pure && Math.random() < .3) A('sight', clickRandom('[data-a=sightTap]')); else A('duelGo', click('[data-a=duelGo]')); }
              else if (d.step === 'count') act = 'wait';
              else if (d.step === 'show') A('duelRes', (function () { var l = en('[data-a=duelRes]'); if (!l.length) return false; pick(l).setAttribute('data-hit', '1'); return true; })());
              else A('duelClose', click('[data-a=duelClose]'));
            } else if (S.roundSub === 'talk') {
              var r2 = Math.random(); if (window.__pure) r2 = .9; if (window.__duel && S.duelLog.length < 1) r2 = .4;
              if (r2 < .1) A('prompt', click('[data-a=newPrompt]')); else if (r2 < .15) A('speak', click('[data-a=speakPrompt]')); else if (r2 < .22) A('timer', click('[data-a=talkToggle]')); else if (r2 < .3) A('tab', clickRandom('[data-a=tab]')); else if (r2 < .45 && S.duelLog.length < 4) A('duel', click('[data-a=duel]')); else A('spur', click('[data-a=getSpur]'));
            } else { if (S.round >= 2 && Math.random() < .25 && click('[data-a=toVote]')) act = 'toVote'; else A('afterSpur', click('[data-a=afterSpur]')); }
            break;
          case 'vote':
            if (S.voteSub === 'ready') A('count', click('[data-a=startCount]'));
            else if (S.voteSub === 'count') act = 'wait';
            else {
              if (S.sel.length < 1) {
                if (Math.random() < .08 && click('[data-a=tie]')) { act = 'tie'; break; }
                var l = en('[data-pid]'); var target = (Math.random() < .6) ? l.find(x => +x.getAttribute('data-pid') === W.culprit) : null; (target || pick(l)).setAttribute('data-hit', '1'); act = 'vsel';
              } else A('accuse', click('[data-a=accuse]'));
            }
            break;
          case 'reveal': if (S.revealSub === 'ask') A('flip', click('[data-a=flip]')); else if (S.revealSub === 'shown') A('after', click('[data-a=afterReveal]')); else act = 'wait'; break;
          case 'end': act = 'END'; break;
        }
        var check = null;
        if (W && S.phase === 'vote' && S.voteSub === 'ready') { var sp = S.spuren.slice(0, S.spurShown), cand = T.E.candidates(W, S.claims, sp); check = { cand: cand, culprit: W.culprit, spurShown: S.spurShown, spurTotal: S.spuren.length }; }
        var flagInfo = null; if (W && S.phase === 'round' && S.roundSub === 'talk' && S.round === 1 && S.spurShown === 0 && S.flags) flagInfo = { culpritIn: S.flags.alone.indexOf(W.culprit) >= 0 || S.flags.conf.some(c => c.a === W.culprit || c.b === W.culprit) };
        var duelInfo = null; if (W && S.phase === 'round' && S.roundSub === 'duel' && S.duel && S.duel.step === 'call') { var dd = S.duel, ca = S.claims[dd.a][dd.t], cb = S.claims[dd.b][dd.t]; duelInfo = { ok: ca.place === cb.place && ca.place === dd.place }; }
        return { key: key, act: act, phase: S.phase, caught: S.finalCaught, check: check, flagInfo: flagInfo, duelInfo: duelInfo, sw: sw, logN: T.LOG.length };
      });
      st.phases[info.key] = (st.phases[info.key] || 0) + 1; seenKeys[info.key] = info.logN; trail.push(info.key + '>' + info.act); watch.t = Date.now(); watch.key = info.key; watch.trail = trail;
      if (info.sw) { st.overflow++; errs.push('HORIZONTAL SCROLL in ' + info.key); }
      if (info.check) { if (info.check.cand.length === 1 && info.check.cand[0] === info.check.culprit) st.uniqOk++; else if (info.check.spurShown >= info.check.spurTotal) { st.uniqBad++; errs.push('UNEINDEUTIG nach allen Spuren: ' + JSON.stringify(info.check)); } }
      if (info.flagInfo) { st.flagGames++; if (!info.flagInfo.culpritIn) st.flagMissCulprit++; }
      if (info.duelInfo) { st.duels++; if (!info.duelInfo.ok) st.duelBadPair++; }
      if (tag && g === 0 && !shots.has(info.key)) { shots.add(info.key); await p.waitForTimeout(80); await p.screenshot({ path: 'shots/' + tag + '-' + String(shots.size).padStart(2, '0') + '-' + info.key.replace(/[^a-zA-Z0-9]+/g, '_') + '.png', fullPage: true }); }
      if (info.act === 'END') { done = true; st.games++; if (info.caught) st.caught++; else st.escaped++; if (tag && g === 0) { await p.waitForTimeout(100); await p.screenshot({ path: 'shots/' + tag + '-END.png', fullPage: true }); } break; }
      if (info.act === 'none') { st.stuck++; errs.push('STUCK in ' + info.key); if (tag) await p.screenshot({ path: 'shots/STUCK-' + info.key.replace(/[^a-zA-Z0-9]+/g, '_') + '.png', fullPage: true }); break; }
      if (info.act !== 'wait') { try { await p.click('[data-hit="1"]', { timeout: 1500 }); } catch (e) { st.soft++; } await p.evaluate(() => document.querySelectorAll('[data-hit]').forEach(e => e.removeAttribute('data-hit'))); }
      else await p.waitForTimeout(process.env.REAL ? 120 : 8);
    }
    if (!done && steps >= 900) errs.push('ZU LANG ohne Ende');
    /* Auswertung des Sprech-Protokolls */
    if (!allClips) allClips = await p.evaluate(() => Object.keys(document.getElementById('talea-alibi').taleaTest.CLIPS));
    var rep = await p.evaluate(() => {
      var T = document.getElementById('talea-alibi').taleaTest, out = { missing: [], privLeak: [], pubWhisper: [], whisperNotPriv: [], pub: 0, priv: 0, keys: {}, sec: 0, byPhase: {}, allIds: Array.from(new Set(T.LOG.reduce(function (a, e) { return a.concat(e.ids); }, []))), allFx: Array.from(new Set(T.LOG.reduce(function (a, e) { return a.concat(e.fx || []); }, []))), transcript: T.LOG.map(function (e) { return (e.priv ? '[flüstert] ' : '[laut]     ') + e.phase + ':' + e.sub + '  ' + e.ids.map(function (id) { var c = T.CLIPS[id]; return c ? c.text : '??' + id; }).join(' '); }) };
      T.LOG.forEach(function (e) {
        var k = e.phase + ':' + e.sub; out.keys[k] = (out.keys[k] || 0) + 1;
        e.ids.forEach(function (id) {
          var c = T.CLIPS[id]; if (!c) { out.missing.push(id); return; }
          var sec = c.text.length / 14.5 + .14; out.sec += sec; out.byPhase[e.phase] = (out.byPhase[e.phase] || 0) + sec;
          if (e.priv) { out.priv += c.text.length; if (/^character\./.test(id) || (c.kind === 'name') || /^kom\.(ann|duel|einspruch|alone|round|spur|case|accuse|vote)/.test(id)) out.privLeak.push(id); }
          else { out.pub += c.text.length; if (c.whisper) out.pubWhisper.push(id); }
        });
        if (e.phase === 'act' && e.sub === 'whisper' && !e.priv) out.whisperNotPriv.push(e.ids.join(','));
      });
      return out;
    });
    if (process.env.TRANSCRIPT && g === 0) console.log(rep.transcript.join(String.fromCharCode(10))); rep.allIds.forEach(function (id) { cover[id] = 1; }); st.sec = (st.sec || 0) + rep.sec; Object.keys(rep.byPhase).forEach(function (k) { st.byPhase = st.byPhase || {}; st.byPhase[k] = (st.byPhase[k] || 0) + rep.byPhase[k]; }); st.missing += rep.missing.length; st.privLeak += rep.privLeak.length; st.pubWhisper += rep.pubWhisper.length; st.whisperNotPriv += rep.whisperNotPriv.length; st.spoken.pub += rep.pub; st.spoken.priv += rep.priv;
    rep.missing.slice(0, 3).forEach(id => errs.push('CLIP FEHLT ' + id)); rep.privLeak.slice(0, 3).forEach(id => errs.push('PRIVAT LAUT? ' + id)); rep.pubWhisper.slice(0, 3).forEach(id => errs.push('FLÜSTER-CLIP ÖFFENTLICH ' + id)); rep.whisperNotPriv.slice(0, 3).forEach(x => errs.push('WHISPER NICHT LEISE ' + x));
    Object.keys(seenKeys).forEach(function (k) { var ph = k.split(':')[0], sub = k.split(':')[1]; var lk = ph + ':' + (sub || ''); if (!rep.keys[lk] && !/^(setup|vote:count|vote:point|reveal:drum|round:count)/.test(k)) st.noSay[k] = (st.noSay[k] || 0) + 1; });
    await p.close();
  }
  console.log(JSON.stringify({ games: st.games, caught: st.caught, escaped: st.escaped, stuck: st.stuck, eindeutigBeiAnklage: st.uniqOk, uneindeutigNachAllenSpuren: st.uniqBad, duelle: st.duels, duellFalschesPaar: st.duelBadPair, flagSpielerMitTaeter: st.flagGames - st.flagMissCulprit + '/' + st.flagGames, breitenFehler: st.overflow, softClicks: st.soft, clipFehlt: st.missing, privatLaut: st.privLeak, fluesterOeffentlich: st.pubWhisper, whisperNichtLeise: st.whisperNotPriv, zeichenGesprochen: st.spoken, sprechMinProPartie: +(st.sec / 60 / Math.max(1, st.games)).toFixed(1), minProPhase: Object.keys(st.byPhase || {}).reduce(function (o, k) { o[k] = +(st.byPhase[k] / 60 / Math.max(1, st.games)).toFixed(1); return o; }, {}) }));
  if (process.env.COVER) { var unused = (allClips || []).filter(function (id) { return !cover[id] && !/^character./.test(id) && !/^(name|numc?|w.numc?|sight|w.sight|kom.case)./.test(id); }); console.log('Nie gesprochene Clips (ohne Figuren, Namen, Zahlen, Bilder, Fälle):', unused.length ? unused.join(', ') : 'keine'); var chars = Object.keys(cover).filter(function (id) { return /^character./.test(id); }).length, names = Object.keys(cover).filter(function (id) { return /^name./.test(id); }).length; console.log('Figurenzeilen gesprochen:', chars, '· Namen:', names, '· Zahlen:', Object.keys(cover).filter(function (id) { return /^numc?./.test(id); }).length, '· Bilder:', Object.keys(cover).filter(function (id) { return /^sight./.test(id); }).length, '· Flüsterbilder:', Object.keys(cover).filter(function (id) { return /^w.sight./.test(id); }).length); }
  console.log('Schritte ohne Sprache:', JSON.stringify(st.noSay));
  console.log('Phasen:', Object.keys(st.phases).sort().join(' | '));
  console.log('Fehler:', errs.length ? [...new Set(errs)].slice(0, 14) : 'keine');
  clearInterval(wd); await b.close();
})();
