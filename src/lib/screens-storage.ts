const DB_NAME = "app-screens-db";
const DB_VERSION = 1;
const STORE = "kv";
const KEY = "composer-state-v1";

export const SCREENS_SLOT_COUNT = 5;

export type PersistedComposerState = {
  titles: string[];
  mobile: (Blob | null)[];
  tablet: (Blob | null)[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

function normalizeTitles(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return Array.from({ length: SCREENS_SLOT_COUNT }, () => "");
  }
  return Array.from({ length: SCREENS_SLOT_COUNT }, (_, i) =>
    typeof raw[i] === "string" ? raw[i] : "",
  );
}

function normalizeBlobs(raw: unknown): (Blob | null)[] {
  if (!Array.isArray(raw)) {
    return Array.from({ length: SCREENS_SLOT_COUNT }, () => null);
  }
  return Array.from({ length: SCREENS_SLOT_COUNT }, (_, i) => {
    const x = raw[i];
    return x instanceof Blob ? x : null;
  });
}

export async function loadComposerState(): Promise<PersistedComposerState | null> {
  if (typeof indexedDB === "undefined") return null;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => {
      const raw = req.result;
      if (raw == null) {
        resolve(null);
        return;
      }
      if (typeof raw !== "object") {
        resolve(null);
        return;
      }
      const o = raw as Record<string, unknown>;
      resolve({
        titles: normalizeTitles(o.titles),
        mobile: normalizeBlobs(o.mobile),
        tablet: normalizeBlobs(o.tablet),
      });
    };
    req.onerror = () => reject(req.error ?? new Error("IndexedDB read failed"));
    tx.oncomplete = () => db.close();
  });
}

export async function saveComposerState(
  state: PersistedComposerState,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(
      {
        titles: state.titles,
        mobile: state.mobile,
        tablet: state.tablet,
      },
      KEY,
    );
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
}
