import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "../../contexts/ThemeContext";

type ConceptHelpProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
};

const POPOVER_WIDTH = 288; // 18rem
const VIEWPORT_GUTTER = 12;
const ESTIMATED_HEIGHT = 170;

/**
 * Info popover rendered through a portal into document.body.
 *
 * The previous inline version broke inside the Talea surface cards: their
 * `overflow-hidden` + `backdrop-blur` create clipping stacking contexts, and
 * `bg-[var(--talea-surface-elevated)]` resolves to a gradient which is invalid
 * as a background-color — the tooltip ended up clipped, underneath sibling
 * cards, and fully transparent. The portal + fixed positioning + an opaque
 * inline background make it readable everywhere, in both themes.
 */
const ConceptHelp: React.FC<ConceptHelpProps> = ({
  title,
  children,
  className,
  align = "right",
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; openUp: boolean } | null>(null);

  const computePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_GUTTER * 2);

    let left = align === "left" ? rect.left : rect.right - width;
    left = Math.max(VIEWPORT_GUTTER, Math.min(left, window.innerWidth - width - VIEWPORT_GUTTER));

    const openUp = rect.bottom + ESTIMATED_HEIGHT > window.innerHeight && rect.top > ESTIMATED_HEIGHT;
    const top = openUp ? rect.top - 8 : rect.bottom + 8;

    setPosition({ top, left, openUp });
  }, [align]);

  const toggle = () => {
    if (!open) computePosition();
    setOpen((value) => !value);
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // Scrolling invalidates the fixed position — close instead of drifting.
    const handleScroll = () => setOpen(false);

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  const surface = isDark
    ? {
        background: "linear-gradient(180deg, #1c2735 0%, #131b26 100%)",
        borderColor: "#33465c",
        boxShadow: "0 18px 45px rgba(0, 0, 0, 0.55)",
        titleColor: "#edf4ff",
        textColor: "#aabdd1",
      }
    : {
        background: "linear-gradient(180deg, #ffffff 0%, #fdf6ef 100%)",
        borderColor: "#e3d7c8",
        boxShadow: "0 18px 45px rgba(28, 39, 55, 0.22)",
        titleColor: "#203449",
        textColor: "#5d7085",
      };

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Info: ${title}`}
        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[var(--talea-text-muted)] transition hover:bg-[var(--talea-surface-inset)] hover:text-[var(--talea-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && position &&
        createPortal(
          <div
            ref={popoverRef}
            role="note"
            className="fixed rounded-2xl border p-3.5 text-left"
            style={{
              top: position.top,
              left: position.left,
              width: Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_GUTTER * 2),
              transform: position.openUp ? "translateY(-100%)" : undefined,
              zIndex: 1200,
              background: surface.background,
              borderColor: surface.borderColor,
              boxShadow: surface.boxShadow,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold" style={{ color: surface.titleColor }}>{title}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Schließen"
                className="-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:bg-black/10 dark:hover:bg-white/10"
                style={{ color: surface.textColor }}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-1 text-xs leading-relaxed" style={{ color: surface.textColor }}>{children}</div>
          </div>,
          document.body
        )}
    </span>
  );
};

export default ConceptHelp;
