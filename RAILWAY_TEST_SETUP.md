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

**Was isoliert ist**

- **Eigene PostgreSQL-Instanz** mit eigenem Volume. Die DB-Variablen nutzen
  Referenzen (`${{Postgres.DATABASE_URL}}`), lösen sich also automatisch auf die
  Test-Datenbank auf. Die Test-DB startet leer; die Encore-Migrationen laufen
  beim ersten Backend-Start durch.
- Eigene interne Domains (`*.railway.internal`) pro Umgebung.
- Eigene NSQ-Instanz.

> **Achtung beim Forken einer Umgebung:** Railway kopiert Services und Variablen,
> aber **keine Volumes**. Der Postgres-Container startete deshalb zunächst nicht
> (`/var/lib/postgresql/data` fehlte), was als Folgefehler auch `talea-mcp-main`
> mit `ENOTFOUND postgres.railway.internal` scheitern ließ. Das Volume für die
> Test-Datenbank wurde nachträglich angelegt (`postgres-volume-shqm`). Wer die
> Umgebung neu aufbaut, muss diesen Schritt einplanen.

Verifiziert am 2026-07-28: Test- und Production-Postgres haben unterschiedliche
`DATABASE_URL`, unterschiedliche Passwörter, eigene Volumes und eigene
TCP-Proxys. Das Test-Frontend liefert zur Laufzeit
`window.ENV.BACKEND_URL = https://backend-2-test.up.railway.app`.

> Hinweis: `frontend/config.ts` enthält die Production-Backend-URL als
> hardcodierten Fallback. Der greift nur, wenn `window.ENV.BACKEND_URL` fehlt
> *und* der Hostname `talea.website` ist — auf der Test-Domain also nie.

**Was mit Production geteilt wird** (bewusst)

- API-Keys: OpenAI, Gemini, Anthropic, OpenRouter, Runware, ElevenLabs, RunPod.
  → Test-Läufe verursachen echte API-Kosten. Bei RunPod/ElevenLabs teilen sich
  Test und Production außerdem die Concurrency-Limits — ein großer Test-Lauf
  kann Production-TTS ausbremsen.
- Der Railway-Storage-Bucket (`BUCKET_*`). Test-Bilder landen im selben Bucket
  wie Production. Rein additiv (Keys sind UUID-basiert), überschreibt nichts.

## GitHub Secrets

| Secret | Zweck |
|---|---|
| `RAILWAY_API_TOKEN` | Railway GraphQL API |
| `RAILWAY_ENVIRONMENT_ID_TEST` | Test-Environment |
| `RAILWAY_SERVICE_ID_TEST` | Backend-Service im Test |

### Production deployt weiterhin *nicht* automatisch

`scripts/trigger-railway-deploy.mjs` braucht `RAILWAY_API_TOKEN`,
`RAILWAY_ENVIRONMENT_ID` und `RAILWAY_SERVICE_ID`. `RAILWAY_ENVIRONMENT_ID` ist
bewusst **nicht** gesetzt, deshalb überspringt der Production-Workflow seinen
Railway-Schritt — genau wie vorher. Ein Push auf `main` baut also weiterhin nur
das `:latest`-Image; den Production-Redeploy löst du selbst im Railway-Dashboard
aus.

Wenn du Production später doch automatisch deployen willst, reicht ein Secret:

```
RAILWAY_ENVIRONMENT_ID = 7a7f74fa-422e-45a4-aeb4-f51f20eaad05
```

## Clerk: eigene Development-Instanz im Test

Die Test-Umgebung nutzt die Clerk-**Development**-Instanz
`sincere-jay-4.clerk.accounts.dev`, Production unverändert die Live-Instanz
`clerk.talea.website`.

Das war nötig, weil Clerk-Production-Instanzen nur konfigurierte Domains
erlauben — gemessen am 2026-07-28 antwortete `clerk.talea.website` auf Anfragen
mit `Origin: https://frontend-test-d2a1.up.railway.app` mit HTTP 400.

Gesetzt in Railway → Environment `test`:

| Service | Variable | Wert |
|---|---|---|
| `frontend` | `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_…` |
| `backend 2` | `CLERK_SECRET_KEY` | `sk_test_…` |
| `talea-mcp-main` | `CLERK_SECRET_KEY` | `sk_test_…` |

Dazu kam ein Code-Change: `backend/auth/auth.ts` führt eine Allowlist der
Origins, die Clerk-Tokens für das Backend erzeugen dürfen
(`RAW_AUTHORIZED_PARTIES`). Die Test-Frontend-Domain musste dort ergänzt
werden — sonst weist das Backend gültige Tokens zurück.

**Konsequenz:** Test hat einen eigenen Nutzer-Pool. Dein Production-Account
existiert dort nicht; du legst dir im Test einmalig einen Account an.

**Wenn sich die Test-Frontend-Domain jemals ändert**, müssen beide Stellen
nachgezogen werden: `RAW_AUTHORIZED_PARTIES` in `auth.ts` und ggf. die
Clerk-Dashboard-Einstellungen.

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
