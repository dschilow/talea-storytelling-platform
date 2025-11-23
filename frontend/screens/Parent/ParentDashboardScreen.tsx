import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  BookOpen,
  Clock,
  TrendingUp,
  Shield,
  UserPlus,
  Settings,
  Activity,
  Eye,
  EyeOff,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';

interface Child {
  id: string;
  email: string;
  name: string;
  subscription: string;
  relationshipType: string;
  relationshipStatus: string;
  createdAt: Date;
}

interface ChildStats {
  totalStoriesRead: number;
  totalDokusRead: number;
  totalAvatarsCreated: number;
  totalStoriesCreated: number;
  totalTimeMinutes: number;
  todayTimeMinutes: number;
  weekTimeMinutes: number;
  averageDailyMinutes: number;
}

interface ChildActivity {
  id: string;
  activityType: string;
  entityId: string | null;
  entityTitle: string | null;
  durationMinutes: number;
  metadata: any;
  createdAt: Date;
}

interface ParentalControls {
  dailyScreenTimeLimitMinutes: number;
  weeklyScreenTimeLimitMinutes: number;
  contentFilterLevel: string;
  canCreateStories: boolean;
  canCreateAvatars: boolean;
  canViewPublicStories: boolean;
  canShareStories: boolean;
  enabled: boolean;
}

const ParentDashboardScreen: React.FC = () => {
  const backend = useBackend();

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [childStats, setChildStats] = useState<ChildStats | null>(null);
  const [childActivities, setChildActivities] = useState<ChildActivity[]>([]);
  const [parentalControls, setParentalControls] = useState<ParentalControls | null>(null);

  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildEmail, setNewChildEmail] = useState('');
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    void loadChildren();
  }, []);

  useEffect(() => {
    if (selectedChild) {
      void loadChildData(selectedChild.id);
    }
  }, [selectedChild]);

  const loadChildren = async () => {
    try {
      setLoading(true);
      const result = await backend.user.getChildren();
      setChildren(result.children);

      if (result.children.length > 0 && !selectedChild) {
        setSelectedChild(result.children[0]);
      }
    } catch (error) {
      console.error('Error loading children:', error);
      toast.error('Fehler beim Laden der Kinder');
    } finally {
      setLoading(false);
    }
  };

  const loadChildData = async (childId: string) => {
    try {
      // Load stats
      const stats = await backend.user.getChildStats({ childId });
      setChildStats(stats);

      // Load recent activities
      const activities = await backend.user.getChildActivity({
        childId,
        limit: 20,
        offset: 0,
      });
      setChildActivities(activities.activities);

      // Load parental controls
      const controls = await backend.user.getParentalControls({ childId });
      setParentalControls(controls);
    } catch (error) {
      console.error('Error loading child data:', error);
      toast.error('Fehler beim Laden der Daten');
    }
  };

  const handleAddChild = async () => {
    try {
      await backend.user.addChild({
        childEmail: newChildEmail,
        relationshipType: 'parent',
      });
      toast.success('Kind erfolgreich hinzugefügt');
      setNewChildEmail('');
      setShowAddChild(false);
      await loadChildren();
    } catch (error) {
      console.error('Error adding child:', error);
      toast.error('Fehler beim Hinzufügen des Kindes');
    }
  };

  const handleUpdateControls = async (updates: Partial<ParentalControls>) => {
    if (!selectedChild) return;

    try {
      await backend.user.updateParentalControls({
        childId: selectedChild.id,
        ...updates,
      });
      toast.success('Einstellungen aktualisiert');
      await loadChildData(selectedChild.id);
    } catch (error) {
      console.error('Error updating controls:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatActivityType = (type: string) => {
    const map: Record<string, string> = {
      story_read: '📖 Story gelesen',
      doku_read: '📚 Doku gelesen',
      avatar_created: '🎭 Avatar erstellt',
      story_created: '✨ Story erstellt',
    };
    return map[type] || type;
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: spacing.xxl, textAlign: 'center' }}>
          <p style={{ color: colors.text.secondary }}>Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Glass background blobs */}
      <div style={glassBlob1} />
      <div style={glassBlob2} />

      <div style={contentContainer}>
        {/* Header */}
        <FadeInView delay={0}>
          <div style={headerStyle}>
            <h1 style={titleStyle}>👨‍👩‍👧‍👦 Eltern-Dashboard</h1>
            <p style={subtitleStyle}>
              Übersicht und Verwaltung der Kinderkonten
            </p>
          </div>
        </FadeInView>

        {/* Add Child Button */}
        <FadeInView delay={0.1}>
          <div style={actionsBar}>
            <Button onClick={() => setShowAddChild(!showAddChild)}>
              <UserPlus size={16} />
              Kind hinzufügen
            </Button>
          </div>
        </FadeInView>

        {/* Add Child Form */}
        {showAddChild && (
          <FadeInView delay={0.2}>
            <Card style={addChildCard}>
              <h3 style={cardTitle}>Kind hinzufügen</h3>
              <p style={cardSubtitle}>
                Gib die E-Mail-Adresse des Kinderkontos ein
              </p>
              <div style={formRow}>
                <input
                  type="email"
                  value={newChildEmail}
                  onChange={(e) => setNewChildEmail(e.target.value)}
                  placeholder="kind@example.com"
                  style={inputStyle}
                />
                <Button onClick={handleAddChild} disabled={!newChildEmail}>
                  Hinzufügen
                </Button>
              </div>
            </Card>
          </FadeInView>
        )}

        {children.length === 0 ? (
          <FadeInView delay={0.2}>
            <Card style={emptyState}>
              <Users size={64} color={colors.text.secondary} />
              <h3 style={emptyTitle}>Noch keine Kinder hinzugefügt</h3>
              <p style={emptyText}>
                Füge ein Kinderkonto hinzu, um dessen Aktivitäten zu überwachen
              </p>
            </Card>
          </FadeInView>
        ) : (
          <>
            {/* Children Tabs */}
            <FadeInView delay={0.3}>
              <div style={childrenTabs}>
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChild(child)}
                    style={childTab(child.id === selectedChild?.id)}
                  >
                    <Users size={18} />
                    {child.name}
                  </button>
                ))}
              </div>
            </FadeInView>

            {selectedChild && childStats && (
              <>
                {/* Stats Cards */}
                <FadeInView delay={0.4}>
                  <div style={statsGrid}>
                    <Card style={statCard}>
                      <div style={statIcon}>
                        <Clock size={28} color={colors.lavender[500]} />
                      </div>
                      <div style={statContent}>
                        <div style={statValue}>{formatTime(childStats.todayTimeMinutes)}</div>
                        <div style={statLabel}>Heute</div>
                      </div>
                    </Card>

                    <Card style={statCard}>
                      <div style={statIcon}>
                        <TrendingUp size={28} color={colors.peach[500]} />
                      </div>
                      <div style={statContent}>
                        <div style={statValue}>{formatTime(childStats.weekTimeMinutes)}</div>
                        <div style={statLabel}>Diese Woche</div>
                      </div>
                    </Card>

                    <Card style={statCard}>
                      <div style={statIcon}>
                        <BookOpen size={28} color={colors.lavender[500]} />
                      </div>
                      <div style={statContent}>
                        <div style={statValue}>{childStats.totalStoriesRead}</div>
                        <div style={statLabel}>Stories gelesen</div>
                      </div>
                    </Card>

                    <Card style={statCard}>
                      <div style={statIcon}>
                        <Activity size={28} color={colors.peach[500]} />
                      </div>
                      <div style={statContent}>
                        <div style={statValue}>{formatTime(childStats.averageDailyMinutes)}</div>
                        <div style={statLabel}>Ø täglich (30 Tage)</div>
                      </div>
                    </Card>
                  </div>
                </FadeInView>

                {/* Parental Controls */}
                {parentalControls && (
                  <FadeInView delay={0.5}>
                    <Card style={controlsCard}>
                      <div style={cardHeader}>
                        <div style={cardHeaderLeft}>
                          <Shield size={24} color={colors.lavender[600]} />
                          <h3 style={cardTitle}>Kindersicherung</h3>
                        </div>
                        <button
                          onClick={() => setShowControls(!showControls)}
                          style={toggleButton}
                        >
                          {showControls ? <EyeOff size={18} /> : <Eye size={18} />}
                          {showControls ? 'Ausblenden' : 'Einstellungen'}
                        </button>
                      </div>

                      {showControls && (
                        <div style={controlsContent}>
                          {/* Screen Time Limits */}
                          <div style={controlGroup}>
                            <div style={controlLabel}>
                              <Clock size={18} />
                              Bildschirmzeit
                            </div>
                            <div style={controlItems}>
                              <div style={controlItem}>
                                <span>Täglich (Minuten):</span>
                                <input
                                  type="number"
                                  value={parentalControls.dailyScreenTimeLimitMinutes}
                                  onChange={(e) => handleUpdateControls({
                                    dailyScreenTimeLimitMinutes: parseInt(e.target.value) || 0
                                  })}
                                  style={numberInput}
                                  min={0}
                                />
                              </div>
                              <div style={controlItem}>
                                <span>Wöchentlich (Minuten):</span>
                                <input
                                  type="number"
                                  value={parentalControls.weeklyScreenTimeLimitMinutes}
                                  onChange={(e) => handleUpdateControls({
                                    weeklyScreenTimeLimitMinutes: parseInt(e.target.value) || 0
                                  })}
                                  style={numberInput}
                                  min={0}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Feature Access */}
                          <div style={controlGroup}>
                            <div style={controlLabel}>
                              <Settings size={18} />
                              Funktionszugriff
                            </div>
                            <div style={controlItems}>
                              {[
                                { key: 'canCreateStories', label: 'Stories erstellen' },
                                { key: 'canCreateAvatars', label: 'Avatare erstellen' },
                                { key: 'canViewPublicStories', label: 'Öffentliche Stories ansehen' },
                                { key: 'canShareStories', label: 'Stories teilen' },
                              ].map((item) => (
                                <label key={item.key} style={checkboxLabel}>
                                  <input
                                    type="checkbox"
                                    checked={(parentalControls as any)[item.key]}
                                    onChange={(e) => handleUpdateControls({
                                      [item.key]: e.target.checked
                                    } as any)}
                                    style={checkboxInput}
                                  />
                                  <span>{item.label}</span>
                                  {(parentalControls as any)[item.key] ? (
                                    <Check size={16} color={colors.success.main} />
                                  ) : (
                                    <X size={16} color={colors.error.main} />
                                  )}
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Content Filter */}
                          <div style={controlGroup}>
                            <div style={controlLabel}>
                              <Shield size={18} />
                              Inhaltsfilter
                            </div>
                            <div style={radioGroup}>
                              {[
                                { value: 'none', label: 'Keiner', desc: 'Alle Inhalte erlaubt' },
                                { value: 'age_appropriate', label: 'Altersgerecht', desc: 'Nur altersgerechte Inhalte' },
                                { value: 'strict', label: 'Streng', desc: 'Maximale Filterung' },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => handleUpdateControls({
                                    contentFilterLevel: option.value
                                  })}
                                  style={radioButton(parentalControls.contentFilterLevel === option.value)}
                                >
                                  <div style={radioButtonLabel}>{option.label}</div>
                                  <div style={radioButtonDesc}>{option.desc}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  </FadeInView>
                )}

                {/* Recent Activity */}
                <FadeInView delay={0.6}>
                  <Card style={activityCard}>
                    <div style={cardHeader}>
                      <div style={cardHeaderLeft}>
                        <Activity size={24} color={colors.peach[600]} />
                        <h3 style={cardTitle}>Letzte Aktivitäten</h3>
                      </div>
                    </div>

                    <div style={activityList}>
                      {childActivities.length === 0 ? (
                        <div style={emptyActivityText}>Noch keine Aktivitäten</div>
                      ) : (
                        childActivities.map((activity) => (
                          <div key={activity.id} style={activityItem}>
                            <div style={activityIcon}>
                              {formatActivityType(activity.activityType).split(' ')[0]}
                            </div>
                            <div style={activityContent}>
                              <div style={activityTitle}>
                                {formatActivityType(activity.activityType)}
                              </div>
                              {activity.entityTitle && (
                                <div style={activitySubtitle}>{activity.entityTitle}</div>
                              )}
                            </div>
                            <div style={activityMeta}>
                              {activity.durationMinutes > 0 && (
                                <span style={activityTime}>{formatTime(activity.durationMinutes)}</span>
                              )}
                              <span style={activityDate}>
                                {new Date(activity.createdAt).toLocaleString('de-DE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </FadeInView>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Styles (continues in next message due to length...)
const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: colors.background.primary,
  paddingBottom: '120px',
  position: 'relative',
};

const glassBlob1: React.CSSProperties = {
  position: 'absolute',
  top: '10%',
  left: '5%',
  width: '600px',
  height: '600px',
  background: `radial-gradient(circle, ${colors.lavender[200]}40, transparent)`,
  borderRadius: '50%',
  filter: 'blur(80px)',
  pointerEvents: 'none',
  zIndex: 0,
};

const glassBlob2: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  right: '5%',
  width: '500px',
  height: '500px',
  background: `radial-gradient(circle, ${colors.peach[200]}40, transparent)`,
  borderRadius: '50%',
  filter: 'blur(80px)',
  pointerEvents: 'none',
  zIndex: 0,
};

const contentContainer: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  maxWidth: '1200px',
  margin: '0 auto',
  padding: spacing.xxl,
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: spacing.xl,
};

const titleStyle: React.CSSProperties = {
  ...typography.h1,
  color: colors.text.primary,
  marginBottom: spacing.sm,
};

const subtitleStyle: React.CSSProperties = {
  ...typography.body,
  color: colors.text.secondary,
};

const actionsBar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginBottom: spacing.lg,
};

const addChildCard: React.CSSProperties = {
  padding: spacing.lg,
  marginBottom: spacing.lg,
};

const cardTitle: React.CSSProperties = {
  ...typography.h4,
  color: colors.text.primary,
  margin: 0,
  marginBottom: spacing.sm,
};

const cardSubtitle: React.CSSProperties = {
  ...typography.body,
  color: colors.text.secondary,
  marginBottom: spacing.md,
};

const formRow: React.CSSProperties = {
  display: 'flex',
  gap: spacing.md,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: spacing.md,
  borderRadius: radii.md,
  border: `2px solid ${colors.border.light}`,
  background: colors.glass.background,
  color: colors.text.primary,
  fontSize: '16px',
};

const childrenTabs: React.CSSProperties = {
  display: 'flex',
  gap: spacing.sm,
  marginBottom: spacing.xl,
  flexWrap: 'wrap',
};

const childTab = (active: boolean): React.CSSProperties => ({
  padding: `${spacing.sm} ${spacing.lg}`,
  borderRadius: radii.lg,
  border: `2px solid ${active ? colors.lavender[500] : colors.border.light}`,
  background: active
    ? `linear-gradient(135deg, ${colors.lavender[50]}, ${colors.peach[50]})`
    : colors.glass.background,
  color: active ? colors.lavender[700] : colors.text.primary,
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: active ? '600' : '400',
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
  transition: 'all 0.2s ease',
});

const statsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: spacing.lg,
  marginBottom: spacing.xl,
};

const statCard: React.CSSProperties = {
  padding: spacing.lg,
  display: 'flex',
  alignItems: 'center',
  gap: spacing.md,
};

const statIcon: React.CSSProperties = {
  width: '56px',
  height: '56px',
  borderRadius: radii.lg,
  background: colors.glass.backgroundAlt,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const statContent: React.CSSProperties = {
  flex: 1,
};

const statValue: React.CSSProperties = {
  ...typography.h3,
  color: colors.text.primary,
  margin: 0,
  marginBottom: spacing.xs,
};

const statLabel: React.CSSProperties = {
  ...typography.small,
  color: colors.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const controlsCard: React.CSSProperties = {
  padding: spacing.lg,
  marginBottom: spacing.xl,
};

const cardHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: spacing.lg,
};

const cardHeaderLeft: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.md,
};

const toggleButton: React.CSSProperties = {
  padding: `${spacing.sm} ${spacing.md}`,
  borderRadius: radii.md,
  border: `2px solid ${colors.border.light}`,
  background: colors.glass.background,
  color: colors.text.primary,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xs,
  fontSize: '14px',
  transition: 'all 0.2s ease',
};

const controlsContent: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.xl,
};

const controlGroup: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.md,
};

const controlLabel: React.CSSProperties = {
  ...typography.label,
  color: colors.text.primary,
  fontWeight: '600',
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
};

const controlItems: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.sm,
};

const controlItem: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: spacing.md,
  borderRadius: radii.md,
  background: colors.glass.backgroundAlt,
};

const numberInput: React.CSSProperties = {
  width: '100px',
  padding: spacing.sm,
  borderRadius: radii.sm,
  border: `2px solid ${colors.border.light}`,
  background: colors.glass.background,
  color: colors.text.primary,
  fontSize: '14px',
  textAlign: 'center',
};

const checkboxLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.md,
  padding: spacing.md,
  borderRadius: radii.md,
  background: colors.glass.backgroundAlt,
  cursor: 'pointer',
};

const checkboxInput: React.CSSProperties = {
  width: '20px',
  height: '20px',
  cursor: 'pointer',
};

const radioGroup: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: spacing.sm,
};

const radioButton = (active: boolean): React.CSSProperties => ({
  padding: spacing.md,
  borderRadius: radii.md,
  border: `2px solid ${active ? colors.lavender[500] : colors.border.light}`,
  background: active ? colors.lavender[50] : colors.glass.background,
  color: active ? colors.lavender[700] : colors.text.primary,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.2s ease',
});

const radioButtonLabel: React.CSSProperties = {
  fontWeight: '600',
  marginBottom: spacing.xs,
};

const radioButtonDesc: React.CSSProperties = {
  fontSize: '12px',
  color: colors.text.secondary,
};

const activityCard: React.CSSProperties = {
  padding: spacing.lg,
};

const activityList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.sm,
};

const activityItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.md,
  padding: spacing.md,
  borderRadius: radii.md,
  background: colors.glass.backgroundAlt,
  transition: 'background 0.2s ease',
};

const activityIcon: React.CSSProperties = {
  fontSize: '32px',
  width: '48px',
  height: '48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: radii.md,
  background: colors.glass.background,
};

const activityContent: React.CSSProperties = {
  flex: 1,
};

const activityTitle: React.CSSProperties = {
  ...typography.body,
  color: colors.text.primary,
  fontWeight: '600',
  marginBottom: spacing.xs,
};

const activitySubtitle: React.CSSProperties = {
  ...typography.small,
  color: colors.text.secondary,
};

const activityMeta: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: spacing.xs,
};

const activityTime: React.CSSProperties = {
  ...typography.small,
  color: colors.lavender[600],
  fontWeight: '600',
};

const activityDate: React.CSSProperties = {
  ...typography.small,
  color: colors.text.secondary,
};

const emptyState: React.CSSProperties = {
  padding: spacing.xxl,
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: spacing.md,
};

const emptyTitle: React.CSSProperties = {
  ...typography.h3,
  color: colors.text.primary,
  margin: 0,
};

const emptyText: React.CSSProperties = {
  ...typography.body,
  color: colors.text.secondary,
  margin: 0,
};

const emptyActivityText: React.CSSProperties = {
  ...typography.body,
  color: colors.text.secondary,
  textAlign: 'center',
  padding: spacing.xl,
};

export default ParentDashboardScreen;
