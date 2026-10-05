# Spiel-Stimmen (Mitternachts-Alibi) per ElevenLabs

Erzeugt Sprache und Klänge des Spiels ohne Handarbeit. Eingabe: `docs/games/mitternachts-alibi-v2/Stimmen.json` und `Effekte.json`. Ausgabe: `frontend/public/game/alibi/voices/<id>.mp3` + `manifest.json`.

| Datei | Zweck |
|---|---|
| `eleven.mjs` | API-Helfer: Schlüssel holen (Umgebung → `.env.local` → Railway), `ttsClip` (eleven_v4, Fallback v3), `sfxClip` |
| `casting.mjs` | Besetzung der 89 Figuren (Stimme, Charakter-Tags, typisches Geräusch) und Tag-Bau je Zeilenart (intro, stmt, deny, confess, smug, witness) |
| `generate.mjs` | Sprache erzeugen, schneiden, normalisieren, Manifest schreiben (wiederaufnehmbar) |
| `sfx.mjs` | Geräusche und Ambiente-Schleifen über `/v1/sound-generation` |
| `master.mjs` | ffmpeg: Stille kürzen, Lautheit angleichen, Mono 64 kbit/s |
| `verify.mjs` | Fehlende IDs, Tempo-Ausreißer, Lautheit, Größe |
| `check-transcripts.py` | Lokale Spracherkennung (faster-whisper) gegen den Soll-Text: findet gesprochene Tags, fehlende Sätze |
| `inspect.mjs` | Stimmen des Kontos auflisten und in `voices-account.json` speichern |

Der Schlüssel liegt nur im Speicher. `.cache/` (Rohdateien, Protokolle, Transkripte) ist nicht eingecheckt.

## Typische Abläufe

```bash
bun scripts/game-voices/generate.mjs --prio 3 --dry        # was würde erzeugt, wie viele Zeichen
bun scripts/game-voices/generate.mjs --ids num.1,act.0     # einzelne Clips
bun scripts/game-voices/generate.mjs --only character.astra --force   # eine Figur neu (kostet Zeichen)
bun scripts/game-voices/generate.mjs --prio 3 --remaster  # nur neu schneiden (kostenlos)
bun scripts/game-voices/sfx.mjs --only fx.bell --force
bun scripts/game-voices/verify.mjs --loudness
```

Ändert sich Stimme oder Text eines Clips (zum Beispiel in `casting.mjs`), erkennt der nächste Lauf das am Hash und erzeugt nur diese Clips neu.

## Zeichen und Kosten

Abgerechnet werden auch die Audio-Tags. Gesamtlauf am 2026-10-03: 896 Clips, 87 000 Zeichen, plus rund 14 000 Zeichen für Nachbesserungen (siehe unten), 71 Minuten Audio, 35 MB inklusive Klänge (Sprache 64 kbit/s). Der Schlüssel darf weder Spracherkennung noch Nutzerdaten lesen (`speech_to_text`, `user_read` fehlen), deshalb ist das Restguthaben nicht abfragbar; bei Guthaben-Ende bricht `generate.mjs` sauber ab.

## Qualitätsprüfung (2026-10-03)

`check-transcripts.py` (faster-whisper, lokal, kostenlos) hat alle 896 Clips abgehört und mit dem Soll-Text verglichen:

- **Kein einziges Audio-Tag wurde mitgesprochen.**
- Zwei Mängel traten auf: Stottern/Wiederholen am Satzanfang (vor allem bei „Schwur“-Zeilen) und verschluckte Kurzclips („Bei dir war:“ wurde zu „bei Tavi“). 126 Clips wurden mit anderem Zufallswert (`--seed`) neu erzeugt, jeweils der bessere Take blieb; `w.with.1` bekam einen abweichenden Sprechtext (`SPOKEN_OVERRIDES` in `generate.mjs`: „Bei dir, war“).
- Ergebnis: 704 lange Clips (≥ 4 Wörter) im Mittel 99 % Buchstabenübereinstimmung, keiner unter 85 %. Verbleibende Auffälligkeiten sind Absicht (Quaken, Kichern, „Klopf, klopf“) oder Fehler der Erkennung (zum Beispiel „Kristall“ → „Christian“).
- Nicht prüfbar ohne Ohren: ob Stimme und Witz zur Figur passen. Dafür bei Gelegenheit einige Figuren anhören und in `casting.mjs` Stimme oder Tags tauschen (der Hash erzeugt dann nur diese Clips neu).
- Brumm (Steinwächter) und Troll Grummel sprechen sehr langsam (~6 Zeichen/s); gewollt, aber die Zeilen sind dadurch lang.

## Version 3 (2026-10-05)

171 weitere Sprach-Clips (Tathergang, Ermittlung, Siegel, Beute, Gruppen-Aufgaben, Tat-Erzählungen, Epiloge, Elster-Finale, Zeugen-Zeile `character.<slug>.witness` für alle 89 Figuren) und 18 Geräusche (`fx.seal`, `fx.sneak`, `fx.clock`, `fx.loot`, `fx.feather`, `fx.poster`, `fx.dawn`, `fx.rewind`, `fx.drop`, `fx.ooh` und je Fall `fx.th.<fall>`). Gegenprobe mit `check-transcripts.py`: keine gesprochenen Tags, auffällig nur gewollte Wiederholungen („Quak, quak“).
