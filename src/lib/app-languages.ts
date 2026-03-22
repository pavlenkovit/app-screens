/** Языки UI и коды Google Cloud Translation API v2. */
export const APP_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ro", label: "Română", flag: "🇷🇴" },
  { code: "sr", label: "Srpski", flag: "🇷🇸" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
] as const;

export type AppLangCode = (typeof APP_LANGUAGES)[number]["code"];

export const APP_LANG_CODES: AppLangCode[] = APP_LANGUAGES.map((l) => l.code);

const CODE_SET = new Set<string>(APP_LANG_CODES);

export function isAppLangCode(s: string): s is AppLangCode {
  return CODE_SET.has(s);
}

export function langMeta(code: AppLangCode) {
  return APP_LANGUAGES.find((l) => l.code === code)!;
}

/** Снимок для кнопки «обновить переводы»: источник, цели, тексты оригинала. */
export function makeTranslateFingerprint(
  source: AppLangCode,
  targets: AppLangCode[],
  sourceTitles: string[],
) {
  return JSON.stringify({
    source,
    targets: [...new Set(targets)].sort().join(","),
    titles: sourceTitles,
  });
}
