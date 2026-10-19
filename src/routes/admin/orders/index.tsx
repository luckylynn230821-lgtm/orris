import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDeskAccess } from "@/components/admin/frame";
import { adminAccept, adminAcceptMany, adminCarriers, adminFulfill, adminOrders } from "@/lib/commerce/fns";
import { detectCarrier } from "@/lib/commerce/shipping";
import { money } from "@/lib/format";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translate";

const FILTERS = ["all", "queue", "toship", "toreceive", "aftersales"] as const;

export const Route = createFileRoute("/admin/orders/")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "Orders — Merchant desk" }] }),
});

function OrdersPage() {
  const [q, setQ] = useState("");
  const { t, tx } = useT();
  const access = useDeskAccess();
  const canFulfill = access?.permissions.fulfill ?? false;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("queue");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminOrders>>>([]);
  const [carriers, setCarriers] = useState<Awaited<ReturnType<typeof adminCarriers>>["carriers"]>([]);
  const [busy, setBusy] = useState("");
  const [shipId, setShipId] = useState<string | null>(null);
  const [carrierId, setCarrierId] = useState("");
  const [tracking, setTracking] = useState("");
  const reload = () => {
    void adminOrders({ data: { q } }).then(setRows).catch(() => setRows([]));
  };
  useEffect(() => {
    const handle = setTimeout(reload, 200);
    const timer = setInterval(reload, 4000);
    return () => {
      clearTimeout(handle);
      clearInterval(timer);
    };
  }, [q]);
  useEffect(() => {
    if (!canFulfill) return;
    void adminCarriers().then((value) => setCarriers(value.carriers)).catch(() => setCarriers([]));
  }, [canFulfill]);
  const visible = rows.filter((order) => {
    if (filter === "all") return true;
    if (filter === "queue") return order.stageKey === "unpaid" || order.stageKey === "toship";
    if (filter === "toreceive") return order.stageKey === "toreceive";
    return order.stageKey === filter;
  });
  const waiting = visible.filter((order) => order.stageKey === "toship" && !order.accepted);
  const fail = (err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed"));
  const acceptOne = (id: string) => {
    if (busy) return;
    setBusy(id);
    void adminAccept({ data: { id } })
      .then(() => {
        toast(t("desk.acceptedToast"));
        toast(t("desk.mailerOff"));
        reload();
      })
      .catch(fail)
      .finally(() => setBusy(""));
  };
  const acceptAll = () => {
    if (busy || waiting.length === 0) return;
    setBusy("all");
    void adminAcceptMany({ data: { ids: waiting.slice(0, 50).map((order) => order.id) } })
      .then((value) => {
        toast(t("desk.handledCount", { count: value.count }));
        toast(t("desk.mailerOff"));
        reload();
      })
      .catch(fail)
      .finally(() => setBusy(""));
  };
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">{t("admin.orders")}</h1>
          <p className="mt-2 max-w-xl text-sm text-ash">{t("admin.ordersIntro")}</p>
        </div>
        {canFulfill ? (
          <button
            type="button"
            disabled={waiting.length === 0 || busy === "all"}
            className="h-11 shrink-0 bg-ink px-4 text-sm text-ivory disabled:opacity-40"
            onClick={acceptAll}
          >
            {t("desk.handleAll")}{waiting.length > 0 ? ` · ${waiting.length}` : ""}
          </button>
        ) : null}
      </div>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("admin.search")} className="mt-6 h-11 w-full max-w-sm border border-line bg-paper px-3" />
      <div className="mt-4 flex gap-2 overflow-auto">
        {FILTERS.map((key) => (
          <button key={key} className={key === filter ? "h-11 shrink-0 border border-ink px-3 text-sm" : "h-11 shrink-0 border border-line px-3 text-sm"} onClick={() => setFilter(key)}>
            {t((key === "all" ? "admin.all" : key === "queue" ? "admin.queue" : key === "toship" ? "admin.toship" : key === "toreceive" ? "admin.transit" : "admin.aftersales") as MessageKey)}
          </button>
        ))}
      </div>
      <div className="mt-4 overflow-auto bg-paper">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="text-xs text-ash uppercase"><tr><th className="p-3">{t("admin.colOrder")}</th><th className="p-3">{t("admin.colCustomer")}</th><th className="p-3">{t("admin.colCustomerSees")}</th><th className="p-3">{t("admin.colMerchant")}</th><th className="p-3">{t("admin.colTotal")}</th></tr></thead>
          <tbody>
            {visible.map((order) => (
              <tr key={order.id} className="border-t border-line align-top">
                <td className="p-3"><Link to="/admin/orders/$id" params={{ id: order.id }} className="underline">{order.number}</Link>{order.isDemo ? <span className="ml-2 text-xs text-ash">{t("admin.sample")}</span> : null}</td>
                <td className="p-3">{order.name}<br /><span className="text-ash">{order.email}</span></td>
                <td className="p-3">{tx(order.stageLabel)}</td>
                <td className="p-3">
                  <div>{tx(order.adminLabel)}</div>
                  {canFulfill && order.stageKey === "toship" ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {order.accepted ? (
                        <span className="text-xs text-ash">{t("desk.acceptedMark")}</span>
                      ) : (
                        <button type="button" disabled={busy === order.id} className="h-9 border border-ink px-3 text-xs" onClick={() => acceptOne(order.id)}>
                          {t("desk.handle")}
                        </button>
                      )}
                      {shipId === order.id ? (
                        <form
                          className="grid w-full max-w-xs gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (busy) return;
                            setBusy(order.id);
                            void adminFulfill({
                              data: {
                                id: order.id,
                                carrier: "",
                                tracking,
                                carrierId: carrierId || undefined,
                              },
                            })
                              .then(() => {
                                toast(t("admin.shippedToast"));
                                toast(t("desk.mailerOff"));
                                setShipId(null);
                                setTracking("");
                                reload();
                              })
                              .catch(fail)
                              .finally(() => setBusy(""));
                          }}
                        >
                          <select value={carrierId} onChange={(event) => setCarrierId(event.target.value)} className="h-9 w-full border border-line bg-ivory px-2 text-xs">
                            <option value="">{t("desk.typeCarrier")}</option>
                            {carriers.filter((row) => row.active).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                          </select>
                          <input
                            value={tracking}
                            onChange={(event) => setTracking(event.target.value)}
                            placeholder={t("admin.tracking")}
                            className="h-9 w-full border border-line bg-ivory px-2 text-xs"
                          />
                          {tracking.trim() ? <p className="text-xs text-ash">{t("desk.detected", { carrier: detectCarrier(tracking).carrier })}</p> : null}
                          <div className="flex gap-2">
                            <button type="submit" disabled={busy === order.id} className="h-9 bg-ink px-3 text-xs text-ivory disabled:opacity-40">{t("admin.shipAction")}</button>
                            <button type="button" className="h-9 px-2 text-xs underline" onClick={() => setShipId(null)}>{t("desk.collapse")}</button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="h-9 border border-line px-3 text-xs"
                          onClick={() => {
                            setShipId(order.id);
                            setCarrierId("");
                            setTracking("");
                          }}
                        >
                          {t("desk.shipHere")}
                        </button>
                      )}
                    </div>
                  ) : null}
                </td>
                <td className="p-3 tabular-nums">{money(order.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
