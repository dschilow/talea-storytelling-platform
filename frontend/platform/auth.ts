import { useEffect } from 'react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { isAndroidApp, nativeRequest } from './native';

/** Keep Clerk's existing buttons/forms, with OAuth in Android's system browser.
 * The sign-in attempt belongs to the WEB Clerk client. Reloading it with the
 * callback nonce completes that same client, so there is no token/cookie copy. */
export function useAndroidSSO(onMissingRequirements: (mode: 'signin' | 'signup') => void) {
  const { signIn, setActive } = useSignIn();
  const { signUp } = useSignUp();
  useEffect(() => {
    if (!isAndroidApp() || !signIn || !signUp) return;
    let busy = false;
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
      if (!target) return;
      const provider = target.className.match(/cl-socialButtons(?:Block|Icon)Button__(google|apple)\b/)?.[1];
      if (!provider) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (busy) return;
      busy = true; target.disabled = true; target.setAttribute('aria-busy', 'true');
      void (async () => {
        try {
          const attempt = await signIn.create({ strategy: provider === 'google' ? 'oauth_google' : 'oauth_apple', redirectUrl: 'talea://sso-callback' });
          const redirect = attempt.firstFactorVerification.externalVerificationRedirectURL;
          if (!redirect) throw new Error('Die Anmeldung konnte nicht gestartet werden.');
          const result = await nativeRequest<{ type: string; url?: string }>('oauth', { url: redirect.toString() }, 5 * 60_000);
          if (result.type !== 'success' || !result.url) return;
          const callback = new URL(result.url);
          if (callback.protocol !== 'talea:' || callback.hostname !== 'sso-callback') throw new Error('Ungültige Antwort bei der Anmeldung.');
          const verified = await attempt.reload({ rotatingTokenNonce: callback.searchParams.get('rotating_token_nonce') || '' });
          let session = verified.createdSessionId;
          if (verified.firstFactorVerification.status === 'transferable') {
            const registration = await signUp.create({ transfer: true });
            session = registration.createdSessionId;
          }
          if (session) await setActive({ session });
          else onMissingRequirements(verified.status === 'needs_second_factor' ? 'signin' : 'signup');
        } catch (error) {
          const clerkError = error as { errors?: Array<{ longMessage?: string; message?: string }> };
          const message = clerkError.errors?.[0]?.longMessage || clerkError.errors?.[0]?.message || (error instanceof Error ? error.message : 'Die Anmeldung konnte nicht abgeschlossen werden.');
          const { showErrorToast } = await import('../utils/toastUtils');
          showErrorToast(message);
        } finally { busy = false; target.disabled = false; target.removeAttribute('aria-busy'); }
      })();
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, [signIn, signUp, setActive, onMissingRequirements]);
}
