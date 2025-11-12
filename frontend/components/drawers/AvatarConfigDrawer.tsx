import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { ResponsiveDrawer } from '../ui/responsive-drawer';
import { ShadcnButton } from '../ui/shadcn-button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface AvatarConfig {
  name: string;
  type: string;
  age: number;
  gender: string;
}

interface AvatarConfigDrawerProps {
  onSubmit: (config: AvatarConfig) => void;
  trigger?: React.ReactNode;
}

export function AvatarConfigDrawer({ onSubmit, trigger }: AvatarConfigDrawerProps) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<AvatarConfig>({
    name: '',
    type: '',
    age: 8,
    gender: '',
  });

  const handleSubmit = () => {
    onSubmit(config);
    setOpen(false);
    // Reset form
    setConfig({
      name: '',
      type: '',
      age: 8,
      gender: '',
    });
  };

  const defaultTrigger = (
    <ShadcnButton variant="default">
      <Plus className="mr-2 h-4 w-4" />
      Neuer Avatar
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
        disabled={!config.name || !config.type}
        className="flex-1"
      >
        Avatar erstellen
      </ShadcnButton>
    </div>
  );

  return (
    <ResponsiveDrawer
      trigger={trigger || defaultTrigger}
      title="Avatar Konfiguration"
      description="Erstelle einen neuen Avatar mit einzigartiger Persönlichkeit"
      open={open}
      onOpenChange={setOpen}
      footer={footer}
    >
      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="z.B. Luna, Max, Elara..."
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
          />
        </div>

        {/* Type */}
        <div className="space-y-2">
          <Label htmlFor="type">Typ / Wesen</Label>
          <Input
            id="type"
            placeholder="z.B. Mensch, Elfe, Roboter..."
            value={config.type}
            onChange={(e) => setConfig({ ...config, type: e.target.value })}
          />
        </div>

        {/* Age */}
        <div className="space-y-2">
          <Label htmlFor="age">Alter</Label>
          <Input
            id="age"
            type="number"
            min={1}
            max={100}
            value={config.age}
            onChange={(e) => setConfig({ ...config, age: parseInt(e.target.value) || 8 })}
          />
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <Label htmlFor="gender">Geschlecht</Label>
          <select
            id="gender"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={config.gender}
            onChange={(e) => setConfig({ ...config, gender: e.target.value })}
          >
            <option value="">Bitte wählen...</option>
            <option value="male">Männlich</option>
            <option value="female">Weiblich</option>
            <option value="non-binary">Nicht-binär</option>
            <option value="other">Andere</option>
          </select>
        </div>
      </div>
    </ResponsiveDrawer>
  );
}
