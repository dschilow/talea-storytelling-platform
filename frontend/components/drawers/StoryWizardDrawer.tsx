import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerContent, DrawerTrigger } from '../ui/drawer';
import { ShadcnButton } from '../ui/shadcn-button';
import ModernStoryWizard from '../../screens/Story/ModernStoryWizard';

interface StoryWizardDrawerProps {
  trigger?: React.ReactNode;
}

export function StoryWizardDrawer({ trigger }: StoryWizardDrawerProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <ShadcnButton>
            {t('story.create')}
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
