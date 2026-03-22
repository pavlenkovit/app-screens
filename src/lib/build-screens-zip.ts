import { toPng } from "html-to-image";
import JSZip from "jszip";

type HtmlToImageOptions = NonNullable<Parameters<typeof toPng>[1]>;

/** Размеры файла для сторов (px). Картинка — как на экране, вписанная в этот кадр. */
export const EXPORT_SIZE_MOBILE = { width: 1242, height: 2688 } as const;
export const EXPORT_SIZE_TABLET = { width: 2064, height: 2752 } as const;

/** См. html-to-image: cacheBust ломает blob: URL; skipFonts — без CORS на внешние шрифты. */
const PNG_BASE: HtmlToImageOptions = {
  cacheBust: false,
  skipFonts: true,
  backgroundColor: "#000000",
};

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
  const rawDataUrl = await toPng(el, {
    ...PNG_BASE,
    /** Чуть выше, чем 1×, чтобы при масштабе до размеров стора текст и мокап не «мылились». */
    pixelRatio: 2,
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

export async function buildScreensZip(
  mobileCards: (HTMLElement | null)[],
  tabletCards: (HTMLElement | null)[],
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder("app-screens");

  for (let i = 0; i < mobileCards.length; i++) {
    const el = mobileCards[i];
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

  for (let i = 0; i < tabletCards.length; i++) {
    const el = tabletCards[i];
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
