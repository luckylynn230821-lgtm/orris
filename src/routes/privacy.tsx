import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/store/policy";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({ meta: [{ title: "Privacy — MU" }] }),
});

function PrivacyPage() {
  const { t } = useT();
  return (
    <PolicyPage
      kicker={t("legal.kicker")}
      title={t("legal.privacyTitle")}
      sections={[
        { heading: t("legal.whoTitle"), body: t("legal.whoBody") },
        { heading: t("legal.collectTitle"), body: t("legal.collectBody") },
        { heading: t("legal.whyTitle"), body: t("legal.whyBody") },
        { heading: t("legal.shareTitle"), body: t("legal.shareBody") },
        { heading: t("legal.rightsTitle"), body: t("legal.rightsBody") },
      ]}
    />
  );
}
