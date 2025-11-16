import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerTrigger } from '../ui/drawer';
import { ShadcnButton } from '../ui/shadcn-button';
import ModernStoryWizard from '../../screens/Story/ModernStoryWizard';

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
          <ModernStoryWizard />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
