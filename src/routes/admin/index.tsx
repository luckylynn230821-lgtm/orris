import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RangeBar, useAnalytics } from "@/components/admin/analytics-view";
import { AdminError } from "@/components/admin/frame";
import { money, pct, growthLabel } from "@/lib/format";
import type { RangeKey } from "@/lib/commerce/metrics";

export const Route = createFileRoute("/admin/")({
  component: Overview,
  head: () => ({ meta: [{ title: "Overview — ORRIS desk" }] }),
});

function Overview() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [includeDemo, setIncludeDemo] = useState(true);
  const { data, error, loading } = useAnalytics(range, includeDemo);
  const k = data?.kpis;
  const cards = k
    ? [
        ["Gross sales", money(k.grossCents)],
        ["Net sales", money(k.netCents)],
        ["Orders", String(k.orders)],
        ["Units", String(k.units)],
        ["Average order", k.aovCents === null ? "—" : money(k.aovCents)],
        ["Gross profit", money(k.profitCents)],
        ["Gross margin", pct(k.margin)],
        ["Refunds", money(k.refundCents)],
        ["Refund rate", pct(k.refundRate)],
        ["Net sales change", growthLabel(k.growthNet)],
      ]
    : [];
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-ash uppercase">Overview</p>
          <h1 className="text-4xl">The books</h1>
        </div>
        <Link to="/" className="text-sm underline">View the shop</Link>
      </div>
      <div className="mt-6"><RangeBar range={range} setRange={setRange} includeDemo={includeDemo} setIncludeDemo={setIncludeDemo} /></div>
      {loading ? <p className="mt-8 text-sm text-ash">Adding the period…</p> : null}
      {error ? <div className="mt-6"><AdminError message={error} /></div> : null}
      {data ? (
        <>
          <p className="mt-4 max-w-3xl text-xs leading-5 text-ash">
            {data.definitions.net} {data.definitions.profit} Shipping collected {money(data.kpis.shippingCents)}. Tax {money(data.kpis.taxCents)}. These are not folded into net sales.
            {includeDemo ? " Sample history is included so the desk is not empty on day one." : " Sample history is hidden."}
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
                <Area dataKey="netCents" name="Net sales" stroke="var(--color-ink)" fill="var(--color-line)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
    </div>
  );
}
