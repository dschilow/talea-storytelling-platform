import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ResponsiveDrawer } from '../ui/responsive-drawer';
import { ShadcnButton } from '../ui/shadcn-button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface StoryConfig {
  genre: string;
  setting: string;
  length: 'short' | 'medium' | 'long';
  ageGroup: '3-5' | '6-8' | '9-12' | '13+';
}

interface StoryConfigDrawerProps {
  onSubmit: (config: StoryConfig) => void;
  trigger?: React.ReactNode;
}

export function StoryConfigDrawer({ onSubmit, trigger }: StoryConfigDrawerProps) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<StoryConfig>({
    genre: '',
    setting: '',
    length: 'medium',
    ageGroup: '6-8',
  });

  const handleSubmit = () => {
    onSubmit(config);
    setOpen(false);
  };

  const defaultTrigger = (
    <ShadcnButton variant="default">
      <Sparkles className="mr-2 h-4 w-4" />
      Neue Story erstellen
    </ShadcnButton>
  );

  const footer = (
    <div className="flex gap-2 w-full">
      <ShadcnButton
        variant="outline"
        onClick={() => setOpen(false)}
        className="flex-1"
      >
        Abbrechen
      </ShadcnButton>
      <ShadcnButton
        onClick={handleSubmit}
        disabled={!config.genre || !config.setting}
        className="flex-1"
      >
        Story erstellen
      </ShadcnButton>
    </div>
  );

  return (
    <ResponsiveDrawer
      trigger={trigger || defaultTrigger}
      title="Story Konfiguration"
      description="Erstelle eine neue, personalisierte Story für deine Avatare"
      open={open}
      onOpenChange={setOpen}
      footer={footer}
    >
      <div className="space-y-4">
        {/* Genre */}
        <div className="space-y-2">
          <Label htmlFor="genre">Genre</Label>
          <Input
            id="genre"
            placeholder="z.B. Fantasy, Abenteuer, Märchen..."
            value={config.genre}
            onChange={(e) => setConfig({ ...config, genre: e.target.value })}
          />
        </div>

        {/* Setting */}
        <div className="space-y-2">
          <Label htmlFor="setting">Setting / Schauplatz</Label>
          <Input
            id="setting"
            placeholder="z.B. Verzauberter Wald, Weltraum..."
            value={config.setting}
            onChange={(e) => setConfig({ ...config, setting: e.target.value })}
          />
        </div>

        {/* Length */}
        <div className="space-y-2">
          <Label htmlFor="length">Länge</Label>
          <select
            id="length"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={config.length}
            onChange={(e) => setConfig({ ...config, length: e.target.value as any })}
          >
            <option value="short">Kurz (5-10 Min)</option>
            <option value="medium">Mittel (10-20 Min)</option>
            <option value="long">Lang (20-30 Min)</option>
          </select>
        </div>

        {/* Age Group */}
        <div className="space-y-2">
          <Label htmlFor="ageGroup">Altersgruppe</Label>
          <select
            id="ageGroup"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={config.ageGroup}
            onChange={(e) => setConfig({ ...config, ageGroup: e.target.value as any })}
          >
            <option value="3-5">3-5 Jahre</option>
            <option value="6-8">6-8 Jahre</option>
            <option value="9-12">9-12 Jahre</option>
            <option value="13+">13+ Jahre</option>
          </select>
        </div>
      </div>
    </ResponsiveDrawer>
  );
}
