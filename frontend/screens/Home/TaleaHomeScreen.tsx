import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Library,
  LogIn,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UserPlus,
  WandSparkles,
} from "lucide-react";

import { useBackend } from "../../hooks/useBackend";
import type { Story } from "../../types/story";
import { cn } from "@/lib/utils";
import { StoryParticipantsDialog } from "@/components/story/StoryParticipantsDialog";
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

const palette = {
  page: "#f2efe8",
  panel: "#fbfaf7",
  muted: "#5f6d7d",
  border: "#d8d0c4",
  accent: "#1f6f67",
};

const headingFont = '"Fraunces", "Times New Roman", serif';
const bodyFont = '"Manrope", "Segoe UI", sans-serif';

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

const StudioBackground: React.FC = () => (
  <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(920px 460px at 100% 0%, #e8dfd1 0%, transparent 58%),
                     radial-gradient(980px 540px at 0% 18%, #dce9e7 0%, transparent 63%),
                     ${palette.page}`,
      }}
    />
    <div
      className="absolute inset-x-0 top-0 h-[360px]"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0) 90%)",
      }}
    />
  </div>
);

const LoadingState: React.FC = () => (
  <div className="flex min-h-[62vh] items-center justify-center">
    <div
      className="inline-flex items-center gap-3 rounded-xl border px-4 py-3"
      style={{ borderColor: palette.border, background: palette.panel }}
    >
      <RefreshCw className="h-4 w-4 animate-spin" style={{ color: palette.accent }} />
      <span className="text-sm font-semibold" style={{ color: palette.muted }}>
        Daten werden geladen...
      </span>
    </div>
  </div>
);

const SignedOutStart: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-5">
      <Card className="w-full max-w-3xl border-[#d8d0c4] bg-[#fbfaf7] shadow-[0_18px_40px_rgba(21,32,44,0.1)]">
        <CardContent className="grid gap-7 p-7 md:grid-cols-[1.25fr_1fr] md:p-9">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#1f6f67]">
              <Sparkles className="h-3.5 w-3.5" />
              Talea Story Studio
            </p>
            <h1
              className="mt-3 text-4xl leading-tight text-[#16212c] md:text-5xl"
              style={{ fontFamily: headingFont }}
            >
              Geschichten gestalten,
              <br />
              nicht nur generieren
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#5f6d7d] md:text-base">
              {t(
                "home.subtitle",
                "Organisiere Avatare, Geschichten und Dokus in einer klaren Arbeitsoberflaeche mit professionellem Look."
              )}
            </p>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#1f6f67] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <LogIn className="h-4 w-4" />
              Anmelden
            </button>
          </div>

          <div className="rounded-2xl border border-[#e1d8cb] bg-[#f6f1e7] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#607083]">
              Workspace Fokus
            </p>
            <ul className="mt-4 space-y-3 text-sm text-[#364554]">
              <li className="rounded-xl bg-white/60 px-3 py-2">Story-Streams mit Teilnehmern</li>
              <li className="rounded-xl bg-white/60 px-3 py-2">Schneller Zugriff auf Avatare</li>
              <li className="rounded-xl bg-white/60 px-3 py-2">Wissens-Dokus im gleichen Stil</li>
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
        className="text-2xl text-[#16212c] md:text-[2rem]"
        style={{ fontFamily: headingFont }}
      >
        {title}
      </h2>
      <p className="text-sm text-[#5f6d7d]">{subtitle}</p>
    </div>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-2 rounded-xl border border-[#d8d0c4] bg-[#fbfaf7] px-3 py-2 text-sm font-semibold text-[#17212d] transition-colors hover:bg-[#f3eee4]"
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
      status === "complete" && "border-[#bfdcd5] bg-[#deece8] text-[#1f6f67]",
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
}> = ({ story, onRead, onDelete }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      whileHover={reduceMotion ? undefined : { y: -5 }}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
      className="group cursor-pointer"
      onClick={onRead}
    >
      <Card className="overflow-hidden border-[#d8d0c4] bg-[#fbfaf7] shadow-[0_14px_32px_rgba(21,32,44,0.08)] transition-shadow group-hover:shadow-[0_18px_42px_rgba(21,32,44,0.12)]">
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

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="absolute right-3 top-3 rounded-lg border border-white/35 bg-black/45 p-1.5 text-white transition-colors hover:bg-[#7f2d2d]"
            aria-label="Story loeschen"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <CardContent className="space-y-3 p-5">
          <div className="space-y-1.5">
            <h3
              className="line-clamp-2 text-xl leading-tight text-[#16212c]"
              style={{ fontFamily: headingFont }}
            >
              {story.title}
            </h3>
            <p className="line-clamp-2 text-sm leading-relaxed text-[#5f6d7d]">
              {story.summary || story.description || "Noch keine Zusammenfassung verfuegbar."}
            </p>
          </div>

          <StoryParticipantsDialog story={story} maxVisible={4} />

          <div className="flex items-center justify-between pt-1 text-xs text-[#5f6d7d]">
            <span>{formatDate(story.createdAt)}</span>
            <span className="font-semibold text-[#1f6f67]">Lesen</span>
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
    className="group rounded-2xl border border-[#d8d0c4] bg-[#fbfaf7] p-4 text-left shadow-[0_10px_24px_rgba(21,32,44,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(21,32,44,0.1)]"
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
      <span className="absolute -bottom-1 -right-1 rounded-full border border-[#deece8] bg-[#1f6f67] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        {avatar.creationType === "ai-generated" ? "AI" : "Foto"}
      </span>
      <span className="sr-only">{avatar.name}</span>
    </div>

    <p className="mt-3 truncate text-sm font-semibold text-[#17212d]">{avatar.name}</p>
    <p className="text-xs text-[#5f6d7d]">Zum Bearbeiten oeffnen</p>

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
    className="group rounded-2xl border border-[#d8d0c4] bg-[#fbfaf7] p-3 shadow-[0_10px_24px_rgba(21,32,44,0.06)]"
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
      <div className="h-16 w-16 overflow-hidden rounded-xl border border-[#e2d9cc] bg-[#efe8dc]">
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
            <p className="line-clamp-1 text-sm font-semibold text-[#17212d]">{doku.title}</p>
            <p className="line-clamp-1 text-xs text-[#5f6d7d]">{doku.topic}</p>
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
          <span className="rounded-full border border-[#e2d9cc] bg-[#f7f2e8] px-2 py-0.5 font-semibold uppercase tracking-wide text-[#607083]">
            {dokuStatusLabel[doku.status]}
          </span>
          <span className="text-[#607083]">{formatDate(doku.createdAt)}</span>
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
  <Card className="border-dashed border-[#d8d0c4] bg-[#fbfaf7]">
    <CardContent className="p-8 text-center">
      <h3 className="text-xl text-[#17212d]" style={{ fontFamily: headingFont }}>
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[#5f6d7d]">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1f6f67] px-4 py-2 text-sm font-semibold text-white"
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
  const reduceMotion = useReducedMotion();

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [dokus, setDokus] = useState<Doku[]>([]);
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
      <StudioBackground />

      <SignedOut>
        <SignedOutStart />
      </SignedOut>

      <SignedIn>
        <div className="space-y-7 pt-4">
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: -14 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          >
            <Card className="border-[#d8d0c4] bg-[#fbfaf7]/95 shadow-[0_18px_38px_rgba(21,32,44,0.09)] backdrop-blur">
              <CardContent className="grid gap-6 p-5 md:p-6 lg:grid-cols-[1.35fr_1fr]">
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-[#d8d0c4] p-1.5">
                        <UserButton
                          afterSignOutUrl="/"
                          userProfileMode="navigation"
                          userProfileUrl="/settings"
                          appearance={{ elements: { avatarBox: "h-10 w-10" } }}
                        />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#607083]">{greeting}</p>
                        <h1
                          className="text-3xl leading-tight text-[#16212c] md:text-4xl"
                          style={{ fontFamily: headingFont }}
                        >
                          {user?.firstName || "Talea Nutzer"}
                        </h1>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#d8d0c4] bg-[#f6f1e7] px-3 py-2 text-sm font-semibold text-[#17212d] transition-colors hover:bg-[#ece7dd]"
                    >
                      <RefreshCw
                        className={cn("h-4 w-4 text-[#1f6f67]", refreshing && "animate-spin")}
                      />
                      Aktualisieren
                    </button>
                  </div>

                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#5f6d7d]">
                    Dein Story-Workspace fuer Avatare, Geschichten und Wissensformate. Reduziertes,
                    professionelles Design mit direktem Zugriff auf alle Kernaktionen.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => navigate("/story")}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#1f6f67] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <WandSparkles className="h-4 w-4" />
                      Neue Story
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/avatar/create")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#d8d0c4] bg-[#fbfaf7] px-4 py-2.5 text-sm font-semibold text-[#17212d] transition-colors hover:bg-[#f3eee4]"
                    >
                      <UserPlus className="h-4 w-4 text-[#1f6f67]" />
                      Avatar erstellen
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/doku/create")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#d8d0c4] bg-[#fbfaf7] px-4 py-2.5 text-sm font-semibold text-[#17212d] transition-colors hover:bg-[#f3eee4]"
                    >
                      <Library className="h-4 w-4 text-[#1f6f67]" />
                      Doku schreiben
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#e0d8cb] bg-[#f6f1e7] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#607083]">
                      Geschichten
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-[#17212d]">{stories.length}</p>
                  </div>
                  <div className="rounded-xl border border-[#e0d8cb] bg-[#f6f1e7] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#607083]">
                      Avatare
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-[#17212d]">{avatars.length}</p>
                  </div>
                  <div className="rounded-xl border border-[#e0d8cb] bg-[#f6f1e7] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#607083]">
                      Dokus
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-[#17212d]">{dokus.length}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/stories")}
                    className="rounded-xl border border-[#bfdcd5] bg-[#deece8] p-3 text-left transition-colors hover:bg-[#d3e8e3]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#356f69]">
                      Bibliothek
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f6f67]">
                      Alle Stories
                      <ArrowRight className="h-4 w-4" />
                    </p>
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => navigate("/story")}
              className="rounded-2xl border border-[#d8d0c4] bg-[#fbfaf7] p-5 text-left shadow-[0_12px_28px_rgba(21,32,44,0.06)] transition-all hover:-translate-y-0.5"
            >
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#deece8] text-[#1f6f67]">
                <BookOpen className="h-5 w-5" />
              </div>
              <h3 className="text-lg text-[#16212c]" style={{ fontFamily: headingFont }}>
                Neue Geschichte
              </h3>
              <p className="mt-1 text-sm text-[#5f6d7d]">
                Mit Avataren und Charakteren direkt in den Story-Flow starten.
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate("/avatar")}
              className="rounded-2xl border border-[#d8d0c4] bg-[#fbfaf7] p-5 text-left shadow-[0_12px_28px_rgba(21,32,44,0.06)] transition-all hover:-translate-y-0.5"
            >
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#deece8] text-[#1f6f67]">
                <UserPlus className="h-5 w-5" />
              </div>
              <h3 className="text-lg text-[#16212c]" style={{ fontFamily: headingFont }}>
                Avatar Verwaltung
              </h3>
              <p className="mt-1 text-sm text-[#5f6d7d]">
                Teilnehmer pflegen, bearbeiten und wiederverwendbar halten.
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate("/doku")}
              className="rounded-2xl border border-[#d8d0c4] bg-[#fbfaf7] p-5 text-left shadow-[0_12px_28px_rgba(21,32,44,0.06)] transition-all hover:-translate-y-0.5"
            >
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#deece8] text-[#1f6f67]">
                <Library className="h-5 w-5" />
              </div>
              <h3 className="text-lg text-[#16212c]" style={{ fontFamily: headingFont }}>
                Wissens-Dokus
              </h3>
              <p className="mt-1 text-sm text-[#5f6d7d]">
                Inhalte erstellen und als strukturierte Bibliothek bereitstellen.
              </p>
            </button>
          </section>

          <section>
            <SectionHeading
              title="Aktuelle Geschichten"
              subtitle={`${stories.length} Eintraege in deiner Story-Bibliothek`}
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
                    className="rounded-2xl border border-dashed border-[#d8d0c4] bg-[#fbfaf7] p-4 text-left transition-colors hover:bg-[#f4efe5]"
                  >
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#deece8] text-[#1f6f67]">
                      <Plus className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#17212d]">Neuer Avatar</p>
                    <p className="text-xs text-[#5f6d7d]">Direkt im Wizard anlegen</p>
                  </button>
                </div>
              )}
            </div>

            <div>
              <SectionHeading
                title="Wissens-Dokus"
                subtitle={`${dokus.length} Dokumente und Entwuerfe`}
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
