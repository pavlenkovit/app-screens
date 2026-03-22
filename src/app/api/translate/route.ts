import { NextResponse } from "next/server";
import { isAppLangCode } from "@/lib/app-languages";

type GoogleTranslateResponse = {
  data?: { translations?: { translatedText?: string }[] };
  error?: { message?: string };
};

async function translateBatch(
  key: string,
  texts: string[],
  source: string,
  target: string,
): Promise<string[]> {
  const url = new URL(
    "https://translation.googleapis.com/language/translate/v2",
  );
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: texts,
      source,
      target,
      format: "text",
    }),
  });

  const json = (await res.json()) as GoogleTranslateResponse;

  if (!res.ok || !json.data?.translations) {
    const msg =
      json.error?.message ?? `Google Translate (${target}) код ${res.status}`;
    throw new Error(msg);
  }

  const out = json.data.translations.map((t) => t.translatedText ?? "");
  if (out.length !== texts.length) {
    throw new Error(`Несовпадение числа переводов для ${target}`);
  }
  return out;
}

export async function POST(req: Request) {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Не задан GOOGLE_TRANSLATE_API_KEY. Добавь ключ в .env.local и перезапусти dev-сервер.",
      },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const { texts, source, targets } = body as {
    texts?: unknown;
    source?: unknown;
    targets?: unknown;
  };

  if (!Array.isArray(texts) || texts.length === 0 || texts.length > 50) {
    return NextResponse.json(
      { error: "Ожидается texts: непустой массив строк (до 50)" },
      { status: 400 },
    );
  }
  if (texts.some((t) => typeof t !== "string")) {
    return NextResponse.json(
      { error: "Каждый элемент texts должен быть строкой" },
      { status: 400 },
    );
  }
  if (typeof source !== "string" || !isAppLangCode(source)) {
    return NextResponse.json(
      { error: "Недопустимый source" },
      { status: 400 },
    );
  }
  if (!Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json(
      { error: "Ожидается targets: непустой массив кодов языков" },
      { status: 400 },
    );
  }
  const targetList = [...new Set(targets as string[])].filter(
    (t): t is string => typeof t === "string" && isAppLangCode(t),
  );
  if (targetList.length === 0) {
    return NextResponse.json(
      { error: "Нет допустимых целей перевода" },
      { status: 400 },
    );
  }
  for (const t of targetList) {
    if (t === source) {
      return NextResponse.json(
        { error: "Цель перевода не должна совпадать с исходным языком" },
        { status: 400 },
      );
    }
    if (!isAppLangCode(t)) {
      return NextResponse.json({ error: `Недопустимый target: ${t}` }, { status: 400 });
    }
  }

  try {
    const byTarget: Record<string, string[]> = {};
    await Promise.all(
      targetList.map(async (target) => {
        byTarget[target] = await translateBatch(key, texts, source, target);
      }),
    );
    return NextResponse.json({ byTarget });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка перевода";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
