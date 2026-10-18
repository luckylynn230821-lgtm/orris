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
import { LanguageSwitch } from "@/components/language-switch";
import { signIn } from "@/lib/auth/client";
import { GROK_PROVIDERS } from "@/lib/auth/providers";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translate";

const NAV = [
  { to: "/admin", label: "admin.overview", icon: LayoutDashboard },
  { to: "/admin/products", label: "admin.products", icon: Package },
  { to: "/admin/inventory", label: "admin.inventory", icon: Boxes },
  { to: "/admin/orders", label: "admin.orders", icon: ShoppingBag },
  { to: "/admin/customers", label: "admin.customers", icon: Users },
  { to: "/admin/analytics", label: "admin.analytics", icon: BarChart3 },
  { to: "/admin/intelligence", label: "admin.intelligence", icon: Lightbulb },
  { to: "/admin/reports", label: "admin.reports", icon: FileSpreadsheet },
  { to: "/admin/content", label: "admin.content", icon: Sparkles },
  { to: "/admin/settings", label: "admin.settings", icon: Settings },
] as const;

export function AdminFrame({ children }: { children: ReactNode }) {
  const { t } = useT();
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
          <p className="text-xs tracking-[0.2em] text-ash uppercase">{t("admin.gateKicker")}</p>
          <h1 className="mt-3 text-4xl">{t("admin.gateTitle")}</h1>
          <p className="mt-3 text-sm leading-6 text-ash">{t("admin.gateBody")}</p>
          <a href="/login?next=admin" className="mt-6 inline-flex h-11 items-center bg-ink px-5 text-sm text-ivory">{t("admin.gateEmail")}</a>
          <div className="mt-4 space-y-2">
            {GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                className="h-11 w-full border border-line text-sm"
                onClick={() => void signIn(provider.providerId, { callbackURL: "/admin" })}
              >
                {t("admin.gateWith", { provider: provider.label })}
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
          <div className="flex items-center gap-2">
            <LanguageSwitch tone="ink" />
            <UserButton />
          </div>
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
                {t(item.label as MessageKey)}
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
