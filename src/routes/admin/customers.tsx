import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui";
import { adminBroadcast, adminCustomers } from "@/lib/commerce/fns";
import { money } from "@/lib/format";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Customers — Merchant desk" }] }),
});

function CustomersPage() {
  const { t, tx } = useT();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminCustomers>>>([]);
  useEffect(() => {
    void adminCustomers().then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <div>
      <h1 className="text-4xl">{t("admin.customersTitle")}</h1>
      <p className="mt-2 text-sm text-ash">{t("desk.customersIntro")}</p>
      <form
        className="mt-6 grid max-w-xl gap-3 bg-paper p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const formEl = event.currentTarget;
          void adminBroadcast({ data: { subject: String(form.get("subject") || ""), body: String(form.get("body") || "") } })
            .then((result) => {
              toast(t("desk.broadcastResult", { count: result.count }));
              formEl.reset();
            })
            .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
        }}
      >
        <h2 className="text-2xl">{t("desk.broadcastTitle")}</h2>
        <Field label={t("desk.broadcastSubject")} name="subject" required />
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs tracking-[0.14em] text-ash uppercase">{t("desk.broadcastMessage")}</span>
          <textarea name="body" required className="h-28 w-full border border-line bg-ivory p-3" />
        </label>
        <Button type="submit">{t("desk.broadcastSend")}</Button>
      </form>
      <div className="mt-6 overflow-auto bg-paper">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-ash uppercase"><tr><th className="p-3">{t("desk.name")}</th><th className="p-3">{t("desk.email")}</th><th className="p-3">{t("desk.orders")}</th><th className="p-3">{t("desk.spent")}</th><th className="p-3">{t("desk.lastOrder")}</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3">{row.name}{row.isDemo ? ` · ${t("desk.sample")}` : ""}</td>
                <td className="p-3">{row.email}</td>
                <td className="p-3 tabular-nums">{row.orders}</td>
                <td className="p-3 tabular-nums">{money(row.spentCents)}</td>
                <td className="p-3">{row.lastOrder ? row.lastOrder.slice(0, 10) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
