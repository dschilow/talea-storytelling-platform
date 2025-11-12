import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerTrigger } from '../ui/drawer';
import { ShadcnButton } from '../ui/shadcn-button';
import DokuWizardScreen from '../../screens/Doku/DokuWizardScreen';

interface DokuWizardDrawerProps {
  trigger?: React.ReactNode;
}

export function DokuWizardDrawer({ trigger }: DokuWizardDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <ShadcnButton>
            Neue Doku
          </ShadcnButton>
        )}
      </DrawerTrigger>
      <DrawerContent>
        <div className="h-full overflow-y-auto">
          <DokuWizardScreen />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
