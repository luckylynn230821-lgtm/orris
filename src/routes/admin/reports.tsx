import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RangeBar, useAnalytics } from "@/components/admin/analytics-view";
import { money, pct } from "@/lib/format";
import { toCsv, type RangeKey } from "@/lib/commerce/metrics";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports — ORRIS desk" }] }),
});

function ReportsPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [includeDemo, setIncludeDemo] = useState(true);
  const { data, error, loading } = useAnalytics(range, includeDemo);
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
      <h1 className="text-4xl">Reports</h1>
      <p className="mt-2 max-w-2xl text-sm text-ash">These files use the same figures as the analytics page. Export is available only after you are signed in as the administrator.</p>
      <div className="mt-6"><RangeBar range={range} setRange={setRange} includeDemo={includeDemo} setIncludeDemo={setIncludeDemo} /></div>
      {loading ? <p className="mt-6 text-sm text-ash">Preparing…</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {data ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="h-11 border border-line bg-paper px-4 text-sm" onClick={() => download("sales-summary.csv", toCsv(
            ["Gross", "Net", "Orders", "Units", "AOV", "Profit", "Margin", "Refunds", "Shipping", "Tax"],
            [[
              money(data.kpis.grossCents), money(data.kpis.netCents), data.kpis.orders, data.kpis.units,
              data.kpis.aovCents === null ? "" : money(data.kpis.aovCents), money(data.kpis.profitCents), pct(data.kpis.margin),
              money(data.kpis.refundCents), money(data.kpis.shippingCents), money(data.kpis.taxCents),
            ]],
          ))}>Sales summary</button>
          <button className="h-11 border border-line bg-paper px-4 text-sm" onClick={() => download("product-sales.csv", toCsv(
            ["Product", "SKU", "Units", "Net cents", "Profit cents", "Margin", "Refund rate", "Inventory"],
            data.products.map((row) => [row.name, row.sku, row.units, row.netCents, row.profitCents, row.margin ?? "", row.refundRate ?? "", row.inventory]),
          ))}>Product sales</button>
          <button className="h-11 border border-line bg-paper px-4 text-sm" onClick={() => download("profit.csv", toCsv(
            ["Product", "Net cents", "Profit cents", "Margin", "Cost cents"],
            data.products.map((row) => [row.name, row.netCents, row.profitCents, row.margin ?? "", row.costCents]),
          ))}>Profit</button>
        </div>
      ) : null}
    </div>
  );
}
