const DB_NAME = 'talea-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio';
const MAX_ENTRIES = 200;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedAudio {
  id: string;
  data: ArrayBuffer;
  mimeType: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedAudio(id: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        const entry = req.result as CachedAudio | undefined;
        if (!entry) {
          resolve(null);
          return;
        }
        if (Date.now() - entry.createdAt > MAX_AGE_MS) {
          // expired — delete and return null
          const delTx = db.transaction(STORE_NAME, 'readwrite');
          delTx.objectStore(STORE_NAME).delete(id);
          resolve(null);
          return;
        }
        const blob = new Blob([entry.data], { type: entry.mimeType });
        resolve(URL.createObjectURL(blob));
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function cacheAudio(id: string, base64DataUrl: string): Promise<void> {
  try {
    const res = await fetch(base64DataUrl);
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();

    const db = await openDB();

    // Evict old entries if over limit
    await evictOldEntries(db);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        id,
        data: arrayBuffer,
        mimeType: blob.type || 'audio/mpeg',
        createdAt: Date.now(),
      } satisfies CachedAudio);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // silently fail — caching is best-effort
  }
}

async function evictOldEntries(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('createdAt');
    const countReq = store.count();

    countReq.onsuccess = () => {
      const count = countReq.result;
      if (count < MAX_ENTRIES) {
        resolve();
        return;
      }

      // Delete oldest entries to get below limit
      const toDelete = count - MAX_ENTRIES + 20; // delete 20 extra for headroom
      let deleted = 0;
      const cursor = index.openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c && deleted < toDelete) {
          c.delete();
          deleted++;
          c.continue();
        } else {
          resolve();
        }
      };
      cursor.onerror = () => resolve();
    };
    countReq.onerror = () => resolve();
  });
}

export async function clearAudioCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // silently fail
  }
}
