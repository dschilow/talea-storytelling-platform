import React from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { SignedIn } from "@clerk/clerk-react";
import { Headphones, Settings } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { GlobalAudioPlayer } from "../audio/GlobalAudioPlayer";
import ProfileSwitcher from "./ProfileSwitcher";
import { useTheme } from "@/contexts/ThemeContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const { playlist, togglePlaylistDrawer } = useAudioPlayer();
  const isDark = resolvedTheme === "dark";
  const isCosmosFullScreenRoute = location.pathname.startsWith("/cosmos");
  const showSettingsButton = location.pathname !== "/settings";
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isReaderRoute =
    location.pathname.startsWith("/story-reader") ||
    location.pathname.startsWith("/doku-reader");
  const usesImmersiveShell =
    location.pathname === "/" ||
    location.pathname.startsWith("/stories") ||
    location.pathname.startsWith("/avatar") ||
    location.pathname.startsWith("/story") ||
    location.pathname.startsWith("/doku") ||
    location.pathname.startsWith("/quiz") ||
    location.pathname.startsWith("/community") ||
    location.pathname.startsWith("/map") ||
    location.pathname.startsWith("/fairytales") ||
    location.pathname.startsWith("/characters") ||
    location.pathname.startsWith("/artifacts") ||
    location.pathname.startsWith("/logs");
  const hasPlaylistItems = playlist.length > 0;
  const shellStyle = isCosmosFullScreenRoute || isReaderRoute
    ? undefined
    : {
        paddingLeft: "max(env(safe-area-inset-left), 0.7rem)",
        paddingRight: "max(env(safe-area-inset-right), 0.7rem)",
      };

  return (
    <div className="min-h-screen text-foreground flex flex-col md:flex-row">
      <SignedIn>
        {!isCosmosFullScreenRoute && (
          <>
            <div className="hidden md:block w-[72px] flex-shrink-0" />
            <Sidebar />
          </>
        )}
      </SignedIn>

      <main className="flex-1 min-h-screen transition-all duration-300">
        <div
          style={shellStyle}
          className={
            isCosmosFullScreenRoute || isReaderRoute
              ? "w-full min-h-screen p-0 m-0 max-w-none"
              : usesImmersiveShell
                ? "w-full mx-auto max-w-none pb-20 md:pb-10"
                : `w-full mx-auto pb-20 md:pb-10 ${
                    isSettingsRoute ? "md:pt-6 md:px-5 max-w-[1520px]" : "md:pt-8 md:px-8 max-w-[1260px]"
                  }`
          }
        >
          <Outlet />
        </div>
      </main>

      <SignedIn>
        {!isCosmosFullScreenRoute && <ProfileSwitcher />}
        {showSettingsButton && !isCosmosFullScreenRoute && (
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="fixed right-3 top-3 z-[95] inline-flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-lg md:hidden transition-colors"
            aria-label="Einstellungen"
            style={{
              borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              color: isDark ? "var(--talea-text-primary)" : "var(--talea-text-secondary)",
              background: isDark ? "rgba(17,19,23,0.88)" : "rgba(255,255,255,0.88)",
              boxShadow: isDark
                ? "0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15)"
                : "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
            }}
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </SignedIn>

      <GlobalAudioPlayer />

      {/* Floating playlist button */}
      <SignedIn>
        <AnimatePresence>
          {hasPlaylistItems && (
            !isCosmosFullScreenRoute && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={togglePlaylistDrawer}
                className="fixed z-[96] inline-flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-lg left-3 top-3 md:left-auto md:top-auto md:right-5 md:bottom-5 transition-colors"
                aria-label="Wiedergabeliste"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  color: isDark ? 'var(--talea-text-primary)' : 'var(--talea-text-secondary)',
                  background: isDark ? 'rgba(17,19,23,0.88)' : 'rgba(255,255,255,0.88)',
                  boxShadow: isDark
                    ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15)'
                    : '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
                }}
              >
                <Headphones className="h-4 w-4" />
                {playlist.length > 0 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold bg-[var(--primary)] text-white"
                  >
                    {playlist.length}
                  </span>
                )}
              </motion.button>
            )
          )}
        </AnimatePresence>
      </SignedIn>

      <SignedIn>
        {!isCosmosFullScreenRoute && <BottomNav />}
      </SignedIn>
    </div>
  );
};

export default AppLayout;
