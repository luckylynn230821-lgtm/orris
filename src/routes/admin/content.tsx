import { createFileRoute } from "@tanstack/react-router";
import { SettingsForm } from "@/components/admin/settings-form";

export const Route = createFileRoute("/admin/content")({
  component: () => (
    <div>
      <h1 className="mb-2 text-4xl">Storefront</h1>
      <p className="mb-6 max-w-xl text-sm text-ash">The homepage reads these fields. The layout stays fixed. There is no drag-and-drop page builder.</p>
      <SettingsForm part="content" />
    </div>
  ),
  head: () => ({ meta: [{ title: "Content — ORRIS desk" }] }),
});
