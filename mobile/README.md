# Talea Mobile (Android)

Native Android app for Talea, built with Expo SDK 54 / React Native 0.81. It talks
to the same Encore backend as the web app and mirrors its feature set.

## Quick start

```bash
cd mobile
bun install                 # a local .npmrc pins the public registry — see "Registry" below
cp .env.example .env        # then fill in the Clerk key
bun run start               # Metro, for a dev client
bun run android             # build + install a debug APK on a connected device/emulator
```

Requirements: JDK 17, Android SDK 36, NDK 27.1.12297006, and a device or emulator
on API 24+.

### Gradle troubleshooting

These have all been hit on this project. Check the toolchain and stale build
state before changing application code.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `[CXX1101] NDK … did not have a source.properties file` | An NDK download was interrupted and left a stub directory | `rm -rf $ANDROID_HOME/ndk/<version>` and rebuild |
| `duplicate class: com.horcrux.svg.*` | `bun install` upgraded `react-native-svg` in place and left the previous version's files in `android/src/main/java`. The package selects one version-specific source set (`…75/`, `…74/`), so the leftovers collide | `rm -rf node_modules/react-native-svg && bun install` |
| `Failed to create MD5 hash for … output-metadata.json` | A previous build was killed and left half-written intermediates | Delete every `node_modules/*/android/build` plus `android/app/build` |

The last two are worth knowing about because **neither is caught by
`bun run typecheck` or `expo export`** — they live purely in the native build.

### Environment

`mobile/.env` (never committed):

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_BACKEND_URL=https://backend-2-production-3de1.up.railway.app
```

`EXPO_PUBLIC_BACKEND_URL` is optional — it falls back to `expo.extra.backendUrl`
in `app.json`, then to production. Point it at `http://10.0.2.2:4000` to run
against a local `encore run` from the Android emulator.

### Registry

`mobile/.npmrc` pins the public npm registry. Without it, a machine-level
`~/.npmrc` pointing at a corporate feed shadows the Expo/React Native packages
and every install fails to resolve. This mirrors the repo-root `.npmrc`.

## Builds

```bash
bun run android            # debug
bun run android:release    # release variant (currently signed with the debug keystore)
bun run prebuild           # regenerate android/ from app.json after native config changes
```

**Before shipping to Play:** `android/app/build.gradle` still signs release builds
with `debug.keystore`. Generate a real upload key and wire it up first.

`android/` is generated from `app.json` — `expo prebuild --clean` overwrites it.
Machine-specific TLS proxy settings belong in `~/.gradle/gradle.properties`.
Use `systemProp.javax.net.ssl.trustStoreType=Windows-ROOT` there only with a
Windows JDK that supplies SunMSCAPI. The Alibi Gradle task and speech package
are restored by `plugins/with-alibi.js` during prebuild.

## Staying in sync with the web app

Shared sources are mirrored from `frontend/` rather than reimplemented, so the two
clients cannot drift. Re-run these after backend or shared-type changes:

```bash
bun run sync-client     # frontend/client.ts        -> src/api/client.ts
bun run sync-locales    # locales + ttsChunking + shared domain types
```

| Mirrored | Why |
| --- | --- |
| `client.ts` | The generated Encore client — the entire API surface |
| `i18n/locales/*.json` | Identical copy in all 7 languages |
| `ttsChunking.ts` | `normalizeTTSText()` is the fix for the German/multilingual missing-sentence bug; a divergence here silently corrupts audio |
| `types/{story,avatar,doku,tavi,avatarForm}.ts` | Payload shapes, AI model ids, and the avatar option catalogues |
| `screens/Game/alibi` + `public/game` | Mitternachts-Alibi is bundled directly from the current web source by every Android build |

`sync-client` also patches the generated client so it stands alone on device:
it strips the `encore.dev` server-framework import, drops the `import.meta`
default export, and widens the `~backend/*` payload helpers. See
[`src/api/backend-modules.d.ts`](src/api/backend-modules.d.ts) for the full
rationale and how to restore precise end-to-end types.

## Mitternachts-Alibi

Open the game from its Home card or `talea://game`. The APK includes the
original React game, all eight cases, four difficulties, 4–8 players, voices,
music, effects, animated village and 3D collection. `AlibiScreen` hosts this
local bundle in Android System WebView. The native Clerk client retrieves the
character pool; portraits are cached in the app's documents directory.

Collection, setup, sound preference and resumable game state live in
AsyncStorage. App switching and the notification shade stop speech and the
timer and cover private information. Android Back closes a game overlay first,
then uses the game's existing exit confirmation.

Private MP3s and fallback speech use native Android communication audio and the
built-in earpiece at full clip volume (the earpiece itself is the privacy; the call
volume buttons set loudness). On Android 12+ the host waits for
`setCommunicationDevice` to confirm that route; MP3 playback verifies the actual
output while muted before becoming audible (all outputs on Android 16+).
Private TTS is synthesized to a temporary app-private file and uses the same
verified receiver player; the file is deleted on completion or cancellation.
Public speech returns to normal media audio at full clip volume. Music and
ambience stop during secrets. There is no private loudspeaker fallback: an
unavailable earpiece leaves the secret silent, with a private reading hint.
Pause, exit and WebView failure release playback and restore the previous audio
mode. Volume buttons control call volume during secrets. No microphone is opened
and the app does not change the user's system volume.

Install both workspaces' dependencies with Bun (repository root and `mobile/`).
The Android `preBuild` task generates `android/app/src/main/assets/alibi/`;
generated files stay out of Git. `bun run build:alibi` generates the same pack
manually. The source and media remain maintained in `frontend/`.

```bash
cd mobile
bun run typecheck
bun test
bun run build:alibi --qa     # separate test bundle under scripts/game-qa/out/
bun run test:alibi          # Playwright; set PLAYWRIGHT_PATH if needed
bun run test:alibi:android  # running emulator, Android SDK 36 and JAVA_HOME
bun run android:release
```

The automated bundle checks cover 17 phases at three viewport sizes, every
player count and difficulty, all eight case rewards, escaped thieves, clues,
duels, seals, interruption recovery, native MP3/TTS privacy flags, routing failure,
background silence and byte-for-byte media parity. These use
Chromium with a fixture native bridge. The Android smoke script builds a separate
test APK with the same bundle and a fixture pool, checking all 17 phases, local
MP3 playback and privacy recovery in System WebView. Set `JAVA_HOME` to JDK 17
and `ANDROID_HOME` to the SDK location. A signed-in device pass checks Clerk
retrieval, earpiece isolation versus public speakers, audio levels, notification
shade and system Back. Browser or emulator checks cannot prove physical speaker
isolation on a particular handset.

## Architecture

```
src/
├── api/          Generated Encore client + useBackend() (auth + profile scoping)
├── audio/        TTS conversion queue
├── components/   ui/ (design-system primitives), cards/, audio/, form/, profile/
├── hooks/        React Query data access
├── i18n/         i18next setup + mirrored locales
├── lib/          storage, audioCache, personality, content, haptics, ttsChunking
├── navigation/   Root stack, tab navigator, custom tab bar, deep links
├── providers/    Clerk cache, UserAccess, ChildProfiles, Audio, Offline, Toast
├── screens/      One folder per feature area
├── theme/        Design tokens ported from frontend/index.css + typography
└── types/        Mirrored domain types
```

### Design system

`theme/tokens.ts` is a 1:1 port of the `--talea-*` CSS custom properties, with
web-only constructs translated: CSS gradients become `<Gradient token={…}>`
colour stops, `box-shadow` becomes paired `shadow*`/`elevation` values, and
`color-mix()` results are pre-resolved. Light and dark are both complete.

Screens never hard-code a colour, font size or radius — everything goes through
`useTheme()` and the `Text` primitive.

### Behaviour ported from the web

- **Personality traits** — nine base traits starting at 0, subcategories created
  only when the AI awards them, every change carrying its reason
  (`lib/personality.ts`, shown in `GrowthSheet` and the avatar detail screen).
- **Story wizard** — the same six steps, gating, and `mapWizardStateToAPI`
  derivation of tone/suspense/humour/pacing, plus the Gemini-Pro model fallback
  and the post-failure recovery poll.
- **Profile scoping** — `useBackend()` injects the active child profile into the
  same method list the web client uses.
- **TTS pipeline** — identical chunking and cache keys, so mobile playback hits
  the same server-side audio library the web already populated.

### Native-only improvements

These exist because the platform allows something the web could not do:

- Audio keeps playing in the background and with the screen locked.
- TTS chunks are written to disk as real files, so a re-listen is free and works
  offline.
- Session tokens live in the Android Keystore via `expo-secure-store`.
- Offline saves mirror chapter images to the filesystem, so a saved story reads
  identically with no connectivity.
- Connectivity is probed against the backend rather than trusted from the OS.

### Deliberate divergences

| Web | Mobile | Reason |
| --- | --- | --- |
| 3D cosmos (three.js) | Explorable domain/mastery list | The 3D scene's interaction and thermal budget are wrong for a phone; same data, native interaction |
| Three story readers (cinematic / scroll / legacy) | One paged reader | The legacy variants exist for browser compatibility, not for users |
| Centred dialogs | Bottom sheets | Reachable one-handed, gesture-dismissible |
| Full admin content editing | Read-first admin | Bulk editing needs screen real estate to be safe |
| PDF export | Offline save + audio | Sharing a PDF from a phone is a worse fit than an offline copy |

## Verification

```bash
bun run typecheck                          # 0 errors
bun test                                   # personality traits, Alibi bridge and recovery
bunx expo export --platform android        # verifies every import resolves
```

All three are green as of the initial implementation.

`src/lib/personality.test.ts` locks down the trait rules — nine traits starting
at 0, subcategories created only when the AI awards one, every change carrying
its reason, and the 250/1000 ceilings. The backend has shipped several storage
shapes for traits over time, so this is the one piece of logic worth pinning.

## Known gaps before release

1. **Release signing** — still the debug keystore (see "Builds").
2. **Push notifications** — not wired up; `expo-notifications` is not installed.
3. **API payload types** — degraded to `any` at the client boundary; restore by
   generating a self-contained client (see `src/api/backend-modules.d.ts`).
4. **Other screen coverage is narrow** — personality traits and the Alibi bundle
   have automated checks; the remaining screens and the TTS queue have no tests.
