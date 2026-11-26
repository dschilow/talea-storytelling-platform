import React from 'react';
import { Toaster } from 'sonner';
import { AlertTriangle, CircleAlert, CircleCheck, Info, LoaderCircle } from 'lucide-react';

const iconClass = 'h-[19px] w-[19px]';

/**
 * One toast look for the whole app (online and offline shell): the warm card of
 * the Talea surfaces with a coloured icon instead of sonner's saturated "rich"
 * green and red blocks. Styling lives in index.css (`.talea-toaster`).
 */
export const TaleaToaster: React.FC = () => (
  <Toaster
    className="talea-toaster"
    position="top-right"
    closeButton
    gap={10}
    // Below the top bar, so the bell and the profile button stay visible.
    offset={{ top: 'calc(env(safe-area-inset-top) + 64px)', right: 20 }}
    mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 10px)', left: 12, right: 12 }}
    icons={{
      success: <CircleCheck className={iconClass} strokeWidth={2.2} />,
      error: <CircleAlert className={iconClass} strokeWidth={2.2} />,
      warning: <AlertTriangle className={iconClass} strokeWidth={2.2} />,
      info: <Info className={iconClass} strokeWidth={2.2} />,
      loading: <LoaderCircle className={`${iconClass} motion-safe:animate-spin`} strokeWidth={2.2} />,
    }}
    toastOptions={{ duration: 4500 }}
  />
);

export default TaleaToaster;
