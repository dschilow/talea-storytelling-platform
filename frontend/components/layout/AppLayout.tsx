import React from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { SignedIn } from "@clerk/clerk-react";
import { Headphones, Settings } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { GlobalAudioPlayer } from "../audio/GlobalAudioPlayer";
import { useTheme } from "@/contexts/ThemeContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const { playlist, togglePlaylistDrawer } = useAudioPlayer();
  const isDark = resolvedTheme === "dark";
  const showSettingsButton = location.pathname !== "/settings";
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const hasPlaylistItems = playlist.length > 0;

  return (
    <div className="min-h-screen text-foreground flex flex-col md:flex-row">
      <SignedIn>
        <div className="hidden md:block w-[88px] flex-shrink-0" />
        <Sidebar />
      </SignedIn>

      <main className="flex-1 min-h-screen transition-all duration-300">
        <div
          className={`pb-20 md:pb-10 px-4 w-full mx-auto ${
            isSettingsRoute ? "md:pt-6 md:px-6 max-w-[1480px]" : "md:pt-10 md:px-10 max-w-[1120px]"
          }`}
        >
          <Outlet />
        </div>
      </main>

      <SignedIn>
        {showSettingsButton && (
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="fixed right-3 top-3 z-[95] inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur md:hidden"
            aria-label="Einstellungen"
            style={{
              borderColor: isDark ? "#355072" : "#d5bdaf",
              color: isDark ? "#e8f1fe" : "#3b332d",
              background: isDark ? "rgba(21,32,47,0.84)" : "rgba(255,250,243,0.86)",
              boxShadow: isDark ? "0 8px 18px rgba(8,13,22,0.38)" : "0 8px 18px rgba(116,95,78,0.2)",
            }}
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </SignedIn>

      <GlobalAudioPlayer />

      {/* Floating player/playlist button — mobile: top-left, desktop: bottom-right */}
      <SignedIn>
        <AnimatePresence>
          {hasPlaylistItems && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={togglePlaylistDrawer}
              className="fixed z-[96] inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-lg left-3 top-3 md:left-auto md:top-auto md:right-5 md:bottom-5"
              aria-label="Wiedergabeliste"
              style={{
                borderColor: isDark ? '#3d5575' : '#d5bdaf',
                color: isDark ? '#c4d5ed' : '#5a4a3e',
                background: isDark ? 'rgba(27,38,56,0.88)' : 'rgba(255,248,240,0.9)',
                boxShadow: isDark ? '0 8px 20px rgba(8,13,22,0.4)' : '0 8px 20px rgba(116,95,78,0.22)',
              }}
            >
              <Headphones className="h-4 w-4" />
              {playlist.length > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    background: isDark
                      ? 'linear-gradient(135deg, #86a7db, #b084c7)'
                      : 'linear-gradient(135deg, #d5bdaf, #b183c4)',
                    color: isDark ? '#0f1722' : '#fff',
                  }}
                >
                  {playlist.length}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </SignedIn>

      <SignedIn>
        <BottomNav />
      </SignedIn>
    </div>
  );
};

export default AppLayout;
