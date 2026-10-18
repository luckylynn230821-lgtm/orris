import { createServerFn } from "@tanstack/react-start";
import { parseLocale, type Locale } from "./locales";

export const readRequestLocale = createServerFn({ method: "GET" }).handler(async (): Promise<Locale> => {
  const { getCookie } = await import("@tanstack/react-start/server");
  return parseLocale(getCookie("orris_locale"));
});
