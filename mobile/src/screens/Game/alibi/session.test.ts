import { describe, expect, test } from 'bun:test';
import { resumableState } from '../../../../../frontend/screens/Game/alibi/session';
import type { AlibiState } from '../../../../../frontend/screens/Game/alibi/controller';
function state(patch: Partial<AlibiState> = {}): AlibiState {
  return { phase: 'round', talkRun: true, voteSub: 'ready', revealSub: 'ask', duel: null, seal: null, duelLog: [], sealLog: [], hidden: false, ...patch } as AlibiState;
}
describe('Android interruption recovery', () => {
  test('pauses timers and hides private information without changing the live game', () => {
    const live = state({ phase: 'act', actSub: 'whisper' });
    const restored = resumableState(live);
    expect(restored.talkRun).toBe(false);
    expect(restored.hidden).toBe(true);
    expect(live.hidden).toBe(false);
    expect(live.talkRun).toBe(true);
  });
  test('restarts vote countdown and reveal at steps the players can act on', () => {
    const restored = resumableState(state({ voteSub: 'count', revealSub: 'drum' }));
    expect(restored.voteSub).toBe('ready');
    expect(restored.revealSub).toBe('ask');
  });
  test('completes an already paid seal without using a second move or losing its clue', () => {
    const restored = resumableState(state({ moves: 2, seal: { i: 1, step: 'open', claimed: 'eule', truth: 'katze', ok: false } }));
    expect(restored.moves).toBe(2);
    expect(restored.seal?.step).toBe('result');
    expect(restored.sealLog).toEqual([{ i: 1, ok: false }]);
    expect(resumableState(restored).sealLog).toHaveLength(1);
  });
  test('preserves duel evidence and avoids duplicate log entries', () => {
    const restored = resumableState(state({ duel: { t: 1, place: 'markt', a: 0, b: 1, key: 'test', opts: [], step: 'open', res: 'diff' } }));
    expect(restored.duel?.step).toBe('result');
    expect(restored.duelLog).toHaveLength(1);
    expect(resumableState(restored).duelLog).toHaveLength(1);
    const countdown = resumableState(state({ duel: { ...restored.duel!, step: 'count' } }));
    expect(countdown.duel?.step).toBe('call');
  });
});
