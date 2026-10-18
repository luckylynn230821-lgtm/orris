export const LOCALES = [
  { id: "en", label: "English", html: "en" },
  { id: "zh", label: "简体中文", html: "zh-Hans" },
  { id: "zh-Hant", label: "繁體中文", html: "zh-Hant" },
  { id: "ja", label: "日本語", html: "ja" },
  { id: "ko", label: "한국어", html: "ko" },
] as const;

export type Locale = (typeof LOCALES)[number]["id"];

const ALLOWED = new Set<string>(LOCALES.map((item) => item.id));

export function parseLocale(raw: string | null | undefined): Locale {
  if (!raw) return "en";
  const match = /(?:^|;\s*)orris_locale=([^;]+)/.exec(raw);
  const value = (match ? decodeURIComponent(match[1]) : raw).trim();
  return ALLOWED.has(value) ? (value as Locale) : "en";
}

export function htmlLang(locale: Locale): string {
  return LOCALES.find((item) => item.id === locale)?.html ?? "en";
}

export function writeLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `orris_locale=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
