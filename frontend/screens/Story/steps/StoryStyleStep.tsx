import React from 'react';
import Card from '../../../components/common/Card';

export type StylePresetKey =
  | 'rhymed_playful'          // „Der Grüffelo“ – spielerisch, gereimt, call&response
  | 'gentle_minimal'          // „Die kleine Raupe Nimmersatt“ – minimalistisch, repetitiv beruhigend
  | 'wild_imaginative'        // „Wo die wilden Kerle wohnen“ – wild, rebellisch, Fantasie-Exploration
  | 'philosophical_warm'      // „Der kleine Prinz“ – warm, nachdenklich, bildhaft
  | 'mischief_empowering'     // „Pippi Langstrumpf“ – schelmisch, selbstwirksam
  | 'adventure_epic'          // „Harry Potter“ – episodisch-abenteuerlich (kindgerecht)
  | 'quirky_dark_sweet'       // „Charlie & die Schokoladenfabrik“ – skurril, süß-düster (sanft)
  | 'cozy_friendly'           // „Winnie Puuh“ – behaglich, dialogisch, freundlich
  | 'classic_fantasy'         // „Peter Pan“ – klassisch-märchenhafte Fantasie
  | 'whimsical_logic'         // „Alice im Wunderland“ – verspielt, Logik-Widersprüche (altersgerecht)
  | 'mythic_allegory'         // „Der König von Narnia“ – mythisch, allegorisch (sanft)
  | 'road_fantasy'            // „Der Zauberer von Oz“ – Reise-Quest
  | 'imaginative_meta'        // „Die unendliche Geschichte“ – Fantasie über Fantasie (einfach gehalten)
  | 'pastoral_heart'          // „Heidi“ – naturverbunden, herzenswarm
  | 'bedtime_soothing';       // „Gute Nacht, Mond“ – Einschlaf-Ruhe, sehr sanft

const STYLE_OPTIONS: { key: StylePresetKey; label: string; desc: string }[] = [
  { key: 'rhymed_playful',      label: 'Rhythmisch & spielerisch (inspiriert von „Der Grüffelo“)',              desc: 'Gereimte Wendungen, Call-and-Response, humorvoll.' },
  { key: 'gentle_minimal',      label: 'Sanft & minimal (inspiriert von „Die kleine Raupe Nimmersatt“)',        desc: 'Wiederholung, klare Struktur, ruhig.' },
  { key: 'wild_imaginative',    label: 'Wild & fantasievoll (inspiriert von „Wo die wilden Kerle wohnen“)',     desc: 'Rebellische Imagination, sichere Grenzen.' },
  { key: 'philosophical_warm',  label: 'Warm & nachdenklich (inspiriert von „Der kleine Prinz“)',               desc: 'Kleine Weisheiten, poetische Bilder.' },
  { key: 'mischief_empowering', label: 'Schelmisch & mutig (inspiriert von „Pippi Langstrumpf“)',               desc: 'Selbstwirksamkeit, Humor.' },
  { key: 'adventure_epic',      label: 'Abenteuerlich & episodisch (inspiriert von „Harry Potter“)',            desc: 'Quest-Gefühl, kindgerecht dosiert.' },
  { key: 'quirky_dark_sweet',   label: 'Skurril & süß-düster (inspiriert von „Charlie … Schokoladenfabrik“)',   desc: 'Leicht schräg, immer freundlich.' },
  { key: 'cozy_friendly',       label: 'Behaglich & freundlich (inspiriert von „Winnie Puuh“)',                 desc: 'Gemütliche Dialoge, Freundschaft.' },
  { key: 'classic_fantasy',     label: 'Klassisch-fantastisch (inspiriert von „Peter Pan“)',                    desc: 'Zeitlose Fantasie.' },
  { key: 'whimsical_logic',     label: 'Verspielt & paradox (inspiriert von „Alice im Wunderland“)',            desc: 'Logikspiele, verspielt (altersgerecht).' },
  { key: 'mythic_allegory',     label: 'Mythisch & sanft allegorisch (inspiriert von „Narnia“)',                desc: 'Symbolik, Teamgeist.' },
  { key: 'road_fantasy',        label: 'Reise-Fantasie (inspiriert von „Der Zauberer von Oz“)',                 desc: 'Weg, Etappen, Gefährten.' },
  { key: 'imaginative_meta',    label: 'Meta-Fantasie (inspiriert von „Die unendliche Geschichte“)',            desc: 'Geschichte in Geschichte (einfach).' },
  { key: 'pastoral_heart',      label: 'Natur & Herz (inspiriert von „Heidi“)',                                 desc: 'Alpen-Gefühl, Geborgenheit.' },
  { key: 'bedtime_soothing',    label: 'Einschlaf-ruhig (inspiriert von „Gute Nacht, Mond“)',                   desc: 'Sehr sanft, flüsterndes Tempo.' },
];

/**
 * Hinweis: Wir liefern nur abstrakte Stilmerkmale (Anmutung), keine Nachahmung.
 * Das Backend sollte stylePreset -> neutrale Prompt-Merkmale mappen.
 */
interface Props {
  stylePreset?: StylePresetKey;
  allowRhymes: boolean;
  tone: 'warm' | 'witty' | 'epic' | 'soothing' | 'mischievous' | 'wonder';
  language: 'de' | 'en';
  onChange: (u: Partial<{
    stylePreset: StylePresetKey | undefined;
    allowRhymes: boolean;
    tone: Props['tone'];
    language: Props['language'];
  }>) => void;
}

const StoryStyleStep: React.FC<Props> = ({ stylePreset, allowRhymes, tone, language, onChange }) => {
  return (
    <Card variant="elevated">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Stil der Geschichte</h3>
          <p className="text-gray-600 text-sm">
            Wähle eine Anmutung (Dropdown) – optional. Du kannst jederzeit ohne Stilvorgabe fortfahren.
          </p>
          <select
            className="mt-3 w-full border rounded-lg p-3"
            value={stylePreset ?? ''}
            onChange={(e) => onChange({ stylePreset: (e.target.value || undefined) as StylePresetKey | undefined })}
          >
            <option value="">Ohne Vorgabe (neutral)</option>
            {STYLE_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
          {stylePreset && (
            <p className="mt-2 text-xs text-gray-500">
              {STYLE_OPTIONS.find(o => o.key === stylePreset)?.desc}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Ton</label>
            <select
              className="w-full border rounded-lg p-2"
              value={tone}
              onChange={(e) => onChange({ tone: e.target.value as Props['tone'] })}
            >
              <option value="warm">warm</option>
              <option value="witty">witzig</option>
              <option value="epic">episch (kindgerecht)</option>
              <option value="soothing">beruhigend</option>
              <option value="mischievous">schelmisch</option>
              <option value="wonder">staunend</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Sprache</label>
            <select
              className="w-full border rounded-lg p-2"
              value={language}
              onChange={(e) => onChange({ language: e.target.value as 'de' | 'en' })}
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="allowRhymes"
              type="checkbox"
              checked={allowRhymes}
              onChange={(e) => onChange({ allowRhymes: e.target.checked })}
            />
            <label htmlFor="allowRhymes" className="text-sm text-gray-700">
              Reimform erlauben (für gereimte Anmutungen)
            </label>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StoryStyleStep;
