import React, { CSSProperties, MouseEventHandler } from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { colors } from "../../utils/constants/colors";
import { typography } from "../../utils/constants/typography";
import { spacing, radii, animations } from "../../utils/constants/spacing";

interface ButtonProps {
  title: string;
  onPress: MouseEventHandler<HTMLButtonElement>;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "fun";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
  fullWidth = false,
  className,
  type = "button",
}) => {
  const reduceMotion = useReducedMotion();
  const getVariantStyles = (): CSSProperties => {
    const baseStyles: CSSProperties = {
      cursor: disabled ? "not-allowed" : "pointer",
      transition: reduceMotion ? "none" : `transform ${animations.duration.fast} ${animations.easing.smooth}, box-shadow ${animations.duration.normal} ${animations.easing.smooth}, background ${animations.duration.normal} ${animations.easing.smooth}, border-color ${animations.duration.normal} ${animations.easing.smooth}`,
      opacity: disabled ? 0.56 : 1,
      border: "1px solid transparent",
      boxShadow: "var(--talea-shadow-soft)",
    };

    switch (variant) {
      case "primary":
        return {
          ...baseStyles,
          background: "var(--talea-gradient-brand)",
          color: "var(--primary-foreground)",
          borderColor: colors.border.light,
          boxShadow: "var(--talea-shadow-medium)",
        };
      case "secondary":
        return {
          ...baseStyles,
          background: colors.gradients.secondary,
          color: colors.text.primary,
          borderColor: colors.border.light,
          boxShadow: "var(--talea-shadow-soft)",
        };
      case "outline":
        return {
          ...baseStyles,
          background: colors.surface,
          color: colors.text.primary,
          borderColor: colors.border.normal,
          boxShadow: "var(--talea-shadow-soft)",
        };
      case "ghost":
        return {
          ...baseStyles,
          background: "transparent",
          color: colors.text.primary,
          boxShadow: "none",
          borderColor: "transparent",
        };
      case "fun":
        return {
          ...baseStyles,
          background: colors.gradients.sunset,
          color: colors.text.primary,
          borderColor: colors.border.light,
          boxShadow: "var(--talea-shadow-medium)",
        };
      default:
        return baseStyles;
    }
  };

  const getSizeStyles = (): CSSProperties => {
    switch (size) {
      case "sm":
        return {
          minHeight: 44,
          padding: `${spacing.xs}px ${spacing.md}px`,
          ...typography.textStyles.bodySm,
          borderRadius: `${radii.md}px`,
        };
      case "md":
        return {
          minHeight: 48,
          padding: `${spacing.sm}px ${spacing.lg}px`,
          ...typography.textStyles.body,
          borderRadius: `${radii.lg}px`,
        };
      case "lg":
        return {
          minHeight: 54,
          padding: `${spacing.md}px ${spacing.xl}px`,
          ...typography.textStyles.bodyLg,
          borderRadius: `${radii.xl}px`,
        };
      default:
        return {};
    }
  };

  const buttonStyle: CSSProperties = {
    ...getVariantStyles(),
    ...getSizeStyles(),
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    fontWeight: 700,
    fontFamily: "var(--talea-font-ui)",
    width: fullWidth ? "100%" : "auto",
    touchAction: "manipulation",
    backdropFilter: variant === "ghost" ? undefined : "blur(10px)",
    WebkitBackdropFilter: variant === "ghost" ? undefined : "blur(10px)",
  };

  return (
    <button
      type={type}
      onClick={onPress}
      disabled={disabled}
      style={buttonStyle}
      className={cn(
        "group relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--talea-surface-primary)]",
        !disabled && "motion-safe:hover:-translate-y-0.5 hover:shadow-[var(--talea-shadow-medium)] motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]",
        className
      )}
    >
      <span className="relative z-[1] flex items-center gap-2">
        {icon ? <span className="flex items-center">{icon}</span> : null}
        <span>{title}</span>
      </span>
    </button>
  );
};

export default Button;
