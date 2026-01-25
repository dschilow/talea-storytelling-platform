import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Edit3, RefreshCcw, Save, Sparkles, Trash2, Upload, X, Zap } from 'lucide-react';
import { toast } from 'sonner';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useBackend } from '../../hooks/useBackend';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import type { story } from '../../client';

type CharacterTemplate = story.CharacterTemplate;

type CharacterIdentifier = string | CharacterTemplate | { id?: string } | { value?: string } | null | undefined;

function resolveCharacterId(source: CharacterIdentifier): string | null {
  if (!source) {
    return null;
  }
  if (typeof source === 'string') {
    const trimmed = source.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof source === 'object') {
    const fromId = (source as { id?: string }).id;
    if (typeof fromId === 'string' && fromId.trim().length > 0) {
      return fromId.trim();
    }
    const fromValue = (source as { value?: string }).value;
    if (typeof fromValue === 'string' && fromValue.trim().length > 0) {
      return fromValue.trim();
    }
  }
  console.warn('[CharacterPool] Unable to resolve character identifier', source);
  return null;
}

interface CharacterFormState {
  name: string;
  role: string;
  archetype: string;
  dominantEmotion: string;
  secondaryEmotions: string;
  triggers: string;
  visualDescription: string;
  visualPrompt: string;
  species: string;
  colorPalette: string;
  maxScreenTime: string;
  availableChapters: string;
  canonSettings: string;
  isActive: boolean;
  imageUrl?: string;
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  padding: `${spacing.xl}px ${spacing.xl}px ${spacing.xxl}px`,
  color: colors.text.primary,
  background: colors.gradients.background,
  fontFamily: '"Nunito", system-ui, sans-serif',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.sm,
  marginBottom: spacing.xl,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: spacing.lg,
};

const cardImageStyle: React.CSSProperties = {
  width: '100%',
  height: 180,
  borderRadius: `${radii.lg}px`,
  overflow: 'hidden',
  background: colors.glass.backgroundAlt,
  border: `1px solid ${colors.border.light}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(12, 10, 25, 0.75)',
  backdropFilter: 'blur(8px)',
  zIndex: 1050,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: `${spacing.xl}px`,
};

const modalContentStyle: React.CSSProperties = {
  width: 'min(960px, 100%)',
  maxHeight: '90vh',
  overflowY: 'auto',
  background: colors.glass.backgroundAlt,
  borderRadius: `${radii.xl}px`,
  border: `2px solid ${colors.border.light}`,
  boxShadow: shadows.xl,
  padding: `${spacing.xl}px`,
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: spacing.lg,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: spacing.xl,
  display: 'grid',
  gap: spacing.lg,
};

const sectionTitleStyle: React.CSSProperties = {
  ...typography.textStyles.headingSm,
  marginBottom: spacing.sm,
};

const inputLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: colors.text.secondary,
  marginBottom: spacing.xxs,
  display: 'block',
};

const inputBaseStyle: React.CSSProperties = {
  width: '100%',
  padding: `${spacing.sm}px`,
  borderRadius: `${radii.md}px`,
  border: `1px solid ${colors.border.light}`,
  background: colors.glass.background,
  color: colors.text.primary,
  fontSize: 14,
  outline: 'none',
  transition: 'border 120ms ease, box-shadow 120ms ease',
};

const textAreaStyle: React.CSSProperties = {
  ...inputBaseStyle,
  minHeight: 80,
  resize: 'vertical',
};

const twoColumnStyle: React.CSSProperties = {
  display: 'grid',
  gap: spacing.lg,
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
};

const previewImageStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 240,
  aspectRatio: '1 / 1',
  borderRadius: `${radii.lg}px`,
  overflow: 'hidden',
  border: `1px solid ${colors.border.light}`,
};

const CharacterPoolScreen: React.FC = () => {
  const backend = useBackend();
  const [characters, setCharacters] = useState<CharacterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingCharacter, setEditingCharacter] = useState<CharacterTemplate | null>(null);
  const [isNewCharacter, setIsNewCharacter] = useState(false);
  const [formState, setFormState] = useState<CharacterFormState | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [batchRegenerating, setBatchRegenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await backend.story.listCharacters();
      setCharacters(response.characters);
    } catch (err) {
      console.error('Failed to load characters', err);
      setError('Charaktere konnten nicht geladen werden.');
      toast.error('Charaktere konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const openEditor = async (idLike: CharacterIdentifier) => {
    const id = resolveCharacterId(idLike);
    if (!id) {
      toast.error('Charakter konnte nicht identifiziert werden.');
      return;
    }
    try {
      setDetailLoading(true);
      const character = await backend.story.getCharacter({ id });
      setEditingCharacter(character);
      setIsNewCharacter(false);
      setFormState(mapCharacterToForm(character));
      setEditorOpen(true);
    } catch (err) {
      console.error('Failed to load character details', err);
      toast.error('Charakterdetails konnten nicht geladen werden.');
    } finally {
      setDetailLoading(false);
    }
  };

  const openNewCharacter = () => {
    setFormState(createEmptyFormState());
    setEditingCharacter(null);
    setIsNewCharacter(true);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingCharacter(null);
    setIsNewCharacter(false);
    setFormState(null);
  };

  const handleGenerateImage = async () => {
    if (isNewCharacter) {
      toast.info('Bitte speichere den Charakter zuerst, bevor ein Bild generiert wird.');
      return;
    }
    if (!editingCharacter || !formState) {
      return;
    }
    const characterId = resolveCharacterId(editingCharacter);
    if (!characterId) {
      toast.error('Charakter konnte nicht identifiziert werden.');
      return;
    }
    try {
      setGeneratingImage(true);
      const response = await backend.story.generateCharacterImage({ id: characterId });
      setFormState(prev => (prev ? { ...prev, imageUrl: response.imageUrl } : prev));
      toast.success('Neues Charakterbild erstellt. Vergiss nicht zu speichern.');
    } catch (err) {
      console.error('Failed to generate character image', err);
      toast.error('Bild konnte nicht generiert werden.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSave = async () => {
    if (!formState) {
      return;
    }

    if (isNewCharacter) {
      if (!formState.name.trim() || !formState.role.trim() || !formState.archetype.trim()) {
        toast.error('Bitte Name, Rolle und Archetyp ausfuellen.');
        return;
      }
    }

    let updates: Record<string, unknown> | null = null;
    let existingCharacterId: string | null = null;
    if (!isNewCharacter) {
      if (!editingCharacter) {
        return;
      }
      existingCharacterId = resolveCharacterId(editingCharacter);
      if (!existingCharacterId) {
        toast.error('Charakter konnte nicht identifiziert werden.');
        return;
      }
      updates = buildUpdatePayload(editingCharacter, formState);
      if (Object.keys(updates).length === 0) {
        toast.info('Keine Aenderungen erkannt.');
        return;
      }
    }

    try {
      setSaving(true);
      if (isNewCharacter) {
        const payload = buildCreatePayload(formState);
        const created = await backend.story.addCharacter({ character: payload });
        setEditingCharacter(created);
        setFormState(mapCharacterToForm(created));
        setIsNewCharacter(false);
        toast.success('Charakter erfolgreich erstellt.');
      } else if (editingCharacter && updates && existingCharacterId) {
        await backend.story.updateCharacter({
          id: existingCharacterId,
          updates,
        });
        const refreshed = await backend.story.getCharacter({ id: existingCharacterId });
        setEditingCharacter(refreshed);
        setFormState(mapCharacterToForm(refreshed));
        toast.success('Charakter erfolgreich aktualisiert.');
      }
      await loadCharacters();
    } catch (err) {
      console.error('Failed to save character', err);
      toast.error('Charakter konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const refreshButtonDisabled = useMemo(() => loading || importing, [importing, loading]);

  const handleExportCharacters = async () => {
    try {
      setExporting(true);
      const response = await backend.story.exportCharacters();
      const blob = new Blob([JSON.stringify(response.characters, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const link = document.createElement('a');
      link.href = url;
      link.download = `talea-characters-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Charaktere exportiert.');
    } catch (err) {
      console.error('Failed to export characters', err);
      toast.error('Charaktere konnten nicht exportiert werden.');
    } finally {
      setExporting(false);
    }
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        throw new Error('Die ausgewaehlte Datei enthaelt kein gueltiges JSON.');
      }

      const charactersPayload = Array.isArray(parsed)
        ? (parsed as CharacterTemplate[])
        : Array.isArray((parsed as { characters?: CharacterTemplate[] })?.characters)
        ? ((parsed as { characters?: CharacterTemplate[] }).characters as CharacterTemplate[])
        : null;

      if (!charactersPayload || charactersPayload.length === 0) {
        throw new Error('Die JSON-Datei enthaelt keine Charaktere.');
      }

      const confirmReplace = window.confirm(
        `Vorhandene Charaktere werden durch ${charactersPayload.length} importierte Eintraege ersetzt. Fortfahren?`
      );
      if (!confirmReplace) {
        return;
      }

      setImporting(true);
      await backend.story.importCharacters({ characters: charactersPayload });
      toast.success('Charaktere erfolgreich importiert.');
      closeEditor();
      await loadCharacters();
    } catch (err) {
      console.error('Failed to import characters', err);
      const message = err instanceof Error ? err.message : 'Charaktere konnten nicht importiert werden.';
      toast.error(message);
    } finally {
      event.target.value = '';
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingCharacter || isNewCharacter) {
      closeEditor();
      return;
    }

    const confirmDelete = window.confirm(`Soll der Charakter "${editingCharacter.name}" wirklich geloescht werden?`);
    if (!confirmDelete) {
      return;
    }

    const characterId = resolveCharacterId(editingCharacter);
    if (!characterId) {
      toast.error('Charakter konnte nicht identifiziert werden.');
      return;
    }

    try {
      setDeleting(true);
      await backend.story.deleteCharacter({ id: characterId });
      toast.success('Charakter wurde geloescht.');
      closeEditor();
      await loadCharacters();
    } catch (err) {
      console.error('Failed to delete character', err);
      toast.error('Charakter konnte nicht geloescht werden.');
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchRegenerateImages = async () => {
    const activeCount = characters.filter(c => c.isActive).length;

    const confirmRegenerate = window.confirm(
      `Möchtest du wirklich alle Bilder von ${activeCount} aktiven Charakteren neu generieren?\n\n` +
      `Dies kann mehrere Minuten dauern und Kosten verursachen.`
    );

    if (!confirmRegenerate) {
      return;
    }

    try {
      setBatchRegenerating(true);
      toast.info(`Starte Regenerierung von ${activeCount} Charakterbildern...`);

      const response = await backend.story.batchRegenerateCharacterImages({});

      if (response.success) {
        toast.success(
          `Erfolgreich! ${response.generated}/${response.total} Bilder generiert.`
        );
      } else {
        toast.warning(
          `Fertig mit Fehlern: ${response.generated} generiert, ${response.failed} fehlgeschlagen.`
        );
      }

      await loadCharacters();
    } catch (err) {
      console.error('Failed to batch regenerate images', err);
      toast.error('Batch-Regenerierung fehlgeschlagen.');
    } finally {
      setBatchRegenerating(false);
    }
  };

  return (
    <div style={containerStyle}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />
      <header style={headerStyle}>
        <div>
          <h1 style={{ ...typography.textStyles.headingLg, marginBottom: spacing.xs }}>Charaktere</h1>
          <p style={{ color: colors.text.secondary, maxWidth: 640 }}>
            Verwalte alle verfuegbaren Charaktervorlagen. Du kannst Eigenschaften anpassen, Kapitelzuordnungen aendern und neue Bilder direkt aus dem visuellen Profil generieren.
          </p>
        </div>
        <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button
            title={batchRegenerating ? 'Generiert Alle...' : 'Alle Bilder neu generieren'}
            onPress={() => void handleBatchRegenerateImages()}
            icon={<Zap size={16} />}
            variant="primary"
            disabled={batchRegenerating || loading || importing || exporting}
          />
          <Button
            title={exporting ? 'Exportiert...' : 'Exportieren'}
            onPress={() => void handleExportCharacters()}
            icon={<Download size={16} />}
            variant="outline"
            disabled={exporting || batchRegenerating}
          />
          <Button
            title={importing ? 'Importiert...' : 'Importieren'}
            onPress={triggerImport}
            icon={<Upload size={16} />}
            variant="outline"
            disabled={importing || batchRegenerating}
          />
          <Button
            title="Neuer Charakter"
            onPress={openNewCharacter}
            icon={<Sparkles size={16} />}
            variant="secondary"
            disabled={importing || exporting || batchRegenerating}
          />
          <Button
            title={loading ? 'Laedt...' : 'Aktualisieren'}
            onPress={() => void loadCharacters()}
            disabled={refreshButtonDisabled || batchRegenerating}
            icon={<RefreshCcw size={16} />}
            variant="secondary"
          />
        </div>
      </header>

      {loading && (
        <div style={{ color: colors.text.secondary }}>Charaktere werden geladen...</div>
      )}

      {!loading && error && (
        <div style={{ color: colors.semantic.error }}>{error}</div>
      )}

      {!loading && !error && characters.length === 0 && (
        <div style={{ color: colors.text.secondary }}>Keine Charaktere gefunden.</div>
      )}

      {!loading && !error && characters.length > 0 && (
        <div style={gridStyle}>
          {characters.map((character) => (
            <Card key={character.id} variant="glass" style={{ padding: spacing.lg }}>
              <div style={cardImageStyle}>
                {character.imageUrl ? (
                  <img
                    src={character.imageUrl}
                    alt={character.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ color: colors.text.secondary, fontSize: 14 }}>Kein Bild</span>
                )}
              </div>
              <div style={{ marginTop: spacing.md }}>
                <h3 style={{ ...typography.textStyles.headingSm, marginBottom: spacing.xs }}>{character.name}</h3>
                <p style={{ color: colors.text.secondary, fontSize: 14 }}>
                  {character.role} - {character.archetype}
                </p>
              </div>
              <div style={{ marginTop: spacing.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: character.isActive ? colors.semantic.success : colors.text.secondary }}>
                  {character.isActive ? 'Aktiv' : 'Inaktiv'}
                </span>
                <Button
                  title={detailLoading && editingCharacter?.id === character.id ? 'Laedt...' : 'Bearbeiten'}
                  onPress={() => void openEditor(character.id)}
                  icon={<Edit3 size={16} />}
                  variant="primary"
                  disabled={detailLoading && editingCharacter?.id === character.id}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {editorOpen && formState && (
        <div style={modalOverlayStyle} role="dialog" aria-modal="true">
          <div style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={typography.textStyles.headingMd}>{formState.name.trim() || (isNewCharacter ? "Neuer Charakter" : editingCharacter?.name ?? "Charakter")}</h2>
                <p style={{ color: colors.text.secondary, fontSize: 14 }}>
                  {isNewCharacter ? "Noch nicht gespeichert" : editingCharacter?.id ?? ""}
                </p>
              </div>
              <Button
                title="Schliessen"
                onPress={closeEditor}
                variant="outline"
                icon={<X size={16} />}
              />
            </div>

            <div style={{ display: 'flex', gap: spacing.xl, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: spacing.xl }}>
              <div style={{ flex: '1 1 360px', minWidth: 300 }}>
                <div style={sectionStyle}>
                  <div>
                    <label style={inputLabelStyle} htmlFor="name">Name</label>
                    <input
                      id="name"
                      style={inputBaseStyle}
                      value={formState.name}
                      onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                    />
                  </div>
                  <div style={twoColumnStyle}>
                    <div>
                      <label style={inputLabelStyle} htmlFor="role">Rolle</label>
                      <input
                        id="role"
                        style={inputBaseStyle}
                        value={formState.role}
                        onChange={(event) => setFormState({ ...formState, role: event.target.value })}
                      />
                    </div>
                    <div>
                      <label style={inputLabelStyle} htmlFor="archetype">Archetyp</label>
                      <input
                        id="archetype"
                        style={inputBaseStyle}
                        value={formState.archetype}
                        onChange={(event) => setFormState({ ...formState, archetype: event.target.value })}
                      />
                    </div>
                  </div>
                  <div style={twoColumnStyle}>
                    <div>
                      <label style={inputLabelStyle} htmlFor="maxScreenTime">Screen Time (%)</label>
                      <input
                        id="maxScreenTime"
                        style={inputBaseStyle}
                        value={formState.maxScreenTime}
                        onChange={(event) => setFormState({ ...formState, maxScreenTime: event.target.value })}
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <label style={inputLabelStyle} htmlFor="availableChapters">Kapitel (kommagetrennt)</label>
                      <input
                        id="availableChapters"
                        style={inputBaseStyle}
                        value={formState.availableChapters}
                        onChange={(event) => setFormState({ ...formState, availableChapters: event.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={inputLabelStyle} htmlFor="canonSettings">Canon Settings (kommagetrennt)</label>
                    <input
                      id="canonSettings"
                      style={inputBaseStyle}
                      value={formState.canonSettings}
                      onChange={(event) => setFormState({ ...formState, canonSettings: event.target.value })}
                    />
                  </div>

                  <div>
                    <span style={sectionTitleStyle}>Emotionen</span>
                    <div style={twoColumnStyle}>
                      <div>
                        <label style={inputLabelStyle} htmlFor="dominantEmotion">Dominant</label>
                        <input
                          id="dominantEmotion"
                          style={inputBaseStyle}
                          value={formState.dominantEmotion}
                          onChange={(event) => setFormState({ ...formState, dominantEmotion: event.target.value })}
                        />
                      </div>
                      <div>
                        <label style={inputLabelStyle} htmlFor="secondaryEmotions">Sekundaer (kommagetrennt)</label>
                        <input
                          id="secondaryEmotions"
                          style={inputBaseStyle}
                          value={formState.secondaryEmotions}
                          onChange={(event) => setFormState({ ...formState, secondaryEmotions: event.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={inputLabelStyle} htmlFor="triggers">Trigger (kommagetrennt)</label>
                      <input
                        id="triggers"
                        style={inputBaseStyle}
                        value={formState.triggers}
                        onChange={(event) => setFormState({ ...formState, triggers: event.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <span style={sectionTitleStyle}>Visual Profile</span>
                    <div>
                      <label style={inputLabelStyle} htmlFor="visualDescription">Beschreibung</label>
                      <textarea
                        id="visualDescription"
                        style={textAreaStyle}
                        value={formState.visualDescription}
                        onChange={(event) => setFormState({ ...formState, visualDescription: event.target.value })}
                      />
                    </div>
                    <div>
                      <label style={inputLabelStyle} htmlFor="visualPrompt">Prompt</label>
                      <textarea
                        id="visualPrompt"
                        style={textAreaStyle}
                        value={formState.visualPrompt}
                        onChange={(event) => setFormState({ ...formState, visualPrompt: event.target.value })}
                      />
                    </div>
                    <div style={twoColumnStyle}>
                      <div>
                        <label style={inputLabelStyle} htmlFor="species">Spezies</label>
                        <input
                          id="species"
                          style={inputBaseStyle}
                          value={formState.species}
                          onChange={(event) => setFormState({ ...formState, species: event.target.value })}
                        />
                      </div>
                      <div>
                        <label style={inputLabelStyle} htmlFor="colorPalette">Farben (kommagetrennt)</label>
                        <input
                          id="colorPalette"
                          style={inputBaseStyle}
                          value={formState.colorPalette}
                          onChange={(event) => setFormState({ ...formState, colorPalette: event.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <input
                      id="isActive"
                      type="checkbox"
                      checked={formState.isActive}
                      onChange={(event) => setFormState({ ...formState, isActive: event.target.checked })}
                    />
                    <label htmlFor="isActive" style={{ color: colors.text.secondary, fontSize: 14 }}>
                      Charakter ist aktiv
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                <div style={previewImageStyle}>
                  {formState.imageUrl ? (
                    <img
                      src={formState.imageUrl}
                      alt={`${formState.name} Vorschau`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.text.secondary }}>
                      Kein Bild vorhanden
                    </div>
                  )}
                </div>
                <Button
                  title={generatingImage ? 'Generiere...' : 'Charakter Bild generieren'}
                  onPress={handleGenerateImage}
                  icon={<Sparkles size={16} />}
                  variant="secondary"
                  disabled={generatingImage}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center', flexWrap: 'wrap' }}>
              {!isNewCharacter && editingCharacter && (
                <Button
                  title={deleting ? 'Loeschen...' : 'Loeschen'}
                  onPress={handleDelete}
                  disabled={deleting}
                  variant="outline"
                  icon={<Trash2 size={16} />}
                />
              )}
              <div style={{ display: 'flex', gap: spacing.md, marginLeft: 'auto' }}>
                <Button
                  title="Schliessen"
                  onPress={closeEditor}
                  variant="outline"
                />
                <Button
                  title={saving ? 'Speichert...' : 'Speichern'}
                  onPress={handleSave}
                  icon={<Save size={16} />}
                  variant="primary"
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function mapCharacterToForm(character: CharacterTemplate): CharacterFormState {
  return {
    name: character.name,
    role: character.role,
    archetype: character.archetype,
    dominantEmotion: character.emotionalNature?.dominant ?? '',
    secondaryEmotions: (character.emotionalNature?.secondary ?? []).join(', '),
    triggers: (character.emotionalNature?.triggers ?? []).join(', '),
    visualDescription: character.visualProfile?.description ?? '',
    visualPrompt: character.visualProfile?.imagePrompt ?? '',
    species: character.visualProfile?.species ?? '',
    colorPalette: (character.visualProfile?.colorPalette ?? []).join(', '),
    maxScreenTime: String(character.maxScreenTime ?? 0),
    availableChapters: (character.availableChapters ?? []).join(', '),
    canonSettings: (character.canonSettings ?? []).join(', '),
    isActive: character.isActive ?? true,
    imageUrl: character.imageUrl,
  };
}

function createEmptyFormState(): CharacterFormState {
  return {
    name: '',
    role: '',
    archetype: '',
    dominantEmotion: '',
    secondaryEmotions: '',
    triggers: '',
    visualDescription: '',
    visualPrompt: '',
    species: '',
    colorPalette: '',
    maxScreenTime: '50',
    availableChapters: '1,2,3,4,5',
    canonSettings: '',
    isActive: true,
    imageUrl: undefined,
  };
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseNumberList(value: string): number[] {
  return value
    .split(',')
    .map((entry) => parseInt(entry.trim(), 10))
    .filter((num) => Number.isFinite(num));
}

function buildCreatePayload(form: CharacterFormState): Omit<CharacterTemplate, "id" | "createdAt" | "updatedAt" | "recentUsageCount" | "totalUsageCount" | "lastUsedAt"> {
  const secondaryEmotions = parseCommaList(form.secondaryEmotions);
  const triggerList = parseCommaList(form.triggers);
  const emotionalNature: CharacterTemplate["emotionalNature"] = {
    dominant: form.dominantEmotion.trim(),
    secondary: secondaryEmotions,
  };
  if (triggerList.length > 0) {
    emotionalNature.triggers = triggerList;
  }

  const colorPalette = parseCommaList(form.colorPalette);
  const visualProfile: CharacterTemplate["visualProfile"] = {
    description: form.visualDescription.trim(),
    imagePrompt: form.visualPrompt.trim(),
    species: form.species.trim(),
    colorPalette,
  };

  const maxScreenTimeValue = parseInt(form.maxScreenTime, 10);
  const maxScreenTime = Number.isNaN(maxScreenTimeValue) ? 50 : maxScreenTimeValue;

  const availableChapters = parseNumberList(form.availableChapters);

  return {
    name: form.name.trim(),
    role: form.role.trim(),
    archetype: form.archetype.trim(),
    emotionalNature,
    visualProfile,
    imageUrl: form.imageUrl,
    maxScreenTime,
    availableChapters: availableChapters.length > 0 ? availableChapters : [1, 2, 3, 4, 5],
    canonSettings: parseCommaList(form.canonSettings),
    isActive: form.isActive,
  };
}

function buildUpdatePayload(original: CharacterTemplate, form: CharacterFormState) {
  const updates: Record<string, any> = {};

  if (form.name.trim() !== original.name) {
    updates.name = form.name.trim();
  }
  if (form.role.trim() !== original.role) {
    updates.role = form.role.trim();
  }
  if (form.archetype.trim() !== original.archetype) {
    updates.archetype = form.archetype.trim();
  }

  const secondaryEmotions = parseCommaList(form.secondaryEmotions);
  const triggerList = parseCommaList(form.triggers);
  const emotionalNature: CharacterTemplate["emotionalNature"] = {
    dominant: form.dominantEmotion.trim(),
    secondary: secondaryEmotions,
  };
  if (triggerList.length > 0) {
    emotionalNature.triggers = triggerList;
  }

  if (JSON.stringify(emotionalNature) !== JSON.stringify(original.emotionalNature ?? {})) {
    updates.emotionalNature = emotionalNature;
  }

  const visualProfile = {
    description: form.visualDescription.trim(),
    imagePrompt: form.visualPrompt.trim(),
    species: form.species.trim(),
    colorPalette: parseCommaList(form.colorPalette),
  };

  if (JSON.stringify(visualProfile) !== JSON.stringify(original.visualProfile ?? {})) {
    updates.visualProfile = visualProfile;
  }

  const maxScreenTime = parseInt(form.maxScreenTime, 10);
  if (!Number.isNaN(maxScreenTime) && maxScreenTime !== original.maxScreenTime) {
    updates.maxScreenTime = maxScreenTime;
  }

  const availableChapters = parseNumberList(form.availableChapters);
  if (JSON.stringify(availableChapters) !== JSON.stringify(original.availableChapters ?? [])) {
    updates.availableChapters = availableChapters;
  }

  const canonSettings = parseCommaList(form.canonSettings);
  if (JSON.stringify(canonSettings) !== JSON.stringify(original.canonSettings ?? [])) {
    updates.canonSettings = canonSettings;
  }

  if (form.imageUrl !== original.imageUrl) {
    updates.imageUrl = form.imageUrl ?? null;
  }

  if ((original.isActive ?? true) !== form.isActive) {
    updates.isActive = form.isActive;
  }

  return updates;
}

export default CharacterPoolScreen;
