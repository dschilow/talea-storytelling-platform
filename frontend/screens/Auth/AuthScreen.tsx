import React, { useState, useRef, useEffect } from "react";
import { SignIn, SignUp } from "@clerk/clerk-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import "./AuthScreen.css";
import { useAndroidSSO } from '../../platform/auth';

/**
 * Clerk's <SignIn>/<SignUp> widgets mount asynchronously, leaving an empty
 * gap until their JS initialises. We show a branded loader inside the mount
 * area and fade it out the moment Clerk paints its real form, so the user
 * never stares at blank space.
 *
 * The widget stays invisible while the loader is up and the loader is removed
 * from the DOM once it has faded — the two must never be visible at once, or
 * the spinner/skeletons sit on top of the input fields.
 */

/* Any real interactive element inside the mount area means Clerk has painted.
   Kept deliberately broad (plain input/button too) so a Clerk class rename
   can't strand the loader on top of a working form. */
const CLERK_READY_SELECTOR =
  'input, button, [class*="cl-formButtonPrimary"], [class*="cl-socialButtonsBlockButton"], [class*="cl-formFieldInput"]';
const clerkAppearance = {
  variables: {
    colorPrimary: "#B95134",
    colorBackground: "transparent",
    colorText: "#3E281F",
    colorTextSecondary: "#786052",
    colorInputBackground: "#FFF7EC",
    colorInputText: "#3E281F",
    colorNeutral: "#3E281F",
    borderRadius: "14px",
    fontFamily: "var(--talea-font-ui)",
  },
  elements: {
    rootBox: { width: "100%" },
    card: {
      boxShadow: "none",
      border: "none",
      background: "transparent",
      padding: 0,
      width: "100%",
    },
    header: { display: "none" },
    footer: {
      background: "transparent",
      "& a": { color: "#9D4026" },
    },
    /* We render our own German mode toggle below the widget — Clerk's English
       "Don't have an account? Sign up" would duplicate it (and its link only
       changes the hash, not our `mode` state). */
    footerAction: { display: "none" },
    socialButtonsBlockButton: {
      background: "#FFF7EC",
      border: "1px solid #DDC8B9",
      color: "#3E281F",
      "&:hover": {
        background: "#F8E9DC",
        borderColor: "#B95134",
      },
    },
    dividerLine: { background: "#E4D3C4" },
    dividerText: { color: "#786052" },
    formFieldInput: {
      background: "#FFF7EC",
      border: "1px solid #DDC8B9",
      color: "#3E281F",
    },
    formButtonPrimary: {
      background: "#B95134",
      color: "#FFF7EC",
      fontWeight: 700,
      textTransform: "none" as const,
      "&:hover": { background: "#9D4026" },
    },
    footerActionLink: { color: "#9D4026" },
  },
} as const;

const AuthScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(() =>
    searchParams.get("mode") === "signup" || window.location.hash.startsWith("#register")
      ? "signup"
      : "signin"
  );
  const [clerkReady, setClerkReady] = useState(false);
  useAndroidSSO(setMode);
  const [loaderMounted, setLoaderMounted] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  /* Fade the loader out once Clerk paints its widget into the mount area. */
  useEffect(() => {
    setClerkReady(false);
    setLoaderMounted(true);
    setLoadError(false);
    const wrap = wrapRef.current;
    if (!wrap) return;

    let done = false;
    const finish = () => {
      done = true;
      setLoadError(false);
      setClerkReady(true);
    };

    const check = () => {
      if (done) return true;
      if (wrap.querySelector(CLERK_READY_SELECTOR)) {
        finish();
        return true;
      }
      return false;
    };

    if (check()) return;

    const observer = new MutationObserver(() => {
      if (check()) observer.disconnect();
    });
    observer.observe(wrap, { childList: true, subtree: true });
    /* Poll as well: attribute-only paints (Clerk swapping its own skeleton for
       the form) don't always trigger the childList observer. */
    const poll = window.setInterval(() => {
      if (check()) window.clearInterval(poll);
    }, 150);
    // Keep watching after a slow load so a late Clerk form can recover by itself.
    const fallback = window.setTimeout(() => {
      if (!done) setLoadError(true);
    }, 12000);

    return () => {
      observer.disconnect();
      window.clearInterval(poll);
      window.clearTimeout(fallback);
    };
  }, [mode]);

  /* Unmount the loader after its fade so it can never sit over the form. */
  useEffect(() => {
    if (!clerkReady) return;
    const t = window.setTimeout(() => setLoaderMounted(false), 400);
    return () => window.clearTimeout(t);
  }, [clerkReady]);

  return (
    <div className="auth-root">
      {/* The folded-book mark quietly frames the warm paper background. */}
      <div className="auth-bg" aria-hidden="true">
        <img src="/brand/talea-icon-primary.svg" alt="" />
      </div>

      <button type="button" className="auth-back" onClick={() => navigate("/")}>
        <ArrowLeft size={14} /> Zurück
      </button>

      <div className="auth-card">
        <div className="auth-brand">
          <img src="/brand/talea-horizontal-primary.svg" alt="Talea" width="232" height="76" />
        </div>

        <div className="auth-header">
          <span className="auth-kicker"><Sparkles size={11} /> KI-Storytelling für Familien</span>
          <h1 className="auth-title">
            {mode === "signin" ? (
              <>Willkommen <em>zurück</em></>
            ) : (
              <>Werde Teil der <em>Geschichte</em></>
            )}
          </h1>
          <p className="auth-subtitle">
            {mode === "signin"
              ? "Melde dich an und tauche wieder in eure Abenteuer ein."
              : "Erstelle deinen Account und starte das erste Abenteuer."}
          </p>
        </div>

        <div className={`auth-clerk-wrap${clerkReady ? " is-ready" : ""}`} aria-busy={!clerkReady && !loadError}>
          {/* Branded loader — visible until Clerk's widget mounts, then removed */}
          {loaderMounted && !loadError && (
            <div className={`auth-loading${clerkReady ? " is-hidden" : ""}`} role="status" aria-live="polite" aria-hidden={clerkReady}>
              <div className="auth-spinner" />
              <span>Anmeldung wird geladen…</span>
              <div className="auth-skeleton-btns">
                <div className="auth-skeleton-btn" />
                <div className="auth-skeleton-btn" />
              </div>
            </div>
          )}

          {loadError && (
            <div className="auth-load-error" role="alert">
              <p>Die Anmeldung braucht gerade länger als erwartet.</p>
              <span>Prüfe deine Verbindung und lade die Seite erneut.</span>
              <button type="button" onClick={() => window.location.reload()}>
                <RefreshCw size={16} aria-hidden="true" /> Erneut laden
              </button>
            </div>
          )}

          {/* Readiness checks only inspect Clerk, never the retry button above. */}
          <div className="auth-widget-mount" ref={wrapRef}>
          {mode === "signin" ? (
            <SignIn
              appearance={clerkAppearance}
              routing="hash"
              signUpUrl="/auth#register"
              forceRedirectUrl="/"
              redirectUrl="/"
            />
          ) : (
            <SignUp
              appearance={clerkAppearance}
              routing="hash"
              signInUrl="/auth#login"
              forceRedirectUrl="/"
              redirectUrl="/"
            />
          )}
          </div>
        </div>

        <div className="auth-toggle">
          {mode === "signin" ? "Noch kein Konto?" : "Schon ein Konto?"}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Jetzt registrieren" : "Anmelden"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
