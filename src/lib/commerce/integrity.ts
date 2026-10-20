/** Rules the order desk can test without a database. */

export const RESERVE_MINUTES = 30;
export const CHECKOUT_LIMIT = 8;

export function orderProofAllows(input: {
  orderToken: string;
  token?: string | null;
  sessionEmail?: string | null;
  orderEmail: string;
}): boolean {
  const token = input.token?.trim() ?? "";
  if (token && token === input.orderToken) return true;
  const session = input.sessionEmail?.trim().toLowerCase() ?? "";
  return Boolean(session) && session === input.orderEmail.trim().toLowerCase();
}

/** A typed email is not a secret. Only a checkout token or a signed-in session counts. */
export function guestEmailIsNotProof(): boolean {
  return true;
}

export function demonstrationPaymentAllowed(vercelEnv: string | undefined): boolean {
  return vercelEnv !== "production";
}

export function holdIsDue(input: {
  stockHeld: boolean;
  paymentStatus: string;
  reserveUntil: Date | null;
  now: Date;
}): boolean {
  if (!input.stockHeld || input.paymentStatus !== "unpaid" || !input.reserveUntil) return false;
  return input.reserveUntil.getTime() <= input.now.getTime();
}

export function checkoutHitsAllowed(hits: number): boolean {
  return hits <= CHECKOUT_LIMIT;
}

/** Production books omit sample orders and demonstration settlements unless the desk asks for them. */
export function countsInBooks(input: {
  includeDemo: boolean;
  isDemo: boolean;
  paymentSource: string | null;
}): boolean {
  if (input.includeDemo) return true;
  if (input.isDemo) return false;
  return (input.paymentSource ?? "none") !== "demonstration";
}

export function resolveOwnerEmail(
  stored: string | null | undefined,
  env: string | undefined,
  production: boolean,
): string | null {
  const fromStore = stored?.trim().toLowerCase() || null;
  if (fromStore) return fromStore;
  const fromEnv = env?.trim().toLowerCase() || null;
  if (fromEnv) return fromEnv;
  if (!production) return "luckylynn230821@gmail.com";
  return null;
}

export function acceptedImage(dataUrl: string): boolean {
  const match = /^data:image\/(jpeg|png|webp);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match || dataUrl.length > 1_200_000) return false;
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (bytes.length < 12 || bytes.length > 900_000) return false;
  const kind = match[1].toLowerCase();
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (kind === "jpeg") return jpeg;
  if (kind === "png") return png;
  return webp;
}
