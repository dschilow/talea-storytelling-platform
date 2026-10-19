import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

/** The web player's queue/UI remain authoritative. Expo owns device playback. */
export class NativePlayer {
  private player: AudioPlayer | null = null;
  private subscription: { remove(): void } | null = null;
  private generation = -1;
  private file: string | null = null;
  private disposed = false;

  constructor(private readonly send: (message: object) => void) {}

  async load(payload: Record<string, unknown>) {
    const generation = payload.generation as number;
    this.clear(generation);
    let uri = payload.url as string;
    let file: string | null = null;
    if (uri.startsWith('data:')) {
      file = `${FileSystem.cacheDirectory}talea-player-${Date.now()}-${generation}.audio`;
      await FileSystem.writeAsStringAsync(file, uri.slice(uri.indexOf(',') + 1), { encoding: FileSystem.EncodingType.Base64 });
      uri = file;
    }
    if (this.disposed || this.generation !== generation) {
      if (file) await FileSystem.deleteAsync(file, { idempotent: true });
      return;
    }
    this.file = file;
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'duckOthers', shouldRouteThroughEarpiece: false });
    if (this.disposed || this.generation !== generation) return;
    const player = createAudioPlayer({ uri }, { updateInterval: 250 });
    this.player = player;
    this.subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (this.generation !== generation) return;
      this.send({ event: 'audioStatus', generation, currentTime: status.currentTime, duration: status.duration, playing: status.playing, loaded: status.isLoaded, ended: status.didJustFinish });
    });
    player.setActiveForLockScreen(true, { title: typeof payload.title === 'string' ? payload.title : 'Talea', artist: 'Talea', artworkUrl: typeof payload.artwork === 'string' ? payload.artwork : undefined });
  }

  play(generation: number) { if (generation === this.generation) this.player?.play(); }
  pause(generation?: number) { if (generation === undefined || generation === this.generation) this.player?.pause(); }
  async seek(generation: number, seconds: number) { if (generation === this.generation) await this.player?.seekTo(seconds); }
  clear(generation: number) {
    this.generation = generation;
    this.subscription?.remove();
    this.subscription = null;
    if (this.player) {
      this.player.setActiveForLockScreen(false);
      this.player.pause();
      this.player.remove();
      this.player = null;
    }
    if (this.file) { void FileSystem.deleteAsync(this.file, { idempotent: true }).catch(() => {}); this.file = null; }
  }
  dispose() { this.disposed = true; this.clear(-1); }
}
