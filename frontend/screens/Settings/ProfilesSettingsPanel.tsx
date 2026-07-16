import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Crown,
  Heart, LockKeyhole, Pencil, Plus, Save, Shield, Star, Trash2, UserPlus, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChildProfiles } from "@/contexts/ChildProfilesContext";
import { formatKeywordInput, parseKeywordInput } from "@/lib/child-profile-defaults";
import { cn } from "@/lib/utils";

type ProfileDraft = {
  name: string; avatarColor: string; age: string; readingLevel: string;
  interests: string; learningGoals: string; noGoTopics: string;
  storySoftCap: string; storyHardCap: string; dokuSoftCap: string; dokuHardCap: string;
  allowFamilyReserve: boolean;
};

type KeywordFieldProps = {
  id: string; label: string; value: string; onChange: (value: string) => void;
  placeholder: string; helper: string; tone?: "default" | "protected";
};

const PROFILE_COLORS = ["#8ec5ff", "#7bc7b2", "#a989f2", "#f2a97e", "#e990ae", "#e1b85b"];
const READING_LEVELS = ["Anfänger", "Erste Leser", "Selbstständig", "Fortgeschritten"];

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

function safeDraft(current: ProfileDraft | undefined, fallback: {
  name: string; avatarColor?: string; age?: number; readingLevel?: string;
  interests?: string[]; learningGoals?: string[]; noGoTopics?: string[];
  storySoftCap?: number | null; storyHardCap?: number | null;
  dokuSoftCap?: number | null; dokuHardCap?: number | null; allowFamilyReserve?: boolean;
}): ProfileDraft {
  if (current) return current;
  return {
    name: fallback.name,
    avatarColor: fallback.avatarColor || "#8ec5ff",
    age: fallback.age == null ? "" : String(fallback.age),
    readingLevel: fallback.readingLevel || "",
    interests: formatKeywordInput(fallback.interests),
    learningGoals: formatKeywordInput(fallback.learningGoals),
    noGoTopics: formatKeywordInput(fallback.noGoTopics),
    storySoftCap: fallback.storySoftCap == null ? "" : String(fallback.storySoftCap),
    storyHardCap: fallback.storyHardCap == null ? "" : String(fallback.storyHardCap),
    dokuSoftCap: fallback.dokuSoftCap == null ? "" : String(fallback.dokuSoftCap),
    dokuHardCap: fallback.dokuHardCap == null ? "" : String(fallback.dokuHardCap),
    allowFamilyReserve: Boolean(fallback.allowFamilyReserve),
  };
}

function KeywordField({ id, label, value, onChange, placeholder, helper, tone = "default" }: KeywordFieldProps) {
  const [entry, setEntry] = useState("");
  const keywords = parseKeywordInput(value);
  const addEntries = (input: string) => {
    const additions = parseKeywordInput(input);
    if (!additions.length) return;
    onChange(formatKeywordInput(Array.from(new Set([...keywords, ...additions]))));
    setEntry("");
  };
  const removeEntry = (indexToRemove: number) => {
    onChange(formatKeywordInput(keywords.filter((_, index) => index !== indexToRemove)));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {tone === "protected" ? <Shield className="h-4 w-4 text-rose-500" aria-hidden="true" /> : null}
        {label}
      </Label>
      <div className={cn(
        "rounded-xl border bg-background p-2 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        tone === "protected" ? "border-rose-200/80 dark:border-rose-900/60" : "border-input"
      )}>
        {keywords.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5" aria-label={`${label}: ausgewählte Einträge`}>
            {keywords.map((keyword, index) => (
              <span key={`${keyword}-${index}`} className={cn(
                "inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                tone === "protected" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-primary/10 text-primary"
              )}>
                {keyword}
                <button type="button" onClick={() => removeEntry(index)} className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${keyword} entfernen`}>
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            id={id}
            value={entry}
            onChange={(event) => {
              const next = event.target.value;
              if (next.includes(",")) addEntries(next); else setEntry(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); addEntries(entry); }
            }}
            onBlur={() => addEntries(entry)}
            placeholder={keywords.length ? "Weiteren Eintrag hinzufügen …" : placeholder}
            className="min-h-9 min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button type="button" onClick={() => addEntries(entry)} disabled={!entry.trim()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40" aria-label={`Eintrag zu ${label} hinzufügen`}>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{helper}</p>
    </div>
  );
}

function ReadingLevelSelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const isCustomValue = Boolean(value && !READING_LEVELS.includes(value));
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-foreground">Lesestufe <span className="font-normal text-muted-foreground">(optional)</span></Label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <option value="">Automatisch passend zum Alter</option>
        {isCustomValue ? <option value={value}>{value}</option> : null}
        {READING_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
      </select>
      <p className="text-xs leading-5 text-muted-foreground">Steuert Wortwahl, Satzlänge und Lesetempo.</p>
    </div>
  );
}

function ProfileColorPicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-foreground">Profilfarbe</legend>
      <div className="flex min-h-11 flex-wrap items-center gap-2">
        {PROFILE_COLORS.map((color) => (
          <button key={color} type="button" onClick={() => onChange(color)} className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            value.toLowerCase() === color.toLowerCase() ? "border-foreground" : "border-transparent"
          )} style={{ backgroundColor: color }} aria-label={`Profilfarbe ${color} auswählen`} aria-pressed={value.toLowerCase() === color.toLowerCase()}>
            {value.toLowerCase() === color.toLowerCase() ? <Check className="h-4 w-4 text-white drop-shadow" /> : null}
          </button>
        ))}
        <Label htmlFor={id} className="inline-flex h-9 cursor-pointer items-center rounded-full border border-input bg-background px-3 text-xs font-medium text-muted-foreground hover:text-foreground">Eigene Farbe</Label>
        <input id={id} type="color" value={value} onChange={(event) => onChange(event.target.value)} className="sr-only" />
      </div>
      <p className="text-xs leading-5 text-muted-foreground">Hilft, Profile schnell voneinander zu unterscheiden.</p>
    </fieldset>
  );
}

function BudgetField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-foreground">{label}</Label>
      <Input id={id} type="number" min={0} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Kein Limit" className="h-10 rounded-xl" />
    </div>
  );
}
const ProfilesSettingsPanel: React.FC = () => {
  const navigate = useNavigate();
  const {
    isLoading, isMutating, plan, profileLimit, profiles, reserve, activeProfileId,
    setActiveProfileId, createProfile, updateProfile, deleteProfile,
    saveProfileBudget, saveFamilyReserve,
  } = useChildProfiles();
  const reduceMotion = useReducedMotion();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [createError, setCreateError] = useState("");
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newReadingLevel, setNewReadingLevel] = useState("");
  const [newInterests, setNewInterests] = useState("");
  const [newLearningGoals, setNewLearningGoals] = useState("");
  const [newNoGoTopics, setNewNoGoTopics] = useState("");
  const [newColor, setNewColor] = useState("#8ec5ff");
  const [reserveStory, setReserveStory] = useState("");
  const [reserveDoku, setReserveDoku] = useState("");
  const [drafts, setDrafts] = useState<Record<string, ProfileDraft>>({});

  useEffect(() => {
    setDrafts((previous) => {
      const next: Record<string, ProfileDraft> = {};
      for (const profile of profiles) {
        next[profile.id] = safeDraft(previous[profile.id], {
          name: profile.name,
          avatarColor: profile.avatarColor,
          age: profile.age,
          readingLevel: profile.readingLevel,
          interests: profile.interests,
          learningGoals: profile.learningGoals,
          noGoTopics: profile.noGoTopics,
          storySoftCap: profile.budget?.storySoftCap,
          storyHardCap: profile.budget?.storyHardCap,
          dokuSoftCap: profile.budget?.dokuSoftCap,
          dokuHardCap: profile.budget?.dokuHardCap,
          allowFamilyReserve: profile.budget?.allowFamilyReserve,
        });
      }
      return next;
    });
  }, [profiles]);

  useEffect(() => {
    if (!reserve) return;
    setReserveStory(String(reserve.story ?? 0));
    setReserveDoku(String(reserve.doku ?? 0));
  }, [reserve]);

  const canCreate = profiles.length < profileLimit;
  const activeProfileName = profiles.find((profile) => profile.id === activeProfileId)?.name;
  const planLabel = useMemo(() => {
    switch (plan) {
      case "premium": return "Premium";
      case "familie": return "Family";
      case "starter": return "Starter";
      default: return "Free";
    }
  }, [plan]);

  const resetCreateFlow = () => {
    setNewName(""); setNewAge(""); setNewReadingLevel(""); setNewInterests("");
    setNewLearningGoals(""); setNewNoGoTopics(""); setNewColor("#8ec5ff");
    setCreateError(""); setCreateStep(1);
  };
  const closeCreateFlow = () => { resetCreateFlow(); setIsCreateOpen(false); };
  const updateDraft = (profileId: string, patch: Partial<ProfileDraft>) => {
    setDrafts((previous) => ({ ...previous, [profileId]: { ...previous[profileId], ...patch } }));
  };

  const openChildAvatarFlow = (profileId: string, childAvatarId?: string) => {
    setActiveProfileId(profileId);
    if (childAvatarId) { navigate(`/avatar/edit/${childAvatarId}`); return; }
    navigate(`/avatar/create?mode=child&profileId=${encodeURIComponent(profileId)}`);
  };

  const goToCreateStep = (step: 1 | 2 | 3) => {
    if (step > 1) {
      const age = newAge.trim() ? Number(newAge) : null;
      if (!newName.trim()) {
        setCreateError("Bitte gib den Namen des Kindes ein.");
        setCreateStep(1);
        return;
      }
      if (age !== null && (!Number.isFinite(age) || age < 0 || age > 18)) {
        setCreateError("Bitte gib ein Alter zwischen 0 und 18 Jahren ein.");
        setCreateStep(1);
        return;
      }
    }
    setCreateError("");
    setCreateStep(step);
  };

  const onCreateProfile = async () => {
    const trimmed = newName.trim();
    if (!trimmed) { setCreateError("Bitte gib den Namen des Kindes ein."); setCreateStep(1); return; }
    try {
      const created = await createProfile({
        name: trimmed,
        avatarColor: newColor,
        age: toNullableNumber(newAge) ?? undefined,
        readingLevel: newReadingLevel.trim() || undefined,
        interests: parseKeywordInput(newInterests),
        learningGoals: parseKeywordInput(newLearningGoals),
        noGoTopics: parseKeywordInput(newNoGoTopics),
      });
      setActiveProfileId(created.id);
      setEditingProfileId(null);
      closeCreateFlow();
      toast.success(`Profil „${created.name}“ wurde erstellt. Als Nächstes kannst du den Kind-Avatar anlegen.`);
    } catch (error: any) {
      toast.error(error?.message || "Profil konnte nicht erstellt werden.");
    }
  };

  const onSaveProfile = async (profileId: string) => {
    const draft = drafts[profileId];
    if (!draft) return;
    if (!draft.name.trim()) { toast.error("Der Profilname darf nicht leer sein."); return; }
    try {
      await updateProfile({
        profileId,
        name: draft.name.trim(),
        avatarColor: draft.avatarColor || null,
        age: toNullableNumber(draft.age),
        readingLevel: draft.readingLevel.trim() || null,
        interests: parseKeywordInput(draft.interests),
        learningGoals: parseKeywordInput(draft.learningGoals),
        noGoTopics: parseKeywordInput(draft.noGoTopics),
      });
      setEditingProfileId(null);
      toast.success("Profil gespeichert.");
    } catch (error: any) {
      toast.error(error?.message || "Profil konnte nicht gespeichert werden.");
    }
  };

  const onSaveBudget = async (profileId: string) => {
    const draft = drafts[profileId];
    if (!draft) return;
    try {
      await saveProfileBudget({
        profileId,
        storySoftCap: toNullableNumber(draft.storySoftCap),
        storyHardCap: toNullableNumber(draft.storyHardCap),
        dokuSoftCap: toNullableNumber(draft.dokuSoftCap),
        dokuHardCap: toNullableNumber(draft.dokuHardCap),
        allowFamilyReserve: draft.allowFamilyReserve,
      });
      toast.success("Nutzungsgrenzen gespeichert.");
    } catch (error: any) {
      toast.error(error?.message || "Nutzungsgrenzen konnten nicht gespeichert werden.");
    }
  };

  const onDeleteProfile = async (profileId: string, profileName: string) => {
    const typedName = window.prompt([
      `Profil „${profileName}“ wird endgültig gelöscht.`,
      "Alle Inhalte dieses Profils werden entfernt (Avatare, Storys, Dokus, Quiz und Fortschritt).",
      "Dieser Vorgang kann nicht rückgängig gemacht werden.", "",
      `Bitte gib zur Bestätigung den Profilnamen exakt ein: ${profileName}`,
    ].join("\n"), "");
    if (typedName === null) return;
    if (typedName.trim() !== profileName.trim()) {
      toast.error("Der eingegebene Profilname stimmt nicht exakt überein.");
      return;
    }
    try {
      await deleteProfile(profileId);
      setEditingProfileId(null);
      toast.success(`Profil „${profileName}“ wurde entfernt.`);
    } catch (error: any) {
      toast.error(error?.message || "Profil konnte nicht gelöscht werden.");
    }
  };

  const onSaveReserve = async () => {
    try {
      await saveFamilyReserve({ story: toNullableNumber(reserveStory) ?? 0, doku: toNullableNumber(reserveDoku) ?? 0 });
      toast.success("Familienreserve gespeichert.");
    } catch (error: any) {
      toast.error(error?.message || "Familienreserve konnte nicht gespeichert werden.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6" role="status" aria-live="polite">
        <div className="h-28 animate-pulse rounded-3xl border border-border bg-card/70" />
        <span className="sr-only">Kinderprofile werden geladen …</span>
      </div>
    );
  }
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="overflow-hidden rounded-3xl border border-border bg-card/80 shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Familienprofile</p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                Jedes Kind bekommt seine eigene Welt
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Interessen, Lernziele, Fortschritt und Kind-Avatar bleiben dem ausgewählten Profil eindeutig zugeordnet.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Plan</p>
              <p className="mt-0.5 text-sm font-bold text-foreground">{planLabel}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Profile</p>
              <p className="mt-0.5 text-sm font-bold text-foreground">{profiles.length} von {profileLimit}</p>
            </div>
          </div>
        </div>
        {activeProfileName ? (
          <div className="border-t border-border bg-primary/[0.055] px-5 py-3 text-sm text-foreground sm:px-6">
            <span className="font-semibold">Gerade ausgewählt:</span> {activeProfileName}
          </div>
        ) : null}
      </header>

      <section aria-labelledby="create-profile-heading" className="rounded-3xl border border-border bg-card/80 shadow-sm">
        {!isCreateOpen ? (
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <UserPlus className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 id="create-profile-heading" className="font-bold text-foreground">Neues Kinderprofil anlegen</h3>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Drei kurze Schritte – die Angaben helfen Talea, Inhalte passend und sicher zu gestalten.</p>
              </div>
            </div>
            <Button type="button" onClick={() => setIsCreateOpen(true)} disabled={isMutating || !canCreate} className="h-11 rounded-xl px-5">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {canCreate ? "Profil anlegen" : "Profillimit erreicht"}
            </Button>
          </div>
        ) : (
          <form onSubmit={(event) => {
            event.preventDefault();
            if (createStep < 3) goToCreateStep((createStep + 1) as 2 | 3);
            else void onCreateProfile();
          }}>
            <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Neues Kinderprofil</p>
                <h3 id="create-profile-heading" className="mt-1 text-xl font-bold text-foreground">
                  {createStep === 1 ? "Wer liest mit Talea?" : createStep === 2 ? "Was begeistert und schützt?" : "Alles bereit?"}
                </h3>
              </div>
              <button type="button" onClick={closeCreateFlow} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto">
                <X className="h-4 w-4" aria-hidden="true" />Abbrechen
              </button>
            </div>

            <ol className="grid grid-cols-3 border-b border-border px-4 py-4 sm:px-6" aria-label="Fortschritt der Profilerstellung">
              {["Grunddaten", "Interessen & Schutz", "Zusammenfassung"].map((label, index) => {
                const step = (index + 1) as 1 | 2 | 3;
                const isCurrent = createStep === step;
                const isComplete = createStep > step;
                return (
                  <li key={label} className="relative flex flex-col items-center gap-1 text-center">
                    {index > 0 ? <span className={cn("absolute right-1/2 top-3 h-px w-full -translate-y-1/2", isComplete || isCurrent ? "bg-primary/50" : "bg-border")} /> : null}
                    <span className={cn(
                      "relative z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold",
                      isCurrent ? "border-primary bg-primary text-primary-foreground" : isComplete ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"
                    )} aria-current={isCurrent ? "step" : undefined}>
                      {isComplete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : step}
                    </span>
                    <span className={cn("hidden text-[11px] font-semibold sm:block", isCurrent ? "text-foreground" : "text-muted-foreground")}>{label}</span>
                  </li>
                );
              })}
            </ol>

            <div className="min-h-[330px] p-5 sm:p-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={createStep} initial={reduceMotion ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
                  {createStep === 1 ? (
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="new-profile-name" className="text-sm font-semibold text-foreground">Name des Kindes</Label>
                        <Input
                          id="new-profile-name" value={newName}
                          onChange={(event) => { setNewName(event.target.value); if (createError) setCreateError(""); }}
                          placeholder="Zum Beispiel Alexander" autoComplete="off" aria-invalid={Boolean(createError)}
                          aria-describedby={createError ? "new-profile-error" : "new-profile-name-help"}
                          className="h-11 rounded-xl" autoFocus
                        />
                        <p id="new-profile-name-help" className="text-xs leading-5 text-muted-foreground">Wird in der Profilwahl und in persönlichen Begrüßungen angezeigt.</p>
                        {createError ? <p id="new-profile-error" className="text-sm font-medium text-destructive" role="alert">{createError}</p> : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-profile-age" className="text-sm font-semibold text-foreground">Alter <span className="font-normal text-muted-foreground">(optional)</span></Label>
                        <Input id="new-profile-age" type="number" min={0} max={18} value={newAge} onChange={(event) => setNewAge(event.target.value)} placeholder="Zum Beispiel 8" className="h-11 rounded-xl" />
                        <p className="text-xs leading-5 text-muted-foreground">Hilft bei Themenwahl, Schwierigkeit und altersgerechter Sprache.</p>
                      </div>
                      <ReadingLevelSelect id="new-reading-level" value={newReadingLevel} onChange={setNewReadingLevel} />
                      <ProfileColorPicker id="new-profile-color" value={newColor} onChange={setNewColor} />
                    </div>
                  ) : null}

                  {createStep === 2 ? (
                    <div className="grid gap-6 lg:grid-cols-2">
                      <KeywordField id="new-interests" label="Lieblingsthemen" value={newInterests} onChange={setNewInterests} placeholder="Dinosaurier, Weltraum, Pferde …" helper="Talea nutzt diese Themen für motivierende Storys und Dokus. Mit Enter oder Komma hinzufügen." />
                      <KeywordField id="new-learning-goals" label="Was soll spielerisch wachsen?" value={newLearningGoals} onChange={setNewLearningGoals} placeholder="Lesen, Mut, Rechnen …" helper="Lernziele geben Inhalte eine Richtung, ohne dass jede Geschichte zur Schulstunde wird." />
                      <div className="lg:col-span-2">
                        <KeywordField id="new-no-go-topics" label="Themen, die Talea vermeiden soll" value={newNoGoTopics} onChange={setNewNoGoTopics} placeholder="Zum Beispiel Spinnen oder Trennung" helper="Diese Angaben dienen als Schutzleitplanken für neue Inhalte. Du kannst sie jederzeit ändern." tone="protected" />
                      </div>
                    </div>
                  ) : null}

                  {createStep === 3 ? (
                    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="rounded-2xl border border-border bg-background/70 p-5">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ backgroundColor: newColor }}>{newName.trim().slice(0, 1).toUpperCase() || "?"}</span>
                          <div>
                            <h4 className="text-lg font-bold text-foreground">{newName.trim()}</h4>
                            <p className="text-sm text-muted-foreground">{[newAge ? `${newAge} Jahre` : null, newReadingLevel || "Lesestufe automatisch"].filter(Boolean).join(" · ")}</p>
                          </div>
                        </div>
                        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                          <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Lieblingsthemen</dt><dd className="mt-1 text-sm leading-6 text-foreground">{parseKeywordInput(newInterests).join(", ") || "Noch keine angegeben"}</dd></div>
                          <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Lernziele</dt><dd className="mt-1 text-sm leading-6 text-foreground">{parseKeywordInput(newLearningGoals).join(", ") || "Noch keine angegeben"}</dd></div>
                          <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Schutzthemen</dt><dd className="mt-1 text-sm leading-6 text-foreground">{parseKeywordInput(newNoGoTopics).join(", ") || "Keine angegeben"}</dd></div>
                        </dl>
                      </div>
                      <aside className="rounded-2xl border border-primary/20 bg-primary/[0.055] p-5">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><CircleHelp className="h-5 w-5" aria-hidden="true" /></span>
                        <h4 className="mt-3 font-bold text-foreground">Was passiert danach?</h4>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">Das Profil wird erstellt und ausgewählt. Danach kannst du einen eigenen Kind-Avatar anlegen. Begleiter wie Mama oder Papa bleiben davon klar getrennt.</p>
                      </aside>
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <Button type="button" variant="ghost" onClick={() => goToCreateStep((createStep - 1) as 1 | 2)} disabled={createStep === 1 || isMutating} className="h-11 rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Zurück
              </Button>
              <Button type="submit" disabled={isMutating || !canCreate} className="h-11 rounded-xl px-5">
                {createStep < 3 ? <>Weiter<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></> : <><Check className="mr-2 h-4 w-4" aria-hidden="true" />Profil erstellen</>}
              </Button>
            </div>
          </form>
        )}
      </section>
      <section aria-labelledby="existing-profiles-heading" className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Deine Familie</p>
          <h3 id="existing-profiles-heading" className="mt-1 text-xl font-bold text-foreground">Kinderprofile verwalten</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Wähle aus, für welches Kind Storys, Dokus und Avatar-Entwicklung gespeichert werden.</p>
        </div>

        {profiles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-semibold text-foreground">Noch kein Kinderprofil</p>
            <p className="mt-1 text-sm text-muted-foreground">Lege oben das erste Profil an, um Talea zu personalisieren.</p>
          </div>
        ) : null}

        {profiles.map((profile, index) => {
          const draft = drafts[profile.id];
          if (!draft) return null;
          const isActive = profile.id === activeProfileId;
          const isEditing = editingProfileId === profile.id;

          return (
            <motion.article
              key={profile.id}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : index * 0.035, duration: 0.2 }}
              className={cn("overflow-hidden rounded-3xl border bg-card/80 shadow-sm transition-colors", isActive ? "border-primary/45 ring-1 ring-primary/10" : "border-border")}
            >
              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ backgroundColor: draft.avatarColor || "#8ec5ff" }}>{profile.name.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-lg font-bold text-foreground">{profile.name}</h4>
                        {isActive ? <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">Ausgewählt</span> : null}
                        {profile.isDefault ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300"><Star className="h-3 w-3" aria-hidden="true" /> Standard</span> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{[profile.age != null ? `${profile.age} Jahre` : null, profile.readingLevel || null].filter(Boolean).join(" · ") || "Alter und Lesestufe noch offen"}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{profile.usage.storyCount} Storys · {profile.usage.dokuCount} Dokus · {profile.usage.audioCount} Audio</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isActive ? <Button type="button" size="sm" onClick={() => setActiveProfileId(profile.id)} disabled={isMutating} className="rounded-xl">Dieses Profil wählen</Button> : null}
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingProfileId(isEditing ? null : profile.id)} disabled={isMutating} aria-expanded={isEditing} aria-controls={`profile-editor-${profile.id}`} className="rounded-xl">
                      <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />{isEditing ? "Bearbeiten schließen" : "Profil bearbeiten"}
                    </Button>
                  </div>
                </div>

                <div className={cn(
                  "mt-5 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
                  profile.childAvatarId ? "border-emerald-200/80 bg-emerald-500/[0.055] dark:border-emerald-900/60" : "border-amber-200/90 bg-amber-500/[0.055] dark:border-amber-900/60"
                )}>
                  <div className="flex items-start gap-3">
                    <span className={cn(
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      profile.childAvatarId ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    )}>
                      {profile.childAvatarId ? <Check className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-foreground">{profile.childAvatarId ? `${profile.name}s Kind-Avatar ist verbunden` : `${profile.name} hat noch keinen Kind-Avatar`}</p>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                        {profile.childAvatarId
                          ? `Dieser Avatar stellt ${profile.name} dar und gehört eindeutig zu diesem Kinderprofil.`
                          : `Der Kind-Avatar stellt ${profile.name} in Storys dar. Begleiter wie Mama, Papa oder Freunde sind separate Avatare.`}
                      </p>
                    </div>
                  </div>
                  <Button type="button" size="sm" variant={profile.childAvatarId ? "outline" : "default"} onClick={() => openChildAvatarFlow(profile.id, profile.childAvatarId)} disabled={isMutating} className="shrink-0 rounded-xl">
                    {profile.childAvatarId ? "Kind-Avatar bearbeiten" : "Kind-Avatar anlegen"}
                  </Button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isEditing ? (
                  <motion.form
                    id={`profile-editor-${profile.id}`}
                    onSubmit={(event) => { event.preventDefault(); void onSaveProfile(profile.id); }}
                    initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-border bg-muted/20"
                  >
                    <div className="space-y-7 p-5 sm:p-6">
                      <section aria-labelledby={`profile-basics-${profile.id}`}>
                        <div className="mb-4 flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                          <h5 id={`profile-basics-${profile.id}`} className="font-bold text-foreground">Grunddaten</h5>
                        </div>
                        <div className="grid gap-5 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`profile-name-${profile.id}`} className="text-sm font-semibold text-foreground">Name des Kindes</Label>
                            <Input id={`profile-name-${profile.id}`} value={draft.name} onChange={(event) => updateDraft(profile.id, { name: event.target.value })} className="h-11 rounded-xl" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`profile-age-${profile.id}`} className="text-sm font-semibold text-foreground">Alter <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Input id={`profile-age-${profile.id}`} type="number" min={0} max={18} value={draft.age} onChange={(event) => updateDraft(profile.id, { age: event.target.value })} className="h-11 rounded-xl" />
                          </div>
                          <ReadingLevelSelect id={`profile-reading-${profile.id}`} value={draft.readingLevel} onChange={(value) => updateDraft(profile.id, { readingLevel: value })} />
                          <ProfileColorPicker id={`profile-color-${profile.id}`} value={draft.avatarColor} onChange={(value) => updateDraft(profile.id, { avatarColor: value })} />
                        </div>
                      </section>

                      <section aria-labelledby={`profile-compass-${profile.id}`}>
                        <div className="mb-4 flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
                          <h5 id={`profile-compass-${profile.id}`} className="font-bold text-foreground">Story-Kompass</h5>
                        </div>
                        <div className="grid gap-6 lg:grid-cols-2">
                          <KeywordField id={`profile-interests-${profile.id}`} label="Lieblingsthemen" value={draft.interests} onChange={(value) => updateDraft(profile.id, { interests: value })} placeholder="Dinosaurier, Weltraum, Pferde …" helper="Talea greift diese Themen auf, wenn sie zu einer Story oder Doku passen." />
                          <KeywordField id={`profile-goals-${profile.id}`} label="Was soll spielerisch wachsen?" value={draft.learningGoals} onChange={(value) => updateDraft(profile.id, { learningGoals: value })} placeholder="Lesen, Mut, Rechnen …" helper="Lernziele geben neuen Inhalten eine sanfte Richtung." />
                          <div className="lg:col-span-2"><KeywordField id={`profile-protection-${profile.id}`} label="Themen, die Talea vermeiden soll" value={draft.noGoTopics} onChange={(value) => updateDraft(profile.id, { noGoTopics: value })} placeholder="Zum Beispiel Spinnen oder Trennung" helper="Diese Schutzleitplanken werden bei neuen Inhalten berücksichtigt." tone="protected" /></div>
                        </div>
                      </section>

                      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-2">
                          {!profile.isDefault ? <Button type="button" size="sm" variant="ghost" onClick={() => updateProfile({ profileId: profile.id, isDefault: true })} disabled={isMutating} className="rounded-xl"><Crown className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />Als Standard festlegen</Button> : null}
                          <Button type="button" size="sm" variant="ghost" onClick={() => onDeleteProfile(profile.id, profile.name)} disabled={isMutating || profiles.length <= 1} className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />Profil löschen</Button>
                        </div>
                        <Button type="submit" disabled={isMutating} className="h-11 rounded-xl px-5"><Save className="mr-2 h-4 w-4" aria-hidden="true" />Änderungen speichern</Button>
                      </div>
                    </div>
                  </motion.form>
                ) : null}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </section>
      <details className="group overflow-hidden rounded-3xl border border-border bg-card/80 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-6 [&::-webkit-details-marker]:hidden">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><LockKeyhole className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h3 className="font-bold text-foreground">Elternbereich · Nutzungsgrenzen</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Optionale Limits und Familienreserve – für Kinder standardmäßig ausgeblendet.</p>
            </div>
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>

        <div className="space-y-4 border-t border-border bg-muted/20 p-5 sm:p-6">
          <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
            <strong className="font-semibold text-foreground">So funktionieren die Grenzen:</strong> Die Hinweisgrenze meldet frühzeitig, dass ein Limit fast erreicht ist. Die Sperrgrenze verhindert danach neue Inhalte. Leere Felder bedeuten: kein individuelles Limit.
          </div>

          {profiles.map((profile) => {
            const draft = drafts[profile.id];
            if (!draft) return null;
            return (
              <details key={profile.id} className="group/profile rounded-2xl border border-border bg-background/75">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: draft.avatarColor || "#8ec5ff" }}>{profile.name.slice(0, 1).toUpperCase()}</span>
                    <span className="text-sm font-bold text-foreground">Limits für {profile.name}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open/profile:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-border p-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <BudgetField id={`story-soft-${profile.id}`} label="Story-Hinweisgrenze" value={draft.storySoftCap} onChange={(value) => updateDraft(profile.id, { storySoftCap: value })} />
                    <BudgetField id={`story-hard-${profile.id}`} label="Story-Sperrgrenze" value={draft.storyHardCap} onChange={(value) => updateDraft(profile.id, { storyHardCap: value })} />
                    <BudgetField id={`doku-soft-${profile.id}`} label="Doku-Hinweisgrenze" value={draft.dokuSoftCap} onChange={(value) => updateDraft(profile.id, { dokuSoftCap: value })} />
                    <BudgetField id={`doku-hard-${profile.id}`} label="Doku-Sperrgrenze" value={draft.dokuHardCap} onChange={(value) => updateDraft(profile.id, { dokuHardCap: value })} />
                  </div>
                  <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 text-sm text-foreground">
                    <input type="checkbox" checked={draft.allowFamilyReserve} onChange={(event) => updateDraft(profile.id, { allowFamilyReserve: event.target.checked })} className="h-4 w-4 rounded border-input accent-primary" />
                    Familienreserve verwenden, wenn ein eigenes Limit erreicht ist
                  </label>
                  <Button type="button" size="sm" variant="outline" className="mt-4 rounded-xl" onClick={() => onSaveBudget(profile.id)} disabled={isMutating}>Limits speichern</Button>
                </div>
              </details>
            );
          })}

          <div className="rounded-2xl border border-border bg-background/75 p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
              <div>
                <h4 className="text-sm font-bold text-foreground">Gemeinsame Familienreserve</h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Ein gemeinsamer Puffer, den freigegebene Kinderprofile nach ihrem eigenen Limit nutzen dürfen.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <BudgetField id="reserve-story" label="Story-Reserve" value={reserveStory} onChange={setReserveStory} />
              <BudgetField id="reserve-doku" label="Doku-Reserve" value={reserveDoku} onChange={setReserveDoku} />
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2"><p className="text-xs font-semibold text-muted-foreground">Storys verbraucht</p><p className="mt-1 text-lg font-bold text-foreground">{reserve?.storyUsed ?? 0}</p></div>
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2"><p className="text-xs font-semibold text-muted-foreground">Dokus verbraucht</p><p className="mt-1 text-lg font-bold text-foreground">{reserve?.dokuUsed ?? 0}</p></div>
            </div>
            <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={onSaveReserve} disabled={isMutating}>Familienreserve speichern</Button>
          </div>
        </div>
      </details>

      <div className="flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground">
        <Heart className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden="true" />
        Änderungen gelten für künftige Inhalte. Bereits erstellte Storys und Dokus bleiben unverändert.
      </div>
    </div>
  );
};

export default ProfilesSettingsPanel;
