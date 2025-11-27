import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerContent, DrawerTrigger } from '../ui/drawer';
import { ShadcnButton } from '../ui/shadcn-button';
import AvatarWizardScreen from '../../screens/Avatar/AvatarWizardScreen';

interface AvatarWizardDrawerProps {
  trigger?: React.ReactNode;
}

export function AvatarWizardDrawer({ trigger }: AvatarWizardDrawerProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <ShadcnButton>
            {t('avatar.createNew')}
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
