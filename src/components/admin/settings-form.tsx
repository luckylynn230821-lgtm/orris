import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui";
import { adminSaveSettings, adminSettings } from "@/lib/commerce/fns";
import { centsToInput, dollarsToCents } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translate";

const AUDIT: Record<string, MessageKey> = {
  save_product: "desk.actSaveProduct",
  bulk_products: "desk.actBulk",
  adjust_stock: "desk.actStock",
  fulfill: "desk.actFulfill",
  refund: "desk.actRefund",
  cancel: "desk.actCancel",
  save_settings: "desk.actSettings",
  grant_seat: "desk.actGrant",
  revoke_seat: "desk.actRevoke",
  accept_order: "desk.actAccept",
  broadcast: "desk.actBroadcast",
  accept_invite: "desk.actInvite",
  save_carrier: "desk.actCarrier",
};

export function SettingsForm({ part }: { part: "content" | "shop" }) {
  const { t } = useT();
  const [raw, setRaw] = useState<Awaited<ReturnType<typeof adminSettings>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void adminSettings().then(setRaw).catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
  }, []);
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!raw) return <p className="text-sm text-ash">{t("admin.loading")}</p>;
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
            highMarginBps: Math.round(Number(text("highMargin", String((raw.highMargin ?? 0) * 100))) * 100),
            lowMarginBps: Math.round(Number(text("lowMargin", String((raw.lowMargin ?? 0) * 100))) * 100),
            lowConversionBps: Math.round(Number(text("lowConv", String(raw.lowConversion * 100))) * 100),
            judgementDays: Number(text("judgement", String(raw.judgementDays))),
            vatBps: Math.round(Number(text("vat", String((raw.vatRate ?? 0) * 100))) * 100),
            importTaxBps: Math.round(Number(text("importTax", String((raw.importTaxRate ?? 0) * 100))) * 100),
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
          <Field label={t("desk.announcement")} name="announcement" defaultValue={raw.announcement} />
          <Field label={t("desk.heroEyebrow")} name="eyebrow" defaultValue={raw.hero.eyebrow} />
          <Field label={t("desk.heroTitle")} name="heroTitle" defaultValue={raw.hero.title} />
          <Field label={t("desk.heroSubtitle")} name="subtitle" defaultValue={raw.hero.subtitle} />
          <Field label={t("desk.heroButton")} name="cta" defaultValue={raw.hero.ctaLabel} />
          <Field label={t("desk.editorialEyebrow")} name="eEye" defaultValue={raw.editorial.eyebrow} />
          <Field label={t("desk.editorialTitle")} name="eTitle" defaultValue={raw.editorial.title} />
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs tracking-[0.14em] text-ash uppercase">{t("desk.editorial")}</span>
            <textarea name="eBody" defaultValue={raw.editorial.body} className="h-28 w-full border border-line bg-paper p-3" />
          </label>
          {raw.benefits.map((benefit, index) => (
            <div key={index} className="grid gap-3">
              <Field label={t("desk.benefit", { n: index + 1 })} name={`b${index}t`} defaultValue={benefit.title} />
              <Field label={t("desk.detail")} name={`b${index}b`} defaultValue={benefit.body} />
            </div>
          ))}
          <Field label={t("desk.footerLine")} name="footer" defaultValue={raw.footerBlurb} />
        </>
      ) : (
        <>
          <Field label={t("desk.houseName")} name="brandName" defaultValue={raw.brandName} />
          <Field label={t("desk.tagline")} name="tagline" defaultValue={raw.tagline} />
          <Field label={t("desk.supportEmail")} name="supportEmail" defaultValue={raw.supportEmail} />
          <Field label={t("desk.standardShip")} name="shipping" defaultValue={centsToInput(raw.shippingFlatCents)} />
          <Field label={t("desk.expressShip")} name="express" defaultValue={centsToInput(raw.expressShippingCents)} />
          <Field label={t("desk.freeFrom")} name="threshold" defaultValue={centsToInput(raw.freeShippingThresholdCents)} />
          <Field label={t("desk.lowStock")} name="lowStock" defaultValue={String(raw.lowStock)} />
          <Field label={t("desk.slowCover")} name="slow" defaultValue={String(raw.slowCoverDays)} />
          <Field label={t("desk.reorder")} name="cover" defaultValue={String(raw.replenishCoverDays)} />
          <Field label={t("desk.minViews")} name="views" defaultValue={String(raw.minViews)} />
          {raw.highMargin !== null && raw.lowMargin !== null ? (
            <>
              <Field label={t("desk.highMargin")} name="highMargin" defaultValue={String(Math.round(raw.highMargin * 100))} />
              <Field label={t("desk.lowMargin")} name="lowMargin" defaultValue={String(Math.round(raw.lowMargin * 100))} />
            </>
          ) : null}
          {raw.vatRate !== null && raw.importTaxRate !== null ? (
            <>
              <Field label={t("desk.vatRate")} name="vat" defaultValue={String(Math.round(raw.vatRate * 100))} />
              <Field label={t("desk.importRate")} name="importTax" defaultValue={String(Math.round(raw.importTaxRate * 100))} />
            </>
          ) : null}
          <Field label={t("desk.lowConv")} name="lowConv" defaultValue={String(raw.lowConversion * 100)} />
          <Field label={t("desk.judgementDays")} name="judgement" defaultValue={String(raw.judgementDays)} />
          <p className="text-sm text-ash">{t("desk.paymentsNote")}</p>
          <p className="text-sm">{t("desk.subscribers", { count: raw.subscribers })}</p>
          <h2 className="text-2xl">{t("desk.administrators")}</h2>
          <ul className="text-sm">
            {raw.members.map((member) => <li key={member.userId}>{member.name ? `${member.name} · ${member.email}` : member.email}</li>)}
          </ul>
          <h2 className="text-2xl">{t("desk.recentAudit")}</h2>
          <ul className="text-xs text-ash">
            {raw.audit.map((row, index) => <li key={index}>{row.at.slice(0, 16)} · {AUDIT[row.action] ? t(AUDIT[row.action]) : row.action} · {row.entity}</li>)}
          </ul>
        </>
      )}
      <Button type="submit">{t("desk.save")}</Button>
    </form>
  );
}
