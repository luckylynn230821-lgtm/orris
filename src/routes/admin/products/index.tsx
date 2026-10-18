import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminError } from "@/components/admin/frame";
import { adminBulk, adminImport, adminProducts } from "@/lib/commerce/fns";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/products/")({
  component: ProductsPage,
  head: () => ({ meta: [{ title: "Products — ORRIS desk" }] }),
});

function ProductsPage() {
  const { t } = useT();
  const [data, setData] = useState<Awaited<ReturnType<typeof adminProducts>> | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const load = () => {
    void adminProducts()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
  };
  useEffect(load, []);
  const products = (data?.products ?? []).filter((product) => product.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-ash uppercase">Catalogue</p>
          <h1 className="text-4xl">{t("admin.productsTitle")}</h1>
        </div>
        <Link to="/admin/products/$id" params={{ id: "new" }} className="inline-flex h-11 items-center bg-ink px-4 text-sm text-ivory">Add product</Link>
      </div>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search" className="mt-6 h-11 w-full max-w-sm border border-line bg-paper px-3" />
      {error ? <div className="mt-4"><AdminError message={error} /></div> : null}
      {selected.length > 0 && data ? (
        <div className="mt-4 flex flex-wrap gap-2 bg-paper p-3 text-sm">
          <span>{selected.length} selected</span>
          <button onClick={() => runBulk({ ids: selected, action: "publish" }, load)}>Publish</button>
          <button onClick={() => runBulk({ ids: selected, action: "draft" }, load)}>Unpublish</button>
          <button onClick={() => runBulk({ ids: selected, action: "archive" }, load)}>Archive</button>
          <select
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;
              runBulk({ ids: selected, action: "category", categoryId: event.target.value }, load);
            }}
          >
            <option value="">Move category…</option>
            {data.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <button
            onClick={() => {
              const raw = window.prompt("Price change percent, for example 10 or -15. This updates every selected variant.");
              if (!raw) return;
              if (window.prompt("Type ADJUST to confirm") !== "ADJUST") return;
              runBulk({ ids: selected, action: "price", percent: Number(raw) }, load);
            }}
          >
            Adjust prices
          </button>
        </div>
      ) : null}
      <div className="mt-4 overflow-auto bg-paper">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs tracking-wide text-ash uppercase">
            <tr>
              <th className="p-3"></th>
              <th className="p-3">Product</th>
              <th className="p-3">Status</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
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
                <td className="p-3 capitalize">{product.status}</td>
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
              toast(`Imported ${result.created} draft products`);
              load();
            })
            .catch((err: unknown) => toast(err instanceof Error ? err.message : "Import failed"));
        }}
      >
        <p className="text-sm">CSV import as drafts. Columns: name, sku, price, cost, inventory, category, description. Prices in dollars.</p>
        <textarea name="csv" className="mt-2 h-28 w-full border border-line bg-paper p-3 text-sm" placeholder={"name,sku,price,cost,inventory,category\nLinen napkin,OR-NAP,48,12,20,textiles"} />
        <button className="mt-2 h-11 bg-ink px-4 text-sm text-ivory" type="submit">Import CSV</button>
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
) {
  void adminBulk({ data: input })
    .then(() => {
      toast("Updated");
      reload();
    })
    .catch((err: unknown) => toast(err instanceof Error ? err.message : "Failed"));
}
