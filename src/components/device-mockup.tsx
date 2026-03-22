"use client";

import Image from "next/image";

type DeviceMockupProps = {
  variant: "phone" | "tablet";
  imageSrc: string | null;
  onImageChange: (file: File | null) => void;
  inputId: string;
};

export function DeviceMockup({
  variant,
  imageSrc,
  onImageChange,
  inputId,
}: DeviceMockupProps) {
  const isPhone = variant === "phone";
  const frameClass = isPhone
    ? "w-[min(100%,9.5rem)] sm:w-[10.5rem] aspect-[9/19.5] rounded-[2.25rem] border-[6px] border-[#1a1a1a] sm:border-8 sm:rounded-[2.5rem]"
    : "w-[min(100%,13rem)] sm:w-[15rem] aspect-[3/4] rounded-[1.75rem] border-[6px] border-[#1a1a1a] sm:rounded-[2rem] sm:border-[7px]";

  return (
    <div className="relative flex flex-col items-center">
      <label htmlFor={inputId} className="cursor-pointer">
        <span className="sr-only">Загрузить скриншот</span>
        <div
          className={`${frameClass} flex flex-col overflow-hidden bg-[#0d0d0d] shadow-[0_20px_50px_rgba(0,0,0,0.45)]`}
        >
          <div className="flex shrink-0 items-center justify-between px-2.5 pb-1 pt-1.5 text-[10px] font-medium text-white/90 sm:px-3 sm:text-[11px]">
            <span className="tabular-nums">11:57</span>
            <div className="flex items-center gap-1 opacity-90">
              <SignalIcon />
              <WifiIcon />
              <BatteryIcon />
            </div>
          </div>
          <div className="relative min-h-0 flex-1 bg-[#111]">
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
          <div className="flex shrink-0 justify-center py-1.5 sm:py-2">
            <div className="h-1 w-24 rounded-full bg-white/20 sm:w-28" />
          </div>
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

function SignalIcon() {
  return (
    <svg
      width="14"
      height="10"
      viewBox="0 0 14 10"
      fill="none"
      aria-hidden
      className="text-white"
    >
      <path
        d="M1 9V7M4 9V5M7 9V3M10 9V1M13 9V6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg
      width="14"
      height="10"
      viewBox="0 0 14 10"
      fill="none"
      aria-hidden
      className="text-white"
    >
      <path
        d="M1 4c3-3 9-3 12 0M3.5 6.5a5 5 0 018 0M6 8.5h2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg
      width="22"
      height="10"
      viewBox="0 0 22 10"
      fill="none"
      aria-hidden
      className="text-white"
    >
      <rect
        x="0.5"
        y="1.5"
        width="18"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.9"
      />
      <path
        d="M20 3.5v3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <rect x="2" y="3" width="14" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}
