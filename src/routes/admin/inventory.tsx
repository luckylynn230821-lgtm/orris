import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminError } from "@/components/admin/frame";
import { adminAdjustStock, adminInventory } from "@/lib/commerce/fns";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/inventory")({
  component: InventoryPage,
  head: () => ({ meta: [{ title: "Inventory — ORRIS desk" }] }),
});

function InventoryPage() {
  const { t } = useT();
  const [data, setData] = useState<Awaited<ReturnType<typeof adminInventory>> | null>(null);
  const [error, setError] = useState("");
  const load = () => {
    void adminInventory().then(setData).catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
  };
  useEffect(load, []);
  return (
    <div>
      <h1 className="text-4xl">{t("admin.inventoryTitle")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ash">
        On-hand units and the cost value of that stock. Sample orders do not replay through this ledger. The opening balance is today's count. Sales, refunds and edits append after that.
      </p>
      {error ? <div className="mt-4"><AdminError message={error} /></div> : null}
      {data ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Units" value={String(data.summary.units)} />
            <Stat label="Cost value" value={money(data.summary.valueCents)} />
            <Stat label="Low" value={String(data.summary.low)} />
            <Stat label="Out" value={String(data.summary.out)} />
          </div>
          <div className="mt-6 overflow-auto bg-paper">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs text-ash uppercase"><tr><th className="p-3">Piece</th><th className="p-3">SKU</th><th className="p-3">On hand</th><th className="p-3">Value</th><th className="p-3">Adjust</th></tr></thead>
              <tbody>
                {data.variants.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="p-3">{row.productName} · {row.title}{row.out ? " · out" : row.low ? " · low" : ""}</td>
                    <td className="p-3">{row.sku}</td>
                    <td className="p-3 tabular-nums">{row.qty}</td>
                    <td className="p-3 tabular-nums">{money(row.valueCents)}</td>
                    <td className="p-3">
                      <button className="underline" onClick={() => {
                        const raw = window.prompt("Units to add (negative to remove)");
                        if (!raw) return;
                        void adminAdjustStock({ data: { variantId: row.id, delta: Number(raw), note: "Desk adjustment" } })
                          .then(() => { toast("Stock updated"); load(); })
                          .catch((err: unknown) => toast(err instanceof Error ? err.message : "Failed"));
                      }}>Adjust</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2 className="mt-8 text-2xl">Recent movements</h2>
          <ul className="mt-3 divide-y divide-line bg-paper text-sm">
            {data.movements.map((row, index) => (
              <li key={index} className="flex justify-between gap-3 px-3 py-2">
                <span>{row.productName} · {row.sku} · {row.reason}</span>
                <span className="tabular-nums">{row.delta > 0 ? "+" : ""}{row.delta}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <article className="bg-paper p-4"><p className="text-[11px] tracking-[0.14em] text-ash uppercase">{label}</p><p className="mt-2 text-xl tabular-nums">{value}</p></article>;
}
