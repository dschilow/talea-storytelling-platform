import React, { useEffect, useState } from "react";
import { BookMarked, ChevronDown, Code, Gem, LogOut, Sparkles, type LucideIcon } from "lucide-react";
import { useClerk } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { TaleaLogo } from "@/components/brand/TaleaLogo";
import { NavIcon, type NavIconName } from "@/components/navigation/NavIcon";
import { useOptionalUserAccess } from "@/contexts/UserAccessContext";
import { useNotifications } from "@/contexts/NotificationsContext";

interface NavItem {
  /** Talea glyph for the child-facing areas; lucide icons for admin tools. */
  icon: NavIconName | LucideIcon;
  /** Further paths that count as this tab (e.g. /quiz for the game room). */
  aliases?: string[];
  path: string;
  labelKey?: string;
  label?: string;
  /** Items without a route (Tavi) run an action instead of navigating. */
  action?: () => void;
}

const PRIMARY_ITEMS: NavItem[] = [
  { icon: "home", labelKey: "navigation.home", path: "/" },
  { icon: "stories", labelKey: "navigation.stories", path: "/stories", aliases: ["/originals", "/episode-reader"] },
  { icon: "avatars", labelKey: "navigation.avatars", path: "/avatar" },
  { icon: "dokus", label: "Dokus", path: "/doku" },
  { icon: "game", label: "Spiel", path: "/spiel", aliases: ["/quiz"] },
];

const SECONDARY_ITEMS: NavItem[] = [
  { icon: "notifications", label: "Mitteilungen", path: "/mitteilungen" },
  {
    icon: "tavi",
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
  icon: "settings",
  labelKey: "navigation.settings",
  path: "/settings",
};

/** Collapsed icon rail and permanently expanded widths — AppLayout reserves the same space. */
export const SIDEBAR_RAIL = 84;
export const SIDEBAR_WIDE = 248;
const WIDE_QUERY = "(min-width: 1280px)";

const MotionLink = motion.create(Link);

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

  const renderLabel = (text: string, className?: string) => (
    <motion.span
      initial={false}
      animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
      transition={labelTransition}
      className={cn("relative overflow-hidden whitespace-nowrap text-[15px]", className)}
    >
      {text}
    </motion.span>
  );

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path, item.aliases);
    const unread = item.path === "/mitteilungen" ? unreadCount : 0;
    const Icon = item.icon;

    const className = cn(
      "group relative flex h-11 w-full items-center rounded-[14px] px-2.5 text-left transition-colors duration-150",
      focusClass,
      canExpand ? "gap-3" : "justify-center",
      active
        ? "text-[var(--primary)]"
        : "text-[var(--talea-text-secondary)] hover:bg-[var(--talea-surface-inset)] hover:text-[var(--talea-text-primary)]"
    );
    const content = (
      <>
        {active && (
          <motion.span
            aria-hidden="true"
            layoutId="talea-sidebar-active"
            className="absolute inset-0 rounded-[14px] bg-[color-mix(in_srgb,var(--primary)_11%,transparent)]"
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
          />
        )}
        <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center">
          {typeof Icon === "string" ? (
            <NavIcon name={Icon} active={active} className="h-[23px] w-[23px]" />
          ) : (
            <Icon className="h-[20px] w-[20px]" strokeWidth={1.8} />
          )}
          {unread > 0 && !canExpand && (
            <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[var(--primary)] ring-2 ring-[var(--talea-surface-primary)]" />
          )}
        </span>
        {renderLabel(labelOf(item), active ? "font-semibold" : "font-medium")}
        {unread > 0 && canExpand && (
          <span aria-hidden="true" className="relative ml-auto rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--primary-foreground)]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </>
    );
    const shared = {
      className,
      "aria-label": unread ? `${labelOf(item)}, ${unread} ungelesen` : labelOf(item),
      whileTap: reduceMotion ? undefined : { scale: 0.98 },
    };

    return item.action ? (
      <motion.button key={item.label} type="button" onClick={item.action} {...shared}>
        {content}
      </motion.button>
    ) : (
      <MotionLink key={item.path} to={item.path} aria-current={active ? "page" : undefined} {...shared}>
        {content}
      </MotionLink>
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
          <Link
            to="/"
            className={cn("mb-5 flex min-h-14 items-center rounded-xl px-1.5 py-1.5", focusClass, !canExpand && "justify-center")}
            aria-label="Talea Startseite"
          >
            <TaleaLogo variant={canExpand ? "horizontal" : "icon"} alt="" className={canExpand ? "h-14 w-auto" : "h-[52px] w-[52px]"} />
          </Link>

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
            <NavIcon name="newStory" active className="h-[19px] w-[19px]" />
            {canExpand ? <span className="whitespace-nowrap">Neue Geschichte</span> : null}
          </motion.button>

          <div className="flex-1 overflow-y-auto pr-0.5">
            <div className="space-y-1">{PRIMARY_ITEMS.map(renderNavItem)}</div>
            <div aria-hidden="true" className="mx-2.5 my-3 h-px bg-[var(--talea-border-light)]" />
            <div className="space-y-1">{SECONDARY_ITEMS.map(renderNavItem)}</div>

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

          <div className="mt-3 space-y-1 border-t pt-3" style={{ borderColor: "var(--talea-border-light)" }}>
            {renderNavItem(SETTINGS_ITEM)}

            <button
              type="button"
              onClick={handleSignOut}
              className={cn("group flex h-11 w-full items-center rounded-[14px] px-2.5 text-left text-[var(--talea-text-tertiary)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400", focusClass, canExpand ? "gap-3" : "justify-center")}
              aria-label={t("navigation.logout")}
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
                <LogOut className="h-[20px] w-[20px]" strokeWidth={1.8} />
              </span>
              {renderLabel(t("navigation.logout"), "font-medium")}
            </button>
          </div>
        </div>
      </motion.div>
    </aside>
  );
};

export default Sidebar;
