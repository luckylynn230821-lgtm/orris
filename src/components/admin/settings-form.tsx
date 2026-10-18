import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui";
import { adminSaveSettings, adminSettings } from "@/lib/commerce/fns";
import { centsToInput, dollarsToCents } from "@/lib/format";

export function SettingsForm({ part }: { part: "content" | "shop" }) {
  const [raw, setRaw] = useState<Awaited<ReturnType<typeof adminSettings>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void adminSettings().then(setRaw).catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
  }, []);
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!raw) return <p className="text-sm text-ash">Loading settings…</p>;
  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const text = (name: string, fallback: string) => String(form.get(name) ?? fallback);
        void adminSaveSettings({
          data: {
            brandName: text("brandName", raw.brandName),
            tagline: text("tagline", raw.tagline),
            announcement: text("announcement", raw.announcement),
            supportEmail: text("supportEmail", raw.supportEmail),
            shippingFlatCents: dollarsToCents(text("shipping", centsToInput(raw.shippingFlatCents))),
            expressShippingCents: dollarsToCents(text("express", centsToInput(raw.expressShippingCents))),
            freeShippingThresholdCents: dollarsToCents(text("threshold", centsToInput(raw.freeShippingThresholdCents))),
            lowStock: Number(text("lowStock", String(raw.lowStock))),
            slowCoverDays: Number(text("slow", String(raw.slowCoverDays))),
            replenishCoverDays: Number(text("cover", String(raw.replenishCoverDays))),
            minViews: Number(text("views", String(raw.minViews))),
            highMarginBps: Math.round(Number(text("highMargin", String(raw.highMargin * 100))) * 100),
            lowMarginBps: Math.round(Number(text("lowMargin", String(raw.lowMargin * 100))) * 100),
            lowConversionBps: Math.round(Number(text("lowConv", String(raw.lowConversion * 100))) * 100),
            judgementDays: Number(text("judgement", String(raw.judgementDays))),
            hero: {
              eyebrow: text("eyebrow", raw.hero.eyebrow),
              title: text("heroTitle", raw.hero.title),
              subtitle: text("subtitle", raw.hero.subtitle),
              ctaLabel: text("cta", raw.hero.ctaLabel),
              ctaHref: raw.hero.ctaHref,
              image: raw.hero.image,
            },
            benefits: [0, 1, 2].map((index) => ({
              title: text(`b${index}t`, raw.benefits[index]?.title ?? ""),
              body: text(`b${index}b`, raw.benefits[index]?.body ?? ""),
            })),
            editorial: {
              eyebrow: text("eEye", raw.editorial.eyebrow),
              title: text("eTitle", raw.editorial.title),
              body: text("eBody", raw.editorial.body),
              image: raw.editorial.image,
            },
            footerBlurb: text("footer", raw.footerBlurb),
            socials: raw.socials,
          },
        })
          .then(() => toast("Saved"))
          .catch((err: unknown) => toast(err instanceof Error ? err.message : "Failed"));
      }}
    >
      {part === "content" ? (
        <>
          <Field label="Announcement" name="announcement" defaultValue={raw.announcement} />
          <Field label="Hero eyebrow" name="eyebrow" defaultValue={raw.hero.eyebrow} />
          <Field label="Hero title" name="heroTitle" defaultValue={raw.hero.title} />
          <Field label="Hero subtitle" name="subtitle" defaultValue={raw.hero.subtitle} />
          <Field label="Hero button" name="cta" defaultValue={raw.hero.ctaLabel} />
          <Field label="Editorial eyebrow" name="eEye" defaultValue={raw.editorial.eyebrow} />
          <Field label="Editorial title" name="eTitle" defaultValue={raw.editorial.title} />
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs tracking-[0.14em] text-ash uppercase">Editorial</span>
            <textarea name="eBody" defaultValue={raw.editorial.body} className="h-28 w-full border border-line bg-paper p-3" />
          </label>
          {raw.benefits.map((benefit, index) => (
            <div key={index} className="grid gap-3">
              <Field label={`Benefit ${index + 1}`} name={`b${index}t`} defaultValue={benefit.title} />
              <Field label="Detail" name={`b${index}b`} defaultValue={benefit.body} />
            </div>
          ))}
          <Field label="Footer line" name="footer" defaultValue={raw.footerBlurb} />
        </>
      ) : (
        <>
          <Field label="House name" name="brandName" defaultValue={raw.brandName} />
          <Field label="Tagline" name="tagline" defaultValue={raw.tagline} />
          <Field label="Support email" name="supportEmail" defaultValue={raw.supportEmail} />
          <Field label="Standard shipping $" name="shipping" defaultValue={centsToInput(raw.shippingFlatCents)} />
          <Field label="Express shipping $" name="express" defaultValue={centsToInput(raw.expressShippingCents)} />
          <Field label="Free shipping from $" name="threshold" defaultValue={centsToInput(raw.freeShippingThresholdCents)} />
          <Field label="Low stock at" name="lowStock" defaultValue={String(raw.lowStock)} />
          <Field label="Slow cover, days" name="slow" defaultValue={String(raw.slowCoverDays)} />
          <Field label="Reorder under, days" name="cover" defaultValue={String(raw.replenishCoverDays)} />
          <Field label="Minimum views before a conversion judgement" name="views" defaultValue={String(raw.minViews)} />
          <Field label="High margin %" name="highMargin" defaultValue={String(Math.round(raw.highMargin * 100))} />
          <Field label="Low margin %" name="lowMargin" defaultValue={String(Math.round(raw.lowMargin * 100))} />
          <Field label="Low conversion %" name="lowConv" defaultValue={String(raw.lowConversion * 100)} />
          <Field label="Days before judging a new piece" name="judgement" defaultValue={String(raw.judgementDays)} />
          <p className="text-sm text-ash">Payments: demonstration checkout only. No card processor is configured, and the shop does not simulate a successful card charge.</p>
          <p className="text-sm">Newsletter addresses saved: {raw.subscribers}</p>
          <h2 className="text-2xl">Administrators</h2>
          <ul className="text-sm">
            {raw.members.map((member) => <li key={member.userId}>{member.name || "Administrator"} · {member.email}</li>)}
          </ul>
          <h2 className="text-2xl">Recent audit</h2>
          <ul className="text-xs text-ash">
            {raw.audit.map((row, index) => <li key={index}>{row.at.slice(0, 16)} · {row.action} · {row.entity}</li>)}
          </ul>
        </>
      )}
      <Button type="submit">Save</Button>
    </form>
  );
}
