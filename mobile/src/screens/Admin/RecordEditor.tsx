import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Sheet, type SheetRef } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';

/** Complete template editor; preserves optional and nested fields without loss. */
export function RecordEditor({ sheetRef, title, data, onSave }: {
  sheetRef: React.RefObject<SheetRef | null>; title: string; data: Record<string, unknown> | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const { spacing } = useTheme();
  const toast = useToast();
  const [json, setJson] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setJson(JSON.stringify(data ?? {}, null, 2)); }, [data]);
  return <Sheet ref={sheetRef} snapPoints={['90%']} title={title}>
    <View style={{ gap: spacing.base }}>
      <Text variant="bodySm">Alle Vorlagenfelder einschließlich Beschreibung, Bildprofil und Zuordnungen können als JSON bearbeitet werden.</Text>
      <Input label="Vorlage" value={json} onChangeText={setJson} multilineRows={20} autoCapitalize="none" autoCorrect={false} />
      <Button label="Speichern" loading={saving} onPress={async () => {
        if (saving) return;
        try {
          const parsed = JSON.parse(json);
          if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Bitte ein JSON-Objekt eingeben.');
          setSaving(true); await onSave(parsed); sheetRef.current?.close(); toast.success('Gespeichert');
        } catch (error) { toast.error('Speichern fehlgeschlagen', error instanceof Error ? error.message : undefined); }
        finally { setSaving(false); }
      }} />
    </View>
  </Sheet>;
}
