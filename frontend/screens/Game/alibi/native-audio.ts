/** Optional Android host. Secret audio must never fall back to HTML media. */
export interface NativeAlibiAudio {
  privacy(on: boolean): Promise<void>;
  play(id: string, priv: boolean, volume: number): Promise<void>;
  speak(text: string, pitch: number, rate: number, volume: number, priv: boolean): Promise<void>;
  stop(): void;
}
declare global { interface Window { __alibiNativeAudio?: NativeAlibiAudio } }
export const nativeAudio = () => typeof window === "undefined" ? undefined : window.__alibiNativeAudio;
