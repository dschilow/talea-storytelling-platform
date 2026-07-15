import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, LoaderCircle, Quote, RefreshCw, Sparkles, Tag, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useBackend } from "../../hooks/useBackend";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const CharacterProfilesPanel: React.FC = () => {
  const backend = useBackend();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [originsByCharacterId, setOriginsByCharacterId] = useState<Record<string, string>>({});
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const characterResponse = await backend.story.listCharacters();
      setCharacters(((characterResponse.characters || []) as CharacterProfile[]).filter((character) => character.isActive !== false));

      try {
        const originResponse = await backend.story.listPublishedCharacterLifeStories();
        const nextOrigins: Record<string, string> = {};
        for (const origin of (originResponse.stories || []) as PublishedOrigin[]) {
          nextOrigins[origin.characterId] = origin.id;
        }
        setOriginsByCharacterId(nextOrigins);
      } catch (originError) {
        console.warn("[CharacterProfiles] Origins could not be loaded", originError);
        setOriginsByCharacterId({});
      }
    } catch (loadError) {
      console.error("[CharacterProfiles] Profile load failed", loadError);
      setError("Die Charakterprofile konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const visibleCharacters = useMemo(
    () => [...characters].sort((a, b) => a.name.localeCompare(b.name, "de")),
    [characters]
  );

  const detailText = (character: CharacterProfile) =>
    character.physical_description || character.visualProfile?.description || character.backstory || "Ein wiederkehrender Charakter aus der Talea-Welt.";

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
              <div className="relative aspect-[16/10] overflow-hidden bg-[var(--talea-surface-inset)]">
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
                <p className="line-clamp-2 text-sm font-medium leading-6 text-[var(--talea-text-secondary)]">{detailText(character)}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)]"><Sparkles className="h-4 w-4" aria-hidden="true" />Profil öffnen</span>
                  {originsByCharacterId[character.id] ? <BookOpen className="h-4 w-4 text-[var(--talea-text-tertiary)]" aria-label="Lebensgeschichte verfügbar" /> : null}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selectedCharacter)} onOpenChange={(open) => !open && setSelectedCharacter(null)}>
        {selectedCharacter ? (
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-0">
            <div className="relative min-h-48 overflow-hidden bg-[var(--talea-surface-inset)] sm:min-h-64">
              {selectedCharacter.imageUrl ? <img src={selectedCharacter.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-top" /> : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <DialogHeader className="absolute inset-x-0 bottom-0 p-6 text-left sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">{selectedCharacter.role} · {selectedCharacter.archetype}</p>
                <DialogTitle className="mt-2 text-3xl font-semibold text-white sm:text-4xl" style={{ fontFamily: taleaDisplayFont }}>{selectedCharacter.name}</DialogTitle>
                <DialogDescription className="sr-only">Profil von {selectedCharacter.name}</DialogDescription>
              </DialogHeader>
            </div>
            <div className="space-y-6 p-6 sm:p-8">
              <p className="text-base leading-7 text-[var(--talea-text-secondary)]">{detailText(selectedCharacter)}</p>

              {selectedCharacter.backstory ? (
                <section><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--talea-text-tertiary)]">Vorgeschichte</p><p className="mt-2 leading-7 text-[var(--talea-text-secondary)]">{selectedCharacter.backstory}</p></section>
              ) : null}

              <div className="grid gap-5 sm:grid-cols-2">
                <section><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--talea-text-tertiary)]">Persönlichkeit</p><p className="mt-2 font-semibold text-[var(--talea-text-primary)]">{selectedCharacter.dominantPersonality || selectedCharacter.emotionalNature?.dominant || "Vielschichtig"}</p><p className="mt-1 text-sm leading-6 text-[var(--talea-text-secondary)]">{(selectedCharacter.secondaryTraits || selectedCharacter.emotionalNature?.secondary || []).join(" · ") || "Entfaltet sich in jeder Geschichte neu."}</p></section>
                <section><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--talea-text-tertiary)]">Besonderheit</p><p className="mt-2 text-sm leading-6 text-[var(--talea-text-secondary)]">{selectedCharacter.quirk || selectedCharacter.visualProfile?.species || "Eine unverwechselbare Figur der Talea-Welt."}</p></section>
              </div>

              {(selectedCharacter.personality_keywords || []).length > 0 ? <div className="flex flex-wrap gap-2">{selectedCharacter.personality_keywords?.map((keyword) => <span key={keyword} className={cn(taleaChipClass, "inline-flex items-center gap-1")}><Tag className="h-3 w-3" aria-hidden="true" />{keyword}</span>)}</div> : null}
              {selectedCharacter.catchphrase ? <blockquote className={cn(taleaInsetSurfaceClass, "flex gap-3 p-4 text-[var(--talea-text-secondary)]")}><Quote className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden="true" /><span>„{selectedCharacter.catchphrase}“</span></blockquote> : null}

              {originsByCharacterId[selectedCharacter.id] ? <TaleaActionButton type="button" icon={<BookOpen className="h-4 w-4" />} onClick={() => navigate(`/character-life-story/${originsByCharacterId[selectedCharacter.id]}`)}>Lebensgeschichte lesen</TaleaActionButton> : null}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
};

export default CharacterProfilesPanel;
