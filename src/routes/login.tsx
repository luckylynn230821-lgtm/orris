import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { StoreShell } from "@/components/store/shell";
import { Button, Field } from "@/components/ui";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — ORRIS" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <StoreShell>
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-4xl">{mode === "in" ? "Sign in" : "Create an account"}</h1>
        <p className="mt-3 text-sm leading-6 text-ash">
          Guests can shop without an account. The first person to sign in becomes the merchant.
        </p>
        {authEnabled ? (
          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const email = String(form.get("email") || "");
              const password = String(form.get("password") || "");
              const name = String(form.get("name") || "Merchant");
              setPending(true);
              setError("");
              const done = () => {
                setPending(false);
                void navigate({ to: "/admin" });
              };
              if (mode === "up") {
                void authClient.signUp
                  .email({ email, password, name })
                  .then((result) => {
                    if (result.error) setError(result.error.message || "Could not create the account");
                    else done();
                  })
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not create the account"))
                  .finally(() => setPending(false));
              } else {
                void authClient.signIn
                  .email({ email, password })
                  .then((result) => {
                    if (result.error) setError(result.error.message || "Could not sign in");
                    else done();
                  })
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not sign in"))
                  .finally(() => setPending(false));
              }
            }}
          >
            {mode === "up" ? <Field label="Name" name="name" required /> : null}
            <Field label="Email" name="email" type="email" required />
            <Field label="Password" name="password" type="password" required minLength={8} />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
            </Button>
            <button type="button" className="text-sm text-ash underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Need an account?" : "Already have an account?"}
            </button>
          </form>
        ) : (
          <p className="mt-6 text-sm">Sign-in is disabled.</p>
        )}
        <div className="mt-8 space-y-2">
          {GROK_PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              className="h-11 w-full border border-line text-sm"
              onClick={() => void signIn(provider.providerId, { callbackURL: "/admin" })}
            >
              Continue with {provider.label}
            </button>
          ))}
        </div>
      </main>
    </StoreShell>
  );
}
