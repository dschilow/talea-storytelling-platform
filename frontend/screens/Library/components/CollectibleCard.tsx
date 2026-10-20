import React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { taleaDisplayFont } from "@/components/talea/TaleaPastelPrimitives";
import type { LibraryCollectible } from "../libraryShared";

/**
 * A collectible as a real card: the Flunker-Karte is Ella's index card from her
 * planner, the Monster-Steckbrief is Oma Hilde's official crew form. Colour
 * comes from the series, not from glitter.
 */
const THEMES: Record<string, { paper: string; band: string; bandText: string; ink: string; label: string; rule: string }> = {
  flunker_card: {
    paper: "bg-[#fff8ea]",
    band: "bg-[#c4552f]",
    bandText: "text-[#fff8ea]",
    ink: "text-[#3a2416]",
    label: "text-[#a2492a]",
    rule: "border-[#ecd9bd]",
  },
  monster_profile: {
    paper: "bg-[#f3f1ea]",
    band: "bg-[#1f4a4c]",
    bandText: "text-[#f3f1ea]",
    ink: "text-[#1d2a2a]",
    label: "text-[#2f6b6d]",
    rule: "border-[#d9d5c7]",
  },
};

const DEFAULT_THEME = THEMES.flunker_card;

interface CollectibleCardProps {
  collectible: LibraryCollectible;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const CollectibleCard: React.FC<CollectibleCardProps> = ({ collectible, size = "md", className }) => {
  const theme = THEMES[collectible.type] ?? DEFAULT_THEME;
  const [lead, ...rest] = collectible.fields;
  const compact = size === "sm";
  return (
    <article
      className={cn(
        // Small cards are a fixed playing-card shape (lead field only); larger ones grow with their fields so nothing is cut off.
        "relative flex flex-col overflow-hidden rounded-[18px] shadow-[0_10px_30px_-12px_rgba(40,20,10,0.45),0_2px_6px_rgba(40,20,10,0.12)] ring-1 ring-black/5",
        compact ? "aspect-[5/7]" : "min-h-[22rem]",
        theme.paper,
        theme.ink,
        size === "sm" ? "w-40" : size === "lg" ? "w-[19rem] sm:w-[21rem]" : "w-60",
        className,
      )}
      aria-label={collectible.title}
    >
      <header className={cn("flex items-center justify-between px-3 py-2", theme.band, theme.bandText)}>
        <span className={cn("font-bold uppercase tracking-[0.08em]", compact ? "text-[10px]" : "text-[11px]")}>{collectible.title}</span>
      </header>
      <div className={cn("relative mx-3 mt-3 shrink-0 overflow-hidden rounded-xl bg-white", compact ? "h-[38%]" : size === "lg" ? "h-44" : "h-36")}>
        {collectible.imageUrl ? (
          <img src={collectible.imageUrl} alt="" className="h-full w-full object-contain" loading="lazy" decoding="async" />
        ) : null}
      </div>
      <div className={cn("flex min-h-0 flex-1 flex-col gap-1.5 px-3.5 pb-3 pt-2.5", compact && "gap-1 px-2.5")}>
        {lead ? (
          <div>
            <p className={cn("font-semibold uppercase tracking-[0.06em]", theme.label, compact ? "text-[9px]" : "text-[10px]")}>{lead.label}</p>
            <p className={cn("font-semibold leading-snug", compact ? "line-clamp-2 text-[12px]" : "text-[15px]")} style={{ fontFamily: taleaDisplayFont }}>
              {lead.value}
            </p>
          </div>
        ) : null}
        {!compact
          ? rest.map((field) => (
              <div key={field.label} className={cn("border-t pt-1.5", theme.rule)}>
                <p className={cn("text-[10px] font-semibold uppercase tracking-[0.06em]", theme.label)}>{field.label}</p>
                <p className={cn("leading-snug", size === "lg" ? "text-[13px]" : "text-[12px]")}>{field.value}</p>
              </div>
            ))
          : null}
      </div>
    </article>
  );
};

/** The back of a card that is not collected yet. */
export const CollectibleCardBack: React.FC<{ type: string; label: string; size?: "sm" | "md"; className?: string }> = ({ type, label, size = "sm", className }) => {
  const theme = THEMES[type] ?? DEFAULT_THEME;
  return (
    <div
      className={cn(
        "flex aspect-[5/7] flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed opacity-80",
        theme.rule,
        size === "sm" ? "w-40" : "w-60",
        className,
      )}
      aria-label={`${label}: noch nicht gesammelt`}
    >
      <Lock className={cn("h-5 w-5", theme.label)} aria-hidden="true" />
      <span className={cn("px-3 text-center text-[12px] font-semibold", theme.label)}>{label}</span>
    </div>
  );
};
