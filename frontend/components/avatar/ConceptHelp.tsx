import React from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ConceptHelpProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
};

const ConceptHelp: React.FC<ConceptHelpProps> = ({
  title,
  children,
  className,
  align = "right",
}) => (
  <details className={cn("group relative inline-flex", className)}>
    <summary
      className="inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full text-[var(--talea-text-muted)] transition hover:bg-[var(--talea-surface-inset)] hover:text-[var(--talea-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] [&::-webkit-details-marker]:hidden"
      aria-label={`Info: ${title}`}
    >
      <HelpCircle className="h-4 w-4" aria-hidden="true" />
    </summary>
    <div
      className={cn(
        "absolute top-9 z-50 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-elevated)] p-3.5 text-left shadow-[0_18px_45px_rgba(28,39,55,0.18)]",
        align === "left" ? "left-0" : "right-0"
      )}
      role="note"
    >
      <p className="text-sm font-semibold text-[var(--talea-text-primary)]">{title}</p>
      <div className="mt-1 text-xs leading-relaxed text-[var(--talea-text-secondary)]">{children}</div>
    </div>
  </details>
);

export default ConceptHelp;
