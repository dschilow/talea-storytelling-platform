import React from 'react';
import { useTranslation } from 'react-i18next';

import Card from '../../../components/common/Card';
import FadeInView from '../../../components/animated/FadeInView';

interface GenreSettingStepProps {
  genre: string;
  setting: string;
  onGenreChange: (genre: string) => void;
  onSettingChange: (setting: string) => void;
}

const GenreSettingStep: React.FC<GenreSettingStepProps> = ({
  genre,
  setting,
  onGenreChange,
  onSettingChange,
}) => {
  const { t } = useTranslation();

  const genres = [
    {
      key: 'fairytale',
      label: t('story.wizard.genre.options.fairytale'),
      icon: '🏰',
      description: t('story.wizard.genre.options.fairytaleDesc'),
      value: 'fairytale' // Use i18n-independent key for backend
    },
    {
      key: 'magic',
      label: t('story.wizard.genre.options.magic'),
      icon: '✨',
      description: t('story.wizard.genre.options.magicDesc'),
      value: 'magic' // Use i18n-independent key for backend
    },
    {
      key: 'adventure',
      label: t('story.wizard.genre.options.adventure'),
      icon: '🗺️',
      description: t('story.wizard.genre.options.adventureDesc'),
      value: 'adventure'
    },
    {
      key: 'fantasy',
      label: t('story.wizard.genre.options.fantasy'),
      icon: '🧙‍♂️',
      description: t('story.wizard.genre.options.fantasyDesc'),
      value: 'fantasy'
    },
    {
      key: 'mystery',
      label: t('story.wizard.genre.options.mystery'),
      icon: '🔍',
      description: t('story.wizard.genre.options.mysteryDesc'),
      value: 'mystery'
    },
    {
      key: 'friendship',
      label: t('story.wizard.genre.options.friendship'),
      icon: '👫',
      description: t('story.wizard.genre.options.friendshipDesc'),
      value: 'friendship'
    },
    {
      key: 'learning',
      label: t('story.wizard.genre.options.learning'),
      icon: '📚',
      description: t('story.wizard.genre.options.learningDesc'),
      value: 'learning'
    },
    {
      key: 'comedy',
      label: t('story.wizard.genre.options.comedy'),
      icon: '😄',
      description: t('story.wizard.genre.options.comedyDesc'),
      value: 'comedy'
    },
  ];

  const settings = [
    {
      key: 'forest',
      label: t('story.wizard.setting.options.forest'),
      icon: '🌲',
      description: t('story.wizard.setting.options.forestDesc'),
      value: 'forest'
    },
    {
      key: 'castle',
      label: t('story.wizard.setting.options.castle'),
      icon: '🏰',
      description: t('story.wizard.setting.options.castleDesc'),
      value: 'castle'
    },
    {
      key: 'ocean',
      label: t('story.wizard.setting.options.ocean'),
      icon: '🌊',
      description: t('story.wizard.setting.options.oceanDesc'),
      value: 'ocean'
    },
    {
      key: 'space',
      label: t('story.wizard.setting.options.space'),
      icon: '🚀',
      description: t('story.wizard.setting.options.spaceDesc'),
      value: 'space'
    },
    {
      key: 'city',
      label: t('story.wizard.setting.options.city'),
      icon: '🏙️',
      description: t('story.wizard.setting.options.cityDesc'),
      value: 'city'
    },
    {
      key: 'village',
      label: t('story.wizard.setting.options.village'),
      icon: '🏘️',
      description: t('story.wizard.setting.options.villageDesc'),
      value: 'village'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Genre Selection */}
      <FadeInView delay={100}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 text-center mb-2">{t('story.wizard.genre.title')}</h2>
          <p className="text-gray-600 text-center mb-6">
            {t('story.wizard.genre.subtitle')}
          </p>

          <div className="grid grid-cols-2 gap-4">
            {genres.map((genreOption, index) => (
              <FadeInView key={genreOption.key} delay={150 + index * 50}>
                <button
                  onClick={() => onGenreChange(genreOption.value)}
                  className={`p-4 rounded-lg border-2 transition-colors text-center w-full h-full flex flex-col items-center justify-center ${genre === genreOption.value
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-300 hover:border-amber-300'
                    }`}
                >
                  <span className="text-2xl mb-2 block">{genreOption.icon}</span>
                  <h3 className={`font-semibold mb-1 ${genre === genreOption.value ? 'text-amber-700' : 'text-gray-800'
                    }`}>
                    {genreOption.label}
                  </h3>
                  <p className={`text-xs ${genre === genreOption.value ? 'text-amber-600' : 'text-gray-600'
                    }`}>
                    {genreOption.description}
                  </p>
                </button>
              </FadeInView>
            ))}
          </div>
        </Card>
      </FadeInView>

      {/* Setting Selection */}
      <FadeInView delay={200}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 text-center mb-2">{t('story.wizard.setting.title')}</h2>
          <p className="text-gray-600 text-center mb-6">
            {t('story.wizard.setting.subtitle')}
          </p>

          <div className="grid grid-cols-2 gap-4">
            {settings.map((settingOption, index) => (
              <FadeInView key={settingOption.key} delay={250 + index * 50}>
                <button
                  onClick={() => onSettingChange(settingOption.value)}
                  className={`p-4 rounded-lg border-2 transition-colors text-center w-full h-full flex flex-col items-center justify-center ${setting === settingOption.value
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-300 hover:border-amber-300'
                    }`}
                >
                  <span className="text-2xl mb-2 block">{settingOption.icon}</span>
                  <h3 className={`font-semibold mb-1 ${setting === settingOption.value ? 'text-amber-700' : 'text-gray-800'
                    }`}>
                    {settingOption.label}
                  </h3>
                  <p className={`text-xs ${setting === settingOption.value ? 'text-amber-600' : 'text-gray-600'
                    }`}>
                    {settingOption.description}
                  </p>
                </button>
              </FadeInView>
            ))}
          </div>
        </Card>
      </FadeInView>
    </div>
  );
};

export default GenreSettingStep;

