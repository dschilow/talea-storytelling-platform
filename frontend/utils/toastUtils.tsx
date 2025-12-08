import React from 'react';
import { toast } from 'sonner';
import { Alert, AlertIcon, AlertTitle, AlertIcons } from '../components/ui/Alert';
import { Brain, BookOpen, User, Sparkles, Trophy, Gift } from 'lucide-react';
import { InventoryItem } from '../types/avatar';

// Show personality update notification with German trait labels
export const showPersonalityUpdateToast = async (changes: Array<{ trait: string; change: number }>) => {
  // Import trait utilities dynamically to avoid circular dependencies
  const { getTraitLabel, getTraitIcon, getSubcategoryLabel, getSubcategoryIcon } = await import('../constants/traits');

  const totalChanges = changes.reduce((sum, change) => sum + Math.abs(change.change), 0);
  const message = `Persönlichkeit entwickelt sich! ${totalChanges} Änderungen`;

  // Format changes with German labels and icons
  const formattedChanges = changes.map(change => {
    let label: string;
    let icon: string;

    // Handle hierarchical traits (e.g., "knowledge.physik")
    if (change.trait.includes('.')) {
      const [mainCategory, subcategory] = change.trait.split('.');
      label = getSubcategoryLabel(subcategory, 'de');
      icon = getSubcategoryIcon(subcategory);
    } else {
      // Handle main category traits
      label = getTraitLabel(change.trait, 'de');
      icon = getTraitIcon(change.trait);
    }

    const value = change.change > 0 ? `+${change.change}` : `${change.change}`;
    return { label, icon, value };
  });

  toast.custom(
    (t) => (
      <Alert variant="success" onClose={() => toast.dismiss(t)}>
        <AlertIcon>
          <Brain className="w-5 h-5 text-green-600" />
        </AlertIcon>
        <div>
          <AlertTitle>{message}</AlertTitle>
          <div className="text-xs space-y-1 mt-2">
            {formattedChanges.map((change, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-sm">{change.icon}</span>
                <span className="font-medium">{change.label}:</span>
                <span className={`font-bold ${change.value.startsWith('+') ? 'text-green-700' : 'text-red-700'}`}>
                  {change.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Alert>
    ),
    { duration: 8000 }
  );
};

// Show story completion notification
export const showStoryCompletionToast = (storyTitle: string) => {
  toast.custom(
    (t) => (
      <Alert variant="success" onClose={() => toast.dismiss(t)}>
        <AlertIcon>
          <BookOpen className="w-5 h-5 text-green-600" />
        </AlertIcon>
        <AlertTitle>Geschichte abgeschlossen: {storyTitle}</AlertTitle>
      </Alert>
    ),
    { duration: 4000 }
  );
};

// Show doku completion notification
export const showDokuCompletionToast = (dokuTitle: string) => {
  toast.custom(
    (t) => (
      <Alert variant="success" onClose={() => toast.dismiss(t)}>
        <AlertIcon>
          <AlertIcons.Success className="w-5 h-5 text-green-600" />
        </AlertIcon>
        <AlertTitle>Doku gelesen: {dokuTitle}</AlertTitle>
      </Alert>
    ),
    { duration: 4000 }
  );
};

// Show quiz completion notification
export const showQuizCompletionToast = (score: number) => {
  const isGoodScore = score >= 70;
  
  toast.custom(
    (t) => (
      <Alert variant={isGoodScore ? "success" : "info"} onClose={() => toast.dismiss(t)}>
        <AlertIcon>
          <Trophy className={`w-5 h-5 ${isGoodScore ? 'text-green-600' : 'text-blue-600'}`} />
        </AlertIcon>
        <AlertTitle>Quiz abgeschlossen: {score}% richtig!</AlertTitle>
      </Alert>
    ),
    { duration: 4000 }
  );
};

// Show avatar created notification
export const showAvatarCreatedToast = (avatarName: string) => {
  toast.custom(
    (t) => (
      <Alert variant="success" onClose={() => toast.dismiss(t)}>
        <AlertIcon>
          <User className="w-5 h-5 text-green-600" />
        </AlertIcon>
        <AlertTitle>Avatar erstellt: {avatarName}</AlertTitle>
      </Alert>
    ),
    { duration: 4000 }
  );
};

// Show new character discovery notification (for auto-generated characters)
export const showNewCharacterToast = (characterNames: string) => {
  toast.custom(
    (t) => (
      <Alert variant="success" onClose={() => toast.dismiss(t)}>
        <AlertIcon>
          <Sparkles className="w-5 h-5 text-purple-600" />
        </AlertIcon>
        <div>
          <AlertTitle>Neue Freunde gefunden! 🌟</AlertTitle>
          <p className="text-sm text-gray-600 mt-1">
            Passend zur Geschichte wurden neue Charaktere erstellt: <strong>{characterNames}</strong>
          </p>
        </div>
      </Alert>
    ),
    { duration: 6000 }
  );
};

// Show general success notification
export const showSuccessToast = (message: string) => {
  toast.custom(
    (t) => (
      <Alert variant="success" onClose={() => toast.dismiss(t)}>
        <AlertIcon>
          <AlertIcons.Success className="w-5 h-5 text-green-600" />
        </AlertIcon>
        <AlertTitle>{message}</AlertTitle>
      </Alert>
    ),
    { duration: 4000 }
  );
};

// Show warning notification
export const showWarningToast = (message: string) => {
  toast.custom(
    (t) => (
      <Alert variant="warning" onClose={() => toast.dismiss(t)}>
        <AlertIcon>
          <AlertIcons.Warning className="w-5 h-5 text-yellow-600" />
        </AlertIcon>
        <AlertTitle>{message}</AlertTitle>
      </Alert>
    ),
    { duration: 4000 }
  );
};

// Show error notification
export const showErrorToast = (message: string) => {
  toast.custom(
    (t) => (
      <Alert variant="destructive" onClose={() => toast.dismiss(t)}>
        <AlertIcon>
          <AlertIcons.Destructive className="w-5 h-5 text-red-600" />
        </AlertIcon>
        <AlertTitle>{message}</AlertTitle>
      </Alert>
    ),
    { duration: 5000 }
  );
};

// Show artifact earned notification with image and description
export const showArtifactEarnedToast = (artifact: InventoryItem, avatarName?: string) => {
  toast.custom(
    (t) => (
      <div 
        className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 rounded-xl p-4 shadow-2xl border border-purple-500/30 max-w-md cursor-pointer"
        onClick={() => toast.dismiss(t)}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-yellow-500/20 rounded-full">
            <Gift className="w-5 h-5 text-yellow-400" />
          </div>
          <span className="text-yellow-400 font-bold text-sm">🎁 Neues Artefakt erhalten!</span>
        </div>
        
        {/* Content with Image */}
        <div className="flex gap-3">
          {/* Artifact Image */}
          {artifact.imageUrl && (
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-purple-400/50 shadow-lg">
                <img 
                  src={artifact.imageUrl} 
                  alt={artifact.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
          
          {/* Artifact Details */}
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-bold text-base truncate">{artifact.name}</h4>
            {avatarName && (
              <p className="text-purple-300 text-xs mb-1">für {avatarName}</p>
            )}
            <p className="text-purple-200 text-xs line-clamp-2">
              {artifact.description || 'Ein magisches Artefakt aus deinem Abenteuer!'}
            </p>
            {artifact.storyEffect && (
              <p className="text-yellow-300/80 text-xs mt-1 italic line-clamp-1">
                ✨ {artifact.storyEffect}
              </p>
            )}
          </div>
        </div>
        
        {/* Footer hint */}
        <p className="text-purple-400/60 text-xs text-center mt-3">Tippe zum Schließen • Finde es in der Schatzkammer</p>
      </div>
    ),
    { duration: 8000 }
  );
};