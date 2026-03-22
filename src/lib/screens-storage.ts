import {
  APP_LANG_CODES,
  type AppLangCode,
  makeTranslateFingerprint,
} from "@/lib/app-languages";

const DB_NAME = "app-screens-db";
const DB_VERSION = 1;
const STORE = "kv";
const KEY_V1 = "composer-state-v1";
const KEY_V2 = "composer-state-v2";
const KEY_V3 = "composer-state-v3";

export const SCREENS_SLOT_COUNT = 5;

/** @deprecated используйте AppLangCode из app-languages */
export type ScreenLang = AppLangCode;
export const SCREEN_LANGS = APP_LANG_CODES;

export type LangImages = {
  mobile: (Blob | null)[];
  tablet: (Blob | null)[];
};

export type PersistedComposerState = {
  sourceLang: AppLangCode;
  targetLangs: AppLangCode[];
  titles: Record<AppLangCode, string[]>;
  images: Record<AppLangCode, LangImages>;
  translateFingerprint: string;
};

type LegacyV1 = {
  titles: string[];
  mobile: (Blob | null)[];
  tablet: (Blob | null)[];
};

type LegacyV2 = {
  titlesRu: string[];
  titlesEn: string[];
  titlesEs: string[];
  images: Record<"ru" | "en" | "es", LangImages>;
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

function emptySlotStrings() {
  return Array.from({ length: SCREENS_SLOT_COUNT }, () => "");
}

function emptyTitlesRecord(): Record<AppLangCode, string[]> {
  return Object.fromEntries(
    APP_LANG_CODES.map((c) => [c, emptySlotStrings()]),
  ) as Record<AppLangCode, string[]>;
}

function emptyLangImages(): LangImages {
  return {
    mobile: Array.from({ length: SCREENS_SLOT_COUNT }, () => null),
    tablet: Array.from({ length: SCREENS_SLOT_COUNT }, () => null),
  };
}

function emptyImagesRecord(): Record<AppLangCode, LangImages> {
  return Object.fromEntries(
    APP_LANG_CODES.map((c) => [c, emptyLangImages()]),
  ) as Record<AppLangCode, LangImages>;
}

function normalizeTitles(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return emptySlotStrings();
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

function normalizeImagesV3(raw: unknown): Record<AppLangCode, LangImages> {
  const base = emptyImagesRecord();
  if (raw == null || typeof raw !== "object") return base;
  const o = raw as Record<string, { mobile?: unknown; tablet?: unknown }>;
  for (const lang of APP_LANG_CODES) {
    const slot = o[lang];
    if (slot && typeof slot === "object") {
      base[lang].mobile = normalizeBlobs(slot.mobile);
      base[lang].tablet = normalizeBlobs(slot.tablet);
    }
  }
  return base;
}

function normalizeTitlesRecord(raw: unknown): Record<AppLangCode, string[]> {
  const base = emptyTitlesRecord();
  if (raw == null || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  for (const lang of APP_LANG_CODES) {
    base[lang] = normalizeTitles(o[lang]);
  }
  return base;
}

function parseV3(raw: Record<string, unknown>): PersistedComposerState {
  const sourceLang =
    typeof raw.sourceLang === "string" &&
    APP_LANG_CODES.includes(raw.sourceLang as AppLangCode)
      ? (raw.sourceLang as AppLangCode)
      : "ru";
  let targetLangs: AppLangCode[] = [];
  if (Array.isArray(raw.targetLangs)) {
    targetLangs = raw.targetLangs.filter(
      (x): x is AppLangCode =>
        typeof x === "string" && APP_LANG_CODES.includes(x as AppLangCode),
    );
  }
  targetLangs = [...new Set(targetLangs)].filter((t) => t !== sourceLang);
  const titles = normalizeTitlesRecord(raw.titles);
  const images = normalizeImagesV3(raw.images);
  const translateFingerprint =
    typeof raw.translateFingerprint === "string"
      ? raw.translateFingerprint
      : makeTranslateFingerprint(sourceLang, targetLangs, titles[sourceLang]);
  return {
    sourceLang,
    targetLangs,
    titles,
    images,
    translateFingerprint,
  };
}

function migrateFromV2(v2: LegacyV2): PersistedComposerState {
  const titles = emptyTitlesRecord();
  titles.ru = normalizeTitles(v2.titlesRu);
  titles.en = normalizeTitles(v2.titlesEn);
  titles.es = normalizeTitles(v2.titlesEs);
  const images = emptyImagesRecord();
  for (const l of ["ru", "en", "es"] as const) {
    if (v2.images?.[l]) {
      images[l].mobile = normalizeBlobs(v2.images[l].mobile);
      images[l].tablet = normalizeBlobs(v2.images[l].tablet);
    }
  }
  const sourceLang: AppLangCode = "ru";
  const targetLangs: AppLangCode[] = ["en", "es"];
  return {
    sourceLang,
    targetLangs,
    titles,
    images,
    translateFingerprint: makeTranslateFingerprint(
      sourceLang,
      targetLangs,
      titles.ru,
    ),
  };
}

function migrateFromV1(raw: Record<string, unknown>): PersistedComposerState {
  const legacy = raw as unknown as LegacyV1;
  const titles = emptyTitlesRecord();
  titles.ru = normalizeTitles(legacy.titles);
  const images = emptyImagesRecord();
  images.ru.mobile = normalizeBlobs(legacy.mobile);
  images.ru.tablet = normalizeBlobs(legacy.tablet);
  const sourceLang: AppLangCode = "ru";
  const targetLangs: AppLangCode[] = ["en", "es"];
  return {
    sourceLang,
    targetLangs,
    titles,
    images,
    translateFingerprint: makeTranslateFingerprint(
      sourceLang,
      targetLangs,
      titles.ru,
    ),
  };
}

async function idbGet(key: string): Promise<unknown> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB read failed"));
    tx.oncomplete = () => db.close();
  });
}

function isLegacyV2(o: Record<string, unknown>): o is LegacyV2 {
  return (
    Array.isArray(o.titlesRu) &&
    "titlesEn" in o &&
    "images" in o
  );
}

export async function loadComposerState(): Promise<PersistedComposerState | null> {
  if (typeof indexedDB === "undefined") return null;

  const v3 = await idbGet(KEY_V3);
  if (v3 != null && typeof v3 === "object") {
    return parseV3(v3 as Record<string, unknown>);
  }

  const v2 = await idbGet(KEY_V2);
  if (v2 != null && typeof v2 === "object") {
    const o = v2 as Record<string, unknown>;
    if (isLegacyV2(o)) {
      return migrateFromV2(o);
    }
  }

  const v1 = await idbGet(KEY_V1);
  if (v1 != null && typeof v1 === "object") {
    const o = v1 as Record<string, unknown>;
    if (Array.isArray(o.titles) && "mobile" in o) {
      return migrateFromV1(o);
    }
  }

  return null;
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
        sourceLang: state.sourceLang,
        targetLangs: state.targetLangs,
        titles: state.titles,
        images: state.images,
        translateFingerprint: state.translateFingerprint,
      },
      KEY_V3,
    );
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
}
