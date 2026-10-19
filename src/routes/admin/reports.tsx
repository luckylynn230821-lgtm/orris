import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RangeBar, useAnalytics } from "@/components/admin/analytics-view";
import { adminSettings } from "@/lib/commerce/fns";
import { money, pct } from "@/lib/format";
import { toCsv, type RangeKey } from "@/lib/commerce/metrics";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports — Merchant desk" }] }),
});

function ReportsPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [includeDemo, setIncludeDemo] = useState(true);
  const { data, error, loading } = useAnalytics(range, includeDemo);
  const { t } = useT();
  const [rates, setRates] = useState<{ vat: number; importTax: number } | null>(null);
  useEffect(() => {
    void adminSettings()
      .then((settings) => setRates({ vat: settings.vatRate ?? 0, importTax: settings.importTaxRate ?? 0 }))
      .catch(() => setRates(null));
  }, []);
  const download = (name: string, csv: string) => {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div>
      <h1 className="text-4xl">{t("admin.reportsTitle")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ash">{t("desk.reportsIntro")}</p>
      <div className="mt-6"><RangeBar range={range} setRange={setRange} includeDemo={includeDemo} setIncludeDemo={setIncludeDemo} /></div>
      {loading ? <p className="mt-6 text-sm text-ash">{t("desk.preparing")}</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {data ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="h-11 border border-line bg-paper px-4 text-sm" onClick={() => download("sales-summary.csv", toCsv(
            [t("admin.gross"), t("admin.net"), t("admin.orderCount"), t("admin.units"), t("admin.aov"), t("admin.profit"), t("admin.margin"), t("admin.refunds"), t("desk.standardShip"), t("desk.taxTitle")],
            [[
              money(data.kpis.grossCents), money(data.kpis.netCents), data.kpis.orders, data.kpis.units,
              data.kpis.aovCents === null ? "" : money(data.kpis.aovCents), money(data.kpis.profitCents), pct(data.kpis.margin),
              money(data.kpis.refundCents), money(data.kpis.shippingCents), money(data.kpis.taxCents),
            ]],
          ))}>{t("desk.salesSummary")}</button>
          <button className="h-11 border border-line bg-paper px-4 text-sm" onClick={() => download("product-sales.csv", toCsv(
            [t("desk.product"), t("desk.sku"), t("desk.units"), t("desk.net"), t("desk.profit"), t("desk.margin"), t("desk.refund"), t("desk.stock")],
            data.products.map((row) => [row.name, row.sku, row.units, row.netCents, row.profitCents, row.margin ?? "", row.refundRate ?? "", row.inventory]),
          ))}>{t("desk.productSales")}</button>
          <button className="h-11 border border-line bg-paper px-4 text-sm" onClick={() => download("profit.csv", toCsv(
            [t("desk.product"), t("desk.net"), t("desk.profit"), t("desk.margin"), t("desk.cost")],
            data.products.map((row) => [row.name, row.netCents, row.profitCents, row.margin ?? "", row.costCents]),
          ))}>{t("desk.profitFile")}</button>
          {rates ? (
            <button className="h-11 border border-line bg-paper px-4 text-sm" onClick={() => download("tax.csv", toCsv(
              [t("desk.taxCollected"), t("desk.vatEstimate"), t("desk.importEstimate")],
              [[
                money(data.kpis.taxCents),
                money(Math.round(data.kpis.netCents * rates.vat)),
                money(Math.round(data.kpis.netCents * rates.importTax)),
              ]],
            ))}>{t("desk.taxTitle")}</button>
          ) : null}
        </div>
      ) : null}
      {data && rates ? (
        <section className="mt-8 max-w-3xl">
          <h2 className="text-2xl">{t("desk.taxTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-ash">{t("desk.taxNote")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="bg-paper p-4"><p className="text-xs text-ash uppercase">{t("desk.taxCollected")}</p><p className="mt-2 text-xl tabular-nums">{money(data.kpis.taxCents)}</p></article>
            <article className="bg-paper p-4"><p className="text-xs text-ash uppercase">{t("desk.vatEstimate")}</p><p className="mt-2 text-xl tabular-nums">{money(Math.round(data.kpis.netCents * rates.vat))}</p></article>
            <article className="bg-paper p-4"><p className="text-xs text-ash uppercase">{t("desk.importEstimate")}</p><p className="mt-2 text-xl tabular-nums">{money(Math.round(data.kpis.netCents * rates.importTax))}</p></article>
          </div>
        </section>
      ) : null}
    </div>
  );
}
