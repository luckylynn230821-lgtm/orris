import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { adminCustomers } from "@/lib/commerce/fns";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Customers — ORRIS desk" }] }),
});

function CustomersPage() {
  const { t } = useT();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminCustomers>>>([]);
  useEffect(() => {
    void adminCustomers().then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <div>
      <h1 className="text-4xl">{t("admin.customersTitle")}</h1>
      <p className="mt-2 text-sm text-ash">Visible only on this desk. Sample buyers use example.com addresses.</p>
      <div className="mt-6 overflow-auto bg-paper">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-ash uppercase"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Orders</th><th className="p-3">Spent</th><th className="p-3">Last order</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3">{row.name}{row.isDemo ? " · sample" : ""}</td>
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
