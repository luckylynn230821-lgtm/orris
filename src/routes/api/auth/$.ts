import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: async ({ request }) => {
        const { guardAuthRequest } = await import("@/lib/shield.server");
        const denied = guardAuthRequest(request);
        if (denied) return denied;
        return auth.handler(request);
      },
    },
  },
});
