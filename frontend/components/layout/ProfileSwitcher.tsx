import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Plus, Star, Users } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useChildProfiles } from "@/contexts/ChildProfilesContext";

function profileInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return "K";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

const ProfileSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { isLoading, profiles, profileLimit, activeProfileId, activeProfile, setActiveProfileId } =
    useChildProfiles();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const hasProfiles = profiles.length > 0;
  const selected = useMemo(
    () => activeProfile || profiles.find((entry) => entry.id === activeProfileId) || null,
    [activeProfile, activeProfileId, profiles]
  );

  if (isLoading || !hasProfiles || !selected) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className="fixed left-1/2 top-3 z-[97] -translate-x-1/2 md:left-auto md:right-5 md:top-4 md:translate-x-0"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm backdrop-blur-xl shadow-lg"
        style={{
          borderColor: isDark ? "#3d5575" : "var(--primary)",
          background: isDark ? "rgba(24,36,55,0.9)" : "rgba(255,250,243,0.92)",
          color: isDark ? "#d8e5f8" : "#3b332d",
          boxShadow: isDark ? "0 10px 24px rgba(6,12,20,0.5)" : "0 10px 24px rgba(116,95,78,0.2)",
        }}
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-[11px] font-bold"
          style={{
            background: selected.avatarColor || (isDark ? "#506d91" : "var(--primary)"),
            color: "#fff",
          }}
        >
          {profileInitials(selected.name)}
        </span>
        <span className="max-w-[112px] truncate font-semibold">{selected.name}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="mt-2 w-[280px] rounded-2xl border p-2 shadow-2xl"
          style={{
            borderColor: isDark ? "#3d5575" : "var(--primary)",
            background: isDark ? "rgba(20,31,47,0.96)" : "rgba(255,249,240,0.98)",
            color: isDark ? "#d8e5f8" : "#3b332d",
          }}
        >
          <div className="mb-2 px-2 py-1 text-[11px] uppercase tracking-[0.14em] opacity-70">
            Kinderprofile ({profiles.length}/{profileLimit})
          </div>

          <div className="space-y-1">
            {profiles.map((profile) => {
              const selectedProfile = profile.id === selected.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => {
                    setActiveProfileId(profile.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                    selectedProfile ? "ring-1 ring-[#A989F2]/60" : ""
                  }`}
                  style={{
                    background: selectedProfile
                      ? isDark
                        ? "rgba(105,130,164,0.22)"
                        : "rgba(111,174,156,0.14)"
                      : isDark
                      ? "rgba(34,50,72,0.45)"
                      : "rgba(255,255,255,0.6)",
                  }}
                >
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                    style={{ background: profile.avatarColor || (isDark ? "#506d91" : "var(--primary)") }}
                  >
                    {profileInitials(profile.name)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{profile.name}</span>
                    <span className="block truncate text-xs opacity-70">
                      {profile.readingLevel || "Lesestufe offen"}
                    </span>
                  </span>

                  {profile.isDefault && <Star className="h-4 w-4 text-[#F59E0B]" />}
                </button>
              );
            })}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/settings");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"
              style={{
                borderColor: isDark ? "#4a5f7f" : "#d8c9bc",
                background: isDark ? "rgba(37,56,80,0.6)" : "rgba(255,255,255,0.7)",
              }}
            >
              <Users className="h-3.5 w-3.5" />
              Verwalten
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/settings");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#A989F2] to-[#FF6B9D] px-3 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Neu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSwitcher;
