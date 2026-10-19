import { createFileRoute, Link } from "@tanstack/react-router";
import { StoreShell } from "@/components/store/shell";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "The studio — MU" },
      { name: "description", content: "MU is a demonstration studio for everyday objects for dogs and cats." },
    ],
  }),
});

function AboutPage() {
  const { t } = useT();
  return (
    <StoreShell>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-xs tracking-[0.2em] text-ash uppercase">{t("about.kicker")}</p>
        <h1 className="mt-3 text-5xl tracking-[-0.04em]">{t("about.title")}</h1>
        <div className="mt-8 overflow-hidden rounded-t-[6rem] rounded-b-[1.4rem] bg-lilac">
          <img src="/catalog/studio-hero.jpg" alt="" className="aspect-[16/10] w-full object-cover" />
        </div>
        <div className="mt-8 space-y-5 text-base leading-8 text-ink/85">
          <p>{t("about.p1")}</p>
          <p>{t("about.p2")}</p>
          <p>{t("about.p3")}</p>
        </div>
        <Link to="/shop" className="mt-8 inline-flex h-12 items-center rounded-full bg-coral px-6 text-sm text-ink">{t("about.cta")}</Link>
      </main>
    </StoreShell>
  );
}
