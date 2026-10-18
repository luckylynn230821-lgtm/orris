import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StoreShell } from "@/components/store/shell";
import { lookupOrder } from "@/lib/commerce/fns";
import { money } from "@/lib/format";

type Search = { token?: string; email?: string };

export const Route = createFileRoute("/order/$number")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    token: typeof search.token === "string" ? search.token : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: OrderPage,
  head: () => ({ meta: [{ title: "Order — ORRIS" }, { name: "robots", content: "noindex" }] }),
});

function OrderPage() {
  const { number } = Route.useParams();
  const { token, email } = Route.useSearch();
  const [order, setOrder] = useState<Awaited<ReturnType<typeof lookupOrder>> | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void lookupOrder({ data: { number, token, email } }).then((result) => live && setOrder(result));
    return () => {
      live = false;
    };
  }, [number, token, email]);

  return (
    <StoreShell>
      <main className="mx-auto max-w-2xl px-4 py-14">
        {order === undefined ? <p className="text-sm text-ash">Looking up the order…</p> : null}
        {order === null ? (
          <div>
            <h1 className="text-4xl">We can't show that order.</h1>
            <p className="mt-3 text-sm text-ash">The link may be missing its private token. You can look it up with the order number and email.</p>
            <Link to="/orders" className="mt-6 inline-block text-sm underline">Find an order</Link>
          </div>
        ) : null}
        {order ? (
          <div>
            <p className="text-xs tracking-[0.18em] text-ash uppercase">Order {order.number}</p>
            <h1 className="mt-2 text-4xl">Thank you, {order.name.split(" ")[0]}.</h1>
            <p className="mt-3 text-sm text-ash">Payment is recorded as a demonstration. No card was charged. Stock has been reduced.</p>
            <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-ash">Payment</dt><dd className="capitalize">{order.paymentStatus}</dd></div>
              <div><dt className="text-ash">Fulfillment</dt><dd className="capitalize">{order.fulfillmentStatus}</dd></div>
              <div><dt className="text-ash">Shipping</dt><dd className="capitalize">{order.shippingMethod}</dd></div>
              <div><dt className="text-ash">Total</dt><dd className="tabular-nums">{money(order.totalCents)}</dd></div>
            </dl>
            <ul className="mt-8 divide-y divide-line border-y border-line text-sm">
              {order.items.map((item) => (
                <li key={item.sku + item.title} className="flex justify-between py-3">
                  <span>{item.name} · {item.title} × {item.qty}</span>
                  <span className="tabular-nums">{money(item.unitPriceCents * item.qty)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </main>
    </StoreShell>
  );
}
