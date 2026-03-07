import React from "react";

import { cn } from "@/lib/utils";
import { colors } from "../../utils/constants/colors";
import { spacing, radii } from "../../utils/constants/spacing";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "outlined" | "playful" | "glass";
  padding?: keyof typeof spacing;
  onPress?: () => void;
  style?: React.CSSProperties;
}

type CardVariant = NonNullable<CardProps["variant"]>;

const variantStyles: Record<CardVariant, React.CSSProperties> = {
  default: {
    background: colors.surface,
    border: `1px solid ${colors.border.normal}`,
    boxShadow: "var(--talea-shadow-soft)",
  },
  elevated: {
    background: colors.elevatedSurface,
    border: `1px solid ${colors.border.light}`,
    boxShadow: "var(--talea-shadow-medium)",
  },
  outlined: {
    background: colors.background.card,
    border: `1px solid ${colors.border.strong}`,
    boxShadow: "var(--talea-shadow-soft)",
  },
  playful: {
    background: colors.glass.warmBackground,
    border: `1px solid ${colors.glass.border}`,
    boxShadow: "var(--talea-shadow-medium)",
  },
  glass: {
    background: colors.glass.backgroundAlt,
    border: `1px solid ${colors.glass.border}`,
    boxShadow: "var(--talea-shadow-medium)",
    backdropFilter: "blur(20px) saturate(140%)",
    WebkitBackdropFilter: "blur(20px) saturate(140%)",
  },
};

const Card: React.FC<CardProps> = ({
  children,
  className = "",
  variant = "default",
  padding = "lg",
  onPress,
  style = {},
}) => {
  const baseStyle: React.CSSProperties = {
    borderRadius: `${radii.xl}px`,
    padding: `${spacing[padding]}px`,
    position: "relative",
    overflow: "hidden",
    userSelect: "none",
    transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease, border-color 220ms ease, background 220ms ease",
    ...variantStyles[variant],
    ...style,
  };

  const sharedClassName = cn(
    "group before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_26%)] before:opacity-100 before:transition-opacity after:pointer-events-none after:absolute after:left-5 after:right-5 after:top-0 after:h-px after:bg-white/70 after:content-[''] dark:before:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.09),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_24%)] dark:after:bg-white/10",
    onPress &&
      "cursor-pointer touch-manipulation hover:-translate-y-1 hover:shadow-[var(--talea-shadow-strong)] active:translate-y-0 active:scale-[0.992] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f2e7fb] dark:focus-visible:ring-[#243753]",
    className
  );

  if (onPress) {
    return (
      <button type="button" onClick={onPress} style={baseStyle} className={sharedClassName}>
        <div className="relative z-[1]">{children}</div>
      </button>
    );
  }

  return (
    <div style={baseStyle} className={sharedClassName}>
      <div className="relative z-[1]">{children}</div>
    </div>
  );
};

export default Card;
