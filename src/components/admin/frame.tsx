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
  UserPlus,
  Users,
} from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { signIn } from "@/lib/auth/client";
import { GROK_PROVIDERS } from "@/lib/auth/providers";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";
import { adminSession } from "@/lib/commerce/fns";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translate";

type Desk = Awaited<ReturnType<typeof adminSession>>;
const DeskContext = createContext<Desk | null>(null);
export function useDeskAccess() {
  return useContext(DeskContext);
}

const NAV = [
  { to: "/admin", label: "admin.overview", icon: LayoutDashboard, permission: "orders" },
  { to: "/admin/products", label: "admin.products", icon: Package, permission: "catalog" },
  { to: "/admin/inventory", label: "admin.inventory", icon: Boxes, permission: "inventory" },
  { to: "/admin/orders", label: "admin.orders", icon: ShoppingBag, permission: "orders" },
  { to: "/admin/customers", label: "admin.customers", icon: Users, permission: "customers" },
  { to: "/admin/analytics", label: "admin.analytics", icon: BarChart3, permission: "money" },
  { to: "/admin/intelligence", label: "admin.intelligence", icon: Lightbulb, permission: "money" },
  { to: "/admin/reports", label: "admin.reports", icon: FileSpreadsheet, permission: "money" },
  { to: "/admin/content", label: "admin.content", icon: Sparkles, permission: "settings" },
  { to: "/admin/settings", label: "admin.settings", icon: Settings, permission: "settings" },
  { to: "/admin/team", label: "admin.team", icon: UserPlus, permission: "team" },
] as const;

const GUARDS: { prefix: string; permission: keyof Desk["permissions"] }[] = [
  { prefix: "/admin/products", permission: "catalog" },
  { prefix: "/admin/inventory", permission: "inventory" },
  { prefix: "/admin/orders", permission: "orders" },
  { prefix: "/admin/customers", permission: "customers" },
  { prefix: "/admin/analytics", permission: "money" },
  { prefix: "/admin/intelligence", permission: "money" },
  { prefix: "/admin/reports", permission: "money" },
  { prefix: "/admin/content", permission: "settings" },
  { prefix: "/admin/settings", permission: "settings" },
  { prefix: "/admin/team", permission: "team" },
];

export function AdminFrame({ children }: { children: ReactNode }) {
  const { t, tx } = useT();
  const { user, isPending } = useCurrentUserState();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [access, setAccess] = useState<Desk | null>(null);
  const [sessionError, setSessionError] = useState("");
  useEffect(() => {
    if (!user) return;
    let live = true;
    void adminSession()
      .then((value) => {
        if (live) setAccess(value);
      })
      .catch((err: unknown) => {
        if (live) setSessionError(err instanceof Error ? localize(err.message, tx) : t("admin.failed"));
      });
    return () => {
      live = false;
    };
  }, [user?.id, tx]);
  if (isPending || (user && !access && !sessionError)) {
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
  if (sessionError || !access) {
    return (
      <main className="grid min-h-screen place-items-center bg-ivory px-6">
        <div className="w-full max-w-md">
          <h1 className="text-4xl">{t("admin.gateTitle")}</h1>
          <p className="mt-3 text-sm leading-6 text-ash">{sessionError || t("admin.denied")}</p>
          <Link to="/account" className="mt-6 inline-flex text-sm underline">{t("account.title")}</Link>
        </div>
      </main>
    );
  }
  const blocked = GUARDS.find((guard) => path.startsWith(guard.prefix) && !access.permissions[guard.permission]);
  const roleKey = `admin.role${access.role[0]?.toUpperCase()}${access.role.slice(1)}` as MessageKey;
  return (
    <DeskContext.Provider value={access}>
      <div className="min-h-screen bg-stone text-ink md:grid md:grid-cols-[220px_1fr]">
        <aside className="bg-ink text-ivory md:min-h-screen">
          <div className="flex items-center justify-between px-4 py-5">
            <Link to="/" className="font-display text-xl tracking-[-0.04em]">Desk</Link>
            <div className="flex items-center gap-2">
              <LanguageSwitch tone="ink" />
              <UserButton />
            </div>
          </div>
          <p className="px-4 pb-3 text-xs tracking-[0.14em] text-ivory/50 uppercase">{t(roleKey)}</p>
          <nav className="flex gap-1 overflow-auto px-2 pb-3 md:block md:space-y-1">
            {NAV.filter((item) => access.permissions[item.permission]).map((item) => {
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
                  {t(item.label)}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 px-4 py-6 md:px-8">
          {blocked ? <p className="text-sm text-ash">{t("admin.denied")}</p> : children}
        </div>
      </div>
    </DeskContext.Provider>
  );
}

export function AdminError({ message }: { message: string }) {
  return <p className="border border-danger/30 bg-paper p-4 text-sm text-danger">{message}</p>;
}