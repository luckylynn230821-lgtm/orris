import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminFrame } from "@/components/admin/frame";

export const Route = createFileRoute("/admin")({
  component: () => (
    <AdminFrame>
      <Outlet />
    </AdminFrame>
  ),
});
