import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, BadgeCheck, Copy, Edit, LoaderCircle, Plus, Search, Sparkles, Trash2, User, UsersRound } from "lucide-react";
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
  taleaDisplayFont,
  taleaInputClass,
  taleaPageShellClass,
  taleaSurfaceClass,
} from "@/components/talea/TaleaPastelPrimitives";
import { TaleaCardMenu, type TaleaCardMenuAction } from "@/components/talea/TaleaCardMenu";

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
  const actions: TaleaCardMenuAction[] = canManage
    ? [
        { label: t("avatarScreen.editLabel", { name: avatar.name }), icon: <Edit className="h-4 w-4" />, onSelect: onEdit },
        { label: t("avatarScreen.deleteLabel", { name: avatar.name }), icon: <Trash2 className="h-4 w-4" />, onSelect: onDelete, destructive: true },
      ]
    : [];

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: Math.min(index, 8) * 0.025 }}
      className="relative overflow-hidden rounded-[1.375rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] shadow-[var(--talea-shadow-soft)]"
    >
      <button
        type="button"
        onClick={onView}
        className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--primary)]"
        aria-label={`Profil von ${avatar.name} \u00f6ffnen`}
      >
        <div className="relative aspect-square overflow-hidden" style={{ background: palette.soft }}>
          {avatar.imageUrl ? (
            <img
              src={avatar.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User className="h-16 w-16" style={{ color: palette.textMuted }} />
            </div>
          )}
        </div>
        <div className="px-3.5 pb-3.5 pt-3">
          <p className="truncate text-[17px] font-semibold text-[var(--talea-text-primary)]">{avatar.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-[var(--talea-text-secondary)]">
            {isChildAvatar ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" /> : isFamilyCopy ? <Copy className="h-3.5 w-3.5 shrink-0" /> : null}
            <span className="truncate">{scopeLabel}</span>
          </p>
          {profileTrait ? (
            <p className="mt-1 truncate text-[13px] capitalize text-[var(--talea-text-tertiary)]">{profileTrait}</p>
          ) : null}
        </div>
      </button>

      {canBecomeChild ? (
        <div className="px-3.5 pb-3.5">
          <button
            type="button"
            onClick={onAssignChild}
            disabled={assigningChild}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-3 text-[14px] font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
          >
            {assigningChild ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
            Als {profileName || "Kind"} festlegen
          </button>
        </div>
      ) : null}

      <TaleaCardMenu actions={actions} label={`Aktionen f\u00fcr ${avatar.name}`} className="!absolute right-2.5 top-2.5" />
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
        <div className={cn(taleaPageShellClass, "relative z-10 space-y-7 pt-1")}>
          <header className="px-1">
            <div className="flex items-end justify-between gap-4">
              <h1
                className="min-w-0 text-[2rem] font-bold leading-tight text-[var(--talea-text-primary)] md:text-[2.5rem]"
                style={{ fontFamily: headingFont }}
              >
                {contentTab === "characters" ? "Talea-Figuren" : t("avatarScreen.title", "Avatare")}
              </h1>
              {contentTab === "avatars" ? (
                <TaleaActionButton
                  type="button"
                  onClick={() => openCreateAvatar("companion")}
                  icon={<Plus className="h-5 w-5" />}
                  aria-label="Neuer Begleiter"
                  className="mb-1 h-10 min-h-10 w-10 shrink-0 rounded-full px-0 sm:w-auto sm:px-4"
                >
                  <span className="hidden sm:inline">Neuer Begleiter</span>
                </TaleaActionButton>
              ) : null}
            </div>
            <p className="mt-1 max-w-2xl text-[15px] text-[var(--talea-text-secondary)]">
              {contentTab === "characters"
                ? "Fertige Figuren, die du in deine Geschichten aufnehmen kannst."
                : activeProfile
                  ? `Punkte, Erinnerungen und Sch\u00e4tze geh\u00f6ren nur zu ${activeProfile.name}.`
                  : "Avatare entwickeln sich in abgeschlossenen Geschichten weiter."}
            </p>

            <div role="tablist" aria-label="Avatar-Bereiche" className="mt-4 grid grid-cols-2 rounded-[0.7rem] bg-[var(--talea-surface-inset)] p-0.5 sm:inline-grid sm:min-w-[22rem]">
              {([
                { id: "avatars", label: activeProfile ? `F\u00fcr ${activeProfile.name}` : "Meine Avatare" },
                { id: "characters", label: "Figuren-Bibliothek" },
              ] as Array<{ id: AvatarContentTab; label: string }>).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={contentTab === tab.id}
                  onClick={() => setContentTab(tab.id)}
                  className={cn(
                    "truncate rounded-[0.55rem] px-3 py-1.5 text-[14px] font-semibold transition",
                    contentTab === tab.id
                      ? "bg-[var(--talea-surface-primary)] text-[var(--talea-text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#48484d]"
                      : "text-[var(--talea-text-secondary)]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {contentTab === "avatars" ? (
              <label className="relative mt-3 block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--talea-text-tertiary)]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Avatar oder Begleiter suchen …"
                  className={cn(taleaInputClass, "pl-10")}
                />
              </label>
            ) : null}
          </header>

          {/* Only when something needs doing: a linked child avatar already shows below under "Das bin ich". */}
          {contentTab === "avatars" && activeProfile && !isLoading && !linkedChildAvatar ? (
            <section
              className={cn(taleaSurfaceClass, "p-4 sm:p-5")}
              aria-labelledby="child-avatar-status-title"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--talea-warning-soft)] text-[var(--talea-warning)]">
                  <AlertCircle className="h-6 w-6" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2 id="child-avatar-status-title" className="text-[17px] font-semibold text-[var(--talea-text-primary)]">
                      Kind-Avatar für {activeProfile.name} fehlt
                    </h2>
                    <ConceptHelp title="Was ist der Kind-Avatar?">
                      So erscheint {activeProfile.name} selbst in Geschichten. Er gehört nur zu diesem Kinderprofil und wird niemals mit einem anderen Profil geteilt.
                    </ConceptHelp>
                  </div>
                  <p className="mt-0.5 text-[15px] leading-snug text-[var(--talea-text-secondary)]">
                    {exactChildCandidate
                      ? `Der vorhandene Avatar ${exactChildCandidate.name} passt. Du kannst ihn ohne neue Kopie verbinden.`
                      : "Wähle einen vorhandenen menschlichen Avatar oder erstelle einen neuen."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
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
                      <h2 id="child-avatar-heading" className="text-[1.375rem] font-bold text-[var(--talea-text-primary)]" style={{ fontFamily: headingFont }}>Das bin ich</h2>
                      <p className="mt-0.5 text-sm text-[var(--talea-text-secondary)]">Der eigene Avatar von {activeProfile?.name}.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
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
                      <h2 id="companion-heading" className="text-[1.375rem] font-bold text-[var(--talea-text-primary)]" style={{ fontFamily: headingFont }}>Begleiter &amp; Familie</h2>
                      <ConceptHelp title="Wie funktionieren Begleiter?">
                        Mama, Papa, Tiere und Freunde entwickeln sich nur in diesem Kinderprofil. Beim Übernehmen in ein anderes Profil entsteht eine eigene Kopie mit eigenen Erinnerungen.
                      </ConceptHelp>
                    </div>
                    <p className="mt-0.5 text-sm text-[var(--talea-text-secondary)]">
                      {filteredCompanions.length} {filteredCompanions.length === 1 ? "Figur" : "Figuren"} nur für {activeProfile?.name || "dieses Profil"}.
                    </p>
                  </div>
                  <button type="button" onClick={() => openCreateAvatar("companion")} className="self-start text-[15px] font-semibold text-[var(--primary)] hover:opacity-75 sm:self-end">
                    Begleiter anlegen
                  </button>
                </div>

                {filteredCompanions.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
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
