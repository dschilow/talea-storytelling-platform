import React from 'react';
import { toast } from 'sonner';
import { Alert, AlertIcon, AlertTitle, AlertIcons } from '../components/ui/Alert';
import { Brain, BookOpen, User, Sparkles, Trophy } from 'lucide-react';

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