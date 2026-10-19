import { blobDataUrl, isAndroidApp, nativeRequest, onNativeEvent } from './native';

/** Adapt only the global audio element; queue, offline storage and UI stay shared. */
export function connectAndroidAudio(audio: HTMLAudioElement | null): () => void {
  if (!audio || !isAndroidApp()) return () => {};
  let generation = Date.now();
  let disposed = false;
  let currentTime = 0, duration = 0, paused = true, loaded = false, ended = false;
  let loadPromise = Promise.resolve();
  let wantsPlayback = false;
  let metadataTimer = 0;
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const install = (name: string, descriptor: PropertyDescriptor) => {
    descriptors.set(name, Object.getOwnPropertyDescriptor(audio, name));
    Object.defineProperty(audio, name, { configurable: true, ...descriptor });
  };
  const emit = (name: string) => audio.dispatchEvent(new Event(name));
  const failed = (token: number) => { if (!disposed && generation === token) emit('error'); };
  audio.preload = 'none';
  install('currentTime', { get: () => currentTime, set: (seconds: number) => {
    currentTime = seconds;
    const token = generation;
    void nativeRequest('audioSeek', { generation: token, seconds }).catch(() => failed(token));
    emit('timeupdate');
  } });
  install('duration', { get: () => duration });
  install('paused', { get: () => paused });
  install('readyState', { get: () => loaded ? 4 : 0 });
  install('load', { value: () => {
    const token = ++generation;
    window.clearTimeout(metadataTimer);
    wantsPlayback = false;
    currentTime = 0; duration = 0; paused = true; loaded = false; ended = false;
    const src = audio.getAttribute('src');
    const reset = nativeRequest('audioClear', { generation: token });
    if (!src) loadPromise = reset;
    else loadPromise = (async () => {
      await reset;
      let url = audio.src;
      if (url.startsWith('blob:')) {
        const response = await fetch(url);
        const blob = await response.blob();
        url = await blobDataUrl(blob.type.startsWith('audio/') ? blob : new Blob([blob], { type: 'audio/mpeg' }));
      }
      if (token !== generation || disposed) return;
      await nativeRequest('audioLoad', { generation: token, url, title: audio.dataset.title || 'Talea', artwork: audio.dataset.artwork }, 120_000);
      if (!loaded && token === generation) metadataTimer = window.setTimeout(() => failed(token), 30_000);
    })();
    void loadPromise.catch(() => failed(token));
  } });
  install('play', { value: async () => {
    wantsPlayback = true;
    const token = generation;
    await loadPromise;
    if (token !== generation || disposed || !wantsPlayback) return;
    await nativeRequest('audioPlay', { generation: token });
  } });
  install('pause', { value: () => {
    wantsPlayback = false;
    paused = true;
    const token = generation;
    void nativeRequest('audioPause', { generation: token }).catch(() => failed(token));
    emit('pause');
  } });
  const unsubscribe = onNativeEvent(message => {
    if (message.event !== 'audioStatus' || message.generation !== generation || disposed) return;
    currentTime = Number(message.currentTime) || 0;
    const nextDuration = Number(message.duration) || 0;
    const firstLoad = !loaded && !!message.loaded;
    const durationChanged = nextDuration !== duration;
    const nextPaused = !message.playing;
    const pauseChanged = nextPaused !== paused;
    duration = nextDuration; loaded = !!message.loaded; paused = nextPaused;
    if (firstLoad) { window.clearTimeout(metadataTimer); emit('loadedmetadata'); }
    if (durationChanged) emit('durationchange');
    if (pauseChanged) emit(paused ? 'pause' : 'play');
    emit('timeupdate');
    if (message.ended && !ended) { ended = true; emit('ended'); }
    if (!message.ended) ended = false;
  });
  return () => {
    disposed = true;
    window.clearTimeout(metadataTimer);
    void nativeRequest('audioClear', { generation: ++generation }).catch(() => {});
    unsubscribe();
    descriptors.forEach((descriptor, name) => {
      if (descriptor) Object.defineProperty(audio, name, descriptor);
      else delete (audio as unknown as Record<string, unknown>)[name];
    });
  };
}
