import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminError } from "@/components/admin/frame";
import { Button } from "@/components/ui";
import { adminAdjustStock, adminInventory } from "@/lib/commerce/fns";
import { money } from "@/lib/format";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/inventory")({
  component: InventoryPage,
  head: () => ({ meta: [{ title: "Inventory — Merchant desk" }] }),
});

type Row = Awaited<ReturnType<typeof adminInventory>>["variants"][number];
type SortMode = "still" | "asc" | "desc";

function InventoryPage() {
  const { t, tx } = useT();
  const [data, setData] = useState<Awaited<ReturnType<typeof adminInventory>> | null>(null);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [delta, setDelta] = useState("");
  const [rowError, setRowError] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("still");
  const [frozen, setFrozen] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);
  const load = () => {
    void adminInventory().then(setData).catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
  };
  useEffect(load, []);
  useEffect(() => {
    if (!data) return;
    setFrozen((prev) => {
      const ids = new Set(data.variants.map((row) => row.id));
      const base = prev.length > 0 ? prev : data.variants.map((row) => row.id);
      const kept = base.filter((id) => ids.has(id));
      const extra = data.variants.map((row) => row.id).filter((id) => !kept.includes(id));
      return [...kept, ...extra];
    });
  }, [data]);
  const rows = arrange(data?.variants ?? [], sortMode, frozen);
  const save = (variantId: string) => {
    const value = Number(delta.trim());
    if (!Number.isInteger(value) || value === 0) {
      setRowError(t("desk.adjustBad"));
      return;
    }
    setRowError("");
    void adminAdjustStock({ data: { variantId, delta: value, note: t("desk.deskNote") } })
      .then(() => {
        const signed = value > 0 ? `+${value}` : String(value);
        toast(t("desk.stockUpdated"));
        setNotice({ id: variantId, text: t("desk.adjustDone", { delta: signed }) });
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
          <div className="mt-6 flex flex-wrap gap-2">
            {(["still", "asc", "desc"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={mode === sortMode ? "h-11 border border-ink bg-paper px-3 text-sm" : "h-11 border border-line bg-paper px-3 text-sm"}
                onClick={() => setSortMode(mode)}
              >
                {t(mode === "still" ? "desk.sortStill" : mode === "asc" ? "desk.sortAsc" : "desk.sortDesc")}
              </button>
            ))}
          </div>
          <div className="mt-4 overflow-auto bg-paper">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-ash uppercase"><tr><th className="p-3">{t("desk.piece")}</th><th className="p-3">{t("desk.sku")}</th><th className="p-3">{t("desk.onHand")}</th>{data.canSeeCost ? <th className="p-3">{t("desk.value")}</th> : null}<th className="p-3">{t("desk.adjust")}</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={notice?.id === row.id ? "border-t border-line bg-stone" : "border-t border-line"}>
                    <td className="p-3">{row.productName} · {row.title}{row.out ? " · out" : row.low ? " · low" : ""}</td>
                    <td className="p-3">{row.sku}</td>
                    <td className="p-3 tabular-nums">{row.qty}</td>
                    {data.canSeeCost ? <td className="p-3 tabular-nums">{row.valueCents === null ? "—" : money(row.valueCents)}</td> : null}
                    <td className="p-3">
                      {data.canAdjust ? (
                        editId === row.id ? (
                          <form
                            className="flex min-w-44 flex-col items-start gap-2"
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
                            <p className="max-w-[14rem] text-xs text-ash">{t("desk.adjustPrompt")}</p>
                            <div className="flex gap-2">
                              <Button type="submit" className="h-9 px-3">{t("desk.adjustApply")}</Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-9 px-3"
                                onClick={() => {
                                  setEditId(null);
                                  setDelta("");
                                  setRowError("");
                                }}
                              >
                                {t("desk.adjustClose")}
                              </Button>
                            </div>
                            {rowError ? <p className="max-w-[14rem] text-xs text-danger">{rowError}</p> : null}
                          </form>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-9 px-3"
                              onClick={() => {
                                setEditId(row.id);
                                setDelta("");
                                setRowError("");
                              }}
                            >
                              {t("desk.adjust")}
                            </Button>
                            {notice?.id === row.id ? <p className="text-xs text-ash">{notice.text}</p> : null}
                          </div>
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

function arrange(rows: Row[], mode: SortMode, frozen: string[]) {
  if (mode === "asc") return [...rows].sort((a, b) => a.qty - b.qty || a.sku.localeCompare(b.sku));
  if (mode === "desc") return [...rows].sort((a, b) => b.qty - a.qty || a.sku.localeCompare(b.sku));
  const index = new Map(frozen.map((id, place) => [id, place]));
  return [...rows].sort((a, b) => (index.get(a.id) ?? 9999) - (index.get(b.id) ?? 9999));
}

function Stat({ label, value }: { label: string; value: string }) {
  return <article className="bg-paper p-4"><p className="text-[11px] tracking-[0.14em] text-ash uppercase">{label}</p><p className="mt-2 text-xl tabular-nums">{value}</p></article>;
}