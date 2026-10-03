/* Bots für Balance-Simulationen. Das Dorf rechnet bayessch über alle möglichen Kobold-Verteilungen. */
'use strict';
var E = require('./engine.js');

function combos(arr, k) {
  var out = [];
  (function rec(start, cur) {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (var i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
  })(0, []);
  return out;
}

var VALUE = { schluessel: 4, spur: 4, trost: 3, honig: 2, laterne: 3, buch: 1, rede: 2, glocke: 3, dick: 1 };
function valueOf(G, p) {
  var v = VALUE[p.ab] || 1;
  if (p.ab === 'schluessel' && p.uses.peek <= 0) v = 0.5;
  if (p.ab === 'spur' && p.uses.trace <= 0) v = 0.5;
  if (p.ab === 'trost' && p.uses.heal <= 0) v = 0.5;
  if (p.ab === 'honig' && p.uses.trap <= 0) v = 0.5;
  return v;
}

/* ---------- öffentliche Wahrscheinlichkeit ---------- */
function posterior(G, br) {
  var U = G.players.filter(function (p) { return !E.revealed(p); }).map(function (p) { return p.id; });
  var kA = E.activeKobolds(G).length;
  var caughtNow = G.players.filter(function (p) { return p.caught; }).map(function (p) { return p.id; });
  var H = combos(U, kA), W = [], tot = 0;
  H.forEach(function (h) {
    var F = {}; h.forEach(function (i) { F[i] = 1; }); caughtNow.forEach(function (i) { F[i] = 1; });
    var w = 1;
    br.ev.forEach(function (e) {
      if (e.t === 'mur') {
        var den = 0; e.pool.forEach(function (i) { den += F[i] ? G.rules.murKob : G.rules.murOther; });
        w *= (F[e.who] ? G.rules.murKob : G.rules.murOther) / den;
      } else if (e.t === 'honey') {
        w *= ((F[e.pair[0]] ? 1 : 0) + (F[e.pair[1]] ? 1 : 0)) === 1 ? 1 : 0.02;
      } else if (e.t === 'victim') {
        w *= F[e.who] ? 0.5 : 1;
      } else if (e.t === 'claim') {
        var holderCaught = G.players[e.h].caught;
        if (holderCaught) return;
        var holderKob = !!F[e.h];
        if (holderKob) { w *= 0.5; return; }
        var truth;
        var Fe = function (i) { return !!F[i] && e.caughtAt.indexOf(i) < 0; };
        if (e.k === 'peek') truth = (Fe(e.a) === e.r);
        else if (e.k === 'trace') truth = (((Fe(e.a) ? 1 : 0) + (Fe(e.b) ? 1 : 0)) === e.n);
        else if (e.k === 'book') truth = !Fe(e.a);
        w *= truth ? 1 : (br.claimFalse != null ? br.claimFalse : 0.02);
      }
    });
    W.push(w); tot += w;
  });
  var m = {}; G.players.forEach(function (p) { m[p.id] = p.caught ? 1 : 0; });
  if (tot <= 0) { U.forEach(function (i) { m[i] = kA / U.length; }); return m; }
  H.forEach(function (h, idx) { h.forEach(function (i) { m[i] += W[idx] / tot; }); });
  return m;
}

function argmaxBy(ids, f, rng) {
  var best = -Infinity, arr = [];
  ids.forEach(function (i) { var v = f(i); if (v > best + 1e-12) { best = v; arr = [i]; } else if (Math.abs(v - best) <= 1e-12) arr.push(i); });
  return E.pick(arr, rng);
}

/* ---------- eine Partie ---------- */
function play(o) {
  var rng = o.rng, pool = o.pool;
  var G = E.create({ names: o.names, pool: pool, level: o.level, levelCfg: o.levelCfg, rng: rng, rules: o.rules });
  var br = { ev: [], claimFalse: (o.bot && o.bot.claimFalse) };
  var cfg = Object.assign({ theta: 0.45, agree: 0.7, smartKobold: true, honestVillage: true, useRede: 0.5, fogP: 0.8, imitP: 0.5 }, o.bot || {});
  var stats = { acc: 0, wrongAcc: 0, nobody: 0, nights: 0, ties: 0 };
  var claims = [];

  function post() { return posterior(G, br); }
  function pushClaim(c) { c.caughtAt = G.players.filter(function (p) { return p.caught; }).map(function (p) { return p.id; }); c.t = 'claim'; br.ev.push(c); }

  var guard = 0;
  while (!G.winner && guard++ < 60) {
    E.nightBegin(G);
    var pending = [], pm = post();
    G.steps.forEach(function (ab) {
      if (G.winner) return;
      var h = ab === 'kobold' ? null : E.holder(G, ab);
      var opts = E.options(G, ab);
      if (ab === 'kobold') {
        var vill = opts.filter(function (i) { return !E.isKob(G.players[i]) && !E.revealed(G.players[i]); });
        if (!vill.length) vill = opts.filter(function (i) { return !E.isKob(G.players[i]); });
        if (!vill.length) vill = opts;
        var pick1;
        if (cfg.smartKobold) {
          var bag = []; vill.forEach(function (i) { var w = Math.round(valueOf(G, G.players[i]) * 2); for (var j = 0; j < w; j++) bag.push(i); });
          pick1 = E.pick(bag.length ? bag : vill, rng);
        } else pick1 = E.pick(vill, rng);
        E.setVictim(G, pick1); G.__victimPick = pick1;
        if (G.fogLeft > 0 && rng() < cfg.fogP) {
          var fg = ['schluessel', 'spur'].filter(function (a) { var hh = E.holder(G, a); return hh && !E.isKob(hh) && E.available(G, a); });
          if (fg.length) E.setFog(G, E.pick(fg, rng));
        }
        if (G.imitLeft > 0 && rng() < cfg.imitP) {
          var fr = G.players.filter(function (p) { return !E.isKob(p) && !E.revealed(p); });
          if (fr.length) E.setImitate(G, E.pick(fr, rng).id);
        }
        return;
      }
      if (!E.available(G, ab)) return;
      var hk = E.isKob(h);
      if (ab === 'laterne') {
        var cand = opts.slice();
        var t;
        if (hk) { cand = cand.filter(function (i) { return i !== G.nd.target && !E.isKob(G.players[i]); }); t = E.pick(cand.length ? cand : opts, rng); }
        else { t = argmaxBy(cand, function (i) { return valueOf(G, G.players[i]) + rng() * 1.5 + (i === h.id ? -0.5 : 0); }, rng); }
        E.setLantern(G, t);
      } else if (ab === 'honig') {
        var c2 = opts.slice();
        if (hk) { c2 = c2.filter(function (i) { return i !== G.nd.target; }); E.setTrap(G, E.pick(c2.length ? c2 : opts, rng)); }
        else E.setTrap(G, argmaxBy(c2, function (i) { return valueOf(G, G.players[i]) + rng() * 1.5; }, rng));
      } else if (ab === 'trost') {
        if (hk) return;
        var v = G.players[G.nd.target];
        if (valueOf(G, v) >= 2.5 || G.night >= 3 || rng() < 0.25) E.heal(G);
      } else if (ab === 'schluessel') {
        if (hk) {
          var vv = opts.filter(function (i) { return !E.isKob(G.players[i]); });
          var tt = E.pick(vv.length ? vv : opts, rng); var real = E.peek(G, tt);
          pending.push({ k: 'peek', h: h.id, a: tt, r: true }); // Lüge: "Kobold!"
        } else {
          var tp = argmaxBy(opts, function (i) { return pm[i] + rng() * 0.01; }, rng);
          var res = E.peek(G, tp);
          if (res !== null) pending.push({ k: 'peek', h: h.id, a: tp, r: res });
        }
      } else if (ab === 'spur') {
        if (hk) {
          var vv2 = opts.filter(function (i) { return !E.isKob(G.players[i]); }); vv2 = E.shuffle(vv2, rng);
          var a1 = vv2[0], b1 = vv2[1] != null ? vv2[1] : opts[0];
          E.trace(G, a1, b1); pending.push({ k: 'trace', h: h.id, a: a1, b: b1, n: 1 });
        } else {
          var sorted = opts.slice().sort(function (x, y) { return pm[y] - pm[x] + (rng() - 0.5) * 0.001; });
          var a2 = sorted[0], b2 = sorted[1];
          var n = E.trace(G, a2, b2); if (n !== null) pending.push({ k: 'trace', h: h.id, a: a2, b: b2, n: n });
        }
      } else if (ab === 'buch') {
        var id = E.book(G);
        if (hk) { var mates = E.activeKobolds(G).filter(function (p) { return p.id !== h.id; }); if (mates.length) id = mates[0].id; }
        pending.push({ k: 'book', h: h.id, a: id });
      }
    });
    if (G.winner && G.handles <= 0 && !G.morning) {}
    var m = E.resolveNight(G); stats.nights = G.night;
    // öffentliche Beweise
    var poolIds = G.players.filter(function (p) { return !E.revealed(p); }).map(function (p) { return p.id; });
    if (m.mur) br.ev.push({ t: 'mur', who: m.mur.id, pool: poolIds });
    if (m.honey) br.ev.push({ t: 'honey', pair: m.honey });
    if (m.victim && m.how !== 'dick') br.ev.push({ t: 'victim', who: m.victim.id });
    if (m.victim && m.how === 'dick') br.ev.push({ t: 'victim', who: m.victim.id });
    pending.forEach(pushClaim);
    if (G.winner) break;

    // Tag
    var pp = post();
    var frogs = {}; G.players.forEach(function (p) { if (p.frog) frogs[p.id] = 1; });
    var rh = E.holder(G, 'rede');
    if (E.canRede(G) && rng() < cfg.useRede) E.useRede(G);
    var fingers = {}, up = 0;
    var unrev = G.players.filter(function (p) { return !E.revealed(p); }).map(function (p) { return p.id; });
    G.players.forEach(function (p) {
      if (frogs[p.id]) return;
      var weight = (G.redeToday && rh && rh.id === p.id) ? 2 : 1;
      if (E.isKob(p)) {
        var targets = unrev.filter(function (i) { return !E.isKob(G.players[i]); });
        if (!targets.length) return;
        if (rng() < 0.12) { up += weight; return; }
        var tg = argmaxBy(targets, function (i) { return pp[i] + rng() * 0.05; }, rng);
        fingers[tg] = (fingers[tg] || 0) + weight; return;
      }
      var cands = unrev.filter(function (i) { return i !== p.id; });
      if (!cands.length) { up += weight; return; }
      var top = argmaxBy(cands, function (i) { return pp[i] + rng() * 0.001; }, rng);
      if (pp[top] < cfg.theta) { up += weight; return; }
      var tg2;
      if (rng() < cfg.agree) tg2 = top;
      else { var bag = []; cands.forEach(function (i) { var w = Math.max(1, Math.round(pp[i] * pp[i] * 20)); for (var j = 0; j < w; j++) bag.push(i); }); tg2 = E.pick(bag, rng); }
      fingers[tg2] = (fingers[tg2] || 0) + weight;
    });
    var best = 0, tops = []; Object.keys(fingers).forEach(function (k) { var c = fingers[k]; if (c > best) { best = c; tops = [+k]; } else if (c === best) tops.push(+k); });
    var target = null;
    if (!tops.length || up >= best) { stats.nobody++; }
    else if (tops.length === 1) target = tops[0];
    else {
      stats.ties++;
      var gl = E.holder(G, 'glocke');
      if (gl && !gl.frog) target = argmaxBy(tops, function (i) { return pp[i] + rng() * 0.001; }, rng);
    }
    if (target != null) {
      stats.acc++;
      var wasKob = E.accuse(G, target);
      if (!wasKob) stats.wrongAcc++;
      else { br.ev = br.ev.filter(function (e) { return true; }); }
    }
  }
  return { winner: G.winner, nights: G.night, handles: G.handles, max: G.max, kobolds: G.k, stats: stats, G: G };
}

function run(n, N, level, rules, bot, seed, pool, levelCfg) {
  var rng = E.mulberry(seed || 1);
  var names = []; for (var i = 0; i < N; i++) names.push('S' + i);
  var agg = { n: n, dorf: 0, nights: 0, hist: {}, margin: {}, wrong: 0, acc: 0, nobody: 0, early: 0, close: 0, left: 0 };
  for (var g = 0; g < n; g++) {
    var r = play({ names: names, pool: pool, level: level, levelCfg: levelCfg, rules: rules, bot: bot, rng: rng });
    if (r.winner === 'dorf') agg.dorf++;
    agg.nights += r.nights; agg.hist[r.nights] = (agg.hist[r.nights] || 0) + 1;
    agg.wrong += r.stats.wrongAcc; agg.acc += r.stats.acc; agg.nobody += r.stats.nobody;
    if (r.nights <= 1) agg.early++;
    var hl = Math.max(0, r.handles);
    if (r.winner === 'dorf') { agg.left += hl; if (hl <= 2) agg.close++; } else agg.close++;
  }
  return agg;
}

module.exports = { play: play, run: run, posterior: posterior };

if (require.main === module) {
  var pool = require('./chars.json').filter(function (c) { return c.a !== 'kobold'; });
  var arg = process.argv.slice(2), n = +arg[0] || 3000;
  console.log('Spieler | Stufe | Dorf% | Nächte | in 1 Nacht fertig | knapp (≤2 Griffe/Kobold-Sieg) | falsche Anklagen/Partie | Anklagen/Partie');
  [4, 5, 6, 7, 8, 9].forEach(function (N) {
    ['voll'].forEach(function (lv) {
      var a = run(n, N, lv, null, null, 7, pool);
      console.log(N + ' | ' + lv + ' | ' + (100 * a.dorf / a.n).toFixed(0) + '% | ' + (a.nights / a.n).toFixed(1) + ' | ' + (100 * a.early / a.n).toFixed(0) + '% | ' + (100 * a.close / a.n).toFixed(0) + '% | ' + (a.wrong / a.n).toFixed(2) + ' | ' + (a.acc / a.n).toFixed(2));
    });
  });
}
