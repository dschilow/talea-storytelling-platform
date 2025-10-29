import React from "react";
import Card from "../../../components/common/Card";

export type EmotionalFlavorKey =
  | "warmherzigkeit"
  | "lachfreude"
  | "prickeln"
  | "geborgenheit"
  | "uebermut"
  | "staunen"
  | "zusammenhalt";

export interface EmotionalFlavorOption {
  key: EmotionalFlavorKey;
  label: string;
  description: string;
  effect: string;
}

export const EMOTIONAL_FLAVOR_OPTIONS: EmotionalFlavorOption[] = [
  {
    key: "warmherzigkeit",
    label: "Warmherzigkeit",
    description: "Umarmungen, Trost und sanfte Naehe",
    effect: "Verstaerkt Herzensmomente, haelt Humor zart.",
  },
  {
    key: "lachfreude",
    label: "Lachfreude",
    description: "Slapstick, Wortspiele, Schelmerei",
    effect: "Erhoeht Humor und spritzige Dialoge.",
  },
  {
    key: "prickeln",
    label: "Prickeln",
    description: "Geheimnisse, kleine Guesel, Spannung",
    effect: "Hebt das Spannungsniveau merklich an.",
  },
  {
    key: "geborgenheit",
    label: "Geborgenheit",
    description: "Kuschel-Gefuehl, Sicherheit, Langsamkeit",
    effect: "Verlangsamt Tempo, macht Szenen sanfter.",
  },
  {
    key: "uebermut",
    label: "Uebermut",
    description: "Freche Ideen, Quatsch, ausgelassene Energie",
    effect: "Steigert Humor und schnelle Aktionen.",
  },
  {
    key: "staunen",
    label: "Staunen",
    description: "Wundersame Entdeckungen, Magisches Leuchten",
    effect: "Betont neugierige, poetische Momente.",
  },
  {
    key: "zusammenhalt",
    label: "Zusammenhalt",
    description: "Teamgeist, gemeinsame Loesungen",
    effect: "Foerdert wir-Gefuehl und freundliche Dialoge.",
  },
];

export type StoryTempoKey = "cozy" | "balanced" | "fast";

export interface StoryTempoOption {
  key: StoryTempoKey;
  label: string;
  description: string;
}

export const STORY_TEMPO_OPTIONS: StoryTempoOption[] = [
  {
    key: "cozy",
    label: "Gemutlich",
    description: "Ruhiges Tempo, viel Raum fuer Atmosphaere.",
  },
  {
    key: "balanced",
    label: "Ausgewogen",
    description: "Harmonischer Wechsel aus Ruhe und Schwung.",
  },
  {
    key: "fast",
    label: "Rasant",
    description: "Hohe Dynamik, kurze Pausen, viel Action.",
  },
];

export type SpecialIngredientKey =
  | "surprise"
  | "mystery"
  | "transformation"
  | "magic"
  | "trial"
  | "aha";

export interface SpecialIngredientOption {
  key: SpecialIngredientKey;
  label: string;
  description: string;
}

export const SPECIAL_INGREDIENT_OPTIONS: SpecialIngredientOption[] = [
  {
    key: "surprise",
    label: "Ueberraschung",
    description: "Eine unerwartete Wendung, die alle staunen laesst.",
  },
  {
    key: "mystery",
    label: "Geheimnis",
    description: "Ein Raetsel, das die Kinder gemeinsam loesen.",
  },
  {
    key: "transformation",
    label: "Verwandlung",
    description: "Etwas oder jemand veraendert sich grundlegend.",
  },
  {
    key: "magic",
    label: "Magie",
    description: "Zauberhafte Momente, leuchtende Wunder, Funkenregen.",
  },
  {
    key: "trial",
    label: "Mutprobe",
    description: "Eine Herausforderung, die Selbstvertrauen schuetzt.",
  },
  {
    key: "aha",
    label: "Aha-Moment",
    description: "Eine wichtige Erkenntnis, die alles zusammenbringt.",
  },
];

const MAX_FLAVORS = 2;
const MAX_INGREDIENTS = 2;

interface Props {
  emotionalFlavors: EmotionalFlavorKey[];
  storyTempo?: StoryTempoKey;
  specialIngredients: SpecialIngredientKey[];
  customPrompt: string;
  onChange: (update: Partial<Props>) => void;
}

const StoryFlavorStep: React.FC<Props> = ({
  emotionalFlavors,
  storyTempo,
  specialIngredients,
  customPrompt,
  onChange,
}) => {
  const toggleFlavor = (key: EmotionalFlavorKey) => {
    const isSelected = emotionalFlavors.includes(key);
    if (!isSelected && emotionalFlavors.length >= MAX_FLAVORS) {
      return;
    }
    const next = isSelected
      ? emotionalFlavors.filter((value) => value !== key)
      : [...emotionalFlavors, key];
    onChange({ emotionalFlavors: next });
  };

  const toggleIngredient = (key: SpecialIngredientKey) => {
    const isSelected = specialIngredients.includes(key);
    if (!isSelected && specialIngredients.length >= MAX_INGREDIENTS) {
      return;
    }
    const next = isSelected
      ? specialIngredients.filter((value) => value !== key)
      : [...specialIngredients, key];
    onChange({ specialIngredients: next });
  };

  return (
    <Card variant="elevated">
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Emotionale Wuerze</h3>
          <p className="text-gray-600 text-sm mb-3">Waehle bis zu zwei Emotionen, die deine Story traegt.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EMOTIONAL_FLAVOR_OPTIONS.map((option) => {
              const isSelected = emotionalFlavors.includes(option.key);
              return (
                <label
                  key={option.key}
                  className={`border rounded-lg p-3 cursor-pointer transition ${
                    isSelected
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 hover:border-purple-400 hover:bg-purple-50/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleFlavor(option.key)}
                    className="mr-2"
                  />
                  <div className="inline-block align-top">
                    <div className="text-sm font-semibold text-gray-800">{option.label}</div>
                    <div className="text-xs text-gray-600">{option.description}</div>
                    <div className="text-xs text-gray-500 mt-1">{option.effect}</div>
                  </div>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">Maximal {MAX_FLAVORS} Emotionen gleichzeitig.</p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800">Tempo</h3>
          <p className="text-gray-600 text-sm mb-3">Bestimme den Rhythmus der Reise.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {STORY_TEMPO_OPTIONS.map((option) => {
              const isSelected = storyTempo === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onChange({ storyTempo: option.key })}
                  className={`border rounded-lg p-3 text-left transition ${
                    isSelected
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 hover:border-purple-400 hover:bg-purple-50/40"
                  }`}
                >
                  <div className="font-semibold text-sm text-gray-800">{option.label}</div>
                  <div className="text-xs text-gray-600">{option.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800">Spezialzutaten</h3>
          <p className="text-gray-600 text-sm mb-3">Waehle bis zu zwei Highlights, die unbedingt vorkommen sollen.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SPECIAL_INGREDIENT_OPTIONS.map((option) => {
              const isSelected = specialIngredients.includes(option.key);
              return (
                <label
                  key={option.key}
                  className={`border rounded-lg p-3 cursor-pointer transition ${
                    isSelected
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 hover:border-purple-400 hover:bg-purple-50/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleIngredient(option.key)}
                    className="mr-2"
                  />
                  <div className="inline-block align-top">
                    <div className="text-sm font-semibold text-gray-800">{option.label}</div>
                    <div className="text-xs text-gray-600">{option.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">Maximal {MAX_INGREDIENTS} Spezialzutaten. Optional.</p>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Magische Wuensche (optional)</label>
          <textarea
            className="w-full border rounded-lg p-3 min-h-[120px]"
            placeholder="z. B. Bitte eine Szene am See mit glitzerndem Sternenpfad."
            value={customPrompt}
            onChange={(event) => onChange({ customPrompt: event.target.value })}
          />
          <p className="text-xs text-gray-500 mt-1">
            Freitext fuer besondere Ideen, Lieblingsorte oder Figuren.
          </p>
        </div>
      </div>
    </Card>
  );
};

export default StoryFlavorStep;
