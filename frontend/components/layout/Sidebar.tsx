import React, { useMemo, useState } from "react";
import {
  BookMarked,
  BookOpen,
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
import { useClerk } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import taleaLogo from "@/img/talea_logo.png";

interface NavItem {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  labelKey: string;
  path: string;
  tone: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Start",
    items: [
      { icon: Home, labelKey: "navigation.home", path: "/", tone: "#7390cf" },
      { icon: User, labelKey: "navigation.avatars", path: "/avatar", tone: "#5a8f84" },
      { icon: BookOpen, labelKey: "navigation.stories", path: "/stories", tone: "#cf6f85" },
      { icon: FlaskConical, labelKey: "navigation.doku", path: "/doku", tone: "#c98a5d" },
    ],
  },
  {
    label: "Kreativ",
    items: [
      { icon: Sparkles, labelKey: "navigation.characters", path: "/characters", tone: "#8e7ecf" },
      { icon: Gem, labelKey: "navigation.artifacts", path: "/artifacts", tone: "#d27799" },
      { icon: BookMarked, labelKey: "navigation.fairytales", path: "/fairytales", tone: "#6d9a8e" },
    ],
  },
  {
    label: "System",
    items: [{ icon: Code, labelKey: "navigation.logs", path: "/logs", tone: "#6f7b92" }],
  },
];

const SETTINGS_ITEM: NavItem = {
  icon: Settings,
  labelKey: "navigation.settings",
  path: "/settings",
  tone: "#826fb3",
};

const Sidebar: React.FC = () => {
  const { signOut } = useClerk();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  const canExpand = useMemo(() => expanded, [expanded]);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen md:block">
      <motion.div
        initial={false}
        animate={{ width: canExpand ? 258 : 86 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className="relative flex h-full flex-col border-r border-[#e8ddcf] px-3 py-4"
        style={{
          background:
            "linear-gradient(180deg, rgba(253,248,241,0.96) 0%, rgba(246,238,226,0.98) 52%, rgba(241,234,224,0.99) 100%)",
          boxShadow: "10px 0 40px rgba(52,61,74,0.08)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
          <div
            className="absolute left-1/2 top-0 h-[360px] w-[360px] -translate-x-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(229,216,196,0.55), transparent 70%)" }}
          />
        </div>

        <div className="relative flex flex-1 flex-col overflow-hidden">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 flex items-center gap-3 rounded-2xl border border-[#e4d8c8] bg-white/70 px-2.5 py-2"
            aria-label="Talea Startseite"
          >
            <img src={taleaLogo} alt="Talea Logo" className="h-10 w-10 rounded-xl object-cover" />
            <motion.div
              initial={false}
              animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
              className="overflow-hidden text-left"
            >
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#6f7a88]">Story Atelier</p>
              <p className="text-[24px] leading-none text-[#253246]" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
                TALEA
              </p>
            </motion.div>
          </button>

          <motion.button
            type="button"
            onClick={() => navigate("/story")}
            whileTap={{ scale: 0.97 }}
            className="mb-5 inline-flex items-center gap-2.5 rounded-2xl border border-[#d8c8b3] bg-[linear-gradient(135deg,#f2d9d6_0%,#ecd9c9_42%,#d8e4d4_100%)] px-2.5 py-2.5 text-[#2e3746] shadow-[0_8px_18px_rgba(65,72,90,0.15)]"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/55">
              <Wand2 className="h-4 w-4 text-[#506a86]" />
            </span>
            <motion.span
              initial={false}
              animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
              className="overflow-hidden whitespace-nowrap text-sm font-semibold"
            >
              Neue Geschichte
            </motion.span>
          </motion.button>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {NAV_GROUPS.map((group) => (
              <section key={group.label}>
                <motion.p
                  initial={false}
                  animate={{ opacity: canExpand ? 1 : 0, height: canExpand ? "auto" : 0 }}
                  className="mb-2 overflow-hidden px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7d8794]"
                >
                  {group.label}
                </motion.p>

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item.path);
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className={cn(
                          "group relative flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left transition-colors",
                          active ? "bg-white/80 shadow-[0_4px_14px_rgba(65,72,90,0.12)]" : "hover:bg-white/55"
                        )}
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
                            borderColor: active ? `${item.tone}55` : "#e7dece",
                            background: active ? `${item.tone}22` : "#f8f3ea",
                          }}
                        >
                          <Icon className="h-4 w-4" style={{ color: active ? item.tone : "#667384" }} />
                        </span>

                        <motion.span
                          initial={false}
                          animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
                          className={cn(
                            "overflow-hidden whitespace-nowrap text-sm font-medium",
                            active ? "text-[#1f2a3a]" : "text-[#5f6f81]"
                          )}
                        >
                          {t(item.labelKey)}
                        </motion.span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-4 border-t border-[#e6ddcf] pt-3">
            <button
              type="button"
              onClick={() => navigate(SETTINGS_ITEM.path)}
              className={cn(
                "relative flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left transition-colors",
                isActive(SETTINGS_ITEM.path)
                  ? "bg-white/80 shadow-[0_4px_14px_rgba(65,72,90,0.12)]"
                  : "hover:bg-white/55"
              )}
              aria-label={t(SETTINGS_ITEM.labelKey)}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#ddd0bf] bg-[#f8f2ea]">
                <Settings className="h-4 w-4 text-[#6b7590]" />
              </span>
              <motion.span
                initial={false}
                animate={{ opacity: canExpand ? 1 : 0, width: canExpand ? "auto" : 0 }}
                className="overflow-hidden whitespace-nowrap text-sm font-medium text-[#5f6f81]"
              >
                {t(SETTINGS_ITEM.labelKey)}
              </motion.span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[#fff1f1]"
              aria-label={t("navigation.logout")}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#ecd3d3] bg-[#fff5f5]">
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

export default Sidebar;
