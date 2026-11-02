# Figurenwelt Qualitätsvariante

`character-series-quality-v1` ist eine separate, experimentelle Admin-Option neben `character-series-v1`. Sie verwendet dieselben Serienbibeln und denselben Folgenfortschritt; sie legt keine zweite Familienhistorie an. Das Standardverfahren behält seine Modelle und Limits.

- Sol schreibt mit mittlerem Denkaufwand und übernimmt begrenzte lokale Überarbeitungen.
- Gemini 3.8 Flash prüft einen kompakten Ausschnitt der Serienvorgaben und das vollständige Manuskript. Maximal zwei belegte Probleme; anschließend erneute Prüfung der Änderungen. Starke Originalzeilen werden geschützt.
- Der Bildregisseur reserviert auf dem Cover einen Referenzplatz für das zentrale Objekt. Fehlende Objektporträts werden aus belegten Designvorgaben ergänzt.
- Zwei Bildvarianten durchlaufen dieselben Identitäts- und Anatomieprüfungen. Terra vergleicht maximal drei Schlüsselbilder und prüft die ausgewählte Buchfolge auf Widersprüche.
- Fehlende oder gesperrte Bilder bleiben als Fehler sichtbar. Eine nicht verfügbare Buchprüfung verhindert `releaseReady`.

Die Limits sind Stoppschwellen auf bereits gemeldete Kosten, keine garantierten Abrechnungshöchstbeträge. Laufende Anfragen können die Schwelle überschreiten. Der Pilot vom 2. November 2026 zeigt weiterhin erhebliche Bildfehler; die Variante ist deshalb noch keine allgemeine Qualitätsfreigabe.

Lokaler Pilot ohne Datenbankänderungen, mit Bun aus dem Projektverzeichnis:

```powershell
bun scripts/character-series-quality/pilot.ts --run --quota --quota-writers-only --railway --out output/figurenwelt-quality-pilot --cash-cap 0.32
```

`--railway` liest die verknüpfte API-Konfiguration vertraulich. Sol nutzt hier das angemeldete Codex-Kontingent; Bildgenerierung, Flash und die kleinen Bildprüfungen werden über API abgerechnet. Kontingentnutzung ist keine kostenlose Inferenz. `--resume` verwendet vorhandene geprüfte Texte; `--draft-root` kann frühere Autorenentwürfe für erneute Lektorate bereitstellen. Die Testdateien enthalten fiktive Kinder und öffentliche Figurenreferenzen.

Bewertung und Messwerte: [Pilotbericht](../../../docs/figurenserien/qualitaet-pilot-2026-11-02/Bewertung.md).
