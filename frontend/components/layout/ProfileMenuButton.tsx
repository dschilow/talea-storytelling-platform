import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Compass, Headphones, Plus, Settings, Star } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type ProfileDetails, useChildProfiles } from "@/contexts/ChildProfilesContext";
import { useBackend } from "@/hooks/useBackend";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useWelcomeTour } from "@/hooks/useWelcomeTour";

/**
 * ProfileMenuButton
 * -----------------
 * Single combined entry point (top-right) for: switching the active child
 * profile, opening Settings, and opening the audio playlist. Replaces the
 * previous separate ProfileSwitcher pill (bottom-left) and Settings gear
 * button — one icon, one place, fewer floating buttons on screen.
 *
 * Visual: the active profile's round picture, like the account button in iOS
 * apps.
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
  className: string;
};

const ProfileAvatarBadge: React.FC<ProfileAvatarBadgeProps> = ({
  profile,
  imageUrl,
  isLoading,
  className,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden font-bold text-white ${className}`}
      style={{
        background: profile.avatarColor || "var(--talea-brand-terracotta)",
      }}
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
  const reduceMotion = useReducedMotion();
  const { isLoading, profiles, profileLimit, activeProfileId, activeProfile, setActiveProfileId } =
    useChildProfiles();
  const { playlist, togglePlaylistDrawer } = useAudioPlayer();
  const { reset: restartWelcomeTour } = useWelcomeTour();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('button[aria-checked="true"], button[role="menuitem"]')?.focus();
    });
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

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

  const menuRow =
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[var(--talea-surface-inset)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]";
  const menuIcon =
    "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--talea-surface-inset)] text-[var(--talea-text-secondary)]";

  const go = (action: () => void) => () => {
    setOpen(false);
    triggerRef.current?.focus();
    action();
  };

  // Positioned by AppLayout (top bar), never floating over page content.
  return (
    <div ref={rootRef} className="relative z-[97]">
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`${selected.name} — Profil, Einstellungen und Wiedergabeliste`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? "talea-profile-menu" : undefined}
        title={selected.name}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--talea-surface-primary)] ring-1 ring-[var(--talea-border-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        transition={{ type: "spring", stiffness: 460, damping: 30 }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <ProfileAvatarBadge
          profile={selected}
          imageUrl={profileImageUrls[selected.id]}
          isLoading={Boolean(selected.childAvatarId && profileImageUrls[selected.id] === undefined)}
          className="h-full w-full rounded-full text-[13px]"
        />
      </motion.button>

      <AnimatePresence initial={false}>
      {open && (
        <motion.div
          ref={menuRef}
          id="talea-profile-menu"
          role="menu"
          data-talea-android-back="escape"
          aria-label="Profil und Einstellungen"
          initial={reduceMotion ? false : { opacity: 0, y: -5, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -3, scale: 0.98 }}
          transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
          className="absolute right-0 top-full mt-3 w-[300px] max-w-[calc(100vw-2rem)] origin-top-right rounded-3xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-2 text-[var(--talea-text-primary)] shadow-[var(--talea-shadow-strong)]"
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              setOpen(false);
              return;
            }
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role^="menuitem"]'));
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
          }}
        >
          <div className="px-2.5 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--talea-text-tertiary)]">
            Kinderprofile · {profiles.length}/{profileLimit}
          </div>

          <div>
            {profiles.map((profile) => {
              const selectedProfile = profile.id === selected.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  role="menuitemradio"
                  tabIndex={-1}
                  aria-checked={selectedProfile}
                  onClick={go(() => setActiveProfileId(profile.id))}
                  className={`${menuRow} ${selectedProfile ? "bg-[var(--talea-accent-terracotta-soft)]" : ""}`}
                >
                  <ProfileAvatarBadge
                    profile={profile}
                    imageUrl={profileImageUrls[profile.id]}
                    isLoading={Boolean(profile.childAvatarId && profileImageUrls[profile.id] === undefined)}
                    className="h-8 w-8 rounded-full text-[11px]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{profile.name}</span>
                    <span className="block truncate text-[13px] text-[var(--talea-text-secondary)]">
                      {profile.readingLevel || "Lesestufe offen"}
                    </span>
                  </span>
                  {profile.isDefault && <Star className="h-4 w-4 text-[#F59E0B]" aria-label="Standardprofil" />}
                  {selectedProfile && <Check className="h-4 w-4 text-[var(--primary)]" aria-hidden />}
                </button>
              );
            })}
            <button type="button" role="menuitem" tabIndex={-1} onClick={go(() => navigate("/settings"))} className={menuRow}>
              <span className={menuIcon}>
                <Plus className="h-4 w-4" />
              </span>
              <span className="font-medium text-[var(--primary)]">Profile verwalten</span>
            </button>
          </div>

          <div className="my-1.5 h-px bg-[var(--talea-border-light)]" />

          <div>
            <button type="button" role="menuitem" tabIndex={-1} onClick={go(togglePlaylistDrawer)} className={menuRow}>
              <span className={menuIcon}>
                <Headphones className="h-4 w-4" />
                {playlist.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-bold text-[var(--primary-foreground)]">
                    {playlist.length}
                  </span>
                )}
              </span>
              <span className="font-medium">Wiedergabeliste</span>
            </button>
            <button type="button" role="menuitem" tabIndex={-1} onClick={go(restartWelcomeTour)} className={menuRow}>
              <span className={menuIcon}>
                <Compass className="h-4 w-4" />
              </span>
              <span className="font-medium">Rundgang starten</span>
            </button>
            <button type="button" role="menuitem" tabIndex={-1} onClick={go(() => navigate("/settings"))} className={menuRow}>
              <span className={menuIcon}>
                <Settings className="h-4 w-4" />
              </span>
              <span className="font-medium">Einstellungen</span>
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileMenuButton;
