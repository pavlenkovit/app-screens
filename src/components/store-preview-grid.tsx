"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildScreensZip,
  downloadBlob,
} from "@/lib/build-screens-zip";
import {
  loadComposerState,
  saveComposerState,
  SCREENS_SLOT_COUNT,
} from "@/lib/screens-storage";
import { DeviceMockup } from "./device-mockup";

const SLOT_COUNT = SCREENS_SLOT_COUNT;

function emptyStrings(n: number) {
  return Array.from({ length: n }, () => "");
}

function emptyUrls(n: number) {
  return Array.from({ length: n }, () => null as string | null);
}

export function StorePreviewGrid() {
  const [titles, setTitles] = useState(emptyStrings(SLOT_COUNT));
  const [mobileSrc, setMobileSrc] = useState(emptyUrls(SLOT_COUNT));
  const [tabletSrc, setTabletSrc] = useState(emptyUrls(SLOT_COUNT));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  const mobileUrlsRef = useRef(mobileSrc);
  const tabletUrlsRef = useRef(tabletSrc);
  const mobileBlobsRef = useRef<(Blob | null)[]>(
    Array.from({ length: SLOT_COUNT }, () => null),
  );
  const tabletBlobsRef = useRef<(Blob | null)[]>(
    Array.from({ length: SLOT_COUNT }, () => null),
  );
  const mobileCardRefs = useRef<(HTMLElement | null)[]>(
    Array.from({ length: SLOT_COUNT }, () => null),
  );
  const tabletCardRefs = useRef<(HTMLElement | null)[]>(
    Array.from({ length: SLOT_COUNT }, () => null),
  );

  useEffect(() => {
    mobileUrlsRef.current = mobileSrc;
    tabletUrlsRef.current = tabletSrc;
  }, [mobileSrc, tabletSrc]);

  useEffect(() => {
    return () => {
      mobileUrlsRef.current.forEach((u) => u && URL.revokeObjectURL(u));
      tabletUrlsRef.current.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadComposerState();
        if (cancelled) return;
        if (data) {
          mobileBlobsRef.current = [...data.mobile];
          tabletBlobsRef.current = [...data.tablet];
          setTitles(data.titles);
          setMobileSrc(
            data.mobile.map((b) => (b ? URL.createObjectURL(b) : null)),
          );
          setTabletSrc(
            data.tablet.map((b) => (b ? URL.createObjectURL(b) : null)),
          );
        }
      } catch (e) {
        console.error("Не удалось загрузить сохранённые данные", e);
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
        titles,
        mobile: [...mobileBlobsRef.current],
        tablet: [...tabletBlobsRef.current],
      }).catch((e) => console.error("Не удалось сохранить в браузере", e));
    }, 450);
    return () => window.clearTimeout(id);
  }, [storageReady, titles, mobileSrc, tabletSrc]);

  const setTitle = useCallback((index: number, value: string) => {
    setTitles((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const setMobileImage = useCallback((index: number, file: File | null) => {
    mobileBlobsRef.current[index] = file;
    setMobileSrc((prev) => {
      const next = [...prev];
      if (prev[index]) URL.revokeObjectURL(prev[index]!);
      next[index] = file ? URL.createObjectURL(file) : null;
      return next;
    });
  }, []);

  const setTabletImage = useCallback((index: number, file: File | null) => {
    tabletBlobsRef.current[index] = file;
    setTabletSrc((prev) => {
      const next = [...prev];
      if (prev[index]) URL.revokeObjectURL(prev[index]!);
      next[index] = file ? URL.createObjectURL(file) : null;
      return next;
    });
  }, []);

  const registerMobileCardRef = useCallback(
    (index: number, el: HTMLElement | null) => {
      mobileCardRefs.current[index] = el;
    },
    [],
  );

  const registerTabletCardRef = useCallback(
    (index: number, el: HTMLElement | null) => {
      tabletCardRefs.current[index] = el;
    },
    [],
  );

  const handleExportAll = useCallback(async () => {
    setExportError(null);
    setExporting(true);
    try {
      const blob = await buildScreensZip(
        mobileCardRefs.current,
        tabletCardRefs.current,
      );
      downloadBlob(blob, "app-screens.zip");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось собрать архив";
      setExportError(message);
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          App Screens
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Макеты для сторов
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-600">
          Пять слайдов: один текст на пару «телефон + планшет». В каждый мокап
          загрузите свой скриншот.
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
        aria-label="Тексты для слайдов"
        className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        {titles.map((value, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <label
              htmlFor={`slide-title-${i}`}
              className="text-xs font-medium text-zinc-600"
            >
              Слайд {i + 1}
            </label>
            <textarea
              id={`slide-title-${i}`}
              rows={3}
              value={value}
              onChange={(e) => setTitle(i, e.target.value)}
              placeholder="Заголовок для App Store / Google Play…"
              className="min-h-[5.5rem] resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
            />
          </div>
        ))}
      </section>

      <PreviewRow
        label="Мобильные"
        titles={titles}
        sources={mobileSrc}
        onImageChange={setMobileImage}
        idPrefix="m"
        variant="phone"
        registerCardRef={registerMobileCardRef}
      />

      <PreviewRow
        label="Планшеты"
        titles={titles}
        sources={tabletSrc}
        onImageChange={setTabletImage}
        idPrefix="t"
        variant="tablet"
        className="mt-14"
        registerCardRef={registerTabletCardRef}
      />
    </div>
  );
}

type PreviewRowProps = {
  label: string;
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
      <h2 className="mb-6 text-lg font-semibold text-zinc-900">{label}</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {titles.map((title, i) => (
          <article
            key={`${idPrefix}-${i}`}
            ref={(el) => registerCardRef(i, el)}
            className="flex flex-col items-center gap-6 rounded-2xl bg-black px-4 py-8 text-white shadow-xl sm:px-5 sm:py-10"
          >
            <p className="min-h-[3.5rem] max-w-[16rem] text-center text-base font-medium leading-snug text-white sm:text-lg sm:leading-snug">
              {title.trim() || (
                <span className="text-zinc-500">Текст слайда {i + 1}</span>
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
