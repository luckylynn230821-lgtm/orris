import { createFileRoute } from "@tanstack/react-router";
import { SettingsForm } from "@/components/admin/settings-form";

export const Route = createFileRoute("/admin/settings")({
  component: () => (
    <div>
      <h1 className="mb-6 text-4xl">Settings</h1>
      <SettingsForm part="shop" />
    </div>
  ),
  head: () => ({ meta: [{ title: "Settings — ORRIS desk" }] }),
});
