import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Edit, Eye, Plus, Search, Share2, Sparkles, Trash2, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useBackend } from "../../hooks/useBackend";
import type { Avatar } from "../../types/avatar";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useOptionalChildProfiles } from "@/contexts/ChildProfilesContext";
import {
  TaleaActionButton,
  TaleaMetricPill,
  TaleaPageBackground,
  taleaBodyFont,
  taleaChipClass,
  taleaDisplayFont,
  taleaInputClass,
  taleaPageShellClass,
  taleaSurfaceClass,
  taleaToolbarClass,
} from "@/components/talea/TaleaPastelPrimitives";

type Palette = {
  pageGradient: string;
  haloA: string;
  haloB: string;
  panel: string;
  card: string;
  cardHover: string;
  border: string;
  text: string;
  textMuted: string;
  soft: string;
  action: string;
  actionText: string;
};

const headingFont = taleaDisplayFont;
const bodyFont = taleaBodyFont;

function getPalette(_isDark: boolean): Palette {
  return {
    pageGradient: "var(--talea-page)",
    haloA: "var(--talea-gradient-primary)",
    haloB: "var(--talea-gradient-lavender)",
    panel: "var(--talea-surface-primary)",
    card: "var(--talea-surface-primary)",
    cardHover: "var(--talea-surface-elevated)",
    border: "var(--talea-border-light)",
    text: "var(--talea-text-primary)",
    textMuted: "var(--talea-text-secondary)",
    soft: "var(--talea-surface-inset)",
    action: "linear-gradient(135deg,var(--primary) 0%, color-mix(in srgb, var(--talea-accent-sky) 72%, white) 100%)",
    actionText: "var(--primary-foreground)",
  };
}

const AvatarsBackground: React.FC<{ isDark: boolean }> = ({ isDark }) => <TaleaPageBackground isDark={isDark} />;

const LoadingSkeleton: React.FC<{ palette: Palette }> = ({ palette }) => (
  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="overflow-hidden rounded-3xl border animate-pulse"
        style={{ borderColor: palette.border, background: palette.soft }}
      >
        <div className="aspect-[3/4]" />
      </div>
    ))}
  </div>
);

const EmptyAvatars: React.FC<{ onCreate: () => void; palette: Palette; title: string; description: string; cta: string }> = ({
  onCreate,
  palette,
  title,
  description,
  cta,
}) => (
  <div className="rounded-3xl border p-10 text-center" style={{ borderColor: palette.border, background: palette.panel }}>
    <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: palette.soft }}>
      <Sparkles className="h-8 w-8" style={{ color: palette.textMuted }} />
    </div>
    <h2 className="text-3xl" style={{ color: palette.text, fontFamily: headingFont }}>
      {title}
    </h2>
    <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: palette.textMuted }}>
      {description}
    </p>
    <button
      type="button"
      onClick={onCreate}
      className="mt-6 inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold shadow-[0_10px_22px_rgba(51,62,79,0.16)]"
      style={{ borderColor: palette.border, background: palette.action, color: palette.actionText }}
    >
      <Plus className="h-4 w-4" />
      {cta}
    </button>
  </div>
);

const AvatarCard: React.FC<{
  avatar: Avatar;
  index: number;
  palette: Palette;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ avatar, index, palette, onView, onEdit, onDelete }) => {
  const canManage = avatar.isOwnedByCurrentUser ?? true;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: index * 0.03 }}
      whileHover={{ y: -5 }}
      className="group"
    >
      <button
        type="button"
        onClick={onView}
        className="w-full overflow-hidden rounded-3xl border text-left shadow-[0_12px_28px_rgba(33,44,62,0.12)] transition-colors"
        style={{ borderColor: palette.border, background: palette.card }}
      >
        <div className="relative aspect-[3/4] overflow-hidden" style={{ background: palette.soft }}>
          {avatar.imageUrl ? (
            <img src={avatar.imageUrl} alt={avatar.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User className="h-20 w-20" style={{ color: palette.textMuted }} />
            </div>
          )}

          <div className="absolute inset-0" style={{ background: "var(--talea-media-overlay)" }} />

          <span
            className="absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderColor: "var(--talea-media-chrome-border)",
              background: "var(--talea-media-chrome-bg)",
              color: "var(--talea-media-foreground)",
            }}
          >
            {avatar.creationType === "photo-upload" ? "Foto" : "AI"}
          </span>

          {avatar.avatarRole === "child" ? (
            <span
              className="absolute left-3 top-10 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: "var(--talea-media-chrome-border)",
                background: "var(--talea-media-chrome-bg)",
                color: "var(--talea-media-foreground)",
              }}
            >
              Kind
            </span>
          ) : null}

          {!canManage ? (
            <span
              className={`absolute left-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                avatar.avatarRole === "child" ? "top-[4.5rem]" : "top-10"
              }`}
              style={{
                borderColor: "var(--talea-media-chrome-border)",
                background: "var(--talea-media-chrome-bg)",
                color: "var(--talea-media-foreground)",
              }}
            >
              <Share2 className="h-3 w-3" />
              Geteilt
            </span>
          ) : null}

          {canManage ? (
            <div className="absolute right-3 top-3 flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                className="rounded-xl border p-2"
                style={{ borderColor: palette.border, background: palette.panel, color: palette.text }}
                aria-label={`${avatar.name} bearbeiten`}
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                className="rounded-xl border p-2"
                style={{
                  borderColor: "var(--talea-danger-border)",
                  background: "var(--talea-danger-soft)",
                  color: "var(--talea-danger)",
                }}
                aria-label={`${avatar.name} loeschen`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div
            className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border px-2.5 py-2"
            style={{
              borderColor: "var(--talea-media-chrome-border)",
              background: "var(--talea-media-chrome-bg)",
            }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--talea-media-foreground)]">{avatar.name}</p>
              <p className="truncate text-xs text-white/72">
                {(!canManage && avatar.sharedBy?.name) || (!canManage && avatar.sharedBy?.email)
                  ? `Geteilt von ${avatar.sharedBy?.name || avatar.sharedBy?.email}`
                  : avatar.description || "Avatar ohne Beschreibung"}
              </p>
            </div>
            <Eye className="ml-2 h-4 w-4 text-white/85" />
          </div>
        </div>
      </button>
    </motion.article>
  );
};

const TaleaAvatarsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();
  const { user, isLoaded, isSignedIn } = useUser();
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const childProfiles = useOptionalChildProfiles();
  const activeProfileId = childProfiles?.activeProfileId;
  const activeProfile = childProfiles?.activeProfile ?? null;

  const isDark = resolvedTheme === "dark";
  const palette = useMemo(() => getPalette(isDark), [isDark]);

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeControl, setActiveControl] = useState<string | null>(null);
  const needsChildAvatar = Boolean(activeProfile && !activeProfile.childAvatarId);

  const openCreateAvatar = (mode: "child" | "companion" = "companion") => {
    if (mode === "child") {
      const query = activeProfileId ? `?mode=child&profileId=${encodeURIComponent(activeProfileId)}` : "?mode=child";
      navigate(`/avatar/create${query}`);
      return;
    }

    navigate("/avatar/create");
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setAvatars([]);
      setIsLoading(false);
      return;
    }
    void loadAvatars();
  }, [isLoaded, isSignedIn, user?.id, backend, activeProfileId]);

  useEffect(() => {
    if (location.state?.refresh) {
      void loadAvatars();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadAvatars = async () => {
    try {
      setIsLoading(true);
      const response = await backend.avatar.list({ profileId: activeProfileId || undefined });
      setAvatars((response as any)?.avatars || []);
    } catch (error) {
      console.error("Failed to load avatars:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAvatar = async (avatar: Avatar) => {
    if (avatar.isOwnedByCurrentUser === false) {
      toast.error("Geteilte Avatare koennen nicht geloescht werden.");
      return;
    }

    if (!window.confirm(t("common.confirm", "Wirklich loeschen?"))) return;

    try {
      await backend.avatar.deleteAvatar({ id: avatar.id, profileId: activeProfileId || undefined });
      if (avatar.avatarRole === "child") {
        await childProfiles?.refresh();
      }
      setAvatars((prev) => prev.filter((item) => item.id !== avatar.id));
    } catch (error) {
      console.error("Failed to delete avatar:", error);
    }
  };

  const filteredAvatars = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return avatars;
    return avatars.filter((avatar) => avatar.name.toLowerCase().includes(query));
  }, [avatars, searchQuery]);
  const ownedCount = avatars.filter((avatar) => avatar.isOwnedByCurrentUser !== false).length;
  const sharedCount = avatars.length - ownedCount;
  const controlHover = reduceMotion ? undefined : { y: -2, scale: 1.01 };
  const controlFocusRing = (controlId: string) =>
    activeControl === controlId
      ? "0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent)"
      : "0 0 0 0 transparent";

  return (
    <div className="relative min-h-screen pb-28" style={{ color: palette.text, fontFamily: bodyFont }}>
      <AvatarsBackground isDark={isDark} />

      <SignedOut>
        <div className={cn(taleaPageShellClass, "flex min-h-[68vh] items-center justify-center py-10")}>
          <div className={cn(taleaSurfaceClass, "w-full max-w-2xl p-8 text-center")}>
            <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: palette.soft }}>
              <User className="h-7 w-7" style={{ color: palette.textMuted }} />
            </div>
            <h2 className="text-3xl" style={{ color: palette.text, fontFamily: headingFont }}>
              {t("errors.unauthorized", "Bitte melde dich an")}
            </h2>
            <TaleaActionButton type="button" onClick={() => navigate("/auth")} className="mt-5">
              {t("auth.signIn", "Anmelden")}
            </TaleaActionButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className={cn(taleaPageShellClass, "relative z-10 space-y-5 pt-3")}>
          <header className={cn(taleaSurfaceClass, "overflow-hidden p-3 sm:p-4 md:p-5")}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <div className="min-w-0">
                <span className={taleaChipClass}>Avatare</span>

                <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <h1
                    className="text-[1.85rem] font-semibold leading-[0.98] text-[var(--talea-text-primary)] sm:text-[2.15rem]"
                    style={{ fontFamily: headingFont }}
                  >
                    Avatare
                  </h1>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <TaleaActionButton
                      type="button"
                      onClick={() => openCreateAvatar(needsChildAvatar ? "child" : "companion")}
                      icon={<Plus className="h-4 w-4" />}
                    >
                      {needsChildAvatar ? "Kind-Avatar" : t("avatar.create", "Neuer Avatar")}
                    </TaleaActionButton>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 xl:w-[26rem] xl:grid-cols-5">
                {[
                  { label: "Gesamt", value: String(avatars.length) },
                  { label: "Sichtbar", value: String(filteredAvatars.length) },
                  { label: "Geteilt", value: String(sharedCount) },
                  { label: "Eigene", value: String(ownedCount) },
                  { label: "Kind", value: activeProfile?.childAvatarId ? "Bereit" : "Fehlt" },
                ].map((metric) => (
                  <motion.div key={metric.label} whileHover={controlHover} transition={{ type: "spring", stiffness: 320, damping: 24 }}>
                    <TaleaMetricPill label={metric.label} value={metric.value} />
                  </motion.div>
                ))}
              </div>
            </div>

            <div className={cn(taleaToolbarClass, "mt-4")}>
              <motion.label
                className="relative min-w-0 flex-1"
                whileHover={controlHover}
                animate={{ boxShadow: controlFocusRing("avatar-search") }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
              >
                <motion.div
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--talea-text-muted)]"
                  animate={activeControl === "avatar-search" && !reduceMotion ? { x: 1.5, scale: 1.06 } : { x: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 340, damping: 24 }}
                >
                  <Search className="h-4 w-4" />
                </motion.div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setActiveControl("avatar-search")}
                  onBlur={() => setActiveControl((current) => (current === "avatar-search" ? null : current))}
                  placeholder="Avatare durchsuchen..."
                  className={cn(taleaInputClass, "pl-10")}
                />
              </motion.label>
            </div>
          </header>

          {isLoading ? (
            <LoadingSkeleton palette={palette} />
          ) : filteredAvatars.length === 0 && avatars.length === 0 ? (
            <EmptyAvatars
              onCreate={() => openCreateAvatar(needsChildAvatar ? "child" : "companion")}
              palette={palette}
              title={needsChildAvatar ? "Kind-Avatar fehlt" : t("homePage.emptyAvatarsTitle", "Noch keine Avatare")}
              description={
                needsChildAvatar
                  ? "Lege zuerst den festen Kind-Avatar an. Danach kannst du beliebige Zusatz-Avatare fuer Geschichten erstellen."
                  : t("homePage.emptyAvatarsDesc", "Erstelle deinen ersten Avatar fuer Geschichten und Dokus.")
              }
              cta={needsChildAvatar ? "Kind-Avatar erstellen" : t("avatar.createNew", "Ersten Avatar erstellen")}
            />
          ) : filteredAvatars.length === 0 ? (
            <div className="rounded-3xl border p-10 text-center" style={{ borderColor: palette.border, background: palette.panel }}>
              <h2 className="text-3xl" style={{ color: palette.text, fontFamily: headingFont }}>
                Keine Treffer
              </h2>
              <p className="mt-2 text-sm" style={{ color: palette.textMuted }}>
                Kein Avatar passt zu "{searchQuery}".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filteredAvatars.map((avatar, index) => (
                <AvatarCard
                  key={avatar.id}
                  avatar={avatar}
                  index={index}
                  palette={palette}
                  onView={() => navigate(`/avatar/${avatar.id}`)}
                  onEdit={() => navigate(`/avatar/edit/${avatar.id}`)}
                  onDelete={() => void handleDeleteAvatar(avatar)}
                />
              ))}
            </div>
          )}
        </div>
      </SignedIn>
    </div>
  );
};

export default TaleaAvatarsScreen;
