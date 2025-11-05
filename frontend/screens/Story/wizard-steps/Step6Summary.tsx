// Step 6: Summary & Create
// Final overview before generating the story

import React from 'react';
import { Sparkles, User, BookOpen, Clock, Heart, CheckCircle } from 'lucide-react';

interface Props {
  state: {
    selectedAvatars: string[];
    mainCategory: string | null;
    ageGroup: string | null;
    length: string | null;
    feelings: string[];
    rhymes: boolean;
    moral: boolean;
    avatarIsHero: boolean;
    famousCharacters: boolean;
    happyEnd: boolean;
    surpriseEnd: boolean;
    customWish: string;
  };
  onGenerate: () => void;
}

const CATEGORY_NAMES: Record<string, string> = {
  'fairy-tales': '🏰 Klassische Märchen',
  'adventure': '🗺️ Abenteuer & Schätze',
  'magic': '✨ Märchenwelten & Magie',
  'animals': '🦊 Tierwelten',
  'scifi': '🚀 Sci-Fi & Zukunft',
  'modern': '🏡 Modern & Realität'
};

const AGE_LABELS: Record<string, string> = {
  '3-5': '3-5 Jahre',
  '6-8': '6-8 Jahre',
  '9-12': '9-12 Jahre',
  '13+': '13+ Jahre'
};

const LENGTH_LABELS: Record<string, string> = {
  'short': '⚡ Kurz (5-10 Min)',
  'medium': '📖 Mittel (10-15 Min)',
  'long': '📚 Lang (15-25 Min)'
};

const FEELING_EMOJIS: Record<string, string> = {
  'funny': '😂 Lustig',
  'warm': '❤️ Herzlich',
  'exciting': '⚡ Spannend',
  'crazy': '🤪 Verrückt',
  'meaningful': '💭 Bedeutungsvoll'
};

export default function Step6Summary({ state, onGenerate }: Props) {
  const activeWishes = [
    state.rhymes && '🎵 Mit Reimen',
    state.moral && '📖 Mit Moral',
    state.avatarIsHero && '⭐ Avatar ist Held',
    state.famousCharacters && '👑 Bekannte Figuren',
    state.happyEnd && '😊 Happy End',
    state.surpriseEnd && '❗ Überraschungs-Ende'
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🎉 Alles bereit!
        </h2>
        <p className="text-gray-600">
          Überprüfe deine Auswahl und erstelle die Geschichte.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="space-y-4">
        {/* Avatars */}
        <div className="bg-white border-2 border-purple-200 rounded-xl p-4 flex items-start gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <User size={24} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 mb-1">Avatare</p>
            <p className="text-sm text-gray-600">
              {state.selectedAvatars.length} Avatar{state.selectedAvatars.length > 1 ? 'e' : ''} ausgewählt
            </p>
          </div>
          <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
        </div>

        {/* Category */}
        <div className="bg-white border-2 border-blue-200 rounded-xl p-4 flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen size={24} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 mb-1">Kategorie</p>
            <p className="text-sm text-gray-600">
              {state.mainCategory ? CATEGORY_NAMES[state.mainCategory] : 'Nicht gewählt'}
            </p>
          </div>
          <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
        </div>

        {/* Age & Length */}
        <div className="bg-white border-2 border-green-200 rounded-xl p-4 flex items-start gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Clock size={24} className="text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 mb-1">Alter & Länge</p>
            <p className="text-sm text-gray-600">
              {state.ageGroup && AGE_LABELS[state.ageGroup]}, {state.length && LENGTH_LABELS[state.length]}
            </p>
          </div>
          <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
        </div>

        {/* Feelings */}
        <div className="bg-white border-2 border-pink-200 rounded-xl p-4 flex items-start gap-4">
          <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Heart size={24} className="text-pink-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 mb-1">Gefühle</p>
            <p className="text-sm text-gray-600">
              {state.feelings.map(f => FEELING_EMOJIS[f]).join(', ')}
            </p>
          </div>
          <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
        </div>

        {/* Special Wishes (if any) */}
        {(activeWishes.length > 0 || state.customWish) && (
          <div className="bg-white border-2 border-yellow-200 rounded-xl p-4 flex items-start gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Sparkles size={24} className="text-yellow-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800 mb-1">Besondere Wünsche</p>
              {activeWishes.length > 0 && (
                <p className="text-sm text-gray-600 mb-1">{activeWishes.join(', ')}</p>
              )}
              {state.customWish && (
                <p className="text-sm text-gray-600 italic">"{state.customWish}"</p>
              )}
            </div>
            <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <Sparkles size={32} className="text-purple-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-purple-900 mb-2">
              ✨ Deine einzigartige Geschichte wird jetzt erstellt!
            </p>
            <p className="text-sm text-purple-800">
              Die KI erstellt eine komplett neue Geschichte basierend auf deinen Wünschen. 
              Das dauert ca. <strong>60-90 Sekunden</strong>. Mit Bildern insgesamt <strong>2-3 Minuten</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Big Create Button */}
      <button
        onClick={onGenerate}
        className="
          w-full py-6 rounded-2xl font-bold text-2xl
          bg-gradient-to-r from-purple-600 via-pink-600 to-red-600
          text-white shadow-2xl transform transition-all duration-200
          hover:scale-105 active:scale-95
          flex items-center justify-center gap-4
        "
      >
        <Sparkles size={32} className="animate-pulse" />
        GESCHICHTE JETZT ERSTELLEN!
        <Sparkles size={32} className="animate-pulse" />
      </button>
    </div>
  );
}
