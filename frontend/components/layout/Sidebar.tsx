import React, { useEffect, useState } from "react";
import {
  BookMarked,
  Bell,
  BookOpen,
  Bot,
  ChevronDown,
  Code,
  FlaskConical,
  Gamepad2,
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
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { TaleaLogo } from "@/components/brand/TaleaLogo";
import { useOptionalUserAccess } from "@/contexts/UserAccessContext";
import { WizardImage } from "@/components/avatar-form/WizardImage";
import { useWizardAssets } from "@/hooks/useWizardAssets";
import { useNotifications } from "@/contexts/NotificationsContext";

interface NavItem {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Wizard-asset id within the "navTab" group; renders a Talea illustration instead of the icon. */
  imageId?: string;
  /** Further paths that count as this tab (e.g. /quiz for the game room). */
  aliases?: string[];
  path: string;
  labelKey?: string;
  label?: string;
  /** Items without a route (Tavi) run an action instead of navigating. */
  action?: () => void;
}

const PRIMARY_ITEMS: NavItem[] = [
  { icon: Home, imageId: "home", labelKey: "navigation.home", path: "/" },
  { icon: BookOpen, imageId: "stories", labelKey: "navigation.stories", path: "/stories" },
  { icon: User, imageId: "avatars", labelKey: "navigation.avatars", path: "/avatar" },
  { icon: FlaskConical, imageId: "dokus", label: "Dokus", path: "/doku" },
  { icon: Gamepad2, imageId: "quiz", label: "Spiel", path: "/spiel", aliases: ["/quiz"] },
  { icon: Bell, label: "Mitteilungen", path: "/mitteilungen" },
  {
    icon: Bot,
    imageId: "tavi",
    label: "Tavi",
    path: "",
    action: () => window.dispatchEvent(new Event("tavi:open")),
  },
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

/** Collapsed icon rail and permanently expanded widths — AppLayout reserves the same space. */
export const SIDEBAR_RAIL = 84;
export const SIDEBAR_WIDE = 248;
const WIDE_QUERY = "(min-width: 1280px)";

function useIsWideScreen(): boolean {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

const Sidebar: React.FC = () => {
  const { signOut } = useClerk();
  const { isAdmin } = useOptionalUserAccess();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useNotifications()?.summary?.unreadCount ?? 0;

  const [expanded, setExpanded] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const isWide = useIsWideScreen();
  const reduceMotion = useReducedMotion();

  // Wide screens show a permanent labelled sidebar (iPadOS); narrower desktops
  // keep the icon rail that expands on hover.
  const canExpand = expanded || focusWithin || isWide;
  const labelTransition = { duration: reduceMotion ? 0 : 0.15 };
  const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";

  const labelOf = (item: NavItem) => item.label ?? (item.labelKey ? t(item.labelKey) : "");

  const isActive = (path: string, aliases: string[] = []) => {
    if (!path) return false;
    if (path === "/") return location.pathname === "/";
    return [path, ...aliases].some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const { assetUrl } = useWizardAssets();

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path, item.aliases);
    const Icon = item.icon;

    return (
      <motion.button
        key={item.path || item.label}
        type="button"
        onClick={() => (item.action ? item.action() : navigate(item.path))}
        className={cn(
          "group relative flex min-h-12 w-full items-center rounded-2xl px-2.5 py-2 text-left transition-colors duration-150",
          focusClass,
          canExpand ? "gap-3" : "justify-center",
          active
            ? "text-[var(--primary)]"
            : "text-[var(--talea-text-secondary)] hover:bg-[var(--talea-surface-inset)] hover:text-[var(--talea-text-primary)]"
        )}
        aria-label={item.path === '/mitteilungen' && unreadCount ? `Mitteilungen, ${unreadCount} ungelesen` : labelOf(item)}
        aria-current={active ? "page" : undefined}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      >
        {active && (
          <motion.span
            aria-hidden="true"
            layoutId="talea-sidebar-active"
            className="absolute inset-0 rounded-2xl border border-[color-mix(in_srgb,var(--primary)_18%,transparent)] bg-[var(--talea-accent-terracotta-soft)]"
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
          />
        )}
        <span
          className={cn(
            "relative flex h-9 w-9 flex-shrink-0 items-center justify-center transition-[opacity,filter]",
            active ? "opacity-100" : "opacity-70 grayscale-[30%] group-hover:opacity-100 group-hover:grayscale-0"
          )}
        >
          {item.imageId ? (
            <WizardImage
              url={assetUrl("navTab", item.imageId)}
              fallback={<Icon className="h-[20px] w-[20px]" />}
              alt=""
              fallbackClassName="flex h-full w-full items-center justify-center"
            />
          ) : (
            <Icon className={cn("h-[20px] w-[20px]", active && "text-[var(--primary)]")} />
          )}
          {item.path === '/mitteilungen' && unreadCount > 0 && !canExpand && (
            <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[var(--primary)]" />
          )}
        </span>

        <motion.span
          initial={false}
          animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
          transition={labelTransition}
          className={cn(
            "relative overflow-hidden whitespace-nowrap text-[15px]",
            active ? "font-semibold" : "font-medium"
          )}
        >
          {labelOf(item)}
        </motion.span>
        {item.path === '/mitteilungen' && unreadCount > 0 && canExpand && (
          <span aria-hidden="true" className="relative ml-auto rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--primary-foreground)]">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </motion.button>
    );
  };

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-dvh md:block" aria-label="Hauptnavigation">
      <motion.div
        initial={false}
        animate={{ width: canExpand ? SIDEBAR_WIDE : SIDEBAR_RAIL }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 36 }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocusCapture={() => setFocusWithin(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
        }}
        className={cn(
          "relative flex h-dvh flex-col border-r px-3 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-xl",
          canExpand && !isWide && "shadow-[var(--talea-shadow-strong)]"
        )}
        style={{ background: "var(--sidebar)", borderColor: "var(--sidebar-border)" }}
      >
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <button
            type="button"
            onClick={() => navigate("/")}
            className={cn("mb-5 flex min-h-14 items-center rounded-xl px-2 py-1.5 transition-colors hover:bg-[var(--talea-surface-inset)]", focusClass, !canExpand && "justify-center")}
            aria-label="Talea Startseite"
          >
            <TaleaLogo variant={canExpand ? "compact" : "mark"} alt="" className={canExpand ? "h-12 w-auto" : "h-11 w-11"} />
          </button>

          <motion.button
            type="button"
            onClick={() => navigate("/story")}
            className={cn(
              "mb-5 flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-[15px] font-semibold text-[var(--primary-foreground)] transition-[filter] hover:brightness-[1.06]",
              focusClass,
              canExpand ? "px-4" : "px-0"
            )}
            aria-label="Neue Geschichte"
            whileHover={reduceMotion ? undefined : { y: -1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            style={{ boxShadow: "0 6px 18px color-mix(in srgb, var(--talea-accent-terracotta) 20%, transparent)" }}
          >
            <Sparkles className="h-4 w-4 flex-shrink-0" />
            {canExpand ? <span className="whitespace-nowrap">Neue Geschichte</span> : null}
          </motion.button>

          <div className="flex-1 space-y-1 overflow-y-auto pr-0.5">
            {PRIMARY_ITEMS.map(renderNavItem)}

            {isAdmin && (
              <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--talea-border-light)" }}>
                <button
                  type="button"
                  onClick={() => setAdminOpen((prev) => !prev)}
                  className={cn("mb-1 flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--talea-surface-inset)]", focusClass)}
                  aria-label="Adminnavigation"
                  aria-expanded={adminOpen && canExpand}
                  aria-controls="talea-admin-navigation"
                >
                  <motion.span
                    initial={false}
                    animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
                    transition={labelTransition}
                    className="overflow-hidden whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--talea-text-muted)]"
                  >
                    Admin
                  </motion.span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-[var(--talea-text-muted)] transition-transform duration-200", adminOpen && "rotate-180")} />
                </button>

                <AnimatePresence initial={false}>
                  {adminOpen && canExpand && (
                    <motion.div
                      id="talea-admin-navigation"
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
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
              onClick={handleSignOut}
              className={cn("group flex min-h-12 w-full items-center rounded-2xl px-2.5 py-2 text-left text-[var(--talea-text-tertiary)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400", focusClass, canExpand ? "gap-3" : "justify-center")}
              aria-label={t("navigation.logout")}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
                <LogOut className="h-[20px] w-[20px]" />
              </span>
              <motion.span
                initial={false}
                animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
                transition={labelTransition}
                className="overflow-hidden whitespace-nowrap text-[15px] font-medium"
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
