"use client";

import React from 'react';
import { Calendar, Heart, Palette, Sparkles, Users } from 'lucide-react';
import { Badge } from '../ui/badge';
import {
  PlayfulCard,
  PlayfulCardHeader,
  PlayfulCardTitle,
  PlayfulCardDescription,
  PlayfulButton,
  usePlayfulCard,
} from '../ui/playful-card';
import type { Avatar } from '../../types/avatar';

interface AvatarPlayfulCardProps {
  avatar: Avatar;
  onUse?: (avatar: Avatar) => void;
  onEdit?: (avatar: Avatar) => void;
}

export const AvatarPlayfulCard: React.FC<AvatarPlayfulCardProps> = ({
  avatar,
  onUse,
  onEdit,
}) => {
  const { expandedCardId } = usePlayfulCard();
  const isExpanded = expandedCardId === `avatar-${avatar.id}`;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getGenderEmoji = (gender?: string) => {
    switch (gender?.toLowerCase()) {
      case 'male':
      case 'männlich':
        return '👨';
      case 'female':
      case 'weiblich':
        return '👩';
      case 'other':
      case 'divers':
        return '👤';
      default:
        return '👤';
    }
  };

  const getAvatarColor = (gender?: string) => {
    switch (gender?.toLowerCase()) {
      case 'male':
      case 'männlich':
        return 'blue';
      case 'female':
      case 'weiblich':
        return 'pink';
      default:
        return 'purple';
    }
  };

  const handleUse = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUse?.(avatar);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(avatar);
  };

  return (
    <PlayfulCard
      cardId={`avatar-${avatar.id}`}
      color={getAvatarColor(avatar.config?.gender) as any}
      size="medium"
    >
      <PlayfulCardHeader>
        <div className="flex flex-col items-center text-center">
          {/* Avatar Image */}
          <div className="relative mb-3">
            <div className="relative">
              <img
                src={avatar.imageUrl || '/placeholder-avatar.jpg'}
                alt={avatar.name}
                className={`rounded-2xl object-cover border-3 border-white shadow-lg transition-all duration-300 ${
                  isExpanded ? 'w-24 h-24' : 'w-16 h-16'
                }`}
              />
              
              {/* Playful floating emoji */}
              <div className="absolute -top-2 -right-2 text-lg animate-bounce">
                {getGenderEmoji(avatar.config?.gender)}
              </div>
            </div>
          </div>

          <PlayfulCardTitle 
            emoji="✨" 
            className={isExpanded ? 'text-xl' : 'text-lg'}
          >
            {avatar.name}
          </PlayfulCardTitle>

          {/* Age Badge - Kinderfreundlich gestaltet */}
          {avatar.config?.age && (
            <div className="mb-2">
              <Badge 
                variant="outline" 
                className="bg-white/90 border-2 border-current text-current font-semibold shadow-sm"
              >
                🎂 {avatar.config.age} Jahre alt
              </Badge>
            </div>
          )}

          {!isExpanded && avatar.description && (
            <PlayfulCardDescription className="line-clamp-2">
              {avatar.description}
            </PlayfulCardDescription>
          )}
        </div>
      </PlayfulCardHeader>

      {/* Expanded Content - Nur wenn die Card expandiert ist */}
      {isExpanded && (
        <div className="space-y-4">
          {/* Beschreibung */}
          {avatar.description && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                📝 Beschreibung
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                {avatar.description}
              </p>
            </div>
          )}

          {/* Avatar Details - Kinderfreundlich mit Emojis */}
          {(avatar.config?.personality || avatar.config?.appearance || avatar.config?.hobbies || avatar.config?.backstory) && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                🌟 Mehr über {avatar.name}
              </h4>
              
              {avatar.config?.personality && (
                <div className="bg-pink-50 border-2 border-pink-200 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <Heart className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-pink-800">❤️ Persönlichkeit:</span>
                      <p className="text-pink-700 text-sm mt-1">{avatar.config.personality}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {avatar.config?.appearance && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <Palette className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-blue-800">🎨 Aussehen:</span>
                      <p className="text-blue-700 text-sm mt-1">{avatar.config.appearance}</p>
                    </div>
                  </div>
                </div>
              )}

              {avatar.config?.hobbies && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-yellow-800">🎯 Hobbies:</span>
                      <p className="text-yellow-700 text-sm mt-1">{avatar.config.hobbies}</p>
                    </div>
                  </div>
                </div>
              )}

              {avatar.config?.backstory && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-green-800">📚 Hintergrund:</span>
                      <p className="text-green-700 text-sm mt-1 leading-relaxed">{avatar.config.backstory}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Eigenschaften Grid - Spielerisch gestaltet */}
          {(avatar.config?.gender || avatar.config?.ageGroup || avatar.config?.ethnicity) && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                🏷️ Eigenschaften
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {avatar.config.gender && (
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-3 text-center">
                    <div className="text-2xl mb-1">{getGenderEmoji(avatar.config.gender)}</div>
                    <div className="text-xs text-purple-600 font-medium">Geschlecht</div>
                    <div className="text-sm font-semibold text-purple-800">{avatar.config.gender}</div>
                  </div>
                )}
                {avatar.config.ageGroup && (
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-xl p-3 text-center">
                    <div className="text-2xl mb-1">👥</div>
                    <div className="text-xs text-orange-600 font-medium">Altersgruppe</div>
                    <div className="text-sm font-semibold text-orange-800">{avatar.config.ageGroup}</div>
                  </div>
                )}
                {avatar.config.ethnicity && (
                  <div className="bg-gradient-to-br from-teal-50 to-teal-100 border-2 border-teal-200 rounded-xl p-3 text-center col-span-2">
                    <div className="text-2xl mb-1">🌍</div>
                    <div className="text-xs text-teal-600 font-medium">Ethnizität</div>
                    <div className="text-sm font-semibold text-teal-800">{avatar.config.ethnicity}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons - Kinderfreundlich mit Emojis */}
          <div className="flex flex-col gap-3 pt-4">
            <PlayfulButton
              color={getAvatarColor(avatar.config?.gender) as any}
              emoji="🚀"
              onClick={handleUse}
              className="w-full justify-center"
            >
              Avatar verwenden
            </PlayfulButton>
            
            <PlayfulButton
              color="orange"
              emoji="✏️"
              onClick={handleEdit}
              className="w-full justify-center"
              size="small"
            >
              Bearbeiten
            </PlayfulButton>
          </div>

          {/* Footer Info - Spielerisch */}
          <div className="pt-4 border-t-2 border-gray-100">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center text-gray-500">
                <Calendar className="w-3 h-3 mr-1" />
                📅 {formatDate(avatar.createdAt)}
              </div>
              
              <Badge 
                variant="outline" 
                className={`text-xs font-medium ${
                  avatar.status === 'complete' 
                    ? 'bg-green-50 text-green-700 border-green-300'
                    : avatar.status === 'generating'
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                    : 'bg-red-50 text-red-700 border-red-300'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mr-1 ${
                  avatar.status === 'complete' ? 'bg-green-500' : 
                  avatar.status === 'generating' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                }`} />
                {avatar.status === 'complete' ? '✅ Fertig' : 
                 avatar.status === 'generating' ? '⏳ Wird erstellt...' : '❌ Fehler'}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </PlayfulCard>
  );
};