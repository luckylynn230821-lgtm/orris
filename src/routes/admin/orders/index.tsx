import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { adminOrders } from "@/lib/commerce/fns";
import { money } from "@/lib/format";
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
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("queue");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminOrders>>>([]);
  useEffect(() => {
    const handle = setTimeout(() => {
      void adminOrders({ data: { q } }).then(setRows).catch(() => setRows([]));
    }, 200);
    const timer = setInterval(() => {
      void adminOrders({ data: { q } }).then(setRows).catch(() => setRows([]));
    }, 4000);
    return () => {
      clearTimeout(handle);
      clearInterval(timer);
    };
  }, [q]);
  const visible = rows.filter((order) => {
    if (filter === "all") return true;
    if (filter === "queue") return order.stageKey === "unpaid" || order.stageKey === "toship";
    if (filter === "toreceive") return order.stageKey === "toreceive";
    return order.stageKey === filter;
  });
  return (
    <div>
      <h1 className="text-4xl">{t("admin.orders")}</h1>
      <p className="mt-2 max-w-xl text-sm text-ash">{t("admin.ordersIntro")}</p>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("admin.search")} className="mt-6 h-11 w-full max-w-sm border border-line bg-paper px-3" />
      <div className="mt-4 flex gap-2 overflow-auto">
        {FILTERS.map((key) => (
          <button key={key} className={key === filter ? "h-11 shrink-0 border border-ink px-3 text-sm" : "h-11 shrink-0 border border-line px-3 text-sm"} onClick={() => setFilter(key)}>
            {t((key === "all" ? "admin.all" : key === "queue" ? "admin.queue" : key === "toship" ? "admin.toship" : key === "toreceive" ? "admin.transit" : "admin.aftersales") as MessageKey)}
          </button>
        ))}
      </div>
      <div className="mt-4 overflow-auto bg-paper">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-ash uppercase"><tr><th className="p-3">{t("admin.colOrder")}</th><th className="p-3">{t("admin.colCustomer")}</th><th className="p-3">{t("admin.colCustomerSees")}</th><th className="p-3">{t("admin.colMerchant")}</th><th className="p-3">{t("admin.colTotal")}</th></tr></thead>
          <tbody>
            {visible.map((order) => (
              <tr key={order.id} className="border-t border-line">
                <td className="p-3"><Link to="/admin/orders/$id" params={{ id: order.id }} className="underline">{order.number}</Link>{order.isDemo ? <span className="ml-2 text-xs text-ash">{t("admin.sample")}</span> : null}</td>
                <td className="p-3">{order.name}<br /><span className="text-ash">{order.email}</span></td>
                <td className="p-3">{tx(order.stageLabel)}</td>
                <td className="p-3">{tx(order.adminLabel)}</td>
                <td className="p-3 tabular-nums">{money(order.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
