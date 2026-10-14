# Talea-Performanceprüfung

Die Werkzeuge messen Produktionsbuilds in einem isolierten Chrome-Profil. Sie benötigen Bun, Chrome und Playwright. Im Codex-Desktop kann `mcp__codex_app__load_workspace_dependencies` den vorhandenen Playwright-Paketpfad liefern. Diesen bei Bedarf in PowerShell setzen:

```powershell
$env:PLAYWRIGHT_PATH = '<Paketpfad zu playwright aus dem Workspace-Runtime>'
```

Einen Build im Projektordner erstellen und in einem separaten Terminal ausliefern:

```powershell
# Aus frontend/
bun run build --manifest --outDir ../.performance/current

# Aus dem Repository-Root, separates Terminal
bun scripts/performance/serve.mjs .performance/current 4173 --gzip-js --public-only
```

`--public-only` liefert eine leere Laufzeitkonfiguration für die vorhandene öffentliche Startseite. Der Build darf dafür keinen Clerk-Schlüssel enthalten. Clerk-Produktionsschlüssel sind an ihre Domain gebunden; deren Ladefehler auf localhost dürfen die Messung nicht verfälschen. Ohne diesen Schalter liest der Server die öffentlich sichtbare Konfiguration von talea.website. Der Messserver verwendet `no-store`; beide Vergleichsbuilds müssen mit denselben Komprimierungsoptionen laufen.

```powershell
bun scripts/performance/measure.mjs http://127.0.0.1:4173 .performance/mobile.json mobile 5
bun scripts/performance/measure.mjs http://127.0.0.1:4173 .performance/desktop.json desktop 3
# Optional: Zwei Builds in einer Browserinstanz abwechselnd messen
bun scripts/performance/measure.mjs http://127.0.0.1:4173 .performance/paired-mobile.json mobile 3 http://127.0.0.1:4174
bun scripts/performance/smoke.mjs http://127.0.0.1:4173
bun scripts/performance/bundle.mjs .performance/before .performance/current
bun test scripts/performance/profileRequest.test.ts scripts/performance/i18n.test.ts
```

Mobilmessungen verwenden 390 × 844 Pixel, vierfach verlangsamte CPU, 1,6 Mbit/s Download und 150 ms Latenz. Jeder Lauf verwendet einen neuen Browserkontext und deaktivierten HTTP-Cache. Während der Vergleichsmessung sind Service Worker blockiert; der getrennte Smoke-Test installiert den echten Service Worker und prüft einen Offline-Neustart. Weitere Browsermessungen und Builds sollten während der Zeitmessung pausieren.

Die Werte stammen von der Performance-API. `blockingTime` ist ein Laborindikator für lange Aufgaben nach FCP, kein Lighthouse-Score und keine INP-Feldmessung. `layoutShiftSum` summiert Verschiebungen ohne Benutzereingabe und ist keine Berechnung der maximalen CLS-Sitzung. Ressourcenwerte erfassen das feste Beobachtungsfenster nach Erscheinen der Überschrift. Cross-Origin-Ressourcen ohne Timing-Freigabe können ihre Bytegrößen verbergen.

Die SQL-Prüfung verwendet eine eigene, kurzlebige PostgreSQL-Instanz ohne veröffentlichten Port. Sie liest die tatsächlichen SELECT-Abfragen aus den beiden Doku-Endpunkten und prüft normale und ältere Datensätze:

```powershell
docker run --rm --name talea-performance-postgres -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:16-alpine
# Warten, bis PostgreSQL bereit ist
bun scripts/performance/check-doku-lists.mjs
docker stop talea-performance-postgres
```

`convert-font.py` wandelt die vorhandene OFL-Markenschrift verlustfrei von TTF in WOFF2 um. Es benötigt FontTools und Brotli; Zeichenzuordnung und variable Schriftachsen werden nach der Umwandlung kontrolliert. Die TTF-Quelldatei und Lizenz bleiben erhalten.

Messdaten, Screenshots und Testbuilds liegen im ignorierten Verzeichnis `.performance/`. Die Werkzeuge verändern keine Produktionsdaten und führen keine Story-, Bild- oder Audiogenerierungen aus.
