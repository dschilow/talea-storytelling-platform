// Step 5: Special Wishes (Optional)
// Additional story preferences

import React from 'react';
import { Music, BookHeart, Star, Shuffle, Smile, AlertCircle } from 'lucide-react';

interface Props {
  state: {
    rhymes: boolean;
    moral: boolean;
    avatarIsHero: boolean;
    famousCharacters: boolean;
    happyEnd: boolean;
    surpriseEnd: boolean;
    customWish: string;
  };
  updateState: (updates: any) => void;
}

const WISHES = [
  {
    id: 'rhymes',
    title: '🎵 Mit Reimen',
    description: 'Geschichte enthält Verse und Reime',
    icon: Music,
    color: 'pink'
  },
  {
    id: 'moral',
    title: '📖 Mit Moral',
    description: 'Geschichte hat eine Lehre oder Botschaft',
    icon: BookHeart,
    color: 'blue'
  },
  {
    id: 'avatarIsHero',
    title: '⭐ Avatar ist Held',
    description: 'Deine Avatare sind die Haupthelden',
    icon: Star,
    color: 'yellow',
    defaultActive: true
  },
  {
    id: 'famousCharacters',
    title: '👑 Bekannte Figuren',
    description: 'Berühmte Märchenfiguren einbauen',
    icon: Shuffle,
    color: 'purple'
  },
  {
    id: 'happyEnd',
    title: '😊 Happy End',
    description: 'Geschichte endet glücklich',
    icon: Smile,
    color: 'green',
    defaultActive: true
  },
  {
    id: 'surpriseEnd',
    title: '❗ Überraschungs-Ende',
    description: 'Unerwartete Wendung am Schluss',
    icon: AlertCircle,
    color: 'orange'
  }
];

export default function Step5SpecialWishes({ state, updateState }: Props) {
  const handleToggleWish = (wishId: string) => {
    updateState({ [wishId]: !state[wishId as keyof typeof state] });
  };

  const handleCustomWishChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateState({ customWish: e.target.value });
  };

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          ✨ Besondere Wünsche? (Optional)
        </h2>
        <p className="text-gray-600">
          Füge besondere Features hinzu oder überspringe diesen Schritt.
        </p>
      </div>

      {/* Wishes Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {WISHES.map((wish) => {
          const isSelected = state[wish.id as keyof typeof state] as boolean;
          const Icon = wish.icon;
          
          return (
            <button
              key={wish.id}
              onClick={() => handleToggleWish(wish.id)}
              className={`
                relative p-4 rounded-xl border-2 transition-all transform
                ${isSelected 
                  ? `border-${wish.color}-500 bg-${wish.color}-50 ring-2 ring-${wish.color}-200 scale-102` 
                  : 'border-gray-200 bg-white hover:border-gray-400'}
              `}
            >
              {/* Selection Badge */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  ✓
                </div>
              )}
              
              {/* Icon & Text */}
              <div className="flex flex-col items-center text-center">
                <Icon size={28} className={`mb-2 ${isSelected ? `text-${wish.color}-600` : 'text-gray-400'}`} />
                <p className="font-semibold text-sm text-gray-800 mb-1">{wish.title}</p>
                <p className="text-xs text-gray-600">{wish.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Wish Input */}
      <div>
        <label className="block mb-2">
          <span className="text-sm font-semibold text-gray-700">💬 Eigener Wunsch (optional):</span>
        </label>
        <textarea
          value={state.customWish}
          onChange={handleCustomWishChange}
          placeholder="z.B. 'Die Geschichte soll im Weltall spielen' oder 'Mit einem sprechenden Drachen'"
          maxLength={200}
          className="
            w-full p-4 border-2 border-gray-200 rounded-xl
            focus:border-purple-500 focus:ring-4 focus:ring-purple-100
            resize-none transition-all
          "
          rows={3}
        />
        <p className="text-xs text-gray-500 mt-1">
          {state.customWish.length}/200 Zeichen
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Hinweis:</strong> Alle Wünsche sind optional. Die KI wird ihr Bestes tun, 
          deine Wünsche einzubauen, aber die Geschichte bleibt immer spannend und logisch!
        </p>
      </div>
    </div>
  );
}
