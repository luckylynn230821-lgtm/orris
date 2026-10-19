import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { StoreShell } from "@/components/store/shell";
import { Button, Field } from "@/components/ui";
import { GROK_PROVIDERS, authClient, authEnabled, authPopupUrl, signIn, watchPopupSignIn, type SignInEvent } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: search.next === "admin" ? ("admin" as const) : ("account" as const),
  }),
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — MU" }] }),
});

function LoginPage() {
  const { t, tx } = useT();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { user } = useCurrentUserState();
  const merchant = next === "admin";
  const dest = merchant ? "/admin" : "/account";
  const [mode, setMode] = useState<"in" | "up">("up");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<{ id: string; label: string } | null>(null);
  const addLine = (text: string) => setLog((prev) => [...prev, text]);
  const lineFor = (event: SignInEvent, provider: string) => {
    if (event.code === "opening") return t("login.traceOpening", { provider });
    if (event.code === "blocked") return t("login.traceBlocked");
    if (event.code === "waiting") return t("login.traceWaiting", { provider });
    if (event.code === "redirecting") return t("login.traceRedirect");
    if (event.code === "stuck") return t("login.traceStuck");
    if (event.code === "done") return t("login.traceDone");
    if (event.code === "cancelled") return t("login.traceCancelled");
    return t("login.traceFailed", { message: event.detail || t("login.failedIn") });
  };
  const shown = log.length > 0 ? log : [t("login.traceIdle")];
  return (
    <StoreShell>
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:px-6">
        <div>
          <p className="text-xs tracking-[0.18em] text-ash uppercase">{merchant ? t("login.merchant") : t("login.customer")}</p>
          <h1 className="mt-3 text-5xl">{merchant ? t("login.merchantTitle") : t("login.customerTitle")}</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-ash">
            {merchant ? t("login.merchantBody") : t("login.customerBody")}
          </p>
        </div>
        <div>
          {user ? (
            <div className="text-sm leading-6">
              <p>
                {t("login.signedIn", { email: user.primaryEmail ?? "" })}
              </p>
              <Button className="mt-3" onClick={() => void navigate({ to: dest })}>
                {t("login.continue")}
              </Button>
            </div>
          ) : null}
          {authEnabled ? (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const email = String(form.get("email") || "");
                const password = String(form.get("password") || "");
                const name = String(form.get("name") || "Customer");
                setPending(true);
                setError("");
                const done = () => {
                  setPending(false);
                  void navigate({ to: dest });
                };
                if (mode === "up") {
                  void authClient.signUp
                    .email({ email, password, name })
                    .then((result) => {
                      if (result.error) setError(result.error.message ? localize(result.error.message, tx) : t("login.failedCreate"));
                      else done();
                    })
                    .catch((err: unknown) => setError(err instanceof Error ? localize(err.message, tx) : t("login.failedCreate")))
                    .finally(() => setPending(false));
                } else {
                  void authClient.signIn
                    .email({ email, password })
                    .then((result) => {
                      if (result.error) setError(result.error.message ? localize(result.error.message, tx) : t("login.failedIn"));
                      else done();
                    })
                    .catch((err: unknown) => setError(err instanceof Error ? localize(err.message, tx) : t("login.failedIn")))
                    .finally(() => setPending(false));
                }
              }}
            >
              {mode === "up" ? <Field label={t("login.name")} name="name" required /> : null}
              <Field label={t("login.email")} name="email" type="email" required />
              <Field label={t("login.password")} name="password" type="password" required minLength={8} />
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? t("login.wait") : mode === "up" ? t("login.create") : t("login.signIn")}
              </Button>
              <button type="button" className="text-sm text-ash underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
                {mode === "in" ? t("login.needAccount") : t("login.haveAccount")}
              </button>
            </form>
          ) : (
            <p className="mt-6 text-sm">{t("login.closed")}</p>
          )}
          <div className="mt-8 space-y-2">
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                type="button"
                className="h-11 w-full border border-line text-sm"
                onClick={() => {
                  let reported = false;
                  setLog([t("login.traceClicked", { provider: provider.label })]);
                  setBlocked(null);
                  setError("");
                  void signIn(provider.providerId, {
                    callbackURL: dest,
                    report: (event) => {
                      reported = true;
                      addLine(lineFor(event, provider.label));
                      if (event.code === "blocked") setBlocked({ id: provider.providerId, label: provider.label });
                    },
                  }).catch((err: unknown) => {
                    if (reported) return;
                    const message = err instanceof Error ? err.message : "";
                    addLine(t("login.traceFailed", { message: message || t("login.failedIn") }));
                  });
                }}
              >
                {t("login.with", { provider: provider.label })}
              </button>
            ))}
            <div className="mt-3 border border-ink bg-paper p-4 text-sm" aria-live="polite">
              <p className="text-xs tracking-[0.14em] text-ash uppercase">{t("login.traceTitle")}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                {shown.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ol>
              {blocked ? (
                <a
                  className="mt-3 inline-block underline"
                  href={authPopupUrl(blocked.id)}
                  target="_blank"
                  rel="opener"
                  onClick={() => {
                    addLine(t("login.traceWaiting", { provider: blocked.label }));
                    void watchPopupSignIn(dest)
                      .then(() => addLine(t("login.traceDone")))
                      .catch((err: unknown) => {
                        const message = err instanceof Error ? err.message : "";
                        addLine(message.includes("cancelled") ? t("login.traceCancelled") : t("login.traceFailed", { message: message || t("login.failedIn") }));
                      });
                  }}
                >
                  {t("login.traceOpenLink", { provider: blocked.label })}
                </a>
              ) : null}
            </div>
          </div>
          <p className="mt-6 text-sm text-ash">
            {merchant ? (
              <Link to="/login" search={{ next: "account" }} className="underline">{t("login.iAmCustomer")}</Link>
            ) : (
              <Link to="/login" search={{ next: "admin" }} className="underline">{t("login.iAmMerchant")}</Link>
            )}
          </p>
        </div>
      </main>
    </StoreShell>
  );
}
