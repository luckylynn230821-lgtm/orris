import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  FileSpreadsheet,
  LayoutDashboard,
  Lightbulb,
  Package,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { signIn } from "@/lib/auth/client";
import { GROK_PROVIDERS } from "@/lib/auth/providers";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/intelligence", label: "Intelligence", icon: Lightbulb },
  { to: "/admin/reports", label: "Reports", icon: FileSpreadsheet },
  { to: "/admin/content", label: "Content", icon: Sparkles },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminFrame({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (isPending) {
    return (
      <div className="min-h-screen bg-stone p-8">
        <div className="h-8 w-40 animate-pulse bg-line" />
        <div className="mt-6 h-40 animate-pulse bg-paper" />
      </div>
    );
  }
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-ivory px-6">
        <div className="w-full max-w-md">
          <p className="text-xs tracking-[0.2em] text-ash uppercase">Merchant desk</p>
          <h1 className="mt-3 text-4xl">Sign in to keep the books.</h1>
          <p className="mt-3 text-sm leading-6 text-ash">
            The shop is open to guests. Cost, profit and customer records open only after you sign in. The first account becomes the administrator.
          </p>
          <a href="/login" className="mt-6 inline-flex h-11 items-center bg-ink px-5 text-sm text-ivory">Sign in with email</a>
          <div className="mt-4 space-y-2">
            {GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                className="h-11 w-full border border-line text-sm"
                onClick={() => void signIn(provider.providerId, { callbackURL: "/admin" })}
              >
                Continue with {provider.label}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }
  return (
    <div className="min-h-screen bg-stone text-ink md:grid md:grid-cols-[220px_1fr]">
      <aside className="bg-ink text-ivory md:min-h-screen">
        <div className="flex items-center justify-between px-4 py-5">
          <Link to="/" className="font-display text-xl tracking-[0.16em]">ORRIS</Link>
          <UserButton />
        </div>
        <nav className="flex gap-1 overflow-auto px-2 pb-3 md:block md:space-y-1">
          {NAV.map((item) => {
            const active = item.to === "/admin" ? path === "/admin" : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex shrink-0 items-center gap-2 px-3 py-2 text-sm text-ivory/70",
                  active && "bg-white/10 text-ivory",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 px-4 py-6 md:px-8">{children}</div>
    </div>
  );
}

export function AdminError({ message }: { message: string }) {
  return <p className="border border-danger/30 bg-paper p-4 text-sm text-danger">{message}</p>;
}
