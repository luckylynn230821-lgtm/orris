import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { StoreShell } from "@/components/store/shell";
import { Button, Photo } from "@/components/ui";
import { getHome, subscribeNewsletter } from "@/lib/commerce/fns";
import { money } from "@/lib/format";

export const Route = createFileRoute("/")({
  loader: () => getHome(),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.settings.brandName ?? "ORRIS"} — Objects for a considered life` },
      { name: "description", content: loaderData?.settings.tagline ?? "ORRIS" },
    ],
  }),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <StoreShell>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:px-6 md:py-20">
          <div>
            <p className="text-xs tracking-[0.22em] text-brass uppercase">{data.settings.hero.eyebrow}</p>
            <h1 className="mt-4 max-w-md text-5xl leading-[1.05] md:text-6xl">{data.settings.hero.title}</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-ash">{data.settings.hero.subtitle}</p>
            <Link to="/shop" className="mt-8 inline-flex h-11 items-center bg-ink px-5 text-sm text-ivory">
              {data.settings.hero.ctaLabel}
            </Link>
          </div>
          <div className="aspect-[16/10] overflow-hidden bg-stone">
            <Photo src={data.settings.hero.image} alt="A quiet sunlit room with linen and stoneware" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-3xl">The rooms</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {data.categories.map((category) => (
              <Link key={category.id} to="/shop" search={{ category: category.slug }} className="group">
                <div className="aspect-[4/5] overflow-hidden bg-stone">
                  {category.image ? <Photo src={category.image} alt={category.alt} className="transition duration-500 group-hover:scale-[1.03]" /> : null}
                </div>
                <p className="mt-3 text-sm">{category.name}</p>
                <p className="text-xs text-ash">{category.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-stone/70">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-3xl">Most kept</h2>
              <Link to="/shop" className="text-sm underline underline-offset-4">All goods</Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
              {data.bestSellers.map((product) => (
                <Link key={product.id} to="/product/$slug" params={{ slug: product.slug }}>
                  <div className="aspect-[3/4] overflow-hidden bg-ivory">
                    {product.images[0] ? <Photo src={product.images[0].url} alt={product.images[0].alt} /> : null}
                  </div>
                  <p className="mt-3 text-sm">{product.name}</p>
                  <p className="text-sm text-ash tabular-nums">{money(product.priceCents)}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2 md:px-6">
          <div className="aspect-[16/11] overflow-hidden bg-stone">
            <Photo src={data.settings.editorial.image} alt="Morning still life with linen, a journal and brass" />
          </div>
          <div>
            <p className="text-xs tracking-[0.2em] text-brass uppercase">{data.settings.editorial.eyebrow}</p>
            <h2 className="mt-3 text-4xl">{data.settings.editorial.title}</h2>
            <p className="mt-4 leading-7 text-ash">{data.settings.editorial.body}</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
          <h2 className="mb-6 text-3xl">New in the house</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {data.newArrivals.map((product) => (
              <Link key={product.id} to="/product/$slug" params={{ slug: product.slug }}>
                <div className="aspect-[3/4] bg-stone">
                  {product.images[0] ? <Photo src={product.images[0].url} alt={product.images[0].alt} /> : null}
                </div>
                <p className="mt-3 text-sm">{product.name}</p>
                <p className="text-sm tabular-nums">{money(product.priceCents)}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-line">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3 md:px-6">
            {data.settings.benefits.map((benefit) => (
              <div key={benefit.title}>
                <h3 className="text-2xl">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ash">{benefit.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-xl px-4 py-16 text-center">
          <h2 className="text-3xl">A note when the next run is ready</h2>
          <p className="mt-3 text-sm leading-6 text-ash">
            This list is stored for the merchant. It does not pretend an email has already been sent.
          </p>
          <form
            className="mt-6 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              setPending(true);
              void subscribeNewsletter({ data: { email } })
                .then((result) => setNote(result.already ? "This address is already on the list." : "Saved. We'll write when there is something to say."))
                .catch(() => setNote("We couldn't save that address."))
                .finally(() => setPending(false));
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              autoComplete="email"
              suppressHydrationWarning
              className="h-11 flex-1 border border-line bg-paper px-3 outline-none"
            />
            <Button type="submit" disabled={pending}>Join the list</Button>
          </form>
          {note ? <p className="mt-3 text-sm">{note}</p> : null}
        </section>
      </main>
    </StoreShell>
  );
}
