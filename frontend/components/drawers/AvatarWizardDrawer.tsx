import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerTrigger } from '../ui/drawer';
import { ShadcnButton } from '../ui/shadcn-button';
import AvatarWizardScreen from '../../screens/Avatar/AvatarWizardScreen';

interface AvatarWizardDrawerProps {
  trigger?: React.ReactNode;
}

export function AvatarWizardDrawer({ trigger }: AvatarWizardDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <ShadcnButton>
            Neuer Avatar
          </ShadcnButton>
        )}
      </DrawerTrigger>
      <DrawerContent>
        <div className="h-full overflow-y-auto">
          <AvatarWizardScreen />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
