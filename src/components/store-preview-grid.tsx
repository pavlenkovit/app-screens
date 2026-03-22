"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildScreensZip,
  downloadBlob,
  type LangCardRefs,
} from "@/lib/build-screens-zip";
import {
  APP_LANG_CODES,
  APP_LANGUAGES,
  langMeta,
  makeTranslateFingerprint,
  type AppLangCode,
} from "@/lib/app-languages";
import {
  loadComposerState,
  saveComposerState,
  SCREENS_SLOT_COUNT,
  type LangImages,
  type PersistedComposerState,
} from "@/lib/screens-storage";
import { translateToTargets } from "@/lib/translate-client";
import { DeviceMockup } from "./device-mockup";

const SLOT_COUNT = SCREENS_SLOT_COUNT;

function emptyStrings(n: number) {
  return Array.from({ length: n }, () => "");
}

function emptyUrls(n: number) {
  return Array.from({ length: n }, () => null as string | null);
}

function emptyTitlesRecord(): Record<AppLangCode, string[]> {
  return Object.fromEntries(
    APP_LANG_CODES.map((c) => [c, emptyStrings(SLOT_COUNT)]),
  ) as Record<AppLangCode, string[]>;
}

function emptyBlobsMatrix(): Record<AppLangCode, (Blob | null)[]> {
  return Object.fromEntries(
    APP_LANG_CODES.map((c) => [c, Array.from({ length: SLOT_COUNT }, () => null)]),
  ) as Record<AppLangCode, (Blob | null)[]>;
}

function emptySrcByLang(): Record<AppLangCode, (string | null)[]> {
  return Object.fromEntries(
    APP_LANG_CODES.map((c) => [c, emptyUrls(SLOT_COUNT)]),
  ) as Record<AppLangCode, (string | null)[]>;
}

function sortTargets(list: AppLangCode[]): AppLangCode[] {
  const order = new Map(APP_LANG_CODES.map((c, i) => [c, i]));
  return [...new Set(list)].sort((a, b) => order.get(a)! - order.get(b)!);
}

function defaultEmptyImages(): Record<AppLangCode, LangImages> {
  return Object.fromEntries(
    APP_LANG_CODES.map((c) => [
      c,
      {
        mobile: Array.from({ length: SLOT_COUNT }, () => null as Blob | null),
        tablet: Array.from({ length: SLOT_COUNT }, () => null as Blob | null),
      },
    ]),
  ) as Record<AppLangCode, LangImages>;
}

function defaultFullState(): PersistedComposerState {
  const titles = emptyTitlesRecord();
  const sourceLang: AppLangCode = "ru";
  const targetLangs: AppLangCode[] = ["en", "es"];
  return {
    sourceLang,
    targetLangs,
    titles,
    images: defaultEmptyImages(),
    translateFingerprint: makeTranslateFingerprint(
      sourceLang,
      targetLangs,
      titles[sourceLang],
    ),
  };
}

export function StorePreviewGrid() {
  const fresh = defaultFullState();
  const [sourceLang, setSourceLang] = useState<AppLangCode>(fresh.sourceLang);
  const [targetLangs, setTargetLangs] = useState<AppLangCode[]>(
    fresh.targetLangs,
  );
  const [titles, setTitles] =
    useState<Record<AppLangCode, string[]>>(fresh.titles);
  const [mobileSrcByLang, setMobileSrcByLang] = useState(emptySrcByLang);
  const [tabletSrcByLang, setTabletSrcByLang] = useState(emptySrcByLang);
  const [translateFingerprint, setTranslateFingerprint] = useState<
    string | null
  >(fresh.translateFingerprint);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const mobileBlobsRef = useRef(emptyBlobsMatrix());
  const tabletBlobsRef = useRef(emptyBlobsMatrix());
  const mobileCardRefsByLang = useRef(
    Object.fromEntries(
      APP_LANG_CODES.map((c) => [
        c,
        Array.from({ length: SLOT_COUNT }, () => null as HTMLElement | null),
      ]),
    ) as Record<AppLangCode, (HTMLElement | null)[]>,
  );
  const tabletCardRefsByLang = useRef(
    Object.fromEntries(
      APP_LANG_CODES.map((c) => [
        c,
        Array.from({ length: SLOT_COUNT }, () => null as HTMLElement | null),
      ]),
    ) as Record<AppLangCode, (HTMLElement | null)[]>,
  );

  const srcPoolRef = useRef({
    mobile: mobileSrcByLang,
    tablet: tabletSrcByLang,
  });
  useEffect(() => {
    srcPoolRef.current = { mobile: mobileSrcByLang, tablet: tabletSrcByLang };
  }, [mobileSrcByLang, tabletSrcByLang]);

  useEffect(() => {
    return () => {
      for (const lang of APP_LANG_CODES) {
        srcPoolRef.current.mobile[lang].forEach((u) => u && URL.revokeObjectURL(u));
        srcPoolRef.current.tablet[lang].forEach((u) => u && URL.revokeObjectURL(u));
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadComposerState();
        if (cancelled) return;
        const next = data ?? defaultFullState();
        for (const lang of APP_LANG_CODES) {
          mobileBlobsRef.current[lang] = [...next.images[lang].mobile];
          tabletBlobsRef.current[lang] = [...next.images[lang].tablet];
        }
        setSourceLang(next.sourceLang);
        setTargetLangs(sortTargets(next.targetLangs));
        setTitles(next.titles);
        setTranslateFingerprint(next.translateFingerprint);
        setMobileSrcByLang({
          ...Object.fromEntries(
            APP_LANG_CODES.map((lang) => [
              lang,
              next.images[lang].mobile.map((b) =>
                b ? URL.createObjectURL(b) : null,
              ),
            ]),
          ),
        } as Record<AppLangCode, (string | null)[]>);
        setTabletSrcByLang({
          ...Object.fromEntries(
            APP_LANG_CODES.map((lang) => [
              lang,
              next.images[lang].tablet.map((b) =>
                b ? URL.createObjectURL(b) : null,
              ),
            ]),
          ),
        } as Record<AppLangCode, (string | null)[]>);
      } catch (e) {
        console.error("Не удалось загрузить сохранённые данные", e);
        const d = defaultFullState();
        setSourceLang(d.sourceLang);
        setTargetLangs(d.targetLangs);
        setTitles(d.titles);
        setTranslateFingerprint(d.translateFingerprint);
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const id = window.setTimeout(() => {
      void saveComposerState({
        sourceLang,
        targetLangs,
        titles,
        images: {
          ...Object.fromEntries(
            APP_LANG_CODES.map((lang) => [
              lang,
              {
                mobile: [...mobileBlobsRef.current[lang]],
                tablet: [...tabletBlobsRef.current[lang]],
              },
            ]),
          ),
        } as Record<
          AppLangCode,
          { mobile: (Blob | null)[]; tablet: (Blob | null)[] }
        >,
        translateFingerprint: translateFingerprint ?? "",
      }).catch((e) => console.error("Не удалось сохранить в браузере", e));
    }, 450);
    return () => window.clearTimeout(id);
  }, [
    storageReady,
    sourceLang,
    targetLangs,
    titles,
    translateFingerprint,
    mobileSrcByLang,
    tabletSrcByLang,
  ]);

  const sourceTitles = titles[sourceLang];
  const currentFingerprint = makeTranslateFingerprint(
    sourceLang,
    targetLangs,
    sourceTitles,
  );
  const translationsOutdated =
    storageReady &&
    translateFingerprint !== null &&
    currentFingerprint !== translateFingerprint;

  const handleGenerateTranslations = useCallback(async () => {
    if (!translationsOutdated || targetLangs.length === 0) return;
    const snapshot = [...sourceTitles];
    const fpBase = makeTranslateFingerprint(
      sourceLang,
      targetLangs,
      snapshot,
    );
    try {
      setTranslating(true);
      setTranslateError(null);
      if (snapshot.every((t) => !t.trim())) {
        setTitles((prev) => {
          const next = { ...prev };
          for (const t of targetLangs) {
            next[t] = emptyStrings(SLOT_COUNT);
          }
          return next;
        });
        setTranslateFingerprint(fpBase);
        return;
      }
      const result = await translateToTargets(snapshot, sourceLang, targetLangs);
      setTitles((prev) => {
        const next = { ...prev };
        for (const t of targetLangs) {
          next[t] = result[t];
        }
        return next;
      });
      setTranslateFingerprint(fpBase);
    } catch (e) {
      setTranslateError(
        e instanceof Error ? e.message : "Ошибка перевода",
      );
    } finally {
      setTranslating(false);
    }
  }, [
    translationsOutdated,
    targetLangs,
    sourceLang,
    sourceTitles,
  ]);

  const onSourceLangChange = useCallback((code: AppLangCode) => {
    setSourceLang(code);
    setTargetLangs((prev) => sortTargets(prev.filter((t) => t !== code)));
  }, []);

  const toggleTargetLang = useCallback(
    (code: AppLangCode) => {
      if (code === sourceLang) return;
      setTargetLangs((prev) => {
        const has = prev.includes(code);
        const next = has
          ? prev.filter((t) => t !== code)
          : [...prev, code];
        return sortTargets(next);
      });
    },
    [sourceLang],
  );

  const setSourceTitle = useCallback(
    (index: number, value: string) => {
      setTitles((prev) => {
        const next = { ...prev, [sourceLang]: [...prev[sourceLang]] };
        next[sourceLang][index] = value;
        return next;
      });
    },
    [sourceLang],
  );

  const setMobileImage = useCallback(
    (lang: AppLangCode, index: number, file: File | null) => {
      if (!file) {
        mobileBlobsRef.current[lang][index] = null;
        setMobileSrcByLang((prev) => {
          const next = { ...prev, [lang]: [...prev[lang]] };
          if (next[lang][index]) URL.revokeObjectURL(next[lang][index]!);
          next[lang][index] = null;
          return next;
        });
        return;
      }

      const slotEmptyEverywhere = APP_LANG_CODES.every(
        (l) => !mobileBlobsRef.current[l][index],
      );

      if (slotEmptyEverywhere) {
        for (const l of APP_LANG_CODES) {
          mobileBlobsRef.current[l][index] = file;
        }
        setMobileSrcByLang((prev) => {
          const next = { ...prev };
          for (const l of APP_LANG_CODES) {
            const row = [...prev[l]];
            if (row[index]) URL.revokeObjectURL(row[index]!);
            row[index] = URL.createObjectURL(file);
            next[l] = row;
          }
          return next;
        });
        return;
      }

      mobileBlobsRef.current[lang][index] = file;
      setMobileSrcByLang((prev) => {
        const next = { ...prev, [lang]: [...prev[lang]] };
        if (next[lang][index]) URL.revokeObjectURL(next[lang][index]!);
        next[lang][index] = URL.createObjectURL(file);
        return next;
      });
    },
    [],
  );

  const setTabletImage = useCallback(
    (lang: AppLangCode, index: number, file: File | null) => {
      if (!file) {
        tabletBlobsRef.current[lang][index] = null;
        setTabletSrcByLang((prev) => {
          const next = { ...prev, [lang]: [...prev[lang]] };
          if (next[lang][index]) URL.revokeObjectURL(next[lang][index]!);
          next[lang][index] = null;
          return next;
        });
        return;
      }

      const slotEmptyEverywhere = APP_LANG_CODES.every(
        (l) => !tabletBlobsRef.current[l][index],
      );

      if (slotEmptyEverywhere) {
        for (const l of APP_LANG_CODES) {
          tabletBlobsRef.current[l][index] = file;
        }
        setTabletSrcByLang((prev) => {
          const next = { ...prev };
          for (const l of APP_LANG_CODES) {
            const row = [...prev[l]];
            if (row[index]) URL.revokeObjectURL(row[index]!);
            row[index] = URL.createObjectURL(file);
            next[l] = row;
          }
          return next;
        });
        return;
      }

      tabletBlobsRef.current[lang][index] = file;
      setTabletSrcByLang((prev) => {
        const next = { ...prev, [lang]: [...prev[lang]] };
        if (next[lang][index]) URL.revokeObjectURL(next[lang][index]!);
        next[lang][index] = URL.createObjectURL(file);
        return next;
      });
    },
    [],
  );

  const registerMobileCardRef = useCallback(
    (lang: AppLangCode, index: number, el: HTMLElement | null) => {
      mobileCardRefsByLang.current[lang][index] = el;
    },
    [],
  );

  const registerTabletCardRef = useCallback(
    (lang: AppLangCode, index: number, el: HTMLElement | null) => {
      tabletCardRefsByLang.current[lang][index] = el;
    },
    [],
  );

  const handleExportAll = useCallback(async () => {
    setExportError(null);
    setExporting(true);
    try {
      const byLang = APP_LANG_CODES.reduce(
        (acc, lang) => {
          acc[lang] = {
            mobile: [...mobileCardRefsByLang.current[lang]],
            tablet: [...tabletCardRefsByLang.current[lang]],
          };
          return acc;
        },
        {} as Record<AppLangCode, LangCardRefs>,
      );
      const blob = await buildScreensZip(byLang);
      downloadBlob(blob, "app-screens.zip");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось собрать архив";
      setExportError(message);
    } finally {
      setExporting(false);
    }
  }, []);

  const textColCount = 1 + targetLangs.length;

  /** Секции превью: сначала язык оригинала, остальные — в базовом порядке. */
  const mockupSectionLangOrder = useMemo(
    () => [
      sourceLang,
      ...APP_LANG_CODES.filter((l) => l !== sourceLang),
    ],
    [sourceLang],
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          App Screens
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Макеты для сторов
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-600">
          Выберите язык оригинала и один или несколько языков перевода. После
          правок текста нажмите кнопку перевода. Скриншоты загружаются отдельно
          для каждой локали.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleExportAll}
            disabled={exporting}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? "Собираем PNG…" : "Скачать все (ZIP)"}
          </button>
          {exportError ? (
            <p className="max-w-md text-center text-sm text-red-600" role="alert">
              {exportError}
            </p>
          ) : null}
        </div>
      </header>

      <section
        aria-label="Настройки языков и тексты"
        className="mb-12 space-y-8"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 sm:p-6">
          <div>
            <label
              htmlFor="source-lang"
              className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
            >
              Язык оригинала
            </label>
            <select
              id="source-lang"
              value={sourceLang}
              onChange={(e) =>
                onSourceLangChange(e.target.value as AppLangCode)
              }
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
            >
              {APP_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Перевести на (можно несколько)
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {APP_LANGUAGES.map((l) => {
                const disabled = l.code === sourceLang;
                const checked = targetLangs.includes(l.code);
                return (
                  <label
                    key={l.code}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                      disabled
                        ? "cursor-not-allowed border-zinc-100 bg-zinc-100 text-zinc-400"
                        : checked
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      disabled={disabled}
                      checked={checked}
                      onChange={() => toggleTargetLang(l.code)}
                    />
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                  </label>
                );
              })}
            </div>
            {targetLangs.length === 0 ? (
              <p className="mt-2 text-xs text-amber-800">
                Отметьте хотя бы один язык, чтобы сгенерировать переводы.
              </p>
            ) : null}
          </fieldset>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleGenerateTranslations}
            disabled={
              !storageReady ||
              translateFingerprint === null ||
              !translationsOutdated ||
              translating ||
              targetLangs.length === 0
            }
            className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {translating
              ? "Переводим…"
              : `Сгенерировать переводы (${targetLangs.length})`}
          </button>
          {translationsOutdated && targetLangs.length > 0 ? (
            <p className="text-center text-xs text-amber-700">
              Изменились оригинал, цели или текст — обновите переводы.
            </p>
          ) : null}
          {translateError ? (
            <p className="max-w-md text-center text-sm text-red-600" role="alert">
              {translateError}
            </p>
          ) : null}
        </div>

        <div className="overflow-x-auto pb-2">
          <div
            className="grid gap-6"
            style={{
              gridTemplateColumns: `repeat(${textColCount}, minmax(14rem, 1fr))`,
              minWidth: `${Math.min(textColCount, 7) * 14}rem`,
            }}
          >
            <div className="grid min-w-0 grid-cols-1 gap-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
                {langMeta(sourceLang).flag} {langMeta(sourceLang).label}{" "}
                <span className="font-normal text-zinc-500">(оригинал)</span>
              </p>
              {sourceTitles.map((value, i) => (
                <div key={`src-${i}`} className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`slide-src-${i}`}
                    className="text-xs font-medium text-zinc-600"
                  >
                    Слайд {i + 1}
                  </label>
                  <textarea
                    id={`slide-src-${i}`}
                    rows={3}
                    value={value}
                    onChange={(e) => setSourceTitle(i, e.target.value)}
                    placeholder="Текст слайда…"
                    className="min-h-[5.5rem] resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>
              ))}
            </div>
            {targetLangs.map((lang) => (
              <div key={lang} className="grid min-w-0 grid-cols-1 gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
                  {langMeta(lang).flag} {langMeta(lang).label}{" "}
                  <span className="font-normal text-zinc-500">(перевод)</span>
                </p>
                {titles[lang].map((value, i) => (
                  <div key={`${lang}-${i}`} className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`slide-${lang}-${i}`}
                      className="text-xs font-medium text-zinc-600"
                    >
                      Слайд {i + 1}
                    </label>
                    <textarea
                      id={`slide-${lang}-${i}`}
                      readOnly
                      rows={3}
                      value={value}
                      className="min-h-[5.5rem] resize-y rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="mx-auto mb-10 max-w-2xl rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-sm text-zinc-600">
        Скриншот для слайда загрузите в любом языке: пока слот пустой во всех
        локалях, файл подставится везде сразу. Потом можно заменить картинку
        только в нужном языке.
      </p>

      {mockupSectionLangOrder.map((lang, idx) => (
        <div
          key={lang}
          className={idx > 0 ? "mt-16 border-t border-zinc-200 pt-16" : ""}
        >
          <h2 className="mb-2 text-center text-xl font-semibold text-zinc-900">
            Макеты — {langMeta(lang).flag} {langMeta(lang).label}
            {lang === sourceLang ? (
              <span className="ml-2 text-base font-normal text-zinc-500">
                (оригинал)
              </span>
            ) : null}
          </h2>
          <p className="mb-8 text-center text-sm text-zinc-500">
            Загрузите скриншоты для этой локали.
          </p>
          <PreviewRow
            label={`Мобильные — ${langMeta(lang).label}`}
            lang={lang}
            titles={titles[lang]}
            sources={mobileSrcByLang[lang]}
            onImageChange={(i, file) => setMobileImage(lang, i, file)}
            idPrefix={`m-${lang}`}
            variant="phone"
            registerCardRef={(i, el) => registerMobileCardRef(lang, i, el)}
          />
          <PreviewRow
            label={`Планшеты — ${langMeta(lang).label}`}
            lang={lang}
            titles={titles[lang]}
            sources={tabletSrcByLang[lang]}
            onImageChange={(i, file) => setTabletImage(lang, i, file)}
            idPrefix={`t-${lang}`}
            variant="tablet"
            className="mt-12"
            registerCardRef={(i, el) => registerTabletCardRef(lang, i, el)}
          />
        </div>
      ))}
    </div>
  );
}

type PreviewRowProps = {
  label: string;
  lang: AppLangCode;
  titles: string[];
  sources: (string | null)[];
  onImageChange: (index: number, file: File | null) => void;
  idPrefix: string;
  variant: "phone" | "tablet";
  className?: string;
  registerCardRef: (index: number, el: HTMLElement | null) => void;
};

function PreviewRow({
  label,
  lang,
  titles,
  sources,
  onImageChange,
  idPrefix,
  variant,
  className = "",
  registerCardRef,
}: PreviewRowProps) {
  return (
    <section className={className} aria-label={label}>
      <h3 className="mb-6 text-lg font-semibold text-zinc-900">{label}</h3>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {titles.map((title, i) => (
          <article
            key={`${idPrefix}-${i}`}
            ref={(el) => registerCardRef(i, el)}
            lang={lang}
            className="flex flex-col items-center gap-6 rounded-2xl bg-black px-4 py-8 text-white shadow-xl sm:px-5 sm:py-10"
          >
            <p className="min-h-[3.5rem] max-w-[16rem] text-center text-base font-medium leading-snug text-white sm:text-lg sm:leading-snug">
              {title.trim() || (
                <span className="text-zinc-500">Слайд {i + 1}</span>
              )}
            </p>
            <DeviceMockup
              variant={variant}
              imageSrc={sources[i]}
              onImageChange={(file) => onImageChange(i, file)}
              inputId={`${idPrefix}-upload-${i}`}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
