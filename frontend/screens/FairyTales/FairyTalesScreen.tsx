import React, { useEffect, useState } from 'react';
import { Download, Upload, BookOpen, Users, Clock, Tag, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { useBackend } from '../../hooks/useBackend';
import Button from '../../components/common/Button';
import { colors, gradients } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';
import { motion, AnimatePresence } from 'framer-motion';

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
  roleType: string;
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

interface CompleteFairyTaleExport {
  tale: FairyTale;
  roles: FairyTaleRole[];
  scenes: FairyTaleScene[];
}

const FairyTalesScreen: React.FC = () => {
  const backend = useBackend();
  const [tales, setTales] = useState<FairyTale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTale, setSelectedTale] = useState<string | null>(null);
  const [taleDetails, setTaleDetails] = useState<Record<string, { roles: FairyTaleRole[]; scenes: FairyTaleScene[] }>>({});
  const [expandedTales, setExpandedTales] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTales();
  }, []);

  const loadTales = async () => {
    try {
      setLoading(true);
      const response = await backend.fairytales.listFairyTales({ limit: 100 });
      setTales(response.tales || []);
    } catch (error) {
      console.error('Error loading fairy tales:', error);
      alert('Fehler beim Laden der Märchen');
    } finally {
      setLoading(false);
    }
  };

  const loadTaleDetails = async (taleId: string) => {
    if (taleDetails[taleId]) return;

    try {
      const response = await backend.fairytales.getFairyTale({
        id: taleId,
        includeRoles: true,
        includeScenes: true
      });
      setTaleDetails(prev => ({
        ...prev,
        [taleId]: {
          roles: response.roles || [],
          scenes: response.scenes || []
        }
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
      const tale = tales.find(t => t.id === selectedTale);
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
          overwriteExisting: overwrite
        });

        const message = `Import abgeschlossen:\n\n` +
          `✓ ${response.imported} neu importiert\n` +
          `↻ ${response.updated} aktualisiert\n` +
          `⊘ ${response.skipped} übersprungen\n` +
          (response.errors.length > 0 ? `✗ ${response.errors.length} Fehler` : '');

        alert(message);

        if (response.errors.length > 0) {
          console.error('Import errors:', response.errors);
        }

        // Reload tales
        loadTales();
      } catch (error) {
        console.error('Error importing fairy tales:', error);
        alert('Fehler beim Importieren der Märchen. Bitte überprüfe das JSON-Format.');
      }
    };
    input.click();
  };

  const getRoleTypeBadgeColor = (roleType: string) => {
    switch (roleType) {
      case 'protagonist': return '#10b981';
      case 'antagonist': return '#ef4444';
      case 'helper': return '#3b82f6';
      case 'love_interest': return '#ec4899';
      default: return '#6b7280';
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
    ...typography.textStyles.h3,
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
    ...typography.textStyles.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
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
              variant="primary"
              onClick={handleExportAll}
              icon={<Download size={18} />}
            >
              Alle exportieren
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportSelected}
              icon={<Download size={18} />}
              disabled={!selectedTale}
            >
              Auswahl exportieren
            </Button>
            <Button
              variant="accent"
              onClick={handleImport}
              icon={<Upload size={18} />}
            >
              JSON importieren
            </Button>
          </div>
        </div>
      </div>

      <div style={contentStyle}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: spacing.xxl }}>
            <p style={{ color: colors.text.secondary }}>Lade Märchen...</p>
          </div>
        ) : tales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: spacing.xxl }}>
            <BookOpen size={48} style={{ color: colors.text.tertiary, margin: '0 auto' }} />
            <p style={{ color: colors.text.secondary, marginTop: spacing.md }}>
              Keine Märchen gefunden. Importiere eine JSON-Datei.
            </p>
          </div>
        ) : (
          <div style={talesGridStyle}>
            {tales.map((tale) => {
              const isExpanded = expandedTales.has(tale.id);
              const details = taleDetails[tale.id];

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
                      <h3 style={taleTitleStyle}>
                        {tale.title}
                        {tale.englishTranslation && (
                          <span style={{ fontSize: '14px', color: colors.text.tertiary }}>
                            ({tale.englishTranslation})
                          </span>
                        )}
                      </h3>

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
                            <span key={i} style={tagStyle}>{tag}</span>
                          ))}
                        </div>
                      )}

                      {tale.moralLesson && (
                        <p style={{
                          ...typography.textStyles.small,
                          color: colors.text.secondary,
                          marginTop: spacing.sm,
                          fontStyle: 'italic'
                        }}>
                          Moral: {tale.moralLesson}
                        </p>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTaleExpansion(tale.id);
                      }}
                      icon={isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    />
                  </div>

                  <AnimatePresence>
                    {isExpanded && details && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={detailsSectionStyle}>
                          {/* Roles Section */}
                          <div>
                            <h4 style={sectionTitleStyle}>
                              Rollen ({details.roles.length})
                            </h4>
                            {details.roles.map((role) => (
                              <div key={role.id} style={roleCardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <span style={{
                                      padding: `4px 8px`,
                                      borderRadius: '4px',
                                      background: getRoleTypeBadgeColor(role.roleType),
                                      color: 'white',
                                      fontSize: '12px',
                                      marginRight: spacing.sm
                                    }}>
                                      {role.roleType}
                                    </span>
                                    <strong style={{ color: colors.text.primary }}>
                                      {role.roleName || 'Unnamed'}
                                    </strong>
                                    {role.required && (
                                      <span style={{
                                        marginLeft: spacing.xs,
                                        fontSize: '12px',
                                        color: '#ef4444'
                                      }}>*</span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '14px', color: colors.text.tertiary }}>
                                    × {role.roleCount}
                                  </span>
                                </div>
                                {role.description && (
                                  <p style={{
                                    ...typography.textStyles.small,
                                    color: colors.text.secondary,
                                    marginTop: spacing.xs
                                  }}>
                                    {role.description}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Scenes Section */}
                          <div style={{ marginTop: spacing.lg }}>
                            <h4 style={sectionTitleStyle}>
                              Szenen ({details.scenes.length})
                            </h4>
                            {details.scenes.map((scene) => (
                              <div key={scene.id} style={sceneCardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                                      <span style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: '#8b5cf6',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                      }}>
                                        {scene.sceneNumber}
                                      </span>
                                      {scene.sceneTitle && (
                                        <strong style={{ color: colors.text.primary }}>
                                          {scene.sceneTitle}
                                        </strong>
                                      )}
                                    </div>
                                    <p style={{
                                      ...typography.textStyles.small,
                                      color: colors.text.secondary,
                                      marginTop: spacing.xs
                                    }}>
                                      {scene.sceneDescription}
                                    </p>
                                    {scene.setting && (
                                      <div style={{ marginTop: spacing.xs, fontSize: '12px', color: colors.text.tertiary }}>
                                        Setting: {scene.setting} | Mood: {scene.mood}
                                      </div>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '12px', color: colors.text.tertiary }}>
                                    {scene.durationSeconds}s
                                  </span>
                                </div>
                              </div>
                            ))}
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
