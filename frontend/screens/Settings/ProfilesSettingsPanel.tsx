import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Save, Shield, Star, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useChildProfiles } from "@/contexts/ChildProfilesContext";
import { useTheme } from "@/contexts/ThemeContext";
import { formatKeywordInput, parseKeywordInput } from "@/lib/child-profile-defaults";

type ProfileDraft = {
  name: string;
  avatarColor: string;
  age: string;
  readingLevel: string;
  interests: string;
  learningGoals: string;
  noGoTopics: string;
  storySoftCap: string;
  storyHardCap: string;
  dokuSoftCap: string;
  dokuHardCap: string;
  allowFamilyReserve: boolean;
};

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

function safeDraft(
  current: ProfileDraft | undefined,
  fallback: {
    name: string;
    avatarColor?: string;
    age?: number;
    readingLevel?: string;
    interests?: string[];
    learningGoals?: string[];
    noGoTopics?: string[];
    storySoftCap?: number | null;
    storyHardCap?: number | null;
    dokuSoftCap?: number | null;
    dokuHardCap?: number | null;
    allowFamilyReserve?: boolean;
  }
): ProfileDraft {
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

const ProfilesSettingsPanel: React.FC = () => {
  const navigate = useNavigate();
  const {
    isLoading,
    isMutating,
    plan,
    profileLimit,
    profiles,
    reserve,
    activeProfileId,
    setActiveProfileId,
    createProfile,
    updateProfile,
    deleteProfile,
    saveProfileBudget,
    saveFamilyReserve,
  } = useChildProfiles();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

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
  const planLabel = useMemo(() => {
    switch (plan) {
      case "premium":
        return "Premium";
      case "familie":
        return "Family";
      case "starter":
        return "Starter";
      default:
        return "Free";
    }
  }, [plan]);

  const updateDraft = (profileId: string, patch: Partial<ProfileDraft>) => {
    setDrafts((prev) => ({ ...prev, [profileId]: { ...prev[profileId], ...patch } }));
  };

  const openChildAvatarFlow = (profileId: string, childAvatarId?: string) => {
    setActiveProfileId(profileId);
    if (childAvatarId) {
      navigate(`/avatar/edit/${childAvatarId}`);
      return;
    }

    navigate(`/avatar/create?mode=child&profileId=${encodeURIComponent(profileId)}`);
  };

  const onCreateProfile = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Bitte gib einen Profilnamen ein.");
      return;
    }

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
      setNewName("");
      setNewAge("");
      setNewReadingLevel("");
      setNewInterests("");
      setNewLearningGoals("");
      setNewNoGoTopics("");
      setNewColor("#8ec5ff");
      toast.success(`Profil "${created.name}" wurde erstellt.`);
    } catch (error: any) {
      toast.error(error?.message || "Profil konnte nicht erstellt werden.");
    }
  };

  const onSaveProfile = async (profileId: string) => {
    const draft = drafts[profileId];
    if (!draft) return;

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
      toast.success("Budget gespeichert.");
    } catch (error: any) {
      toast.error(error?.message || "Budget konnte nicht gespeichert werden.");
    }
  };

  const onDeleteProfile = async (profileId: string, profileName: string) => {
    const expectedName = profileName.trim();
    const typedName = window.prompt(
      [
        `Profil "${profileName}" wird jetzt endgültig gelöscht.`,
        "Es werden alle Inhalte dieses Profils gelöscht (Avatare, Stories, Dokus, Quiz/Progress).",
        "Dieser Vorgang kann nicht rückgängig gemacht werden.",
        "",
        `Bitte zur Bestätigung den Profilnamen exakt eingeben: ${profileName}`,
      ].join("\n"),
      ""
    );

    if (typedName === null) {
      return;
    }

    if (typedName.trim() !== expectedName) {
      toast.error("Der eingegebene Profilname stimmt nicht exakt überein.");
      return;
    }

    try {
      await deleteProfile(profileId);
      toast.success(`Profil "${profileName}" wurde entfernt.`);
    } catch (error: any) {
      toast.error(error?.message || "Profil konnte nicht gelöscht werden.");
    }
  };

  const onSaveReserve = async () => {
    try {
      await saveFamilyReserve({
        story: toNullableNumber(reserveStory) ?? 0,
        doku: toNullableNumber(reserveDoku) ?? 0,
      });
      toast.success("Family Reserve gespeichert.");
    } catch (error: any) {
      toast.error(error?.message || "Family Reserve konnte nicht gespeichert werden.");
    }
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Kinderprofile werden geladen...</div>;
  }

  return (
    <div className="p-6 space-y-5">
      <div
        className="rounded-2xl border p-4 md:p-5"
        style={{
          borderColor: isDark ? "#425a79" : "var(--talea-border-soft)",
          background: isDark ? "rgba(26,39,58,0.6)" : "rgba(255,255,255,0.75)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2DD4BF] to-[#0EA5E9]">
              <Users className="h-5 w-5 text-white" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                Kinderprofile
              </h3>
              <p className="text-xs text-muted-foreground">
                Aktiver Plan: {planLabel} • Slots: {profiles.length}/{profileLimit}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold rounded-full px-3 py-1 bg-[#A989F2]/15 text-[#7c58d7] dark:text-[#ccb7ff]">
            Aktiv: {profiles.find((profile) => profile.id === activeProfileId)?.name || "—"}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-[#A989F2]/30 bg-card/70 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Neues Profil
          </h4>
          {!canCreate && <span className="text-xs text-rose-500">Limit erreicht</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Name"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            max={18}
            value={newAge}
            onChange={(event) => setNewAge(event.target.value)}
            placeholder="Alter"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={newReadingLevel}
            onChange={(event) => setNewReadingLevel(event.target.value)}
            placeholder="Lesestufe (z.B. A1)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="color"
            value={newColor}
            onChange={(event) => setNewColor(event.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-2"
          />
          <input
            value={newInterests}
            onChange={(event) => setNewInterests(event.target.value)}
            placeholder="Vorlieben (Komma getrennt)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={newLearningGoals}
            onChange={(event) => setNewLearningGoals(event.target.value)}
            placeholder="Lernziele (Komma getrennt)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={newNoGoTopics}
            onChange={(event) => setNewNoGoTopics(event.target.value)}
            placeholder="Tabuthemen / vermeiden"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-4"
          />
        </div>
        <Button
          type="button"
          className="mt-3 bg-gradient-to-r from-[#A989F2] to-[#FF6B9D] text-white"
          onClick={onCreateProfile}
          disabled={isMutating || !canCreate}
        >
          Profil erstellen
        </Button>
      </div>

      <div className="space-y-4">
        {profiles.map((profile, index) => {
          const draft = drafts[profile.id];
          if (!draft) return null;
          const isActive = profile.id === activeProfileId;

          return (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-2xl border border-border bg-card/70 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white font-semibold"
                    style={{ background: draft.avatarColor || "#8ec5ff" }}
                  >
                    {profile.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Kind-Avatar: {profile.childAvatarId ? "verbunden" : "fehlt"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Usage: {profile.usage.storyCount} Storys • {profile.usage.dokuCount} Dokus • {profile.usage.audioCount} Audio
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {profile.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] bg-amber-500/15 text-amber-600 dark:text-amber-300">
                      <Star className="w-3 h-3" />
                      Standard
                    </span>
                  )}
                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      Aktiv
                    </span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openChildAvatarFlow(profile.id, profile.childAvatarId)}
                    disabled={isMutating}
                  >
                    {profile.childAvatarId ? "Kind-Avatar bearbeiten" : "Kind-Avatar erstellen"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveProfileId(profile.id)}
                    disabled={isMutating || isActive}
                  >
                    Aktivieren
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => updateProfile({ profileId: profile.id, isDefault: true })}
                    disabled={isMutating || profile.isDefault}
                  >
                    <Crown className="w-3.5 h-3.5 mr-1" />
                    Als Standard
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => onDeleteProfile(profile.id, profile.name)}
                    disabled={isMutating || profiles.length <= 1}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Löschen
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  value={draft.name}
                  onChange={(event) => updateDraft(profile.id, { name: event.target.value })}
                  placeholder="Name"
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  max={18}
                  value={draft.age}
                  onChange={(event) => updateDraft(profile.id, { age: event.target.value })}
                  placeholder="Alter"
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
                <input
                  value={draft.readingLevel}
                  onChange={(event) => updateDraft(profile.id, { readingLevel: event.target.value })}
                  placeholder="Lesestufe"
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
                <input
                  type="color"
                  value={draft.avatarColor}
                  onChange={(event) => updateDraft(profile.id, { avatarColor: event.target.value })}
                  className="h-10 rounded-xl border border-border bg-background px-2"
                />
                <input
                  value={draft.interests}
                  onChange={(event) => updateDraft(profile.id, { interests: event.target.value })}
                  placeholder="Vorlieben (Komma getrennt)"
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
                />
                <input
                  value={draft.learningGoals}
                  onChange={(event) => updateDraft(profile.id, { learningGoals: event.target.value })}
                  placeholder="Lernziele (Komma getrennt)"
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
                />
                <input
                  value={draft.noGoTopics}
                  onChange={(event) => updateDraft(profile.id, { noGoTopics: event.target.value })}
                  placeholder="Tabuthemen / vermeiden"
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-4"
                />
              </div>

              <Button
                type="button"
                size="sm"
                className="mt-3"
                onClick={() => onSaveProfile(profile.id)}
                disabled={isMutating}
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                Profildaten speichern
              </Button>

              <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                  Budget pro Kind
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <input
                    type="number"
                    min={0}
                    value={draft.storySoftCap}
                    onChange={(event) => updateDraft(profile.id, { storySoftCap: event.target.value })}
                    placeholder="Story Soft"
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    value={draft.storyHardCap}
                    onChange={(event) => updateDraft(profile.id, { storyHardCap: event.target.value })}
                    placeholder="Story Hard"
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    value={draft.dokuSoftCap}
                    onChange={(event) => updateDraft(profile.id, { dokuSoftCap: event.target.value })}
                    placeholder="Doku Soft"
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    value={draft.dokuHardCap}
                    onChange={(event) => updateDraft(profile.id, { dokuHardCap: event.target.value })}
                    placeholder="Doku Hard"
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={draft.allowFamilyReserve}
                      onChange={(event) => updateDraft(profile.id, { allowFamilyReserve: event.target.checked })}
                      className="h-4 w-4"
                    />
                    Reserve erlaubt
                  </label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => onSaveBudget(profile.id)}
                  disabled={isMutating}
                >
                  Budget speichern
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card/70 p-4">
        <h4 className="font-semibold text-foreground flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4" />
          Family Reserve
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Gilt account-weit als gemeinsamer Puffer für Story- und Doku-Credits.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="number"
            min={0}
            value={reserveStory}
            onChange={(event) => setReserveStory(event.target.value)}
            placeholder="Story Reserve"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            value={reserveDoku}
            onChange={(event) => setReserveDoku(event.target.value)}
            placeholder="Doku Reserve"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="rounded-xl border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            Verbraucht Story: {reserve?.storyUsed ?? 0}
          </div>
          <div className="rounded-xl border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            Verbraucht Doku: {reserve?.dokuUsed ?? 0}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={onSaveReserve}
          disabled={isMutating}
        >
          Reserve speichern
        </Button>
      </div>
    </div>
  );
};

export default ProfilesSettingsPanel;
