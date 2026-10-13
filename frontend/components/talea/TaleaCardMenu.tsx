import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<"first" | "last">("first");

  const closeAndRestoreFocus = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const gutter = 12;
    const gap = 8;
    const below = trigger.bottom + gap;
    const above = trigger.top - gap - menu.height;
    const preferredTop = below + menu.height <= window.innerHeight - gutter ? below : above;

    setPosition({
      left: Math.max(gutter, Math.min(trigger.right - menu.width, window.innerWidth - menu.width - gutter)),
      top: Math.max(gutter, Math.min(preferredTop, window.innerHeight - menu.height - gutter)),
    });
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !position || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)');
    const target = initialFocusRef.current === "last" ? items[items.length - 1] : items[0];
    (target ?? menuRef.current).focus({ preventScroll: true });
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeAndRestoreFocus();
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      if (menuRef.current?.contains(document.activeElement)) closeAndRestoreFocus();
      else setOpen(false);
    };
    const onResize = () => closeAndRestoreFocus();
    document.addEventListener("pointerdown", onPointerDown, true);
    // Capture Escape before a card's React handler stops event propagation.
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const visible = actions.filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className={cn("relative z-20", className)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          initialFocusRef.current = "first";
          setPosition(null);
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          initialFocusRef.current = event.key === "ArrowUp" ? "last" : "first";
          if (open) {
            const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)');
            const target = event.key === "ArrowUp" ? (items ? items[items.length - 1] : undefined) : items?.[0];
            (target ?? menuRef.current)?.focus({ preventScroll: true });
            return;
          }
          setPosition(null);
          setOpen(true);
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>

      {open ? createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          className="fixed z-[1200] w-60 max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-1.5 shadow-[var(--talea-shadow-strong)] outline-none"
          style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Tab") {
              closeAndRestoreFocus();
              return;
            }
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)'));
            if (items.length === 0) return;
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            items[next].focus({ preventScroll: true });
          }}
        >
          {visible.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={action.disabled}
              onClick={() => {
                if (action.disabled) return;
                closeAndRestoreFocus();
                action.onSelect();
              }}
              className={cn(
                "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-[var(--talea-surface-inset)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-45",
                action.destructive ? "text-[var(--talea-danger)]" : "text-[var(--talea-text-primary)]"
              )}
            >
              <span className="min-w-0 break-words">{action.label}</span>
              {action.icon ? <span className="shrink-0 opacity-80">{action.icon}</span> : null}
            </button>
          ))}
        </div>, document.body
      ) : null}
    </div>
  );
};
