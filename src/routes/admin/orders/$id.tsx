import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui";
import { useDeskAccess } from "@/components/admin/frame";
import { adminAccept, adminCancel, adminCarriers, adminFulfill, adminOrder, adminRefund, adminResolveService } from "@/lib/commerce/fns";
import { publicHttpUrl } from "@/lib/commerce/shipping";
import { dollarsToCents, money } from "@/lib/format";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translate";

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDesk,
  head: () => ({ meta: [{ title: "Order — Merchant desk" }] }),
});

function OrderDesk() {
  const { id } = Route.useParams();
  const { t, tx } = useT();
  const access = useDeskAccess();
  const [order, setOrder] = useState<Awaited<ReturnType<typeof adminOrder>> | null>(null);
  const [ready, setReady] = useState(false);
  const [carriers, setCarriers] = useState<Awaited<ReturnType<typeof adminCarriers>>["carriers"]>([]);
  const [carrierId, setCarrierId] = useState("");
  const load = useCallback(() => {
    void adminOrder({ data: { id } }).then((value) => {
      setOrder(value);
      setReady(true);
    });
  }, [id]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (!access?.permissions.fulfill) return;
    void adminCarriers().then((value) => setCarriers(value.carriers)).catch(() => setCarriers([]));
  }, [access?.permissions.fulfill]);
  if (!ready) return <p className="text-sm text-ash">{t("admin.loading")}</p>;
  if (!order) return <p>{t("admin.notFound")}</p>;
  const remaining = order.totalCents - order.refundedCents;
  const accepted = order.events.some((item) => item.message === "event.accepted" || item.message.startsWith("event.accepted\n"));
  const shipment = order.fulfillments.at(-1);
  const lookup = publicHttpUrl(shipment?.trackingUrl ?? "");
  return (
    <div className="max-w-3xl">
      <Link to="/admin/orders" className="text-sm underline">{t("desk.backOrders")}</Link>
      <p className="mt-4 text-xs tracking-[0.16em] text-ash uppercase">{order.isDemo ? t("admin.sampleOrder") : t("admin.liveOrder")}</p>
      <h1 className="text-4xl">{order.number}</h1>
      <p className="mt-2 text-sm">{order.name} · {order.email}</p>
      <p className="mt-4 text-2xl">{tx(order.stageLabel)}</p>
      <p className="mt-1 text-sm text-ash">{tx(order.adminLabel)} · {tx(order.stageDetail)}</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div><dt className="text-ash">{t("admin.payment")}</dt><dd>{payLabel(order.paymentStatus, t)}</dd></div>
        <div><dt className="text-ash">{t("admin.fulfillment")}</dt><dd>{shipLabel(order.fulfillmentStatus, t)}</dd></div>
        <div><dt className="text-ash">{t("admin.stillPaid")}</dt><dd className="tabular-nums">{money(remaining)}</dd></div>
        <div>
          <dt className="text-ash">{t("admin.ship")}</dt>
          <dd>{order.carrier || "—"} {order.tracking}</dd>
          {lookup ? <a className="underline" href={lookup} target="_blank" rel="noreferrer">{t("desk.trackingLink")}</a> : null}
          {access?.permissions.money && shipment ? <p className="text-ash">{t("desk.logisticsCost")} {money(shipment.logisticsCostCents ?? 0)}</p> : null}
        </div>
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
      {access?.permissions.fulfill && order.stageKey === "toship" && !accepted ? (
        <div className="mt-8">
          <Button
            onClick={() => {
              void adminAccept({ data: { id: order.id } })
                .then(() => { toast(t("desk.acceptedToast")); toast(t("desk.mailerOff")); load(); })
                .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
            }}
          >
            {t("desk.accept")}
          </Button>
        </div>
      ) : null}
      {access?.permissions.fulfill && order.stageKey === "toship" ? (
        <form
          className="mt-8 grid gap-3 border border-line bg-paper p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void adminFulfill({
              data: {
                id: order.id,
                carrier: String(form.get("carrier") || ""),
                tracking: String(form.get("tracking") || ""),
                carrierId: carrierId || undefined,
              },
            })
              .then(() => { toast(t("admin.shippedToast")); toast(t("desk.mailerOff")); load(); })
              .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
          }}
        >
          <h2 className="text-2xl">{t("admin.toShipTitle")}</h2>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs tracking-[0.14em] text-ash uppercase">{t("desk.carrierName")}</span>
            <select value={carrierId} onChange={(event) => setCarrierId(event.target.value)} className="h-11 w-full border border-line bg-ivory px-3">
              <option value="">{t("desk.typeCarrier")}</option>
              {carriers.filter((row) => row.active).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
          {carriers.length === 0 ? <p className="text-xs text-ash">{t("desk.noCarriers")}</p> : null}
          {carrierId ? null : <Field label={t("admin.carrier")} name="carrier" />}
          <Field label={t("admin.tracking")} name="tracking" />
          <p className="text-xs text-ash">{t("desk.trackPublic")}</p>
          <Button type="submit">{t("admin.shipAction")}</Button>
        </form>
      ) : null}
      {order.stageKey === "toreceive" ? (
        <p className="mt-6 text-sm">{t("admin.inTransit")}</p>
      ) : null}
      {access?.permissions.refund && order.adminLabel === "stage.aftersalesOpen.admin" ? (
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
      {access?.permissions.refund ? (
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
      ) : null}
      {access?.permissions.refund ? (
      <button
        className="mt-4 text-sm text-danger underline"
        onClick={() => {
          if (!window.confirm(t("admin.cancelAsk"))) return;
          void adminCancel({ data: { id: order.id } }).then(() => { toast(t("admin.cancelledToast")); load(); });
        }}
      >
        {t("admin.cancel")}
      </button>
      ) : null}
    </div>
  );
}

function payLabel(value: string, t: (key: MessageKey) => string) {
  const key = ({
    paid: "desk.stPaid",
    unpaid: "desk.stUnpaid",
    partially_refunded: "desk.stPartial",
    refunded: "desk.stRefunded",
    failed: "desk.stFailed",
  } as Record<string, MessageKey>)[value];
  return key ? t(key) : value;
}

function shipLabel(value: string, t: (key: MessageKey) => string) {
  const key = ({
    unfulfilled: "desk.stNone",
    partial: "desk.stPartialShip",
    shipped: "desk.stShipped",
    fulfilled: "desk.stFulfilled",
    cancelled: "desk.stCancelled",
  } as Record<string, MessageKey>)[value];
  return key ? t(key) : value;
}
