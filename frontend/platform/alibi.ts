import { useEffect, useRef } from 'react';
import type { AlibiController } from '../screens/Game/alibi/controller';
import { director } from '../screens/Game/alibi/audio';
import { isAndroidApp, onNativeLifecycle } from './native';

const restored = new WeakSet<AlibiController>();
const KEY = 'talea.alibi.session.v1';

/** Preserve the original game's session and receiver privacy through app switching. */
export function useAndroidAlibi(ctrl: AlibiController | null, open: boolean) {
  const stageOpen = useRef(open);
  stageOpen.current = open;
  useEffect(() => {
    if (!isAndroidApp() || !ctrl) return;
    if (!restored.has(ctrl)) {
      restored.add(ctrl);
      try { const saved = localStorage.getItem(KEY); if (saved) ctrl.restoreSession(JSON.parse(saved)); } catch { /* Invalid older session starts at setup. */ }
    }
    let foreground = true;
    let sound = director.soundOn;
    let timer = 0;
    const save = () => {
      window.clearTimeout(timer);
      try { localStorage.setItem(KEY, JSON.stringify({ ...ctrl.exportSession(), soundOn: foreground ? director.soundOn : sound })); } catch { /* Gameplay remains available if storage is full. */ }
    };
    const unsubscribe = ctrl.subscribe(() => { window.clearTimeout(timer); timer = window.setTimeout(save, 150); });
    const lifecycle = onNativeLifecycle(active => {
      if (foreground === active) return;
      foreground = active;
      director.pauseAmbience(!active);
      if (!active) {
        sound = director.soundOn;
        director.soundOn = false;
        ctrl.suspendSession();
        director.stop();
        director.releasePhone();
        save();
      } else {
        director.soundOn = sound;
        if (stageOpen.current) ctrl.resumeSession();
      }
    });
    const pagehide = () => { ctrl.suspendSession(); save(); };
    window.addEventListener('pagehide', pagehide);
    return () => { unsubscribe(); lifecycle(); window.removeEventListener('pagehide', pagehide); ctrl.suspendSession(); save(); };
  }, [ctrl]);
  useEffect(() => {
    if (!isAndroidApp() || !ctrl) return;
    if (open) {
      document.querySelector<HTMLAudioElement>('audio[data-title]')?.pause();
      ctrl.resumeSession();
    }
    else ctrl.suspendSession();
  }, [ctrl, open]);
}
