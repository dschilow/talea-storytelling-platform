import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { ResponsiveDrawer } from '../ui/responsive-drawer';
import { ShadcnButton } from '../ui/shadcn-button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface DokuConfig {
  topic: string;
  ageGroup: '3-5' | '6-8' | '9-12' | '13+';
  depth: 'basic' | 'standard' | 'deep';
  perspective: 'science' | 'history' | 'technology' | 'nature' | 'culture';
  length: 'short' | 'medium' | 'long';
}

interface DokuConfigDrawerProps {
  onSubmit: (config: DokuConfig) => void;
  trigger?: React.ReactNode;
}

export function DokuConfigDrawer({ onSubmit, trigger }: DokuConfigDrawerProps) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<DokuConfig>({
    topic: '',
    ageGroup: '6-8',
    depth: 'standard',
    perspective: 'science',
    length: 'medium',
  });

  const handleSubmit = () => {
    onSubmit(config);
    setOpen(false);
  };

  const defaultTrigger = (
    <ShadcnButton variant="default">
      <BookOpen className="mr-2 h-4 w-4" />
      Neue Doku erstellen
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
        disabled={!config.topic}
        className="flex-1"
      >
        Doku erstellen
      </ShadcnButton>
    </div>
  );

  return (
    <ResponsiveDrawer
      trigger={trigger || defaultTrigger}
      title="Doku Konfiguration"
      description="Erstelle eine neue Wissensdoku zu einem beliebigen Thema"
      open={open}
      onOpenChange={setOpen}
      footer={footer}
    >
      <div className="space-y-4">
        {/* Topic */}
        <div className="space-y-2">
          <Label htmlFor="topic">Thema</Label>
          <Input
            id="topic"
            placeholder="z.B. Dinosaurier, Weltall, Vulkane..."
            value={config.topic}
            onChange={(e) => setConfig({ ...config, topic: e.target.value })}
          />
        </div>

        {/* Perspective */}
        <div className="space-y-2">
          <Label htmlFor="perspective">Perspektive</Label>
          <select
            id="perspective"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={config.perspective}
            onChange={(e) => setConfig({ ...config, perspective: e.target.value as any })}
          >
            <option value="science">Wissenschaft</option>
            <option value="history">Geschichte</option>
            <option value="technology">Technologie</option>
            <option value="nature">Natur</option>
            <option value="culture">Kultur</option>
          </select>
        </div>

        {/* Depth */}
        <div className="space-y-2">
          <Label htmlFor="depth">Tiefe</Label>
          <select
            id="depth"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={config.depth}
            onChange={(e) => setConfig({ ...config, depth: e.target.value as any })}
          >
            <option value="basic">Grundlagen</option>
            <option value="standard">Standard</option>
            <option value="deep">Vertieft</option>
          </select>
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
            <option value="short">Kurz</option>
            <option value="medium">Mittel</option>
            <option value="long">Lang</option>
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
