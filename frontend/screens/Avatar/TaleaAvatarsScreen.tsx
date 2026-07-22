import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, BadgeCheck, BookOpen, Copy, Edit, Eye, LoaderCircle, Plus, Search, Sparkles, Trash2, User, UsersRound } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useBackend } from "../../hooks/useBackend";
import CharacterProfilesPanel from "../CharacterPool/CharacterProfilesPanel";
import type { Avatar } from "../../types/avatar";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useOptionalChildProfiles } from "@/contexts/ChildProfilesContext";
import ConceptHelp from "@/components/avatar/ConceptHelp";
import {
  TaleaActionButton,
  TaleaPageBackground,
  taleaBodyFont,
  taleaChipClass,
  taleaDisplayFont,
  taleaInputClass,
  taleaPageShellClass,
  taleaSurfaceClass,
  taleaToolbarClass,
} from "@/components/talea/TaleaPastelPrimitives";

type AvatarContentTab = "avatars" | "characters";

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
  profileName?: string;
  isChildAvatar: boolean;
  canBecomeChild: boolean;
  assigningChild: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssignChild: () => void;
}> = ({
  avatar,
  index,
  palette,
  profileName,
  isChildAvatar,
  canBecomeChild,
  assigningChild,
  onView,
  onEdit,
  onDelete,
  onAssignChild,
}) => {
  const canManage = avatar.isOwnedByCurrentUser ?? true;
  const { t } = useTranslation();
  const isFamilyCopy = avatar.sourceType === "clone" || Boolean(avatar.sourceAvatarId);
  const scopeLabel = isChildAvatar
    ? `Kind-Avatar von ${profileName || avatar.name}`
    : isFamilyCopy
      ? "Familienkopie mit eigener Entwicklung"
      : `Begleiter nur f\u00fcr ${profileName || "dieses Profil"}`;

  const narrativeProfile = avatar.narrativeProfile;
  const profileTrait = narrativeProfile?.dominantPersonality || narrativeProfile?.traits?.[0];
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: index * 0.025 }}
      whileHover={{ y: -3 }}
      className="overflow-hidden rounded-3xl border shadow-[0_12px_28px_rgba(33,44,62,0.10)]"
      style={{ borderColor: palette.border, background: palette.card }}
    >
      <button
        type="button"
        onClick={onView}
        className="group relative block w-full overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--primary)]"
        aria-label={`Profil von ${avatar.name} \u00f6ffnen`}
      >
        <div className="relative aspect-[4/3] overflow-hidden" style={{ background: palette.soft }}>
          {avatar.imageUrl ? (
            <img
              src={avatar.imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User className="h-20 w-20" style={{ color: palette.textMuted }} />
            </div>
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,transparent 45%,rgba(18,28,39,.68) 100%)" }} />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span
              className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{
                borderColor: "var(--talea-media-chrome-border)",
                background: "var(--talea-media-chrome-bg)",
                color: "var(--talea-media-foreground)",
              }}
            >
              {isChildAvatar ? "Kind-Avatar" : isFamilyCopy ? "Profilkopie" : "Begleiter"}
            </span>
            <span
              className="rounded-full border px-2 py-1 text-[10px] font-semibold"
              style={{
                borderColor: "var(--talea-media-chrome-border)",
                background: "var(--talea-media-chrome-bg)",
                color: "var(--talea-media-foreground)",
              }}
            >
              {avatar.creationType === "photo-upload" ? t("homePage.badgePhoto", "Foto") : t("homePage.badgeAi", "KI-Bild")}
            </span>
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <p className="truncate text-xl font-semibold text-white">{avatar.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-white/85">
              {isChildAvatar ? <BadgeCheck className="h-3.5 w-3.5" /> : isFamilyCopy ? <Copy className="h-3.5 w-3.5" /> : <UsersRound className="h-3.5 w-3.5" />}
              {scopeLabel}
            </p>
          </div>
        </div>
      </button>

      <div className="space-y-3 p-3.5">
        <p className="min-h-10 text-xs leading-relaxed" style={{ color: palette.textMuted }}>
          {isChildAvatar
            ? `So erscheint ${profileName || avatar.name} selbst in Geschichten.`
            : isFamilyCopy
              ? "Gleiches Aussehen wie die Familienfigur, aber eigene Punkte, Erinnerungen und Sch\u00e4tze."
              : `Dieser Avatar erlebt nur die Reise von ${profileName || "diesem Kinderprofil"}.`}
        </p>

        {profileTrait || narrativeProfile?.quirk ? (
          <div
            className="rounded-2xl border px-3 py-2.5"
            style={{ borderColor: palette.border, background: palette.soft }}
          >
            {profileTrait ? (
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: palette.textMuted }}>
                Pers\u00f6nlichkeit <span className="ml-1 capitalize tracking-normal" style={{ color: palette.text }}>{profileTrait}</span>
              </p>
            ) : null}
            {narrativeProfile?.quirk ? (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: palette.text }}>
                <span className="font-semibold">Besonderheit:</span> {narrativeProfile.quirk}
              </p>
            ) : null}
          </div>
        ) : null}

        {canBecomeChild ? (
          <button
            type="button"
            onClick={onAssignChild}
            disabled={assigningChild}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
          >
            {assigningChild ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
            Als {profileName || "Kind"} festlegen
          </button>
        ) : null}

        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <button
            type="button"
            onClick={onView}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
            style={{ borderColor: palette.border, color: palette.text }}
          >
            <Eye className="h-4 w-4" />
            Profil
          </button>
          {canManage ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border"
                style={{ borderColor: palette.border, color: palette.text }}
                aria-label={t("avatarScreen.editLabel", { name: avatar.name })}
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border"
                style={{
                  borderColor: "var(--talea-danger-border)",
                  background: "var(--talea-danger-soft)",
                  color: "var(--talea-danger)",
                }}
                aria-label={t("avatarScreen.deleteLabel", { name: avatar.name })}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assigningChildId, setAssigningChildId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeControl, setActiveControl] = useState<string | null>(null);
  const [contentTab, setContentTab] = useState<AvatarContentTab>("avatars");

  const loadRequestRef = useRef(0);
  const openCreateAvatar = (mode: "child" | "companion" = "companion") => {
    const profileQuery = activeProfileId ? `profileId=${encodeURIComponent(activeProfileId)}` : "";
    if (mode === "child") {
      navigate(`/avatar/create?${["mode=child", profileQuery].filter(Boolean).join("&")}`);
      return;
    }

    navigate(`/avatar/create${profileQuery ? `?${profileQuery}` : ""}`);
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      loadRequestRef.current += 1;
      setAvatars([]);
      setIsLoading(false);
      return;
    }
    void loadAvatars();
    return () => {
      loadRequestRef.current += 1;
    };
  }, [isLoaded, isSignedIn, user?.id, backend, activeProfileId]);

  useEffect(() => {
    if (location.state?.refresh) {
      void loadAvatars();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadAvatars = async () => {
    const requestId = ++loadRequestRef.current;
    try {
      setIsLoading(true);
      setLoadError(null);
      const response = await backend.avatar.list({ profileId: activeProfileId || undefined });
      if (requestId === loadRequestRef.current) {
        setAvatars((response as { avatars?: Avatar[] })?.avatars || []);
      }
    } catch (error) {
      console.error("Failed to load avatars:", error);
      if (requestId === loadRequestRef.current) {
        setLoadError("Die Avatare konnten gerade nicht geladen werden.");
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }
  };

  const isHumanAvatar = (avatar: Avatar) => {
    const candidate = avatar as Avatar & {
      visualProfile?: { speciesCategory?: string; characterType?: string };
      physicalTraits?: { characterType?: string };
    };
    const values = [
      candidate.visualProfile?.speciesCategory,
      candidate.visualProfile?.characterType,
      candidate.physicalTraits?.characterType,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return values.some((value) =>
      ["human", "mensch", "boy", "girl", "child", "kid"].some((token) => value.includes(token))
    );
  };

  const linkedChildAvatar =
    avatars.find((avatar) => avatar.id === activeProfile?.childAvatarId) ||
    avatars.find((avatar) => avatar.avatarRole === "child") ||
    null;
  const needsChildAvatar = Boolean(activeProfile && !linkedChildAvatar);
  const exactChildCandidate =
    needsChildAvatar
      ? avatars.find(
          (avatar) =>
            avatar.isOwnedByCurrentUser !== false &&
            avatar.name.trim().localeCompare(activeProfile?.name.trim() || "", "de", { sensitivity: "base" }) === 0 &&
            isHumanAvatar(avatar)
        ) || null
      : null;

  const handleAssignChild = async (avatar: Avatar) => {
    if (!activeProfileId || assigningChildId) return;

    try {
      setAssigningChildId(avatar.id);
      await (backend.avatar.update as unknown as (input: Record<string, unknown>) => Promise<unknown>)({
        id: avatar.id,
        profileId: activeProfileId,
        avatarRole: "child",
      });
      await childProfiles?.refresh();
      await loadAvatars();
      toast.success(`${avatar.name} ist jetzt der Kind-Avatar von ${activeProfile?.name || "diesem Profil"}.`);
    } catch (error) {
      console.error("Failed to assign child avatar:", error);
      toast.error("Der vorhandene Avatar konnte nicht als Kind-Avatar festgelegt werden.");
    } finally {
      setAssigningChildId(null);
    }
  };

  const handleDeleteAvatar = async (avatar: Avatar) => {
    if (avatar.isOwnedByCurrentUser === false) {
      toast.error(t("avatarScreen.cannotDeleteShared"));
      return;
    }

    const isChild = avatar.id === linkedChildAvatar?.id || avatar.avatarRole === "child";
    const prompt = isChild
      ? `${avatar.name} ist der Kind-Avatar von ${activeProfile?.name || "diesem Profil"}. Wirklich endgültig löschen?`
      : `${avatar.name} und die zugehörige Entwicklung wirklich endgültig löschen?`;
    if (!window.confirm(prompt)) return;

    try {
      await backend.avatar.deleteAvatar({ id: avatar.id, profileId: activeProfileId || undefined });
      await childProfiles?.refresh();
      await loadAvatars();
      toast.success(`${avatar.name} wurde gelöscht.`);
    } catch (error) {
      console.error("Failed to delete avatar:", error);
      toast.error("Der Avatar konnte nicht gelöscht werden.");
    }
  };

  const filteredAvatars = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return avatars;
    return avatars.filter((avatar) => avatar.name.toLowerCase().includes(query));
  }, [avatars, searchQuery]);
  const filteredChildAvatar = linkedChildAvatar && filteredAvatars.some((avatar) => avatar.id === linkedChildAvatar.id)
    ? linkedChildAvatar
    : null;
  const filteredCompanions = filteredAvatars.filter((avatar) => avatar.id !== linkedChildAvatar?.id);
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
          <header className={cn(taleaSurfaceClass, "overflow-hidden p-4 sm:p-5 md:p-6")}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <span className={taleaChipClass}>
                  {contentTab === "characters"
                    ? "Figurenwelt"
                    : activeProfile
                      ? `Kinderprofil: ${activeProfile.name}`
                      : t("avatarScreen.chipLabel")}
                </span>
                <h1
                  className="mt-3 text-[1.85rem] font-semibold leading-tight text-[var(--talea-text-primary)] sm:text-[2.25rem]"
                  style={{ fontFamily: headingFont }}
                >
                  {contentTab === "characters"
                    ? "Talea-Figuren"
                    : activeProfile
                      ? `Avatare für ${activeProfile.name}`
                      : t("avatarScreen.title")}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--talea-text-secondary)]">
                  {contentTab === "characters"
                    ? "Entdecke fertige Figuren, die du in deine Geschichten aufnehmen kannst."
                    : activeProfile
                      ? `Punkte, Erinnerungen und Schätze auf dieser Seite gehören nur zu ${activeProfile.name}.`
                      : "Avatare bekommen in abgeschlossenen Geschichten ihre eigene Entwicklung."}
                </p>
              </div>

              {contentTab === "avatars" ? (
                <TaleaActionButton
                  type="button"
                  onClick={() => openCreateAvatar("companion")}
                  icon={<Plus className="h-4 w-4" />}
                >
                  Neuer Begleiter
                </TaleaActionButton>
              ) : null}
            </div>

            <div className="mt-5 flex rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] p-1 dark:border-white/10" role="tablist" aria-label="Avatar-Bereiche">
              <button type="button" role="tab" aria-selected={contentTab === "avatars"} onClick={() => setContentTab("avatars")} className={cn("rounded-full px-4 py-2 text-sm font-semibold transition sm:px-5", contentTab === "avatars" ? "bg-white text-[var(--primary)] shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")}>
                Avatare dieses Profils
              </button>
              <button type="button" role="tab" aria-selected={contentTab === "characters"} onClick={() => setContentTab("characters")} className={cn("rounded-full px-4 py-2 text-sm font-semibold transition sm:px-5", contentTab === "characters" ? "bg-white text-[var(--primary)] shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")}>
                <BookOpen className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
                Figuren-Bibliothek
              </button>
            </div>

            {contentTab === "avatars" ? (
              <div className={cn(taleaToolbarClass, "mt-3")}>
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
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onFocus={() => setActiveControl("avatar-search")}
                    onBlur={() => setActiveControl((current) => (current === "avatar-search" ? null : current))}
                    placeholder="Avatar oder Begleiter suchen ..."
                    className={cn(taleaInputClass, "pl-10")}
                  />
                </motion.label>
              </div>
            ) : null}
          </header>

          {contentTab === "avatars" && activeProfile && !isLoading ? (
            <section
              className={cn(taleaSurfaceClass, "p-4 sm:p-5")}
              aria-labelledby="child-avatar-status-title"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span
                  className={cn(
                    "inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl",
                    linkedChildAvatar ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  )}
                >
                  {linkedChildAvatar?.imageUrl ? (
                    <img src={linkedChildAvatar.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : linkedChildAvatar ? (
                    <BadgeCheck className="h-7 w-7" />
                  ) : (
                    <AlertCircle className="h-7 w-7" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2 id="child-avatar-status-title" className="text-lg font-semibold text-[var(--talea-text-primary)]">
                      {linkedChildAvatar ? `Kind-Avatar von ${activeProfile.name}` : `Kind-Avatar für ${activeProfile.name} fehlt`}
                    </h2>
                    <ConceptHelp title="Was ist der Kind-Avatar?">
                      So erscheint {activeProfile.name} selbst in Geschichten. Er gehört nur zu diesem Kinderprofil und wird niemals mit einem anderen Profil geteilt.
                    </ConceptHelp>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--talea-text-secondary)]">
                    {linkedChildAvatar
                      ? `${linkedChildAvatar.name} ist eindeutig als ${activeProfile.name} gekennzeichnet.`
                      : exactChildCandidate
                        ? `Der vorhandene Avatar ${exactChildCandidate.name} passt. Du kannst ihn ohne neue Kopie verbinden.`
                        : "Wähle einen vorhandenen menschlichen Avatar oder erstelle einen neuen."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {linkedChildAvatar ? (
                    <TaleaActionButton type="button" variant="secondary" onClick={() => navigate(`/avatar/${linkedChildAvatar.id}`)}>
                      Profil öffnen
                    </TaleaActionButton>
                  ) : (
                    <>
                      {exactChildCandidate ? (
                        <TaleaActionButton
                          type="button"
                          onClick={() => void handleAssignChild(exactChildCandidate)}
                          disabled={assigningChildId === exactChildCandidate.id}
                          icon={assigningChildId === exactChildCandidate.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                        >
                          {exactChildCandidate.name} verwenden
                        </TaleaActionButton>
                      ) : null}
                      <TaleaActionButton type="button" variant="secondary" onClick={() => openCreateAvatar("child")} icon={<Plus className="h-4 w-4" />}>
                        Neu erstellen
                      </TaleaActionButton>
                    </>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {contentTab === "characters" ? (
            <CharacterProfilesPanel />
          ) : isLoading ? (
            <LoadingSkeleton palette={palette} />
          ) : loadError ? (
            <section className={cn(taleaSurfaceClass, "p-8 text-center")}>
              <AlertCircle className="mx-auto h-8 w-8 text-[var(--talea-danger)]" />
              <h2 className="mt-3 text-lg font-semibold text-[var(--talea-text-primary)]">Avatare nicht erreichbar</h2>
              <p className="mt-1 text-sm text-[var(--talea-text-secondary)]">{loadError}</p>
              <TaleaActionButton type="button" onClick={() => void loadAvatars()} className="mt-4">
                Noch einmal versuchen
              </TaleaActionButton>
            </section>
          ) : filteredAvatars.length === 0 && avatars.length > 0 ? (
            <section className={cn(taleaSurfaceClass, "p-10 text-center")}>
              <Search className="mx-auto h-7 w-7 text-[var(--talea-text-muted)]" />
              <h2 className="mt-3 text-xl font-semibold text-[var(--talea-text-primary)]">Nichts gefunden</h2>
              <p className="mt-1 text-sm text-[var(--talea-text-secondary)]">Prüfe den Suchbegriff oder zeige wieder alle Avatare.</p>
              <button type="button" onClick={() => setSearchQuery("")} className="mt-4 text-sm font-semibold text-[var(--primary)]">
                Suche zurücksetzen
              </button>
            </section>
          ) : (
            <div className="space-y-6">
              {filteredChildAvatar ? (
                <section aria-labelledby="child-avatar-heading">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h2 id="child-avatar-heading" className="text-xl font-semibold text-[var(--talea-text-primary)]">Das bin ich</h2>
                      <p className="mt-0.5 text-sm text-[var(--talea-text-secondary)]">Der eigene Avatar von {activeProfile?.name}.</p>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Eindeutig verbunden</span>
                  </div>
                  <div className="grid gap-4 sm:max-w-md">
                    <AvatarCard
                      avatar={filteredChildAvatar}
                      index={0}
                      palette={palette}
                      profileName={activeProfile?.name}
                      isChildAvatar
                      canBecomeChild={false}
                      assigningChild={false}
                      onView={() => navigate(`/avatar/${filteredChildAvatar.id}`)}
                      onEdit={() => navigate(`/avatar/edit/${filteredChildAvatar.id}`)}
                      onDelete={() => void handleDeleteAvatar(filteredChildAvatar)}
                      onAssignChild={() => undefined}
                    />
                  </div>
                </section>
              ) : null}

              <section aria-labelledby="companion-heading">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 id="companion-heading" className="text-xl font-semibold text-[var(--talea-text-primary)]">Begleiter &amp; Familie</h2>
                      <ConceptHelp title="Wie funktionieren Begleiter?">
                        Mama, Papa, Tiere und Freunde entwickeln sich nur in diesem Kinderprofil. Beim Übernehmen in ein anderes Profil entsteht eine eigene Kopie mit eigenen Erinnerungen.
                      </ConceptHelp>
                    </div>
                    <p className="mt-0.5 text-sm text-[var(--talea-text-secondary)]">
                      {filteredCompanions.length} {filteredCompanions.length === 1 ? "Figur" : "Figuren"} nur für {activeProfile?.name || "dieses Profil"}.
                    </p>
                  </div>
                  <button type="button" onClick={() => openCreateAvatar("companion")} className="inline-flex min-h-10 items-center gap-2 self-start rounded-full border border-[var(--talea-border-light)] px-4 text-sm font-semibold text-[var(--talea-text-primary)]">
                    <Plus className="h-4 w-4" />
                    Begleiter anlegen
                  </button>
                </div>

                {filteredCompanions.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredCompanions.map((avatar, index) => (
                      <AvatarCard
                        key={avatar.id}
                        avatar={avatar}
                        index={index}
                        palette={palette}
                        profileName={activeProfile?.name}
                        isChildAvatar={false}
                        canBecomeChild={needsChildAvatar && avatar.isOwnedByCurrentUser !== false && isHumanAvatar(avatar)}
                        assigningChild={assigningChildId === avatar.id}
                        onView={() => navigate(`/avatar/${avatar.id}`)}
                        onEdit={() => navigate(`/avatar/edit/${avatar.id}`)}
                        onDelete={() => void handleDeleteAvatar(avatar)}
                        onAssignChild={() => void handleAssignChild(avatar)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={cn(taleaSurfaceClass, "border-dashed p-8 text-center")}>
                    <UsersRound className="mx-auto h-8 w-8 text-[var(--talea-text-muted)]" />
                    <h3 className="mt-3 font-semibold text-[var(--talea-text-primary)]">Noch keine Begleiter</h3>
                    <p className="mt-1 text-sm text-[var(--talea-text-secondary)]">Lege Mama, Papa, ein Tier oder eine Fantasiefigur für dieses Profil an.</p>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </SignedIn>
    </div>
  );
};

export default TaleaAvatarsScreen;
