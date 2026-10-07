import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { ALIBI_CHARACTERS } from '../../../../../frontend/screens/Game/alibi/data/characters';

export interface PoolEntry { name: string; imageUrl?: string; isActive?: boolean }
const POOL_KEY = 'talea.alibi.pool.v1';
const normalize = (name: string) => name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
const names = new Set(ALIBI_CHARACTERS.map(c => c.key));

/** Cache the actual pool portraits; never substitute unrelated placeholder faces. */
export async function loadAlibiPool(load: () => Promise<{ characters: PoolEntry[] }>): Promise<{ characters: PoolEntry[] }> {
  const saved = await AsyncStorage.getItem(POOL_KEY);
  try {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const response = await Promise.race([load(), new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Der Charakter-Pool antwortet nicht.')), 12_000);
    })]).finally(() => clearTimeout(timeout));
    const selected = response.characters.filter(c => names.has(normalize(c.name)) && c.imageUrl);
    if (new Set(selected.map(c => normalize(c.name))).size < 8) throw new Error('Zu wenige Figuren mit Bild im Pool');
    const dir = `${FileSystem.documentDirectory}alibi-portraits/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const local = await Promise.all(selected.map(async c => {
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, c.imageUrl!);
      const target = `${dir}${hash}.img`;
      const info = await FileSystem.getInfoAsync(target);
      return info.exists && info.size > 0 ? { ...c, imageUrl: target } : c;
    }));
    await AsyncStorage.setItem(POOL_KEY, JSON.stringify(local));
    // Portrait downloads do not delay the launcher. Next launches use the local
    // files, including when the backend is offline. Refresh with bounded workers.
    void (async () => {
      const result: PoolEntry[] = [];
      for (let offset = 0; offset < selected.length; offset += 6) {
        const batch = await Promise.all(selected.slice(offset, offset + 6).map(async c => {
          const imageUrl = c.imageUrl!;
          if (!/^https:\/\//i.test(imageUrl)) return c;
          const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, imageUrl);
          const target = `${dir}${hash}.img`;
          const info = await FileSystem.getInfoAsync(target);
          if (info.exists && info.size > 0) return { ...c, imageUrl: target };
          try {
            const downloaded = await FileSystem.downloadAsync(imageUrl, target);
            if (downloaded.status !== 200) { await FileSystem.deleteAsync(target, { idempotent: true }); return c; }
            return { ...c, imageUrl: downloaded.uri };
          } catch { return c; }
        }));
        result.push(...batch);
        // Save partial progress too: a killed process need not fetch these again.
        await AsyncStorage.setItem(POOL_KEY, JSON.stringify(result.concat(local.slice(result.length))));
      }
    })().catch(() => undefined);
    return { characters: local };
  } catch (error) {
    if (saved) {
      try {
        const cached: PoolEntry[] = JSON.parse(saved);
        const usable = (await Promise.all(cached.map(async c => ({ c, ok: c.imageUrl?.startsWith('file://') && (await FileSystem.getInfoAsync(c.imageUrl)).exists })))).filter(x => x.ok).map(x => x.c);
        if (new Set(usable.map(c => normalize(c.name))).size >= 8) return { characters: usable };
      } catch { /* A corrupt cache must not hide an actionable retry. */ }
    }
    throw error;
  }
}
