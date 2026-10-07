/** Exercises the local Android bundle, using a fixture implementation of the native bridge. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require_ = createRequire(import.meta.url);
let playwright;
for (const source of [process.env.PLAYWRIGHT_PATH, 'playwright', path.join(os.homedir(), '.claude/skills/ref2game/scripts/node_modules/playwright'), path.join(os.homedir(), '.codex/skills/ref2game/scripts/node_modules/playwright')].filter(Boolean)) {
  try { playwright = require_(source); break; } catch {}
}
if (!playwright) throw new Error('Playwright missing; set PLAYWRIGHT_PATH or install it with Bun.');
const out = path.join(repo, 'scripts/game-qa/out');
const bundle = path.join(out, 'android-alibi');
const text = await fs.readFile(path.join(repo, 'frontend/screens/Game/alibi/data/characters.ts'), 'utf8');
const chars = JSON.parse(text.match(/=\s*(\[[\s\S]*\]);/)[1]);
const faces = ['eule', 'katze', 'frosch', 'huhn', 'ziege', 'fledermaus', 'schnecke', 'taube', 'maus', 'enten', 'kaefer', 'pferd'];
const pool = chars.map((c, i) => ({ name: c.n, imageUrl: `game/alibi/sights/${faces[i % faces.length]}.webp` }));
const browser = await playwright.chromium.launch({ args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { phases: [], games: [], errors: [], media: 0, bridge: [] };

async function open(view = { width: 390, height: 844 }, storage = {}) {
  const context = await browser.newContext({ viewport: view });
  await context.exposeBinding('alibiNative', async ({ page }, m) => {
    if (m.type === 'save') storage[m.key] = m.value;
    if (m.type === 'error') report.errors.push(m.message);
    if (['speak', 'audioPlay', 'audioPrivacy', 'speechStop', 'exit'].includes(m.type)) report.bridge.push(m);
    if (!m.id) return;
    if ((m.type === 'audioPlay' || m.type === 'speak' || m.type === 'audioPrivacy') && await page.evaluate(() => !!window.__failPrivateAudio) && (m.priv || m.on)) {
      const code = await page.evaluate(() => window.__failPrivateAudio === 'route' ? 'PRIVATE_ROUTE' : undefined);
      if (code) await page.evaluate(() => window.__alibiReceive({ event: 'audioRouteFailed' }));
      await page.evaluate(message => window.__alibiReceive(message), { id: m.id, error: 'Hörmuschel nicht verfügbar', code });
      return;
    }
    const value = m.type === 'bootstrap' ? storage : m.type === 'characters' ? { characters: pool } : null;
    await page.evaluate(message => window.__alibiReceive(message), { id: m.id, value });
  });
  await context.addInitScript(() => {
    window.ReactNativeWebView = { postMessage: raw => { void window.alibiNative(JSON.parse(raw)); } };
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) report.errors.push(`Unexpected network: ${request.url()}`); });
  await page.goto(pathToFileURL(path.join(bundle, 'index.html')).href);
  await page.waitForFunction(() => !!window.__alibiTest);
  await page.locator('[data-a="launch"]').click();
  return { page, context, storage };
}

try {
  for (const view of [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 800, height: 1280 }]) {
    const { page, context } = await open(view);
    for (const phase of ['cast', 'case', 'act0', 'whisper', 'claim', 'announce', 'act0done', 'act1', 'round', 'spur', 'duel', 'seal', 'vote', 'point', 'reveal', 'story', 'end']) {
      await page.evaluate(async phase => {
        window.__alibiTest.director.soundOn = false;
        await window.__alibiTest.playTo(phase, { n: 8, level: 'detektiv', names: ['Maximiliane', 'Konstantin-Leo', 'Annabella', 'Friedrich', 'Wilhelmina', 'Bartholomäus', 'Rosalind', 'Ferdinanda'] });
        window.__alibiTest.director.fast = true;
      }, phase);
      await page.waitForTimeout(450);
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        images: [...document.querySelectorAll('.alibi-stage img')].filter(i => i.complete && !i.naturalWidth).map(i => i.src),
        phase: window.__alibiTest.ctrl.state.phase,
        controls: [...document.querySelectorAll('.alibi-stage button')].filter(b => !b.disabled && b.getBoundingClientRect().width > 0).length,
      }));
      if (metrics.overflow) {
        await page.screenshot({ path: path.join(out, 'android-alibi-overflow.png') });
        console.log(await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 2 && getComputedStyle(e).position !== 'absolute').slice(0, 12).map(e => ({ tag: e.tagName, cls: e.className, right: e.getBoundingClientRect().right })) })));
      }
      assert.equal(metrics.overflow, false, `${view.width} ${phase}: horizontal overflow`);
      assert.deepEqual(metrics.images, [], `${view.width} ${phase}: missing images`);
      assert.ok(metrics.controls > 0, `${view.width} ${phase}: no available control`);
      report.phases.push({ width: view.width, stop: phase, phase: metrics.phase });
      if (view.width === 390 && ['round', 'whisper', 'end'].includes(phase)) await page.screenshot({ path: path.join(out, `android-alibi-${phase}.png`) });
    }
    console.log(`All 17 phases rendered at ${view.width}×${view.height}`);
    await context.close();
  }

  const { page, context, storage } = await open();
  // All player counts and difficulties finish through the ORIGINAL controller.
  for (const n of [4, 5, 6, 7, 8]) for (const level of ['mini', 'junior', 'detektiv', 'meister']) {
    const state = await page.evaluate(async ({ n, level }) => {
      const t = window.__alibiTest;
      await t.playTo('end', { n, level });
      t.director.fast = true;
      return { phase: t.ctrl.state.phase, caught: t.ctrl.state.finalCaught, players: t.ctrl.state.W.N, level: t.ctrl.state.W.level };
    }, { n, level });
    assert.equal(state.phase, 'end'); assert.equal(state.caught, true); assert.equal(state.players, n); assert.equal(state.level, level);
    report.games.push(state);
  }
  // Loss, second accusation, tie, clues, paid actions and timers.
  const actions = await page.evaluate(async () => {
    const t = window.__alibiTest, c = t.ctrl;
    await t.playTo('round', { n: 8, level: 'detektiv' }); t.director.fast = true;
    c.talkToggle(); c.suspendSession();
    const paused = !c.state.talkRun;
    const before = c.state.moves; c.getSpur(); const lab = c.state.spurShown === 1 && c.state.moves === before - 1; c.afterSpur();
    c.startSeal(); c.sealSelect(c.state.W.culprit); await c.sealOpen(); const seal = c.state.sealLog.length === 1; c.sealClose();
    c.callDuel(); const option = c.state.duelOpts[0];
    let duel = false;
    if (option) { c.pickDuel(option.key); await c.duelGo(); await c.duelOpen(); duel = c.state.duelLog.length === 1; c.duelClose(); }
    c.toVote(); await c.startCount(); c.tie(); const tie = c.state.voteSub === 'ready';
    while (c.state.phase !== 'story' && c.state.phase !== 'end') {
      c.select(c.state.W.players.findIndex((p, i) => i !== c.state.W.culprit && !c.state.cleared.includes(i)));
      c.accuse(); await c.flip(); c.afterReveal();
    }
    c.storySkip();
    return { paused, lab, seal, duel, tie, escaped: c.state.finalCaught === false };
  });
  for (const [name, result] of Object.entries(actions)) assert.equal(result, true, name);

  for (const caseId of ['laterne', 'kuchen', 'rezept', 'mondstein', 'glocke', 'honig', 'hufeisen', 'spieluhr']) {
    const reward = await page.evaluate(async caseId => {
      const t = window.__alibiTest;
      await t.playTo('end', { n: 8, level: 'meister', caseId });
      t.director.fast = true;
      return { caseId: t.ctrl.state.caseDef.id, feathers: t.ctrl.state.reward.feathers, next: t.ctrl.state.reward.next.id };
    }, caseId);
    assert.equal(reward.caseId, caseId);
    report.games.push(reward);
  }
  const vault = await page.evaluate(() => JSON.parse(localStorage.getItem('talea.alibi.vault.v1')));
  assert.equal(Object.keys(vault.loot).length, 8);
  assert.equal(vault.elster, true);
  assert.ok(Object.keys(vault.wanted).length > 0);

  // Back closes overlays first, then requires the same confirmation as the web.
  await page.locator('[data-a="rules"]').click();
  await page.locator('[data-a="closeOverlay"]').waitFor({ state: 'visible' });
  await page.evaluate(() => window.__alibiBack());
  await page.locator('[data-a="closeOverlay"]').waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-a="closeOverlay"]').count(), 0);
  // Actual director routes recordings and missing-clip TTS explicitly. HTML
  // audio must receive neither voice, even when receiver routing fails.
  const audioStart = report.bridge.length;
  const routing = await page.evaluate(async () => {
    const { director: d, ctrl } = window.__alibiTest;
    d.fast = false; d.soundOn = true; d.whisperVol = 0.12;
    const htmlPlay = HTMLMediaElement.prototype.play;
    const played = [];
    HTMLMediaElement.prototype.play = function() { played.push(this); return htmlPlay.call(this); };
    const nativeStop = window.__alibiNativeAudio.stop;
    let stopCount = 0;
    window.__alibiNativeAudio.stop = () => { stopCount++; nativeStop(); };
    d.setClips({ ...d.clips, 'qa.missing': { text: 'Nur für dich.' } });
    d.music('bed'); d.ambience('evening');
    await new Promise(r => setTimeout(r, 100));
    const beforeSecret = played.length;
    // Direct replay after a resumed session must silence the background itself,
    // even without the controller's initial handAnswer()/privacy(true) call.
    await d.say(['w.remember'], { priv: true });
    const loops = played.filter(a => a.loop);
    const quiet = loops.length >= 2 && loops.every(a => a.paused);
    await d.say(['qa.missing'], { priv: true });
    const privateHtml = played.slice(beforeSecret).map(a => a.src);
    await d.privacy(false);
    await d.say(['kom.welcome']);
    await d.say(['qa.missing']);
    d.music(null); d.ambience(null);
    // A rejected receiver route can only attempt native private TTS, never HTML
    // media, speaker TTS, or a replay when the app returns to the foreground.
    window.__failPrivateAudio = true;
    const beforeFailure = played.length;
    await d.privacy(true);
    await d.say(['w.remember'], { priv: true });
    const failedHtml = played.slice(beforeFailure).map(a => a.src);
    window.__failPrivateAudio = 'route';
    await d.say(['w.remember'], { priv: true });
    window.__failPrivateAudio = false;
    await d.privacy(false);
    await window.__alibiNativeAudio.speak('leise öffentlich', 1, 1, 0.12, false);
    window.__alibiReceive({ event: 'lifecycle', active: false });
    const stopped = stopCount > 0;
    window.__alibiReceive({ event: 'lifecycle', active: true });
    HTMLMediaElement.prototype.play = htmlPlay;
    window.__alibiNativeAudio.stop = nativeStop;
    d.soundOn = false; d.fast = true;
    return { quiet, privateHtml, failedHtml, stopped, phone: ctrl.setup.phone };
  });
  assert.deepEqual(routing, { quiet: true, privateHtml: [], failedHtml: [], stopped: true, phone: 'earpiece' });
  const voice = report.bridge.slice(audioStart).filter(m => m.type === 'audioPlay' || m.type === 'speak');
  assert.ok(voice.some(m => m.type === 'audioPlay' && m.clip === 'w.remember' && m.priv && m.volume === 0.12));
  assert.ok(voice.some(m => m.type === 'speak' && m.text === 'Nur für dich.' && m.priv && m.volume === 0.12));
  assert.ok(voice.some(m => m.type === 'audioPlay' && m.clip === 'kom.welcome' && !m.priv && m.volume === 1));
  assert.ok(voice.some(m => m.type === 'speak' && !m.priv && m.volume === 1));
  const failedPrivate = voice.filter(m => m.type === 'audioPlay' && m.clip === 'w.remember');
  assert.equal(failedPrivate.length, 3);
  assert.equal(voice.filter(m => m.type === 'speak' && m.priv).length, 2, 'route rejection must not retry via TTS');
  assert.equal(voice.at(-1).priv, false, 'low volume does not classify a public line as secret');
  assert.ok(report.bridge.slice(audioStart).some(m => m.type === 'audioPrivacy' && !m.on));

  // Android sends both change and blur; repeated notifications must not replace
  // the user's sound preference with the temporary background mute.
  const sound = await page.evaluate(async () => {
    const { director } = window.__alibiTest;
    const receive = active => window.__alibiReceive({ event: 'lifecycle', active });
    director.soundOn = true;
    receive(false); receive(false); receive(true);
    const audible = director.soundOn;
    director.soundOn = false;
    receive(false); receive(false); receive(true);
    return { audible, muted: !director.soundOn };
  });
  assert.deepEqual(sound, { audible: true, muted: true });

  // Persist and recover a real private step; no secret is visible after restart.
  await page.evaluate(async () => {
    await window.__alibiTest.playTo('whisper', { n: 6, level: 'junior' });
    window.__alibiReceive({ event: 'lifecycle', active: false });
  });
  await page.waitForTimeout(350);
  assert.ok(storage['talea.alibi.session.v1']);
  assert.equal(JSON.parse(storage['talea.alibi.session.v1']).soundOn, false);
  await context.close();
  const restarted = await open({ width: 390, height: 844 }, storage);
  assert.equal(await restarted.page.evaluate(() => window.__alibiTest.ctrl.state.hidden), true);
  assert.equal(await restarted.page.evaluate(() => window.__alibiTest.ctrl.state.actSub), 'whisper');
  assert.equal(await restarted.page.evaluate(() => window.__alibiTest.director.soundOn), false);
  await restarted.context.close();

  // Every media file is byte-identical to the web source; fonts are local too.
  async function verify(from, to) {
    for (const entry of await fs.readdir(from, { withFileTypes: true })) {
      if (entry.isDirectory()) await verify(path.join(from, entry.name), path.join(to, entry.name));
      else { assert.deepEqual(await fs.readFile(path.join(to, entry.name)), await fs.readFile(path.join(from, entry.name)), entry.name); report.media++; }
    }
  }
  for (const dir of ['alibi', 'tavi', 'nav']) await verify(path.join(repo, 'frontend/public/game', dir), path.join(bundle, 'game', dir));
  assert.ok(!(await fs.readFile(path.join(bundle, 'alibi.css'), 'utf8')).includes('fonts.googleapis.com'));
  assert.deepEqual(report.errors, []);
  console.log(`${report.phases.length} phase/viewport checks, ${report.games.length} full games, interruption recovery, bridge and ${report.media} media files passed.`);
} finally {
  await fs.writeFile(path.join(out, 'android-alibi-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
