import React, { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Upload,
  BookOpen,
  Users,
  Clock,
  Tag,
  ChevronDown,
  ChevronRight,
  Eye,
  Lock,
  AlertCircle,
  Edit2,
  Save,
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useBackend } from '../../hooks/useBackend';
import Button from '../../components/common/Button';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import type { CompleteFairyTaleExport } from '~backend/fairytales/management';

type RoleType = 'protagonist' | 'antagonist' | 'helper' | 'love_interest' | 'supporting';

interface FairyTale {
  id: string;
  title: string;
  source: string;
  originalLanguage?: string;
  englishTranslation?: string;
  cultureRegion: string;
  ageRecommendation: number;
  durationMinutes: number;
  genreTags: string[];
  moralLesson?: string;
  summary?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FairyTaleRole {
  id: number;
  taleId: string;
  roleType: RoleType;
  roleName?: string;
  roleCount: number;
  description?: string;
  required: boolean;
  archetypePreference?: string;
  ageRangeMin?: number;
  ageRangeMax?: number;
  professionPreference: string[];
  createdAt: string;
}

interface FairyTaleScene {
  id: number;
  taleId: string;
  sceneNumber: number;
  sceneTitle?: string;
  sceneDescription: string;
  dialogueTemplate?: string;
  characterVariables: Record<string, string>;
  setting?: string;
  mood?: string;
  illustrationPromptTemplate?: string;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

const FairyTalesScreen: React.FC = () => {
  const backend = useBackend();
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [tales, setTales] = useState<FairyTale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTale, setSelectedTale] = useState<string | null>(null);
  const [taleDetails, setTaleDetails] = useState<
    Record<string, { roles: FairyTaleRole[]; scenes: FairyTaleScene[] }>
  >({});
  const [expandedTales, setExpandedTales] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editing states
  const [editingTale, setEditingTale] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<number | null>(null);
  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [editedTaleData, setEditedTaleData] = useState<Partial<FairyTale>>({});
  const [editedRoleData, setEditedRoleData] = useState<Partial<FairyTaleRole>>({});
  const [editedSceneData, setEditedSceneData] = useState<Partial<FairyTaleScene>>({});

  const loadTales = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const response = await backend.fairytales.listFairyTales({ limit: 100 });
      setTales(response.tales || []);
    } catch (error) {
      console.error('Error loading fairy tales:', error);
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('auth')) {
        setErrorMessage('Authentifizierung fehlgeschlagen. Bitte melde dich erneut an.');
      } else {
        setErrorMessage('Fehler beim Laden der Märchen. Bitte versuche es erneut.');
      }
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      setLoading(false);
      setTales([]);
      setSelectedTale(null);
      setTaleDetails({});
      setExpandedTales(new Set());
      setErrorMessage('Bitte melde dich an, um die Märchenverwaltung zu nutzen.');
      return;
    }

    loadTales();
  }, [isLoaded, isSignedIn, loadTales]);

  const loadTaleDetails = async (taleId: string) => {
    if (taleDetails[taleId]) return;

    try {
      const response = await backend.fairytales.getFairyTale({
        id: taleId,
        includeRoles: true,
        includeScenes: true,
      });
      setTaleDetails((prev) => ({
        ...prev,
        [taleId]: {
          roles: response.roles || [],
          scenes: response.scenes || [],
        },
      }));
    } catch (error) {
      console.error('Error loading tale details:', error);
    }
  };

  const toggleTaleExpansion = (taleId: string) => {
    const newExpanded = new Set(expandedTales);
    if (newExpanded.has(taleId)) {
      newExpanded.delete(taleId);
    } else {
      newExpanded.add(taleId);
      loadTaleDetails(taleId);
    }
    setExpandedTales(newExpanded);
  };

  const handleExportAll = async () => {
    try {
      const response = await backend.fairytales.exportFairyTales({});
      downloadJSON(response.tales, 'fairytales-export-all.json');
    } catch (error) {
      console.error('Error exporting fairy tales:', error);
      alert('Fehler beim Exportieren der Märchen');
    }
  };

  const handleExportSelected = async () => {
    if (!selectedTale) {
      alert('Bitte wähle zuerst ein Märchen aus');
      return;
    }
    try {
      const response = await backend.fairytales.exportFairyTales({ taleIds: [selectedTale] });
      const tale = tales.find((t) => t.id === selectedTale);
      const fileName = `fairytale-${tale?.title.replace(/\s+/g, '-').toLowerCase()}.json`;
      downloadJSON(response.tales, fileName);
    } catch (error) {
      console.error('Error exporting fairy tale:', error);
      alert('Fehler beim Exportieren des Märchens');
    }
  };

  const downloadJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data: CompleteFairyTaleExport[] = JSON.parse(text);

        const overwrite = window.confirm(
          'Vorhandene Märchen mit gleicher ID überschreiben?\n\nJa = Überschreiben\nNein = Nur neue hinzufügen'
        );

        const response = await backend.fairytales.importFairyTales({
          tales: data,
          overwriteExisting: overwrite,
        });

        const message =
          `Import abgeschlossen:\n\n` +
          `✓ ${response.imported} neu importiert\n` +
          `↻ ${response.updated} aktualisiert\n` +
          `⊘ ${response.skipped} übersprungen\n` +
          (response.errors.length > 0 ? `✗ ${response.errors.length} Fehler` : '');

        alert(message);

        if (response.errors.length > 0) {
          console.error('Import errors:', response.errors);
        }

        loadTales();
      } catch (error) {
        console.error('Error importing fairy tales:', error);
        alert('Fehler beim Importieren der Märchen. Bitte überprüfe das JSON-Format.');
      }
    };
    input.click();
  };

  // Tale editing functions
  const startEditingTale = (tale: FairyTale) => {
    setEditingTale(tale.id);
    setEditedTaleData(tale);
  };

  const cancelEditingTale = () => {
    setEditingTale(null);
    setEditedTaleData({});
  };

  const saveTale = async () => {
    if (!editingTale || !editedTaleData) return;

    try {
      await backend.fairytales.updateFairyTale({
        id: editingTale,
        updates: {
          title: editedTaleData.title,
          source: editedTaleData.source,
          originalLanguage: editedTaleData.originalLanguage,
          englishTranslation: editedTaleData.englishTranslation,
          cultureRegion: editedTaleData.cultureRegion,
          ageRecommendation: editedTaleData.ageRecommendation,
          durationMinutes: editedTaleData.durationMinutes,
          genreTags: editedTaleData.genreTags,
          moralLesson: editedTaleData.moralLesson,
          summary: editedTaleData.summary,
          isActive: editedTaleData.isActive,
        },
      });

      // Refresh tales
      await loadTales();
      setEditingTale(null);
      setEditedTaleData({});
    } catch (error) {
      console.error('Error saving tale:', error);
      alert('Fehler beim Speichern des Märchens');
    }
  };

  // Role editing functions
  const startEditingRole = (role: FairyTaleRole) => {
    setEditingRole(role.id);
    setEditedRoleData(role);
  };

  const cancelEditingRole = () => {
    setEditingRole(null);
    setEditedRoleData({});
  };

  const saveRole = async (taleId: string) => {
    if (!editingRole || !editedRoleData) return;

    try {
      await backend.fairytales.updateRole({
        taleId,
        roleId: editingRole,
        updates: {
          roleType: editedRoleData.roleType,
          roleName: editedRoleData.roleName,
          roleCount: editedRoleData.roleCount,
          description: editedRoleData.description,
          required: editedRoleData.required,
          archetypePreference: editedRoleData.archetypePreference,
          ageRangeMin: editedRoleData.ageRangeMin,
          ageRangeMax: editedRoleData.ageRangeMax,
          professionPreference: editedRoleData.professionPreference,
        },
      });

      // Refresh tale details
      delete taleDetails[taleId];
      await loadTaleDetails(taleId);
      setEditingRole(null);
      setEditedRoleData({});
    } catch (error) {
      console.error('Error saving role:', error);
      alert('Fehler beim Speichern der Rolle');
    }
  };

  const addRole = async (taleId: string) => {
    try {
      await backend.fairytales.addFairyTaleRole({
        taleId,
        role: {
          roleType: 'supporting',
          roleName: 'Neue Rolle',
          roleCount: 1,
          description: '',
          required: false,
          professionPreference: [],
        },
      });

      // Refresh tale details
      delete taleDetails[taleId];
      await loadTaleDetails(taleId);
    } catch (error) {
      console.error('Error adding role:', error);
      alert('Fehler beim Hinzufügen der Rolle');
    }
  };

  const deleteRole = async (taleId: string, roleId: number) => {
    if (!window.confirm('Rolle wirklich löschen?')) return;

    try {
      await backend.fairytales.deleteRole({ taleId, roleId });

      // Refresh tale details
      delete taleDetails[taleId];
      await loadTaleDetails(taleId);
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('Fehler beim Löschen der Rolle');
    }
  };

  // Scene editing functions
  const startEditingScene = (scene: FairyTaleScene) => {
    setEditingScene(scene.id);
    setEditedSceneData(scene);
  };

  const cancelEditingScene = () => {
    setEditingScene(null);
    setEditedSceneData({});
  };

  const saveScene = async (taleId: string) => {
    if (!editingScene || !editedSceneData) return;

    try {
      await backend.fairytales.updateScene({
        taleId,
        sceneId: editingScene,
        updates: {
          sceneNumber: editedSceneData.sceneNumber,
          sceneTitle: editedSceneData.sceneTitle,
          sceneDescription: editedSceneData.sceneDescription,
          dialogueTemplate: editedSceneData.dialogueTemplate,
          characterVariables: editedSceneData.characterVariables,
          setting: editedSceneData.setting,
          mood: editedSceneData.mood,
          illustrationPromptTemplate: editedSceneData.illustrationPromptTemplate,
          durationSeconds: editedSceneData.durationSeconds,
        },
      });

      // Refresh tale details
      delete taleDetails[taleId];
      await loadTaleDetails(taleId);
      setEditingScene(null);
      setEditedSceneData({});
    } catch (error) {
      console.error('Error saving scene:', error);
      alert('Fehler beim Speichern der Szene');
    }
  };

  const addScene = async (taleId: string) => {
    const details = taleDetails[taleId];
    const nextSceneNumber = details ? details.scenes.length + 1 : 1;

    try {
      await backend.fairytales.addFairyTaleScene({
        taleId,
        scene: {
          sceneNumber: nextSceneNumber,
          sceneTitle: `Szene ${nextSceneNumber}`,
          sceneDescription: 'Neue Szene',
          characterVariables: {},
          durationSeconds: 60,
        },
      });

      // Refresh tale details
      delete taleDetails[taleId];
      await loadTaleDetails(taleId);
    } catch (error) {
      console.error('Error adding scene:', error);
      alert('Fehler beim Hinzufügen der Szene');
    }
  };

  const deleteScene = async (taleId: string, sceneId: number) => {
    if (!window.confirm('Szene wirklich löschen?')) return;

    try {
      await backend.fairytales.deleteScene({ taleId, sceneId });

      // Refresh tale details
      delete taleDetails[taleId];
      await loadTaleDetails(taleId);
    } catch (error) {
      console.error('Error deleting scene:', error);
      alert('Fehler beim Löschen der Szene');
    }
  };

  const moveScene = async (taleId: string, sceneId: number, direction: 'up' | 'down') => {
    const details = taleDetails[taleId];
    if (!details) return;

    const sceneIndex = details.scenes.findIndex((s) => s.id === sceneId);
    if (sceneIndex === -1) return;

    const newIndex = direction === 'up' ? sceneIndex - 1 : sceneIndex + 1;
    if (newIndex < 0 || newIndex >= details.scenes.length) return;

    try {
      // Swap scene numbers
      const scenes = [...details.scenes];
      const currentScene = scenes[sceneIndex];
      const otherScene = scenes[newIndex];

      const sceneOrdering = [
        { sceneId: currentScene.id, newSceneNumber: otherScene.sceneNumber },
        { sceneId: otherScene.id, newSceneNumber: currentScene.sceneNumber },
      ];

      await backend.fairytales.reorderScenes({ taleId, sceneOrdering });

      // Refresh tale details
      delete taleDetails[taleId];
      await loadTaleDetails(taleId);
    } catch (error) {
      console.error('Error reordering scenes:', error);
      alert('Fehler beim Verschieben der Szene');
    }
  };

  const getRoleTypeBadgeColor = (roleType: string) => {
    switch (roleType) {
      case 'protagonist':
        return '#10b981';
      case 'antagonist':
        return '#ef4444';
      case 'helper':
        return '#3b82f6';
      case 'love_interest':
        return '#ec4899';
      default:
        return '#6b7280';
    }
  };

  const getRoleTypeLabel = (roleType: string) => {
    switch (roleType) {
      case 'protagonist':
        return 'Protagonist';
      case 'antagonist':
        return 'Antagonist';
      case 'helper':
        return 'Helfer';
      case 'love_interest':
        return 'Liebesinteresse';
      case 'supporting':
        return 'Nebenrolle';
      default:
        return roleType;
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: colors.background.primary,
    paddingBottom: '120px',
  };

  const headerStyle: React.CSSProperties = {
    padding: `${spacing.xl}px`,
    marginBottom: `${spacing.lg}px`,
  };

  const headerCardStyle: React.CSSProperties = {
    borderRadius: `${radii.xl}px`,
    padding: `${spacing.xl}px`,
    background: colors.glass.background,
    border: `1px solid ${colors.glass.border}`,
    boxShadow: colors.glass.shadowStrong,
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.displayLg,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: spacing.md,
    marginTop: spacing.lg,
    flexWrap: 'wrap' as const,
  };

  const contentStyle: React.CSSProperties = {
    padding: `0 ${spacing.xl}px`,
  };

  const talesGridStyle: React.CSSProperties = {
    display: 'grid',
    gap: `${spacing.md}px`,
  };

  const taleCardStyle: React.CSSProperties = {
    borderRadius: `${radii.lg}px`,
    padding: `${spacing.lg}px`,
    background: colors.glass.background,
    border: `2px solid ${colors.glass.border}`,
    boxShadow: colors.glass.shadow,
    backdropFilter: 'blur(12px) saturate(140%)',
    WebkitBackdropFilter: 'blur(12px) saturate(140%)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  };

  const taleHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  };

  const taleMainInfoStyle: React.CSSProperties = {
    flex: 1,
  };

  const taleTitleStyle: React.CSSProperties = {
    ...typography.textStyles.headingMd,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  const taleMetaStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: spacing.md,
    marginTop: spacing.sm,
    fontSize: '14px',
    color: colors.text.secondary,
  };

  const metaItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
  };

  const tagsStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: spacing.xs,
    marginTop: spacing.sm,
  };

  const tagStyle: React.CSSProperties = {
    padding: `${spacing.xs}px ${spacing.sm}px`,
    borderRadius: `${radii.md}px`,
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    fontSize: '12px',
    color: '#a78bfa',
  };

  const detailsSectionStyle: React.CSSProperties = {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTop: `1px solid ${colors.glass.border}`,
  };

  const sectionTitleStyle: React.CSSProperties = {
    ...typography.textStyles.headingSm,
    color: colors.text.primary,
    marginBottom: spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const roleCardStyle: React.CSSProperties = {
    padding: spacing.md,
    borderRadius: radii.md,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    marginBottom: spacing.sm,
  };

  const sceneCardStyle: React.CSSProperties = {
    padding: spacing.md,
    borderRadius: radii.md,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    marginBottom: spacing.sm,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${spacing.sm}px`,
    borderRadius: `${radii.sm}px`,
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: colors.text.primary,
    fontSize: '14px',
    marginBottom: spacing.xs,
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '80px',
    resize: 'vertical' as const,
  };

  const stateCardStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: spacing.xxl,
    borderRadius: radii.xxl,
    background: colors.glass.backgroundAlt,
    border: `1px solid ${colors.glass.border}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.md,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerCardStyle}>
          <h1 style={titleStyle}>
            <BookOpen size={40} />
            Märchen-Verwaltung
          </h1>
          <p style={{ ...typography.textStyles.body, color: colors.text.secondary }}>
            Verwalte die öffentlichen Märchen-Vorlagen für Story-Generierung
          </p>

          <div style={actionsStyle}>
            <Button
              title="Alle exportieren"
              variant="primary"
              onPress={handleExportAll}
              icon={<Download size={18} />}
            />
            <Button
              title="Auswahl exportieren"
              variant="secondary"
              onPress={handleExportSelected}
              icon={<Download size={18} />}
              disabled={!selectedTale}
            />
            <Button
              title="JSON importieren"
              variant="fun"
              onPress={handleImport}
              icon={<Upload size={18} />}
            />
          </div>
        </div>
      </div>

      <div style={contentStyle}>
        {!isLoaded ? (
          <div style={stateCardStyle}>
            <BookOpen size={48} style={{ color: colors.text.tertiary }} />
            <p style={{ color: colors.text.secondary }}>Prüfe Anmeldung...</p>
          </div>
        ) : !isSignedIn ? (
          <div style={stateCardStyle}>
            <Lock size={48} style={{ color: colors.text.tertiary }} />
            <h3 style={{ ...typography.textStyles.headingMd, margin: 0 }}>Bitte anmelden</h3>
            <p style={{ color: colors.text.secondary }}>
              Du musst angemeldet sein, um die Märchenverwaltung zu sehen.
            </p>
            <Button title="Zur Anmeldung" variant="primary" onPress={() => navigate('/auth')} />
          </div>
        ) : loading ? (
          <div style={stateCardStyle}>
            <BookOpen size={48} style={{ color: colors.text.tertiary }} />
            <p style={{ color: colors.text.secondary }}>Lade Märchen...</p>
          </div>
        ) : errorMessage ? (
          <div style={stateCardStyle}>
            <AlertCircle size={48} style={{ color: colors.semantic.error }} />
            <p style={{ color: colors.text.secondary }}>{errorMessage}</p>
            <Button title="Erneut versuchen" variant="primary" onPress={loadTales} />
          </div>
        ) : tales.length === 0 ? (
          <div style={stateCardStyle}>
            <BookOpen size={48} style={{ color: colors.text.tertiary }} />
            <p style={{ color: colors.text.secondary, marginTop: spacing.md }}>
              Keine Märchen gefunden. Importiere eine JSON-Datei.
            </p>
          </div>
        ) : (
          <div style={talesGridStyle}>
            {tales.map((tale) => {
              const isExpanded = expandedTales.has(tale.id);
              const details = taleDetails[tale.id];
              const isEditing = editingTale === tale.id;
              const currentTaleData = isEditing ? (editedTaleData as FairyTale) : tale;

              return (
                <motion.div
                  key={tale.id}
                  style={{
                    ...taleCardStyle,
                    borderColor: selectedTale === tale.id ? '#8b5cf6' : colors.glass.border,
                  }}
                  onClick={() => setSelectedTale(tale.id)}
                  whileHover={{ scale: 1.01 }}
                >
                  <div style={taleHeaderStyle}>
                    <div style={taleMainInfoStyle}>
                      {/* Tale Title */}
                      {isEditing ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <input
                            style={inputStyle}
                            value={currentTaleData.title || ''}
                            onChange={(e) =>
                              setEditedTaleData({ ...editedTaleData, title: e.target.value })
                            }
                            placeholder="Titel"
                          />
                          <input
                            style={inputStyle}
                            value={currentTaleData.englishTranslation || ''}
                            onChange={(e) =>
                              setEditedTaleData({
                                ...editedTaleData,
                                englishTranslation: e.target.value,
                              })
                            }
                            placeholder="Englische Übersetzung"
                          />
                        </div>
                      ) : (
                        <h3 style={taleTitleStyle}>
                          {tale.title}
                          {tale.englishTranslation && (
                            <span style={{ fontSize: '14px', color: colors.text.tertiary }}>
                              ({tale.englishTranslation})
                            </span>
                          )}
                        </h3>
                      )}

                      {/* Tale Metadata */}
                      {isEditing ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <input
                            style={inputStyle}
                            value={currentTaleData.source || ''}
                            onChange={(e) =>
                              setEditedTaleData({ ...editedTaleData, source: e.target.value })
                            }
                            placeholder="Quelle"
                          />
                          <input
                            style={inputStyle}
                            value={currentTaleData.cultureRegion || ''}
                            onChange={(e) =>
                              setEditedTaleData({ ...editedTaleData, cultureRegion: e.target.value })
                            }
                            placeholder="Kulturregion"
                          />
                          <input
                            type="number"
                            style={inputStyle}
                            value={currentTaleData.ageRecommendation || 0}
                            onChange={(e) =>
                              setEditedTaleData({
                                ...editedTaleData,
                                ageRecommendation: parseInt(e.target.value),
                              })
                            }
                            placeholder="Altersempfehlung"
                          />
                          <input
                            type="number"
                            style={inputStyle}
                            value={currentTaleData.durationMinutes || 0}
                            onChange={(e) =>
                              setEditedTaleData({
                                ...editedTaleData,
                                durationMinutes: parseInt(e.target.value),
                              })
                            }
                            placeholder="Dauer (Minuten)"
                          />
                          <input
                            style={inputStyle}
                            value={currentTaleData.genreTags?.join(', ') || ''}
                            onChange={(e) =>
                              setEditedTaleData({
                                ...editedTaleData,
                                genreTags: e.target.value.split(',').map((t) => t.trim()),
                              })
                            }
                            placeholder="Genre Tags (kommagetrennt)"
                          />
                          <textarea
                            style={textareaStyle}
                            value={currentTaleData.moralLesson || ''}
                            onChange={(e) =>
                              setEditedTaleData({ ...editedTaleData, moralLesson: e.target.value })
                            }
                            placeholder="Moral"
                          />
                          <textarea
                            style={textareaStyle}
                            value={currentTaleData.summary || ''}
                            onChange={(e) =>
                              setEditedTaleData({ ...editedTaleData, summary: e.target.value })
                            }
                            placeholder="Zusammenfassung"
                          />
                        </div>
                      ) : (
                        <>
                          <div style={taleMetaStyle}>
                            <div style={metaItemStyle}>
                              <Users size={16} />
                              <span>{tale.source}</span>
                            </div>
                            <div style={metaItemStyle}>
                              <Clock size={16} />
                              <span>{tale.durationMinutes} Min</span>
                            </div>
                            <div style={metaItemStyle}>
                              <Tag size={16} />
                              <span>Ab {tale.ageRecommendation} Jahren</span>
                            </div>
                          </div>

                          {tale.genreTags && tale.genreTags.length > 0 && (
                            <div style={tagsStyle}>
                              {tale.genreTags.map((tag, i) => (
                                <span key={i} style={tagStyle}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {tale.moralLesson && (
                            <p
                              style={{
                                ...typography.textStyles.bodySm,
                                color: colors.text.secondary,
                                marginTop: spacing.sm,
                                fontStyle: 'italic',
                              }}
                            >
                              Moral: {tale.moralLesson}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Tale Actions */}
                    <div style={{ display: 'flex', gap: spacing.xs }} onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <>
                          <Button
                            title=""
                            variant="primary"
                            size="sm"
                            onPress={saveTale}
                            icon={<Save size={16} />}
                          />
                          <Button
                            title=""
                            variant="ghost"
                            size="sm"
                            onPress={cancelEditingTale}
                            icon={<X size={16} />}
                          />
                        </>
                      ) : (
                        <Button
                          title=""
                          variant="ghost"
                          size="sm"
                          onPress={(e) => {
                            e.stopPropagation();
                            startEditingTale(tale);
                          }}
                          icon={<Edit2 size={16} />}
                        />
                      )}
                      <Button
                        title={isExpanded ? '' : ''}
                        variant="ghost"
                        size="sm"
                        onPress={(event) => {
                          event.stopPropagation();
                          toggleTaleExpansion(tale.id);
                        }}
                        icon={isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      />
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && details && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={detailsSectionStyle}>
                          {/* Roles Section */}
                          <div>
                            <h4 style={sectionTitleStyle}>
                              <span>Rollen ({details.roles.length})</span>
                              <Button
                                title="Neue Rolle"
                                variant="fun"
                                size="sm"
                                onPress={() => addRole(tale.id)}
                                icon={<Plus size={16} />}
                              />
                            </h4>
                            {details.roles.map((role) => {
                              const isEditingThisRole = editingRole === role.id;
                              const currentRoleData = isEditingThisRole
                                ? (editedRoleData as FairyTaleRole)
                                : role;

                              return (
                                <div key={role.id} style={roleCardStyle}>
                                  {isEditingThisRole ? (
                                    <div>
                                      <select
                                        style={inputStyle}
                                        value={currentRoleData.roleType}
                                        onChange={(e) =>
                                          setEditedRoleData({
                                            ...editedRoleData,
                                            roleType: e.target.value as RoleType,
                                          })
                                        }
                                      >
                                        <option value="protagonist">Protagonist</option>
                                        <option value="antagonist">Antagonist</option>
                                        <option value="helper">Helfer</option>
                                        <option value="love_interest">Liebesinteresse</option>
                                        <option value="supporting">Nebenrolle</option>
                                      </select>
                                      <input
                                        style={inputStyle}
                                        value={currentRoleData.roleName || ''}
                                        onChange={(e) =>
                                          setEditedRoleData({
                                            ...editedRoleData,
                                            roleName: e.target.value,
                                          })
                                        }
                                        placeholder="Rollenname"
                                      />
                                      <input
                                        type="number"
                                        style={inputStyle}
                                        value={currentRoleData.roleCount || 1}
                                        onChange={(e) =>
                                          setEditedRoleData({
                                            ...editedRoleData,
                                            roleCount: parseInt(e.target.value),
                                          })
                                        }
                                        placeholder="Anzahl"
                                      />
                                      <textarea
                                        style={textareaStyle}
                                        value={currentRoleData.description || ''}
                                        onChange={(e) =>
                                          setEditedRoleData({
                                            ...editedRoleData,
                                            description: e.target.value,
                                          })
                                        }
                                        placeholder="Beschreibung"
                                      />
                                      <input
                                        style={inputStyle}
                                        value={currentRoleData.professionPreference?.join(', ') || ''}
                                        onChange={(e) =>
                                          setEditedRoleData({
                                            ...editedRoleData,
                                            professionPreference: e.target.value
                                              .split(',')
                                              .map((t) => t.trim()),
                                          })
                                        }
                                        placeholder="Berufspräferenzen (kommagetrennt)"
                                      />
                                      <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                                        <Button
                                          title="Speichern"
                                          variant="primary"
                                          size="sm"
                                          onPress={() => saveRole(tale.id)}
                                          icon={<Save size={16} />}
                                        />
                                        <Button
                                          title="Abbrechen"
                                          variant="ghost"
                                          size="sm"
                                          onPress={cancelEditingRole}
                                          icon={<X size={16} />}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                        }}
                                      >
                                        <div>
                                          <span
                                            style={{
                                              padding: `4px 8px`,
                                              borderRadius: '4px',
                                              background: getRoleTypeBadgeColor(role.roleType),
                                              color: 'white',
                                              fontSize: '12px',
                                              marginRight: spacing.sm,
                                            }}
                                          >
                                            {getRoleTypeLabel(role.roleType)}
                                          </span>
                                          <strong style={{ color: colors.text.primary }}>
                                            {role.roleName || 'Unbenannt'}
                                          </strong>
                                          {role.required && (
                                            <span
                                              style={{
                                                marginLeft: spacing.xs,
                                                fontSize: '12px',
                                                color: '#ef4444',
                                              }}
                                            >
                                              *
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
                                          <span style={{ fontSize: '14px', color: colors.text.tertiary }}>
                                            × {role.roleCount}
                                          </span>
                                          <Button
                                            title=""
                                            variant="ghost"
                                            size="sm"
                                            onPress={() => startEditingRole(role)}
                                            icon={<Edit2 size={14} />}
                                          />
                                          <Button
                                            title=""
                                            variant="ghost"
                                            size="sm"
                                            onPress={() => deleteRole(tale.id, role.id)}
                                            icon={<Trash2 size={14} />}
                                          />
                                        </div>
                                      </div>
                                      {role.description && (
                                        <p
                                          style={{
                                            ...typography.textStyles.bodySm,
                                            color: colors.text.secondary,
                                            marginTop: spacing.xs,
                                          }}
                                        >
                                          {role.description}
                                        </p>
                                      )}
                                      {role.professionPreference && role.professionPreference.length > 0 && (
                                        <p
                                          style={{
                                            fontSize: '12px',
                                            color: colors.text.tertiary,
                                            marginTop: spacing.xs,
                                          }}
                                        >
                                          Berufe: {role.professionPreference.join(', ')}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Scenes Section */}
                          <div style={{ marginTop: spacing.lg }}>
                            <h4 style={sectionTitleStyle}>
                              <span>Szenen ({details.scenes.length})</span>
                              <Button
                                title="Neue Szene"
                                variant="fun"
                                size="sm"
                                onPress={() => addScene(tale.id)}
                                icon={<Plus size={16} />}
                              />
                            </h4>
                            {details.scenes
                              .sort((a, b) => a.sceneNumber - b.sceneNumber)
                              .map((scene, idx) => {
                                const isEditingThisScene = editingScene === scene.id;
                                const currentSceneData = isEditingThisScene
                                  ? (editedSceneData as FairyTaleScene)
                                  : scene;

                                return (
                                  <div key={scene.id} style={sceneCardStyle}>
                                    {isEditingThisScene ? (
                                      <div>
                                        <input
                                          style={inputStyle}
                                          value={currentSceneData.sceneTitle || ''}
                                          onChange={(e) =>
                                            setEditedSceneData({
                                              ...editedSceneData,
                                              sceneTitle: e.target.value,
                                            })
                                          }
                                          placeholder="Szenen-Titel"
                                        />
                                        <textarea
                                          style={textareaStyle}
                                          value={currentSceneData.sceneDescription || ''}
                                          onChange={(e) =>
                                            setEditedSceneData({
                                              ...editedSceneData,
                                              sceneDescription: e.target.value,
                                            })
                                          }
                                          placeholder="Beschreibung"
                                        />
                                        <textarea
                                          style={textareaStyle}
                                          value={currentSceneData.dialogueTemplate || ''}
                                          onChange={(e) =>
                                            setEditedSceneData({
                                              ...editedSceneData,
                                              dialogueTemplate: e.target.value,
                                            })
                                          }
                                          placeholder="Dialog-Vorlage"
                                        />
                                        <input
                                          style={inputStyle}
                                          value={currentSceneData.setting || ''}
                                          onChange={(e) =>
                                            setEditedSceneData({
                                              ...editedSceneData,
                                              setting: e.target.value,
                                            })
                                          }
                                          placeholder="Schauplatz"
                                        />
                                        <input
                                          style={inputStyle}
                                          value={currentSceneData.mood || ''}
                                          onChange={(e) =>
                                            setEditedSceneData({ ...editedSceneData, mood: e.target.value })
                                          }
                                          placeholder="Stimmung"
                                        />
                                        <input
                                          type="number"
                                          style={inputStyle}
                                          value={currentSceneData.durationSeconds || 0}
                                          onChange={(e) =>
                                            setEditedSceneData({
                                              ...editedSceneData,
                                              durationSeconds: parseInt(e.target.value),
                                            })
                                          }
                                          placeholder="Dauer (Sekunden)"
                                        />
                                        <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                                          <Button
                                            title="Speichern"
                                            variant="primary"
                                            size="sm"
                                            onPress={() => saveScene(tale.id)}
                                            icon={<Save size={16} />}
                                          />
                                          <Button
                                            title="Abbrechen"
                                            variant="ghost"
                                            size="sm"
                                            onPress={cancelEditingScene}
                                            icon={<X size={16} />}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div
                                          style={{ display: 'flex', justifyContent: 'space-between' }}
                                        >
                                          <div style={{ flex: 1 }}>
                                            <div
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: spacing.sm,
                                                marginBottom: spacing.xs,
                                              }}
                                            >
                                              <span
                                                style={{
                                                  width: '24px',
                                                  height: '24px',
                                                  borderRadius: '50%',
                                                  background: '#8b5cf6',
                                                  color: 'white',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  fontSize: '12px',
                                                  fontWeight: 'bold',
                                                }}
                                              >
                                                {scene.sceneNumber}
                                              </span>
                                              {scene.sceneTitle && (
                                                <strong style={{ color: colors.text.primary }}>
                                                  {scene.sceneTitle}
                                                </strong>
                                              )}
                                            </div>
                                            <p
                                              style={{
                                                ...typography.textStyles.bodySm,
                                                color: colors.text.secondary,
                                                marginTop: spacing.xs,
                                              }}
                                            >
                                              {scene.sceneDescription}
                                            </p>
                                            {scene.setting && (
                                              <div
                                                style={{
                                                  marginTop: spacing.xs,
                                                  fontSize: '12px',
                                                  color: colors.text.tertiary,
                                                }}
                                              >
                                                Schauplatz: {scene.setting} | Stimmung: {scene.mood}
                                              </div>
                                            )}
                                          </div>
                                          <div
                                            style={{
                                              display: 'flex',
                                              flexDirection: 'column',
                                              gap: spacing.xs,
                                              alignItems: 'flex-end',
                                            }}
                                          >
                                            <span
                                              style={{ fontSize: '12px', color: colors.text.tertiary }}
                                            >
                                              {scene.durationSeconds}s
                                            </span>
                                            <div style={{ display: 'flex', gap: spacing.xs }}>
                                              <Button
                                                title=""
                                                variant="ghost"
                                                size="sm"
                                                onPress={() => moveScene(tale.id, scene.id, 'up')}
                                                icon={<ArrowUp size={14} />}
                                                disabled={idx === 0}
                                              />
                                              <Button
                                                title=""
                                                variant="ghost"
                                                size="sm"
                                                onPress={() => moveScene(tale.id, scene.id, 'down')}
                                                icon={<ArrowDown size={14} />}
                                                disabled={idx === details.scenes.length - 1}
                                              />
                                              <Button
                                                title=""
                                                variant="ghost"
                                                size="sm"
                                                onPress={() => startEditingScene(scene)}
                                                icon={<Edit2 size={14} />}
                                              />
                                              <Button
                                                title=""
                                                variant="ghost"
                                                size="sm"
                                                onPress={() => deleteScene(tale.id, scene.id)}
                                                icon={<Trash2 size={14} />}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FairyTalesScreen;
