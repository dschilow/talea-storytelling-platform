import React, { useEffect, useState } from 'react';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { Beaker, FlaskConical, Sparkles, Plus, Trash2, BookOpen, Loader2 } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';
import type { doku } from '../../client';

type DokuConfig = doku.DokuConfig;

interface DokuListItem {
  id: string;
  userId: string;
  title: string;
  topic: string;
  summary?: string;
  coverImageUrl?: string;
  isPublic: boolean;
  status: 'generating' | 'complete' | 'error';
  createdAt: string;
  updatedAt: string;
}

const DokuWizardScreen: React.FC = () => {
  const { user, isSignedIn } = useUser();
  const backend = useBackend();

  const [topic, setTopic] = useState('');
  const [ageGroup, setAgeGroup] = useState<'3-5' | '6-8' | '9-12' | '13+'>('6-8');
  const [depth, setDepth] = useState<'basic' | 'standard' | 'deep'>('standard');
  const [perspective, setPerspective] = useState<'science' | 'history' | 'technology' | 'nature' | 'culture'>('science');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [tone, setTone] = useState<'fun' | 'neutral' | 'curious'>('curious');
  const [includeInteractive, setIncludeInteractive] = useState(true);
  const [quizQuestions, setQuizQuestions] = useState(3);
  const [handsOnActivities, setHandsOnActivities] = useState(1);
  const [loading, setLoading] = useState(false);

  const [dokus, setDokus] = useState<DokuListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      void loadDokus();
    }
  }, [isSignedIn]);

  const loadDokus = async () => {
    try {
      setLoadingList(true);
      const resp = await backend.doku.listDokus();
      setDokus(resp.dokus as any);
    } catch (e) {
      console.error('Failed to load dokus', e);
    } finally {
      setLoadingList(false);
    }
  };

  const onGenerate = async () => {
    if (!user) return;
    if (!topic.trim()) {
      alert('Bitte gib ein Thema ein.');
      return;
    }
    try {
      setLoading(true);
      const config: DokuConfig = {
        topic: topic.trim(),
        ageGroup,
        depth,
        perspective,
        includeInteractive,
        quizQuestions: includeInteractive ? quizQuestions : 0,
        handsOnActivities: includeInteractive ? handsOnActivities : 0,
        tone,
        length,
      };
      const created = await backend.doku.generateDoku({
        userId: user.id,
        config,
      });
      setTopic('');
      await loadDokus();
      window.location.href = `/doku-reader/${created.id}`;
    } catch (e) {
      console.error('Fehler bei Doku-Generierung', e);
      alert('Die Doku konnte nicht erstellt werden. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('Doku wirklich löschen?')) return;
    try {
      await backend.doku.deleteDoku(id);
      setDokus(dokus.filter(d => d.id !== id));
    } catch (e) {
      console.error('Failed to delete doku', e);
      alert('Löschen fehlgeschlagen.');
    }
  };

  const cardTitle: React.CSSProperties = {
    ...typography.textStyles.headingMd,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.appBackground, paddingBottom: '120px' }}>
      <div style={{ padding: spacing.xl }}>
        <SignedOut>
          <Card variant="glass" style={{ maxWidth: 720, margin: '0 auto', padding: spacing.xl, textAlign: 'center' }}>
            <FlaskConical size={32} style={{ color: colors.primary, marginBottom: spacing.md }} />
            <div style={cardTitle}>Doku Modus (Anmeldung erforderlich)</div>
            <div style={{ ...typography.textStyles.body, color: colors.textSecondary }}>
              Bitte melde dich an, um den Doku-Modus zu verwenden.
            </div>
          </Card>
        </SignedOut>

        <SignedIn>
          <FadeInView delay={50}>
            <Card variant="glass" style={{ maxWidth: 960, margin: '0 auto', padding: spacing.xl, marginBottom: spacing.xl }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                <FlaskConical size={22} style={{ color: colors.primary }} />
                <div style={cardTitle}>Neues Lern-Dossier erstellen</div>
              </div>

              {/* Topic */}
              <div style={{ marginBottom: spacing.lg }}>
                <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: spacing.sm }}>
                  Thema
                </label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder='z.B. "Vulkane", "Nils Fluss", "Bienen", "Regenbogen"'
                  style={{
                    width: '100%',
                    padding: spacing.lg,
                    borderRadius: radii.lg,
                    border: `1px solid ${colors.glass.border}`,
                    background: colors.surface,
                  }}
                />
              </div>

              {/* Parameters grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: spacing.md }}>
                <Selector label="Altersgruppe" value={ageGroup} onChange={setAgeGroup} options={[
                  { value: '3-5', label: '3-5 Jahre' },
                  { value: '6-8', label: '6-8 Jahre' },
                  { value: '9-12', label: '9-12 Jahre' },
                  { value: '13+', label: '13+ Jahre' },
                ]} />
                <Selector label="Tiefe" value={depth} onChange={setDepth} options={[
                  { value: 'basic', label: 'Einfach' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'deep', label: 'Tief' },
                ]} />
                <Selector label="Perspektive" value={perspective} onChange={setPerspective} options={[
                  { value: 'science', label: 'Wissenschaft' },
                  { value: 'history', label: 'Geschichte' },
                  { value: 'technology', label: 'Technologie' },
                  { value: 'nature', label: 'Natur' },
                  { value: 'culture', label: 'Kultur' },
                ]} />
                <Selector label="Länge" value={length} onChange={setLength} options={[
                  { value: 'short', label: 'Kurz' },
                  { value: 'medium', label: 'Mittel' },
                  { value: 'long', label: 'Lang' },
                ]} />
                <Selector label="Ton" value={tone} onChange={setTone} options={[
                  { value: 'fun', label: 'Spaßig' },
                  { value: 'neutral', label: 'Neutral' },
                  { value: 'curious', label: 'Neugierig' },
                ]} />
              </div>

              {/* Interactive */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.md, marginTop: spacing.lg }}>
                <Toggle
                  label="Interaktive Elemente"
                  enabled={includeInteractive}
                  onToggle={() => setIncludeInteractive(!includeInteractive)}
                />
                <NumberInput
                  label="Quizfragen"
                  value={quizQuestions}
                  onChange={setQuizQuestions}
                  min={0}
                  max={10}
                  disabled={!includeInteractive}
                />
                <NumberInput
                  label="Aktivitäten"
                  value={handsOnActivities}
                  onChange={setHandsOnActivities}
                  min={0}
                  max={5}
                  disabled={!includeInteractive}
                />
              </div>

              <div style={{ marginTop: spacing.xl }}>
                <Button
                  title={loading ? 'Erstelle...' : '✨ Doku erzeugen'}
                  onPress={onGenerate}
                  loading={loading}
                  icon={<Sparkles size={16} />}
                  variant="fun"
                  fullWidth
                />
              </div>
            </Card>
          </FadeInView>

          {/* Existing Dokus */}
          <FadeInView delay={150}>
            <Card variant="glass" style={{ maxWidth: 1100, margin: '0 auto', padding: spacing.xl }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                <BookOpen size={22} style={{ color: colors.primary }} />
                <div style={cardTitle}>Deine Dokus</div>
              </div>

              {loadingList ? (
                <div style={{ textAlign: 'center', padding: spacing.lg }}>
                  <Loader2 className="animate-spin" />
                </div>
              ) : dokus.length === 0 ? (
                <div style={{ textAlign: 'center', padding: spacing.xl }}>
                  <div style={{ fontSize: 48, marginBottom: spacing.sm }}>📘</div>
                  <div style={{ ...typography.textStyles.body, color: colors.textSecondary }}>
                    Noch keine Dokus. Erstelle deine erste Lern-Doku!
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: spacing.md
                }}>
                  {dokus.map(d => (
                    <Card key={d.id} variant="glass" style={{ padding: spacing.md }}>
                      <div style={{
                        width: '100%',
                        height: 140,
                        borderRadius: radii.lg,
                        background: colors.glass.cardBackground,
                        border: `1px solid ${colors.glass.border}`,
                        overflow: 'hidden',
                        marginBottom: spacing.sm,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {d.coverImageUrl ? (
                          <img src={d.coverImageUrl} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : <span style={{ fontSize: 28 }}>📘</span>}
                      </div>
                      <div style={{ ...typography.textStyles.label, color: colors.textPrimary }}>{d.title}</div>
                      <div style={{ ...typography.textStyles.caption, color: colors.textSecondary, minHeight: 32 }}>
                        {d.summary || d.topic}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing.sm }}>
                        <button
                          onClick={() => (window.location.href = `/doku-reader/${d.id}`)}
                          style={{
                            padding: spacing.sm,
                            borderRadius: radii.lg,
                            background: colors.glass.buttonBackground,
                            border: `1px solid ${colors.glass.border}`,
                          }}
                        >
                          Öffnen
                        </button>
                        <button
                          onClick={() => onDelete(d.id)}
                          style={{
                            padding: spacing.sm,
                            borderRadius: radii.lg,
                            background: 'rgba(245, 101, 101, 0.9)',
                            color: colors.textInverse,
                            border: 'none'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </FadeInView>
        </SignedIn>
      </div>
    </div>
  );
};

const Selector = <T extends string>({
  label, value, onChange, options
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) => {
  return (
    <div>
      <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: spacing.sm }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          width: '100%',
          padding: spacing.md,
          borderRadius: radii.lg,
          border: `1px solid ${colors.glass.border}`,
          background: colors.surface
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

const Toggle = ({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) => {
  return (
    <div>
      <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: spacing.sm }}>
        {label}
      </label>
      <button
        onClick={onToggle}
        style={{
          width: 60,
          height: 32,
          borderRadius: 20,
          background: enabled ? colors.primary : colors.border,
          border: 'none',
          position: 'relative',
          transition: 'all .2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 4,
            left: enabled ? 32 : 4,
            width: 24,
            height: 24,
            borderRadius: 12,
            background: 'white',
            transition: 'all .2s',
            boxShadow: shadows.sm,
          }}
        />
      </button>
    </div>
  );
};

const NumberInput = ({
  label, value, onChange, min, max, disabled
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
}) => {
  return (
    <div>
      <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: spacing.sm }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value || '0', 10))))}
        min={min}
        max={max}
        disabled={disabled}
        style={{
          width: '100%',
          padding: spacing.md,
          borderRadius: radii.lg,
          border: `1px solid ${colors.glass.border}`,
          background: disabled ? '#f3f4f6' : colors.surface
        }}
      />
    </div>
  );
};

export default DokuWizardScreen;
