import type { AppLangCode } from "@/lib/app-languages";

export async function translateToTargets(
  texts: string[],
  source: AppLangCode,
  targets: AppLangCode[],
): Promise<Record<AppLangCode, string[]>> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, source, targets }),
  });
  const data = (await res.json()) as {
    byTarget?: Record<string, string[]>;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? `Ошибка перевода (${res.status})`);
  }
  if (!data.byTarget) {
    throw new Error("Пустой ответ перевода");
  }
  const out = {} as Record<AppLangCode, string[]>;
  for (const t of targets) {
    const arr = data.byTarget[t];
    if (!Array.isArray(arr)) {
      throw new Error(`Нет перевода для ${t}`);
    }
    out[t] = arr;
  }
  return out;
}
