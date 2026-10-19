import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { runPreSignInSignOut, runSignOut } from "../../../scripts/sign-out-plan.mjs";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { GROK_PROVIDERS } from "./providers";

/**
 * Better Auth client for this React SPA (browser-side).
 *
 * Talks to this app's OWN Better Auth at same-origin `/api/auth/*`. In the live
 * preview the app is an embedded iframe with PARTITIONED cookies, so after a
 * popup sign-in it can't read the session cookie — it authenticates with a
 * bearer token instead (captured from the popup, see `signIn`). The `onRequest`
 * hook attaches that token when present; when deployed (cookie auth) no token
 * is stored, so nothing changes.
 *
 * To sign out call `signOut()` below, NOT `authClient.signOut()`: the raw call
 * leaves the bearer token in place, and `onRequest` keeps re-attaching it, so
 * the visitor stays signed in.
 */
export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

/**
 * True when sign-in UI should be shown — i.e. whenever `VITE_AUTH_ENABLED` is
 * not `"false"`. The shipped template sets it to `"false"`
 * (`.grok/app-env.json`), which selects the dev user (see `use-current-user`);
 * with the key removed, sign-in is real in preview (baked preview client) and
 * when deployed (injected per-app client).
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

/** The upstream providers to render sign-in buttons for. */
export { GROK_PROVIDERS };

// ── Live-preview bearer token ────────────────────────────────────────────────
// The embedded preview iframe has partitioned cookies, so we keep the session's
// bearer token in sessionStorage and attach it to every Better Auth request (and
// to server functions, via `@/lib/auth/middleware`). Empty everywhere except the
// preview after a popup sign-in, so the cookie path is untouched elsewhere.
const BEARER_KEY = "grok-auth.bearer-token";

/** The stored preview bearer token, or null. */
export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(BEARER_KEY);
  } catch {
    return null;
  }
}

function setBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(BEARER_KEY, token);
    else window.sessionStorage.removeItem(BEARER_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

/**
 * The sandbox live preview runs this app inside an iframe on a `*.grok-sandbox.com`
 * host, where a full-page redirect to the broker can't work — so sign-in uses a
 * popup there and a normal redirect everywhere else.
 */
function inLivePreview(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname === "grok-sandbox.com" ||
      window.location.hostname.endsWith(".grok-sandbox.com"))
  );
}

/**
 * Google and X send `X-Frame-Options: DENY`, so a same-frame redirect inside the
 * preview looks like the button did nothing. Use a popup whenever this page is
 * framed, not only on `*.grok-sandbox.com`.
 */
function needsPopupSignIn(): boolean {
  if (typeof window === "undefined") return false;
  if (inLivePreview()) return true;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Message the popup posts back to the opener once sign-in completes. */
type PopupMessage = { source: "grok-auth-popup"; token: string | null; error?: string };

export type SignInEvent = { code: "opening" | "blocked" | "waiting" | "redirecting" | "stuck" | "done" | "cancelled" | "failed"; detail?: string };

/** Same-origin URL the sign-in tab loads. Keeps a path-based preview prefix. */
export function authPopupUrl(providerId: string): string {
  const prefix =
    typeof window === "undefined"
      ? ""
      : (previewPathPrefix(window.location.hostname, window.location.pathname) ?? "");
  return `${prefix}/auth/popup?providerId=${encodeURIComponent(providerId)}`;
}

/**
 * Start sign-in with one upstream provider (`providerId` from `GROK_PROVIDERS`),
 * federating through the Grok auth broker.
 *
 * - **Live preview** (`*.grok-sandbox.com` iframe): opens a POPUP to
 *   `/auth/popup`, served by the template Vite plugin (see `vite.config.ts` +
 *   `popup.server.ts`) — 302s to the broker/upstream login (no app chrome) and,
 *   on return, posts the session bearer token back. We store it and refresh the
 *   session; no top-level navigation of the iframe to the broker.
 * - **Deployed** (and local non-iframe): a normal full-page redirect into the broker.
 *
 * Either way it clears any existing local session FIRST so switching providers
 * actually switches identity.
 */
export async function signIn(
  providerId: string,
  opts: { callbackURL?: string; errorCallbackURL?: string; report?: (event: SignInEvent) => void } = {},
): Promise<void> {
  const callbackURL = opts.callbackURL ?? "/";
  const errorCallbackURL = opts.errorCallbackURL ?? "/";
  const report = opts.report ?? (() => {});

  // Open the tab SYNCHRONOUSLY on the user gesture — before any await.
  // A small popup is easy to miss behind the preview; a tab is visible.
  // Google refuses to render inside the preview frame, so a same-frame
  // redirect looks like the button did nothing.
  const popupMode = needsPopupSignIn();
  report({ code: popupMode ? "opening" : "redirecting" });
  const popup = popupMode ? openSignInPopup(providerId) : null;
  if (popupMode && !popup) {
    report({ code: "blocked" });
    throw new Error("Pop-up blocked — allow pop-ups for sign-in");
  }
  try {
    popup?.focus();
  } catch {
    /* some browsers throw if the tab is cross-origin already */
  }
  const tokenPromise = popup ? waitForPopupToken(popup) : null;
  tokenPromise?.catch(() => undefined);
  if (popup) report({ code: "waiting" });

  await runPreSignInSignOut({
    livePreview: inLivePreview(),
    hasBearer: Boolean(getBearerToken()),
    requestSignOut: () => authClient.signOut(),
    clearToken: () => setBearerToken(null),
  });

  if (tokenPromise) {
    try {
      const token = await tokenPromise;
      await adoptSession(token, callbackURL);
      report({ code: "done" });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Sign-in was cancelled or failed";
      report({ code: detail.includes("cancelled") ? "cancelled" : "failed", detail });
      throw err;
    }
    return;
  }

  const { data, error } = await authClient.signIn.oauth2({
    providerId,
    callbackURL,
    errorCallbackURL,
  });
  if (error) {
    report({ code: "failed", detail: error.message ?? "Sign-in failed" });
    throw new Error(error.message ?? "Sign-in failed");
  }
  if (!data?.url) {
    report({ code: "failed", detail: "The sign-in site did not return a link." });
    throw new Error("The sign-in site did not return a link.");
  }
  const stay = window.location.href;
  window.location.assign(data.url);
  window.setTimeout(() => {
    if (window.location.href === stay) report({ code: "stuck" });
  }, 1500);
}

async function adoptSession(token: string, callbackURL: string) {
  setBearerToken(token);
  try {
    await authClient.getSession();
  } catch {
    /* session store will recover on next useSession fetch */
  }
  if (typeof window === "undefined") return;
  const dest = new URL(callbackURL, window.location.origin);
  const here = window.location;
  if (dest.origin !== here.origin || dest.pathname !== here.pathname || dest.search !== here.search) {
    window.location.href = callbackURL;
  }
}

/**
 * Finish a sign-in that the visitor opened with a real link (no window handle).
 * Used when the first tab was blocked and they click "open in a new tab".
 */
export function watchPopupSignIn(callbackURL = "/"): Promise<void> {
  return waitForPopupMessage().then((token) => adoptSession(token, callbackURL));
}

/**
 * Open `/auth/popup` in a new window. Must run synchronously inside the click
 * handler (no await before this). The path is served by the template Vite
 * plugin (`authPopupPlugin` in vite.config.ts) — NOT by a React route.
 *
 * Opens the real URL directly (not about:blank → assign). From a cross-origin
 * iframe the about:blank dance often fails on the first click and the window
 * ends up showing the app shell.
 */
function openSignInPopup(providerId: string): Window | null {
  const url = authPopupUrl(providerId);
  // A named tab, not a tiny popup. No `noopener`, or the tab cannot post the
  // session back. Unique name so a stuck previous tab is not reused.
  return window.open(url, `grok-signin-${Date.now()}`);
}

function waitForPopupMessage(): Promise<string> {
  return new Promise((resolve, reject) => {
    const origin = window.location.origin;
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Sign-in was cancelled or failed"));
    }, 180_000);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as PopupMessage | undefined;
      if (!data || data.source !== "grok-auth-popup") return;
      cleanup();
      if (data.token) resolve(data.token);
      else reject(new Error(data.error || "Sign-in was cancelled or failed"));
    };
    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    }
    window.addEventListener("message", onMessage);
  });
}

/**
 * Wait for the popup's completion page to postMessage the session bearer (or
 * for the user to dismiss the popup).
 */
function waitForPopupToken(popup: Window): Promise<string> {
  return new Promise((resolve, reject) => {
    const origin = window.location.origin;
    let settled = false;
    let closeTimer: number | undefined;
    const finish = (token: string | null, error?: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (token) resolve(token);
      else reject(new Error(error || "Sign-in was cancelled or failed"));
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as PopupMessage | undefined;
      if (!data || data.source !== "grok-auth-popup") return;
      finish(data.token, data.error);
    };
    // Fallback when the user dismisses the popup. Grace period lets the
    // completion page's postMessage win over a racing `popup.closed`.
    // Cross-origin COOP can throw on `popup.closed`; keep waiting for the message.
    const pollTimer = window.setInterval(() => {
      let closed = false;
      try {
        closed = popup.closed;
      } catch {
        return;
      }
      if (!closed) return;
      window.clearInterval(pollTimer);
      closeTimer = window.setTimeout(() => finish(null, "Sign-in was cancelled or failed"), 400);
    }, 300);
    function cleanup() {
      window.clearInterval(pollTimer);
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      window.removeEventListener("message", onMessage);
    }
    window.addEventListener("message", onMessage);
  });
}

/**
 * Sign out of THIS app's local session, clear the preview token, then redirect.
 *
 * Use this, never `authClient.signOut()` — see the note on `authClient`.
 * Sequencing lives in `scripts/sign-out-plan.mjs` so it can be unit-tested.
 *
 * **Rejects when deployed if the server never confirms.** There the session is
 * an HttpOnly cookie only the server can clear, so redirecting anyway would
 * report a sign-out that did not happen. `<UserButton />` handles that for you;
 * a hand-rolled control must catch it and let the visitor retry. In the live
 * preview the local clear is sufficient, so it always resolves.
 */
export async function signOut(redirectTo = "/"): Promise<void> {
  await runSignOut({
    livePreview: inLivePreview(),
    hasBearer: Boolean(getBearerToken()),
    // Better Auth resolves with `{ error }` instead of rejecting, so surface a
    // failed response as a rejection for the sequence to act on.
    requestSignOut: async () => {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message ?? "Sign-out failed");
    },
    clearToken: () => setBearerToken(null),
    redirect: () => {
      window.location.href = redirectTo;
    },
  });
}
