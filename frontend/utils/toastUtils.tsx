import React from 'react';
import { toast } from 'sonner';
import { Alert, AlertIcon, AlertTitle, AlertIcons } from '../components/ui/Alert';
import { Brain, BookOpen, User, Sparkles, Trophy, Gift } from 'lucide-react';
import { InventoryItem } from '../types/avatar';

interface PersonalityToastOptions {
  title?: string;
  subtitle?: string;
  durationMs?: number;
}

export const showPersonalityUpdateToast = async (
  changes: Array<{ trait: string; change: number }>,
  options: PersonalityToastOptions = {}
) => {
  const { getTraitLabel, getTraitIcon, getSubcategoryLabel, getSubcategoryIcon } = await import('../constants/traits');

  const totalChanges = changes.reduce((sum, change) => sum + Math.abs(change.change), 0);
  const title = options.title || `Persoenlichkeit entwickelt sich: ${totalChanges} Punkte`;
  const subtitle = options.subtitle || 'Die Werte wurden nach deinem letzten Inhalt aktualisiert.';

  const formattedChanges = changes.map((change) => {
    let label: string;
    let icon: string;

    if (change.trait.includes('.')) {
      const [, subcategory] = change.trait.split('.');
      label = getSubcategoryLabel(subcategory, 'de');
      icon = getSubcategoryIcon(subcategory);
    } else {
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
          <AlertTitle>{title}</AlertTitle>
          <p className="mt-1 text-xs text-gray-600">{subtitle}</p>
          <div className="mt-2 space-y-1 text-xs">
            {formattedChanges.map((change, index) => (
              <div key={`${change.label}-${index}`} className="flex items-center gap-2">
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
    { duration: options.durationMs || 8000 }
  );
};

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

export const showQuizCompletionToast = (score: number) => {
  const isGoodScore = score >= 70;

  toast.custom(
    (t) => (
      <Alert variant={isGoodScore ? 'success' : 'info'} onClose={() => toast.dismiss(t)}>
        <AlertIcon>
          <Trophy className={`h-5 w-5 ${isGoodScore ? 'text-green-600' : 'text-stone-600'}`} />
        </AlertIcon>
        <AlertTitle>Quiz abgeschlossen: {score}% richtig!</AlertTitle>
      </Alert>
    ),
    { duration: 4000 }
  );
};

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

export const showNewCharacterToast = (characterNames: string) => {
  toast.custom(
    (t) => (
      <Alert variant="success" onClose={() => toast.dismiss(t)}>
        <AlertIcon>
          <Sparkles className="w-5 h-5 text-amber-600" />
        </AlertIcon>
        <div>
          <AlertTitle>Neue Freunde gefunden!</AlertTitle>
          <p className="mt-1 text-sm text-gray-600">
            Passend zur Geschichte wurden neue Charaktere erstellt: <strong>{characterNames}</strong>
          </p>
        </div>
      </Alert>
    ),
    { duration: 6000 }
  );
};

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

export const showArtifactEarnedToast = (artifact: InventoryItem, avatarName?: string, isUpgrade?: boolean) => {
  const headerText = isUpgrade
    ? `Artefakt verstaerkt! (Stufe ${artifact.level})`
    : 'Neues Artefakt erhalten!';

  const headerColor = isUpgrade ? 'text-emerald-400' : 'text-yellow-400';
  const headerBgColor = isUpgrade ? 'bg-emerald-500/20' : 'bg-yellow-500/20';

  toast.custom(
    (t) => (
      <div
        className="max-w-md cursor-pointer rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-900 via-stone-900 to-amber-900 p-4 shadow-2xl"
        onClick={() => toast.dismiss(t)}
      >
        <div className="mb-3 flex items-center gap-2">
          <div className={`rounded-full p-1.5 ${headerBgColor}`}>
            <Gift className={`h-5 w-5 ${headerColor}`} />
          </div>
          <span className={`${headerColor} text-sm font-bold`}>{headerText}</span>
        </div>

        <div className="flex gap-3">
          {artifact.imageUrl && (
            <div className="flex-shrink-0">
              <div className="h-24 w-24 overflow-hidden rounded-lg border-2 border-amber-400/50 shadow-lg">
                <img
                  src={artifact.imageUrl}
                  alt={artifact.name}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h4 className="truncate text-base font-bold text-white">{artifact.name}</h4>
            {avatarName && (
              <p className="mb-1 text-xs text-amber-300">fuer {avatarName}</p>
            )}
            <p className="line-clamp-2 text-xs text-amber-200">
              {artifact.description || 'Ein magisches Artefakt aus deinem Abenteuer!'}
            </p>
            {artifact.storyEffect && (
              <p className="mt-1 line-clamp-1 text-xs italic text-yellow-300/80">
                * {artifact.storyEffect}
              </p>
            )}
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-amber-400/60">Tippe zum Schliessen - Finde es in der Schatzkammer</p>
      </div>
    ),
    { duration: 8000 }
  );
};

