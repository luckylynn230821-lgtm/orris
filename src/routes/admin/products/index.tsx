import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminError } from "@/components/admin/frame";
import { adminBulk, adminImport, adminProducts } from "@/lib/commerce/fns";
import { money } from "@/lib/format";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/products/")({
  component: ProductsPage,
  head: () => ({ meta: [{ title: "Products — Merchant desk" }] }),
});

function ProductsPage() {
  const { t, tx } = useT();
  const [data, setData] = useState<Awaited<ReturnType<typeof adminProducts>> | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const load = () => {
    void adminProducts()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
  };
  useEffect(load, []);
  const products = (data?.products ?? []).filter((product) => product.name.toLowerCase().includes(q.toLowerCase()));
  const notice = { ok: t("desk.updated"), fail: t("admin.failed") };
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-ash uppercase">{t("desk.catalogue")}</p>
          <h1 className="text-4xl">{t("admin.productsTitle")}</h1>
        </div>
        <Link to="/admin/products/$id" params={{ id: "new" }} className="inline-flex h-11 items-center bg-ink px-4 text-sm text-ivory">{t("desk.addProduct")}</Link>
      </div>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("desk.search")} className="mt-6 h-11 w-full max-w-sm border border-line bg-paper px-3" />
      {error ? <div className="mt-4"><AdminError message={error} /></div> : null}
      {selected.length > 0 && data ? (
        <div className="mt-4 flex flex-wrap gap-2 bg-paper p-3 text-sm">
          <span>{t("desk.selected", { count: selected.length })}</span>
          <button onClick={() => runBulk({ ids: selected, action: "publish" }, load, notice)}>{t("desk.publish")}</button>
          <button onClick={() => runBulk({ ids: selected, action: "draft" }, load, notice)}>{t("desk.unpublish")}</button>
          <button onClick={() => runBulk({ ids: selected, action: "archive" }, load, notice)}>{t("desk.archive")}</button>
          <select
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;
              runBulk({ ids: selected, action: "category", categoryId: event.target.value }, load, notice);
            }}
          >
            <option value="">{t("desk.moveCategory")}</option>
            {data.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <button
            onClick={() => {
              const raw = window.prompt(t("desk.pricePrompt"));
              if (!raw) return;
              if (window.prompt(t("desk.confirmAdjust")) !== "ADJUST") return;
              runBulk({ ids: selected, action: "price", percent: Number(raw) }, load, notice);
            }}
          >
            {t("desk.adjustPrices")}
          </button>
        </div>
      ) : null}
      <div className="mt-4 overflow-auto bg-paper">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs tracking-wide text-ash uppercase">
            <tr>
              <th className="p-3"></th>
              <th className="p-3">{t("desk.product")}</th>
              <th className="p-3">{t("desk.status")}</th>
              <th className="p-3">{t("desk.price")}</th>
              <th className="p-3">{t("desk.stock")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-line">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(product.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id),
                      )
                    }
                  />
                </td>
                <td className="p-3">
                  <Link to="/admin/products/$id" params={{ id: product.id }} className="flex items-center gap-3">
                    <span className="h-12 w-10 bg-stone">
                      {product.images[0] ? <img src={product.images[0].url} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                    {product.name}
                  </Link>
                </td>
                <td className="p-3">{t(product.status === "published" ? "desk.published" : product.status === "archived" ? "desk.archived" : "desk.draft")}</td>
                <td className="p-3 tabular-nums">{money(product.priceCents)}</td>
                <td className="p-3 tabular-nums">{product.inventoryQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="mt-8 max-w-xl"
        onSubmit={(event) => {
          event.preventDefault();
          const csv = String(new FormData(event.currentTarget).get("csv") || "");
          void adminImport({ data: { csv } })
            .then((result) => {
              toast(t("desk.imported", { count: result.created }));
              load();
            })
            .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
        }}
      >
        <p className="text-sm">{t("desk.csvIntro")}</p>
        <textarea name="csv" className="mt-2 h-28 w-full border border-line bg-paper p-3 text-sm" placeholder={"name,sku,price,cost,inventory,category\nLinen napkin,OR-NAP,48,12,20,textiles"} />
        <button className="mt-2 h-11 bg-ink px-4 text-sm text-ivory" type="submit">{t("desk.importCsv")}</button>
      </form>
    </div>
  );
}

function runBulk(
  input: {
    ids: string[];
    action: "publish" | "draft" | "archive" | "category" | "price";
    categoryId?: string;
    percent?: number;
  },
  reload: () => void,
  notice: { ok: string; fail: string },
) {
  void adminBulk({ data: input })
    .then(() => {
      toast(notice.ok);
      reload();
    })
    .catch((err: unknown) => toast(err instanceof Error ? err.message : notice.fail));
}
