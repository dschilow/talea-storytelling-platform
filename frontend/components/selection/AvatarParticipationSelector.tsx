import React, { useState, useEffect } from 'react';
import { Avatar } from '../../types/avatar';
import { getTraitsForStory, getTraitsForDoku, getTraitLabel, getTraitIcon } from '../../constants/traits';

interface AvatarParticipationSelectorProps {
  avatars: Avatar[];
  contentType: 'story' | 'doku';
  storyType?: string;
  dokuType?: string;
  onSelectionChange: (participants: string[], observers: string[]) => void;
}

export const AvatarParticipationSelector: React.FC<AvatarParticipationSelectorProps> = ({
  avatars,
  contentType,
  storyType,
  dokuType,
  onSelectionChange
}) => {
  const [participants, setParticipants] = useState<string[]>([]);
  const maxParticipants = contentType === 'story' ? 3 : avatars.length; // Stories: max 3, Dokus: all

  // Get relevant traits for this content
  const relevantTraits = contentType === 'story'
    ? (storyType ? getTraitsForStory(storyType) : [])
    : (dokuType ? getTraitsForDoku(dokuType) : []);

  useEffect(() => {
    if (contentType === 'doku') {
      // For dokus, all avatars participate automatically
      const allAvatarIds = avatars.map(avatar => avatar.id);
      setParticipants(allAvatarIds);
      onSelectionChange(allAvatarIds, []);
    } else {
      // For stories, start with empty selection
      onSelectionChange(participants, avatars.filter(a => !participants.includes(a.id)).map(a => a.id));
    }
  }, [avatars, contentType]);

  const handleAvatarToggle = (avatarId: string) => {
    if (contentType === 'doku') return; // Dokus have all avatars participating

    const isCurrentlyParticipant = participants.includes(avatarId);

    if (isCurrentlyParticipant) {
      // Remove from participants
      const newParticipants = participants.filter(id => id !== avatarId);
      setParticipants(newParticipants);
      const observers = avatars.filter(a => !newParticipants.includes(a.id)).map(a => a.id);
      onSelectionChange(newParticipants, observers);
    } else if (participants.length < maxParticipants) {
      // Add to participants
      const newParticipants = [...participants, avatarId];
      setParticipants(newParticipants);
      const observers = avatars.filter(a => !newParticipants.includes(a.id)).map(a => a.id);
      onSelectionChange(newParticipants, observers);
    }
  };

  const getAvatarStatus = (avatarId: string) => {
    if (contentType === 'doku') return 'participant';
    return participants.includes(avatarId) ? 'participant' : 'observer';
  };

  const getRewardInfo = (status: 'participant' | 'observer') => {
    if (contentType === 'doku') {
      return 'Erhält volle Punkte in allen relevanten Eigenschaften';
    }

    return status === 'participant'
      ? 'Erhält volle Punkte in relevanten Eigenschaften'
      : 'Erhält 1 Punkt in relevanten Eigenschaften';
  };

  return (
    <div className="space-y-6">
      {/* Content Type & Trait Info */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-lg mb-2">
          {contentType === 'story' ? '📖 Story-Modus' : '📚 Doku-Modus'}
        </h3>

        {relevantTraits.length > 0 && (
          <div className="mb-3">
            <p className="text-sm text-gray-600 mb-2">Relevante Eigenschaften:</p>
            <div className="flex flex-wrap gap-2">
              {relevantTraits.map(traitId => (
                <span
                  key={traitId}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  <span>{getTraitIcon(traitId)}</span>
                  <span>{getTraitLabel(traitId, 'de')}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="text-sm space-y-1">
          {contentType === 'story' ? (
            <>
              <p>• <strong>Mitspieler (max. 3):</strong> Erhalten volle Punkte</p>
              <p>• <strong>Beobachter:</strong> Erhalten 1 Punkt</p>
            </>
          ) : (
            <p>• <strong>Alle Avatare lernen automatisch</strong> und erhalten volle Punkte</p>
          )}
        </div>
      </div>

      {/* Avatar Selection */}
      <div className="space-y-3">
        <h3 className="font-semibold">
          {contentType === 'story' ? 'Wähle 2-3 Mitspieler:' : 'Alle Avatare lernen mit:'}
        </h3>

        <div className="grid grid-cols-1 gap-3">
          {avatars.map(avatar => {
            const status = getAvatarStatus(avatar.id);
            const isClickable = contentType === 'story';

            return (
              <div
                key={avatar.id}
                onClick={() => isClickable && handleAvatarToggle(avatar.id)}
                className={`
                  p-4 rounded-lg border-2 transition-all
                  ${status === 'participant'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 bg-gray-50'
                  }
                  ${isClickable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
                `}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar Image */}
                  <div className="relative">
                    <img
                      src={avatar.imageUrl}
                      alt={avatar.name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    <div className={`
                      absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white
                      ${status === 'participant' ? 'bg-green-500' : 'bg-gray-400'}
                    `}>
                      {status === 'participant' ? '✓' : '○'}
                    </div>
                  </div>

                  {/* Avatar Info */}
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{avatar.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{avatar.description}</p>

                    <div className="text-xs">
                      <span className={`
                        font-semibold
                        ${status === 'participant' ? 'text-green-600' : 'text-gray-500'}
                      `}>
                        {status === 'participant' ? '🎭 Mitspieler' : '👀 Beobachter'}
                      </span>
                      <p className="text-gray-500 mt-1">
                        {getRewardInfo(status)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {contentType === 'story' && (
          <div className="text-center text-sm text-gray-500">
            {participants.length}/{maxParticipants} Mitspieler ausgewählt
            {participants.length === 0 && (
              <p className="text-amber-600 mt-1">⚠️ Mindestens einen Avatar auswählen</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};