import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StoreShell } from "@/components/store/shell";
import { ProductCard } from "@/components/store/product-card";
import { getShop } from "@/lib/commerce/fns";
import { useT } from "@/lib/i18n/provider";

type ShopSearch = { q?: string; category?: string; pet?: "dog" | "cat"; sort?: string; stock?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    category: typeof search.category === "string" && search.category ? search.category : undefined,
    pet: search.pet === "dog" || search.pet === "cat" ? search.pet : undefined,
    sort: typeof search.sort === "string" && search.sort ? search.sort : undefined,
    stock: search.stock === "1" ? "1" : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getShop({
      data: {
        q: deps.q,
        category: deps.category,
        pet: deps.pet,
        sort: deps.sort,
        inStock: deps.stock === "1",
      },
    }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `Shop — ${loaderData?.settings.brandName ?? "MU"}` },
      { name: "description", content: loaderData?.settings.tagline ?? "Everyday objects for dogs and cats." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const data = Route.useLoaderData();
  const { t, copy } = useT();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [filters, setFilters] = useState(false);
  const active = data.categories.find((category) => category.slug === search.category);

  const setSearch = (patch: Partial<ShopSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const title = search.pet === "dog"
    ? t("shop.dogs")
    : search.pet === "cat"
      ? t("shop.cats")
      : active
        ? copy(active.name)
        : search.q
          ? `“${search.q}”`
          : t("shop.allGoods");

  return (
    <StoreShell>
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <p className="text-xs tracking-[0.2em] text-ash uppercase">{t("shop.collection")}</p>
        <h1 className="mt-2 text-5xl tracking-[-0.04em] md:text-6xl">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ash">
          {active?.description && !search.pet ? copy(active.description) : t("shop.count", { count: data.products.length })}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <PetChip label={t("shop.dogs")} active={search.pet === "dog"} onClick={() => setSearch({ pet: search.pet === "dog" ? undefined : "dog" })} />
          <PetChip label={t("shop.cats")} active={search.pet === "cat"} onClick={() => setSearch({ pet: search.pet === "cat" ? undefined : "cat" })} />
          {data.categories.map((category) => (
            <PetChip
              key={category.id}
              label={copy(category.name)}
              active={search.category === category.slug}
              onClick={() => setSearch({ category: search.category === category.slug ? undefined : category.slug })}
            />
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
          <button className="h-11 rounded-full border border-line px-4 md:hidden" onClick={() => setFilters(true)}>{t("shop.filter")}</button>
          <label className="ml-auto text-ash">
            {t("shop.sort")}
            <select
              className="ml-2 h-11 rounded-full border border-line bg-ivory px-3 text-ink"
              value={search.sort ?? "featured"}
              onChange={(event) => setSearch({ sort: event.target.value === "featured" ? undefined : event.target.value })}
            >
              <option value="featured">{t("shop.best")}</option>
              <option value="newest">{t("shop.newest")}</option>
              <option value="price-asc">{t("shop.priceLow")}</option>
              <option value="price-desc">{t("shop.priceHigh")}</option>
            </select>
          </label>
        </div>
        <div className="mt-8">
          {data.products.length === 0 ? (
            <p className="text-sm text-ash">{t("shop.empty")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
              {data.products.map((product, index) => (
                <ProductCard key={product.id} product={product} shape={index % 3 === 1 ? "arch" : "soft"} />
              ))}
            </div>
          )}
        </div>
        {filters ? (
          <div className="fixed inset-0 z-40 bg-ivory p-6 md:hidden">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-3xl">{t("shop.filter")}</h2>
              <button className="text-sm underline" onClick={() => setFilters(false)}>{t("shop.close")}</button>
            </div>
            <FilterList onDone={() => setFilters(false)} />
          </div>
        ) : null}
      </main>
    </StoreShell>
  );
}

function PetChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={active ? "h-10 rounded-full bg-ink px-4 text-sm text-ivory" : "h-10 rounded-full border border-line px-4 text-sm"}
    >
      {label}
    </button>
  );
}

function FilterList({ onDone }: { onDone?: () => void }) {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { t, copy } = useT();
  return (
    <div className="space-y-6 text-sm">
      <div>
        <p className="text-xs tracking-[0.16em] text-ash uppercase">{t("shop.category")}</p>
        <button className="mt-3 block" onClick={() => { void navigate({ search: { ...search, category: undefined } }); onDone?.(); }}>
          {t("shop.allGoods")}
        </button>
        {data.categories.map((category) => (
          <button
            key={category.id}
            className={search.category === category.slug ? "mt-2 block underline" : "mt-2 block text-ash"}
            onClick={() => { void navigate({ search: { ...search, category: category.slug } }); onDone?.(); }}
          >
            {copy(category.name)}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={search.stock === "1"}
          onChange={(event) => void navigate({ search: { ...search, stock: event.target.checked ? "1" : undefined } })}
        />
        {t("shop.inStock")}
      </label>
    </div>
  );
}
