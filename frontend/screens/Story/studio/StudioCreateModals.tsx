import React, { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StudioCharacter } from "@/types/studio";

import { headingFont, type StudioPalette } from "./studioPalette";

interface CreateSeriesModalProps {
  palette: StudioPalette;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onCreate: (data: {
    title: string;
    logline: string;
    description: string;
    canonicalPrompt: string;
  }) => Promise<void>;
}

export const CreateSeriesModal: React.FC<CreateSeriesModalProps> = ({
  palette,
  open,
  saving,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState("");
  const [logline, setLogline] = useState("");
  const [description, setDescription] = useState("");
  const [canon, setCanon] = useState("");

  if (!open) return null;

  const submit = async () => {
    if (!title.trim()) return;
    await onCreate({
      title: title.trim(),
      logline: logline.trim(),
      description: description.trim(),
      canonicalPrompt: canon.trim(),
    });
    setTitle("");
    setLogline("");
    setDescription("");
    setCanon("");
  };

  return (
    <ModalShell palette={palette} onClose={onClose} title="Neue Serie anlegen">
      <p className={cn("text-sm", palette.textMuted)}>
        Lege Titel und Canon fest. Du kannst alles später erweitern und Charaktere hinzufügen.
      </p>
      <ModalInput
        palette={palette}
        label="Serientitel*"
        value={title}
        onChange={setTitle}
        placeholder='z.B. "Die Chroniken von Aedoria"'
      />
      <ModalInput
        palette={palette}
        label="Logline"
        value={logline}
        onChange={setLogline}
        placeholder="Eine packende Zeile, die alles sagt."
      />
      <ModalTextarea
        palette={palette}
        label="Welt & Vorgeschichte"
        value={description}
        onChange={setDescription}
        placeholder="Welt, Tonalität, was Leser:innen erwartet."
        rows={3}
      />
      <ModalTextarea
        palette={palette}
        label="Canon — feste Regeln für alle Folgen"
        value={canon}
        onChange={setCanon}
        placeholder="Magie-Regeln, Zeitachse, Themen, Verbote — was nie verletzt werden darf."
        rows={3}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className={cn("inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold", palette.border, palette.text)}
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !title.trim()}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-50",
            palette.primary,
            palette.primaryText,
            palette.primaryBorder
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Serie erstellen
        </button>
      </div>
    </ModalShell>
  );
};

interface CreateEpisodeModalProps {
  palette: StudioPalette;
  open: boolean;
  saving: boolean;
  defaultEpisodeNumber: number;
  characters: StudioCharacter[];
  onClose: () => void;
  onCreate: (data: { episodeNumber: number; title: string; selectedCharacterIds: string[] }) => Promise<void>;
}

export const CreateEpisodeModal: React.FC<CreateEpisodeModalProps> = ({
  palette,
  open,
  saving,
  defaultEpisodeNumber,
  characters,
  onClose,
  onCreate,
}) => {
  const [episodeNumber, setEpisodeNumber] = useState(defaultEpisodeNumber);
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(characters.map((c) => c.id));

  React.useEffect(() => {
    if (open) {
      setEpisodeNumber(defaultEpisodeNumber);
      setTitle("");
      setSelectedIds(characters.map((c) => c.id));
    }
  }, [open, defaultEpisodeNumber, characters]);

  if (!open) return null;

  const submit = async () => {
    if (!title.trim() || episodeNumber <= 0) return;
    await onCreate({
      episodeNumber,
      title: title.trim(),
      selectedCharacterIds: selectedIds.length > 0 ? selectedIds : characters.map((c) => c.id),
    });
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  return (
    <ModalShell palette={palette} onClose={onClose} title="Neue Folge anlegen">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr]">
        <ModalInput
          palette={palette}
          label="Folge Nr."
          value={String(episodeNumber)}
          onChange={(v) => setEpisodeNumber(Number(v) || 1)}
          type="number"
        />
        <ModalInput
          palette={palette}
          label="Folgentitel*"
          value={title}
          onChange={setTitle}
          placeholder="z.B. Der erste Funke"
        />
      </div>

      {characters.length > 0 && (
        <div>
          <p className={cn("mb-2 text-[10px] font-bold uppercase tracking-[0.16em]", palette.textDim)}>
            Charaktere in dieser Folge
          </p>
          <div className="flex flex-wrap gap-2">
            {characters.map((c) => {
              const active = selectedIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : `${palette.border} ${palette.textMuted}`
                  )}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className={cn("inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold", palette.border, palette.text)}
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !title.trim()}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-50",
            palette.primary,
            palette.primaryText,
            palette.primaryBorder
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Folge anlegen
        </button>
      </div>
    </ModalShell>
  );
};

const ModalShell: React.FC<{
  palette: StudioPalette;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ palette, title, onClose, children }) => (
  <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("w-full max-w-xl space-y-4 rounded-3xl border p-6 shadow-2xl", palette.cardElevated, palette.border)}
    >
      <div className="flex items-center justify-between">
        <h3 className={cn("text-2xl", palette.text)} style={{ fontFamily: headingFont }}>
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className={cn("rounded-lg border p-2", palette.border, palette.text)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </motion.div>
  </div>
);

const ModalInput: React.FC<{
  palette: StudioPalette;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}> = ({ palette, label, value, onChange, placeholder, type }) => (
  <label className="block">
    <span className={cn("mb-1 block text-[10px] font-bold uppercase tracking-[0.16em]", palette.textDim)}>{label}</span>
    <input
      type={type || "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn("h-11 w-full rounded-xl border px-3 text-sm outline-none", palette.input)}
    />
  </label>
);

const ModalTextarea: React.FC<{
  palette: StudioPalette;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}> = ({ palette, label, value, onChange, placeholder, rows = 3 }) => (
  <label className="block">
    <span className={cn("mb-1 block text-[10px] font-bold uppercase tracking-[0.16em]", palette.textDim)}>{label}</span>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn("w-full rounded-xl border px-3 py-2 text-sm leading-relaxed outline-none", palette.input)}
    />
  </label>
);
