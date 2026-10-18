import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StoreShell } from "@/components/store/shell";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { myOrders } from "@/lib/commerce/fns";
import { money } from "@/lib/format";

export const Route = createFileRoute("/account")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "Account — ORRIS" }] }),
});

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof myOrders>> | null>(null);
  useEffect(() => {
    if (!user) return;
    let live = true;
    void myOrders()
      .then((rows) => live && setOrders(rows))
      .catch(() => live && setOrders([]));
    return () => {
      live = false;
    };
  }, [user?.id]);
  return (
    <StoreShell>
      <main className="mx-auto max-w-2xl px-4 py-14">
        <h1 className="text-4xl">Account</h1>
        {isPending ? <p className="mt-6 text-sm text-ash">Checking your session…</p> : null}
        {!isPending && !user ? (
          <p className="mt-6 text-sm leading-6">
            You can shop as a guest. Sign in to see orders placed with the same email.{" "}
            <Link to="/login" className="underline">Sign in</Link>
          </p>
        ) : null}
        {user ? (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm">{user.primaryEmail}</p>
              <UserButton />
            </div>
            <h2 className="mt-10 text-2xl">Your orders</h2>
            {!orders ? <p className="mt-3 text-sm text-ash">Loading…</p> : null}
            {orders && orders.length === 0 ? <p className="mt-3 text-sm text-ash">No orders are tied to this account yet.</p> : null}
            <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
              {orders?.map((order) => (
                <li key={order.number} className="flex items-center justify-between py-3">
                  <span>{order.number}</span>
                  <span className="capitalize text-ash">{order.status}</span>
                  <span className="tabular-nums">{money(order.totalCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </main>
    </StoreShell>
  );
}
