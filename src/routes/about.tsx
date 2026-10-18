import { createFileRoute, Link } from "@tanstack/react-router";
import { StoreShell } from "@/components/store/shell";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "The house — ORRIS" },
      { name: "description", content: "ORRIS is a single-house shop for goods meant to be kept, repaired and accounted for." },
    ],
  }),
});

function AboutPage() {
  return (
    <StoreShell>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-xs tracking-[0.2em] text-brass uppercase">The house</p>
        <h1 className="mt-3 text-5xl">A shop with books, not a brochure.</h1>
        <div className="mt-8 space-y-5 text-base leading-8 text-ink/85">
          <p>
            ORRIS sells a short list of textiles, clothes, ceramic, scent and leather. The merchant desk behind it
            records price, cost, stock and orders in one database. What you see on this page is that record, not a pasted catalogue.
          </p>
          <p>
            Checkout on this template is a demonstration rail. It checks price and stock on the server, writes an order,
            a payment row and an inventory movement, and never pretends a card was charged. A live card processor can replace that rail
            without changing the books.
          </p>
          <p>
            The first person to sign in at the merchant desk becomes the administrator. Everyone else can browse, and can see only
            their own orders when they are signed in. Cost, margin and other customers stay off the public pages.
          </p>
        </div>
        <Link to="/shop" className="mt-8 inline-block text-sm underline underline-offset-4">Shop the collection</Link>
      </main>
    </StoreShell>
  );
}
