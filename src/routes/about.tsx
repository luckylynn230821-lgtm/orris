import { createFileRoute, Link } from "@tanstack/react-router";
import { StoreShell } from "@/components/store/shell";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "The house — ORRIS" },
      { name: "description", content: "ORRIS is a single-house shop for goods meant to be kept, repaired and accounted for." },
    ],
  }),
});

function AboutPage() {
  const { t } = useT();
  return (
    <StoreShell>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-xs tracking-[0.2em] text-brass uppercase">{t("about.kicker")}</p>
        <h1 className="mt-3 text-5xl">{t("about.title")}</h1>
        <div className="mt-8 space-y-5 text-base leading-8 text-ink/85">
          <p>{t("about.p1")}</p>
          <p>{t("about.p2")}</p>
          <p>{t("about.p3")}</p>
        </div>
        <Link to="/shop" className="mt-8 inline-block text-sm underline underline-offset-4">{t("about.cta")}</Link>
      </main>
    </StoreShell>
  );
}
