import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StoreShell } from "@/components/store/shell";
import { Button } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { quoteCart } from "@/lib/commerce/fns";
import { money } from "@/lib/format";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({ meta: [{ title: "Bag — ORRIS" }] }),
});

function CartPage() {
  const lines = useCart((state) => state.lines);
  const setQty = useCart((state) => state.setQty);
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof quoteCart>> | null>(null);
  const key = lines.map((line) => `${line.variantId}:${line.qty}`).join("|");
  useEffect(() => {
    let live = true;
    void quoteCart({ data: { lines } }).then((next) => live && setQuote(next));
    return () => {
      live = false;
    };
  }, [key, lines]);

  return (
    <StoreShell>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-4xl">Your bag</h1>
        {!quote || quote.lines.length === 0 ? (
          <p className="mt-6 text-sm text-ash">Nothing here yet. <Link to="/shop" className="underline">Browse the collection.</Link></p>
        ) : (
          <div className="mt-8">
            <ul className="divide-y divide-line border-y border-line">
              {quote.lines.map((line) => (
                <li key={line.variantId} className="flex gap-4 py-5">
                  <div className="h-28 w-24 bg-stone">{line.image ? <img src={line.image} alt={line.alt} className="h-full w-full object-cover" /> : null}</div>
                  <div className="flex-1">
                    <p>{line.name}</p>
                    <p className="text-sm text-ash">{line.title} · {line.sku}</p>
                    <p className="mt-1 tabular-nums">{money(line.priceCents)}</p>
                    {line.warning ? <p className="text-sm text-danger">{line.warning}</p> : null}
                    <div className="mt-3 flex items-center gap-3">
                      <button className="grid size-9 place-items-center border border-line" onClick={() => setQty(line.variantId, line.qty - 1)}>–</button>
                      <span className="tabular-nums">{line.qty}</span>
                      <button className="grid size-9 place-items-center border border-line" onClick={() => setQty(line.variantId, line.qty + 1)}>+</button>
                    </div>
                  </div>
                  <p className="tabular-nums">{money(line.priceCents * line.qty)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(quote.subtotalCents)}</span>
            </div>
            <p className="mt-2 text-sm text-ash">
              Standard shipping {quote.subtotalCents >= quote.thresholdCents ? "is complimentary." : `is ${money(quote.standardCents)}.`}
            </p>
            <Link to="/checkout" className="mt-6 inline-flex h-11 items-center bg-ink px-5 text-sm text-ivory">Continue to checkout</Link>
            <Button variant="text" className="ml-4" onClick={() => lines.forEach((line) => setQty(line.variantId, 0))}>Clear</Button>
          </div>
        )}
      </main>
    </StoreShell>
  );
}
