import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RangeBar, useAnalytics } from "@/components/admin/analytics-view";
import type { RangeKey } from "@/lib/commerce/metrics";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translate";

export const Route = createFileRoute("/admin/intelligence")({
  component: IntelligencePage,
  head: () => ({ meta: [{ title: "Intelligence — Merchant desk" }] }),
});

function IntelligencePage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [includeDemo, setIncludeDemo] = useState(true);
  const { data, error, loading } = useAnalytics(range, includeDemo);
  const { t, tx } = useT();
  const groups = ["replenishment", "slow_moving", "high_interest_low_conversion", "low_margin", "underperforming", "best_seller", "high_margin", "high_refund", "insufficient", "steady"];
  return (
    <div>
      <h1 className="text-4xl">{t("admin.intelligenceTitle")}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-ash">{t("desk.intelligenceIntro")}</p>
      <div className="mt-6"><RangeBar range={range} setRange={setRange} includeDemo={includeDemo} setIncludeDemo={setIncludeDemo} /></div>
      {loading ? <p className="mt-6 text-sm text-ash">{t("desk.reading")}</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="mt-6 space-y-8">
        {groups.map((flag) => {
          const items = data?.insights.filter((insight) => insight.flags.includes(flag)) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={flag}>
              <h2 className="text-2xl">{t(`insight.flags.${flag}` as MessageKey)}</h2>
              <div className="mt-3 grid gap-3">
                {items.map((item) => (
                  <article key={item.productId + flag} className="bg-paper p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-xl">{item.name}</h3>
                      <p className="text-xs text-ash">{item.flags.map((name) => t(`insight.flags.${name}` as MessageKey)).join(" · ")}</p>
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6">
                      {item.reasons.filter((reason) => reason.length > 0).slice(0, 3).map((reason) => <li key={reason}>{localize(reason, tx)}</li>)}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
