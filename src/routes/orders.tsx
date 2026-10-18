import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { StoreShell } from "@/components/store/shell";
import { Button, Field } from "@/components/ui";
import { lookupOrder } from "@/lib/commerce/fns";

export const Route = createFileRoute("/orders")({
  component: LookupPage,
  head: () => ({ meta: [{ title: "Find an order — ORRIS" }] }),
});

function LookupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  return (
    <StoreShell>
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-4xl">Find an order</h1>
        <p className="mt-3 text-sm leading-6 text-ash">Enter the order number and the email used at checkout. One without the other is not enough.</p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const number = String(form.get("number") || "");
            const email = String(form.get("email") || "");
            setError("");
            void lookupOrder({ data: { number, email } }).then((order) => {
              if (!order) {
                setError("No order matches that number and email.");
                return;
              }
              void navigate({
                to: "/order/$number",
                params: { number: order.number },
                search: { email },
              });
            });
          }}
        >
          <Field label="Order number" name="number" required placeholder="OR-18421" />
          <Field label="Email" name="email" type="email" required />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit">Look up</Button>
        </form>
      </main>
    </StoreShell>
  );
}
