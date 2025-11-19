# Frontend Toast-Benachrichtigung für neue Charaktere

## Status: Bereit zur Implementierung

Das Backend sendet bereits `newlyGeneratedCharacters` im Story-Response. Die Frontend-Integration kann jetzt implementiert werden.

## Backend-Implementation (✅ Bereits fertig)

Die Story-Generierung gibt jetzt folgende Daten zurück:

```typescript
{
  // ... normale Story-Daten
  newlyGeneratedCharacters: [
    {
      id: string,
      name: string,
      role: string,
      species: string,
      gender: string
    }
  ]
}
```

Siehe: `backend/story/four-phase-orchestrator.ts` Zeile 307-319 und 562

## Frontend-Implementation (⏳ TODO)

### Schritt 1: Story-Type erweitern

In `frontend/src/client/story.ts` (oder wo die Story-Types sind):

```typescript
export interface Story {
  // ... existing fields
  newlyGeneratedCharacters?: Array<{
    id: string;
    name: string;
    role: string;
    species: string;
    gender: string;
  }>;
}
```

### Schritt 2: React Hook erstellen

Datei: `frontend/src/hooks/useNewCharacterNotification.ts`

```typescript
import { useEffect } from 'react';
import { toast } from 'react-toastify'; // oder dein Toast-System

export function useNewCharacterNotification(story: Story | null) {
  useEffect(() => {
    if (!story || !story.newlyGeneratedCharacters) return;

    const newChars = story.newlyGeneratedCharacters;

    if (newChars.length === 0) return;

    // Zeige Toast-Benachrichtigung
    if (newChars.length === 1) {
      toast.success(
        `🎭 Neuer Charakter "${newChars[0].name}" wurde zum Pool hinzugefügt!`,
        {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
        }
      );
    } else {
      toast.success(
        `🎭 ${newChars.length} neue Charaktere zum Pool hinzugefügt: ${newChars.map(c => c.name).join(', ')}`,
        {
          position: 'top-right',
          autoClose: 7000,
          hideProgressBar: false,
        }
      );
    }
  }, [story]);
}
```

### Schritt 3: Hook in Story Reader integrieren

Datei: `frontend/src/screens/Story/StoryReader.tsx` (oder ähnlich)

```typescript
import { useNewCharacterNotification } from '../../hooks/useNewCharacterNotification';

function StoryReader() {
  const { story, loading } = useStoryData();

  // Automatische Benachrichtigung für neue Charaktere
  useNewCharacterNotification(story);

  return (
    // ... existing JSX
  );
}
```

### Schritt 4: Toast-System prüfen

Stelle sicher, dass ein Toast-System installiert ist:

```bash
cd frontend
bun add react-toastify

# oder falls ein anderes Toast-System genutzt wird:
# bun add sonner
# bun add react-hot-toast
```

Und in `main.tsx` oder `App.tsx`:

```typescript
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <>
      <YourApp />
      <ToastContainer />
    </>
  );
}
```

## Alternativ: Detaillierte Character-Info anzeigen

Statt nur Toast, kann auch eine Modal oder Banner mit Details angezeigt werden:

```typescript
// Komponente: NewCharacterBanner.tsx
export function NewCharacterBanner({ characters }: { characters: NewCharacter[] }) {
  const [show, setShow] = useState(true);

  if (!show || characters.length === 0) return null;

  return (
    <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          🎭
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-purple-800">
            Neue Charaktere hinzugefügt!
          </p>
          <div className="mt-2 text-sm text-purple-700">
            <ul className="list-disc list-inside">
              {characters.map(char => (
                <li key={char.id}>
                  <strong>{char.name}</strong> ({char.species}, {char.role})
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <button
              onClick={() => setShow(false)}
              className="text-sm font-medium text-purple-800 hover:text-purple-900"
            >
              Verstanden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Testing

Nach der Implementation:

1. Generiere eine Story mit Genre "Klassische Märchen"
2. Warte bis Story fertig ist
3. Überprüfe ob Toast-Notification erscheint
4. Überprüfe Console Logs für `newlyGeneratedCharacters`

## Backend-Log-Meldungen

Die Backend-Logs zeigen bereits:
- `[Phase2] ✨ Generating SMART character: {name} ({species}, {gender})`
- Die generierten Charaktere werden automatisch im Pool gespeichert

## Status

- ✅ Backend sendet `newlyGeneratedCharacters` im Response
- ✅ Charaktere werden automatisch zum Pool hinzugefügt
- ⏳ Frontend-Integration steht noch aus
- ⏳ Toast-Benachrichtigung muss implementiert werden

## Nächste Schritte

1. Frontend-Developer implementiert useNewCharacterNotification Hook
2. Hook in StoryReader einbinden
3. Toast-System konfigurieren
4. Testen mit echten Story-Generierungen
