"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import {
  EXPORT_SIZE_MOBILE,
  EXPORT_SIZE_TABLET,
} from "@/lib/export-dimensions";

const FRAME_BORDER = "#1E1A2E";

function roundToDevicePixel(value: number): number {
  if (typeof window === "undefined") return Math.round(value);
  const dpr = window.devicePixelRatio || 1;
  return Math.round(value * dpr) / dpr;
}

/** На выгружаемой ширине кадра — заданные px бордера и скругления. */
const SPECS = {
  phone: {
    refWidth: EXPORT_SIZE_MOBILE.width,
    border: 14,
    radius: 80,
  },
  tablet: {
    refWidth: EXPORT_SIZE_TABLET.width,
    border: 16,
    radius: 46,
  },
} as const;

type DeviceMockupProps = {
  variant: "phone" | "tablet";
  imageSrc: string | null;
  onImageChange: (file: File | null) => void;
  inputId: string;
  /** Вписать рамку в родителя (flex-1): для карточки с aspect как у PNG стора. */
  layout?: "compact" | "fill";
};

export function DeviceMockup({
  variant,
  imageSrc,
  onImageChange,
  inputId,
  layout = "compact",
}: DeviceMockupProps) {
  const isPhone = variant === "phone";
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameStyle, setFrameStyle] = useState<{
    borderWidth: number;
    borderRadius: number;
  }>(() => {
    const s = isPhone ? SPECS.phone : SPECS.tablet;
    return {
      borderWidth: roundToDevicePixel(Math.max(1, s.border * 0.12)),
      borderRadius: roundToDevicePixel(Math.max(4, s.radius * 0.12)),
    };
  });

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const s = isPhone ? SPECS.phone : SPECS.tablet;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w <= 0) return;
      setFrameStyle({
        borderWidth: roundToDevicePixel(Math.max(1, (s.border * w) / s.refWidth)),
        borderRadius: roundToDevicePixel(Math.max(0, (s.radius * w) / s.refWidth)),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPhone]);

  const frameLayoutClass =
    layout === "fill"
      ? isPhone
        ? "aspect-[9/19.5] h-full max-h-full w-auto max-w-full min-h-0"
        : "aspect-[3/4] h-full max-h-full w-auto max-w-full min-h-0"
      : isPhone
        ? "w-[min(100%,9.5rem)] sm:w-[10.5rem] aspect-[9/19.5]"
        : "w-[min(100%,13rem)] sm:w-[15rem] aspect-[3/4]";

  const rootClass =
    layout === "fill"
      ? "relative flex h-full min-h-0 w-full flex-col items-center"
      : "relative flex flex-col items-center";

  const labelClass =
    layout === "fill"
      ? "flex h-full min-h-0 w-full cursor-pointer items-start justify-center"
      : "cursor-pointer";

  return (
    <div className={rootClass}>
      <label htmlFor={inputId} className={labelClass}>
        <span className="sr-only">Загрузить скриншот</span>
        <div
          ref={frameRef}
          className={`${frameLayoutClass} relative box-border overflow-hidden bg-[#0d0d0d] shadow-[0_20px_50px_rgba(0,0,0,0.45)]`}
          style={{
            borderRadius: frameStyle.borderRadius,
          }}
        >
          <div className="relative h-full w-full bg-[#111]">
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt=""
                fill
                unoptimized
                className="object-cover"
                sizes="200px"
              />
            ) : (
              <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-3 text-center text-[11px] leading-snug text-zinc-500">
                <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-zinc-400">
                  Нажмите, чтобы загрузить
                </span>
              </div>
            )}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 box-border border-solid"
            style={{
              borderWidth: frameStyle.borderWidth,
              borderColor: FRAME_BORDER,
              borderRadius: frameStyle.borderRadius,
            }}
          />
        </div>
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          onImageChange(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
