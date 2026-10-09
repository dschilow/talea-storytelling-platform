# Bilder und Vorleseclips für den Rundgang

Die Inhalte stehen in `frontend/screens/Onboarding/tourChapters.ts`. Das Skript erzeugt Illustrationen mit Runware FLUX.3 Image (`bfl:flux@3-image`) und Vorleseclips mit der bestehenden Tavi-Stimme bei ElevenLabs. Tavi dient als Bildreferenz. [Offizielle Modellbeschreibung](https://runware.ai/docs/models/bfl-flux-3-image).

Voraussetzungen: Bun, FFmpeg, `RUNWARE_API_KEY` und `ELEVENLABS_API_KEY` in der lokalen, nicht eingecheckten `.env.local` oder der Prozessumgebung. Zugangsdaten werden von den bestehenden Medien-Helfern gelesen und nicht ausgegeben.

```powershell
bun scripts/onboarding/generate-assets.mjs --dry
bun scripts/onboarding/generate-assets.mjs
bun scripts/onboarding/generate-assets.mjs --only audio,cosmos --images-only
bun scripts/onboarding/generate-assets.mjs --only home --audio-only --force
```

Ohne `--force` werden unveränderte Inhalte anhand ihrer Prüfsumme übersprungen. Fehlerhafte oder fehlende Ausgaben lassen sich durch erneuten Aufruf ergänzen. Generierung verursacht Kosten bei den jeweiligen Anbietern. Die tatsächlichen Bildkosten und Audiodauern werden ausgegeben und im Manifest dokumentiert.

Fertige Dateien und `frontend/public/onboarding/manifest.json` zusammen einchecken. Das Manifest enthält Modell, Inhalt, Prüfsumme und Dateipfad, keine Zugangsdaten. Die Rohdateien unter `.cache/` bleiben lokal. Das Skript nicht mehrfach gleichzeitig starten, da die Prozesse dasselbe Manifest schreiben.

Illustrationen werden auf 768 × 768 Pixel als WebP verkleinert. Audio wird mit dem bestehenden Sprach-Mastering am Anfang gekürzt und in Lautstärke angeglichen. Nach geänderten Inhalten Bilder und Clips kontrollieren, insbesondere Aussprache, Verständlichkeit und sichtbare Handlungen.
