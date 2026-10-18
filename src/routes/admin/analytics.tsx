import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RangeBar, useAnalytics } from "@/components/admin/analytics-view";
import { money, pct } from "@/lib/format";
import type { RangeKey } from "@/lib/commerce/metrics";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
  head: () => ({ meta: [{ title: "Analytics — ORRIS desk" }] }),
});

function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [includeDemo, setIncludeDemo] = useState(true);
  const [sort, setSort] = useState<"net" | "units" | "profit" | "margin">("net");
  const { data, error, loading } = useAnalytics(range, includeDemo);
  const rows = useMemo(() => {
    const list = [...(data?.products ?? [])];
    list.sort((a, b) => {
      if (sort === "units") return b.units - a.units;
      if (sort === "profit") return b.profitCents - a.profitCents;
      if (sort === "margin") return (b.margin ?? -1) - (a.margin ?? -1);
      return b.netCents - a.netCents;
    });
    return list;
  }, [data, sort]);
  return (
    <div>
      <h1 className="text-4xl">Analytics</h1>
      <div className="mt-6"><RangeBar range={range} setRange={setRange} includeDemo={includeDemo} setIncludeDemo={setIncludeDemo} /></div>
      {loading ? <p className="mt-6 text-sm text-ash">Loading…</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {data ? (
        <>
          <div className="mt-6 h-64 bg-paper p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-ash)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-ash)" tickFormatter={(value) => `${Math.round(Number(value) / 100)}`} />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Bar dataKey="profitCents" name="Gross profit" fill="var(--color-brass)" />
                <Bar dataKey="netCents" name="Net sales" fill="var(--color-ink)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex gap-2 text-sm">
            {(["net", "units", "profit", "margin"] as const).map((key) => (
              <button key={key} className={sort === key ? "underline" : "text-ash"} onClick={() => setSort(key)}>{key}</button>
            ))}
          </div>
          <div className="mt-3 overflow-auto bg-paper">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="text-xs text-ash uppercase">
                <tr>
                  {["Product", "SKU", "Price", "Cost", "Units", "Net", "Profit", "Margin", "Stock", "Refund", "Conversion"].map((heading) => (
                    <th key={heading} className="p-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.productId} className="border-t border-line">
                    <td className="p-3">{row.name}</td>
                    <td className="p-3">{row.sku}</td>
                    <td className="p-3 tabular-nums">{money(row.priceCents)}</td>
                    <td className="p-3 tabular-nums">{money(row.costCents)}</td>
                    <td className="p-3 tabular-nums">{row.units}</td>
                    <td className="p-3 tabular-nums">{money(row.netCents)}</td>
                    <td className="p-3 tabular-nums">{money(row.profitCents)}</td>
                    <td className="p-3">{pct(row.margin)}</td>
                    <td className="p-3 tabular-nums">{row.inventory}</td>
                    <td className="p-3">{pct(row.refundRate)}</td>
                    <td className="p-3">{row.views ? pct(row.conversion) : "Insufficient data"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2 className="mt-8 text-2xl">Purchase funnel</h2>
          <p className="mt-2 text-xs text-ash">Views, adds and checkout starts are session-days. Purchases are paid orders. They are not the same unit, and the page says so.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="View sessions" value={String(data.funnel.views)} />
            <Stat label="Add to bag" value={String(data.funnel.addToCart)} />
            <Stat label="Checkout started" value={String(data.funnel.checkoutStarted)} />
            <Stat label="Paid orders" value={String(data.funnel.purchases)} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <article className="bg-paper p-4"><p className="text-[11px] tracking-[0.14em] text-ash uppercase">{label}</p><p className="mt-2 text-2xl tabular-nums">{value}</p></article>;
}
