import { toPng } from "html-to-image";
import JSZip from "jszip";
import { APP_LANG_CODES, type AppLangCode } from "@/lib/app-languages";
import {
  EXPORT_SIZE_MOBILE,
  EXPORT_SIZE_TABLET,
} from "@/lib/export-dimensions";

export { EXPORT_SIZE_MOBILE, EXPORT_SIZE_TABLET } from "@/lib/export-dimensions";

type HtmlToImageOptions = NonNullable<Parameters<typeof toPng>[1]>;

/**
 * skipFonts: true — иначе html-to-image обходит все document.styleSheets; листы с
 * fonts.googleapis.com (часто Open Sans от расширений браузера) дают SecurityError.
 * Шрифт на снимке задаём явно — совпадает с next/font Roboto на странице.
 */
const PNG_BASE: HtmlToImageOptions = {
  cacheBust: false,
  skipFonts: true,
  backgroundColor: "#000000",
  style: {
    fontFamily: '"Roboto", ui-sans-serif, system-ui, sans-serif',
  },
};

/** Лимит html-to-image / canvas по стороне (~16k). */
const MAX_CANVAS_EDGE = 16384;
/** Верхняя граница pixelRatio (память и время экспорта). */
const MAX_PIXEL_RATIO = 12;

/**
 * Карточка в вёрстке узкая; без достаточного pixelRatio снимок апскейлится до размеров стора и мылится.
 * Берём ceil от max(outW/w, outH/h), чтобы растр с html-to-image был не меньше целевого кадра.
 */
function pixelRatioForStoreExport(
  el: HTMLElement,
  outW: number,
  outH: number,
): number {
  const w = Math.max(1, el.offsetWidth);
  const h = Math.max(1, el.offsetHeight);
  const need = Math.max(outW / w, outH / h) * 1.03;
  let pr = Math.max(1, Math.ceil(need));
  const maxByEdge = Math.floor(MAX_CANVAS_EDGE / Math.max(w, h));
  if (Number.isFinite(maxByEdge) && maxByEdge >= 1) {
    pr = Math.min(pr, maxByEdge);
  }
  return Math.min(MAX_PIXEL_RATIO, pr);
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось прочитать снимок карточки"));
    img.src = dataUrl;
  });
}

/**
 * Снимаем узел в его реальной вёрстке, затем масштабируем на холст стора (object-fit: contain).
 * Так не получается «огромная пустота» от принудительного height на пустой колонке flex.
 */
async function captureCardToStoreSize(
  el: HTMLElement,
  outW: number,
  outH: number,
): Promise<string> {
  const pixelRatio = pixelRatioForStoreExport(el, outW, outH);
  const rawDataUrl = await toPng(el, {
    ...PNG_BASE,
    pixelRatio,
  });

  const img = await loadImageFromDataUrl(rawDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D недоступен");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, outW, outH);

  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const scale = Math.min(outW / sw, outH / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (outW - dw) / 2;
  const dy = (outH - dh) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, dw, dh);

  return canvas.toDataURL("image/png");
}

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  if (i === -1) throw new Error("Invalid data URL");
  return dataUrl.slice(i + 1);
}

export type LangCardRefs = {
  mobile: (HTMLElement | null)[];
  tablet: (HTMLElement | null)[];
};

export async function buildScreensZip(
  byLang: Record<AppLangCode, LangCardRefs>,
): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder("app-screens");

  for (const lang of APP_LANG_CODES) {
    const folder = root?.folder(lang);
    const { mobile, tablet } = byLang[lang];

    for (let i = 0; i < mobile.length; i++) {
      const el = mobile[i];
      if (!el) continue;
      const dataUrl = await captureCardToStoreSize(
        el,
        EXPORT_SIZE_MOBILE.width,
        EXPORT_SIZE_MOBILE.height,
      );
      folder?.file(
        `mobile-${String(i + 1).padStart(2, "0")}.png`,
        dataUrlToBase64(dataUrl),
        { base64: true },
      );
    }

    for (let i = 0; i < tablet.length; i++) {
      const el = tablet[i];
      if (!el) continue;
      const dataUrl = await captureCardToStoreSize(
        el,
        EXPORT_SIZE_TABLET.width,
        EXPORT_SIZE_TABLET.height,
      );
      folder?.file(
        `tablet-${String(i + 1).padStart(2, "0")}.png`,
        dataUrlToBase64(dataUrl),
        { base64: true },
      );
    }
  }

  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
