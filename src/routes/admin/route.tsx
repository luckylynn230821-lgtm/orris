import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminFrame } from "@/components/admin/frame";
import { DeskLoading } from "@/components/loading-screen";

export const Route = createFileRoute("/admin")({
  pendingComponent: DeskLoading,
  component: () => (
    <AdminFrame>
      <Outlet />
    </AdminFrame>
  ),
});
