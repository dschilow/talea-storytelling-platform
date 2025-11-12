/**
 * DrawerExamples.tsx
 *
 * Beispiel-Implementierungen für responsive Drawer-Komponenten in der Talea App.
 * Diese Drawers erscheinen als Dialog auf Desktop und als Drawer auf Mobile.
 *
 * Usage:
 *
 * 1. Story Konfiguration:
 * ```tsx
 * import { StoryConfigDrawer } from '@/components/drawers/StoryConfigDrawer';
 *
 * function MyComponent() {
 *   const handleStoryConfig = (config) => {
 *     console.log('Story Config:', config);
 *     // API call to generate story
 *   };
 *
 *   return <StoryConfigDrawer onSubmit={handleStoryConfig} />;
 * }
 * ```
 *
 * 2. Avatar Konfiguration:
 * ```tsx
 * import { AvatarConfigDrawer } from '@/components/drawers/AvatarConfigDrawer';
 *
 * function MyComponent() {
 *   const handleAvatarConfig = (config) => {
 *     console.log('Avatar Config:', config);
 *     // API call to create avatar
 *   };
 *
 *   return <AvatarConfigDrawer onSubmit={handleAvatarConfig} />;
 * }
 * ```
 *
 * 3. Doku Konfiguration:
 * ```tsx
 * import { DokuConfigDrawer } from '@/components/drawers/DokuConfigDrawer';
 *
 * function MyComponent() {
 *   const handleDokuConfig = (config) => {
 *     console.log('Doku Config:', config);
 *     // API call to generate doku
 *   };
 *
 *   return <DokuConfigDrawer onSubmit={handleDokuConfig} />;
 * }
 * ```
 *
 * Custom Trigger Button:
 * ```tsx
 * <StoryConfigDrawer
 *   onSubmit={handleStoryConfig}
 *   trigger={<button>Mein Custom Button</button>}
 * />
 * ```
 */

import React from 'react';
import { StoryConfigDrawer } from './StoryConfigDrawer';
import { AvatarConfigDrawer } from './AvatarConfigDrawer';
import { DokuConfigDrawer } from './DokuConfigDrawer';

export function DrawerExamplesDemo() {
  const handleStoryConfig = (config: any) => {
    console.log('Story Config:', config);
    alert(`Story wird erstellt: ${config.genre} in ${config.setting}`);
  };

  const handleAvatarConfig = (config: any) => {
    console.log('Avatar Config:', config);
    alert(`Avatar wird erstellt: ${config.name} (${config.type})`);
  };

  const handleDokuConfig = (config: any) => {
    console.log('Doku Config:', config);
    alert(`Doku wird erstellt zum Thema: ${config.topic}`);
  };

  return (
    <div className="flex flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold mb-4">Drawer Examples</h1>

      <div className="flex flex-wrap gap-4">
        <StoryConfigDrawer onSubmit={handleStoryConfig} />
        <AvatarConfigDrawer onSubmit={handleAvatarConfig} />
        <DokuConfigDrawer onSubmit={handleDokuConfig} />
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Hinweise:</h2>
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>Auf Desktop (≥768px): Öffnet als zentrierter Dialog</li>
          <li>Auf Mobile (&lt;768px): Gleitet von unten als Drawer ein</li>
          <li>Alle Drawer haben validierte Submit-Buttons</li>
          <li>Custom Trigger Buttons können übergeben werden</li>
          <li>Responsive und barrierefrei</li>
        </ul>
      </div>
    </div>
  );
}

export default DrawerExamplesDemo;
