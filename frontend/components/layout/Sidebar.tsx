import React, { useMemo, useState } from "react";
import {
  BookMarked,
  BookOpen,
  ChevronDown,
  Code,
  FlaskConical,
  Gem,
  Home,
  LogOut,
  Settings,
  Sparkles,
  User,
  Wand2,
} from "lucide-react";
import { useClerk, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

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
  { icon: Home, labelKey: "navigation.home", path: "/", tone: "#7390cf" },
  { icon: BookOpen, labelKey: "navigation.stories", path: "/stories", tone: "#cf6f85" },
  { icon: FlaskConical, labelKey: "navigation.doku", path: "/doku", tone: "#c98a5d" },
  { icon: User, labelKey: "navigation.avatars", path: "/avatar", tone: "#5a8f84" },
];

const ADMIN_ITEMS: NavItem[] = [
  { icon: Sparkles, labelKey: "navigation.characters", path: "/characters", tone: "#8e7ecf" },
  { icon: Gem, labelKey: "navigation.artifacts", path: "/artifacts", tone: "#d27799" },
  { icon: BookMarked, labelKey: "navigation.fairytales", path: "/fairytales", tone: "#6d9a8e" },
  { icon: Code, labelKey: "navigation.logs", path: "/logs", tone: "#6f7b92" },
];

const Sidebar: React.FC = () => {
  const { signOut } = useClerk();
  const { user } = useUser();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();

  const [expanded, setExpanded] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const canExpand = useMemo(() => expanded, [expanded]);

  const isDark = resolvedTheme === "dark";
  const isAdmin = user?.publicMetadata?.role !== 'customer';

  const colors = useMemo(
    () =>
      isDark
        ? {
            panelBackground:
              "linear-gradient(180deg, rgba(21,27,38,0.98) 0%, rgba(18,24,34,0.99) 52%, rgba(15,21,31,1) 100%)",
            panelBorder: "#263348",
            surface: "rgba(34,43,58,0.82)",
            surfaceHover: "rgba(38,49,66,0.96)",
            textPrimary: "#e8eef8",
            textSecondary: "#9ba9be",
            indicator: "#b6c4da",
            cta:
              "linear-gradient(135deg,#8ca7d9 0%,#b089c8 42%,#6fa29a 100%)",
            ctaText: "#0f1828",
            borderSoft: "#314158",
            logoutBg: "rgba(176,97,97,0.18)",
            logoutBorder: "#5f3b3b",
            logoPlate: "rgba(31,40,55,0.9)",
          }
        : {
            panelBackground:
              "linear-gradient(180deg, rgba(253,248,241,0.96) 0%, rgba(246,238,226,0.98) 52%, rgba(241,234,224,0.99) 100%)",
            panelBorder: "#e8ddcf",
            surface: "rgba(255,255,255,0.72)",
            surfaceHover: "rgba(255,255,255,0.9)",
            textPrimary: "#1f2a3a",
            textSecondary: "#6d7a8d",
            indicator: "#7d8794",
            cta:
              "linear-gradient(135deg,#f2d9d6 0%,#ecd9c9 42%,#d8e4d4 100%)",
            ctaText: "#2e3746",
            borderSoft: "#ddd1bf",
            logoutBg: "rgba(255,236,236,0.86)",
            logoutBorder: "#ecd3d3",
            logoPlate: "rgba(255,255,255,0.72)",
          },
    [isDark]
  );

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path);
    const Icon = item.icon;

    return (
      <button
        key={item.path}
        type="button"
        onClick={() => navigate(item.path)}
        className={cn(
          "group relative flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left transition-colors",
          active ? "shadow-[0_4px_14px_rgba(65,72,90,0.14)]" : ""
        )}
        style={{ background: active ? colors.surface : "transparent" }}
        aria-label={t(item.labelKey)}
      >
        {active && (
          <motion.span
            layoutId="talea-sidebar-active"
            className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full"
            style={{ background: item.tone }}
          />
        )}

        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
          style={{
            borderColor: active ? `${item.tone}66` : colors.borderSoft,
            background: active ? `${item.tone}26` : colors.surface,
          }}
        >
          <Icon className="h-4 w-4" style={{ color: active ? item.tone : colors.textSecondary }} />
        </span>

        <motion.span
          initial={false}
          animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
          className={cn(
            "overflow-hidden whitespace-nowrap text-sm font-medium",
            active ? "font-semibold" : ""
          )}
          style={{ color: active ? colors.textPrimary : colors.textSecondary }}
        >
          {t(item.labelKey)}
        </motion.span>
      </button>
    );
  };

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen md:block">
      <motion.div
        initial={false}
        animate={{ width: canExpand ? 264 : 88 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className="relative flex h-full flex-col border-r px-3 py-4"
        style={{
          background: colors.panelBackground,
          borderColor: colors.panelBorder,
          boxShadow: isDark ? "12px 0 40px rgba(3,8,14,0.52)" : "10px 0 40px rgba(52,61,74,0.08)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
          <div
            className="absolute left-1/2 top-0 h-[360px] w-[360px] -translate-x-1/2 rounded-full"
            style={{
              background: isDark
                ? "radial-gradient(circle, rgba(87,119,173,0.35), transparent 70%)"
                : "radial-gradient(circle, rgba(229,216,196,0.55), transparent 70%)",
            }}
          />
        </div>

        <div className="relative flex flex-1 flex-col overflow-hidden">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 flex items-center gap-3 rounded-2xl border px-2.5 py-2"
            aria-label="Talea Startseite"
            style={{ borderColor: colors.borderSoft, background: colors.logoPlate }}
          >
            <img src={taleaLogo} alt="Talea Logo" className="h-10 w-10 rounded-xl object-cover" />
            <motion.div
              initial={false}
              animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
              className="overflow-hidden text-left"
            >
              <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: colors.indicator }}>
                Story Atelier
              </p>
              <p
                className="text-[24px] leading-none"
                style={{ color: colors.textPrimary, fontFamily: '"Cormorant Garamond", serif' }}
              >
                TALEA
              </p>
            </motion.div>
          </button>

          <motion.button
            type="button"
            onClick={() => navigate("/story")}
            whileTap={{ scale: 0.97 }}
            className="mb-5 inline-flex items-center gap-2.5 rounded-2xl border px-2.5 py-2.5 text-sm font-semibold shadow-[0_8px_18px_rgba(65,72,90,0.15)]"
            style={{ borderColor: colors.borderSoft, background: colors.cta, color: colors.ctaText }}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/55 dark:bg-slate-900/45">
              <Wand2 className="h-4 w-4 text-[#506a86] dark:text-[#bfd3f2]" />
            </span>
            <motion.span
              initial={false}
              animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              Neue Geschichte
            </motion.span>
          </motion.button>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            <section>
              <motion.p
                initial={false}
                animate={{ opacity: canExpand ? 1 : 0, height: canExpand ? "auto" : 0 }}
                className="mb-2 overflow-hidden px-2 text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: colors.indicator }}
              >
                Navigation
              </motion.p>

              <div className="space-y-1">{PRIMARY_ITEMS.map(renderNavItem)}</div>
            </section>

            {isAdmin && (
              <section>
                <button
                  type="button"
                  onClick={() => setAdminOpen((prev) => !prev)}
                  className="mb-1 flex w-full items-center justify-between rounded-xl px-2 py-2 text-left"
                  style={{ background: colors.surface }}
                >
                  <motion.span
                    initial={false}
                    animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
                    className="overflow-hidden whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: colors.indicator }}
                  >
                    Werkstatt
                  </motion.span>
                  <span className="text-sm" style={{ color: colors.indicator }}>
                    {adminOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </button>

                <AnimateAdmin open={adminOpen && canExpand}>
                  <div className="space-y-1">{ADMIN_ITEMS.map(renderNavItem)}</div>
                </AnimateAdmin>
              </section>
            )}
          </div>

          <div className="mt-4 border-t pt-3" style={{ borderColor: colors.panelBorder }}>
            {renderNavItem({ icon: Settings, labelKey: "navigation.settings", path: "/settings", tone: "#826fb3" })}

            <button
              type="button"
              onClick={handleSignOut}
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left transition-colors"
              aria-label={t("navigation.logout")}
              style={{ background: colors.logoutBg }}
            >
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{ borderColor: colors.logoutBorder, background: colors.logoutBg }}
              >
                <LogOut className="h-4 w-4 text-[#a76060]" />
              </span>
              <motion.span
                initial={false}
                animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
                className="overflow-hidden whitespace-nowrap text-sm font-medium text-[#9a5f5f]"
              >
                {t("navigation.logout")}
              </motion.span>
            </button>
          </div>
        </div>
      </motion.div>
    </aside>
  );
};

const AnimateAdmin: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => {
  return (
    <motion.div
      initial={false}
      animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div className="pt-1">{children}</div>
    </motion.div>
  );
};

export default Sidebar;


