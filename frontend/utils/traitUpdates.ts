import {
  translateEnglishTraitToId,
  getTraitLabel,
  getTraitIcon,
  getTraitsForStory,
  getTraitsForDoku
} from '../constants/traits';

export interface TraitChange {
  trait: string;
  change: number;
}

export interface ProcessedTraitChange {
  traitId: string;
  traitLabel: string;
  traitIcon: string;
  change: number;
}

// Convert English trait changes to new ID-based system
export const processTraitChanges = (changes: TraitChange[]): ProcessedTraitChange[] => {
  return changes.map(change => {
    const traitId = translateEnglishTraitToId(change.trait);
    return {
      traitId,
      traitLabel: getTraitLabel(traitId, 'de'),
      traitIcon: getTraitIcon(traitId),
      change: change.change
    };
  });
};

// Calculate trait updates for story/doku completion
export interface AvatarParticipation {
  participants: string[]; // Avatar IDs that actively participate
  observers: string[];    // Avatar IDs that observe
}

export interface ContentTraitUpdate {
  avatarId: string;
  traits: ProcessedTraitChange[];
  participationType: 'participant' | 'observer';
}

export const calculateTraitUpdates = (
  contentType: 'story' | 'doku',
  contentSubtype: string,
  participation: AvatarParticipation
): ContentTraitUpdate[] => {

  // Get relevant traits for this content
  const relevantTraitIds = contentType === 'story'
    ? getTraitsForStory(contentSubtype)
    : getTraitsForDoku(contentSubtype);

  const updates: ContentTraitUpdate[] = [];

  // Process participants (full points)
  for (const avatarId of participation.participants) {
    const traits = relevantTraitIds.map(traitId => ({
      traitId,
      traitLabel: getTraitLabel(traitId, 'de'),
      traitIcon: getTraitIcon(traitId),
      change: contentType === 'story' ? 3 : 5 // Stories: +3, Dokus: +5
    }));

    updates.push({
      avatarId,
      traits,
      participationType: 'participant'
    });
  }

  // Process observers (reduced points, only for stories)
  if (contentType === 'story') {
    for (const avatarId of participation.observers) {
      const traits = relevantTraitIds.map(traitId => ({
        traitId,
        traitLabel: getTraitLabel(traitId, 'de'),
        traitIcon: getTraitIcon(traitId),
        change: 1 // Observers get +1 point
      }));

      updates.push({
        avatarId,
        traits,
        participationType: 'observer'
      });
    }
  }

  return updates;
};

// Generate user-friendly message for trait updates
export const generateTraitUpdateMessage = (
  updates: ContentTraitUpdate[],
  contentTitle: string,
  contentType: 'story' | 'doku'
): string => {
  const participantUpdates = updates.filter(u => u.participationType === 'participant');
  const observerUpdates = updates.filter(u => u.participationType === 'observer');

  let message = `${contentType === 'story' ? '📖' : '📚'} ${contentTitle} abgeschlossen!\n\n`;

  if (participantUpdates.length > 0) {
    message += `🎭 ${contentType === 'story' ? 'Mitspieler' : 'Alle Avatare'}:\n`;
    participantUpdates.forEach(update => {
      const traitList = update.traits
        .map(t => `${t.traitIcon} ${t.traitLabel} (+${t.change})`)
        .join(', ');
      message += `• ${update.avatarId}: ${traitList}\n`;
    });
  }

  if (observerUpdates.length > 0) {
    message += `\n👀 Beobachter:\n`;
    observerUpdates.forEach(update => {
      const traitList = update.traits
        .map(t => `${t.traitIcon} ${t.traitLabel} (+${t.change})`)
        .join(', ');
      message += `• ${update.avatarId}: ${traitList}\n`;
    });
  }

  return message;
};

// Convert trait updates to format expected by backend
export const convertToBackendFormat = (updates: ContentTraitUpdate[]) => {
  return updates.map(update => ({
    avatarId: update.avatarId,
    changes: update.traits.map(trait => ({
      trait: trait.traitId,
      change: trait.change
    }))
  }));
};