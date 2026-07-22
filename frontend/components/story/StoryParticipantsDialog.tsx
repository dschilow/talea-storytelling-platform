import React, { useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import { Quote, Sparkles, Tag, UserRound, Users, X } from "lucide-react";

import type { Character, Story } from "@/types/story";
import { cn } from "@/lib/utils";
import { taleaDisplayFont } from "@/components/talea/TaleaPastelPrimitives";

interface StoryParticipantsDialogProps {
  story: Story;
  maxVisible?: number;
  className?: string;
}

type ParticipantKind = "avatar" | "character";

interface StoryParticipant {
  key: string;
  kind: ParticipantKind;
  name: string;
  imageUrl?: string;
  roleLabel: "Avatar" | "Charakter";
  role?: string;
  archetype?: string;
  description: string;
  backstory?: string;
  dominantPersonality?: string;
  traits: string[];
  catchphrase?: string;
  quirk?: string;
  species?: string;
}

const ROLE_LABELS: Record<string, string> = {
  guide: "Wegweiser",
  companion: "Begleiter",
  obstacle: "Herausforderung",
  discovery: "Entdeckerfigur",
  support: "Nebenfigur",
  special: "Besondere Figur",
};

function humanize(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = ROLE_LABELS[value.toLowerCase()] || value.replaceAll("_", " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function characterDescription(character: Character): string {
  return (
    character.physicalDescription ||
    character.visualProfile?.description ||
    character.backstory ||
    `${character.name} ist eine Figur aus dieser Geschichte.`
  );
}

function getParticipants(story: Story): StoryParticipant[] {
  const avatars = (story.config?.avatars || []).map((participant) => ({
    key: `avatar-${participant.id}`,
    kind: "avatar" as const,
    name: participant.name,
    imageUrl: participant.imageUrl || undefined,
    roleLabel: "Avatar" as const,
    role: "Avatar",
    description:
      participant.description ||
      participant.physicalTraits?.appearance ||
      `${participant.name} erlebt dieses Abenteuer als Avatar mit.`,
    backstory: participant.narrativeProfile?.backstory,
    dominantPersonality: participant.narrativeProfile?.dominantPersonality,
    traits: uniqueStrings(participant.narrativeProfile?.traits || []),
    catchphrase: participant.narrativeProfile?.catchphrase,
    quirk: participant.narrativeProfile?.quirk,
  }));

  const characters = (story.config?.characters || []).map((participant) => ({
    key: `character-${participant.id}`,
    kind: "character" as const,
    name: participant.name,
    imageUrl: participant.imageUrl || undefined,
    roleLabel: "Charakter" as const,
    role: humanize(participant.role) || "Charakter",
    archetype: humanize(participant.archetype),
    description: characterDescription(participant),
    backstory: participant.backstory,
    dominantPersonality:
      participant.dominantPersonality || participant.emotionalNature?.dominant,
    traits: uniqueStrings([
      ...(participant.personalityKeywords || []),
      ...(participant.secondaryTraits || []),
      ...(participant.emotionalNature?.secondary || []),
    ]),
    catchphrase: participant.catchphrase,
    quirk: participant.quirk,
    species: humanize(participant.visualProfile?.species),
  }));

  return [...avatars, ...characters];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

const ParticipantPortrait: React.FC<{
  participant: StoryParticipant;
  className?: string;
  imageClassName?: string;
  decorative?: boolean;
}> = ({ participant, className, imageClassName, decorative = false }) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const canShowImage = Boolean(participant.imageUrl && failedUrl !== participant.imageUrl);

  return (
    <div
      className={cn(
        "relative isolate flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-[#dceee9] via-[#f6eadc] to-[#e8dff2] dark:from-[#28433f] dark:via-[#3b342e] dark:to-[#3d3550]",
        className
      )}
      aria-label={!decorative && !canShowImage ? `${participant.name}, noch ohne Profilbild` : undefined}
      role={!decorative && !canShowImage ? "img" : undefined}
    >
      {canShowImage ? (
        <img
          src={participant.imageUrl}
          alt={decorative ? "" : participant.name}
          className={cn("h-full w-full object-cover object-top", imageClassName)}
          onError={() => setFailedUrl(participant.imageUrl || null)}
          draggable={false}
        />
      ) : (
        <>
          <UserRound className="absolute h-3/5 w-3/5 text-[#2f756b]/18 dark:text-white/10" aria-hidden="true" />
          <span className="relative text-sm font-bold tracking-wide text-[#285f58] dark:text-[#c8e1dc]" aria-hidden="true">
            {initials(participant.name)}
          </span>
        </>
      )}
    </div>
  );
};

const ParticipantProfile: React.FC<{ participant: StoryParticipant }> = ({ participant }) => {
  const hasDetails = Boolean(participant.backstory || participant.dominantPersonality || participant.quirk || participant.traits.length);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="grid gap-6 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:grid-cols-[minmax(220px,0.82fr)_minmax(0,1.18fr)] sm:p-7 sm:pb-8">
        <div>
          <ParticipantPortrait
            participant={participant}
            className="aspect-[4/3] w-full rounded-[1.6rem] border border-[var(--talea-border-light)] shadow-[0_16px_34px_rgba(38,50,66,0.16)] sm:aspect-[4/5]"
            imageClassName="transition-transform duration-300"
          />
          {!participant.imageUrl ? (
            <p className="mt-2 text-center text-xs font-medium text-[var(--talea-text-tertiary)]">
              Für diese Figur ist noch kein Profilbild hinterlegt.
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)]">
              {participant.kind === "avatar" ? <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> : <UserRound className="h-3.5 w-3.5" aria-hidden="true" />}
              {participant.roleLabel}
            </span>
            {participant.role && participant.role !== participant.roleLabel ? (
              <span className="rounded-full bg-[var(--talea-surface-inset)] px-3 py-1.5 text-xs font-semibold text-[var(--talea-text-secondary)]">
                {participant.role}
              </span>
            ) : null}
          </div>

          <h3 className="mt-4 text-3xl font-semibold leading-tight text-[var(--talea-text-primary)] sm:text-4xl" style={{ fontFamily: taleaDisplayFont }}>
            {participant.name}
          </h3>
          {participant.archetype ? (
            <p className="mt-1 text-sm font-semibold text-[var(--talea-text-tertiary)]">{participant.archetype}</p>
          ) : null}

          <p className="mt-5 text-[15px] font-medium leading-7 text-[var(--talea-text-secondary)] sm:text-base">
            {participant.description}
          </p>

          {participant.backstory && participant.backstory !== participant.description ? (
            <section className="mt-6 border-t border-[var(--talea-border-light)] pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--talea-text-tertiary)]">Vorgeschichte</p>
              <p className="mt-2 text-sm leading-6 text-[var(--talea-text-secondary)]">{participant.backstory}</p>
            </section>
          ) : null}

          {hasDetails ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {participant.dominantPersonality ? (
                <section className="rounded-2xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--talea-text-tertiary)]">Persönlichkeit</p>
                  <p className="mt-2 font-semibold text-[var(--talea-text-primary)]">{humanize(participant.dominantPersonality)}</p>
                </section>
              ) : null}
              {participant.quirk || participant.species ? (
                <section className="rounded-2xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--talea-text-tertiary)]">Besonderheit</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-[var(--talea-text-secondary)]">{participant.quirk || participant.species}</p>
                </section>
              ) : null}
            </div>
          ) : null}

          {participant.traits.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2" aria-label="Charaktereigenschaften">
              {participant.traits.slice(0, 8).map((trait) => (
                <span key={trait} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--talea-border-light)] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[var(--talea-text-secondary)] dark:bg-white/5">
                  <Tag className="h-3 w-3 text-[var(--primary)]" aria-hidden="true" />
                  {humanize(trait)}
                </span>
              ))}
            </div>
          ) : null}

          {participant.catchphrase ? (
            <blockquote className="mt-6 flex gap-3 rounded-2xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] p-4 text-sm italic leading-6 text-[var(--talea-text-secondary)]">
              <Quote className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <span>„{participant.catchphrase}“</span>
            </blockquote>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export function StoryParticipantsDialog({ story, maxVisible = 4, className }: StoryParticipantsDialogProps) {
  const participants = useMemo(() => getParticipants(story), [story]);
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  if (participants.length === 0) return null;

  const visibleParticipants = participants.slice(0, maxVisible);
  const hiddenCount = participants.length - visibleParticipants.length;
  const activeParticipant = participants.find((participant) => participant.key === activeKey) || participants[0];

  const openSheet = (participantKey: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    lastTriggerRef.current = event.currentTarget;
    setActiveKey(participantKey);
    setOpen(true);
  };

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
      <div
        className={cn("flex flex-wrap items-center gap-2", className)}
        onClick={(event) => event.stopPropagation()}
      >
        {visibleParticipants.map((participant) => (
          <button
            key={`${story.id}-${participant.key}`}
            type="button"
            onClick={(event) => openSheet(participant.key, event)}
            className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-[var(--talea-border-light)] bg-white/80 py-1.5 pl-1.5 pr-3 text-xs font-semibold text-[var(--talea-text-primary)] shadow-[0_4px_12px_rgba(78,64,52,0.05)] transition hover:border-[var(--primary)]/35 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20 dark:bg-white/5 dark:hover:bg-white/10"
            aria-label={`Profil von ${participant.name} öffnen`}
            aria-haspopup="dialog"
          >
            <ParticipantPortrait participant={participant} decorative className="h-8 w-8 rounded-full border border-white/70 dark:border-white/10" />
            <span className="max-w-[128px] truncate">{participant.name}</span>
          </button>
        ))}
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={(event) => openSheet(participants[0].key, event)}
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--talea-border-light)] bg-white/80 px-3 text-xs font-bold text-[var(--talea-text-secondary)] transition hover:border-[var(--primary)]/35 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20 dark:bg-white/5 dark:hover:bg-white/10"
            aria-label={`${hiddenCount} weitere Teilnehmer anzeigen`}
            aria-haspopup="dialog"
          >
            +{hiddenCount}
          </button>
        ) : null}
      </div>

      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 z-[3000] bg-[#111827]/55 backdrop-blur-[2px]"
          onClick={(event) => event.stopPropagation()}
        />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[3001] mx-auto flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] shadow-[0_-22px_60px_rgba(18,28,39,0.3)] outline-none"
          onClick={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            lastTriggerRef.current?.focus();
          }}
          aria-describedby="story-participants-description"
        >
          <div className="shrink-0 border-b border-[var(--talea-border-light)] px-5 pb-4 pt-3 sm:px-7">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[var(--talea-text-tertiary)]/35" aria-hidden="true" />
            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <Drawer.Title className="flex items-center gap-2 text-lg font-semibold text-[var(--talea-text-primary)]">
                  <Users className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
                  Teilnehmer
                </Drawer.Title>
                <Drawer.Description id="story-participants-description" className="mt-1 text-sm text-[var(--talea-text-secondary)]">
                  Avatare und Charaktere aus „{story.title}“.
                </Drawer.Description>
              </div>
              <Drawer.Close asChild>
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] text-[var(--talea-text-secondary)] transition hover:text-[var(--talea-text-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20"
                  aria-label="Teilnehmerprofil schließen"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </Drawer.Close>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Teilnehmer auswählen">
              {participants.map((participant) => {
                const isActive = participant.key === activeParticipant.key;
                return (
                  <button
                    key={`${story.id}-${participant.key}-sheet`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveKey(participant.key);
                    }}
                    className={cn(
                      "inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border py-1.5 pl-1.5 pr-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20",
                      isActive
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--talea-text-primary)]"
                        : "border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] text-[var(--talea-text-secondary)] hover:border-[var(--primary)]/35"
                    )}
                    aria-pressed={isActive}
                    aria-label={`${participant.name} auswählen`}
                  >
                    <ParticipantPortrait participant={participant} decorative className="h-9 w-9 rounded-xl" />
                    <span>
                      <span className="block max-w-[150px] truncate text-xs font-bold">{participant.name}</span>
                      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-70">{participant.roleLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <ParticipantProfile key={activeParticipant.key} participant={activeParticipant} />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
