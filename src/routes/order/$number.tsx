import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CustomerOrderCard, type CustomerOrder } from "@/components/store/customer-order";
import { StoreShell } from "@/components/store/shell";
import { lookupOrder } from "@/lib/commerce/fns";
import { useT } from "@/lib/i18n/provider";

type Search = { token?: string; email?: string };

export const Route = createFileRoute("/order/$number")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    token: typeof search.token === "string" ? search.token : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: OrderPage,
  head: () => ({ meta: [{ title: "Order — MU" }, { name: "robots", content: "noindex" }] }),
});

function OrderPage() {
  const { t } = useT();
  const { number } = Route.useParams();
  const { token } = Route.useSearch();
  const [order, setOrder] = useState<CustomerOrder | null | undefined>(undefined);
  const [fresh, setFresh] = useState(false);
  const load = useCallback(() => lookupOrder({ data: { number, token } }), [number, token]);
  useEffect(() => {
    let live = true;
    let previous = "";
    const tick = () =>
      load().then((result) => {
        if (!live) return;
        const next = JSON.stringify(result && [result.stageKey, result.stageDetail, result.tracking]);
        if (previous && previous !== next) setFresh(true);
        previous = next;
        setOrder(result);
      });
    void tick();
    const timer = setInterval(() => void tick(), 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [load]);

  return (
    <StoreShell>
      <main className="mx-auto max-w-2xl px-4 py-14">
        {order === undefined ? <p className="text-sm text-ash">{t("order.loading")}</p> : null}
        {order === null ? (
          <div>
            <h1 className="text-4xl">{t("order.missing")}</h1>
            <p className="mt-3 text-sm text-ash">{t("order.missingBody")}</p>
            <Link to="/login" search={{ next: "account" }} className="mt-6 inline-block text-sm underline">{t("order.signIn")}</Link>
          </div>
        ) : null}
        {order ? (
          <div>
            <p className="mb-3 text-sm">{t("order.thanks", { name: order.name.split(" ")[0] ?? order.name })}</p>
            {fresh ? <p className="mb-3 text-sm">{t("order.updated")}</p> : null}
            <CustomerOrderCard order={order} token={token} onChange={() => void load().then(setOrder)} />
            <p className="mt-6 text-sm text-ash">
              {t("order.all")}{" "}
              <Link to="/login" search={{ next: "account" }} className="underline">{t("order.signIn")}</Link>
            </p>
          </div>
        ) : null}
      </main>
    </StoreShell>
  );
}
