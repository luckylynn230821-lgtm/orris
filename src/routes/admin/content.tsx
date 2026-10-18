import { createFileRoute } from "@tanstack/react-router";
import { SettingsForm } from "@/components/admin/settings-form";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/content")({
  component: ContentPage,
  head: () => ({ meta: [{ title: "Content — ORRIS desk" }] }),
});

function ContentPage() {
  const { t } = useT();
  return (
    <div>
      <h1 className="mb-2 text-4xl">{t("admin.contentTitle")}</h1>
      <p className="mb-6 max-w-xl text-sm text-ash">The homepage reads these fields. The layout stays fixed. There is no drag-and-drop page builder.</p>
      <SettingsForm part="content" />
    </div>
  );
}