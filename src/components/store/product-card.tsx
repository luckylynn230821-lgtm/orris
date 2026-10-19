import { Link } from "@tanstack/react-router";
import { Photo } from "@/components/ui";
import { useCart } from "@/lib/cart";
import type { PublicProduct } from "@/lib/commerce/catalog";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

export function ProductCard({
  product,
  shape = "soft",
}: {
  product: PublicProduct;
  shape?: "soft" | "arch";
}) {
  const { t, copy } = useT();
  const add = useCart((state) => state.add);
  const setOpen = useCart((state) => state.setOpen);
  const image = product.images[0];
  const ready = product.variants.find((variant) => variant.inventoryQty > 0);
  const options = optionLine(product);

  return (
    <article className="group">
      <Link to="/product/$slug" params={{ slug: product.slug }} className="block">
        <div
          className={cn(
            "relative aspect-[4/5] overflow-hidden",
            shape === "arch" ? "rounded-t-[6.5rem] rounded-b-[1.4rem] bg-lilac" : "rounded-[1.6rem] bg-butter",
          )}
        >
          {image ? (
            <Photo
              src={image.url}
              alt={copy(image.alt)}
              className="bg-transparent object-contain p-3 transition duration-500 group-hover:scale-[1.03]"
            />
          ) : null}
          {product.soldOut ? (
            <span className="absolute bottom-3 left-3 rounded-full bg-ivory px-2.5 py-1 text-[11px] tracking-wide uppercase">
              {t("shop.soldOut")}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <p className="text-sm">{copy(product.name)}</p>
          <p className="text-sm tabular-nums">{money(product.priceCents)}</p>
        </div>
        {options ? <p className="mt-1 text-xs text-ash">{options}</p> : null}
      </Link>
      {ready ? (
        <button
          className="mt-2 text-xs tracking-wide text-ink underline decoration-coral decoration-2 underline-offset-4"
          onClick={() => {
            add(ready.id, 1);
            setOpen(true);
          }}
        >
          {t("product.add")}
        </button>
      ) : null}
    </article>
  );
}

function optionLine(product: PublicProduct) {
  const values: string[] = [];
  for (const variant of product.variants) {
    for (const value of [variant.option1Value, variant.option2Value]) {
      if (value && !values.includes(value)) values.push(value);
    }
  }
  return values.join(" · ");
}
