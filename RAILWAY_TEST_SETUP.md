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

## ⚠️ Offener Punkt: Clerk-Login

**Der Login auf der Test-URL funktioniert noch nicht.** Alles andere läuft.

Die Test-Umgebung nutzt dieselben Clerk-Live-Keys wie Production
(`pk_live_…` für `clerk.talea.website`). Clerk-Production-Instanzen erlauben nur
konfigurierte Domains. Verifiziert am 2026-07-28:

```
GET https://clerk.talea.website/v1/environment
Origin: https://frontend-test-d2a1.up.railway.app
→ HTTP 400 (abgelehnt)
```

Zwei Möglichkeiten, beide brauchen das Clerk-Dashboard:

**Variante 1 — Test-Domain erlauben** (schnell, du testest mit deinem echten Account)
Clerk Dashboard → deine Production-Instanz → Domains → Satellite-Domain
`frontend-test-d2a1.up.railway.app` hinzufügen.
Test und Production teilen sich dann den Nutzer-Pool. Die *Daten* bleiben
trotzdem getrennt, weil die Datenbanken getrennt sind.

**Variante 2 — eigene Clerk-Development-Instanz** (saubere Trennung)
In Railway → Environment `test`:
- Service `frontend`: `VITE_CLERK_PUBLISHABLE_KEY` = `pk_test_…`
- Service `backend 2`: `CLERK_SECRET_KEY` = `sk_test_…`

Danach das Frontend neu deployen (der Key wird beim Container-Start in
`/config.js` geschrieben). Test hat dann eigene Nutzerkonten.

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
