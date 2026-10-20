import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RangeBar, useAnalytics } from "@/components/admin/analytics-view";
import { AdminError, useDeskAccess } from "@/components/admin/frame";
import { adminFloor } from "@/lib/commerce/fns";
import { money, pct, growthLabel } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { RangeKey } from "@/lib/commerce/metrics";

export const Route = createFileRoute("/admin/")({
  component: Overview,
  head: () => ({ meta: [{ title: "Overview — Merchant desk" }] }),
});

function Overview() {
  const access = useDeskAccess();
  const { t } = useT();
  if (!access?.permissions.money) {
    if (access?.permissions.catalog) return <ManagerOverview />;
    return (
      <div>
        <h1 className="text-4xl">{t("admin.staffHome")}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ash">{t("admin.staffHomeBody")}</p>
        <div className="mt-6 flex gap-4 text-sm">
          <Link to="/admin/orders" className="underline">{t("admin.orders")}</Link>
        </div>
      </div>
    );
  }
  return <MoneyOverview />;
}

function ManagerOverview() {
  const { t } = useT();
  const [data, setData] = useState<Awaited<ReturnType<typeof adminFloor>> | null>(null);
  const [error, setError] = useState("");
  const [sortMode, setSortMode] = useState<"asc" | "desc" | "name">("asc");
  useEffect(() => {
    void adminFloor()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
  }, []);
  const rows = [...(data?.rows ?? [])].sort((a, b) => {
    if (sortMode === "name") return a.name.localeCompare(b.name);
    if (sortMode === "desc") return b.qty - a.qty || a.name.localeCompare(b.name);
    return a.qty - b.qty || a.name.localeCompare(b.name);
  });
  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-ash uppercase">{t("admin.overview")}</p>
      <h1 className="text-4xl">{t("admin.managerHome")}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ash">{t("admin.managerHomeBody")}</p>
      {error ? <div className="mt-4"><AdminError message={error} /></div> : null}
      {data ? (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <article className="bg-paper p-6">
              <p className="text-[11px] tracking-[0.16em] text-ash uppercase">{t("desk.floorUnits")}</p>
              <p className="mt-3 text-5xl tabular-nums">{data.units}</p>
            </article>
            <article className="bg-ink p-6 text-ivory">
              <p className="text-[11px] tracking-[0.16em] text-ivory/70 uppercase">{t("desk.floorRetail")}</p>
              <p className="mt-3 text-5xl tabular-nums">{money(data.retailCents)}</p>
            </article>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <article className="bg-paper p-4">
              <p className="text-[11px] tracking-[0.14em] text-ash uppercase">{t("desk.low")}</p>
              <p className="mt-2 text-2xl tabular-nums">{data.low}</p>
            </article>
            <article className="bg-paper p-4">
              <p className="text-[11px] tracking-[0.14em] text-ash uppercase">{t("desk.out")}</p>
              <p className="mt-2 text-2xl tabular-nums">{data.out}</p>
            </article>
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-5 text-ash">{t("desk.floorNote")}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {(["asc", "desc", "name"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={mode === sortMode ? "h-11 border border-ink bg-paper px-3 text-sm" : "h-11 border border-line bg-paper px-3 text-sm"}
                onClick={() => setSortMode(mode)}
              >
                {t(mode === "asc" ? "desk.sortAsc" : mode === "desc" ? "desk.sortDesc" : "desk.sortName")}
              </button>
            ))}
          </div>
          <div className="mt-4 overflow-auto bg-paper">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs text-ash uppercase">
                <tr>
                  <th className="p-3">{t("desk.piece")}</th>
                  <th className="p-3">{t("desk.sku")}</th>
                  <th className="p-3">{t("desk.onHand")}</th>
                  <th className="p-3">{t("desk.price")}</th>
                  <th className="p-3">{t("desk.floorLine")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="p-3">{row.name}{row.out ? ` · ${t("desk.out")}` : row.low ? ` · ${t("desk.low")}` : ""}</td>
                    <td className="p-3">{row.sku}</td>
                    <td className="p-3 tabular-nums">{row.qty}</td>
                    <td className="p-3 tabular-nums">{money(row.priceCents)}</td>
                    <td className="p-3 tabular-nums">{money(row.retailCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex gap-4 text-sm">
            <Link to="/admin/products" className="underline">{t("admin.products")}</Link>
            <Link to="/admin/orders" className="underline">{t("admin.orders")}</Link>
            <Link to="/admin/customers" className="underline">{t("admin.customers")}</Link>
          </div>
        </>
      ) : error ? null : <p className="mt-8 text-sm text-ash">{t("admin.adding")}</p>}
    </div>
  );
}

function MoneyOverview() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [includeDemo, setIncludeDemo] = useState(false);
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
            {t("desk.defNet")} {t("desk.defProfit")} {t("admin.shippingCollected", { amount: money(data.kpis.shippingCents) })} {t("admin.taxCollected", { amount: money(data.kpis.taxCents) })} {t("admin.notInNet")}
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
