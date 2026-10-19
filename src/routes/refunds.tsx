import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/store/policy";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/refunds")({
  component: RefundsPage,
  head: () => ({ meta: [{ title: "Refunds — MU" }] }),
});

function RefundsPage() {
  const { t } = useT();
  return (
    <PolicyPage
      kicker={t("legal.kicker")}
      title={t("legal.refundTitle")}
      sections={[
        { heading: t("legal.beforeTitle"), body: t("legal.beforeBody") },
        { heading: t("legal.afterTitle"), body: t("legal.afterBody") },
        { heading: t("legal.askTitle"), body: t("legal.askBody") },
        { heading: t("legal.conditionTitle"), body: t("legal.conditionBody") },
        { heading: t("legal.timeTitle"), body: t("legal.timeBody") },
      ]}
    />
  );
}
