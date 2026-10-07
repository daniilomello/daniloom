import { Clip } from "../types";
import {
  saveBlobToOPFS,
  getBlobFromOPFS,
  deleteBlobFromOPFS,
  clearOPFS,
} from "./opfsStorage";

const DB_NAME = "daniloom_db";
const STORE_NAME = "clips_store";
const CONFIG_STORE = "config_store";

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 4);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveClipToDB(clip: Clip): Promise<void> {
  try {
    // Transparently save binary payload to OPFS if supported for ultra-fast zero-RAM storage
    let storedInOPFS = false;
    if (clip.blob) {
      storedInOPFS = await saveBlobToOPFS(clip.id, clip.blob);
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const clipToStore = {
        id: clip.id,
        name: clip.name,
        // If saved to OPFS, store a lighter reference or backup blob
        blob: clip.blob,
        duration: clip.duration,
        createdAt: clip.createdAt,
        thumbnailUrl: clip.thumbnailUrl,
        format: clip.format || "landscape",
        storedInOPFS,
      };

      store.put(clipToStore);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB save error:", err);
  }
}

export async function getClipsFromDB(): Promise<Clip[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = async () => {
        const stored = request.result || [];
        const clips: Clip[] = await Promise.all(
          stored.map(async (item: any) => {
            let finalBlob = item.blob;
            if (item.storedInOPFS) {
              const opfsBlob = await getBlobFromOPFS(item.id, item.blob?.type);
              if (opfsBlob) {
                finalBlob = opfsBlob;
              }
            }
            return {
              id: item.id,
              name: item.name,
              blob: finalBlob,
              duration: item.duration,
              createdAt: new Date(item.createdAt),
              url: finalBlob ? URL.createObjectURL(finalBlob) : "",
              thumbnailUrl: item.thumbnailUrl,
              format: item.format || "landscape",
            };
          }),
        );
        resolve(clips);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB read error:", err);
    return [];
  }
}

export async function updateClipNameInDB(
  id: string,
  newName: string,
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) {
          item.name = newName;
          store.put(item);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB update clip name error:", err);
  }
}

export async function deleteClipFromDB(id: string): Promise<void> {
  try {
    await deleteBlobFromOPFS(id);
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB delete error:", err);
  }
}

export async function clearClipsDB(): Promise<void> {
  try {
    await clearOPFS();
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB clear error:", err);
  }
}

export async function saveConfigToDB(key: string, value: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CONFIG_STORE, "readwrite");
      const store = tx.objectStore(CONFIG_STORE);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB config save error:", err);
  }
}

export async function getConfigFromDB(key: string): Promise<any> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CONFIG_STORE, "readonly");
      const store = tx.objectStore(CONFIG_STORE);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB config read error:", err);
    return null;
  }
}
