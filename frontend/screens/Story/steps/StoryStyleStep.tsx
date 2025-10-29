import React from "react";
import Card from "../../../components/common/Card";

export type StorySoulKey =
  | "maerchenzauber"
  | "lieder_reime"
  | "wilder_ritt"
  | "traeumerei"
  | "heldenmut"
  | "entdeckergeist";

export type StylePresetKey =
  | "rhymed_playful"
  | "gentle_minimal"
  | "wild_imaginative"
  | "philosophical_warm"
  | "mischief_empowering"
  | "adventure_epic"
  | "quirky_dark_sweet"
  | "cozy_friendly"
  | "classic_fantasy"
  | "whimsical_logic"
  | "mythic_allegory"
  | "road_fantasy"
  | "imaginative_meta"
  | "pastoral_heart"
  | "bedtime_soothing";

export interface StorySoulOption {
  key: StorySoulKey;
  label: string;
  tagline: string;
  description: string;
}

export interface StylePresetOption {
  key: StylePresetKey;
  label: string;
  description: string;
}

export const STORY_SOUL_OPTIONS: StorySoulOption[] = [
  {
    key: "maerchenzauber",
    label: "Maerchenzauber",
    tagline: "Zeitlos-magisch und herzlich",
    description: "Es-war-einmal Stimmung, warme Atmosphaere, sanfte Spannung.",
  },
  {
    key: "lieder_reime",
    label: "Lieder & Reime",
    tagline: "Rhythmisch, spielerisch, musikalisch",
    description: "Leichte Reime, wiederkehrende Phrasen, ideal zum Mitsprechen.",
  },
  {
    key: "wilder_ritt",
    label: "Wilder Ritt",
    tagline: "Actionreich und voller Humor",
    description: "Schnelles Tempo, mutige Entscheidungen, freche Energie.",
  },
  {
    key: "traeumerei",
    label: "Traeumerei",
    tagline: "Poetisch und beruhigend",
    description: "Schwebende Bilder, leise Dialoge, sanfte Gefuehle.",
  },
  {
    key: "heldenmut",
    label: "Heldenmut",
    tagline: "Epische Kinderquests",
    description: "Mut, Teamgeist und triumphierende Wendungen.",
  },
  {
    key: "entdeckergeist",
    label: "Entdeckergeist",
    tagline: "Neugierig und erfinderisch",
    description: "Forscherdrang, clevere Ideen, Abenteuerlust.",
  },
];

export const STYLE_PRESET_OPTIONS: StylePresetOption[] = [
  { key: "rhymed_playful", label: "Rhythmisch spielerisch (Grueffelo)", description: "Gereimte Wendungen, Call-and-Response, humorvoll." },
  { key: "gentle_minimal", label: "Sanft minimalistisch (Raupe Nimmersatt)", description: "Wiederholung, klare Struktur, beruhigend." },
  { key: "wild_imaginative", label: "Wild fantasievoll (Wilde Kerle)", description: "Rebellische Imagination, sichere Grenzen." },
  { key: "philosophical_warm", label: "Warm nachdenklich (Kleiner Prinz)", description: "Poetische Bilder, kleine Weisheiten." },
  { key: "mischief_empowering", label: "Schelmisch mutig (Pippi Langstrumpf)", description: "Selbstwirksamkeit, Humor und Herz." },
  { key: "adventure_epic", label: "Abenteuerlich episch (Harry Potter)", description: "Quest-Gefuehl, Teamspirit, kindgerecht." },
  { key: "quirky_dark_sweet", label: "Skurril suess (Charlie & Schoko)", description: "Leicht schraeg, immer freundlich." },
  { key: "cozy_friendly", label: "Gemuetlich freundlich (Winnie Puuh)", description: "Dialogreich, Snacks, Geborgenheit." },
  { key: "classic_fantasy", label: "Klassische Fantasie (Peter Pan)", description: "Zeitlose Motive, Fliegen, Abenteuer." },
  { key: "whimsical_logic", label: "Verspielt logisch (Alice)", description: "Logikspiele, Wortwitz, staunende Kinder." },
  { key: "mythic_allegory", label: "Mythisch sanft (Narnia)", description: "Symbolik, ruhiger Held*innenmut." },
  { key: "road_fantasy", label: "Reise-Quest (Oz)", description: "Etappenreise, markante Begleiter*innen." },
  { key: "imaginative_meta", label: "Meta-Fantasie (Unendliche Geschichte)", description: "Geschichten in Geschichten, Fantasiepower." },
  { key: "pastoral_heart", label: "Natur & Herz (Heidi)", description: "Alpenluft, Herzenswaerme, Gemeinschaft." },
  { key: "bedtime_soothing", label: "Schlummer-sanft (Gute Nacht, Mond)", description: "Fluesterndes Tempo, Traeume in Pastell." },
];

interface Props {
  storySoul?: StorySoulKey;
  stylePreset?: StylePresetKey;
  allowRhymes: boolean;
  onSelectSoul: (storySoul: StorySoulKey) => void;
  onStyleChange: (update: { stylePreset?: StylePresetKey; allowRhymes?: boolean }) => void;
}

const StoryStyleStep: React.FC<Props> = ({
  storySoul,
  stylePreset,
  allowRhymes,
  onSelectSoul,
  onStyleChange,
}) => {
  return (
    <Card variant="elevated">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Story-Seele</h3>
          <p className="text-gray-600 text-sm">
            Waehle die Grundstimmung deines Bilderbuchs. Sie bestimmt automatisch Ton, Tempo und Grundwuerze.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STORY_SOUL_OPTIONS.map((option) => {
            const selected = storySoul === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onSelectSoul(option.key)}
                className={`border rounded-lg p-4 text-left transition-all duration-200 ${
                  selected
                    ? "border-purple-500 bg-purple-50 shadow-sm"
                    : "border-gray-200 hover:border-purple-400 hover:bg-purple-50/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-800">{option.label}</span>
                  {selected && <span className="text-purple-600 text-xs font-semibold">ausgewaehlt</span>}
                </div>
                <p className="text-sm text-gray-600 mb-1">{option.tagline}</p>
                <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-md font-semibold text-gray-800">Optional: Stil feinjustieren</h4>
          <p className="text-gray-600 text-sm mb-3">
            Du kannst zusaetzlich einen Stil auswaehlen (z. B. Gruffelo-Rhythmus). Ohne Auswahl bleibt der zur Story-Seele passende Stil aktiv.
          </p>
          <select
            className="w-full border rounded-lg p-3"
            value={stylePreset ?? ""}
            onChange={(event) =>
              onStyleChange({ stylePreset: event.target.value ? (event.target.value as StylePresetKey) : undefined })
            }
          >
            <option value="">Automatisch (Story-Seele entscheidet)</option>
            {STYLE_PRESET_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          {stylePreset && (
            <p className="text-xs text-gray-500 mt-2">
              {STYLE_PRESET_OPTIONS.find((option) => option.key === stylePreset)?.description}
            </p>
          )}

          <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={allowRhymes}
              onChange={(event) => onStyleChange({ allowRhymes: event.target.checked })}
            />
            Reime erlauben (besonders fuer Gruffelo-Stimmungen sinnvoll)
          </label>
        </div>

        <p className="text-xs text-gray-500">
          Soul + Stil ergeben zusammen deine einzigartige Bilderbuch-Stimme. Du kannst jederzeit zurueckspringen und anpassen.
        </p>
      </div>
    </Card>
  );
};

export default StoryStyleStep;
