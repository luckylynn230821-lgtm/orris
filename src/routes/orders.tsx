import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { StoreShell } from "@/components/store/shell";
import { Button, Field } from "@/components/ui";
import { lookupOrder } from "@/lib/commerce/fns";
import { rememberOrderToken } from "@/lib/commerce/order-secret";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/orders")({
  component: LookupPage,
  head: () => ({ meta: [{ title: "Find an order — MU" }] }),
});

function LookupPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const [error, setError] = useState("");
  return (
    <StoreShell>
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-4xl">{t("lookup.title")}</h1>
        <p className="mt-3 text-sm leading-6 text-ash">{t("lookup.body")}</p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const number = String(form.get("number") || "");
            const token = String(form.get("token") || "");
            setError("");
            void lookupOrder({ data: { number, token } }).then((order) => {
              if (!order) {
                setError(t("lookup.missing"));
                return;
              }
              rememberOrderToken(order.number, token);
              void navigate({
                to: "/order/$number",
                params: { number: order.number },
              });
            });
          }}
        >
          <Field label={t("lookup.number")} name="number" required placeholder="OR-18421" />
          <Field label={t("lookup.token")} name="token" required />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit">{t("lookup.submit")}</Button>
        </form>
      </main>
    </StoreShell>
  );
}
