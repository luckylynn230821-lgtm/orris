import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { adminOrders } from "@/lib/commerce/fns";
import { money } from "@/lib/format";

export const Route = createFileRoute("/admin/orders/")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "Orders — ORRIS desk" }] }),
});

function OrdersPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminOrders>>>([]);
  useEffect(() => {
    const handle = setTimeout(() => {
      void adminOrders({ data: { q } }).then(setRows).catch(() => setRows([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);
  return (
    <div>
      <h1 className="text-4xl">Orders</h1>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Number, name or email" className="mt-6 h-11 w-full max-w-sm border border-line bg-paper px-3" />
      <div className="mt-4 overflow-auto bg-paper">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-ash uppercase"><tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Payment</th><th className="p-3">Fulfillment</th><th className="p-3">Total</th></tr></thead>
          <tbody>
            {rows.map((order) => (
              <tr key={order.id} className="border-t border-line">
                <td className="p-3"><Link to="/admin/orders/$id" params={{ id: order.id }} className="underline">{order.number}</Link>{order.isDemo ? <span className="ml-2 text-xs text-ash">Sample</span> : null}</td>
                <td className="p-3">{order.name}<br /><span className="text-ash">{order.email}</span></td>
                <td className="p-3 capitalize">{order.paymentStatus}</td>
                <td className="p-3 capitalize">{order.fulfillmentStatus}</td>
                <td className="p-3 tabular-nums">{money(order.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
