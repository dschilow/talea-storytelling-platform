import React, { useMemo, useState } from "react";
import {
  BookMarked,
  BookOpen,
  ChevronUp,
  Code,
  FlaskConical,
  Gem,
  Home,
  LogOut,
  Settings,
  Sparkles,
  User,
  Wand2,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useClerk, useUser } from "@clerk/clerk-react";

import { cn } from "@/lib/utils";
import taleaLogo from "@/img/talea_logo.png";
import { useTheme } from "@/contexts/ThemeContext";

interface NavItem {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  labelKey: string;
  path: string;
  tone: string;
}

const PRIMARY_ITEMS: NavItem[] = [
  { icon: Home, labelKey: "navigation.home", path: "/", tone: "#6d8bc9" },
  { icon: BookOpen, labelKey: "navigation.stories", path: "/stories", tone: "#c86f8a" },
  { icon: FlaskConical, labelKey: "navigation.doku", path: "/doku", tone: "#c78857" },
  { icon: User, labelKey: "navigation.avatars", path: "/avatar", tone: "#5f9488" },
];

const ADMIN_ITEMS: NavItem[] = [
  { icon: Sparkles, labelKey: "navigation.characters", path: "/characters", tone: "#8e7ecf" },
  { icon: Gem, labelKey: "navigation.artifacts", path: "/artifacts", tone: "#cf7a99" },
  { icon: BookMarked, labelKey: "navigation.fairytales", path: "/fairytales", tone: "#6d9a8f" },
  { icon: Code, labelKey: "navigation.logs", path: "/logs", tone: "#6f7b93" },
];

const SETTINGS_ITEM: NavItem = {
  icon: Settings,
  labelKey: "navigation.settings",
  path: "/settings",
  tone: "#846fb4",
};

const MoreSheet: React.FC<{
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  isActive: (path: string) => boolean;
  onSignOut: () => Promise<void>;
  isDark: boolean;
}> = ({ open, isAdmin, onClose, onNavigate, isActive, onSignOut, isDark }) => {
  const { t } = useTranslation();

  const colors = isDark
    ? {
        panel:
          "linear-gradient(180deg,rgba(24,31,43,0.98)_0%,rgba(20,27,39,1)_100%)",
        border: "#2d3a50",
        card: "rgba(34,44,60,0.92)",
        cardBorder: "#30425c",
        text: "#dbe7f8",
        sub: "#96a7bf",
      }
    : {
        panel:
          "linear-gradient(180deg,#fff9f1_0%,#f7efe2_100%)",
        border: "#e5d9c9",
        card: "rgba(255,255,255,0.75)",
        cardBorder: "#dfd3c2",
        text: "#2c394d",
        sub: "#748195",
      };

  const visibleItems = [SETTINGS_ITEM, ...(isAdmin ? ADMIN_ITEMS : [])];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[72] bg-black/35 backdrop-blur-[2px]"
            onClick={onClose}
            aria-label="Mehr Menue schliessen"
          />

          <motion.div
            initial={{ y: "102%" }}
            animate={{ y: 0 }}
            exit={{ y: "102%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[73] rounded-t-[28px] border px-5 pb-8 pt-3 shadow-[0_-18px_40px_rgba(41,50,64,0.22)]"
            style={{ borderColor: colors.border, background: colors.panel }}
          >
            <div className="mb-2 flex justify-center">
              <div className="h-1 w-12 rounded-full" style={{ background: colors.sub }} />
            </div>

            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={taleaLogo} alt="Talea Logo" className="h-8 w-8 rounded-lg object-cover" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: colors.sub }}>
                    Navigation
                  </p>
                  <p className="text-lg leading-none" style={{ color: colors.text, fontFamily: '"Cormorant Garamond", serif' }}>
                    TALEA
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
                style={{ borderColor: colors.border, background: colors.card, color: colors.sub }}
                aria-label="Sheet schliessen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {visibleItems.map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <motion.button
                    key={item.path}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.03 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onNavigate(item.path);
                      onClose();
                    }}
                    className={cn(
                      "rounded-2xl border px-2 py-3 text-center",
                      active ? "shadow-[0_8px_18px_rgba(60,69,88,0.16)]" : ""
                    )}
                    style={{
                      borderColor: active ? `${item.tone}55` : colors.cardBorder,
                      background: active ? colors.card : "transparent",
                    }}
                  >
                    <span
                      className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ background: active ? `${item.tone}24` : colors.card }}
                    >
                      <Icon className="h-4 w-4" style={{ color: active ? item.tone : colors.sub }} />
                    </span>
                    <span className="mt-1.5 block text-[11px] font-semibold leading-tight" style={{ color: colors.text }}>
                      {t(item.labelKey)}
                    </span>
                  </motion.button>
                );
              })}

              <motion.button
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: visibleItems.length * 0.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  await onSignOut();
                  onClose();
                }}
                className="rounded-2xl border px-2 py-3 text-center"
                style={{ borderColor: "#bc8a8a", background: isDark ? "rgba(139,74,74,0.18)" : "rgba(255,236,236,0.82)" }}
              >
                <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: isDark ? "rgba(139,74,74,0.24)" : "rgba(255,216,216,0.9)" }}>
                  <LogOut className="h-4 w-4 text-[#a76060]" />
                </span>
                <span className="mt-1.5 block text-[11px] font-semibold leading-tight text-[#a76060]">{t("navigation.logout")}</span>
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { resolvedTheme } = useTheme();

  const [moreOpen, setMoreOpen] = useState(false);

  const isDark = resolvedTheme === "dark";
  const isAdmin = user?.publicMetadata?.role !== 'customer';

  const colors = isDark
    ? {
        nav:
          "linear-gradient(180deg,rgba(23,30,42,0.94)_0%,rgba(19,26,38,0.98)_100%)",
        border: "#2f3d53",
        text: "#9fb0c8",
        textActive: "#dde7f8",
        badge: "#8f7cae",
        logoRow: "rgba(33,42,58,0.78)",
      }
    : {
        nav:
          "linear-gradient(180deg,rgba(255,251,243,0.94)_0%,rgba(246,237,224,0.98)_100%)",
        border: "#e5d9c9",
        text: "#7a8697",
        textActive: "#4e637b",
        badge: "#8f7cae",
        logoRow: "rgba(255,255,255,0.62)",
      };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const moreIsActive = useMemo(
    () => [SETTINGS_ITEM, ...(isAdmin ? ADMIN_ITEMS : [])].some((item) => isActive(item.path)),
    [location.pathname, isAdmin]
  );

  const renderPrimaryItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <button
        key={item.path}
        type="button"
        onClick={() => navigate(item.path)}
        className="relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2"
        aria-label={t(item.labelKey)}
      >
        {active && (
          <motion.span
            layoutId="talea-mobile-active"
            className="absolute -top-1 h-[3px] w-5 rounded-full"
            style={{ background: item.tone }}
          />
        )}

        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: active ? `${item.tone}22` : "transparent" }}
        >
          <Icon className="h-[19px] w-[19px]" style={{ color: active ? item.tone : colors.text }} />
        </span>

        <span className="text-[10px] font-semibold" style={{ color: active ? colors.textActive : colors.text }}>
          {t(item.labelKey)}
        </span>
      </button>
    );
  };

  return (
    <>
      <MoreSheet
        open={moreOpen}
        isAdmin={isAdmin}
        onClose={() => setMoreOpen(false)}
        onNavigate={navigate}
        isActive={isActive}
        onSignOut={signOut}
        isDark={isDark}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 md:hidden">
        <div className={cn("h-9", isDark ? "bg-gradient-to-t from-[#1b2433] to-transparent" : "bg-gradient-to-t from-[#f8f1e5] to-transparent")} />

        <nav
          className="pointer-events-auto rounded-[26px] border px-2 pb-2 pt-1 shadow-[0_16px_34px_rgba(52,60,73,0.2)] backdrop-blur"
          style={{ borderColor: colors.border, background: colors.nav }}
          aria-label="Mobile Navigation"
        >
          <div className="flex items-end">
            {PRIMARY_ITEMS.map(renderPrimaryItem)}

            <div className="flex flex-1 flex-col items-center">
              <button
                type="button"
                onClick={() => navigate("/story")}
                className="relative -mt-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d9cab5] bg-[linear-gradient(140deg,#f2d9d6_0%,#e6d8ea_45%,#d8e4d4_100%)] shadow-[0_10px_22px_rgba(58,67,83,0.24)]"
                aria-label="Neue Story erstellen"
              >
                <span className="absolute inset-0 rounded-2xl border border-white/60" />
                <Wand2 className="relative h-5 w-5 text-[#465a72]" />
              </button>
              <span className="mt-1 text-[10px] font-semibold" style={{ color: colors.text }}>
                Neu
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2"
              aria-label="Mehr Menue oeffnen"
            >
              {(moreIsActive || moreOpen) && (
                <motion.span className="absolute -top-1 h-[3px] w-5 rounded-full" style={{ background: colors.badge }} />
              )}

              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: moreIsActive || moreOpen ? "rgba(144,117,184,0.18)" : "transparent" }}
              >
                <ChevronUp className="h-[19px] w-[19px]" style={{ color: moreIsActive || moreOpen ? colors.badge : colors.text }} />
              </span>

              <span className="text-[10px] font-semibold" style={{ color: moreIsActive || moreOpen ? colors.badge : colors.text }}>
                Mehr
              </span>
            </button>
          </div>

          <div className="mt-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-1" style={{ borderColor: colors.border, background: colors.logoRow }}>
            <img src={taleaLogo} alt="Talea Logo" className="h-4 w-4 rounded-md object-cover" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.text }}>
              Talea
            </span>
          </div>
        </nav>
      </div>
    </>
  );
};

export default BottomNav;


