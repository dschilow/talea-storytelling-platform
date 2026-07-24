import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Headphones, Plus, Settings, Star, Users } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { type ProfileDetails, useChildProfiles } from "@/contexts/ChildProfilesContext";
import { useBackend } from "@/hooks/useBackend";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

/**
 * ProfileMenuButton
 * -----------------
 * Single combined entry point (top-right) for: switching the active child
 * profile, opening Settings, and opening the audio playlist. Replaces the
 * previous separate ProfileSwitcher pill (bottom-left) and Settings gear
 * button — one icon, one place, fewer floating buttons on screen.
 *
 * Visual: the active profile's picture/initials badge, with a small gear
 * overlaid bottom-right so it still reads as "this is also Settings".
 */

function profileInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return "K";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

type ProfileAvatarBadgeProps = {
  profile: Pick<ProfileDetails, "name" | "avatarColor">;
  imageUrl: string | null | undefined;
  isLoading: boolean;
  isDark: boolean;
  className: string;
};

const ProfileAvatarBadge: React.FC<ProfileAvatarBadgeProps> = ({
  profile,
  imageUrl,
  isLoading,
  isDark,
  className,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden font-bold text-white ${className}`}
      style={{ background: profile.avatarColor || (isDark ? "#506d91" : "var(--primary)") }}
      aria-hidden="true"
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      ) : isLoading ? (
        <span className="h-full w-full animate-pulse bg-white/25" />
      ) : (
        profileInitials(profile.name)
      )}
    </span>
  );
};

const ProfileMenuButton: React.FC = () => {
  const [profileImageUrls, setProfileImageUrls] = useState<Record<string, string | null>>({});
  const navigate = useNavigate();
  const backend = useBackend();
  const { resolvedTheme } = useTheme();
  const { isLoading, profiles, profileLimit, activeProfileId, activeProfile, setActiveProfileId } =
    useChildProfiles();
  const { playlist, togglePlaylistDrawer } = useAudioPlayer();

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

  useEffect(() => {
    let active = true;
    setProfileImageUrls({});

    void Promise.all(
      profiles.map(async (profile): Promise<[string, string | null]> => {
        if (!profile.childAvatarId) return [profile.id, null];

        try {
          const avatar = (await backend.avatar.get({
            id: profile.childAvatarId,
            profileId: profile.id,
          })) as { imageUrl?: string };
          return [profile.id, avatar.imageUrl || null];
        } catch (error) {
          console.warn(`Profilbild fuer ${profile.name} konnte nicht geladen werden.`, error);
          return [profile.id, null];
        }
      })
    ).then((entries) => {
      if (!active) return;
      setProfileImageUrls(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [backend, profiles]);

  const hasProfiles = profiles.length > 0;
  const selected = useMemo(
    () => activeProfile || profiles.find((entry) => entry.id === activeProfileId) || null,
    [activeProfile, activeProfileId, profiles]
  );

  if (isLoading || !hasProfiles || !selected) {
    return null;
  }

  return (
    <div ref={rootRef} className="fixed right-3 top-3 z-[97]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`${selected.name} — Profil, Einstellungen und Wiedergabeliste`}
        title={selected.name}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border shadow-[var(--talea-shadow-soft)] backdrop-blur-xl transition-colors"
        style={{
          borderColor: "var(--talea-border-light)",
          background: isDark ? "rgba(19,27,37,0.88)" : "rgba(255,251,247,0.88)",
        }}
      >
        <ProfileAvatarBadge
          profile={selected}
          imageUrl={profileImageUrls[selected.id]}
          isLoading={Boolean(selected.childAvatarId && profileImageUrls[selected.id] === undefined)}
          isDark={isDark}
          className="h-full w-full rounded-2xl text-[12px]"
        />

        {/* Small gear overlay so the same icon still reads as "Settings, too". */}
        <span
          className="absolute -bottom-1 -right-1 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border shadow-sm"
          style={{
            borderColor: "var(--talea-border-light)",
            background: isDark ? "rgba(31,44,61,0.95)" : "rgba(255,255,255,0.95)",
            color: isDark ? "var(--talea-text-primary)" : "var(--talea-text-secondary)",
          }}
          aria-hidden="true"
        >
          <Settings className="h-[11px] w-[11px]" />
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[292px] max-w-[calc(100vw-1.5rem)] rounded-[1.6rem] border p-2 shadow-[var(--talea-shadow-medium)] backdrop-blur-2xl"
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
                  <ProfileAvatarBadge
                    profile={profile}
                    imageUrl={profileImageUrls[profile.id]}
                    isLoading={Boolean(profile.childAvatarId && profileImageUrls[profile.id] === undefined)}
                    isDark={isDark}
                    className="h-8 w-8 rounded-xl text-[11px]"
                  />

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
                background:
                  "linear-gradient(135deg,var(--primary) 0%, color-mix(in srgb, var(--talea-accent-sky) 70%, white) 100%)",
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Neu
            </button>
          </div>

          <div className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: "var(--talea-border-light)" }}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/settings");
              }}
              className="flex w-full items-center gap-3 rounded-[1.2rem] px-2.5 py-2.5 text-left transition"
              style={{ background: isDark ? "rgba(24,32,44,0.64)" : "rgba(255,255,255,0.64)" }}
            >
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: isDark ? "rgba(66,90,118,0.45)" : "var(--talea-surface-inset)",
                  color: isDark ? "var(--talea-text-primary)" : "var(--talea-text-secondary)",
                }}
              >
                <Settings className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">Einstellungen</span>
            </button>

            {playlist.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  togglePlaylistDrawer();
                }}
                className="flex w-full items-center gap-3 rounded-[1.2rem] px-2.5 py-2.5 text-left transition"
                style={{ background: isDark ? "rgba(24,32,44,0.64)" : "rgba(255,255,255,0.64)" }}
              >
                <span
                  className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: isDark ? "rgba(66,90,118,0.45)" : "var(--talea-surface-inset)",
                    color: isDark ? "var(--talea-text-primary)" : "var(--talea-text-secondary)",
                  }}
                >
                  <Headphones className="h-4 w-4" />
                  <span
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: "var(--primary)" }}
                  >
                    {playlist.length}
                  </span>
                </span>
                <span className="text-sm font-semibold">Wiedergabeliste</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileMenuButton;
