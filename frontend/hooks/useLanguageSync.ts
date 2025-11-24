import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@clerk/clerk-react';
import { useBackend } from './useBackend';
import { SupportedLanguage } from '../src/i18n';

export function useLanguageSync() {
    const { i18n } = useTranslation();
    const { user, isLoaded } = useUser();
    const backend = useBackend();

    useEffect(() => {
        const syncLanguage = async () => {
            if (isLoaded && user) {
                try {
                    // 1. Try to get language from backend profile
                    const profile = await backend.user.me();
                    if (profile.preferredLanguage) {
                        const backendLang = profile.preferredLanguage as SupportedLanguage;

                        // Only update if different to avoid loops/flicker
                        if (i18n.language !== backendLang) {
                            console.log(`Syncing language from backend: ${backendLang}`);
                            await i18n.changeLanguage(backendLang);
                            localStorage.setItem('talea_language', backendLang);
                        }
                    } else {
                        // 2. If no backend language, maybe sync current local language TO backend?
                        // For now, just ensure local storage matches current i18n
                        if (i18n.language) {
                            localStorage.setItem('talea_language', i18n.language);
                        }
                    }
                } catch (error) {
                    console.error('Failed to sync language:', error);
                }
            }
        };

        syncLanguage();
    }, [isLoaded, user, backend, i18n]);
}
