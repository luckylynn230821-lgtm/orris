import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { I18nProvider } from "@/lib/i18n/provider";
import { htmlLang, parseLocale, type Locale } from "@/lib/i18n/locales";
import { readRequestLocale } from "@/lib/i18n/read-locale";
import { translate } from "@/lib/i18n/translate";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  beforeLoad: async () => {
    if (typeof document !== "undefined") return { locale: parseLocale(document.cookie) };
    return { locale: await readRequestLocale() };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MU — Test template, not an official shop" },
      {
        name: "description",
        content: "MU — a studio for the animals at home. Everyday objects for dogs and cats.",
      },
      { name: "theme-color", content: "#FAF8F3" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700&family=Outfit:wght@300;400;500;600&family=Noto+Sans+JP:wght@400;500&family=Noto+Sans+KR:wght@400;500&family=Noto+Sans+SC:wght@400;500&family=Noto+Sans+TC:wght@400;500&display=swap",
      },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
});

function NotFound() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => setLocale(parseLocale(document.cookie)), []);
  return (
    <main className="grid min-h-screen place-items-center bg-ivory px-6 text-center">
      <div>
        <p className="font-display text-2xl tracking-[-0.04em]">MU</p>
        <h1 className="mt-3 text-4xl">{translate(locale, "notFound.title")}</h1>
        <a href="/" className="mt-6 inline-block text-sm underline underline-offset-4">
          {translate(locale, "notFound.back")}
        </a>
      </div>
    </main>
  );
}

function RootComponent() {
  const { locale } = Route.useRouteContext();
  return (
    <html lang={htmlLang(locale)} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <I18nProvider initial={locale}>
          <AuthProvider>
            <Outlet />
            <Toaster
              position="top-center"
              toastOptions={{
                style: { background: "#222222", color: "#faf9f6", border: "none", borderRadius: 2 },
              }}
            />
          </AuthProvider>
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  );
}
