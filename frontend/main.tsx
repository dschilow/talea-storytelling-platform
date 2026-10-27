import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { toast } from "sonner";
import App from "./App";
import "./index.css";
import "./styles/fonts";
import "./src/i18n"; // Initialize i18n
import { installAndroidBridge, isAndroidApp } from './platform/native';

const androidReady = installAndroidBridge();

// The service worker is what makes offline mode survive a reload: without a
// precached app shell, opening Talea without a network yields the browser's
// error page and the saved stories/audio in IndexedDB stay unreachable.
//
// It used to be force-disabled because the precache swallowed ~28 MB of images
// and tripped the storage quota. That cause is fixed in vite.config.ts (app
// shell only + capped runtime caches), so registration is on again — with a
// TIME-BOXED kill switch, not a permanent one. A single bad day must not cost a
// user offline reading forever.
const DISABLE_SW_UNTIL_FLAG = "talea:disable-sw-until";
const LEGACY_DISABLE_SW_FLAG = "talea:disable-sw";
const DISABLE_SW_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const STORAGE_USAGE_THRESHOLD = 0.92;
const MIN_FREE_BYTES = 64 * 1024 * 1024;
const VERBOSE_RUNTIME_WARNINGS_FLAG = "talea:verbose-runtime-warnings";
// A new build waits until it is applied (vite.config.ts: registerType "prompt").
// Found while the page is still starting, it replaces the old build at once —
// nothing has been typed, read or played yet. Found later, it waits for a tap,
// so a story being read or a wizard being filled is never reloaded under the
// user. Without this, every open tab kept serving yesterday's build.
const SILENT_UPDATE_WINDOW_MS = 15_000;
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
let userHasInteracted = false;
for (const type of ["pointerdown", "keydown", "wheel"] as const) {
  window.addEventListener(type, () => { userHasInteracted = true; }, { once: true, capture: true, passive: true });
}

function shouldKeepVerboseRuntimeWarnings(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem(VERBOSE_RUNTIME_WARNINGS_FLAG) === "1";
  } catch {
    return false;
  }
}

function shouldSuppressRuntimeWarning(args: unknown[]): boolean {
  const text = args
    .map((value) => (typeof value === "string" ? value : String(value)))
    .join(" ");

  if (
    text.includes(
      "THREE.THREE.Clock: This module has been deprecated. Please use THREE.Timer instead."
    )
  ) {
    return true;
  }

  if (
    text.includes("THREE.WebGLProgram: Program Info Log:") &&
    text.includes("warning X4122")
  ) {
    return true;
  }

  return false;
}

function installRuntimeWarningFilters(): void {
  if (typeof window === "undefined") return;
  if (shouldKeepVerboseRuntimeWarnings()) return;

  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (shouldSuppressRuntimeWarning(args)) return;
    originalWarn(...args);
  };
}

function isStoragePressureError(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason || "");
  return (
    message.includes("QuotaExceededError") ||
    message.includes("FILE_ERROR_NO_SPACE") ||
    message.includes("UnknownError: Internal error") ||
    message.includes("Context Lost")
  );
}

function deleteIndexedDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function unregisterServiceWorkersAndClearCaches(): Promise<void> {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.allSettled(cacheNames.map((name) => caches.delete(name)));
  }

  await Promise.allSettled([
    deleteIndexedDb("workbox-expiration"),
    deleteIndexedDb("workbox-precache-v2"),
  ]);
}

function suspendServiceWorker(): void {
  try {
    localStorage.setItem(
      DISABLE_SW_UNTIL_FLAG,
      String(Date.now() + DISABLE_SW_COOLDOWN_MS)
    );
  } catch {
    // localStorage blocked — the SW simply stays enabled next boot.
  }
}

function isServiceWorkerSuspended(): boolean {
  try {
    // Drop the old permanent flag so browsers that hit storage pressure once
    // (back when the precache was oversized) recover on their next visit.
    localStorage.removeItem(LEGACY_DISABLE_SW_FLAG);

    const until = Number(localStorage.getItem(DISABLE_SW_UNTIL_FLAG) || "0");
    if (!Number.isFinite(until) || until <= Date.now()) {
      localStorage.removeItem(DISABLE_SW_UNTIL_FLAG);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function shouldEnableServiceWorker(): Promise<boolean> {
  if (isAndroidApp()) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (isServiceWorkerSuspended()) return false;

  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage ?? 0;
      const quota = estimate.quota ?? 0;
      if (quota > 0) {
        const freeBytes = quota - usage;
        const usageRatio = usage / quota;
        if (usageRatio >= STORAGE_USAGE_THRESHOLD || freeBytes < MIN_FREE_BYTES) {
          return false;
        }
      }
    } catch {
      // ignore estimate failures and continue with default behavior
    }
  }

  return true;
}

async function setupPwaRegistration(): Promise<void> {
  const enableSw = await shouldEnableServiceWorker();
  if (!enableSw) {
    suspendServiceWorker();
    await unregisterServiceWorkersAndClearCaches();
    console.info(
      "[PWA] Service Worker suspended (storage pressure). Offline mode is limited until storage frees up."
    );
    return;
  }

  const { registerSW } = await import("virtual:pwa-register");
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (!userHasInteracted && performance.now() < SILENT_UPDATE_WINDOW_MS) {
        void updateSW(true);
        return;
      }
      toast("Neue Version von Talea", {
        id: "app-update",
        description: "Aktualisiere, sobald du gerade nichts eingibst.",
        duration: Infinity,
        action: { label: "Aktualisieren", onClick: () => void updateSW(true) },
      });
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // A single-page app never navigates, so the browser would not look for a
      // new sw.js while the tab stays open.
      window.setInterval(() => {
        if (document.visibilityState !== "visible" || !navigator.onLine) return;
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError(error) {
      console.warn("[PWA] SW registration failed", error);
    },
  });
}

window.addEventListener("unhandledrejection", (event) => {
  if (!isStoragePressureError(event.reason)) return;
  suspendServiceWorker();
  void unregisterServiceWorkersAndClearCaches();
});

installRuntimeWarningFilters();
// Downloading the offline shell competes with the route's scripts and hero
// image. Start its installation once the initial page has finished loading.
function schedulePwaRegistration(): void {
  if (typeof requestIdleCallback === 'function') {
    window.requestIdleCallback(() => { void setupPwaRegistration(); }, { timeout: 2000 });
  } else {
    setTimeout(() => { void setupPwaRegistration(); }, 0);
  }
}
if (document.readyState === 'complete') schedulePwaRegistration();
else window.addEventListener('load', schedulePwaRegistration, { once: true });

void androidReady.then(() => ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <React.Suspense fallback={<div className="min-h-screen bg-[var(--talea-page-solid)]" />}>
        <App />
      </React.Suspense>
    </MotionConfig>
  </React.StrictMode>
));
