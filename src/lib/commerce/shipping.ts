/**
 * Public tracking pages.
 *
 * The shape follows the MIT library wankdanker/node-tracking-url: a tracking
 * number becomes a carrier name and a public web URL. That library does not
 * call a carrier API. Karrio (LGPL, Python) and the 17TRACK API connectors
 * need a hosted service or an API key, which this shop does not have, so
 * trackLive only opens the public page and never invents scan history.
 *
 * Plain 12, 15 and 20 digit numbers match both FedEx and many Chinese
 * waybills in that library. Those stay on the 17TRACK public page, which
 * can tell the carriers apart. A carrier chosen in the desk still uses
 * that carrier's own template.
 */
export type PublicCarrier = { name: string; trackingUrl: string };

export const PUBLIC_CARRIERS: PublicCarrier[] = [
  { name: "17TRACK", trackingUrl: "https://t.17track.net/zh-cn#nums={{tracking}}" },
  { name: "UPS", trackingUrl: "https://www.ups.com/track?tracknum={{tracking}}" },
  { name: "FedEx", trackingUrl: "https://www.fedex.com/fedextrack/?trknbr={{tracking}}" },
  { name: "DHL", trackingUrl: "https://www.dhl.com/global-en/home/tracking.html?tracking-id={{tracking}}" },
  { name: "USPS", trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels={{tracking}}" },
  { name: "顺丰", trackingUrl: "https://t.17track.net/zh-cn#nums={{tracking}}" },
  { name: "中通", trackingUrl: "https://t.17track.net/zh-cn#nums={{tracking}}" },
  { name: "圆通", trackingUrl: "https://t.17track.net/zh-cn#nums={{tracking}}" },
  { name: "韵达", trackingUrl: "https://t.17track.net/zh-cn#nums={{tracking}}" },
  { name: "京东物流", trackingUrl: "https://t.17track.net/zh-cn#nums={{tracking}}" },
  { name: "邮政 EMS", trackingUrl: "https://t.17track.net/zh-cn#nums={{tracking}}" },
];

export type LiveTracking =
  | { connected: true; source: "public"; carrier: string; url: string; scans: false }
  | { connected: false; reason: "missing_number" };

export function trackingLink(template: string, tracking: string) {
  const value = tracking.trim();
  if (!template.trim() || !value) return "";
  return template.includes("{{tracking}}")
    ? template.replaceAll("{{tracking}}", encodeURIComponent(value))
    : template;
}

function carrierUrl(name: string) {
  return PUBLIC_CARRIERS.find((row) => row.name === name)?.trackingUrl ?? PUBLIC_CARRIERS[0].trackingUrl;
}

function named(name: string, tracking: string) {
  return { carrier: name, url: trackingLink(carrierUrl(name), tracking) };
}

export function detectCarrier(tracking: string): { carrier: string; url: string } {
  const value = tracking.trim().replace(/\s+/g, "");
  if (/^1Z[0-9A-Z]{16}$/i.test(value)) return named("UPS", value);
  if (/^[A-Z]{2}\d{9}US$/i.test(value) || /^(94|93|92|91)\d{18,22}$/.test(value)) return named("USPS", value);
  if (/^SF\d{10,15}$/i.test(value)) return named("顺丰", value);
  if (/^JD[A-Z0-9]{8,20}$/i.test(value)) return named("京东物流", value);
  if (/^YT\d{10,18}$/i.test(value)) return named("圆通", value);
  if (/^(ZT|ZTO)\d{10,18}$/i.test(value)) return named("中通", value);
  if (/^YD\d{10,18}$/i.test(value)) return named("韵达", value);
  if (/^[A-Z]{2}\d{9}CN$/i.test(value)) return named("邮政 EMS", value);
  if (/^\d{10,11}$/.test(value)) return named("DHL", value);
  return named("17TRACK", value);
}

export function trackLive(input: { tracking: string; template?: string; carrierName?: string }): LiveTracking {
  const tracking = input.tracking.trim();
  if (!tracking) return { connected: false, reason: "missing_number" };
  const detected = detectCarrier(tracking);
  const url = input.template?.includes("{{tracking}}")
    ? trackingLink(input.template, tracking)
    : detected.url;
  return {
    connected: true,
    source: "public",
    carrier: input.carrierName || detected.carrier,
    url,
    scans: false,
  };
}

export function publicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export type MailResult = { delivered: false; reason: "mailer_not_connected" };

export function deliverMail(): MailResult {
  return { delivered: false, reason: "mailer_not_connected" };
}
