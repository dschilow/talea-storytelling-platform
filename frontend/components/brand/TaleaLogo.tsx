import React from "react";

import { cn } from "@/lib/utils";

type LogoVariant = "compact" | "horizontal" | "stacked" | "wordmark" | "mark" | "small";
type LogoTone = "auto" | "brand" | "white" | "dark";

interface TaleaLogoProps {
  variant?: LogoVariant;
  tone?: LogoTone;
  className?: string;
  width?: number | string;
  height?: number | string;
  /** An empty alternative text makes the logo decorative inside a labelled link. */
  alt?: string;
}

const LOGOS: Record<LogoVariant, { brand: string; white: string; dark: string; width: number; height: number }> = {
  compact: { brand: "horizontal-compact", white: "horizontal-compact-white", dark: "horizontal-dark", width: 2209, height: 719 },
  horizontal: { brand: "horizontal-primary", white: "horizontal-white", dark: "horizontal-dark", width: 2300, height: 793 },
  stacked: { brand: "stacked-primary", white: "stacked-white", dark: "stacked-dark", width: 833, height: 1095 },
  wordmark: { brand: "wordmark-dark", white: "wordmark-white", dark: "wordmark-dark", width: 2438, height: 856 },
  mark: { brand: "icon-plain", white: "icon-plain-white", dark: "icon-plain-dark", width: 764, height: 764 },
  small: { brand: "icon-small", white: "icon-small-white", dark: "icon-small-dark", width: 764, height: 764 },
};

/** Official Logo-v2 artwork; the compact lockup stays legible in app navigation. */
export const TaleaLogo: React.FC<TaleaLogoProps> = ({
  variant = "compact",
  tone = "auto",
  className,
  width,
  height,
  alt = "Talea",
}) => {
  const logo = LOGOS[variant];
  const image = (name: string, imageClassName?: string) => (
    <img
      src={`/brand/talea-${name}.svg`}
      alt={alt}
      width={logo.width}
      height={logo.height}
      decoding="async"
      draggable={false}
      className={cn("h-full w-full object-contain", imageClassName)}
    />
  );

  return (
    <span
      className={cn("inline-block shrink-0 align-middle", className)}
      style={{ width, height, aspectRatio: `${logo.width} / ${logo.height}` }}
    >
      {tone === "auto" ? (
        <>
          {image(logo.brand, "block dark:hidden")}
          {image(logo.white, "hidden dark:block")}
        </>
      ) : image(logo[tone])}
    </span>
  );
};
