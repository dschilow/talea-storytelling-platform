import React, { useState } from "react";
import { SignIn, SignUp } from "@clerk/clerk-react";
import Card from "../../components/common/Card";
import FadeInView from "../../components/animated/FadeInView";
import { colors } from "../../utils/constants/colors";
import { typography } from "../../utils/constants/typography";
import { spacing, radii, shadows } from "../../utils/constants/spacing";

const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: colors.appBackground,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 420,
  };

  const headerStyle: React.CSSProperties = {
    textAlign: "center",
    marginBottom: spacing.lg,
  };

  const toggleStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
  };

  const linkBtn: React.CSSProperties = {
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: radii.lg,
    background: colors.glass.buttonBackground,
    border: `1px solid ${colors.glass.border}`,
    cursor: "pointer",
    boxShadow: shadows.sm,
  };

  return (
    <div style={containerStyle}>
      <FadeInView delay={100} style={{ width: "100%" }}>
        <Card variant="glass" style={cardStyle}>
          <div style={headerStyle}>
            <h1 style={{ ...typography.textStyles.headingMd, color: colors.textPrimary }}>
              Willkommen
            </h1>
            <p style={{ ...typography.textStyles.body, color: colors.textSecondary }}>
              Bitte {mode === "signin" ? "anmelden" : "registrieren"} mit Google oder Facebook.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            {mode === "signin" ? (
              <SignIn
                appearance={{ elements: { card: { boxShadow: "none", border: "none" } } }}
                routing="hash"
                signUpUrl="/auth#register"
                forceRedirectUrl="/"
                redirectUrl="/"
              />
            ) : (
              <SignUp
                appearance={{ elements: { card: { boxShadow: "none", border: "none" } } }}
                routing="hash"
                signInUrl="/auth#login"
                forceRedirectUrl="/"
                redirectUrl="/"
              />
            )}
          </div>

          <div style={toggleStyle}>
            <button
              style={linkBtn}
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Neu hier? Registrieren" : "Schon ein Konto? Anmelden"}
            </button>
          </div>
        </Card>
      </FadeInView>
    </div>
  );
};

export default AuthScreen;
