import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

export interface TaleaCardMenuAction {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * "…" button with a small action menu for a card — the iOS context-menu pattern.
 * Secondary and destructive actions (offline, delete) live here instead of as
 * permanent buttons on top of the cover art, where a child taps them by accident.
 * Clicks never bubble to the card, so opening the menu does not open the story.
 */
export const TaleaCardMenu: React.FC<{
  actions: TaleaCardMenuAction[];
  label: string;
  className?: string;
}> = ({ actions, label, className }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const visible = actions.filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className={cn("relative z-20", className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/55"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 min-w-[13rem] overflow-hidden rounded-xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] py-1 shadow-[var(--talea-shadow-strong)]"
        >
          {visible.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[15px] transition-colors hover:bg-[var(--talea-surface-inset)] disabled:opacity-45",
                action.destructive ? "text-[var(--talea-danger)]" : "text-[var(--talea-text-primary)]"
              )}
            >
              <span>{action.label}</span>
              {action.icon ? <span className="shrink-0 opacity-80">{action.icon}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
