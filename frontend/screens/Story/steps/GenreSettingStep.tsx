import React from 'react';

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
  const genres = [
    {
      key: 'Klassische Märchen',
      label: 'Klassische Märchen',
      icon: '🏰',
      description: 'Nutze originale Märchen als Inspirationsquelle',
    },
    {
      key: 'Märchenwelten und Magie',
      label: 'Märchenwelten & Magie',
      icon: '✨',
      description: 'Freie Märchenwelten mit magischem Remix',
    },
    { key: 'adventure', label: 'Abenteuer', icon: '🗺️', description: 'Spannende Reisen und Entdeckungen' },
    { key: 'fantasy', label: 'Fantasy', icon: '🧙‍♂️', description: 'Magische Welten und Zauberei' },
    { key: 'mystery', label: 'Geheimnis', icon: '🔍', description: 'Rätsel und geheimnisvolle Ereignisse' },
    { key: 'friendship', label: 'Freundschaft', icon: '👫', description: 'Geschichten über Zusammenhalt' },
    { key: 'learning', label: 'Lernen', icon: '📚', description: 'Bildende und lehrreiche Inhalte' },
    { key: 'comedy', label: 'Komödie', icon: '😄', description: 'Lustige und humorvolle Geschichten' },
  ];

  const settings = [
    { key: 'forest', label: 'Zauberwald', icon: '🌲', description: 'Mystische Wälder voller Geheimnisse' },
    { key: 'castle', label: 'Schloss', icon: '🏰', description: 'Königliche Paläste und Burgen' },
    { key: 'ocean', label: 'Unterwasserwelt', icon: '🌊', description: 'Tiefen des Ozeans erkunden' },
    { key: 'space', label: 'Weltraum', icon: '🚀', description: 'Abenteuer zwischen den Sternen' },
    { key: 'city', label: 'Moderne Stadt', icon: '🏙️', description: 'Urbane Abenteuer und Entdeckungen' },
    { key: 'village', label: 'Märchendorf', icon: '🏘️', description: 'Gemütliche Dorfgemeinschaften' },
  ];

  return (
    <div className="space-y-6">
      {/* Genre Selection */}
      <FadeInView delay={100}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Genre wählen</h2>
          <p className="text-gray-600 text-center mb-6">
            Welche Art von Geschichte soll es werden?
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {genres.map((genreOption, index) => (
              <FadeInView key={genreOption.key} delay={150 + index * 50}>
                <button
                  onClick={() => onGenreChange(genreOption.key)}
                  className={`p-4 rounded-lg border-2 transition-colors text-center ${
                    genre === genreOption.key
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-300 hover:border-purple-300'
                  }`}
                >
                  <span className="text-2xl mb-2 block">{genreOption.icon}</span>
                  <h3 className={`font-semibold mb-1 ${
                    genre === genreOption.key ? 'text-purple-700' : 'text-gray-800'
                  }`}>
                    {genreOption.label}
                  </h3>
                  <p className={`text-xs ${
                    genre === genreOption.key ? 'text-purple-600' : 'text-gray-600'
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
          <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Schauplatz wählen</h2>
          <p className="text-gray-600 text-center mb-6">
            Wo soll deine Geschichte stattfinden?
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {settings.map((settingOption, index) => (
              <FadeInView key={settingOption.key} delay={250 + index * 50}>
                <button
                  onClick={() => onSettingChange(settingOption.key)}
                  className={`p-4 rounded-lg border-2 transition-colors text-center ${
                    setting === settingOption.key
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-300 hover:border-purple-300'
                  }`}
                >
                  <span className="text-2xl mb-2 block">{settingOption.icon}</span>
                  <h3 className={`font-semibold mb-1 ${
                    setting === settingOption.key ? 'text-purple-700' : 'text-gray-800'
                  }`}>
                    {settingOption.label}
                  </h3>
                  <p className={`text-xs ${
                    setting === settingOption.key ? 'text-purple-600' : 'text-gray-600'
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
