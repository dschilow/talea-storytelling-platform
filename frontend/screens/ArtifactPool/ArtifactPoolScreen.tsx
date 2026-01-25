import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Edit3, Gem, RefreshCcw, Save, Sparkles, Trash2, Upload, X, Zap } from 'lucide-react';
import { toast } from 'sonner';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useBackend } from '../../hooks/useBackend';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import type { story } from '../../client';

type ArtifactTemplate = story.ArtifactTemplate;

type ArtifactIdentifier = string | ArtifactTemplate | { id?: string } | { value?: string } | null | undefined;

function resolveArtifactId(source: ArtifactIdentifier): string | null {
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
  console.warn('[ArtifactPool] Unable to resolve artifact identifier', source);
  return null;
}

interface ArtifactFormState {
  nameDe: string;
  nameEn: string;
  descriptionDe: string;
  descriptionEn: string;
  category: string;
  rarity: string;
  storyRole: string;
  discoveryScenarios: string;
  usageScenarios: string;
  visualKeywords: string;
  emoji: string;
  genreAdventure: string;
  genreFantasy: string;
  genreMystery: string;
  genreNature: string;
  genreFriendship: string;
  genreCourage: string;
  genreLearning: string;
  isActive: boolean;
  imageUrl?: string;
}

const categoryOptions = [
  'weapon',
  'clothing',
  'magic',
  'book',
  'tool',
  'tech',
  'nature',
  'potion',
  'jewelry',
  'armor',
  'map',
];

const rarityOptions = ['common', 'uncommon', 'rare', 'legendary'];

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
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

const previewImageStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 240,
  aspectRatio: '1 / 1',
  borderRadius: `${radii.lg}px`,
  overflow: 'hidden',
  border: `1px solid ${colors.border.light}`,
};

const ArtifactPoolScreen: React.FC = () => {
  const backend = useBackend();
  const [artifacts, setArtifacts] = useState<ArtifactTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingArtifact, setEditingArtifact] = useState<ArtifactTemplate | null>(null);
  const [isNewArtifact, setIsNewArtifact] = useState(false);
  const [formState, setFormState] = useState<ArtifactFormState | null>(null);
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
    void loadArtifacts();
  }, []);

  const loadArtifacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await backend.story.listArtifacts();
      setArtifacts(response.artifacts);
    } catch (err) {
      console.error('Failed to load artifacts', err);
      setError('Artefakte konnten nicht geladen werden.');
      toast.error('Artefakte konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const openEditor = async (idLike: ArtifactIdentifier) => {
    const id = resolveArtifactId(idLike);
    if (!id) {
      toast.error('Artefakt konnte nicht identifiziert werden.');
      return;
    }
    try {
      setDetailLoading(true);
      const artifact = await backend.story.getArtifact({ id });
      setEditingArtifact(artifact);
      setIsNewArtifact(false);
      setFormState(mapArtifactToForm(artifact));
      setEditorOpen(true);
    } catch (err) {
      console.error('Failed to load artifact details', err);
      toast.error('Artefaktdetails konnten nicht geladen werden.');
    } finally {
      setDetailLoading(false);
    }
  };

  const openNewArtifact = () => {
    setFormState(createEmptyFormState());
    setEditingArtifact(null);
    setIsNewArtifact(true);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingArtifact(null);
    setIsNewArtifact(false);
    setFormState(null);
  };

  const handleGenerateImage = async () => {
    if (isNewArtifact) {
      toast.info('Bitte speichere das Artefakt zuerst, bevor ein Bild generiert wird.');
      return;
    }
    if (!editingArtifact || !formState) {
      return;
    }
    const artifactId = resolveArtifactId(editingArtifact);
    if (!artifactId) {
      toast.error('Artefakt konnte nicht identifiziert werden.');
      return;
    }
    try {
      setGeneratingImage(true);
      const response = await backend.story.generateArtifactImage({ id: artifactId });
      setFormState(prev => (prev ? { ...prev, imageUrl: response.imageUrl } : prev));
      toast.success('Neues Artefaktbild erstellt. Vergiss nicht zu speichern.');
    } catch (err) {
      console.error('Failed to generate artifact image', err);
      toast.error('Bild konnte nicht generiert werden.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSave = async () => {
    if (!formState) {
      return;
    }

    if (isNewArtifact) {
      if (!formState.nameDe.trim() && !formState.nameEn.trim()) {
        toast.error('Bitte mindestens einen Namen (DE oder EN) ausfuellen.');
        return;
      }
      if (!formState.descriptionDe.trim() && !formState.descriptionEn.trim()) {
        toast.error('Bitte mindestens eine Beschreibung (DE oder EN) ausfuellen.');
        return;
      }
    }

    let updates: Record<string, unknown> | null = null;
    let existingArtifactId: string | null = null;
    if (!isNewArtifact) {
      if (!editingArtifact) {
        return;
      }
      existingArtifactId = resolveArtifactId(editingArtifact);
      if (!existingArtifactId) {
        toast.error('Artefakt konnte nicht identifiziert werden.');
        return;
      }
      updates = buildUpdatePayload(editingArtifact, formState);
      if (Object.keys(updates).length === 0) {
        toast.info('Keine Aenderungen erkannt.');
        return;
      }
    }

    try {
      setSaving(true);
      if (isNewArtifact) {
        const payload = buildCreatePayload(formState);
        const created = await backend.story.addArtifact({ artifact: payload });
        setEditingArtifact(created);
        setFormState(mapArtifactToForm(created));
        setIsNewArtifact(false);
        toast.success('Artefakt erfolgreich erstellt.');
      } else if (editingArtifact && updates && existingArtifactId) {
        await backend.story.updateArtifact({
          id: existingArtifactId,
          updates,
        });
        const refreshed = await backend.story.getArtifact({ id: existingArtifactId });
        setEditingArtifact(refreshed);
        setFormState(mapArtifactToForm(refreshed));
        toast.success('Artefakt erfolgreich aktualisiert.');
      }
      await loadArtifacts();
    } catch (err) {
      console.error('Failed to save artifact', err);
      toast.error('Artefakt konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const refreshButtonDisabled = useMemo(() => loading || importing, [importing, loading]);

  const handleExportArtifacts = async () => {
    try {
      setExporting(true);
      const response = await backend.story.exportArtifacts();
      const blob = new Blob([JSON.stringify(response.artifacts, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const link = document.createElement('a');
      link.href = url;
      link.download = `talea-artifacts-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Artefakte exportiert.');
    } catch (err) {
      console.error('Failed to export artifacts', err);
      toast.error('Artefakte konnten nicht exportiert werden.');
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

      const artifactsPayload = Array.isArray(parsed)
        ? (parsed as ArtifactTemplate[])
        : Array.isArray((parsed as { artifacts?: ArtifactTemplate[] })?.artifacts)
        ? ((parsed as { artifacts?: ArtifactTemplate[] }).artifacts as ArtifactTemplate[])
        : null;

      if (!artifactsPayload || artifactsPayload.length === 0) {
        throw new Error('Die JSON-Datei enthaelt keine Artefakte.');
      }

      const confirmReplace = window.confirm(
        `Vorhandene Artefakte werden durch ${artifactsPayload.length} importierte Eintraege ersetzt. Fortfahren?`
      );
      if (!confirmReplace) {
        return;
      }

      setImporting(true);
      await backend.story.importArtifacts({ artifacts: artifactsPayload });
      toast.success('Artefakte erfolgreich importiert.');
      closeEditor();
      await loadArtifacts();
    } catch (err) {
      console.error('Failed to import artifacts', err);
      const message = err instanceof Error ? err.message : 'Artefakte konnten nicht importiert werden.';
      toast.error(message);
    } finally {
      event.target.value = '';
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingArtifact || isNewArtifact) {
      closeEditor();
      return;
    }

    const confirmDelete = window.confirm(`Soll das Artefakt "${editingArtifact.name?.de || editingArtifact.name?.en}" wirklich geloescht werden?`);
    if (!confirmDelete) {
      return;
    }

    const artifactId = resolveArtifactId(editingArtifact);
    if (!artifactId) {
      toast.error('Artefakt konnte nicht identifiziert werden.');
      return;
    }

    try {
      setDeleting(true);
      await backend.story.deleteArtifact({ id: artifactId });
      toast.success('Artefakt wurde geloescht.');
      closeEditor();
      await loadArtifacts();
    } catch (err) {
      console.error('Failed to delete artifact', err);
      toast.error('Artefakt konnte nicht geloescht werden.');
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchRegenerateImages = async () => {
    const activeCount = artifacts.filter(a => a.isActive).length;

    const confirmRegenerate = window.confirm(
      `Möchtest du wirklich alle Bilder von ${activeCount} aktiven Artefakten neu generieren?\n\n` +
      `Dies kann mehrere Minuten dauern und Kosten verursachen.`
    );

    if (!confirmRegenerate) {
      return;
    }

    try {
      setBatchRegenerating(true);
      toast.info(`Starte Regenerierung von ${activeCount} Artefaktbildern...`);

      const response = await backend.story.batchRegenerateArtifactImages({});

      if (response.success) {
        toast.success(
          `Erfolgreich! ${response.generated}/${response.total} Bilder generiert.`
        );
      } else {
        toast.warning(
          `Fertig mit Fehlern: ${response.generated} generiert, ${response.failed} fehlgeschlagen.`
        );
      }

      await loadArtifacts();
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
          <h1 style={{ ...typography.textStyles.headingLg, marginBottom: spacing.xs }}>Artefakte</h1>
          <p style={{ color: colors.text.secondary, maxWidth: 680 }}>
            Verwalte alle Artefaktvorlagen aus dem Pool. Du kannst Namen, Beschreibungen, Kategorien und
            visuelle Keywords anpassen sowie Bilder direkt generieren.
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
            onPress={() => void handleExportArtifacts()}
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
            title="Neues Artefakt"
            onPress={openNewArtifact}
            icon={<Gem size={16} />}
            variant="secondary"
            disabled={importing || exporting || batchRegenerating}
          />
          <Button
            title={loading ? 'Laedt...' : 'Aktualisieren'}
            onPress={() => void loadArtifacts()}
            disabled={refreshButtonDisabled || batchRegenerating}
            icon={<RefreshCcw size={16} />}
            variant="secondary"
          />
        </div>
      </header>

      {loading && (
        <div style={{ color: colors.text.secondary }}>Artefakte werden geladen...</div>
      )}

      {!loading && error && (
        <div style={{ color: colors.semantic.error }}>{error}</div>
      )}

      {!loading && !error && artifacts.length === 0 && (
        <div style={{ color: colors.text.secondary }}>Keine Artefakte gefunden.</div>
      )}

      {!loading && !error && artifacts.length > 0 && (
        <div style={gridStyle}>
          {artifacts.map((artifact) => (
            <Card key={artifact.id} variant="glass" style={{ padding: spacing.lg }}>
              <div style={cardImageStyle}>
                {artifact.imageUrl ? (
                  <img
                    src={artifact.imageUrl}
                    alt={artifact.name?.de || artifact.name?.en}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : artifact.emoji ? (
                  <span style={{ fontSize: 48 }}>{artifact.emoji}</span>
                ) : (
                  <span style={{ color: colors.text.secondary, fontSize: 14 }}>Kein Bild</span>
                )}
              </div>
              <div style={{ marginTop: spacing.md }}>
                <h3 style={{ ...typography.textStyles.headingSm, marginBottom: spacing.xs }}>
                  {artifact.name?.de || artifact.name?.en}
                </h3>
                <p style={{ color: colors.text.secondary, fontSize: 14 }}>
                  {artifact.category} - {artifact.rarity}
                </p>
              </div>
              <div style={{ marginTop: spacing.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: artifact.isActive ? colors.semantic.success : colors.text.secondary }}>
                  {artifact.isActive ? 'Aktiv' : 'Inaktiv'}
                </span>
                <Button
                  title={detailLoading && editingArtifact?.id === artifact.id ? 'Laedt...' : 'Bearbeiten'}
                  onPress={() => void openEditor(artifact.id)}
                  icon={<Edit3 size={16} />}
                  variant="primary"
                  disabled={detailLoading && editingArtifact?.id === artifact.id}
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
                <h2 style={typography.textStyles.headingMd}>
                  {formState.nameDe.trim() || formState.nameEn.trim() || (isNewArtifact ? "Neues Artefakt" : editingArtifact?.name?.de ?? "Artefakt")}
                </h2>
                <p style={{ color: colors.text.secondary, fontSize: 14 }}>
                  {isNewArtifact ? "Noch nicht gespeichert" : editingArtifact?.id ?? ""}
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
                    <span style={sectionTitleStyle}>Namen</span>
                    <div style={twoColumnStyle}>
                      <div>
                        <label style={inputLabelStyle} htmlFor="nameDe">Name (DE)</label>
                        <input
                          id="nameDe"
                          style={inputBaseStyle}
                          value={formState.nameDe}
                          onChange={(event) => setFormState({ ...formState, nameDe: event.target.value })}
                        />
                      </div>
                      <div>
                        <label style={inputLabelStyle} htmlFor="nameEn">Name (EN)</label>
                        <input
                          id="nameEn"
                          style={inputBaseStyle}
                          value={formState.nameEn}
                          onChange={(event) => setFormState({ ...formState, nameEn: event.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <span style={sectionTitleStyle}>Grunddaten</span>
                    <div style={twoColumnStyle}>
                      <div>
                        <label style={inputLabelStyle} htmlFor="category">Kategorie</label>
                        <select
                          id="category"
                          style={inputBaseStyle}
                          value={formState.category}
                          onChange={(event) => setFormState({ ...formState, category: event.target.value })}
                        >
                          {categoryOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={inputLabelStyle} htmlFor="rarity">Seltenheit</label>
                        <select
                          id="rarity"
                          style={inputBaseStyle}
                          value={formState.rarity}
                          onChange={(event) => setFormState({ ...formState, rarity: event.target.value })}
                        >
                          {rarityOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={twoColumnStyle}>
                      <div>
                        <label style={inputLabelStyle} htmlFor="emoji">Emoji</label>
                        <input
                          id="emoji"
                          style={inputBaseStyle}
                          value={formState.emoji}
                          onChange={(event) => setFormState({ ...formState, emoji: event.target.value })}
                        />
                      </div>
                      <div>
                        <label style={inputLabelStyle} htmlFor="storyRole">Story Role</label>
                        <input
                          id="storyRole"
                          style={inputBaseStyle}
                          value={formState.storyRole}
                          onChange={(event) => setFormState({ ...formState, storyRole: event.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <span style={sectionTitleStyle}>Beschreibungen</span>
                    <div style={twoColumnStyle}>
                      <div>
                        <label style={inputLabelStyle} htmlFor="descriptionDe">Beschreibung (DE)</label>
                        <textarea
                          id="descriptionDe"
                          style={textAreaStyle}
                          value={formState.descriptionDe}
                          onChange={(event) => setFormState({ ...formState, descriptionDe: event.target.value })}
                        />
                      </div>
                      <div>
                        <label style={inputLabelStyle} htmlFor="descriptionEn">Beschreibung (EN)</label>
                        <textarea
                          id="descriptionEn"
                          style={textAreaStyle}
                          value={formState.descriptionEn}
                          onChange={(event) => setFormState({ ...formState, descriptionEn: event.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <span style={sectionTitleStyle}>Szenarien</span>
                    <div>
                      <label style={inputLabelStyle} htmlFor="discoveryScenarios">Discovery (kommagetrennt)</label>
                      <textarea
                        id="discoveryScenarios"
                        style={textAreaStyle}
                        value={formState.discoveryScenarios}
                        onChange={(event) => setFormState({ ...formState, discoveryScenarios: event.target.value })}
                      />
                    </div>
                    <div>
                      <label style={inputLabelStyle} htmlFor="usageScenarios">Usage (kommagetrennt)</label>
                      <textarea
                        id="usageScenarios"
                        style={textAreaStyle}
                        value={formState.usageScenarios}
                        onChange={(event) => setFormState({ ...formState, usageScenarios: event.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <span style={sectionTitleStyle}>Visual</span>
                    <div>
                      <label style={inputLabelStyle} htmlFor="visualKeywords">Keywords (kommagetrennt)</label>
                      <textarea
                        id="visualKeywords"
                        style={textAreaStyle}
                        value={formState.visualKeywords}
                        onChange={(event) => setFormState({ ...formState, visualKeywords: event.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <span style={sectionTitleStyle}>Genre Affinity (0.0 - 1.0)</span>
                    <div style={twoColumnStyle}>
                      <div>
                        <label style={inputLabelStyle} htmlFor="genreAdventure">Adventure</label>
                        <input
                          id="genreAdventure"
                          style={inputBaseStyle}
                          value={formState.genreAdventure}
                          onChange={(event) => setFormState({ ...formState, genreAdventure: event.target.value })}
                          inputMode="decimal"
                        />
                      </div>
                      <div>
                        <label style={inputLabelStyle} htmlFor="genreFantasy">Fantasy</label>
                        <input
                          id="genreFantasy"
                          style={inputBaseStyle}
                          value={formState.genreFantasy}
                          onChange={(event) => setFormState({ ...formState, genreFantasy: event.target.value })}
                          inputMode="decimal"
                        />
                      </div>
                      <div>
                        <label style={inputLabelStyle} htmlFor="genreMystery">Mystery</label>
                        <input
                          id="genreMystery"
                          style={inputBaseStyle}
                          value={formState.genreMystery}
                          onChange={(event) => setFormState({ ...formState, genreMystery: event.target.value })}
                          inputMode="decimal"
                        />
                      </div>
                      <div>
                        <label style={inputLabelStyle} htmlFor="genreNature">Nature</label>
                        <input
                          id="genreNature"
                          style={inputBaseStyle}
                          value={formState.genreNature}
                          onChange={(event) => setFormState({ ...formState, genreNature: event.target.value })}
                          inputMode="decimal"
                        />
                      </div>
                      <div>
                        <label style={inputLabelStyle} htmlFor="genreFriendship">Friendship</label>
                        <input
                          id="genreFriendship"
                          style={inputBaseStyle}
                          value={formState.genreFriendship}
                          onChange={(event) => setFormState({ ...formState, genreFriendship: event.target.value })}
                          inputMode="decimal"
                        />
                      </div>
                      <div>
                        <label style={inputLabelStyle} htmlFor="genreCourage">Courage</label>
                        <input
                          id="genreCourage"
                          style={inputBaseStyle}
                          value={formState.genreCourage}
                          onChange={(event) => setFormState({ ...formState, genreCourage: event.target.value })}
                          inputMode="decimal"
                        />
                      </div>
                      <div>
                        <label style={inputLabelStyle} htmlFor="genreLearning">Learning</label>
                        <input
                          id="genreLearning"
                          style={inputBaseStyle}
                          value={formState.genreLearning}
                          onChange={(event) => setFormState({ ...formState, genreLearning: event.target.value })}
                          inputMode="decimal"
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
                      Artefakt ist aktiv
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                <div style={previewImageStyle}>
                  {formState.imageUrl ? (
                    <img
                      src={formState.imageUrl}
                      alt={`${formState.nameDe || formState.nameEn} Vorschau`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.text.secondary }}>
                      Kein Bild vorhanden
                    </div>
                  )}
                </div>
                <Button
                  title={generatingImage ? 'Generiere...' : 'Artefakt Bild generieren'}
                  onPress={handleGenerateImage}
                  icon={<Sparkles size={16} />}
                  variant="secondary"
                  disabled={generatingImage}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center', flexWrap: 'wrap' }}>
              {!isNewArtifact && editingArtifact && (
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

function mapArtifactToForm(artifact: ArtifactTemplate): ArtifactFormState {
  return {
    nameDe: artifact.name?.de ?? '',
    nameEn: artifact.name?.en ?? '',
    descriptionDe: artifact.description?.de ?? '',
    descriptionEn: artifact.description?.en ?? '',
    category: artifact.category ?? 'magic',
    rarity: artifact.rarity ?? 'common',
    storyRole: artifact.storyRole ?? '',
    discoveryScenarios: (artifact.discoveryScenarios ?? []).join(', '),
    usageScenarios: (artifact.usageScenarios ?? []).join(', '),
    visualKeywords: (artifact.visualKeywords ?? []).join(', '),
    emoji: artifact.emoji ?? '',
    genreAdventure: String(artifact.genreAffinity?.adventure ?? 0.5),
    genreFantasy: String(artifact.genreAffinity?.fantasy ?? 0.5),
    genreMystery: String(artifact.genreAffinity?.mystery ?? 0.5),
    genreNature: String(artifact.genreAffinity?.nature ?? 0.5),
    genreFriendship: String(artifact.genreAffinity?.friendship ?? 0.5),
    genreCourage: String(artifact.genreAffinity?.courage ?? 0.5),
    genreLearning: String(artifact.genreAffinity?.learning ?? 0.5),
    isActive: artifact.isActive ?? true,
    imageUrl: artifact.imageUrl,
  };
}

function createEmptyFormState(): ArtifactFormState {
  return {
    nameDe: '',
    nameEn: '',
    descriptionDe: '',
    descriptionEn: '',
    category: 'magic',
    rarity: 'common',
    storyRole: '',
    discoveryScenarios: '',
    usageScenarios: '',
    visualKeywords: '',
    emoji: '',
    genreAdventure: '0.5',
    genreFantasy: '0.5',
    genreMystery: '0.5',
    genreNature: '0.5',
    genreFriendship: '0.5',
    genreCourage: '0.5',
    genreLearning: '0.5',
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

function parseAffinity(value: string, fallback = 0.5): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, parsed));
}

function buildGenreAffinity(form: ArtifactFormState): ArtifactTemplate["genreAffinity"] {
  return {
    adventure: parseAffinity(form.genreAdventure),
    fantasy: parseAffinity(form.genreFantasy),
    mystery: parseAffinity(form.genreMystery),
    nature: parseAffinity(form.genreNature),
    friendship: parseAffinity(form.genreFriendship),
    courage: parseAffinity(form.genreCourage),
    learning: parseAffinity(form.genreLearning),
  };
}

function buildCreatePayload(
  form: ArtifactFormState
): Omit<ArtifactTemplate, "id" | "createdAt" | "updatedAt" | "recentUsageCount" | "totalUsageCount" | "lastUsedAt" | "lastUsedInStoryId"> {
  return {
    name: {
      de: form.nameDe.trim() || form.nameEn.trim() || 'Artefakt',
      en: form.nameEn.trim() || form.nameDe.trim() || 'Artifact',
    },
    description: {
      de: form.descriptionDe.trim() || form.descriptionEn.trim() || 'Magisches Artefakt.',
      en: form.descriptionEn.trim() || form.descriptionDe.trim() || 'Magical artifact.',
    },
    category: (form.category.trim() || 'magic') as ArtifactTemplate["category"],
    rarity: (form.rarity.trim() || 'common') as ArtifactTemplate["rarity"],
    storyRole: form.storyRole.trim() || 'Hilft in der Geschichte',
    discoveryScenarios: parseCommaList(form.discoveryScenarios),
    usageScenarios: parseCommaList(form.usageScenarios),
    emoji: form.emoji.trim() || undefined,
    visualKeywords: parseCommaList(form.visualKeywords),
    imageUrl: form.imageUrl,
    genreAffinity: buildGenreAffinity(form),
    isActive: form.isActive,
  };
}

function buildUpdatePayload(original: ArtifactTemplate, form: ArtifactFormState) {
  const updates: Record<string, any> = {};

  const nextName = {
    de: form.nameDe.trim() || form.nameEn.trim() || original.name?.de || 'Artefakt',
    en: form.nameEn.trim() || form.nameDe.trim() || original.name?.en || 'Artifact',
  };
  if (JSON.stringify(nextName) !== JSON.stringify(original.name ?? {})) {
    updates.name = nextName;
  }

  const nextDescription = {
    de: form.descriptionDe.trim() || form.descriptionEn.trim() || original.description?.de || 'Magisches Artefakt.',
    en: form.descriptionEn.trim() || form.descriptionDe.trim() || original.description?.en || 'Magical artifact.',
  };
  if (JSON.stringify(nextDescription) !== JSON.stringify(original.description ?? {})) {
    updates.description = nextDescription;
  }

  if (form.category.trim() !== original.category) {
    updates.category = form.category.trim();
  }
  if (form.rarity.trim() !== original.rarity) {
    updates.rarity = form.rarity.trim();
  }
  if (form.storyRole.trim() !== (original.storyRole ?? '')) {
    updates.storyRole = form.storyRole.trim();
  }

  const discoveryScenarios = parseCommaList(form.discoveryScenarios);
  if (JSON.stringify(discoveryScenarios) !== JSON.stringify(original.discoveryScenarios ?? [])) {
    updates.discoveryScenarios = discoveryScenarios;
  }

  const usageScenarios = parseCommaList(form.usageScenarios);
  if (JSON.stringify(usageScenarios) !== JSON.stringify(original.usageScenarios ?? [])) {
    updates.usageScenarios = usageScenarios;
  }

  const visualKeywords = parseCommaList(form.visualKeywords);
  if (JSON.stringify(visualKeywords) !== JSON.stringify(original.visualKeywords ?? [])) {
    updates.visualKeywords = visualKeywords;
  }

  const emoji = form.emoji.trim();
  if (emoji !== (original.emoji ?? '')) {
    updates.emoji = emoji.length > 0 ? emoji : null;
  }

  const genreAffinity = buildGenreAffinity(form);
  if (JSON.stringify(genreAffinity) !== JSON.stringify(original.genreAffinity ?? {})) {
    updates.genreAffinity = genreAffinity;
  }

  if (form.imageUrl !== original.imageUrl) {
    updates.imageUrl = form.imageUrl ?? null;
  }

  if ((original.isActive ?? true) !== form.isActive) {
    updates.isActive = form.isActive;
  }

  return updates;
}

export default ArtifactPoolScreen;
