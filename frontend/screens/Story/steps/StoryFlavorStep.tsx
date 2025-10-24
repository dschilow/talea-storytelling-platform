import React from 'react';
import Card from '../../../components/common/Card';

export type PlotHookKey =
  | 'secret_door'
  | 'riddle_puzzle'
  | 'lost_map'
  | 'mysterious_guide'
  | 'time_glitch'
  | 'friend_turns_foe'
  | 'foe_turns_friend'
  | 'moral_choice';

export type Pacing = 'slow' | 'balanced' | 'fast';

const HOOKS: { key: PlotHookKey; label: string; tip: string }[] = [
  { key: 'secret_door',     label: 'Geheime Tür erscheint',                tip: 'Starker Einstiegshaken' },
  { key: 'riddle_puzzle',   label: 'Rätsel/Logik-Puzzle',                   tip: 'Fördert Mitdenken' },
  { key: 'lost_map',        label: 'Verlorene Karte/Leitfaden',            tip: 'Klare Mini-Quest' },
  { key: 'mysterious_guide',label: 'Geheimnisvoller Helfer',                tip: 'Führt elegant durch Plot' },
  { key: 'time_glitch',     label: 'Zeit-Glitch (sanft)',                   tip: 'Staunen, ohne Verwirrung' },
  { key: 'friend_turns_foe',label: 'Konflikt: Freund wird Gegenspieler',   tip: 'Nur sanft, kindgerecht' },
  { key: 'foe_turns_friend',label: 'Wende: Gegner wird Freund',            tip: 'Empathie & Versöhnung' },
  { key: 'moral_choice',    label: 'Kleine moralische Entscheidung',        tip: 'Werte stärken' },
];

interface Props {
  suspenseLevel: 0 | 1 | 2 | 3;
  humorLevel: 0 | 1 | 2 | 3;
  pacing: Pacing;
  pov: 'ich' | 'personale';
  hooks: PlotHookKey[];
  hasTwist: boolean;
  customPrompt: string;
  onChange: (u: Partial<Props>) => void;
}

const StepSlider: React.FC<{
  value: number; min?: number; max?: number; label: string; onChange: (v: number) => void;
}> = ({ value, min = 0, max = 3, label, onChange }) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}: <span className="font-semibold">{value}</span></label>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full"
    />
    <div className="flex justify-between text-xs text-gray-500">
      <span>ruhig</span><span>mittel</span><span>hoch</span><span>max</span>
    </div>
  </div>
);

const StoryFlavorStep: React.FC<Props> = ({
  suspenseLevel, humorLevel, pacing, pov, hooks, hasTwist, customPrompt, onChange
}) => {
  const toggleHook = (key: PlotHookKey) => {
    if (hooks.includes(key)) {
      onChange({ hooks: hooks.filter(h => h !== key) });
    } else {
      onChange({ hooks: [...hooks, key] });
    }
  };

  return (
    <Card variant="elevated">
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-800">Würze & Hooks</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StepSlider
            label="Spannung"
            value={suspenseLevel}
            onChange={(v) => onChange({ suspenseLevel: v as 0|1|2|3 })}
          />
          <StepSlider
            label="Humor"
            value={humorLevel}
            onChange={(v) => onChange({ humorLevel: v as 0|1|2|3 })}
          />

          <div>
            <label className="block text-sm text-gray-700 mb-1">Tempo</label>
            <select
              className="w-full border rounded-lg p-2"
              value={pacing}
              onChange={(e) => onChange({ pacing: e.target.value as Pacing })}
            >
              <option value="slow">ruhig</option>
              <option value="balanced">ausgewogen</option>
              <option value="fast">schnell</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Erzählperspektive</label>
            <select
              className="w-full border rounded-lg p-2"
              value={pov}
              onChange={(e) => onChange({ pov: e.target.value as 'ich' | 'personale' })}
            >
              <option value="ich">Ich-Perspektive</option>
              <option value="personale">Personale Perspektive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-2">Plot-Haken</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {HOOKS.map(h => (
              <label key={h.key} className="flex items-center gap-2 border rounded-lg p-2 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={hooks.includes(h.key)}
                  onChange={() => toggleHook(h.key)}
                />
                <div>
                  <div className="text-sm font-medium text-gray-800">{h.label}</div>
                  <div className="text-xs text-gray-500">{h.tip}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="hasTwist"
            type="checkbox"
            checked={hasTwist}
            onChange={(e) => onChange({ hasTwist: e.target.checked })}
          />
          <label htmlFor="hasTwist" className="text-sm text-gray-700">
            Überraschungs-Twist am Ende (sanft & positiv)
          </label>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">
            Freitext (optional) – Ideen, Elemente, Wünsche
          </label>
          <textarea
            className="w-full border rounded-lg p-3 min-h-[120px]"
            placeholder="z. B. „Bitte eine Szene am See mit Sternenpfad und einem leuchtenden Schlüssel.“"
            value={customPrompt}
            onChange={(e) => onChange({ customPrompt: e.target.value })}
          />
          <p className="text-xs text-gray-500 mt-1">
            Wenn leer, erzeugt die KI alles eigenständig aus den gewählten Optionen.
          </p>
        </div>
      </div>
    </Card>
  );
};

export default StoryFlavorStep;
