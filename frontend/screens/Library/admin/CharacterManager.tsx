import React, { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Brush, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { useBackend } from "@/hooks/useBackend";
import { cn } from "@/lib/utils";
import { taleaDisplayFont, taleaInputClass, taleaSurfaceClass } from "@/components/talea/TaleaPastelPrimitives";
import { errorMessage, ROLE_LABELS, type LibraryAdminCharacter } from "../libraryShared";

type Role = "protagonist" | "sidekick" | "antagonist" | "recurring";

interface Draft {
  id?: string;
  name: string;
  role: Role;
  ageYears: string;
  personality: string;
  speechStyle: string;
  visualProfileEn: string;
  allowedInBranches: boolean;
  active: boolean;
}

const EMPTY: Draft = { name: "", role: "recurring", ageYears: "", personality: "", speechStyle: "", visualProfileEn: "", allowedInBranches: true, active: true };

/**
 * The cast of a series: every figure can be read on its own, edited and
 * extended. The pipeline writes with the active cast; the reference picture is
 * what keeps a figure looking the same in every episode.
 */
export const CharacterManager: React.FC<{ slug: string; characters: LibraryAdminCharacter[]; onChanged: () => void }> = ({ slug, characters, onChanged }) => {
  const backend = useBackend();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [drawing, setDrawing] = useState<string | null>(null);

  const edit = (character: LibraryAdminCharacter) =>
    setDraft({
      id: character.id,
      name: character.name,
      role: (character.role as Role) || "recurring",
      ageYears: character.ageYears ? String(character.ageYears) : "",
      personality: character.personality,
      speechStyle: character.speechStyle,
      visualProfileEn: character.visualProfileEn,
      allowedInBranches: character.allowedInBranches,
      active: character.active,
    });

  const drawPortrait = async (characterId: string) => {
    setDrawing(characterId);
    try {
      await backend.story.libraryAdminDrawPortrait({ slug, characterId });
      toast.success("Neues Referenzbild gemalt.");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "Das Referenzbild konnte nicht gemalt werden."));
    } finally {
      setDrawing(null);
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const body = {
      name: draft.name.trim(),
      role: draft.role,
      ageYears: Number(draft.ageYears) > 0 ? Number(draft.ageYears) : undefined,
      personality: draft.personality.trim(),
      speechStyle: draft.speechStyle.trim(),
      visualProfileEn: draft.visualProfileEn.trim(),
      allowedInBranches: draft.allowedInBranches,
    };
    try {
      if (draft.id) {
        await backend.story.libraryAdminUpdateCharacter({ slug, characterId: draft.id, ...body, active: draft.active });
        toast.success(`${body.name} gespeichert.`);
      } else {
        const created = await backend.story.libraryAdminCreateCharacter({ slug, ...body });
        toast.success(`${created.name} gehört jetzt zur Reihe. Das Referenzbild wird gemalt …`);
        setDraft(null);
        onChanged();
        await drawPortrait(created.id);
        return;
      }
      setDraft(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "Speichern hat nicht geklappt."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[1.2rem] font-bold text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>Figuren der Reihe</h3>
          <p className="text-[14px] text-[var(--talea-text-secondary)]">Jede neue Folge wird mit den aktiven Figuren geschrieben. Das Referenzbild hält ihr Aussehen in allen Bildern gleich.</p>
        </div>
        <button type="button" onClick={() => setDraft({ ...EMPTY })} className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--primary)] px-4 text-[14px] font-semibold text-white">
          <Plus className="h-4 w-4" /> Neue Figur
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {characters.map((character) => (
          <article key={character.id} className={cn(taleaSurfaceClass, "flex flex-col", !character.active && "opacity-55")}>
            <div className="relative aspect-square bg-white">
              {character.imageUrl ? <img src={character.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain" /> : (
                <span className="flex h-full items-center justify-center p-3 text-center text-[13px] text-[var(--talea-text-tertiary)]">Noch kein Referenzbild</span>
              )}
              {drawing === character.id ? (
                <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" /></span>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--talea-text-tertiary)]">
                {ROLE_LABELS[character.role] ?? character.role}{character.active ? "" : " · pausiert"}{character.allowedInBranches ? "" : " · geheim"}
              </span>
              <span className="text-[15px] font-bold text-[var(--talea-text-primary)]">{character.name}</span>
              <div className="mt-auto flex gap-1.5 pt-2">
                <button type="button" onClick={() => edit(character)} className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-[var(--talea-surface-inset)] text-[13px] font-semibold text-[var(--primary)]">
                  <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                </button>
                <button
                  type="button"
                  onClick={() => void drawPortrait(character.id)}
                  disabled={drawing !== null}
                  aria-label={`Referenzbild von ${character.name} neu malen`}
                  title="Referenzbild neu malen"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--talea-surface-inset)] text-[var(--primary)] disabled:opacity-40"
                >
                  <Brush className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <DialogPrimitive.Root open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[2000] bg-black/55" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[2001] max-h-[92vh] w-[min(94vw,40rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[24px] bg-[var(--talea-surface-primary)] p-6 shadow-2xl focus:outline-none">
            {draft ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
                className="flex flex-col gap-4"
              >
                <DialogPrimitive.Title className="text-[1.4rem] font-bold text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>
                  {draft.id ? `${draft.name} bearbeiten` : "Neue Figur für die Reihe"}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-[14px] text-[var(--talea-text-secondary)]">
                  Charakter und Sprechweise auf Deutsch, das Aussehen auf Englisch (daraus entstehen die Bilder).
                </DialogPrimitive.Description>
                <div className="grid gap-4 sm:grid-cols-[1fr_11rem_6rem]">
                  <Field label="Name">
                    <input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={taleaInputClass} />
                  </Field>
                  <Field label="Rolle">
                    <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })} className={taleaInputClass}>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Field>
                  <Field label="Alter">
                    <input inputMode="numeric" value={draft.ageYears} onChange={(event) => setDraft({ ...draft, ageYears: event.target.value.replace(/\D/g, "") })} className={taleaInputClass} />
                  </Field>
                </div>
                <Field label="Charakter">
                  <textarea rows={3} value={draft.personality} onChange={(event) => setDraft({ ...draft, personality: event.target.value })} className={cn(taleaInputClass, "h-auto py-2.5")} />
                </Field>
                <Field label="Sprechweise und Spruch">
                  <textarea rows={2} value={draft.speechStyle} placeholder="z. B. Knurrig, kurze Sätze. Sagt: „Hab ich's nicht gesagt?“" onChange={(event) => setDraft({ ...draft, speechStyle: event.target.value })} className={cn(taleaInputClass, "h-auto py-2.5")} />
                </Field>
                <Field label="Aussehen (Englisch, für Bilder)">
                  <textarea required rows={3} value={draft.visualProfileEn} placeholder="e.g. small round grey dust-bunny monster, two tiny black dot eyes, …" onChange={(event) => setDraft({ ...draft, visualProfileEn: event.target.value })} className={cn(taleaInputClass, "h-auto py-2.5")} />
                </Field>
                <label className="flex items-start gap-2.5 text-[14px] text-[var(--talea-text-primary)]">
                  <input type="checkbox" checked={draft.allowedInBranches} onChange={(event) => setDraft({ ...draft, allowedInBranches: event.target.checked })} className="mt-1 h-4 w-4" />
                  <span>Auf der Reihenseite zeigen und in Abenteuern erlauben <span className="text-[var(--talea-text-secondary)]">(aus für Staffel-Geheimnisse)</span></span>
                </label>
                {draft.id ? (
                  <label className="flex items-start gap-2.5 text-[14px] text-[var(--talea-text-primary)]">
                    <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} className="mt-1 h-4 w-4" />
                    <span>Aktiv <span className="text-[var(--talea-text-secondary)]">(pausierte Figuren kommen in neuen Folgen nicht vor)</span></span>
                  </label>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <DialogPrimitive.Close className="inline-flex h-11 items-center rounded-full px-4 text-[15px] font-semibold text-[var(--talea-text-secondary)]">Abbrechen</DialogPrimitive.Close>
                  <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--primary)] px-5 text-[15px] font-semibold text-white disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {draft.id ? "Speichern" : "Anlegen und Bild malen"}
                  </button>
                </div>
              </form>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </section>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[13px] font-semibold text-[var(--talea-text-secondary)]">{label}</span>
    {children}
  </label>
);
