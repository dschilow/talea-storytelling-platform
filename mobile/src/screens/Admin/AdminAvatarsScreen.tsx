import React from 'react';
import { Users } from 'lucide-react-native';
import { useBackend } from '@/api/backend';
import { PoolScreen } from './PoolScreen';
import { collectCursorPages } from '@/lib/pagination';

export function AdminAvatarsScreen() {
  const backend = useBackend();
  return <PoolScreen title="Alle Avatare" queryKey="admin-avatars" icon={<Users size={24} />} emptyTitle="Keine Avatare" emptyDescription="Es wurden noch keine Avatare angelegt." load={async () => {
    const avatars = await collectCursorPages<any>(async (cursor) => {
      const response = await backend.admin.listAvatarsAdmin({ cursor, limit: 100 });
      return { items: response.avatars, nextCursor: response.nextCursor };
    });
    return avatars.map((avatar) => ({ id: avatar.id, name: avatar.name, description: avatar.description, imageUrl: avatar.imageUrl, meta: avatar.userId, data: avatar }));
  }} save={(id, data) => backend.admin.updateAvatarAdmin({ ...data, id })} />;
}
