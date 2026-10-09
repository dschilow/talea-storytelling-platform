import React from "react";
import { useLocation, Outlet } from "react-router-dom";
import { SignedIn } from "@clerk/clerk-react";
import { AnimatePresence, motion } from "framer-motion";

import Sidebar, { SIDEBAR_RAIL, SIDEBAR_WIDE } from "./Sidebar";
import BottomNav from "./BottomNav";
import { GlobalAudioPlayer } from "../audio/GlobalAudioPlayer";
import ProfileMenuButton from "./ProfileMenuButton";
import NotificationsButton from "./NotificationsButton";
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
      match: (path) => path.startsWith("/quiz") || path.startsWith("/spiel"),
      meta: {
        eyebrow: "Spielezimmer",
        title: "Spiel",
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
      match: (path) => path.startsWith("/mitteilungen"),
      meta: { eyebrow: "Neues aus Talea", title: "Mitteilungen" },
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

/**
 * `offline` renders the exact same shell without the Clerk `SignedIn` gate.
 * Offline the app runs on a mocked Clerk that reports "signed out", which would
 * otherwise strip the sidebar and bottom nav and make offline mode look like a
 * different product. The profile menu stays out: it reads child profiles from
 * the backend, which by definition is not there.
 */
const AppLayout: React.FC<{ offline?: boolean }> = ({ offline = false }) => {
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
    location.pathname.startsWith("/spiel") ||
    location.pathname.startsWith("/community") ||
    location.pathname.startsWith("/map") ||
    location.pathname.startsWith("/settings") ||
    location.pathname.startsWith("/mitteilungen") ||
    location.pathname.startsWith("/fairytales") ||
    location.pathname.startsWith("/characters") ||
    location.pathname.startsWith("/artifacts") ||
    location.pathname.startsWith("/logs");
  const isFullBleed = isCosmosFullScreenRoute || isReaderRoute;
  const shellStyle = isFullBleed
    ? undefined
    : {
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      };
  // Bottom padding clears the floating tab bar (62px + inset) and, while audio plays, the mini player.
  const contentClassName = isFullBleed
    ? "w-full min-h-screen p-0 m-0 max-w-none"
    : usesImmersiveShell
      ? "w-full mx-auto max-w-none pb-[calc(env(safe-area-inset-bottom)+6rem+var(--talea-player-offset,0px))] md:pb-12"
      : `w-full mx-auto pb-[calc(env(safe-area-inset-bottom)+6rem+var(--talea-player-offset,0px))] md:pb-12 ${
          isSettingsRoute ? "max-w-none" : "max-w-[1260px] px-4 md:px-8"
        }`;

  const chrome = !isCosmosFullScreenRoute;
  // Gate helper so the offline shell renders identical chrome without Clerk.
  const Chrome: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    offline ? <>{children}</> : <SignedIn>{children}</SignedIn>;

  return (
    <div className="min-h-screen text-foreground flex flex-col md:flex-row">
      <Chrome>
        {chrome && (
          <>
            {/* Reserves the sidebar's width: rail below 1280px, labelled sidebar above. */}
            <div
              className="hidden md:block flex-shrink-0 w-[var(--talea-sidebar-rail)] xl:w-[var(--talea-sidebar-wide)]"
              style={{ "--talea-sidebar-rail": `${SIDEBAR_RAIL}px`, "--talea-sidebar-wide": `${SIDEBAR_WIDE}px` } as React.CSSProperties}
            />
            <Sidebar />
          </>
        )}
      </Chrome>

      {/* min-w-0: horizontal shelves must scroll inside main, not stretch the page. */}
      <main className="min-w-0 flex-1 min-h-screen">
        <div style={shellStyle} className="w-full">
          {/* Top row: the account button sits here, like in iOS apps, instead of
              floating over each page's own header. */}
          {!isFullBleed ? (
            <div className="flex h-14 items-center justify-end gap-3 px-4 pt-[env(safe-area-inset-top)] md:px-8">
              {!usesImmersiveShell ? (
                <h1
                  className="mr-auto hidden text-[1.75rem] font-bold text-[var(--talea-text-primary)] md:block"
                  style={{ fontFamily: "var(--talea-font-display)" }}
                >
                  {routeMeta.title}
                </h1>
              ) : null}
              {!offline && chrome ? (
                <SignedIn>
                  <NotificationsButton />
                  <ProfileMenuButton />
                </SignedIn>
              ) : null}
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

      <GlobalAudioPlayer />

      <Chrome>{chrome && <BottomNav />}</Chrome>
    </div>
  );
};

export default AppLayout;
