/**
 * Ambient shim for the `~backend/*` specifiers in the generated Encore client.
 *
 * WHY THIS EXISTS
 * ---------------
 * `encore gen client --target leap` emits a client that *imports* its request and
 * response types from the backend source (`~backend/story/list`, …) rather than
 * inlining them. The web app resolves that with a tsconfig path mapping to
 * ../backend, which is fine there — the web and the backend always live in the
 * same checkout.
 *
 * The mobile app cannot do that:
 *   1. It must typecheck and bundle without the backend workspace present
 *      (EAS Build / CI ship only the `mobile/` directory).
 *   2. Resolving those specifiers pulls the backend's own `encore.dev` imports
 *      into the app's typecheck — server framework source, in a React Native app.
 *
 * WHAT THIS COSTS
 * ---------------
 * Endpoint *names* stay fully typed and autocompleted (that is the part that
 * actually prevents mistakes). Endpoint *payloads* degrade to `any`, so request
 * and response shapes are not checked at the call site. The app therefore relies
 * on `src/types/*.ts` — mirrored from the web workspace by `bun run sync-locales`
 * — for the domain shapes it reads, and screens annotate responses explicitly.
 *
 * HOW TO GET FULL TYPES BACK
 * --------------------------
 * Run the backend locally (`encore run`) and regenerate a self-contained client:
 *
 *     cd backend
 *     encore gen client --lang=typescript -o ../mobile/src/api/client.ts
 *
 * That variant inlines every type (it is the default; `--ts:shared-types` is what
 * produces the `~backend` imports). Delete this file once that lands, and drop
 * the import-rewriting step from scripts/sync-backend-client.mjs.
 */

// Shorthand ambient module declaration: every named import from a `~backend/…`
// specifier resolves to `any`. A bodied `declare module` would only satisfy the
// default import, and the client imports each endpoint by name.
declare module '~backend/*';
