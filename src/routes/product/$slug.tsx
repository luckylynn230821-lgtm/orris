import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StoreShell } from "@/components/store/shell";
import { Button, Photo } from "@/components/ui";
import { ensureSessionKey, useCart } from "@/lib/cart";
import { getProduct, trackEvent } from "@/lib/commerce/fns";
import { money } from "@/lib/format";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const result = await getProduct({ data: { slug: params.slug } });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.product.seoTitle ?? "Piece"} — ORRIS` },
      { name: "description", content: loaderData?.product.seoDescription ?? "" },
      { name: "robots", content: "index,follow" },
    ],
    links: loaderData
      ? [{ rel: "canonical", href: `/product/${loaderData.product.slug}` }]
      : [],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { product, related, settings } = Route.useLoaderData();
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState<string | null>("material");
  const add = useCart((state) => state.add);
  const navigate = useNavigate();
  const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];

  useEffect(() => {
    const sessionKey = ensureSessionKey();
    void trackEvent({ data: { productId: product.id, event: "view", sessionKey } });
  }, [product.id]);

  if (!variant) return null;
  const groups = optionGroups(product.variants);

  return (
    <StoreShell>
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-2 md:px-6">
        <div className="aspect-[3/4] bg-stone">
          {product.images[0] ? <Photo src={product.images[0].url} alt={product.images[0].alt} /> : null}
        </div>
        <div>
          <p className="text-xs tracking-[0.18em] text-ash uppercase">{product.categoryName}</p>
          <h1 className="mt-2 text-4xl md:text-5xl">{product.name}</h1>
          <p className="mt-4 text-lg tabular-nums">
            {money(variant.priceCents)}
            {variant.compareAtCents && variant.compareAtCents > variant.priceCents ? (
              <span className="ml-3 text-sm text-ash line-through">{money(variant.compareAtCents)}</span>
            ) : null}
          </p>
          <p className="mt-2 text-sm text-ash">{variant.inventoryQty > 0 ? (variant.inventoryQty <= 5 ? `Only ${variant.inventoryQty} left` : "In stock") : "Sold out"}</p>
          <p className="mt-6 leading-7 text-ink/80">{product.description}</p>
          {groups.map((group) => (
            <div key={group.name} className="mt-6">
              <p className="text-xs tracking-[0.16em] text-ash uppercase">{group.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.values.map((value) => {
                  const match = product.variants.find((item) => matches(item, group.name, value, variant));
                  const active = match?.id === variant.id;
                  return (
                    <button
                      key={value}
                      disabled={!match}
                      onClick={() => match && setVariantId(match.id)}
                      className={active ? "h-11 border border-ink px-4 text-sm" : "h-11 border border-line px-4 text-sm"}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-6 flex items-center gap-3">
            <button className="grid size-11 place-items-center border border-line" onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Decrease">–</button>
            <span className="w-6 text-center tabular-nums">{qty}</span>
            <button className="grid size-11 place-items-center border border-line" onClick={() => setQty((n) => Math.min(10, n + 1))} aria-label="Increase">+</button>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              className="flex-1"
              disabled={variant.inventoryQty < 1}
              onClick={() => {
                add(variant.id, qty);
                const sessionKey = ensureSessionKey();
                void trackEvent({ data: { productId: product.id, event: "add_to_cart", sessionKey } });
                toast("Added to your bag");
              }}
            >
              Add to bag
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              disabled={variant.inventoryQty < 1}
              onClick={() => {
                add(variant.id, qty);
                void navigate({ to: "/checkout" });
              }}
            >
              Buy now
            </Button>
          </div>
          <p className="mt-4 text-xs text-ash">SKU {variant.sku}</p>
          <div className="mt-8 divide-y divide-line border-y border-line">
            <Fold title="Material & care" id="material" open={open} setOpen={setOpen}>{product.story}</Fold>
            <Fold title="Shipping" id="ship" open={open} setOpen={setOpen}>
              Standard shipping is {money(settings.shippingFlatCents)}, and complimentary over {money(settings.freeShippingThresholdCents)}. Express is {money(settings.expressShippingCents)}. In-stock orders leave within two business days.
            </Fold>
            <Fold title="Returns" id="returns" open={open} setOpen={setOpen}>
              Write to {settings.supportEmail} within 14 days if a piece is not right. Worn or washed goods are repaired rather than refunded, unless they arrived damaged.
            </Fold>
          </div>
        </div>
      </main>
      {related.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
          <h2 className="mb-6 text-3xl">Alongside it</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {related.map((item) => (
              <Link key={item.id} to="/product/$slug" params={{ slug: item.slug }}>
                <div className="aspect-[3/4] bg-stone">{item.images[0] ? <Photo src={item.images[0].url} alt={item.images[0].alt} /> : null}</div>
                <p className="mt-3 text-sm">{item.name}</p>
                <p className="text-sm tabular-nums">{money(item.priceCents)}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.description,
            sku: variant.sku,
            image: product.images.map((image) => image.url),
            offers: {
              "@type": "Offer",
              priceCurrency: settings.currency,
              price: (variant.priceCents / 100).toFixed(2),
              availability: variant.inventoryQty > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            },
          }),
        }}
      />
    </StoreShell>
  );
}

function Fold({
  title,
  id,
  open,
  setOpen,
  children,
}: {
  title: string;
  id: string;
  open: string | null;
  setOpen: (id: string | null) => void;
  children: React.ReactNode;
}) {
  const shown = open === id;
  return (
    <div>
      <button className="flex h-12 w-full items-center justify-between text-left text-sm" onClick={() => setOpen(shown ? null : id)}>
        {title}
        <span>{shown ? "–" : "+"}</span>
      </button>
      {shown ? <p className="pb-4 text-sm leading-6 text-ash">{children}</p> : null}
    </div>
  );
}

function optionGroups(variants: { option1Name: string | null; option1Value: string | null; option2Name: string | null; option2Value: string | null }[]) {
  const map = new Map<string, string[]>();
  for (const variant of variants) {
    for (const [name, value] of [
      [variant.option1Name, variant.option1Value],
      [variant.option2Name, variant.option2Value],
    ] as const) {
      if (!name || !value) continue;
      const list = map.get(name) ?? [];
      if (!list.includes(value)) list.push(value);
      map.set(name, list);
    }
  }
  return [...map.entries()].map(([name, values]) => ({ name, values }));
}

function matches(
  item: { id: string; option1Name: string | null; option1Value: string | null; option2Name: string | null; option2Value: string | null },
  group: string,
  value: string,
  current: { option1Name: string | null; option1Value: string | null; option2Name: string | null; option2Value: string | null },
) {
  const pairs = [
    [item.option1Name, item.option1Value],
    [item.option2Name, item.option2Value],
  ];
  const currentPairs = [
    [current.option1Name, current.option1Value],
    [current.option2Name, current.option2Value],
  ];
  if (!pairs.some(([name, val]) => name === group && val === value)) return false;
  return currentPairs.every(([name, val]) => {
    if (!name || name === group) return true;
    return pairs.some(([n, v]) => n === name && v === val);
  });
}
