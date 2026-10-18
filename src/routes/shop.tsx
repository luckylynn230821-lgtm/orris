import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { StoreShell } from "@/components/store/shell";
import { Photo } from "@/components/ui";
import { getShop } from "@/lib/commerce/fns";
import { money } from "@/lib/format";

type ShopSearch = { q?: string; category?: string; sort?: string; stock?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    category: typeof search.category === "string" && search.category ? search.category : undefined,
    sort: typeof search.sort === "string" && search.sort ? search.sort : undefined,
    stock: search.stock === "1" ? "1" : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getShop({
      data: {
        q: deps.q,
        category: deps.category,
        sort: deps.sort,
        inStock: deps.stock === "1",
      },
    }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `Shop — ${loaderData?.settings.brandName ?? "ORRIS"}` },
      { name: "description", content: "The current ORRIS collection." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [filters, setFilters] = useState(false);
  const active = data.categories.find((category) => category.slug === search.category);

  const setSearch = (patch: Partial<ShopSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  return (
    <StoreShell>
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <p className="text-xs tracking-[0.2em] text-ash uppercase">{active ? active.name : "The collection"}</p>
        <h1 className="mt-2 text-4xl md:text-5xl">{active ? active.name : search.q ? `“${search.q}”` : "All goods"}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ash">
          {active?.description ?? `${data.products.length} pieces currently for sale. Prices and stock come from the shop records, not from the page.`}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
          <button className="h-11 border border-line px-4 md:hidden" onClick={() => setFilters(true)}>Filter</button>
          <label className="ml-auto text-ash">
            Sort
            <select
              className="ml-2 h-11 border border-line bg-ivory px-2 text-ink"
              value={search.sort ?? "featured"}
              onChange={(event) => setSearch({ sort: event.target.value === "featured" ? undefined : event.target.value })}
            >
              <option value="featured">Best selling</option>
              <option value="newest">New</option>
              <option value="price-asc">Price, low</option>
              <option value="price-desc">Price, high</option>
            </select>
          </label>
        </div>
        <div className="mt-8 grid gap-10 md:grid-cols-[200px_1fr]">
          <aside className="hidden md:block">
            <FilterList />
          </aside>
          {data.products.length === 0 ? (
            <p className="text-sm text-ash">Nothing matches. Try another room of the house.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
              {data.products.map((product) => (
                <Link key={product.id} to="/product/$slug" params={{ slug: product.slug }}>
                  <div className="relative aspect-[3/4] bg-stone">
                    {product.images[0] ? <Photo src={product.images[0].url} alt={product.images[0].alt} /> : null}
                    {product.soldOut ? (
                      <span className="absolute bottom-3 left-3 bg-ivory px-2 py-1 text-[11px] tracking-wide uppercase">Sold out</span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm">{product.name}</p>
                  <p className="text-sm text-ash tabular-nums">{money(product.priceCents)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
        {filters ? (
          <div className="fixed inset-0 z-40 bg-ivory p-6 md:hidden">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-3xl">Filter</h2>
              <button className="text-sm underline" onClick={() => setFilters(false)}>Close</button>
            </div>
            <FilterList onDone={() => setFilters(false)} />
          </div>
        ) : null}
      </main>
    </StoreShell>
  );
}

function FilterList({ onDone }: { onDone?: () => void }) {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <div className="space-y-6 text-sm">
      <div>
        <p className="text-xs tracking-[0.16em] text-ash uppercase">Category</p>
        <button className="mt-3 block" onClick={() => { void navigate({ search: { ...search, category: undefined } }); onDone?.(); }}>
          All goods
        </button>
        {data.categories.map((category) => (
          <button
            key={category.id}
            className={search.category === category.slug ? "mt-2 block underline" : "mt-2 block text-ash"}
            onClick={() => { void navigate({ search: { ...search, category: category.slug } }); onDone?.(); }}
          >
            {category.name}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={search.stock === "1"}
          onChange={(event) => void navigate({ search: { ...search, stock: event.target.checked ? "1" : undefined } })}
        />
        In stock only
      </label>
    </div>
  );
}
