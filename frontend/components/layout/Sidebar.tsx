import React, { useMemo, useState } from "react";
import {
  Brain,
  BookMarked,
  BookOpen,
  Bot,
  ChevronDown,
  Code,
  FlaskConical,
  Gem,
  Home,
  LogOut,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import { useClerk } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import taleaLogo from "@/img/talea_logo.png";
import { useTheme } from "@/contexts/ThemeContext";
import { useOptionalUserAccess } from "@/contexts/UserAccessContext";

interface NavItem {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  path: string;
  labelKey?: string;
  label?: string;
}

const PRIMARY_ITEMS: NavItem[] = [
  { icon: Home, labelKey: "navigation.home", path: "/" },
  { icon: BookOpen, labelKey: "navigation.stories", path: "/stories" },
  { icon: User, labelKey: "navigation.avatars", path: "/avatar" },
  { icon: FlaskConical, label: "Dokus", path: "/doku" },
  { icon: Brain, label: "Quiz", path: "/quiz" },
];

const ADMIN_ITEMS: NavItem[] = [
  { icon: Sparkles, labelKey: "navigation.characters", path: "/characters" },
  { icon: Gem, labelKey: "navigation.artifacts", path: "/artifacts" },
  { icon: BookMarked, labelKey: "navigation.fairytales", path: "/fairytales" },
  { icon: Code, labelKey: "navigation.logs", path: "/logs" },
];

const SETTINGS_ITEM: NavItem = {
  icon: Settings,
  labelKey: "navigation.settings",
  path: "/settings",
};

const Sidebar: React.FC = () => {
  const { signOut } = useClerk();
  const { isAdmin } = useOptionalUserAccess();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();

  const [expanded, setExpanded] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const canExpand = useMemo(() => expanded, [expanded]);
  const isDark = resolvedTheme === "dark";

  const labelOf = (item: NavItem) => item.label ?? (item.labelKey ? t(item.labelKey) : "");

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleOpenTavi = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("tavi:open"));
    }
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
          "group relative flex w-full items-center gap-3 overflow-hidden rounded-[1.35rem] px-3 py-2.5 text-left transition-all duration-200",
          active
            ? "text-[var(--talea-text-primary)]"
            : "text-[var(--talea-text-secondary)] hover:bg-[var(--talea-surface-inset)]/80 hover:text-[var(--talea-text-primary)]"
        )}
        aria-label={labelOf(item)}
      >
        {active && (
          <motion.span
            layoutId="talea-sidebar-active"
            className="absolute inset-0 rounded-[1.35rem] border border-[var(--talea-border-accent)] bg-[linear-gradient(135deg,rgba(255,255,255,0.75)_0%,rgba(231,239,232,0.88)_46%,rgba(227,235,247,0.84)_100%)] dark:bg-[linear-gradient(135deg,rgba(229,176,183,0.14)_0%,rgba(154,199,182,0.18)_46%,rgba(176,200,231,0.16)_100%)]"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}

        <div
          className={cn(
            "relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[1rem] border transition-colors",
            active
              ? "border-white/70 bg-white/80 text-[var(--primary)] shadow-[0_8px_20px_rgba(91,72,59,0.08)] dark:border-white/10 dark:bg-white/6"
              : "border-transparent bg-[var(--talea-surface-inset)] text-[var(--talea-text-tertiary)] group-hover:bg-white/75 group-hover:text-[var(--talea-text-secondary)] dark:group-hover:bg-white/6"
          )}
        >
          <Icon className="h-[18px] w-[18px] transition-colors" />
        </div>

        <motion.span
          initial={false}
          animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "relative overflow-hidden whitespace-nowrap text-[13px] font-medium tracking-[-0.01em]",
            active ? "font-semibold" : ""
          )}
        >
          {labelOf(item)}
        </motion.span>

        {active && canExpand ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative ml-auto h-2 w-2 rounded-full bg-[var(--primary)]"
          />
        ) : null}
      </button>
    );
  };

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen md:block">
      <motion.div
        initial={false}
        animate={{ width: canExpand ? 280 : 88 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className="relative mx-3 my-3 flex h-[calc(100vh-1.5rem)] flex-col rounded-[2rem] border px-3 py-3"
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--sidebar-border)",
          boxShadow: "var(--talea-shadow-medium)",
          backdropFilter: "blur(24px)",
        }}
      >
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 flex items-center gap-3 rounded-[1.5rem] px-2 py-2 transition-colors hover:bg-[var(--talea-surface-inset)]/80"
            aria-label="Talea Startseite"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[1.2rem] border border-white/70 bg-white/76 shadow-[0_10px_24px_rgba(91,72,59,0.08)] dark:border-white/10 dark:bg-white/6">
              <img src={taleaLogo} alt="Talea" className="h-8 w-8 rounded-[0.9rem] object-cover" />
            </div>
            <motion.div
              initial={false}
              animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden pr-1"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-tertiary)]">
                Talea Workspace
              </p>
              <p
                className="text-[1.15rem] font-semibold leading-tight tracking-tight text-[var(--talea-text-primary)]"
                style={{ fontFamily: '"Fraunces", serif' }}
              >
                Talea
              </p>
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
            {canExpand ? (
              <motion.button
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                type="button"
                onClick={() => navigate("/story")}
                className="mb-4 overflow-hidden rounded-[1.6rem] border border-[var(--talea-border-light)] bg-[linear-gradient(135deg,#f5dfdf_0%,#e7efe8_46%,#e3ebf7_100%)] p-4 text-left shadow-[0_12px_28px_rgba(91,72,59,0.08)] dark:bg-[linear-gradient(135deg,rgba(229,176,183,0.16)_0%,rgba(154,199,182,0.18)_46%,rgba(176,200,231,0.16)_100%)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-secondary)]">Schnellstart</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--talea-text-primary)]">Neue Geschichte beginnen</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-[1rem] border border-white/70 bg-white/76 text-[var(--primary)] shadow-[0_8px_20px_rgba(91,72,59,0.08)] dark:border-white/10 dark:bg-white/6">
                    <Sparkles className="h-4 w-4" />
                  </div>
                </div>
              </motion.button>
            ) : null}
          </AnimatePresence>

          <div className="flex-1 space-y-1 overflow-y-auto pr-0.5">
            <motion.p
              initial={false}
              animate={{ opacity: canExpand ? 1 : 0, height: canExpand ? "auto" : 0 }}
              className="mb-2 overflow-hidden px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--talea-text-muted)]"
            >
              Navigation
            </motion.p>

            {PRIMARY_ITEMS.map(renderNavItem)}

            {isAdmin && (
              <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--talea-border-light)" }}>
                <button
                  type="button"
                  onClick={() => setAdminOpen((prev) => !prev)}
                  className="mb-1 flex w-full items-center justify-between rounded-[1.2rem] px-3 py-2 text-left transition-colors hover:bg-[var(--talea-surface-inset)]"
                >
                  <motion.span
                    initial={false}
                    animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
                    className="overflow-hidden whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--talea-text-muted)]"
                  >
                    Admin
                  </motion.span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-[var(--talea-text-muted)] transition-transform duration-200", adminOpen && "rotate-180")} />
                </button>

                <AnimatePresence initial={false}>
                  {adminOpen && canExpand && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 pt-1">{ADMIN_ITEMS.map(renderNavItem)}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="mt-3 space-y-0.5 border-t pt-3" style={{ borderColor: "var(--talea-border-light)" }}>
            {renderNavItem(SETTINGS_ITEM)}

            <button
              type="button"
              onClick={handleOpenTavi}
              className="group flex w-full items-center gap-3 rounded-[1.35rem] px-3 py-2.5 text-left transition-all duration-200 text-[var(--talea-text-secondary)] hover:bg-[var(--talea-surface-inset)] hover:text-[var(--talea-text-primary)]"
              aria-label="Tavi Assistant"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[1rem] border border-transparent bg-[var(--talea-surface-inset)] text-[var(--talea-text-tertiary)] transition-colors group-hover:border-white/60 group-hover:bg-white/75 group-hover:text-[var(--talea-text-secondary)] dark:group-hover:border-white/10 dark:group-hover:bg-white/6">
                <Bot className="h-[18px] w-[18px]" />
              </div>
              <motion.span
                initial={false}
                animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap text-[13px] font-medium tracking-[-0.01em]"
              >
                Tavi
              </motion.span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="group flex w-full items-center gap-3 rounded-[1.35rem] px-3 py-2.5 text-left transition-all duration-200 text-[var(--talea-text-tertiary)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400"
              aria-label={t("navigation.logout")}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[1rem] border border-transparent bg-[var(--talea-surface-inset)] transition-colors group-hover:bg-red-50 dark:group-hover:bg-red-950/20">
                <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
              </div>
              <motion.span
                initial={false}
                animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap text-[13px] font-medium tracking-[-0.01em]"
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

export default Sidebar;
