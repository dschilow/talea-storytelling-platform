import React, { useMemo, useState } from "react";
import {
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
import { useClerk, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import taleaLogo from "@/img/talea_logo.png";
import { useTheme } from "@/contexts/ThemeContext";

interface NavItem {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  path: string;
  tone: string;
  labelKey?: string;
  label?: string;
}

const PRIMARY_ITEMS: NavItem[] = [
  { icon: Home, labelKey: "navigation.home", path: "/", tone: "#a88f80" },
  { icon: BookOpen, labelKey: "navigation.stories", path: "/stories", tone: "#b69684" },
  { icon: FlaskConical, label: "Dokus", path: "/doku", tone: "#bf9f8c" },
  { icon: User, labelKey: "navigation.avatars", path: "/avatar", tone: "#9b8a7d" },
];

const ADMIN_ITEMS: NavItem[] = [
  { icon: Sparkles, labelKey: "navigation.characters", path: "/characters", tone: "#b29a8a" },
  { icon: Gem, labelKey: "navigation.artifacts", path: "/artifacts", tone: "#bca390" },
  { icon: BookMarked, labelKey: "navigation.fairytales", path: "/fairytales", tone: "#ad9788" },
  { icon: Code, labelKey: "navigation.logs", path: "/logs", tone: "#9f8c7e" },
];

const SETTINGS_ITEM: NavItem = {
  icon: Settings,
  labelKey: "navigation.settings",
  path: "/settings",
  tone: "#a28d7f",
};

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
  const isAdmin = user?.publicMetadata?.role !== "customer";

  const colors = useMemo(
    () =>
      isDark
        ? {
            panelBackground:
              "linear-gradient(180deg, rgba(21,27,38,0.98) 0%, rgba(18,24,34,0.99) 52%, rgba(15,21,31,1) 100%)",
            panelBorder: "#263348",
            surface: "rgba(34,43,58,0.82)",
            textPrimary: "#e8eef8",
            textSecondary: "#9ba9be",
            indicator: "#b6c4da",
            borderSoft: "#314158",
            logoutBg: "rgba(176,97,97,0.18)",
            logoutBorder: "#5f3b3b",
            logoPlate: "rgba(31,40,55,0.9)",
          }
        : {
            panelBackground:
              "linear-gradient(180deg, rgba(245,235,224,0.97) 0%, rgba(237,237,233,0.98) 54%, rgba(227,213,202,0.99) 100%)",
            panelBorder: "#d6ccc2",
            surface: "rgba(255,255,255,0.58)",
            textPrimary: "#332b26",
            textSecondary: "#6f6258",
            indicator: "#8d7d70",
            borderSoft: "#d5bdaf",
            logoutBg: "rgba(198,160,147,0.2)",
            logoutBorder: "#c6a093",
            logoPlate: "rgba(255,255,255,0.62)",
          },
    [isDark]
  );

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
          "group relative flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left transition-colors",
          active ? "shadow-[0_4px_14px_rgba(65,72,90,0.14)]" : ""
        )}
        style={{ background: active ? colors.surface : "transparent" }}
        aria-label={labelOf(item)}
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
          className="overflow-hidden whitespace-nowrap text-sm"
          style={{ color: active ? colors.textPrimary : colors.textSecondary, fontWeight: active ? 600 : 500 }}
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
        animate={{ width: canExpand ? 258 : 88 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className="relative flex h-full flex-col border-r px-3 py-4"
        style={{
          background: colors.panelBackground,
          borderColor: colors.panelBorder,
          boxShadow: isDark ? "12px 0 40px rgba(3,8,14,0.52)" : "10px 0 34px rgba(118,98,82,0.16)",
        }}
      >
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
                    <ChevronDown className={cn("h-4 w-4 transition-transform", adminOpen && "rotate-180")} />
                  </span>
                </button>

                <AnimateAdmin open={adminOpen && canExpand}>
                  <div className="space-y-1">{ADMIN_ITEMS.map(renderNavItem)}</div>
                </AnimateAdmin>
              </section>
            )}
          </div>

          <div className="mt-4 border-t pt-3" style={{ borderColor: colors.panelBorder }}>
            {renderNavItem(SETTINGS_ITEM)}

            <button
              type="button"
              onClick={handleOpenTavi}
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left transition-colors"
              aria-label="Tavi Assistant"
              style={{ background: colors.surface }}
            >
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{ borderColor: colors.borderSoft, background: colors.surface }}
              >
                <Bot className="h-4 w-4" style={{ color: colors.textSecondary }} />
              </span>
              <motion.span
                initial={false}
                animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
                className="overflow-hidden whitespace-nowrap text-sm font-medium"
                style={{ color: colors.textSecondary }}
              >
                Tavi
              </motion.span>
            </button>

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
                <LogOut className="h-4 w-4 text-[#9e6d5f]" />
              </span>
              <motion.span
                initial={false}
                animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
                className="overflow-hidden whitespace-nowrap text-sm font-medium text-[#9e6d5f]"
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
