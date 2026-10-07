(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (value, text) => { if (!value) throw new Error(text); };
  for (let i = 0; i < 60 && !window.__alibiTest; i++) await wait(1000);
  check(window.__alibiTest, 'Game controller unavailable');
  document.querySelector('[data-a="launch"]').click();
  const t = window.__alibiTest;
  const stops = ['cast', 'case', 'act0', 'whisper', 'claim', 'announce', 'act0done', 'act1', 'round', 'spur', 'duel', 'seal', 'vote', 'point', 'reveal', 'story', 'end'];
  let phases = 0;
  for (const stop of stops) {
    console.log('ALIBI_QA:phase ' + stop);
    await t.playTo(stop, { n: 8, level: 'detektiv' });
    await wait(500);
    check(document.querySelector('.alibi-stage'), `${stop}: stage missing`);
    check(document.querySelector('.alibi-stage main')?.textContent.trim().length > 10, `${stop}: empty game screen`);
    check(document.documentElement.scrollWidth <= innerWidth + 1, `${stop}: overflow`);
    check(![...document.images].some(i => i.complete && !i.naturalWidth), `${stop}: missing image`);
    phases++;
  }
  check(t.ctrl.state.phase === 'round' || t.ctrl.state.phase === 'end', 'Unexpected final state');
  // Exercise real Android MediaPlayer through HTMLAudio, with a local APK MP3.
  const audio = new Audio(window.__QA_AUDIO__);
  await Promise.race([audio.play(), wait(15_000).then(() => { throw new Error(`MP3 timeout: ready=${audio.readyState}, error=${audio.error?.code}`); })]);
  await wait(500);
  check(audio.currentTime > 0 && !audio.error, 'Local MP3 did not play');
  audio.pause();
  await t.playTo('whisper', { n: 6, level: 'junior' });
  t.director.soundOn = true;
  window.__alibiLifecycle(false); window.__alibiLifecycle(false);
  check(t.ctrl.state.hidden && !t.ctrl.state.talkRun, 'Private pause failed');
  window.__alibiLifecycle(true);
  check(t.director.soundOn, 'Sound preference lost');
  console.log('ALIBI_QA:PASS ' + JSON.stringify({ phases, audio: true, privacy: true, width: innerWidth, height: innerHeight }));
})().catch(e => console.log('ALIBI_QA:ERROR ' + e.stack));
