import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminError } from "@/components/admin/frame";
import { adminAdjustStock, adminInventory } from "@/lib/commerce/fns";
import { money } from "@/lib/format";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/inventory")({
  component: InventoryPage,
  head: () => ({ meta: [{ title: "Inventory — Merchant desk" }] }),
});

function InventoryPage() {
  const { t, tx } = useT();
  const [data, setData] = useState<Awaited<ReturnType<typeof adminInventory>> | null>(null);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [delta, setDelta] = useState("");
  const [rowError, setRowError] = useState("");
  const load = () => {
    void adminInventory().then(setData).catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
  };
  useEffect(load, []);
  const save = (variantId: string) => {
    const value = Number(delta.trim());
    if (!Number.isInteger(value) || value === 0) {
      setRowError(t("desk.adjustBad"));
      return;
    }
    setRowError("");
    void adminAdjustStock({ data: { variantId, delta: value, note: t("desk.deskNote") } })
      .then(() => {
        toast(t("desk.stockUpdated"));
        setEditId(null);
        setDelta("");
        load();
      })
      .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
  };
  return (
    <div>
      <h1 className="text-4xl">{t("admin.inventoryTitle")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ash">
        {t("desk.inventoryIntro")} {data?.canSeeCost ? t("desk.inventoryCost") : ""}
      </p>
      {error ? <div className="mt-4"><AdminError message={error} /></div> : null}
      {data ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t("desk.units")} value={String(data.summary.units)} />
            {data.canSeeCost && data.summary.valueCents !== null ? <Stat label={t("desk.costValue")} value={money(data.summary.valueCents)} /> : null}
            <Stat label={t("desk.low")} value={String(data.summary.low)} />
            <Stat label={t("desk.out")} value={String(data.summary.out)} />
          </div>
          <div className="mt-6 overflow-auto bg-paper">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs text-ash uppercase"><tr><th className="p-3">{t("desk.piece")}</th><th className="p-3">{t("desk.sku")}</th><th className="p-3">{t("desk.onHand")}</th>{data.canSeeCost ? <th className="p-3">{t("desk.value")}</th> : null}<th className="p-3">{t("desk.adjust")}</th></tr></thead>
              <tbody>
                {data.variants.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="p-3">{row.productName} · {row.title}{row.out ? " · out" : row.low ? " · low" : ""}</td>
                    <td className="p-3">{row.sku}</td>
                    <td className="p-3 tabular-nums">{row.qty}</td>
                    {data.canSeeCost ? <td className="p-3 tabular-nums">{row.valueCents === null ? "—" : money(row.valueCents)}</td> : null}
                    <td className="p-3">
                      {data.canAdjust ? (
                        editId === row.id ? (
                          <form
                            className="flex flex-col items-start gap-1"
                            onSubmit={(event) => {
                              event.preventDefault();
                              save(row.id);
                            }}
                          >
                            <input
                              autoFocus
                              inputMode="numeric"
                              value={delta}
                              onChange={(event) => setDelta(event.target.value)}
                              placeholder="+1"
                              aria-label={t("desk.adjustPrompt")}
                              className="h-9 w-28 border border-line bg-ivory px-2"
                            />
                            <p className="max-w-[12rem] text-xs text-ash">{t("desk.adjustPrompt")}</p>
                            <div className="flex gap-3">
                              <button type="submit" className="underline">{t("desk.adjustApply")}</button>
                              <button
                                type="button"
                                className="text-ash underline"
                                onClick={() => {
                                  setEditId(null);
                                  setDelta("");
                                  setRowError("");
                                }}
                              >
                                {t("desk.adjustClose")}
                              </button>
                            </div>
                            {rowError ? <p className="max-w-[12rem] text-xs text-danger">{rowError}</p> : null}
                          </form>
                        ) : (
                          <button
                            type="button"
                            className="underline"
                            onClick={() => {
                              setEditId(row.id);
                              setDelta("");
                              setRowError("");
                            }}
                          >
                            {t("desk.adjust")}
                          </button>
                        )
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2 className="mt-8 text-2xl">{t("desk.movements")}</h2>
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
