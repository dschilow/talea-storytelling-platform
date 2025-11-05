// Step 2: Smart Category Selection
// Instead of 150 individual fairy tales, show 6 smart categories
// Each category uses 3 fairy tales + 71 character pool intelligently

import React from 'react';
import { Sparkles, Mountain, Wand2, Dog, Rocket, Home } from 'lucide-react';

type MainCategory = 'fairy-tales' | 'adventure' | 'magic' | 'animals' | 'scifi' | 'modern' | null;

interface Props {
  state: {
    mainCategory: MainCategory;
  };
  updateState: (updates: any) => void;
}

const CATEGORIES = [
  {
    id: 'fairy-tales',
    title: '🏰 Klassische Märchen',
    description: 'Verwunschene Welten, Könige & Prinzessinnen, magische Wesen',
    icon: Sparkles,
    color: 'purple',
    examples: 'Hänsel & Gretel, Rotkäppchen, Bremer Stadtmusikanten',
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    id: 'adventure',
    title: '🗺️ Abenteuer & Schätze',
    description: 'Spannende Reisen, versteckte Schätze, mutige Helden',
    icon: Mountain,
    color: 'orange',
    examples: 'Schatzsuche, Geheime Höhlen, Wilde Expeditionen',
    gradient: 'from-orange-500 to-red-500'
  },
  {
    id: 'magic',
    title: '✨ Märchenwelten & Magie',
    description: 'Zaubersprüche, fliegende Teppiche, magische Kräfte',
    icon: Wand2,
    color: 'blue',
    examples: 'Zauberer, Feen, Magische Gegenstände',
    gradient: 'from-blue-500 to-indigo-500'
  },
  {
    id: 'animals',
    title: '🦊 Tierwelten',
    description: 'Sprechende Tiere, Waldabenteuer, Tierfreundschaften',
    icon: Dog,
    color: 'green',
    examples: 'Im Wald, Auf dem Bauernhof, In der Wildnis',
    gradient: 'from-green-500 to-emerald-500'
  },
  {
    id: 'scifi',
    title: '🚀 Sci-Fi & Zukunft',
    description: 'Raumschiffe, fremde Planeten, futuristische Welten',
    icon: Rocket,
    color: 'cyan',
    examples: 'Weltraumabenteuer, Roboter, Zeitreisen',
    gradient: 'from-cyan-500 to-blue-500'
  },
  {
    id: 'modern',
    title: '🏡 Modern & Realität',
    description: 'Alltag, Schule, Familie, echte Erlebnisse',
    icon: Home,
    color: 'gray',
    examples: 'Heute & Hier, Realistische Geschichten',
    gradient: 'from-gray-500 to-slate-500'
  }
];

export default function Step2CategorySelection({ state, updateState }: Props) {
  const handleSelectCategory = (categoryId: MainCategory) => {
    updateState({ mainCategory: categoryId });
  };

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          📚 Was für eine Geschichte soll es werden?
        </h2>
        <p className="text-gray-600">
          Wähle eine Kategorie aus - deine Avatare werden Teil einer einzigartigen Geschichte!
        </p>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIES.map((category) => {
          const isSelected = state.mainCategory === category.id;
          const Icon = category.icon;
          
          return (
            <button
              key={category.id}
              onClick={() => handleSelectCategory(category.id as MainCategory)}
              className={`
                relative p-6 rounded-2xl border-2 text-left transition-all transform
                ${isSelected 
                  ? `border-${category.color}-600 bg-${category.color}-50 ring-4 ring-${category.color}-200 scale-105 shadow-xl` 
                  : 'border-gray-200 bg-white hover:border-gray-400 hover:scale-102 shadow-lg hover:shadow-xl'}
              `}
            >
              {/* Selection Badge */}
              {isSelected && (
                <div className="absolute -top-3 -right-3 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg animate-bounce">
                  ✓
                </div>
              )}
              
              {/* Icon & Title */}
              <div className="flex items-start gap-4 mb-3">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${category.gradient} shadow-lg`}>
                  <Icon size={32} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-gray-800 mb-1">
                    {category.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {category.description}
                  </p>
                </div>
              </div>
              
              {/* Examples */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 mb-1">BEISPIELE:</p>
                <p className="text-sm text-gray-700">{category.examples}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Hinweis:</strong> Jede Kategorie erstellt eine komplett neue Geschichte speziell für deine Avatare. 
          Es wird keine vorgeschriebene Geschichte erzählt, sondern eine <strong>individuelle</strong> Geschichte erschaffen!
        </p>
      </div>
    </div>
  );
}
