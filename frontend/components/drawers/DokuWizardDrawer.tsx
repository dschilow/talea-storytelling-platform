import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerContent, DrawerTrigger } from '../ui/drawer';
import { ShadcnButton } from '../ui/shadcn-button';
import DokuWizardScreen from '../../screens/Doku/DokuWizardScreen';

interface DokuWizardDrawerProps {
  trigger?: React.ReactNode;
}

export function DokuWizardDrawer({ trigger }: DokuWizardDrawerProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <ShadcnButton>
            {t('navigation.createDoku')}
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
