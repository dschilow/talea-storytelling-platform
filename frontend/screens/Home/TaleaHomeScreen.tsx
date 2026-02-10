import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Clock3,
  Library,
  LogIn,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  WandSparkles,
} from "lucide-react";

import { useBackend } from "../../hooks/useBackend";
import type { Story } from "../../types/story";
import { cn } from "@/lib/utils";
import { StoryParticipantsDialog } from "@/components/story/StoryParticipantsDialog";
import taleaLogo from "@/img/talea_logo.png";
import { useTheme } from "@/contexts/ThemeContext";
import { useOffline } from "@/contexts/OfflineStorageContext";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  creationType: "ai-generated" | "photo-upload";
}

interface Doku {
  id: string;
  title: string;
  topic: string;
  coverImageUrl?: string;
  status: "generating" | "complete" | "error";
  createdAt: string;
}

const headingFont = '"Cormorant Garamond", "Times New Roman", serif';
const bodyFont = '"Sora", "Manrope", "Segoe UI", sans-serif';

const storyStatusLabel: Record<Story["status"], string> = {
  complete: "Fertig",
  generating: "In Arbeit",
  error: "Fehler",
};

const dokuStatusLabel: Record<Doku["status"], string> = {
  complete: "Fertig",
  generating: "In Arbeit",
  error: "Fehler",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const StudioBackground: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
    <div
      className="absolute inset-0"
      style={{
        background: isDark
          ? `radial-gradient(980px 520px at 100% 0%, rgba(95,81,135,0.28) 0%, transparent 58%),
             radial-gradient(980px 560px at 0% 18%, rgba(56,94,96,0.24) 0%, transparent 63%),
             radial-gradient(760px 420px at 45% 100%, rgba(81,104,145,0.2) 0%, transparent 60%),
             #141d2b`
          : `radial-gradient(980px 520px at 100% 0%, #f0ddd9 0%, transparent 58%),
             radial-gradient(980px 560px at 0% 18%, #d8e5dc 0%, transparent 63%),
             radial-gradient(760px 420px at 45% 100%, #e2deef 0%, transparent 60%),
             #f8f1e8`,
      }}
    />
    <div
      className="absolute inset-x-0 top-0 h-[360px]"
      style={{
        background: isDark
          ? "linear-gradient(180deg, rgba(18,28,40,0.82) 0%, rgba(18,28,40,0) 90%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 90%)",
      }}
    />
  </div>
);

const LoadingState: React.FC = () => (
  <div className="flex min-h-[62vh] items-center justify-center">
    <div className="inline-flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <RefreshCw className="h-4 w-4 animate-spin text-[#4f7f78]" />
      <span className="text-sm font-semibold text-muted-foreground">Daten werden geladen...</span>
    </div>
  </div>
);

const SignedOutStart: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-5">
      <Card className="w-full max-w-3xl border-[#e1d3c1] dark:border-[#33465e] bg-[#fff9f0] dark:bg-[#1d2636] shadow-[0_22px_44px_rgba(47,58,77,0.14)]">
        <CardContent className="grid gap-7 p-7 md:grid-cols-[1.25fr_1fr] md:p-9">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e3d7c8] dark:border-[#3a4d66] bg-white/70 px-2.5 py-1.5">
              <img src={taleaLogo} alt="Talea Logo" className="h-6 w-6 rounded-md object-cover" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#637286]">Talea Story Studio</p>
            </div>
            <h1
              className="mt-4 text-4xl leading-tight text-[#243247] md:text-5xl"
              style={{ fontFamily: headingFont }}
            >
              Geschichten gestalten,
              <br />
              nicht nur generieren
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#617387] dark:text-[#9fb0c7] md:text-base">
              {t(
                "home.subtitle",
                "Organisiere Avatare, Geschichten und Dokus in einer klaren Arbeitsoberflaeche mit professionellem Look."
              )}
            </p>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="mt-7 inline-flex items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-5 py-3 text-sm font-semibold text-[#2f3c4f] dark:text-[#dce7f8] shadow-[0_10px_22px_rgba(52,61,80,0.16)] transition-transform hover:-translate-y-0.5"
            >
              <LogIn className="h-4 w-4" />
              Anmelden
            </button>
          </div>

          <div className="rounded-2xl border border-[#e6d9c9] bg-[#f8f0e4] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#617387] dark:text-[#9fb0c7]">
              Workspace Fokus
            </p>
            <ul className="mt-4 space-y-3 text-sm text-[#425165]">
              <li className="rounded-xl border border-[#eadfce] bg-white/70 px-3 py-2">Story-Streams mit Teilnehmern</li>
              <li className="rounded-xl border border-[#eadfce] bg-white/70 px-3 py-2">Schneller Zugriff auf Avatare</li>
              <li className="rounded-xl border border-[#eadfce] bg-white/70 px-3 py-2">Dokus im gleichen Stil</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SectionHeading: React.FC<{
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, subtitle, actionLabel, onAction }) => (
  <div className="mb-4 flex items-end justify-between gap-4">
    <div>
      <h2
        className="text-2xl text-[#16212c] dark:text-[#e6edf8] md:text-[2rem]"
        style={{ fontFamily: headingFont }}
      >
        {title}
      </h2>
      <p className="text-sm text-[#617387] dark:text-[#9fb0c7]">{subtitle}</p>
    </div>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-2 rounded-xl border border-[#e1d3c1] dark:border-[#33465e] bg-[#fff9f0] dark:bg-[#1d2636] px-3 py-2 text-sm font-semibold text-[#17212d] dark:text-[#e6edf8] transition-colors hover:bg-[#f3eee4] dark:bg-[#2a3a50]"
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    )}
  </div>
);

const StoryStatusTag: React.FC<{ status: Story["status"] }> = ({ status }) => (
  <span
    className={cn(
      "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
      status === "complete" && "border-[#bfdcd5] bg-[#ece3d9] text-[#4f7f78]",
      status === "generating" && "border-[#e5d2b9] bg-[#f6ead8] text-[#8f6036]",
      status === "error" && "border-[#e6c4c4] bg-[#f6e2e2] text-[#9d4545]"
    )}
  >
    {storyStatusLabel[status]}
  </span>
);

const StoryCard: React.FC<{
  story: Story;
  onRead: () => void;
  onDelete: () => void;
  canSaveOffline?: boolean;
  isSavedOffline?: boolean;
  isSavingOffline?: boolean;
  onToggleOffline?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}> = ({ story, onRead, onDelete, canSaveOffline, isSavedOffline, isSavingOffline, onToggleOffline }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      whileHover={reduceMotion ? undefined : { y: -5 }}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
      className="group cursor-pointer"
      onClick={onRead}
    >
      <Card className="overflow-hidden border-[#e1d3c1] dark:border-[#33465e] bg-[#fff9f0] dark:bg-[#1d2636] shadow-[0_14px_32px_rgba(21,32,44,0.08)] transition-shadow group-hover:shadow-[0_18px_42px_rgba(21,32,44,0.12)]">
        <div className="relative h-52 overflow-hidden">
          {story.coverImageUrl ? (
            <img
              src={story.coverImageUrl}
              alt={story.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#e8e2d6] text-[#7b7468]">
              <BookOpen className="h-10 w-10" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/8 to-transparent" />

          <div className="absolute left-3 top-3">
            <StoryStatusTag status={story.status} />
          </div>

          <div className="absolute right-3 top-3 flex items-center gap-2">
            {canSaveOffline && story.status === "complete" && onToggleOffline && (
              <button
                type="button"
                onClick={onToggleOffline}
                disabled={isSavingOffline}
                className="rounded-lg border border-white/35 bg-black/45 p-1.5 text-white transition-colors hover:bg-black/70"
                aria-label={isSavedOffline ? "Offline-Speicherung entfernen" : "Offline speichern"}
              >
                {isSavingOffline ? (
                  <Clock3 className="h-4 w-4 animate-spin" />
                ) : isSavedOffline ? (
                  <BookmarkCheck className="h-4 w-4" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="rounded-lg border border-white/35 bg-black/45 p-1.5 text-white transition-colors hover:bg-[#7f2d2d]"
              aria-label="Story loeschen"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <CardContent className="space-y-3 p-5">
          <div className="space-y-1.5">
            <h3
              className="line-clamp-2 text-xl leading-tight text-[#16212c] dark:text-[#e6edf8]"
              style={{ fontFamily: headingFont }}
            >
              {story.title}
            </h3>
            <p className="line-clamp-2 text-sm leading-relaxed text-[#617387] dark:text-[#9fb0c7]">
              {story.summary || story.description || "Noch keine Zusammenfassung verfuegbar."}
            </p>
          </div>

          <StoryParticipantsDialog story={story} maxVisible={4} />

          <div className="flex items-center justify-between pt-1 text-xs text-[#617387] dark:text-[#9fb0c7]">
            <span>{formatDate(story.createdAt)}</span>
            <span className="font-semibold text-[#4f7f78]">Lesen</span>
          </div>
        </CardContent>
      </Card>
    </motion.article>
  );
};

const AvatarTile: React.FC<{
  avatar: Avatar;
  onOpen: () => void;
  onDelete: () => void;
}> = ({ avatar, onOpen, onDelete }) => (
  <article
    role="button"
    tabIndex={0}
    onClick={onOpen}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    }}
    className="group rounded-2xl border border-[#e1d3c1] dark:border-[#33465e] bg-[#fff9f0] dark:bg-[#1d2636] p-4 text-left shadow-[0_10px_24px_rgba(21,32,44,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(21,32,44,0.1)]"
  >
    <div className="relative inline-flex">
      <img
        src={
          avatar.imageUrl ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatar.name)}`
        }
        alt={avatar.name}
        className="h-16 w-16 rounded-2xl object-cover"
      />
      <span className="absolute -bottom-1 -right-1 rounded-full border border-[#ece3d9] bg-[#4f7f78] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        {avatar.creationType === "ai-generated" ? "AI" : "Foto"}
      </span>
      <span className="sr-only">{avatar.name}</span>
    </div>

    <p className="mt-3 truncate text-sm font-semibold text-[#17212d] dark:text-[#e6edf8]">{avatar.name}</p>
    <p className="text-xs text-[#617387] dark:text-[#9fb0c7]">Zum Bearbeiten oeffnen</p>

    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onDelete();
      }}
      className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[#ebcdcd] bg-[#fff5f5] px-2 py-1 text-[11px] font-semibold text-[#9d4545] transition-colors hover:bg-[#fde9e9]"
      aria-label={`${avatar.name} loeschen`}
    >
      <Trash2 className="h-3 w-3" />
      Loeschen
    </button>
  </article>
);

const DokuRow: React.FC<{
  doku: Doku;
  onRead: () => void;
  onDelete: () => void;
}> = ({ doku, onRead, onDelete }) => (
  <article
    className="group rounded-2xl border border-[#e1d3c1] dark:border-[#33465e] bg-[#fff9f0] dark:bg-[#1d2636] p-3 shadow-[0_10px_24px_rgba(21,32,44,0.06)]"
    role="button"
    tabIndex={0}
    onClick={onRead}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRead();
      }
    }}
  >
    <div className="flex gap-3">
      <div className="h-16 w-16 overflow-hidden rounded-xl border border-[#e2d9cc] dark:border-[#3a4d66] bg-[#efe8dc]">
        {doku.coverImageUrl ? (
          <img src={doku.coverImageUrl} alt={doku.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#7b7468]">
            <Library className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-semibold text-[#17212d] dark:text-[#e6edf8]">{doku.title}</p>
            <p className="line-clamp-1 text-xs text-[#617387] dark:text-[#9fb0c7]">{doku.topic}</p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-lg border border-[#ebcdcd] bg-[#fff5f5] p-1.5 text-[#9d4545] transition-colors hover:bg-[#fde9e9]"
            aria-label="Doku loeschen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="rounded-full border border-[#e2d9cc] dark:border-[#3a4d66] bg-[#f7f2e8] px-2 py-0.5 font-semibold uppercase tracking-wide text-[#617387] dark:text-[#9fb0c7]">
            {dokuStatusLabel[doku.status]}
          </span>
          <span className="text-[#617387] dark:text-[#9fb0c7]">{formatDate(doku.createdAt)}</span>
        </div>
      </div>
    </div>
  </article>
);

const EmptyBlock: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <Card className="border-dashed border-[#e1d3c1] dark:border-[#33465e] bg-[#fff9f0] dark:bg-[#1d2636]">
    <CardContent className="p-8 text-center">
      <h3 className="text-xl text-[#17212d] dark:text-[#e6edf8]" style={{ fontFamily: headingFont }}>
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[#617387] dark:text-[#9fb0c7]">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#4f7f78] px-4 py-2 text-sm font-semibold text-white"
        >
          {actionLabel}
        </button>
      )}
    </CardContent>
  </Card>
);

const TaleaHomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { user, isLoaded, isSignedIn } = useUser();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { canUseOffline, isStorySaved, isSaving, toggleStory } = useOffline();
  const reduceMotion = useReducedMotion();
  const isDark = resolvedTheme === "dark";

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [dokus, setDokus] = useState<Doku[]>([]);
  const [storiesTotal, setStoriesTotal] = useState(0);
  const [dokusTotal, setDokusTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Guten Morgen";
    if (hour < 18) return "Guten Tag";
    return "Guten Abend";
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [avatarsResponse, storiesResponse, dokusResponse] = await Promise.all([
        backend.avatar.list(),
        backend.story.list({ limit: 12, offset: 0 }),
        backend.doku.listDokus({ limit: 8, offset: 0 }),
      ]);

      setAvatars((avatarsResponse.avatars as Avatar[]) || []);
      setStories((storiesResponse.stories as Story[]) || []);
      setDokus((dokusResponse.dokus as Doku[]) || []);
      setStoriesTotal((storiesResponse as any).total ?? ((storiesResponse.stories as Story[]) || []).length);
      setDokusTotal((dokusResponse as any).total ?? ((dokusResponse.dokus as Doku[]) || []).length);
    } catch (error) {
      console.error("Error loading home data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      loadData();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteAvatar = async (avatarId: string, avatarName: string) => {
    if (!window.confirm(`\"${avatarName}\" wirklich loeschen?`)) return;

    try {
      await backend.avatar.deleteAvatar({ id: avatarId });
      setAvatars((prev) => prev.filter((avatar) => avatar.id !== avatarId));
    } catch (error) {
      console.error("Error deleting avatar:", error);
    }
  };

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (!window.confirm(`${t("common.delete", "Loeschen")} \"${storyTitle}\"?`)) return;

    try {
      await backend.story.deleteStory({ id: storyId });
      setStories((prev) => prev.filter((story) => story.id !== storyId));
    } catch (error) {
      console.error("Error deleting story:", error);
    }
  };

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (!window.confirm(`${t("common.delete", "Loeschen")} \"${dokuTitle}\"?`)) return;

    try {
      await backend.doku.deleteDoku({ id: dokuId });
      setDokus((prev) => prev.filter((doku) => doku.id !== dokuId));
    } catch (error) {
      console.error("Error deleting doku:", error);
    }
  };

  if (loading || !isLoaded) {
    return <LoadingState />;
  }

  return (
    <div className="relative min-h-screen pb-24" style={{ fontFamily: bodyFont }}>
      <StudioBackground isDark={isDark} />

      <SignedOut>
        <SignedOutStart />
      </SignedOut>

      <SignedIn>
        <div className="space-y-7 pt-4">
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: -14 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          >
            <Card className="border-[#e1d3c1] dark:border-[#33465e] bg-[#fff9f0] dark:bg-[#1d2636]/95 dark:bg-[#1d2636]/95 shadow-[0_20px_42px_rgba(39,49,66,0.13)] backdrop-blur">
              <CardContent className="grid gap-6 p-5 md:p-6 lg:grid-cols-[1.35fr_1fr]">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e2d5c5] bg-white/75 px-2.5 py-1.5">
                    <img src={taleaLogo} alt="Talea Logo" className="h-5 w-5 rounded-md object-cover" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b7888] dark:text-[#9fb0c7]">
                      Talea Atelier
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-[#e1d3c1] dark:border-[#33465e] bg-white/75 p-1.5">
                        <UserButton
                          afterSignOutUrl="/"
                          userProfileMode="navigation"
                          userProfileUrl="/settings"
                          appearance={{ elements: { avatarBox: "h-10 w-10" } }}
                        />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#6b7888] dark:text-[#9fb0c7]">{greeting}</p>
                        <h1
                          className="text-3xl leading-tight text-[#253246] dark:text-[#e6edf8] md:text-4xl"
                          style={{ fontFamily: headingFont }}
                        >
                          {user?.firstName || "Talea Nutzer"}
                        </h1>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#e1d3c1] dark:border-[#33465e] bg-[#f7efe2] dark:bg-[#243245] px-3 py-2 text-sm font-semibold text-[#2e3c4f] dark:text-[#dce7f8] transition-colors hover:bg-[#efe5d7] dark:bg-[#2a3a50]"
                    >
                      <RefreshCw
                        className={cn("h-4 w-4 text-[#4f7f78]", refreshing && "animate-spin")}
                      />
                      Aktualisieren
                    </button>
                  </div>

                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#617387] dark:text-[#9fb0c7]">
                    Dein Story-Workspace fuer Avatare, Geschichten und Wissensformate. Editoriale
                    Typografie, pastellige Oberflaechen und direkte Kernaktionen ohne visuelle Unruhe.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => navigate("/story")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f1d7d5_0%,#e8d8e8_42%,#d6e2d0_100%)] px-4 py-2.5 text-sm font-semibold text-[#2e3b4d] dark:text-[#dce7f8] shadow-[0_8px_20px_rgba(54,63,82,0.15)] transition-transform hover:-translate-y-0.5"
                    >
                      <WandSparkles className="h-4 w-4 text-[#4f6786]" />
                      Neue Story
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/avatar/create")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#e1d3c1] dark:border-[#33465e] bg-white/70 px-4 py-2.5 text-sm font-semibold text-[#2f3d52] dark:text-[#dce7f8] transition-colors hover:bg-[#f5ebde] dark:bg-[#2a3a50]"
                    >
                      <UserPlus className="h-4 w-4 text-[#6a809f]" />
                      Avatar erstellen
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/doku/create")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#e1d3c1] dark:border-[#33465e] bg-white/70 px-4 py-2.5 text-sm font-semibold text-[#2f3d52] dark:text-[#dce7f8] transition-colors hover:bg-[#f5ebde] dark:bg-[#2a3a50]"
                    >
                      <Library className="h-4 w-4 text-[#5f9388]" />
                      Doku schreiben
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#e3d7c8] dark:border-[#3a4d66] bg-[#f8efe2] dark:bg-[#243245] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#617387] dark:text-[#9fb0c7]">
                      Geschichten
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-[#17212d] dark:text-[#e6edf8]">{storiesTotal}</p>
                  </div>
                  <div className="rounded-xl border border-[#e3d7c8] dark:border-[#3a4d66] bg-[#f8efe2] dark:bg-[#243245] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#617387] dark:text-[#9fb0c7]">
                      Avatare
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-[#17212d] dark:text-[#e6edf8]">{avatars.length}</p>
                  </div>
                  <div className="rounded-xl border border-[#e3d7c8] dark:border-[#3a4d66] bg-[#f8efe2] dark:bg-[#243245] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#617387] dark:text-[#9fb0c7]">
                      Dokus
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-[#17212d] dark:text-[#e6edf8]">{dokusTotal}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/stories")}
                    className="rounded-xl border border-[#cad9cc] bg-[#e6eee4] dark:bg-[#28413e] p-3 text-left transition-colors hover:bg-[#dce8dd] dark:bg-[#31504c]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#356f69]">
                      Bibliothek
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[#4d7f78]">
                      Alle Stories
                      <ArrowRight className="h-4 w-4" />
                    </p>
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <section>
            <SectionHeading
              title="Aktuelle Geschichten"
              subtitle={`${storiesTotal} Eintraege in deiner Story-Bibliothek`}
              actionLabel="Alle Geschichten"
              onAction={() => navigate("/stories")}
            />

            {stories.length === 0 ? (
              <EmptyBlock
                title="Noch keine Geschichten"
                description="Erstelle deine erste Story. Teilnehmer bleiben in jeder Karte anklickbar und vergroesserbar."
                actionLabel="Story erstellen"
                onAction={() => navigate("/story")}
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {stories.slice(0, 6).map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    onRead={() => navigate(`/story-reader/${story.id}`)}
                    onDelete={() => handleDeleteStory(story.id, story.title)}
                    canSaveOffline={canUseOffline}
                    isSavedOffline={isStorySaved(story.id)}
                    isSavingOffline={isSaving(story.id)}
                    onToggleOffline={(event) => { event.stopPropagation(); toggleStory(story.id); }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <SectionHeading
                title="Avatare"
                subtitle={`${avatars.length} aktive Teilnehmer`}
                actionLabel="Avatar-Ansicht"
                onAction={() => navigate("/avatar")}
              />

              {avatars.length === 0 ? (
                <EmptyBlock
                  title="Noch keine Avatare"
                  description="Lege den ersten Avatar an, um ihn direkt in Stories zu verwenden."
                  actionLabel="Avatar erstellen"
                  onAction={() => navigate("/avatar/create")}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {avatars.slice(0, 6).map((avatar) => (
                    <AvatarTile
                      key={avatar.id}
                      avatar={avatar}
                      onOpen={() => navigate(`/avatar/edit/${avatar.id}`)}
                      onDelete={() => handleDeleteAvatar(avatar.id, avatar.name)}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={() => navigate("/avatar/create")}
                    className="rounded-2xl border border-dashed border-[#e1d3c1] dark:border-[#33465e] bg-[#fff9f0] dark:bg-[#1d2636] p-4 text-left transition-colors hover:bg-[#f4efe5] dark:bg-[#2a3a50]"
                  >
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ece3d9] text-[#4f7f78]">
                      <Plus className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#17212d] dark:text-[#e6edf8]">Neuer Avatar</p>
                    <p className="text-xs text-[#617387] dark:text-[#9fb0c7]">Direkt im Wizard anlegen</p>
                  </button>
                </div>
              )}
            </div>

            <div>
            <SectionHeading
              title="Dokus"
              subtitle={`${dokusTotal} Dokumente und Entwuerfe`}
              actionLabel="Doku-Ansicht"
              onAction={() => navigate("/doku")}
            />

              {dokus.length === 0 ? (
                <EmptyBlock
                  title="Noch keine Dokus"
                  description="Erstelle strukturierte Dokus, die mit deinen Stories zusammenpassen."
                  actionLabel="Doku erstellen"
                  onAction={() => navigate("/doku/create")}
                />
              ) : (
                <div className="space-y-3">
                  {dokus.slice(0, 6).map((doku) => (
                    <DokuRow
                      key={doku.id}
                      doku={doku}
                      onRead={() => navigate(`/doku-reader/${doku.id}`)}
                      onDelete={() => handleDeleteDoku(doku.id, doku.title)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </SignedIn>
    </div>
  );
};

export default TaleaHomeScreen;

