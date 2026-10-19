import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui";
import { adminCancel, adminFulfill, adminOrder, adminRefund, adminResolveService } from "@/lib/commerce/fns";
import { dollarsToCents, money } from "@/lib/format";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDesk,
  head: () => ({ meta: [{ title: "Order — Merchant desk" }] }),
});

function OrderDesk() {
  const { id } = Route.useParams();
  const { t, tx } = useT();
  const [order, setOrder] = useState<Awaited<ReturnType<typeof adminOrder>> | null>(null);
  const [ready, setReady] = useState(false);
  const load = () => {
    void adminOrder({ data: { id } }).then((value) => {
      setOrder(value);
      setReady(true);
    });
  };
  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [id]);
  if (!ready) return <p className="text-sm text-ash">{t("admin.loading")}</p>;
  if (!order) return <p>{t("admin.notFound")}</p>;
  const remaining = order.totalCents - order.refundedCents;
  return (
    <div className="max-w-3xl">
      <p className="text-xs tracking-[0.16em] text-ash uppercase">{order.isDemo ? t("admin.sampleOrder") : t("admin.liveOrder")}</p>
      <h1 className="text-4xl">{order.number}</h1>
      <p className="mt-2 text-sm">{order.name} · {order.email}</p>
      <p className="mt-4 text-2xl">{tx(order.stageLabel)}</p>
      <p className="mt-1 text-sm text-ash">{tx(order.adminLabel)} · {tx(order.stageDetail)}</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div><dt className="text-ash">{t("admin.payment")}</dt><dd className="capitalize">{order.paymentStatus}</dd></div>
        <div><dt className="text-ash">{t("admin.fulfillment")}</dt><dd className="capitalize">{order.fulfillmentStatus}</dd></div>
        <div><dt className="text-ash">{t("admin.stillPaid")}</dt><dd className="tabular-nums">{money(remaining)}</dd></div>
        <div><dt className="text-ash">{t("admin.ship")}</dt><dd>{order.carrier || "—"} {order.tracking}</dd></div>
      </dl>
      <ul className="mt-6 divide-y divide-line border-y border-line text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between py-3">
            <span>{item.name} · {item.title} · {item.sku} × {item.qty}</span>
            <span className="tabular-nums">{money(item.unitPriceCents * item.qty)}</span>
          </li>
        ))}
      </ul>
      {order.events.length > 0 ? (
        <ol className="mt-4 space-y-2 text-sm text-ash">
          {order.events.map((item) => <li key={item.at + item.message}>{localize(item.message, tx)}</li>)}
        </ol>
      ) : null}
      {order.stageKey === "unpaid" ? <p className="mt-6 text-sm">{t("admin.unpaidWait")}</p> : null}
      {order.stageKey === "toship" ? (
        <form
          className="mt-8 grid gap-3 border border-line bg-paper p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void adminFulfill({ data: { id: order.id, carrier: String(form.get("carrier") || ""), tracking: String(form.get("tracking") || "") } })
              .then(() => { toast(t("admin.shippedToast")); load(); })
              .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
          }}
        >
          <h2 className="text-2xl">{t("admin.toShipTitle")}</h2>
          <Field label={t("admin.carrier")} name="carrier" placeholder="Studio dispatch" />
          <Field label={t("admin.tracking")} name="tracking" />
          <Button type="submit">{t("admin.shipAction")}</Button>
        </form>
      ) : null}
      {order.stageKey === "toreceive" ? (
        <p className="mt-6 text-sm">{t("admin.inTransit")}</p>
      ) : null}
      {order.adminLabel === "stage.aftersalesOpen.admin" ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              void adminResolveService({ data: { id: order.id, action: "refund", restock: true } })
                .then(() => { toast(t("admin.refundedToast")); load(); })
                .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
            }}
          >
            {t("admin.approve")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              void adminResolveService({ data: { id: order.id, action: "reject", restock: false } })
                .then(() => { toast(t("admin.rejectedToast")); load(); })
                .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
            }}
          >
            {t("admin.reject")}
          </Button>
        </div>
      ) : null}
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
            .then(() => { toast(t("admin.refundToast")); load(); })
            .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
        }}
      >
        <h2 className="text-2xl">{t("admin.refundTitle")}</h2>
        <p className="text-xs text-ash">{t("admin.refundBody")}</p>
        <Field label={t("admin.amount")} name="amount" placeholder={(remaining / 100).toFixed(2)} />
        <Field label={t("admin.reason")} name="reason" />
        <label className="text-sm"><input type="checkbox" name="restock" /> {t("admin.restock")}</label>
        <Button type="submit">{t("admin.recordRefund")}</Button>
      </form>
      <button
        className="mt-4 text-sm text-danger underline"
        onClick={() => {
          if (!window.confirm(t("admin.cancelAsk"))) return;
          void adminCancel({ data: { id: order.id } }).then(() => { toast(t("admin.cancelledToast")); load(); });
        }}
      >
        {t("admin.cancel")}
      </button>
    </div>
  );
}
