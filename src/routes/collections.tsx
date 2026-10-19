import { createFileRoute, Link } from "@tanstack/react-router";
import { StoreShell } from "@/components/store/shell";
import { Photo } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getShop } from "@/lib/commerce/fns";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/collections")({
  loader: () => getShop({ data: {} }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `Collections — ${loaderData?.settings.brandName ?? "MU"}` },
      { name: "description", content: "Six collections: rest, wear, feed, care, walk, and play." },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const data = Route.useLoaderData();
  const { t, copy } = useT();

  return (
    <StoreShell>
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <p className="text-xs tracking-[0.2em] text-ash uppercase">{t("collections.kicker")}</p>
        <h1 className="mt-2 max-w-xl text-5xl tracking-[-0.04em] md:text-6xl">{t("collections.title")}</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-ash">{t("collections.body")}</p>
        <div className="mt-10 grid gap-10 md:grid-cols-2">
          {data.categories.map((category, index) => {
            const count = data.products.filter((product) => product.categorySlug === category.slug).length;
            const arch = index % 3 === 1;
            return (
              <Link key={category.id} to="/shop" search={{ category: category.slug }} className="group">
                <div
                  className={cn(
                    "overflow-hidden",
                    arch
                      ? "aspect-[4/5] rounded-t-[8rem] rounded-b-[1.6rem] bg-lilac"
                      : "aspect-[16/10] rounded-[1.8rem] bg-butter",
                  )}
                >
                  {category.image ? (
                    <Photo
                      src={category.image}
                      alt={copy(category.alt)}
                      className="transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : null}
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-2xl tracking-[-0.03em]">{copy(category.name)}</h2>
                  <p className="text-sm tabular-nums text-ash">{t("collections.pieces", { count })}</p>
                </div>
                <p className="mt-1 max-w-md text-sm leading-6 text-ash">{copy(category.description)}</p>
              </Link>
            );
          })}
        </div>
      </main>
    </StoreShell>
  );
}
