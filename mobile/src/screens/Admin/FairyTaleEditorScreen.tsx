import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useBackend } from '@/api/backend';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import type { SheetRef } from '@/components/ui/Sheet';
import { RecordEditor } from './RecordEditor';
import type { RootStackParamList } from '@/navigation/types';

export function FairyTaleEditorScreen() {
  const { params: { taleId } } = useRoute<RouteProp<RootStackParamList, 'FairyTaleEditor'>>();
  const backend = useBackend(); const toast = useToast(); const editor = useRef<SheetRef>(null);
  const [editing, setEditing] = useState<{ kind: 'role' | 'scene'; id?: number; data: Record<string, unknown> } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'role' | 'scene'; id: number } | null>(null);
  const tale = useQuery({ queryKey: ['admin-fairy-tale', taleId], queryFn: () => backend.fairytales.getFairyTale({ id: taleId, includeRoles: true, includeScenes: true }) });
  const open = (kind: 'role' | 'scene', data: any, id?: number) => { setEditing({ kind, data, id }); editor.current?.expand(); };
  return <Screen><ScreenHeader title={tale.data?.tale.title ?? 'Märchenstruktur'} /><View style={{ gap: 16 }}>
    {tale.isError ? <Button label="Erneut laden" onPress={() => void tale.refetch()} /> : null}
    <Text variant="headingMd">Rollen</Text><Button label="Rolle hinzufügen" onPress={() => open('role', { roleType: 'supporting', roleName: '', roleCount: 1, description: '', required: true, professionPreference: [], speciesRequirement: 'any', genderRequirement: 'any', ageRequirement: 'any', sizeRequirement: 'any', socialClassRequirement: 'any' })} />
    {tale.data?.roles?.map((role: any) => <Card key={role.id}><View style={{ gap: 8 }}><Text variant="label">{role.roleName || role.roleType}</Text><Text>{role.description}</Text><Button label="Rolle bearbeiten" variant="secondary" onPress={() => open('role', role, role.id)} /><Button label="Rolle löschen" variant="ghost" onPress={() => setPendingDelete({ kind: 'role', id: role.id })} /></View></Card>)}
    <Text variant="headingMd">Szenen</Text><Button label="Szene hinzufügen" onPress={() => open('scene', { sceneNumber: (tale.data?.scenes?.length ?? 0) + 1, sceneTitle: '', sceneDescription: '', dialogueTemplate: '', characterVariables: {}, setting: '', mood: '', illustrationPromptTemplate: '', durationSeconds: 60 })} />
    {tale.data?.scenes?.map((scene: any, index: number) => <Card key={scene.id}><View style={{ gap: 8 }}><Text variant="label">{scene.sceneNumber}. {scene.sceneTitle}</Text><Text>{scene.sceneDescription}</Text><Button label="Szene bearbeiten" variant="secondary" onPress={() => open('scene', scene, scene.id)} />{index > 0 ? <Button label="Eine Position nach oben" variant="secondary" onPress={async () => { try { const reordered = [...tale.data.scenes]; [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]; await backend.fairytales.reorderScenes({ taleId, sceneOrdering: reordered.map((entry, i) => ({ sceneId: entry.id, newSceneNumber: i + 1 })) }); await tale.refetch(); } catch (error) { toast.error('Reihenfolge nicht gespeichert'); } }} /> : null}<Button label="Szene löschen" variant="ghost" onPress={() => setPendingDelete({ kind: 'scene', id: scene.id })} /></View></Card>)}
  </View><RecordEditor sheetRef={editor} title={editing?.kind === 'role' ? 'Rolle bearbeiten' : 'Szene bearbeiten'} data={editing?.data ?? null} onSave={async (data) => {
    if (!editing) return;
    if (editing.kind === 'role') { if (editing.id != null) await backend.fairytales.updateRole({ taleId, roleId: editing.id, updates: data }); else await backend.fairytales.addFairyTaleRole({ taleId, role: data }); }
    else { if (editing.id != null) await backend.fairytales.updateScene({ taleId, sceneId: editing.id, updates: data }); else await backend.fairytales.addFairyTaleScene({ taleId, scene: data }); }
    await tale.refetch();
  }} /><ConfirmSheet open={Boolean(pendingDelete)} title="Eintrag löschen?" message="Dieser Eintrag wird dauerhaft aus dem Märchen entfernt." destructive confirmLabel="Löschen" onCancel={() => setPendingDelete(null)} onConfirm={async () => {
    if (!pendingDelete) return; try { if (pendingDelete.kind === 'role') await backend.fairytales.deleteRole({ taleId, roleId: pendingDelete.id }); else await backend.fairytales.deleteScene({ taleId, sceneId: pendingDelete.id }); setPendingDelete(null); await tale.refetch(); } catch (error) { toast.error('Löschen fehlgeschlagen'); }
  }} /></Screen>;
}
