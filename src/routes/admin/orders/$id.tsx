import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui";
import { adminCancel, adminFulfill, adminOrder, adminRefund } from "@/lib/commerce/fns";
import { dollarsToCents, money } from "@/lib/format";

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDesk,
  head: () => ({ meta: [{ title: "Order — ORRIS desk" }] }),
});

function OrderDesk() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<Awaited<ReturnType<typeof adminOrder>> | null>(null);
  const [ready, setReady] = useState(false);
  const load = () => {
    void adminOrder({ data: { id } }).then((value) => {
      setOrder(value);
      setReady(true);
    });
  };
  useEffect(load, [id]);
  if (!ready) return <p className="text-sm text-ash">Loading…</p>;
  if (!order) return <p>Order not found.</p>;
  const remaining = order.totalCents - order.refundedCents;
  return (
    <div className="max-w-3xl">
      <p className="text-xs tracking-[0.16em] text-ash uppercase">{order.isDemo ? "Sample order" : "Live order"}</p>
      <h1 className="text-4xl">{order.number}</h1>
      <p className="mt-2 text-sm">{order.name} · {order.email}</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div><dt className="text-ash">Status</dt><dd className="capitalize">{order.status}</dd></div>
        <div><dt className="text-ash">Payment</dt><dd className="capitalize">{order.paymentStatus}</dd></div>
        <div><dt className="text-ash">Fulfillment</dt><dd className="capitalize">{order.fulfillmentStatus}</dd></div>
        <div><dt className="text-ash">Still paid</dt><dd className="tabular-nums">{money(remaining)}</dd></div>
      </dl>
      <ul className="mt-6 divide-y divide-line border-y border-line text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between py-3">
            <span>{item.name} · {item.title} · {item.sku} × {item.qty}</span>
            <span className="tabular-nums">{money(item.unitPriceCents * item.qty)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ash">Subtotal {money(order.subtotalCents)} · Shipping {money(order.shippingCents)} · Tax {money(order.taxCents)} · Refunded {money(order.refundedCents)}</p>
      <form
        className="mt-8 grid gap-3 border border-line bg-paper p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void adminFulfill({ data: { id: order.id, carrier: String(form.get("carrier") || ""), tracking: String(form.get("tracking") || "") } })
            .then(() => { toast("Marked fulfilled"); load(); })
            .catch((err: unknown) => toast(err instanceof Error ? err.message : "Failed"));
        }}
      >
        <h2 className="text-2xl">Fulfill</h2>
        <Field label="Carrier" name="carrier" />
        <Field label="Tracking" name="tracking" />
        <Button type="submit">Mark fulfilled</Button>
      </form>
      <form
        className="mt-4 grid gap-3 border border-line bg-paper p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void adminRefund({
            data: {
              id: order.id,
              amountCents: dollarsToCents(String(form.get("amount") || "0")),
              reason: String(form.get("reason") || ""),
              restock: form.get("restock") === "on",
            },
          })
            .then(() => { toast("Refund recorded"); load(); })
            .catch((err: unknown) => toast(err instanceof Error ? err.message : "Failed"));
        }}
      >
        <h2 className="text-2xl">Refund</h2>
        <p className="text-xs text-ash">A full refund can return every remaining unit to stock. A partial refund changes the books only.</p>
        <Field label="Amount" name="amount" placeholder={(remaining / 100).toFixed(2)} />
        <Field label="Reason" name="reason" />
        <label className="text-sm"><input type="checkbox" name="restock" /> Restock if this clears the balance</label>
        <Button type="submit">Record refund</Button>
      </form>
      <button
        className="mt-4 text-sm text-danger underline"
        onClick={() => {
          if (!window.confirm("Cancel this order and refund what is still paid?")) return;
          void adminCancel({ data: { id: order.id } }).then(() => { toast("Cancelled"); load(); });
        }}
      >
        Cancel order
      </button>
    </div>
  );
}
