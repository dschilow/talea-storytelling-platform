# Talea Android

Android uses the actual React application in `../frontend/`: the same routes,
components, icons, logos, colours, typography, animations, account permissions,
readers, story and avatar wizards, games, admin pages and 3D cosmos. Both clients
use the existing Encore backend and Clerk instance.

## How it works

`App.tsx` mounts `src/web/TaleaWebApp.tsx`. Every Android `preBuild` runs
`scripts/build-web.mjs`, building the canonical frontend directly into
`android/app/src/main/assets/talea/`. It also renders Android launcher/splash
resources from the original SVGs in `frontend/public/brand/` and packages the
same Google Fonts files for offline use.

`plugins/web/TaleaWebAssets.java` serves packaged files under
`https://www.talea.website` inside Android System WebView. This keeps the web
origin required by Clerk, IndexedDB, camera access and the existing API CORS
configuration. The UI does not depend on downloading the website. Backend,
Clerk and external resources retain ordinary HTTPS and authentication. HTTP
range requests support local audio/video seeking. The website service worker
is disabled inside the app so it cannot replace the APK's frontend.

`frontend/platform/` contains the small Android adapters. Ordinary browser visits
keep their existing behavior. The native bridge checks its channel, source
origin, main-frame host nonce, actions and payloads before accessing Android features.

| Android capability | Implementation |
| --- | --- |
| Back button | Existing game overlays/exit confirmation, dialogs, web navigation, then app exit |
| System bars | Safe areas and light/dark appearance follow the web theme |
| Camera and uploads | Upstream WebView camera permissions and Android file chooser |
| PDF, JSON and image export | Existing web generators, Android system share/save sheet |
| Google/Apple sign-in | Same Clerk form; system auth browser and the original web sign-in attempt |
| Audio and lock screen | Existing web queue and controls; Expo native audio owns playback |
| Game privacy | Existing verified receiver-only Alibi audio module; private audio stops on app blur |
| Offline library | Existing web IndexedDB and licence/profile scoping, with the app shell and fonts in the APK |
| App links | All current web paths, queries and fragments; `talea://game` opens `/spiel` |

The previous React Native screens remain in the source for reference, but the
app entry point does not mount their separate UI or navigation.

## Build and run

Install JDK 17 or newer, Android SDK 36 and NDK 27.1.12297006. Install dependencies
with **Bun** in both the repository root and `mobile/`.

Create `mobile/.env` from `.env.example` and set the same **public** Clerk key as
the website. Keep all secret keys out of this file.

```bash
cd mobile
bun install
bun run android             # debug build; Metro required
bun run android:release     # bundled, installable APK
```

The default backend is the same Railway service as the web app. Override it with
`EXPO_PUBLIC_BACKEND_URL` when using an isolated development environment.

```bash
bun run build:web           # build the full web app and its assets into Android
bun run test:web            # verify every public asset and all packaged hashes
bun run typecheck
bun test
```

The APK is generated at `android/app/build/outputs/apk/release/app-release.apk`.
Release signing currently uses the project's existing debug keystore. Configure
an upload key before publishing to Google Play.

`plugins/with-web-app.js` and `plugins/with-alibi.js` preserve the native
integration through `bun run prebuild`. Never patch installed WebView packages.
The complete app already contains the game media; the old standalone Alibi asset
pack is excluded to avoid duplicating it in the APK. The isolated game QA scripts
remain available via `build:alibi`, `test:alibi` and `test:alibi:android`.

## Updating an existing installation

Sign in once again after switching from the previous native frontend. Backend
accounts, profiles, avatars, stories and progress stay with the same account.
The first launch imports the previous Android theme, language, Alibi collection,
setup and resumable game state when the new web storage has no replacement.

The previous native offline cache is retained in app storage. Save those items
again in the shared offline library; its IndexedDB storage is separate from the
old filesystem/AsyncStorage cache. App updates retain the new offline library.

## Local diagnostics

`EXPO_PUBLIC_WEBVIEW_DEBUG=true` enables Chrome DevTools for a local QA build.
Leave it unset for deliverable/release APKs. Gradle tracks this environment value
so a subsequent build cannot accidentally reuse the diagnostic JS bundle.

On Windows, Java's Unix-domain socket path may exceed its length limit when the
execution environment supplies a long temporary directory. Set
`JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=<short-existing-local-directory>`
for that build process. Keep machine-specific paths and TLS settings out of
project Gradle configuration.

Browser/fixture tests cannot verify physical earpiece isolation. Check the
receiver, notification shade, camera, actual sign-in, file sharing and locked
screen playback on a handset before a store release.
