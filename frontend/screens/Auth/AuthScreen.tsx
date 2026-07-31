import React, { useState, useRef, useEffect } from "react";
import { SignIn, SignUp } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import "./AuthScreen.css";

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
    colorPrimary: "#e8a838",
    colorBackground: "transparent",
    colorText: "#eee8e0",
    colorTextSecondary: "rgba(238, 232, 224, 0.7)",
    colorInputBackground: "rgba(255, 255, 255, 0.04)",
    colorInputText: "#eee8e0",
    colorNeutral: "#eee8e0",
    borderRadius: "12px",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
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
      "& a": { color: "#e8a838" },
    },
    /* We render our own German mode toggle below the widget — Clerk's English
       "Don't have an account? Sign up" would duplicate it (and its link only
       changes the hash, not our `mode` state). */
    footerAction: { display: "none" },
    socialButtonsBlockButton: {
      background: "rgba(255, 255, 255, 0.04)",
      border: "1px solid rgba(232, 168, 56, 0.22)",
      color: "#eee8e0",
      "&:hover": {
        background: "rgba(232, 168, 56, 0.1)",
        borderColor: "rgba(232, 168, 56, 0.4)",
      },
    },
    dividerLine: { background: "rgba(255, 255, 255, 0.1)" },
    dividerText: { color: "rgba(238, 232, 224, 0.5)" },
    formFieldInput: {
      background: "rgba(255, 255, 255, 0.04)",
      border: "1px solid rgba(255, 255, 255, 0.12)",
      color: "#eee8e0",
    },
    formButtonPrimary: {
      background: "linear-gradient(135deg, #e8a838, #c47832)",
      color: "#1a140e",
      fontWeight: 700,
      textTransform: "none" as const,
      "&:hover": { filter: "brightness(1.05)" },
    },
    footerActionLink: { color: "#e8a838" },
  },
} as const;

const AuthScreen: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [clerkReady, setClerkReady] = useState(false);
  const [loaderMounted, setLoaderMounted] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  /* Fade the loader out once Clerk paints its widget into the mount area. */
  useEffect(() => {
    setClerkReady(false);
    setLoaderMounted(true);
    const wrap = wrapRef.current;
    if (!wrap) return;

    let done = false;
    const finish = () => {
      done = true;
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
    // Safety net: never keep the loader up longer than this, whatever happens.
    const fallback = window.setTimeout(finish, 2500);

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
      {/* Ambient cinematic backdrop */}
      <div className="auth-bg" aria-hidden="true">
        <img src="/landing-assets/hero.png" alt="" />
      </div>
      <div className="auth-orb auth-orb--1" aria-hidden="true" />
      <div className="auth-orb auth-orb--2" aria-hidden="true" />

      <button type="button" className="auth-back" onClick={() => navigate("/")}>
        <ArrowLeft size={14} /> Zurück
      </button>

      <div className="auth-card">
        <div className="auth-brand">
          <img src="/talea_logo.png?v=20260209" alt="Talea" />
          <span className="auth-brand-name">
            Talea<small>Storytelling Platform</small>
          </span>
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

        <div className={`auth-clerk-wrap${clerkReady ? " is-ready" : ""}`} ref={wrapRef}>
          {/* Branded loader — visible until Clerk's widget mounts, then removed */}
          {loaderMounted && (
            <div className={`auth-loading${clerkReady ? " is-hidden" : ""}`} aria-hidden={clerkReady}>
              <div className="auth-spinner" />
              <span>Anmeldung wird geladen…</span>
              <div className="auth-skeleton-btns">
                <div className="auth-skeleton-btn" />
                <div className="auth-skeleton-btn" />
              </div>
            </div>
          )}

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
