import { createFileRoute } from "@tanstack/react-router";
import { SettingsForm } from "@/components/admin/settings-form";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Merchant desk" }] }),
});

function SettingsPage() {
  const { t } = useT();
  return (
    <div>
      <h1 className="mb-6 text-4xl">{t("admin.settingsTitle")}</h1>
      <SettingsForm part="shop" />
    </div>
  );
}