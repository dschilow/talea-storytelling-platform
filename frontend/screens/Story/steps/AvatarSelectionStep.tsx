import React, { useState, useEffect } from 'react';
import { User, Check, Users, Eye } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import Card from '../../../components/common/Card';
import FadeInView from '../../../components/animated/FadeInView';
import { useBackend } from '../../../hooks/useBackend';
import { getTraitsForStory, getTraitLabel, getTraitIcon } from '../../../constants/traits';

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  creationType: 'ai-generated' | 'photo-upload';
}

interface AvatarSelectionStepProps {
  selectedAvatarIds: string[];
  onSelectionChange: (avatarIds: string[]) => void;
  storyType?: string; // For showing relevant traits
}

const AvatarSelectionStep: React.FC<AvatarSelectionStepProps> = ({
  selectedAvatarIds,
  onSelectionChange,
  storyType,
}) => {
  const { t, i18n } = useTranslation();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const backend = useBackend();
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      loadAvatars();
    }
  }, [user]);

  const loadAvatars = async () => {
    try {
      const response = await backend.avatar.list();
      setAvatars(response.avatars as any[]);
    } catch (error) {
      console.error('Error loading avatars:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvatarSelection = (avatarId: string) => {
    const isSelected = selectedAvatarIds.includes(avatarId);

    if (isSelected) {
      onSelectionChange(selectedAvatarIds.filter(id => id !== avatarId));
    } else {
      if (selectedAvatarIds.length < 3) {
        onSelectionChange([...selectedAvatarIds, avatarId]);
      }
    }
  };

  if (loading) {
    return (
      <FadeInView>
        <Card variant="elevated" className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </Card>
      </FadeInView>
    );
  }

  if (avatars.length === 0) {
    return (
      <FadeInView>
        <Card variant="elevated" className="text-center py-8">
          <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">{t('homePage.emptyAvatarsTitle')}</h3>
          <p className="text-gray-600">
            {t('homePage.emptyAvatarsDesc')}
          </p>
        </Card>
      </FadeInView>
    );
  }

  // Get relevant traits for story type
  const relevantTraits = storyType ? getTraitsForStory(storyType) : [];

  return (
    <FadeInView>
      <div className="space-y-6">
        {/* Story Info Card */}
        {relevantTraits.length > 0 && (
          <Card variant="elevated" className="bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-lg mb-2 text-blue-800">📖 Story-Modus</h3>
            <p className="text-sm text-blue-700 mb-3">
              Story-Typ bestimmt welche Eigenschaften entwickelt werden:
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {relevantTraits.map(traitId => (
                <span
                  key={traitId}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                >
                  <span>{getTraitIcon(traitId)}</span>
                  <span>{getTraitLabel(traitId, i18n.language as 'de' | 'en')}</span>
                </span>
              ))}
            </div>
            <div className="text-xs space-y-1 text-blue-600">
              <p><strong>Mitspieler:</strong> Erhalten volle Punkte (+3)</p>
              <p><strong>Beobachter:</strong> Erhalten weniger Punkte (+1)</p>
            </div>
          </Card>
        )}

        {/* Avatar Selection Card */}
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 text-center mb-2">{t('story.wizard.selectAvatars')}</h2>
          <p className="text-gray-600 text-center mb-4">
            {t('story.wizard.selectAvatarsSubtitle')}
          </p>

          <div className="text-center mb-6">
            <span className="text-purple-600 font-semibold">
              {selectedAvatarIds.length} / 3
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {avatars.map((avatar, index) => {
              const isParticipant = selectedAvatarIds.includes(avatar.id);

              return (
                <FadeInView key={avatar.id} delay={100 + index * 50}>
                  <button
                    onClick={() => toggleAvatarSelection(avatar.id)}
                    className={`w-full p-4 rounded-lg border-2 transition-all ${isParticipant
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 bg-gray-50 hover:border-purple-300'
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar Image */}
                      <div className="relative">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center overflow-hidden ${isParticipant ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                          {avatar.imageUrl ? (
                            <img
                              src={avatar.imageUrl}
                              alt={avatar.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl">
                              {avatar.creationType === 'ai-generated' ? '🤖' : '📷'}
                            </span>
                          )}
                        </div>

                        <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${isParticipant ? 'bg-green-500' : 'bg-gray-400'
                          }`}>
                          {isParticipant ? <Users className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </div>
                      </div>

                      {/* Avatar Info */}
                      <div className="flex-1 text-left">
                        <h3 className={`font-semibold text-lg ${isParticipant ? 'text-green-700' : 'text-gray-800'
                          }`}>
                          {avatar.name}
                        </h3>

                        <div className="text-sm space-y-1">
                          <p className={`font-medium ${isParticipant ? 'text-green-600' : 'text-gray-500'
                            }`}>
                            {isParticipant ? '🎭 Mitspieler' : '👀 Beobachter'}
                          </p>

                          {relevantTraits.length > 0 && (
                            <p className={`text-xs ${isParticipant ? 'text-green-600' : 'text-gray-500'
                              }`}>
                              Erhält {isParticipant ? '+3' : '+1'} Punkte in: {relevantTraits.map(t => getTraitIcon(t)).join(' ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </FadeInView>
              );
            })}
          </div>

          <div className="mt-4 text-center text-sm text-gray-500">
            {selectedAvatarIds.length === 0 && (
              <p className="text-amber-600">⚠️ {t('story.wizard.alerts.selectAvatar')}</p>
            )}
          </div>
        </Card>
      </div>
    </FadeInView>
  );
};

export default AvatarSelectionStep;
