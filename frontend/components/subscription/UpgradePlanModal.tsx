import React from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  const openBilling = () => {
    onClose();
    navigate("/settings?section=billing#billing-plan-switcher");
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
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-3 top-1/2 z-[170] mx-auto w-full max-w-md -translate-y-1/2 rounded-3xl border border-[#d5bdaf] bg-[#fff8ef] p-5 shadow-[0_24px_48px_rgba(56,42,28,0.25)] dark:border-[#3f556f] dark:bg-[#152233]"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d5bdaf] bg-white text-[#4a3d31] dark:border-[#4d6682] dark:bg-[#1c2c42] dark:text-[#dbe9fa]"
              aria-label="Schliessen"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f3dccb] via-[#e3d5ca] to-[#d6ccc2] text-[#2f3f55]">
              <Crown className="h-6 w-6" />
            </div>

            <h3
              className="text-3xl leading-none text-[#1f2f44] dark:text-[#eaf2ff]"
              style={{ fontFamily: '"Cormorant Garamond", serif' }}
            >
              {title}
            </h3>
            <p className="mt-2 text-sm text-[#4d5f73] dark:text-[#9eb2cc]">{message}</p>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#d5bdaf] bg-white px-4 py-2.5 text-sm font-semibold text-[#2d3d52] dark:border-[#4d6682] dark:bg-[#1c2c42] dark:text-[#dbe9fa]"
              >
                Spaeter
              </button>
              <button
                type="button"
                onClick={openBilling}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-[#f2d9d6] via-[#e3d5ca] to-[#d5e3cf] px-4 py-2.5 text-sm font-bold text-[#203048]"
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

