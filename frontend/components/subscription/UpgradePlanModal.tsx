import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Crown, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

type UpgradePlanModalProps = {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

export default function UpgradePlanModal({
  open,
  title = "Abo-Limit erreicht",
  message,
  onClose,
}: UpgradePlanModalProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const openBilling = () => {
    onClose();
    navigate("/settings?section=billing#/billing");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[160] bg-black/35 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-talea-android-back onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-3 top-1/2 z-[170] mx-auto max-w-md -translate-y-1/2 rounded-3xl border border-[var(--talea-border-soft)] bg-[var(--talea-surface-primary)] p-5 shadow-[var(--talea-shadow-strong)]"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98, y: 4 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 28 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="talea-upgrade-title"
          >
            <button
              type="button"
              data-talea-android-back onClick={onClose}
              className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--talea-border-soft)] bg-[var(--talea-surface-inset)] text-[var(--talea-text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--talea-accent-terracotta-soft)] text-[var(--primary)]">
              <Crown className="h-6 w-6" />
            </div>

            <h3
              id="talea-upgrade-title"
              className="pr-8 text-3xl leading-tight text-[var(--talea-text-primary)]"
              style={{ fontFamily: 'var(--talea-font-display)' }}
            >
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--talea-text-secondary)]">{message}</p>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                data-talea-android-back onClick={onClose}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-[var(--talea-border-soft)] bg-[var(--talea-surface-inset)] px-4 py-2.5 text-sm font-semibold text-[var(--talea-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                Später
              </button>
              <button
                type="button"
                onClick={openBilling}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl [background:var(--talea-gradient-brand)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                Plan wechseln
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

