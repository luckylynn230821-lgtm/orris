import { LOCALES } from "@/lib/i18n/locales";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

export function LanguageSwitch({ className, tone = "ivory" }: { className?: string; tone?: "ivory" | "ink" }) {
  const { locale, setLocale, t } = useT();
  return (
    <label className={cn("inline-flex items-center", className)}>
      <span className="sr-only">{t("lang.label")}</span>
      <select
        aria-label={t("lang.label")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as (typeof LOCALES)[number]["id"])}
        className={cn(
          "h-9 max-w-full bg-transparent text-sm outline-none",
          tone === "ink" ? "text-ivory" : "text-ink",
        )}
      >
        {LOCALES.map((item) => (
          <option key={item.id} value={item.id} className="text-ink">
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
