import { en } from "./en.ts";
import { ja } from "./ja.ts";
import { ko } from "./ko.ts";
import type { Locale } from "./locales.ts";
import { zh } from "./zh.ts";
import { zhHant } from "./zh-Hant.ts";

export const catalogs = {
  en,
  zh,
  "zh-Hant": zhHant,
  ja,
  ko,
} as const;

type Leaf<T, P extends string = ""> = T extends string
  ? P
  : { [K in keyof T & string]: Leaf<T[K], P extends "" ? K : `${P}.${K}`> }[keyof T & string];

export type MessageKey = Leaf<typeof en>;

function lookup(catalog: unknown, key: string): string | undefined {
  let current: unknown = catalog;
  for (const part of key.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const raw = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => String(vars[name] ?? ""));
}
