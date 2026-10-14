import React from "react";

import { cn } from "@/lib/utils";

type LogoVariant = "compact" | "horizontal" | "stacked" | "wordmark" | "icon" | "mark" | "small";
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

interface LogoArt {
  brand: string;
  /** Dark mode keeps the terracotta mark and only turns the ink wordmark cream. */
  onDark: string;
  white: string;
  dark: string;
  width: number;
  height: number;
}

const LOGOS: Record<LogoVariant, LogoArt> = {
  compact: { brand: "horizontal-compact", onDark: "horizontal-compact-on-dark", white: "horizontal-compact-white", dark: "horizontal-dark", width: 2209, height: 719 },
  horizontal: { brand: "horizontal-primary", onDark: "horizontal-primary-on-dark", white: "horizontal-white", dark: "horizontal-dark", width: 2300, height: 793 },
  stacked: { brand: "stacked-primary", onDark: "stacked-primary-on-dark", white: "stacked-white", dark: "stacked-dark", width: 833, height: 1095 },
  wordmark: { brand: "wordmark-dark", onDark: "wordmark-cream", white: "wordmark-white", dark: "wordmark-dark", width: 2438, height: 856 },
  icon: { brand: "icon-primary", onDark: "icon-primary", white: "icon-primary-white", dark: "icon-primary-dark", width: 838, height: 838 },
  mark: { brand: "icon-plain", onDark: "icon-plain", white: "icon-plain-white", dark: "icon-plain-dark", width: 764, height: 764 },
  small: { brand: "icon-small", onDark: "icon-small", white: "icon-small-white", dark: "icon-small-dark", width: 764, height: 764 },
};

/** Official Logo-v2 artwork; `horizontal` and `icon` show the full book with its cream page edges. */
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
      {tone !== "auto" ? (
        image(logo[tone])
      ) : logo.onDark === logo.brand ? (
        image(logo.brand)
      ) : (
        <>
          {image(logo.brand, "block dark:hidden")}
          {image(logo.onDark, "hidden dark:block")}
        </>
      )}
    </span>
  );
};
