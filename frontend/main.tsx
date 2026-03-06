import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./src/i18n"; // Initialize i18n

const DISABLE_SW_FLAG = "talea:disable-sw";
const STORAGE_USAGE_THRESHOLD = 0.92;
const MIN_FREE_BYTES = 64 * 1024 * 1024;
const FORCE_DISABLE_SERVICE_WORKER = true;
const VERBOSE_RUNTIME_WARNINGS_FLAG = "talea:verbose-runtime-warnings";

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

async function shouldEnableServiceWorker(): Promise<boolean> {
  if (FORCE_DISABLE_SERVICE_WORKER) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (localStorage.getItem(DISABLE_SW_FLAG) === "1") return false;

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
    localStorage.setItem(DISABLE_SW_FLAG, "1");
    await unregisterServiceWorkersAndClearCaches();
    if (import.meta.env.DEV) {
      const reason = FORCE_DISABLE_SERVICE_WORKER
        ? "forced by config"
        : "storage pressure";
      console.info(`[PWA] Service Worker disabled (${reason}).`);
    }
    return;
  }

  const { registerSW } = await import("virtual:pwa-register");
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.warn("[PWA] SW registration failed", error);
    },
  });
}

window.addEventListener("unhandledrejection", (event) => {
  if (!isStoragePressureError(event.reason)) return;
  localStorage.setItem(DISABLE_SW_FLAG, "1");
  void unregisterServiceWorkersAndClearCaches();
});

installRuntimeWarningFilters();
void setupPwaRegistration();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
