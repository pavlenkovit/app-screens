"use client";

import dynamic from "next/dynamic";

const StorePreviewGrid = dynamic(
  () =>
    import("@/components/store-preview-grid").then((mod) => ({
      default: mod.StorePreviewGrid,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center text-sm text-zinc-500">
        Загрузка редактора…
      </div>
    ),
  },
);

export function ComposerShell() {
  return <StorePreviewGrid />;
}
