import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { StoreShell } from "@/components/store/shell";
import { ProductCard } from "@/components/store/product-card";
import { Button, Photo } from "@/components/ui";
import { getHome, subscribeNewsletter } from "@/lib/commerce/fns";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/")({
  loader: () => getHome(),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.settings.brandName ?? "MU"} — Test template, not an official shop` },
      { name: "description", content: loaderData?.settings.tagline ?? "MU" },
    ],
  }),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();
  const { t, copy } = useT();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const brand = data.settings.brandName || "MU";

  return (
    <StoreShell>
      <main>
        <section className="bg-butter">
          <div className="mx-auto grid max-w-6xl items-end gap-8 px-4 py-10 md:grid-cols-12 md:px-6 md:py-16">
            <div className="order-2 md:order-1 md:col-span-5 md:pb-6">
              <p className="text-xs tracking-[0.22em] text-ink/70 uppercase">{copy(data.settings.hero.eyebrow)}</p>
              <h1 className="mt-3 max-w-md text-5xl leading-[0.92] tracking-[-0.04em] md:text-7xl">
                {copy(data.settings.hero.title)}
              </h1>
              <p className="mt-5 max-w-sm text-base leading-7 text-ink/80">{copy(data.settings.hero.subtitle)}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/shop" className="inline-flex h-12 items-center rounded-full bg-coral px-6 text-sm text-ink">
                  {copy(data.settings.hero.ctaLabel)}
                </Link>
                <Link to="/shop" search={{ pet: "dog" }} className="text-sm underline decoration-ink/30 underline-offset-4">
                  {t("home.dogs")}
                </Link>
              </div>
            </div>
            <div className="order-1 md:order-2 md:col-span-7">
              <div className="studio-in relative mx-auto aspect-[4/5] max-h-[720px] overflow-hidden rounded-t-[10rem] rounded-b-[1.8rem] bg-lilac md:ml-auto md:max-w-[460px]">
                <Photo src={data.settings.hero.image} alt={`${brand} studio portrait of a cat`} className="bg-lilac object-cover" />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <h2 className="text-4xl tracking-[-0.03em]">{t("home.shopByPet")}</h2>
          <div className="mt-6 grid items-start gap-4 md:grid-cols-12">
            <Link to="/shop" search={{ pet: "dog" }} className="group md:col-span-7">
              <div className="aspect-[5/4] overflow-hidden rounded-[1.8rem] bg-stone">
                <Photo src="/catalog/studio-dog.jpg" alt="A small dog on a butter plinth in the studio" className="transition duration-500 group-hover:scale-[1.03]" />
              </div>
              <p className="mt-3 text-lg">{t("home.dogs")}</p>
              <p className="text-sm text-ash">{t("home.dogsBody")}</p>
            </Link>
            <Link to="/shop" search={{ pet: "cat" }} className="group md:col-span-5 md:mt-16">
              <div className="aspect-[3/4] overflow-hidden rounded-t-[8rem] rounded-b-[1.6rem] bg-lilac">
                <Photo src="/catalog/studio-cat.jpg" alt="A tabby cat seated in a lavender arch" className="transition duration-500 group-hover:scale-[1.03]" />
              </div>
              <p className="mt-3 text-lg">{t("home.cats")}</p>
              <p className="text-sm text-ash">{t("home.catsBody")}</p>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-4xl tracking-[-0.03em]">{t("home.favorites")}</h2>
            <Link to="/collections" className="text-sm underline underline-offset-4">{t("nav.collections")}</Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {data.featured.map((product, index) => (
              <ProductCard key={product.id} product={product} shape={index % 2 === 1 ? "arch" : "soft"} />
            ))}
          </div>
        </section>

        <section className="bg-lilac/60">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-12 md:px-6">
            <div className="overflow-hidden rounded-[1.8rem] md:col-span-7">
              <div className="aspect-[16/10]">
                <Photo src={data.settings.editorial.image} alt="A dog resting on a linen bed after a walk" />
              </div>
            </div>
            <div className="md:col-span-5">
              <p className="text-xs tracking-[0.2em] uppercase">{copy(data.settings.editorial.eyebrow)}</p>
              <h2 className="mt-3 text-4xl tracking-[-0.03em]">{copy(data.settings.editorial.title)}</h2>
              <p className="mt-4 leading-7 text-ink/75">{copy(data.settings.editorial.body)}</p>
            </div>
          </div>
        </section>

        {data.leaders.length > 0 ? (
          <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
            <h2 className="text-4xl tracking-[-0.03em]">{t("home.chosen")}</h2>
            <p className="mt-2 text-sm text-ash">{t("home.chosenNote")}</p>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
              {data.leaders.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
          <h2 className="text-4xl tracking-[-0.03em]">{t("home.designed")}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {data.settings.benefits.map((benefit, index) => (
              <div key={benefit.title} className={index === 1 ? "rounded-[1.6rem] bg-butter p-6" : "rounded-[1.6rem] border border-line p-6"}>
                <h3 className="text-2xl tracking-[-0.03em]">{copy(benefit.title)}</h3>
                <p className="mt-3 text-sm leading-6 text-ink/75">{copy(benefit.body)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-xl px-4 py-16 text-center">
          <h2 className="text-3xl tracking-[-0.03em]">{t("home.newsletterTitle")}</h2>
          <p className="mt-3 text-sm leading-6 text-ash">{t("home.newsletterBody")}</p>
          <form
            className="mt-6 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              setPending(true);
              setNote("");
              void subscribeNewsletter({ data: { email } })
                .then((result) => {
                  setNote(result.already ? t("home.already") : t("home.saved"));
                  if (!result.already) setEmail("");
                })
                .catch(() => setNote(t("home.failed")))
                .finally(() => setPending(false));
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("home.email")}
              aria-label={t("home.email")}
              className="h-12 flex-1 rounded-full border border-line bg-paper px-4 outline-none focus:border-ink"
              autoComplete="email"
              suppressHydrationWarning
            />
            <Button type="submit" variant="coral" disabled={pending}>{t("home.join")}</Button>
          </form>
          {note ? <p className="mt-3 text-sm text-ash">{note}</p> : null}
        </section>
      </main>
    </StoreShell>
  );
}
