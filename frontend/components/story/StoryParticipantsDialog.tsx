import React, { useMemo, useState } from "react";
import { Users } from "lucide-react";

import type { Story } from "@/types/story";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StoryParticipantsDialogProps {
  story: Story;
  maxVisible?: number;
  className?: string;
}

interface StoryParticipant {
  id: string;
  name: string;
  imageUrl: string;
  roleLabel: "Avatar" | "Charakter";
}

function fallbackImage(name: string, roleLabel: StoryParticipant["roleLabel"]) {
  const style = roleLabel === "Avatar" ? "avataaars" : "bottts";
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(name)}`;
}

function getParticipants(story: Story): StoryParticipant[] {
  const avatars = (story.config?.avatars || []).map((participant) => ({
    id: `avatar-${participant.id}`,
    name: participant.name,
    imageUrl: participant.imageUrl || fallbackImage(participant.name, "Avatar"),
    roleLabel: "Avatar" as const,
  }));

  const characters = (story.config?.characters || []).map((participant) => ({
    id: `character-${participant.id}`,
    name: participant.name,
    imageUrl:
      participant.imageUrl || fallbackImage(participant.name, "Charakter"),
    roleLabel: "Charakter" as const,
  }));

  return [...avatars, ...characters];
}

export function StoryParticipantsDialog({
  story,
  maxVisible = 4,
  className,
}: StoryParticipantsDialogProps) {
  const { resolvedTheme } = useTheme();
  const participants = useMemo(() => getParticipants(story), [story]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const isDark = resolvedTheme === "dark";

  if (participants.length === 0) return null;

  const visibleParticipants = participants.slice(0, maxVisible);
  const hiddenCount = participants.length - visibleParticipants.length;

  const activeParticipant =
    participants.find((participant) => participant.id === activeId) ||
    participants[0];

  const openDialogForParticipant = (
    participantId: string,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
    setActiveId(participantId);
    setOpen(true);
  };

  const openDialogForList = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setActiveId(participants[0]?.id || null);
    setOpen(true);
  };

  return (
    <>
      <div
        className={cn("mt-3 flex flex-wrap items-center gap-2", className)}
        onClick={(event) => event.stopPropagation()}
      >
        {visibleParticipants.map((participant) => (
          <button
            key={`${story.id}-${participant.id}`}
            type="button"
            onClick={(event) => openDialogForParticipant(participant.id, event)}
            className="inline-flex items-center gap-2 rounded-full border px-2 py-1 pr-3 text-xs font-medium transition-colors"
            style={{
              borderColor: isDark ? "#33465f" : "#d7d0c3",
              background: isDark ? "rgba(34,45,61,0.9)" : "#f7f4ef",
              color: isDark ? "#dde8f9" : "#1d2836",
            }}
            aria-label={`${participant.name} vergroessern`}
          >
            <img
              src={participant.imageUrl}
              alt={participant.name}
              className="h-6 w-6 rounded-full object-cover"
            />
            <span className="max-w-[120px] truncate">{participant.name}</span>
          </button>
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={openDialogForList}
            className="inline-flex h-8 items-center rounded-full border px-2 text-xs font-semibold transition-colors"
            style={{
              borderColor: isDark ? "#33465f" : "#d7d0c3",
              background: isDark ? "rgba(34,45,61,0.9)" : "#f7f4ef",
              color: isDark ? "#a7bbd6" : "#526174",
            }}
            aria-label={`Weitere ${hiddenCount} Teilnehmer anzeigen`}
          >
            +{hiddenCount}
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[440px] p-0"
          style={{
            borderColor: isDark ? "#33465f" : "#d7d0c3",
            background: isDark ? "rgba(24,34,48,0.98)" : "#fcfbf8",
          }}
        >
          <DialogHeader
            className="border-b px-6 py-4"
            style={{ borderColor: isDark ? "#32455f" : "#e5dfd4" }}
          >
            <DialogTitle className="flex items-center gap-2" style={{ color: isDark ? "#e6eef8" : "#1a2633" }}>
              <Users className="h-4 w-4" style={{ color: isDark ? "#7faea3" : "#1f6f67" }} />
              Teilnehmer
            </DialogTitle>
            <DialogDescription style={{ color: isDark ? "#9db0c8" : "#627180" }}>
              Charaktere und Avatare dieser Geschichte.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-6">
            <div
              className="flex items-center gap-4 rounded-2xl border p-4"
              style={{
                borderColor: isDark ? "#33465f" : "#e4ddd1",
                background: isDark ? "rgba(31,43,59,0.95)" : "#ffffff",
              }}
            >
              <img
                src={activeParticipant.imageUrl}
                alt={activeParticipant.name}
                className="h-20 w-20 rounded-2xl object-cover"
              />
              <div className="min-w-0">
                <p
                  className="truncate text-lg font-semibold"
                  style={{ color: isDark ? "#e6eef8" : "#1a2633" }}
                >
                  {activeParticipant.name}
                </p>
                <p
                  className="mt-1 text-sm font-medium"
                  style={{ color: isDark ? "#7faea3" : "#1f6f67" }}
                >
                  {activeParticipant.roleLabel}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {participants.map((participant) => {
                const isActive = participant.id === activeParticipant.id;
                return (
                  <button
                    key={`${story.id}-${participant.id}-preview`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveId(participant.id);
                    }}
                    className={cn(
                      "rounded-xl border p-1 transition-transform hover:-translate-y-0.5",
                      isActive ? "" : ""
                    )}
                    style={{
                      borderColor: isActive
                        ? isDark
                          ? "#7faea3"
                          : "#1f6f67"
                        : isDark
                          ? "#3a4e6a"
                          : "#ded6c8",
                      background: isActive
                        ? isDark
                          ? "rgba(127,174,163,0.18)"
                          : "#e3efec"
                        : isDark
                          ? "rgba(32,44,60,0.92)"
                          : "#f8f5ef",
                    }}
                    aria-label={`${participant.name} auswaehlen`}
                  >
                    <img
                      src={participant.imageUrl}
                      alt={participant.name}
                      className="h-14 w-full rounded-lg object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
