import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from "framer-motion";
import { BookOpen, LoaderCircle, Quote, RefreshCw, Sparkles, Tag, UserRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useBackend } from "../../hooks/useBackend";
import { cn } from "@/lib/utils";
import {
  TaleaActionButton,
  taleaChipClass,
  taleaDisplayFont,
  taleaInsetSurfaceClass,
  taleaSurfaceClass,
} from "@/components/talea/TaleaPastelPrimitives";

type CharacterProfile = {
  id: string;
  name: string;
  role: string;
  archetype: string;
  imageUrl?: string;
  isActive?: boolean;
  visualProfile?: { description?: string; species?: string; colorPalette?: string[] };
  emotionalNature?: { dominant?: string; secondary?: string[] };
  physical_description?: string;
  backstory?: string;
  dominantPersonality?: string;
  secondaryTraits?: string[];
  personality_keywords?: string[];
  catchphrase?: string;
  speechStyle?: string[];
  quirk?: string;
};

type PublishedOrigin = { id: string; characterId: string };

const characterDetailText = (character: CharacterProfile) =>
  character.physical_description || character.visualProfile?.description || character.backstory || "Ein wiederkehrender Charakter aus der Talea-Welt.";

const CharacterDetailSheet: React.FC<{
  character: CharacterProfile;
  originStoryId?: string;
  onClose: () => void;
  onReadLifeStory: (storyId: string) => void;
}> = ({ character, originStoryId, onClose, onReadLifeStory }) => {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) {
      onClose();
    }
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Profil von ${character.name}`}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] shadow-[0_-18px_48px_rgba(18,28,39,0.35)]"
        initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
        animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        drag={reduceMotion ? false : "y"}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={handleDragEnd}
      >
        <div
          className="relative shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={(event) => {
            if (!reduceMotion) dragControls.start(event);
          }}
        >
          <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-3" aria-hidden="true">
            <div className="h-1.5 w-12 rounded-full bg-white/80 shadow-sm dark:bg-white/45" />
          </div>

          <button
            type="button"
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            aria-label="Schließen"
          >
            <X className="h-4.5 w-4.5" />
          </button>

          <div className="relative max-h-[46vh] overflow-hidden bg-[var(--talea-surface-inset)]">
            {character.imageUrl ? (
              <>
                <img
                  src={character.imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-60"
                  draggable={false}
                />
                <img
                  src={character.imageUrl}
                  alt={character.name}
                  className="relative mx-auto max-h-[46vh] w-auto max-w-full object-contain"
                  draggable={false}
                />
              </>
            ) : (
              <div className="flex h-48 items-center justify-center sm:h-64">
                <UserRound className="h-16 w-16 text-[var(--talea-text-tertiary)]" aria-hidden="true" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-6 pb-5 pt-16 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                {character.role} · {character.archetype}
              </p>
              <h3 className="mt-1.5 text-3xl font-semibold text-white sm:text-4xl" style={{ fontFamily: taleaDisplayFont }}>
                {character.name}
              </h3>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-8">
          <p className="text-base leading-7 text-[var(--talea-text-secondary)]">{characterDetailText(character)}</p>

          {character.backstory ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--talea-text-tertiary)]">Vorgeschichte</p>
              <p className="mt-2 leading-7 text-[var(--talea-text-secondary)]">{character.backstory}</p>
            </section>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--talea-text-tertiary)]">Persönlichkeit</p>
              <p className="mt-2 font-semibold text-[var(--talea-text-primary)]">
                {character.dominantPersonality || character.emotionalNature?.dominant || "Vielschichtig"}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--talea-text-secondary)]">
                {(character.secondaryTraits || character.emotionalNature?.secondary || []).join(" · ") || "Entfaltet sich in jeder Geschichte neu."}
              </p>
            </section>
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--talea-text-tertiary)]">Besonderheit</p>
              <p className="mt-2 text-sm leading-6 text-[var(--talea-text-secondary)]">
                {character.quirk || character.visualProfile?.species || "Eine unverwechselbare Figur der Talea-Welt."}
              </p>
            </section>
          </div>

          {(character.personality_keywords || []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {character.personality_keywords?.map((keyword) => (
                <span key={keyword} className={cn(taleaChipClass, "inline-flex items-center gap-1")}>
                  <Tag className="h-3 w-3" aria-hidden="true" />
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
          {character.catchphrase ? (
            <blockquote className={cn(taleaInsetSurfaceClass, "flex gap-3 p-4 text-[var(--talea-text-secondary)]")}>
              <Quote className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <span>„{character.catchphrase}“</span>
            </blockquote>
          ) : null}

          {originStoryId ? (
            <TaleaActionButton type="button" icon={<BookOpen className="h-4 w-4" />} onClick={() => onReadLifeStory(originStoryId)}>
              Lebensgeschichte lesen
            </TaleaActionButton>
          ) : null}
        </div>
      </motion.div>
    </>
  );
};

const CharacterProfilesPanel: React.FC = () => {
  const backend = useBackend();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [originsByCharacterId, setOriginsByCharacterId] = useState<Record<string, string>>({});
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRequestId = useRef(0);

  const loadProfiles = useCallback(async () => {
    const requestId = ++loadRequestId.current;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLoading(false);
      setError("Du bist offline. Sobald die Verbindung wiederhergestellt ist, laden wir die Charakterprofile automatisch.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const characterResponse = await backend.story.listCharacters();
      if (requestId !== loadRequestId.current) return;
      setCharacters(((characterResponse.characters || []) as CharacterProfile[]).filter((character) => character.isActive !== false));

      try {
        const originResponse = await backend.story.listPublishedCharacterLifeStories();
        if (requestId !== loadRequestId.current) return;
        const nextOrigins: Record<string, string> = {};
        for (const origin of (originResponse.stories || []) as PublishedOrigin[]) {
          nextOrigins[origin.characterId] = origin.id;
        }
        setOriginsByCharacterId(nextOrigins);
      } catch {
        if (requestId !== loadRequestId.current) return;
        setOriginsByCharacterId({});
      }
    } catch {
      if (requestId !== loadRequestId.current) return;
      setError(
        "Die Charakterprofile konnten gerade nicht geladen werden. Bitte prüfe deine Internetverbindung und versuche es erneut."
      );
    } finally {
      if (requestId === loadRequestId.current) {
        setLoading(false);
      }
    }
  }, [backend]);

  useEffect(() => {
    void loadProfiles();

    const retryWhenOnline = () => {
      void loadProfiles();
    };
    window.addEventListener("online", retryWhenOnline);

    return () => {
      loadRequestId.current += 1;
      window.removeEventListener("online", retryWhenOnline);
    };
  }, [loadProfiles]);

  const visibleCharacters = useMemo(
    () => [...characters].sort((a, b) => a.name.localeCompare(b.name, "de")),
    [characters]
  );

  return (
    <section className="space-y-5" aria-label="Charakterprofile">
      <div className={cn(taleaSurfaceClass, "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6")}>
        <div>
          <span className={taleaChipClass}>Talea Figurenwelt</span>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>
            Charaktere entdecken
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--talea-text-secondary)]">
            Lerne die wiederkehrenden Figuren kennen, die deine Geschichten mitgestalten.
          </p>
        </div>
        <TaleaActionButton variant="secondary" type="button" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadProfiles()}>
          Aktualisieren
        </TaleaActionButton>
      </div>

      {loading ? (
        <div className={cn(taleaInsetSurfaceClass, "flex min-h-52 items-center justify-center gap-3 p-8 text-sm font-semibold text-[var(--talea-text-secondary)]")} role="status">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          Charakterprofile werden geladen …
        </div>
      ) : error ? (
        <div className={cn(taleaInsetSurfaceClass, "p-8 text-center")} role="alert">
          <p className="font-semibold text-[var(--talea-text-primary)]">{error}</p>
          <TaleaActionButton className="mt-5" type="button" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadProfiles()}>
            Erneut versuchen
          </TaleaActionButton>
        </div>
      ) : visibleCharacters.length === 0 ? (
        <div className={cn(taleaInsetSurfaceClass, "p-10 text-center")}>
          <UserRound className="mx-auto h-10 w-10 text-[var(--talea-text-tertiary)]" aria-hidden="true" />
          <h3 className="mt-4 text-2xl font-semibold text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>
            Noch keine Charaktere verfügbar
          </h3>
          <p className="mt-2 text-sm text-[var(--talea-text-secondary)]">Sobald die Redaktion Charaktere freischaltet, erscheinen sie hier.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleCharacters.map((character, index) => (
            <motion.button
              key={character.id}
              type="button"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: Math.min(index * 0.035, 0.21) }}
              whileHover={reduceMotion ? undefined : { y: -3 }}
              whileTap={reduceMotion ? undefined : { scale: 0.99 }}
              onClick={() => setSelectedCharacter(character)}
              className="group overflow-hidden rounded-3xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] text-left shadow-[0_12px_28px_rgba(33,44,62,0.1)] transition-shadow hover:shadow-[0_18px_34px_rgba(33,44,62,0.15)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--primary)_26%,transparent)]"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-[var(--talea-surface-inset)]">
                {character.imageUrl ? (
                  <img src={character.imageUrl} alt={character.name} className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : (
                  <div className="flex h-full items-center justify-center"><UserRound className="h-12 w-12 text-[var(--talea-text-tertiary)]" aria-hidden="true" /></div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-12">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/75">{character.role}</p>
                  <p className="mt-1 text-xl font-semibold text-white" style={{ fontFamily: taleaDisplayFont }}>{character.name}</p>
                </div>
              </div>
              <div className="p-4">
                <p className="line-clamp-2 text-sm font-medium leading-6 text-[var(--talea-text-secondary)]">{characterDetailText(character)}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)]"><Sparkles className="h-4 w-4" aria-hidden="true" />Profil öffnen</span>
                  {originsByCharacterId[character.id] ? <BookOpen className="h-4 w-4 text-[var(--talea-text-tertiary)]" aria-label="Lebensgeschichte verfügbar" /> : null}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedCharacter ? (
          <CharacterDetailSheet
            key={selectedCharacter.id}
            character={selectedCharacter}
            originStoryId={originsByCharacterId[selectedCharacter.id]}
            onClose={() => setSelectedCharacter(null)}
            onReadLifeStory={(storyId) => navigate(`/character-life-story/${storyId}`)}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
};

export default CharacterProfilesPanel;
