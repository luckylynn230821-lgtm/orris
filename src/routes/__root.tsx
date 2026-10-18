import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ORRIS" },
      {
        name: "description",
        content: "ORRIS — objects for a considered life. A single-house shop for cashmere, linen, ceramic and brass.",
      },
      { name: "theme-color", content: "#FAF9F6" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,560&family=Outfit:wght@300;400;500;600&display=swap",
      },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <main className="grid min-h-screen place-items-center bg-ivory px-6 text-center">
      <div>
        <p className="text-xs tracking-[0.22em] text-ash uppercase">ORRIS</p>
        <h1 className="mt-3 text-4xl">This page is not in the house.</h1>
        <a href="/" className="mt-6 inline-block text-sm underline underline-offset-4">
          Return home
        </a>
      </div>
    </main>
  ),
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
          <Toaster
            position="top-center"
            toastOptions={{
              style: { background: "#222222", color: "#faf9f6", border: "none", borderRadius: 2 },
            }}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
