// Step 6: Summary & Create
// Final overview before generating the story

import React from 'react';
import { Sparkles, User, BookOpen, Clock, Heart, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

export default function Step6Summary({ state, onGenerate }: Props) {
  const { t } = useTranslation();

  const CATEGORY_NAMES: Record<string, string> = {
    'fairy-tales': `🏰 ${t('wizard.categories.fairy_tales.title')}`,
    'adventure': `🗺️ ${t('wizard.categories.adventure.title')}`,
    'magic': `✨ ${t('wizard.categories.magic.title')}`,
    'animals': `🦊 ${t('wizard.categories.animals.title')}`,
    'scifi': `🚀 ${t('wizard.categories.scifi.title')}`,
    'modern': `🏡 ${t('wizard.categories.modern.title')}`
  };

  const AGE_LABELS: Record<string, string> = {
    '3-5': t('wizard.ageGroups.3-5.title'),
    '6-8': t('wizard.ageGroups.6-8.title'),
    '9-12': t('wizard.ageGroups.9-12.title'),
    '13+': t('wizard.ageGroups.13+.title')
  };

  const LENGTH_LABELS: Record<string, string> = {
    'short': `⚡ ${t('wizard.lengths.short.title')} (${t('wizard.lengths.short.duration')})`,
    'medium': `📖 ${t('wizard.lengths.medium.title')} (${t('wizard.lengths.medium.duration')})`,
    'long': `📚 ${t('wizard.lengths.long.title')} (${t('wizard.lengths.long.duration')})`
  };

  const FEELING_EMOJIS: Record<string, string> = {
    'funny': `😂 ${t('wizard.feelings.funny.title')}`,
    'warm': `❤️ ${t('wizard.feelings.warm.title')}`,
    'exciting': `⚡ ${t('wizard.feelings.exciting.title')}`,
    'crazy': `🤪 ${t('wizard.feelings.crazy.title')}`,
    'meaningful': `💭 ${t('wizard.feelings.meaningful.title')}`
  };

  const activeWishes = [
    state.rhymes && `🎵 ${t('wizard.wishes.rhymes.title')}`,
    state.moral && `📖 ${t('wizard.wishes.moral.title')}`,
    state.avatarIsHero && `⭐ ${t('wizard.wishes.avatarIsHero.title')}`,
    state.famousCharacters && `👑 ${t('wizard.wishes.famousCharacters.title')}`,
    state.happyEnd && `😊 ${t('wizard.wishes.happyEnd.title')}`,
    state.surpriseEnd && `❗ ${t('wizard.wishes.surpriseEnd.title')}`
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🎉 {t('wizard.titles.summary')}
        </h2>
        <p className="text-gray-600">
          {t('wizard.subtitles.summary')}
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
            <p className="font-semibold text-gray-800 mb-1">{t('wizard.summary.avatars')}</p>
            <p className="text-sm text-gray-600">
              {state.selectedAvatars.length} {t('wizard.summary.avatars')} {t('wizard.common.selected')}
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
            <p className="font-semibold text-gray-800 mb-1">{t('wizard.summary.category')}</p>
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
            <p className="font-semibold text-gray-800 mb-1">{t('wizard.summary.age')} & {t('wizard.summary.length')}</p>
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
            <p className="font-semibold text-gray-800 mb-1">{t('wizard.summary.feelings')}</p>
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
              <p className="font-semibold text-gray-800 mb-1">{t('wizard.titles.wishes')}</p>
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
              ✨ {t('wizard.summary.ready')}
            </p>
            <p className="text-sm text-purple-800">
              {t('wizard.common.summaryNote')}
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
        {t('wizard.buttons.generate')}
        <Sparkles size={32} className="animate-pulse" />
      </button>
    </div>
  );
}
