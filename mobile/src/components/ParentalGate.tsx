import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { useBackend } from '@/api/backend';
import { useUserAccess } from '@/providers/UserAccessProvider';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

/** Parent authorization is held in memory only and expires on backgrounding. */
export function withParentalGate<P extends object>(Component: React.ComponentType<P>) {
  return function ParentalScreen(props: P) {
    const { hasParentalPin } = useUserAccess();
    const backend = useBackend();
    const [unlocked, setUnlocked] = useState(false);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
      const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') { setUnlocked(false); setPin(''); } });
      return () => subscription.remove();
    }, []);
    if (!hasParentalPin || unlocked) return <Component {...props} />;
    return <Screen><ScreenHeader title="Elternbereich" /><View style={{ gap: 16 }}>
      <Text>Bitte gib deine Eltern-PIN ein.</Text>
      <Input label="PIN" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={8} error={error || undefined} />
      <Button label="Entsperren" loading={busy} disabled={pin.length < 4} onPress={async () => {
        if (busy) return; setBusy(true); setError('');
        try { const result = await backend.user.verifyParentalPin({ pin }); if (!result.ok) throw new Error('PIN ist nicht korrekt.'); setPin(''); setUnlocked(true); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Prüfung fehlgeschlagen'); }
        finally { setBusy(false); }
      }} />
    </View></Screen>;
  };
}
