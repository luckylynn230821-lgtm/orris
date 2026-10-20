import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminError } from "@/components/admin/frame";
import { Button, Field } from "@/components/ui";
import { adminGrant, adminRevoke, adminTeam } from "@/lib/commerce/fns";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translate";

export const Route = createFileRoute("/admin/team")({
  component: TeamPage,
  head: () => ({ meta: [{ title: "Team — Merchant desk" }] }),
});

type Team = Awaited<ReturnType<typeof adminTeam>>;

function TeamPage() {
  const { t, tx } = useT();
  const tRef = useRef(t);
  const txRef = useRef(tx);
  tRef.current = t;
  txRef.current = tx;
  const [data, setData] = useState<Team | null>(null);
  const [error, setError] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("staff");
  useEffect(() => {
    void adminTeam()
      .then((value) => {
        setData(value);
        setError("");
      })
      .catch((err: unknown) => setError(err instanceof Error ? localize(err.message, txRef.current) : tRef.current("admin.failed")));
  }, []);
  const label = (value: string) => t(`admin.role${value[0]?.toUpperCase()}${value.slice(1)}` as MessageKey);

  return (
    <div>
      <h1 className="text-4xl">{t("admin.teamTitle")}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ash">{t("admin.teamBody")}</p>
      {data ? (
        <p className="mt-3 text-sm tabular-nums">{t("admin.teamSeats", { used: data.seats.used, cap: data.seats.cap })}</p>
      ) : null}
      {error ? <div className="mt-4"><AdminError message={error} /></div> : null}
      <form
        className="mt-6 grid gap-3 bg-paper p-4 md:grid-cols-[1fr_180px_auto] md:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void adminGrant({ data: { email: String(form.get("email") || ""), role } })
            .then((value) => {
              setData(value);
              toast(t("admin.teamSaved"));
              event.currentTarget.reset();
            })
            .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
        }}
      >
        <Field label={t("admin.teamEmail")} name="email" type="email" required />
        <label className="block text-sm">
          <span className="text-ash">{t("admin.teamRole")}</span>
          <select
            className="mt-1 h-11 w-full border border-line bg-ivory px-3"
            value={role}
            onChange={(event) => setRole(event.target.value as "manager" | "staff")}
          >
            <option value="manager">{t("admin.roleManager")}</option>
            <option value="staff">{t("admin.roleStaff")}</option>
          </select>
        </label>
        <Button type="submit">{t("admin.teamAdd")}</Button>
      </form>
      {data ? (
        <ul className="mt-6 divide-y divide-line bg-paper text-sm">
          {data.members.map((member) => (
            <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p>{member.email || member.name}</p>
                <p className="text-ash">{label(member.role)}</p>
              </div>
              {member.role === "owner" ? null : (
                <button
                  className="text-danger underline"
                  onClick={() => {
                    if (!member.email) return;
                    void adminRevoke({ data: { email: member.email } })
                      .then(setData)
                      .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
                  }}
                >
                  {t("admin.teamRemove")}
                </button>
              )}
            </li>
          ))}
          {data.invites.map((invite) => (
            <li key={invite.email} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p>{invite.email}</p>
                <p className="text-ash">{label(invite.role)} · {t("admin.teamPending")}</p>
              </div>
              <button
                className="text-danger underline"
                onClick={() => {
                  void adminRevoke({ data: { email: invite.email } })
                    .then(setData)
                    .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
                }}
              >
                {t("admin.teamRemove")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
