import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CustomerOrderCard, type CustomerOrder } from "@/components/store/customer-order";
import { StoreShell } from "@/components/store/shell";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { myOrders } from "@/lib/commerce/fns";
import { useT } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translate";

const TABS = ["all", "unpaid", "toship", "toreceive", "toreview", "aftersales"] as const;

export const Route = createFileRoute("/account")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "My orders — MU" }] }),
});

function AccountPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (!user) return;
    let live = true;
    let previous = "";
    const tick = () =>
      myOrders()
        .then((rows) => {
          if (!live) return;
          const next = JSON.stringify(rows.map((row) => [row.number, row.stageKey, row.stageDetail, row.tracking]));
          if (previous && previous !== next) setFresh(true);
          previous = next;
          setOrders(rows);
        })
        .catch(() => live && setOrders([]));
    void tick();
    const timer = setInterval(() => void tick(), 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!isPending && !user) {
      void navigate({ to: "/login", search: { next: "account" }, replace: true });
    }
  }, [isPending, user, navigate]);

  const visible = (orders ?? []).filter((order) => tab === "all" || order.stageKey === tab);

  return (
    <StoreShell>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs tracking-[0.18em] text-ash uppercase">{t("account.kicker")}</p>
        <h1 className="mt-2 text-5xl">{t("account.title")}</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-ash">{t("account.body")}</p>
        {isPending && !user ? (
          <p className="mt-6 text-sm text-ash">
            {t("account.checking")}{" "}
            <Link to="/login" search={{ next: "account" }} className="underline">{t("account.signIn")}</Link>
          </p>
        ) : null}
        {!isPending && !user ? <p className="mt-8 text-sm text-ash">{t("account.checking")}</p> : null}
        {user ? (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3 text-sm">
              <p>{user.primaryEmail}</p>
              <div className="flex items-center gap-3">
                <Link to="/admin" className="underline">{t("nav.merchant")}</Link>
                <UserButton />
              </div>
            </div>
            {fresh ? <p className="mt-3 text-sm">{t("account.updated")}</p> : null}
            <div className="mt-6 flex gap-2 overflow-auto">
              {TABS.map((key) => (
                <button
                  key={key}
                  className={key === tab ? "h-11 shrink-0 border border-ink px-3 text-sm" : "h-11 shrink-0 border border-line px-3 text-sm"}
                  onClick={() => setTab(key)}
                >
                  {t(`account.${key}` as MessageKey)}
                </button>
              ))}
            </div>
            {!orders ? <p className="mt-6 text-sm text-ash">{t("account.loading")}</p> : null}
            {orders && visible.length === 0 ? <p className="mt-6 text-sm text-ash">{t("account.empty")}</p> : null}
            <div className="mt-4 space-y-4">
              {visible.map((order) => (
                <CustomerOrderCard key={order.number} order={order} onChange={() => void myOrders().then(setOrders)} />
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </StoreShell>
  );
}
