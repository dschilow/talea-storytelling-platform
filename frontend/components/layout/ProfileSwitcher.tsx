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
        className="inline-flex items-center gap-2 rounded-[1.35rem] border px-3 py-2 text-sm backdrop-blur-2xl shadow-[var(--talea-shadow-soft)]"
        style={{
          borderColor: "var(--talea-border-light)",
          background: isDark ? "rgba(19,27,37,0.88)" : "rgba(255,251,247,0.88)",
          color: "var(--talea-text-primary)",
        }}
      >
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-[0.95rem] text-[11px] font-bold shadow-[0_8px_18px_rgba(91,72,59,0.1)]"
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
          className="mt-2 w-[292px] rounded-[1.6rem] border p-2 shadow-[var(--talea-shadow-medium)] backdrop-blur-2xl"
          style={{
            borderColor: "var(--talea-border-light)",
            background: isDark ? "rgba(19,27,37,0.96)" : "rgba(255,251,247,0.96)",
            color: "var(--talea-text-primary)",
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
                  className={`flex w-full items-center gap-3 rounded-[1.2rem] px-2.5 py-2.5 text-left transition ${
                    selectedProfile ? "ring-1 ring-[var(--talea-border-accent)]" : ""
                  }`}
                  style={{
                    background: selectedProfile
                      ? isDark
                        ? "rgba(154,199,182,0.12)"
                        : "rgba(123,168,156,0.12)"
                      : isDark
                      ? "rgba(24,32,44,0.64)"
                      : "rgba(255,255,255,0.64)",
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
              className="inline-flex items-center justify-center gap-2 rounded-[1rem] border px-3 py-2 text-xs font-semibold"
              style={{
                borderColor: "var(--talea-border-light)",
                background: isDark ? "rgba(24,32,44,0.72)" : "rgba(255,255,255,0.72)",
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
              className="inline-flex items-center justify-center gap-2 rounded-[1rem] px-3 py-2 text-xs font-semibold text-white"
              style={{
                background: "linear-gradient(135deg,var(--primary) 0%, color-mix(in srgb, var(--talea-accent-sky) 70%, white) 100%)",
              }}
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
