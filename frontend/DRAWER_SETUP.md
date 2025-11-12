# Drawer Component Setup & Usage Guide

## Overview

Das Drawer-System wurde erfolgreich in die Talea App integriert! Anstatt separate Seiten zu laden, erscheint jetzt ein eleganter Drawer (auf Mobile) oder Dialog (auf Desktop) für die Konfiguration von Stories, Avataren und Dokus.

## 🎯 Was wurde installiert?

### Dependencies

```json
{
  "vaul": "^1.1.2",                          // Drawer primitive
  "@radix-ui/react-slot": "^1.2.4",          // Composability
  "@radix-ui/react-dialog": "^1.1.15",       // Dialog primitive
  "@radix-ui/react-label": "^2.1.8",         // Label component
  "class-variance-authority": "^0.7.1",      // CVA für variants
  "clsx": "^2.1.1",                          // Classname utility
  "tailwind-merge": "^3.4.0"                 // Tailwind merge utility
}
```

### Neue Komponenten

```
frontend/
├── components/
│   ├── ui/
│   │   ├── drawer.tsx                    // Base Drawer component
│   │   ├── dialog.tsx                    // Base Dialog component
│   │   ├── responsive-drawer.tsx         // Smart responsive wrapper
│   │   ├── shadcn-button.tsx            // Shadcn-style button mit asChild
│   │   ├── input.tsx                     // Input field
│   │   └── label.tsx                     // Label component
│   └── drawers/
│       ├── StoryConfigDrawer.tsx         // Story Konfiguration
│       ├── AvatarConfigDrawer.tsx        // Avatar Konfiguration
│       ├── DokuConfigDrawer.tsx          // Doku Konfiguration
│       └── DrawerExamples.tsx            // Usage examples & docs
├── hooks/
│   └── use-media-query.ts                // Media query hook
└── lib/
    └── utils.ts                          // Enhanced mit clsx + twMerge
```

## 📱 Responsive Behavior

- **Desktop (≥768px)**: Öffnet als zentrierter Dialog (Modal)
- **Mobile (<768px)**: Gleitet von unten als Drawer ein
- Automatische Erkennung über `useMediaQuery` Hook

## 🚀 Quick Start

### 1. Story Konfiguration

```tsx
import { StoryConfigDrawer } from '@/components/drawers/StoryConfigDrawer';

function StoriesScreen() {
  const handleStoryConfig = async (config) => {
    console.log('Creating story with config:', config);
    // API call to backend
    await backend.story.generate({ ...config });
  };

  return (
    <div>
      <h1>Meine Stories</h1>
      <StoryConfigDrawer onSubmit={handleStoryConfig} />
    </div>
  );
}
```

### 2. Avatar Konfiguration

```tsx
import { AvatarConfigDrawer } from '@/components/drawers/AvatarConfigDrawer';

function AvatarsScreen() {
  const handleAvatarConfig = async (config) => {
    console.log('Creating avatar with config:', config);
    // API call to backend
    await backend.avatar.createAvatar({ ...config });
  };

  return (
    <div>
      <h1>Meine Avatare</h1>
      <AvatarConfigDrawer onSubmit={handleAvatarConfig} />
    </div>
  );
}
```

### 3. Doku Konfiguration

```tsx
import { DokuConfigDrawer } from '@/components/drawers/DokuConfigDrawer';

function DokusScreen() {
  const handleDokuConfig = async (config) => {
    console.log('Creating doku with config:', config);
    // API call to backend
    await backend.doku.generateDoku({ ...config });
  };

  return (
    <div>
      <h1>Meine Dokus</h1>
      <DokuConfigDrawer onSubmit={handleDokuConfig} />
    </div>
  );
}
```

### 4. Custom Trigger Button

```tsx
<StoryConfigDrawer
  onSubmit={handleConfig}
  trigger={
    <button className="custom-button">
      Mein eigener Button
    </button>
  }
/>
```

## 🎨 Creating Custom Drawers

Du kannst eigene Drawer-Komponenten mit `ResponsiveDrawer` erstellen:

```tsx
import { ResponsiveDrawer } from '@/components/ui/responsive-drawer';
import { ShadcnButton } from '@/components/ui/shadcn-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function MyCustomDrawer({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ name: '' });

  const handleSubmit = () => {
    onSubmit(data);
    setOpen(false);
  };

  const footer = (
    <div className="flex gap-2 w-full">
      <ShadcnButton variant="outline" onClick={() => setOpen(false)}>
        Abbrechen
      </ShadcnButton>
      <ShadcnButton onClick={handleSubmit}>
        Speichern
      </ShadcnButton>
    </div>
  );

  return (
    <ResponsiveDrawer
      trigger={<ShadcnButton>Öffnen</ShadcnButton>}
      title="Mein Custom Drawer"
      description="Optionale Beschreibung"
      open={open}
      onOpenChange={setOpen}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={data.name}
            onChange={(e) => setData({ name: e.target.value })}
          />
        </div>
      </div>
    </ResponsiveDrawer>
  );
}
```

## 🎯 Integration in bestehende Screens

### Beispiel: [StoriesScreen.tsx](../screens/Story/StoriesScreen.tsx)

**Vorher:**
```tsx
<Button onClick={() => navigate('/story/wizard')}>
  Neue Story
</Button>
```

**Nachher:**
```tsx
import { StoryConfigDrawer } from '@/components/drawers/StoryConfigDrawer';

<StoryConfigDrawer onSubmit={handleStoryConfig} />
```

### Beispiel: [AvatarsScreen.tsx](../screens/Avatar/AvatarsScreen.tsx)

**Vorher:**
```tsx
<Button onClick={() => navigate('/avatar/wizard')}>
  Neuer Avatar
</Button>
```

**Nachher:**
```tsx
import { AvatarConfigDrawer } from '@/components/drawers/AvatarConfigDrawer';

<AvatarConfigDrawer onSubmit={handleAvatarConfig} />
```

## 🔧 Advanced Usage

### Controlled Open State

```tsx
const [isOpen, setIsOpen] = useState(false);

<ResponsiveDrawer
  open={isOpen}
  onOpenChange={setIsOpen}
  trigger={<button onClick={() => setIsOpen(true)}>Open</button>}
  // ...
/>
```

### Custom Styling

```tsx
<ResponsiveDrawer
  trigger={<ShadcnButton className="my-custom-class">Open</ShadcnButton>}
  // ...
>
  <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500">
    Custom styled content
  </div>
</ResponsiveDrawer>
```

## 📝 Component API Reference

### ResponsiveDrawer Props

```typescript
interface ResponsiveDrawerProps {
  children: React.ReactNode;        // Drawer content
  trigger: React.ReactNode;         // Button/element that opens drawer
  title: string;                    // Header title
  description?: string;             // Optional description
  open?: boolean;                   // Controlled open state
  onOpenChange?: (open: boolean) => void; // Open state change handler
  footer?: React.ReactNode;         // Optional footer content
}
```

### ShadcnButton Props

```typescript
interface ShadcnButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;                // Use Slot for composition
  // ...standard button props
}
```

## 🎨 Styling Guide

Die Drawer-Komponenten verwenden deine Tailwind-Konfiguration:

```css
/* Anpassbare CSS-Variablen */
--background: ...
--foreground: ...
--primary: ...
--border: ...
--input: ...
--ring: ...
--muted: ...
```

## 🔍 Troubleshooting

### Drawer öffnet nicht

- Prüfe, ob `open` und `onOpenChange` korrekt gesetzt sind
- Stelle sicher, dass `trigger` ein gültiges React-Element ist

### Styling Issues

- Stelle sicher, dass Tailwind CSS v4 korrekt konfiguriert ist
- Prüfe, ob `@/lib/utils` korrekt importiert wird

### TypeScript Errors

- Alle Typen sind vollständig definiert
- Nutze `as any` nur im Notfall für temporäre Fixes

## 📚 Further Reading

- [Vaul Documentation](https://vaul.emilkowal.ski/)
- [Radix UI Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)
- [shadcn/ui Drawer](https://ui.shadcn.com/docs/components/drawer)

## 🎉 Next Steps

1. **Integration in bestehende Screens**: Ersetze Navigation-Calls durch Drawer-Komponenten
2. **Extended Configuration**: Füge mehr Felder zu den Config-Drawers hinzu
3. **Validation**: Implementiere Form-Validation (z.B. mit Zod)
4. **Loading States**: Zeige Loading-Spinner während API-Calls
5. **Error Handling**: Zeige Fehlermeldungen im Drawer

Viel Erfolg! 🚀
