import { useState } from "react";
import { customerPay, customerReceive, customerReview, customerService, lookupOrder } from "@/lib/commerce/fns";
import { money } from "@/lib/format";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui";

export type CustomerOrder = NonNullable<Awaited<ReturnType<typeof lookupOrder>>>;

export function CustomerOrderCard({
  order,
  token,
  onChange,
}: {
  order: CustomerOrder;
  token?: string;
  onChange: () => void;
}) {
  const { t, tx, copy } = useT();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");
  const run = (task: Promise<unknown>) => {
    setPending(true);
    setError("");
    void task
      .then(() => onChange())
      .catch((err: unknown) => setError(err instanceof Error ? localize(err.message, tx) : t("order.failed")))
      .finally(() => setPending(false));
  };
  const proof = { number: order.number, token };

  return (
    <article className="border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-ash uppercase">{order.number}</p>
          <h2 className="mt-1 text-3xl">{tx(order.stageLabel)}</h2>
          <p className="mt-2 text-sm leading-6 text-ash">{tx(order.stageDetail)}</p>
        </div>
        <p className="tabular-nums">{money(order.totalCents)}</p>
      </div>
      <ul className="mt-4 space-y-1 text-sm">
        {order.items.map((item) => (
          <li key={item.name + item.title}>
            {copy(item.name)} · {copy(item.title)} × {item.qty}
          </li>
        ))}
      </ul>
      {order.carrier ? (
        <p className="mt-3 text-sm">
          {t("order.carrier", { carrier: order.carrier })}
          {order.tracking ? ` · ${t("order.tracking", { tracking: order.tracking })}` : ""}
        </p>
      ) : null}
      {order.events.length > 0 ? (
        <ol className="mt-4 space-y-2 border-t border-line pt-3 text-sm text-ash">
          {order.events.map((item) => (
            <li key={item.at + item.message}>{localize(item.message, tx)}</li>
          ))}
        </ol>
      ) : null}
      {order.stageKey === "unpaid" ? (
        <Button className="mt-4" disabled={pending} onClick={() => run(customerPay({ data: proof }))}>
          {t("order.pay")}
        </Button>
      ) : null}
      {order.stageKey === "toreceive" ? (
        <Button className="mt-4" disabled={pending} onClick={() => run(customerReceive({ data: proof }))}>
          {t("order.receive")}
        </Button>
      ) : null}
      {order.stageKey === "toreview" ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(customerReview({ data: { ...proof, rating, body } }));
          }}
        >
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                className={score === rating ? "h-11 border border-ink px-3 text-sm" : "h-11 border border-line px-3 text-sm"}
                onClick={() => setRating(score)}
              >
                {score}
              </button>
            ))}
          </div>
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t("order.reviewPlaceholder")}
            className="h-11 w-full border border-line bg-ivory px-3"
          />
          <Button type="submit" disabled={pending}>{t("order.review")}</Button>
        </form>
      ) : null}
      {order.stageKey !== "unpaid" && order.stageKey !== "cancelled" && order.stageKey !== "aftersales" ? (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            run(customerService({ data: { ...proof, reason } }));
          }}
        >
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={2}
            placeholder={t("order.servicePlaceholder")}
            className="h-11 flex-1 border border-line bg-ivory px-3"
          />
          <Button type="submit" variant="ghost" disabled={pending}>{t("order.service")}</Button>
        </form>
      ) : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </article>
  );
}
