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
          "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-200",
          active
            ? "bg-[var(--primary)]/10 text-[var(--primary)]"
            : "text-[var(--talea-text-secondary)] hover:bg-[var(--talea-surface-inset)] hover:text-[var(--talea-text-primary)]"
        )}
        aria-label={labelOf(item)}
      >
        {active && (
          <motion.span
            layoutId="talea-sidebar-active"
            className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-[var(--primary)]"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}

        <Icon
          className={cn(
            "h-[18px] w-[18px] flex-shrink-0 transition-colors",
            active ? "text-[var(--primary)]" : "text-[var(--talea-text-tertiary)] group-hover:text-[var(--talea-text-secondary)]"
          )}
        />

        <motion.span
          initial={false}
          animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "overflow-hidden whitespace-nowrap text-[13px] font-medium tracking-[-0.01em]",
            active ? "font-semibold" : ""
          )}
        >
          {labelOf(item)}
        </motion.span>
      </button>
    );
  };

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen md:block">
      <motion.div
        initial={false}
        animate={{ width: canExpand ? 240 : 72 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className="relative flex h-full flex-col border-r px-2.5 py-3"
        style={{
          background: isDark ? "var(--sidebar)" : "#ffffff",
          borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        }}
      >
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Logo */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-6 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--talea-surface-inset)]"
            aria-label="Talea Startseite"
          >
            <img src={taleaLogo} alt="Talea" className="h-8 w-8 rounded-lg object-cover flex-shrink-0" />
            <motion.div
              initial={false}
              animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--talea-text-tertiary)]">
                Story Atelier
              </p>
              <p
                className="text-lg font-semibold leading-tight tracking-tight text-[var(--talea-text-primary)]"
                style={{ fontFamily: '"Fraunces", serif' }}
              >
                Talea
              </p>
            </motion.div>
          </button>

          {/* Navigation */}
          <div className="flex-1 space-y-1 overflow-y-auto pr-0.5">
            <motion.p
              initial={false}
              animate={{ opacity: canExpand ? 1 : 0, height: canExpand ? "auto" : 0 }}
              className="mb-2 overflow-hidden px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--talea-text-muted)]"
            >
              Menu
            </motion.p>

            {PRIMARY_ITEMS.map(renderNavItem)}

            {isAdmin && (
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--talea-border-light)" }}>
                <button
                  type="button"
                  onClick={() => setAdminOpen((prev) => !prev)}
                  className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-[var(--talea-surface-inset)]"
                >
                  <motion.span
                    initial={false}
                    animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
                    className="overflow-hidden whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--talea-text-muted)]"
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

          {/* Footer */}
          <div className="mt-3 space-y-0.5 border-t pt-3" style={{ borderColor: "var(--talea-border-light)" }}>
            {renderNavItem(SETTINGS_ITEM)}

            <button
              type="button"
              onClick={handleOpenTavi}
              className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-200 text-[var(--talea-text-secondary)] hover:bg-[var(--talea-surface-inset)] hover:text-[var(--talea-text-primary)]"
              aria-label="Tavi Assistant"
            >
              <Bot className="h-[18px] w-[18px] flex-shrink-0 text-[var(--talea-text-tertiary)] group-hover:text-[var(--talea-text-secondary)]" />
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
              className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-200 text-[var(--talea-text-tertiary)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400"
              aria-label={t("navigation.logout")}
            >
              <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
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
