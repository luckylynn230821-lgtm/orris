import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDeskAccess } from "@/components/admin/frame";
import { Button, Field } from "@/components/ui";
import { adminCarriers, adminSaveCarrier } from "@/lib/commerce/fns";
import { publicHttpUrl, trackLive, type LiveTracking } from "@/lib/commerce/shipping";
import { centsToInput, dollarsToCents, money } from "@/lib/format";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/logistics")({
  component: LogisticsPage,
  head: () => ({ meta: [{ title: "Logistics — Merchant desk" }] }),
});

type Draft = { id?: string; name: string; trackingUrl: string; cost: string };

const blank: Draft = { name: "", trackingUrl: "", cost: "0.00" };

function LogisticsPage() {
  const { t, tx } = useT();
  const access = useDeskAccess();
  const seeCost = access?.permissions.money ?? false;
  const canEdit = access?.permissions.settings ?? false;
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminCarriers>>["carriers"]>([]);
  const [draft, setDraft] = useState<Draft>(blank);
  const [number, setNumber] = useState("");
  const [hit, setHit] = useState<LiveTracking | null>(null);
  const load = () => {
    void adminCarriers()
      .then((value) => setRows(value.carriers))
      .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
  };
  useEffect(load, []);
  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl">{t("desk.logisticsTitle")}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ash">{t("desk.logisticsBody")}</p>
      {!seeCost ? <p className="mt-2 text-sm text-ash">{t("desk.costOwner")}</p> : null}
      <form
        className="mt-6 grid gap-3 bg-paper p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const result = trackLive({ tracking: number });
          setHit(result);
        }}
      >
        <h2 className="text-2xl">{t("desk.trackLookup")}</h2>
        <Field label={t("desk.trackNumber")} value={number} onChange={(event) => setNumber(event.target.value)} />
        <Button type="submit">{t("desk.trackLookup")}</Button>
        {hit?.connected ? (
          <div className="text-sm">
            <p>{t("desk.detected", { carrier: hit.carrier })}</p>
            <p className="mt-1 text-ash">{t("desk.trackPublic")}</p>
            {publicHttpUrl(hit.url) ? (
              <a className="mt-2 inline-block underline" href={publicHttpUrl(hit.url)} target="_blank" rel="noreferrer">
                {t("desk.trackOpen")}
              </a>
            ) : null}
          </div>
        ) : hit ? (
          <p className="text-sm text-ash">{t("desk.trackMissing")}</p>
        ) : null}
      </form>
      <div className="mt-6 overflow-auto bg-paper">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-ash uppercase">
            <tr>
              <th className="p-3">{t("desk.carrierName")}</th>
              <th className="p-3">{t("desk.trackingLink")}</th>
              {seeCost ? <th className="p-3">{t("desk.logisticsCost")}</th> : null}
              {canEdit ? <th className="p-3"></th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="p-3 text-ash" colSpan={4}>{t("desk.noCarriers")}</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3">{row.name}</td>
                <td className="p-3 break-all text-ash">{row.trackingUrl || "—"}</td>
                {seeCost ? <td className="p-3 tabular-nums">{money(row.costCents ?? 0)}</td> : null}
                {canEdit ? (
                  <td className="p-3">
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setDraft({
                        id: row.id,
                        name: row.name,
                        trackingUrl: row.trackingUrl,
                        cost: centsToInput(row.costCents ?? 0),
                      })}
                    >
                      {t("desk.edit")}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <form
          className="mt-6 grid gap-3 bg-paper p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void adminSaveCarrier({
              data: {
                id: draft.id,
                name: draft.name,
                trackingUrl: draft.trackingUrl,
                costCents: dollarsToCents(draft.cost || "0"),
              },
            })
              .then((value) => {
                setRows(value.carriers);
                setDraft(blank);
                toast(t("desk.saved"));
              })
              .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
          }}
        >
          <h2 className="text-2xl">{draft.id ? t("desk.carrierName") : t("desk.addCarrier")}</h2>
          <Field label={t("desk.carrierName")} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
          <Field
            label={t("desk.trackingTemplate")}
            value={draft.trackingUrl}
            onChange={(event) => setDraft({ ...draft, trackingUrl: event.target.value })}
            placeholder="https://track.example/{{tracking}}"
          />
          {seeCost ? (
            <Field label={t("desk.costPerShipment")} value={draft.cost} onChange={(event) => setDraft({ ...draft, cost: event.target.value })} />
          ) : null}
          <div className="flex gap-3">
            <Button type="submit">{draft.id ? t("desk.save") : t("desk.addCarrier")}</Button>
            {draft.id ? (
              <Button type="button" variant="ghost" onClick={() => setDraft(blank)}>{t("admin.cancel")}</Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
