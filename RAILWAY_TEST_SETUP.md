# Test-Umgebung (Staging) auf Railway

Die Test-Umgebung ist **fertig eingerichtet**. Dieses Dokument beschreibt, wie sie
aufgebaut ist und wie du damit arbeitest.

## Workflow

```
test-main  ──►  Railway "test"        ──►  frontend-test-d2a1.up.railway.app
   │                                        (eigene DB, eigene Services)
   │
   └── merge ──►  main  ──►  Railway "production"  ──►  www.talea.website
```

Feature entwickeln → auf `test-main` pushen → auf der Test-URL prüfen →
nach `main` mergen → live.

## Test-URLs

| Service | URL |
|---|---|
| Frontend | https://frontend-test-d2a1.up.railway.app |
| Backend | https://backend-2-test.up.railway.app |
| TTS | https://tts-service-test.up.railway.app |
| MCP Main | https://talea-mcp-main-test.up.railway.app |
| MCP Validator | https://talea-mcp-validator-test.up.railway.app |

Production bleibt unverändert auf `www.talea.website` /
`backend-2-production-3de1.up.railway.app`.

## Tägliche Nutzung

```bash
# Feature entwickeln
git checkout test-main
git merge main            # optional: aktuellen Stand von main holen
# ... Änderungen ...
git commit -am "feat: neues Feature"
git push origin test-main
```

Ab hier läuft alles automatisch:

1. **Railway** baut direkt aus dem `test-main`-Branch: `frontend`, `tts-service`,
   `talea-mcp-main`, `talea-mcp-validator`, `NSQ`.
2. **GitHub Actions** (`deploy-railway-test.yml`) baut das Encore-Backend-Image,
   pusht es als `ghcr.io/dschilow/talea-storytelling-platform:test-main` und
   triggert danach den Redeploy des Backend-Services in der Test-Umgebung.

Fortschritt sehen:
- GitHub Actions: https://github.com/dschilow/talea-storytelling-platform/actions
- Railway: https://railway.app/project/05209d9d-2f3a-46f0-9f6f-74a66ebfc80e

Wenn alles passt:

```bash
git checkout main
git merge test-main
git push origin main
```

## Aufbau der Test-Umgebung

Die Umgebung ist ein **Fork der Production-Umgebung**. Alle 8 Services wurden
inklusive Variablen kopiert, dann auf Test umgestellt.

**Railway-IDs**

| Was | ID |
|---|---|
| Projekt `Talea` | `05209d9d-2f3a-46f0-9f6f-74a66ebfc80e` |
| Environment `production` | `7a7f74fa-422e-45a4-aeb4-f51f20eaad05` |
| Environment `test` | `d3454a91-d573-4e9b-9d54-febf697e1533` |
| Service `backend 2` | `2a42848f-e07b-422e-ba25-961a13df61f6` |

Service-IDs sind in Railway pro Projekt eindeutig und in beiden Umgebungen
gleich — unterschieden wird über die `environmentId`.

**Was gegenüber Production geändert wurde**

| Service | Änderung |
|---|---|
| alle GitHub-Services | Deployment-Branch `main` → `test-main` |
| `backend 2` | Image-Tag `:latest` → `:test-main` |
| `frontend` | `VITE_BACKEND_URL` → Test-Backend |
| `backend 2` | `IMAGE_PROXY_BASE_URL` → Test-Backend |
| `backend 2` | `TTS_SERVICE_URL` → Test-TTS |
| `backend 2` | `CHATTERBOX_TTS_SERVICE_URL` → Test-Chatterbox |

**Was automatisch isoliert ist**

- **Eigene PostgreSQL-Instanz** mit eigenem Volume. Die DB-Variablen nutzen
  Referenzen (`${{Postgres.DATABASE_URL}}`), lösen sich also automatisch auf die
  Test-Datenbank auf. Die Test-DB startet leer; die Encore-Migrationen laufen
  beim ersten Backend-Start durch.
- Eigene interne Domains (`*.railway.internal`) pro Umgebung.
- Eigene NSQ-Instanz.

**Was mit Production geteilt wird** (bewusst)

- API-Keys: OpenAI, Gemini, Anthropic, OpenRouter, Runware, ElevenLabs, RunPod.
  → Test-Läufe verursachen echte API-Kosten.
- Der Railway-Storage-Bucket (`BUCKET_*`). Test-Bilder landen im selben Bucket
  wie Production. Das ist rein additiv, überschreibt also nichts.

## GitHub Secrets

Gesetzt und einsatzbereit:

| Secret | Zweck |
|---|---|
| `RAILWAY_API_TOKEN` | Railway GraphQL API |
| `RAILWAY_ENVIRONMENT_ID_TEST` | Test-Environment |
| `RAILWAY_SERVICE_ID_TEST` | Backend-Service im Test |
| `RAILWAY_ENVIRONMENT_ID` | Production-Environment |
| `RAILWAY_SERVICE_ID` | Backend-Service in Production |

## Offener Punkt: Clerk

Die Test-Umgebung nutzt aktuell dieselben **Clerk-Live-Keys** wie Production
(`pk_live_…` für `clerk.talea.website`). Clerk-Production-Instanzen erlauben nur
konfigurierte Domains — der Login auf
`frontend-test-d2a1.up.railway.app` schlägt daher voraussichtlich fehl.

Zwei Möglichkeiten:

1. **Test-Domain in Clerk erlauben** — Clerk Dashboard → Domains →
   `frontend-test-d2a1.up.railway.app` als Satellite-Domain hinzufügen.
2. **Clerk-Development-Instanz nutzen** — in der Railway-Test-Umgebung
   `VITE_CLERK_PUBLISHABLE_KEY` auf `pk_test_…` und `CLERK_SECRET_KEY` auf
   `sk_test_…` setzen. Dann hat Test eigene Nutzerkonten, komplett getrennt von
   Production.

Variante 2 ist die sauberere Trennung, Variante 1 ist schneller und lässt dich
mit deinem echten Account testen.

## Troubleshooting

**Backend-Deploy startet nicht**
Das Image `:test-main` existiert erst, nachdem der GitHub-Actions-Lauf
durchgelaufen ist. Beim allerersten Mal also erst Actions abwarten.

**Frontend zeigt Production-Daten**
`VITE_BACKEND_URL` wird zur *Build*-Zeit eingebacken. Nach einer Änderung dieser
Variable muss das Frontend neu gebaut werden (Railway → Service → Redeploy).

**Datenbank leer**
Erwartet. Die Test-DB startet leer, Migrationen legen das Schema an. Test-Avatare
und -Stories musst du dort neu anlegen.

**Kosten**
Die Test-Umgebung verdoppelt die Zahl laufender Railway-Services. Nicht benötigte
Services (z. B. `tts-chatterbox-service`) können in der Test-Umgebung gelöscht
werden, ohne Production zu beeinflussen.
