import React from "react";
import { useLocation, Outlet } from "react-router-dom";
import { SignedIn } from "@clerk/clerk-react";
import { AnimatePresence, motion } from "framer-motion";

import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { GlobalAudioPlayer } from "../audio/GlobalAudioPlayer";
import ProfileMenuButton from "./ProfileMenuButton";
import { cn } from "@/lib/utils";

type RouteMeta = {
  eyebrow: string;
  title: string;
};

function getRouteMeta(pathname: string): RouteMeta {
  const matches: Array<{ match: (path: string) => boolean; meta: RouteMeta }> = [
    {
      match: (path) => path === "/",
      meta: {
        eyebrow: "Talea Home",
        title: "Atelier",
      },
    },
    {
      match: (path) => path.startsWith("/stories"),
      meta: {
        eyebrow: "Story Library",
        title: "Bibliothek",
      },
    },
    {
      match: (path) => path.startsWith("/story"),
      meta: {
        eyebrow: "Story Studio",
        title: "Story Wizard",
      },
    },
    {
      match: (path) => path.startsWith("/avatar"),
      meta: {
        eyebrow: "Character Atelier",
        title: "Avatare",
      },
    },
    {
      match: (path) => path.startsWith("/doku"),
      meta: {
        eyebrow: "Knowledge Studio",
        title: "Dokus",
      },
    },
    {
      match: (path) => path.startsWith("/quiz"),
      meta: {
        eyebrow: "Quiz Lab",
        title: "Quiz",
      },
    },
    {
      match: (path) => path.startsWith("/map"),
      meta: {
        eyebrow: "Learning Journey",
        title: "Lernpfad",
      },
    },
    {
      match: (path) => path.startsWith("/community"),
      meta: {
        eyebrow: "Community",
        title: "Entdecken",
      },
    },
    {
      match: (path) => path.startsWith("/settings"),
      meta: {
        eyebrow: "Settings",
        title: "Einstellungen",
      },
    },
  ];

  return matches.find((entry) => entry.match(pathname))?.meta ?? {
    eyebrow: "Talea",
    title: "Workspace",
  };
}

const AppLayout: React.FC = () => {
  const location = useLocation();
  const isCosmosFullScreenRoute = location.pathname.startsWith("/cosmos");
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isReaderRoute =
    location.pathname.startsWith("/story-reader") ||
    location.pathname.startsWith("/doku-reader");
  const routeMeta = getRouteMeta(location.pathname);
  const usesImmersiveShell =
    location.pathname === "/" ||
    location.pathname.startsWith("/stories") ||
    location.pathname.startsWith("/avatar") ||
    location.pathname.startsWith("/story") ||
    location.pathname.startsWith("/doku") ||
    location.pathname.startsWith("/quiz") ||
    location.pathname.startsWith("/community") ||
    location.pathname.startsWith("/map") ||
    location.pathname.startsWith("/settings") ||
    location.pathname.startsWith("/fairytales") ||
    location.pathname.startsWith("/characters") ||
    location.pathname.startsWith("/artifacts") ||
    location.pathname.startsWith("/logs");
  const shellStyle = isCosmosFullScreenRoute || isReaderRoute
    ? undefined
    : {
        paddingLeft: "max(env(safe-area-inset-left), 0.375rem)",
        paddingRight: "max(env(safe-area-inset-right), 0.375rem)",
      };
  const contentClassName =
    isCosmosFullScreenRoute || isReaderRoute
      ? "w-full min-h-screen p-0 m-0 max-w-none"
      : usesImmersiveShell
        ? "w-full mx-auto max-w-none pb-20 pt-0 md:pb-10 md:pt-1"
        : `w-full mx-auto pb-20 pt-2 md:pb-10 md:pt-3 ${
            isSettingsRoute ? "max-w-[1520px] md:px-5" : "max-w-[1260px] md:px-8"
          }`;

  return (
    <div className="min-h-screen text-foreground flex flex-col md:flex-row">
      <SignedIn>
        {!isCosmosFullScreenRoute && (
          <>
            <div className="hidden md:block w-[88px] flex-shrink-0" />
            <Sidebar />
          </>
        )}
      </SignedIn>

      <main className="flex-1 min-h-screen transition-all duration-300">
        <div style={shellStyle} className="w-full">
          {!isCosmosFullScreenRoute && !isReaderRoute && !usesImmersiveShell ? (
            <div className="pointer-events-none sticky top-0 z-30 hidden px-1 pt-3 md:block">
              <div className="pointer-events-auto mx-auto max-w-[1680px]">
                <div className="relative overflow-hidden rounded-[1.9rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] shadow-[var(--talea-shadow-soft)] backdrop-blur-2xl before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/70 dark:before:bg-white/10">
                  <div className="flex items-center justify-between gap-6 px-5 py-4 lg:px-6">
                    <div className="min-w-0">
                      <span className="inline-flex items-center rounded-full border border-[var(--talea-border-light)] bg-white/72 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-secondary)] shadow-[0_4px_14px_rgba(91,72,59,0.05)] dark:bg-[var(--talea-surface-inset)]">
                        {routeMeta.eyebrow}
                      </span>
                      <div className="mt-3 flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
                        <h2
                          className="text-[1.7rem] font-semibold leading-none text-[var(--talea-text-primary)]"
                          style={{ fontFamily: '"Fraunces", "Cormorant Garamond", serif' }}
                        >
                          {routeMeta.title}
                        </h2>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className={cn(contentClassName)}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={isReaderRoute ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={isReaderRoute ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      <SignedIn>
        {!isCosmosFullScreenRoute && <ProfileMenuButton />}
      </SignedIn>

      <GlobalAudioPlayer />

      <SignedIn>
        {!isCosmosFullScreenRoute && <BottomNav />}
      </SignedIn>
    </div>
  );
};

export default AppLayout;
