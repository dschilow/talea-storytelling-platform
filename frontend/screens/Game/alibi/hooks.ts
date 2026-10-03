import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useBackend } from "@/hooks/useBackend";
import { ALIBI_CHARACTERS } from "./data/characters";
import { director } from "./audio";
import type { AlibiController } from "./controller";
import type { AlibiCharacter } from "./types";

/** Gleiche Normalisierung wie beim Erzeugen von data/characters.ts (ä→ae, nur Buchstaben und Ziffern). */
export const normalizeName = (s: string) =>
  s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");

type PoolEntry = { name: string; imageUrl?: string; isActive?: boolean };

let cache: AlibiCharacter[] | null = null;

/**
 * Lädt den echten Charakter-Pool und verbindet ihn über den Namen mit den Spieltexten.
 * Nur Figuren mit Bild kommen ins Spiel. Das Ergebnis bleibt für die Sitzung im Speicher.
 */
export function useAlibiCharacters() {
  const backend = useBackend();
  const [chars, setChars] = useState<AlibiCharacter[] | null>(cache);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    setError(null);
    (async () => {
      try {
        const res = (await backend.story.listCharacters()) as unknown as { characters: PoolEntry[] };
        const images = new Map<string, string>();
        // Aktive Einträge zuerst, damit bei Dubletten das gepflegte Bild gewinnt.
        const sorted = [...(res.characters ?? [])].sort((a, b) => Number(b.isActive !== false) - Number(a.isActive !== false));
        sorted.forEach((c) => {
          const key = normalizeName(c.name || "");
          if (c.imageUrl && !images.has(key)) images.set(key, c.imageUrl);
        });
        const merged = ALIBI_CHARACTERS.filter((c) => images.has(c.key)).map((c) => ({ ...c, img: images.get(c.key) as string }));
        if (merged.length < 8) throw new Error("Zu wenige Figuren mit Bild im Pool");
        cache = merged;
        if (alive) setChars(merged);
      } catch (e) {
        console.error("[Alibi] Charakter-Pool konnte nicht geladen werden", e);
        if (alive) setError("Die Figuren konnten nicht geladen werden. Bitte prüfe die Verbindung.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [backend, attempt]);

  return { chars, error, retry: () => setAttempt((n) => n + 1) };
}

/** Spielstand abonnieren */
export function useAlibiState(ctrl: AlibiController) {
  return useSyncExternalStore(ctrl.subscribe, ctrl.getState, ctrl.getState);
}

/** Stimme: Untertitel, Hervorhebung, ob gerade gesprochen wird */
let voiceVersion = 0;
director.subscribe(() => {
  voiceVersion++;
});
export function useVoice() {
  const v = useSyncExternalStore(director.subscribe, () => voiceVersion, () => voiceVersion);
  return useMemo(
    () => ({ caption: director.caption, highlight: director.highlight, speaking: director.speaking, soundOn: director.soundOn }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v]
  );
}

/** Ist dieser Spieler gerade hervorgehoben (weil Tavi seine Nummer sagt)? */
export function useIsHighlighted(id: number) {
  const { highlight } = useVoice();
  return highlight.indexOf(id) >= 0;
}

/** Ein paar zufällige Pool-Gesichter für Startseite und Tour */
export function usePreviewFaces(chars: AlibiCharacter[] | null, n: number) {
  return useMemo(() => {
    if (!chars) return [];
    const copy = chars.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }, [chars, n]);
}
