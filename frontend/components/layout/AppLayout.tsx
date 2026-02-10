import React from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { SignedIn } from "@clerk/clerk-react";
import { Settings } from "lucide-react";

import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { GlobalAudioPlayer } from "../audio/GlobalAudioPlayer";
import { useTheme } from "@/contexts/ThemeContext";

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const showSettingsButton = location.pathname !== "/settings";
  const isSettingsRoute = location.pathname.startsWith("/settings");

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

      <SignedIn>
        <BottomNav />
      </SignedIn>
    </div>
  );
};

export default AppLayout;
