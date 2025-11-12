import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerTrigger } from '../ui/drawer';
import { ShadcnButton } from '../ui/shadcn-button';
import StoryWizardScreen from '../../screens/Story/StoryWizardScreen';

interface StoryWizardDrawerProps {
  trigger?: React.ReactNode;
}

export function StoryWizardDrawer({ trigger }: StoryWizardDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <ShadcnButton>
            Neue Geschichte erstellen
          </ShadcnButton>
        )}
      </DrawerTrigger>
      <DrawerContent>
        <div className="h-full overflow-y-auto">
          <StoryWizardScreen />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
