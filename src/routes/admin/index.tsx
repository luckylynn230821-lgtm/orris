import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RangeBar, useAnalytics } from "@/components/admin/analytics-view";
import { AdminError } from "@/components/admin/frame";
import { money, pct, growthLabel } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { RangeKey } from "@/lib/commerce/metrics";

export const Route = createFileRoute("/admin/")({
  component: Overview,
  head: () => ({ meta: [{ title: "Overview — Merchant desk" }] }),
});

function Overview() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [includeDemo, setIncludeDemo] = useState(true);
  const { t } = useT();
  const { data, error, loading } = useAnalytics(range, includeDemo);
  const k = data?.kpis;
  const cards = k
    ? [
        [t("admin.gross"), money(k.grossCents)],
        [t("admin.net"), money(k.netCents)],
        [t("admin.orderCount"), String(k.orders)],
        [t("admin.units"), String(k.units)],
        [t("admin.aov"), k.aovCents === null ? "—" : money(k.aovCents)],
        [t("admin.profit"), money(k.profitCents)],
        [t("admin.margin"), pct(k.margin)],
        [t("admin.refunds"), money(k.refundCents)],
        [t("admin.refundRate"), pct(k.refundRate)],
        [t("admin.growth"), growthLabel(k.growthNet)],
      ]
    : [];
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-ash uppercase">{t("admin.overview")}</p>
          <h1 className="text-4xl">{t("admin.books")}</h1>
        </div>
        <Link to="/" className="text-sm underline">{t("admin.viewShop")}</Link>
      </div>
      <div className="mt-6"><RangeBar range={range} setRange={setRange} includeDemo={includeDemo} setIncludeDemo={setIncludeDemo} /></div>
      {loading ? <p className="mt-8 text-sm text-ash">{t("admin.adding")}</p> : null}
      {error ? <div className="mt-6"><AdminError message={error} /></div> : null}
      {data ? (
        <>
          <p className="mt-4 max-w-3xl text-xs leading-5 text-ash">
            {data.definitions.net} {data.definitions.profit} {t("admin.shippingCollected", { amount: money(data.kpis.shippingCents) })} {t("admin.taxCollected", { amount: money(data.kpis.taxCents) })} {t("admin.notInNet")}
            {includeDemo ? t("admin.sampleOn") : t("admin.sampleOff")}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {cards.map(([label, value]) => (
              <article key={label} className="bg-paper p-4">
                <p className="text-[11px] tracking-[0.14em] text-ash uppercase">{label}</p>
                <p className="mt-2 text-xl tabular-nums">{value}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 h-72 bg-paper p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-ash)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-ash)" tickFormatter={(value) => `${Math.round(Number(value) / 100)}`} />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Area dataKey="netCents" name={t("admin.net")} stroke="var(--color-ink)" fill="var(--color-line)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
    </div>
  );
}
