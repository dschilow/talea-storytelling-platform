import React, { useState, useRef, useEffect } from "react";
import { SignIn, SignUp } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import "./AuthScreen.css";

/**
 * Clerk's <SignIn>/<SignUp> widgets mount asynchronously, leaving an empty
 * gap until their JS initialises. We show a branded loader inside the mount
 * area and fade it out the moment Clerk paints its root element, so the user
 * never stares at blank space.
 */
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
  const wrapRef = useRef<HTMLDivElement>(null);

  /* Fade the loader out once Clerk paints its widget into the mount area. */
  useEffect(() => {
    setClerkReady(false);
    const wrap = wrapRef.current;
    if (!wrap) return;

    const check = () => {
      if (wrap.querySelector(".cl-rootBox, .cl-card")) {
        setClerkReady(true);
        return true;
      }
      return false;
    };

    if (check()) return;
    const observer = new MutationObserver(() => { check(); });
    observer.observe(wrap, { childList: true, subtree: true });
    // Safety fallback in case class names change in a future Clerk version.
    const fallback = window.setTimeout(() => setClerkReady(true), 4000);

    return () => { observer.disconnect(); window.clearTimeout(fallback); };
  }, [mode]);

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

        <div className="auth-clerk-wrap" ref={wrapRef}>
          {/* Branded loader — visible until Clerk's widget mounts */}
          <div className={`auth-loading${clerkReady ? " is-hidden" : ""}`} aria-hidden={clerkReady}>
            <div className="auth-spinner" />
            <span>Anmeldung wird geladen…</span>
            <div className="auth-skeleton-btns">
              <div className="auth-skeleton-btn" />
              <div className="auth-skeleton-btn" />
            </div>
          </div>

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
