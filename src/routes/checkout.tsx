import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StoreShell } from "@/components/store/shell";
import { Button, Field } from "@/components/ui";
import { ensureSessionKey, useCart } from "@/lib/cart";
import { checkout, quoteCart, trackEvent } from "@/lib/commerce/fns";
import { money } from "@/lib/format";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout — ORRIS" }] }),
});

function CheckoutPage() {
  const lines = useCart((state) => state.lines);
  const clear = useCart((state) => state.clear);
  const navigate = useNavigate();
  const { t, tx, copy } = useT();
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof quoteCart>> | null>(null);
  const [method, setMethod] = useState<"standard" | "express">("standard");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const key = lines.map((line) => `${line.variantId}:${line.qty}`).join("|");

  useEffect(() => {
    let live = true;
    void quoteCart({ data: { lines } }).then((next) => live && setQuote(next));
    const sessionKey = ensureSessionKey();
    const productId = undefined;
    void productId;
    if (lines[0]) {
      void quoteCart({ data: { lines } }).then((next) => {
        const id = next.lines.find((line) => line.productId)?.productId;
        if (id) void trackEvent({ data: { productId: id, event: "checkout_started", sessionKey } });
      });
    }
    return () => {
      live = false;
    };
  }, [key, lines]);

  const shipping = method === "express" ? (quote?.expressCents ?? 0) : (quote?.standardCents ?? 0);
  const total = (quote?.subtotalCents ?? 0) + shipping;

  return (
    <StoreShell>
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.2fr_0.8fr] md:px-6">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const idem = sessionStorage.getItem("orris-idem") || crypto.randomUUID();
            sessionStorage.setItem("orris-idem", idem);
            setPending(true);
            setError("");
            void checkout({
              data: {
                email: String(form.get("email") || ""),
                name: String(form.get("name") || ""),
                line1: String(form.get("line1") || ""),
                city: String(form.get("city") || ""),
                region: String(form.get("region") || ""),
                postal: String(form.get("postal") || ""),
                country: String(form.get("country") || ""),
                shippingMethod: method,
                lines: lines.map((line) => ({ variantId: line.variantId, qty: line.qty })),
                idempotencyKey: idem,
              },
            })
              .then((result) => {
                sessionStorage.removeItem("orris-idem");
                clear();
                void navigate({ to: "/order/$number", params: { number: result.number }, search: { token: result.token } });
              })
              .catch((err: unknown) => setError(err instanceof Error ? localize(err.message, tx) : t("checkout.failed")))
              .finally(() => setPending(false));
          }}
        >
          <h1 className="text-4xl">{t("checkout.title")}</h1>
          <p className="text-sm leading-6 text-ash">{t("checkout.demo")}</p>
          <Field label={t("checkout.email")} name="email" type="email" required autoComplete="email" />
          <Field label={t("checkout.name")} name="name" required autoComplete="name" />
          <Field label={t("checkout.address")} name="line1" required autoComplete="address-line1" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("checkout.city")} name="city" required />
            <Field label={t("checkout.region")} name="region" required />
            <Field label={t("checkout.postal")} name="postal" required />
            <Field label={t("checkout.country")} name="country" required defaultValue="United States" />
          </div>
          <fieldset className="space-y-2 pt-2">
            <legend className="text-xs tracking-[0.14em] text-ash uppercase">{t("checkout.shipping")}</legend>
            <label className="flex items-center justify-between border border-line p-3 text-sm">
              <span><input type="radio" name="ship" checked={method === "standard"} onChange={() => setMethod("standard")} /> {t("checkout.standard")}</span>
              <span className="tabular-nums">{shipping === 0 && method === "standard" ? t("checkout.free") : money(quote?.standardCents ?? 0)}</span>
            </label>
            <label className="flex items-center justify-between border border-line p-3 text-sm">
              <span><input type="radio" name="ship" checked={method === "express"} onChange={() => setMethod("express")} /> {t("checkout.express")}</span>
              <span className="tabular-nums">{money(quote?.expressCents ?? 0)}</span>
            </label>
          </fieldset>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending || !quote?.lines.length}>{pending ? t("checkout.placing") : t("checkout.place")}</Button>
        </form>
        <aside className="h-fit border border-line bg-paper p-5">
          <h2 className="text-2xl">{t("checkout.summary")}</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {quote?.lines.map((line) => (
              <li key={line.variantId} className="flex justify-between gap-3">
                <span>{copy(line.name)} × {line.qty}</span>
                <span className="tabular-nums">{money(line.priceCents * line.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt>{t("checkout.subtotal")}</dt><dd className="tabular-nums">{money(quote?.subtotalCents ?? 0)}</dd></div>
            <div className="flex justify-between"><dt>{t("checkout.shipping")}</dt><dd className="tabular-nums">{money(shipping)}</dd></div>
            <div className="flex justify-between"><dt>{t("checkout.tax")}</dt><dd className="tabular-nums">{money(0)}</dd></div>
            <div className="flex justify-between text-base"><dt>{t("checkout.total")}</dt><dd className="tabular-nums">{money(total)}</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-ash">{t("checkout.taxNote")}</p>
        </aside>
      </main>
    </StoreShell>
  );
}
