/* Geheimtelefon über die Hörmuschel (wie beim Telefonieren) statt über den Lautsprecher.
 *
 * Android-App: Der native Host wählt die Hörmuschel für Kommunikations-Audio.
 * Aufnahmen und Ersatzstimme werden dort nativ abgespielt, ohne Mikrofon.
 * Was Browser erlauben (Stand Oktober 2026):
 *  - iPhone (Safari, iOS 16.4+): Mit einer „Telefonat“-Audiositzung (navigator.audioSession.type = "play-and-record")
 *    und einer offenen (stummen) Mikrofonspur leitet iOS den Ton auf die Hörmuschel. Wo HTMLMediaElement.setSinkId
 *    vorhanden ist, wird jedes Audio-Element gezielt geleitet: Geheimes an die Hörmuschel, Öffentliches an den
 *    Lautsprecher (""), dann bleibt die Sitzung für den ganzen Akt offen. Ohne setSinkId wird die Sitzung nur während
 *    der geheimen Schritte geöffnet und danach wieder geschlossen (iOS braucht danach einige hundert Millisekunden,
 *    bis der Lautsprecher wieder gilt).
 *  - Android (Chrome) und andere: Webseiten können den Ton nicht auf die Hörmuschel legen (setSinkId fehlt dort,
 *    Plattformgrenze). Dann flüstert Tavi sehr leise über den Lautsprecher (Modus „whisper“).
 * Das Mikrofon wird nie gelesen oder aufgenommen: die Spur ist ausgeschaltet (enabled = false) und dient nur dazu,
 * dass iOS in den Telefon-Modus schaltet. Sie wird freigegeben, sobald kein Geheimes mehr kommt. */

import { nativeAudio } from "./native-audio";

type AudioSessionNav = Navigator & { audioSession?: { type: string } };
type SinkAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };

export type PhoneMode = "earpiece" | "whisper";
export type EarpieceState = "off" | "starting" | "on" | "denied" | "failed";

const nav = (typeof navigator !== "undefined" ? navigator : undefined) as AudioSessionNav | undefined;

/** Nur das iPhone hat eine Hörmuschel, die Safari erreichen kann (iPad meldet sich als Mac und hat keine). */
export function earpiecePossible(): boolean {
  if (nativeAudio()) return true;
  if (!nav) return false;
  const iphone = /iPhone|iPod/.test(nav.userAgent);
  return iphone && !!nav.audioSession && !!nav.mediaDevices?.getUserMedia;
}

const canSink = () => typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

class Earpiece {
  constructor() {
    if (typeof window !== "undefined") window.addEventListener("alibi:audio-route-failed", () => this.setState("failed"));
  }
  state: EarpieceState = "off";
  private stream: MediaStream | null = null;
  private receiverId: string | null = null;
  private opening: Promise<boolean> | null = null;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private setState(s: EarpieceState) {
    this.state = s;
    this.listeners.forEach((fn) => fn());
  }

  /** Hörmuschel kann gezielt pro Audio-Element angesteuert werden (Sitzung darf offen bleiben) */
  get routable() {
    return this.state === "on" && !!this.receiverId && canSink();
  }
  get active() {
    return this.state === "on";
  }

  /** Telefon-Modus einschalten (fragt beim ersten Mal nach dem Mikrofon). true = Hörmuschel aktiv. */
  open(): Promise<boolean> {
    if (this.state === "on") return Promise.resolve(true);
    if (this.state === "denied" || !earpiecePossible()) return Promise.resolve(false);
    if (this.opening) return this.opening;
    this.setState("starting");
    this.opening = (async () => {
      try {
        if (nativeAudio()) {
          await nativeAudio()!.privacy(true);
          this.setState("on");
          return true;
        }
        const stream = await nav!.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        // nie zuhören: Spur aus, sie hält nur die Telefon-Sitzung offen
        stream.getAudioTracks().forEach((t) => (t.enabled = false));
        this.stream = stream;
        try {
          nav!.audioSession!.type = "play-and-record";
        } catch {
          /* ältere Safari-Versionen: die Mikrofonspur allein schaltet um */
        }
        if (canSink()) {
          try {
            const outs = (await nav!.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audiooutput");
            const rec = outs.find((d) => /receiver|earpiece|hörer|iphone/i.test(d.label) && !/speaker|lautsprecher/i.test(d.label));
            this.receiverId = rec ? rec.deviceId : null;
          } catch {
            this.receiverId = null;
          }
        }
        this.setState("on");
        // iOS braucht einen Moment, bis die neue Route gilt
        await wait(250);
        return true;
      } catch (e) {
        const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
        this.setState(denied ? "denied" : "failed");
        return false;
      } finally {
        this.opening = null;
      }
    })();
    return this.opening;
  }

  /** Telefon-Modus beenden: Mikrofon freigeben, Lautsprecher-Sitzung. Wartet, bis iOS umgeschaltet hat. */
  async close(): Promise<void> {
    if (this.opening) await this.opening;
    if (nativeAudio()) {
      await nativeAudio()!.privacy(false).catch(() => undefined);
      if (this.state !== "failed") this.setState("off");
      return;
    }
    if (!this.stream && this.state !== "on") return;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.receiverId = null;
    try {
      if (nav?.audioSession) nav.audioSession.type = "playback";
    } catch {
      /* ignorieren */
    }
    if (this.state === "on" || this.state === "starting") this.setState("off");
    await wait(450);
  }

  /** Ein Audio-Element vor dem Abspielen leiten: geheim → Hörmuschel, sonst Lautsprecher. */
  async route(el: HTMLAudioElement, priv: boolean): Promise<void> {
    if (!this.routable) return;
    const a = el as SinkAudio;
    try {
      await a.setSinkId?.(priv ? (this.receiverId as string) : "");
    } catch {
      /* Gerät nicht verfügbar: Standardausgabe */
    }
  }

  /** Nach einem Nein des Nutzers erneut fragen dürfen (z. B. über „Probe hören“) */
  reset() {
    if (this.state === "denied" || this.state === "failed") this.setState("off");
  }
}

export const earpiece = new Earpiece();
