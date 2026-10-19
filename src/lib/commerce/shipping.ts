/**
 * Live carrier tracking. Nothing is connected yet.
 * A later adapter replaces `trackLive` and can call a carrier API
 * without changing the desk, the order, or the stored tracking link.
 */
export type LiveTracking = {
  connected: false;
  reason: "not_connected";
};

export async function trackLive(_input: { carrierId: string; tracking: string }): Promise<LiveTracking> {
  return { connected: false, reason: "not_connected" };
}

export function trackingLink(template: string, tracking: string) {
  const value = tracking.trim();
  if (!template.trim() || !value) return "";
  return template.includes("{{tracking}}")
    ? template.replaceAll("{{tracking}}", encodeURIComponent(value))
    : template;
}

/**
 * Email delivery. No provider is configured, so a message is recorded
 * and shown on the order. It is not reported as sent.
 */
export type MailResult = { delivered: false; reason: "mailer_not_connected" };

export function deliverMail(): MailResult {
  return { delivered: false, reason: "mailer_not_connected" };
}
