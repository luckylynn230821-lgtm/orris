const LEGACY: Record<string, { key: string; vars?: Record<string, string> }> = {
  "订单已提交，状态为待付款。库存已保留，尚未记为已付款。": { key: "event.placed" },
  "客户确认演示付款。没有扣卡。订单进入待发货，等待商家处理。": { key: "event.paid" },
  "客户确认收货。状态变为待评价。": { key: "event.received" },
  "未付款订单已取消，保留的库存已退回。": { key: "event.cancelledUnpaid" },
  "商家未同意该售后申请。": { key: "event.rejected" },
  "This piece is no longer for sale.": { key: "bag.unavailable" },
};

const PATTERNS: Array<{
  re: RegExp;
  key: string;
  vars: (match: RegExpMatchArray) => Record<string, string>;
}> = [
  { re: /^客户已评价，(\d+) 分。$/, key: "event.reviewed", vars: (m) => ({ rating: m[1] ?? "" }) },
  { re: /^客户申请退款\/售后：([\s\S]+)$/, key: "event.service", vars: (m) => ({ reason: m[1] ?? "" }) },
  {
    re: /^发货成功。承运：(.+)。运单：(.+)。/,
    key: "event.shipped",
    vars: (m) => ({ carrier: m[1] ?? "", tracking: m[2] ?? "" }),
  },
  { re: /^商家已退款 ([\d.]+)。/, key: "event.refunded", vars: (m) => ({ amount: m[1] ?? "" }) },
  { re: /^Only (\d+) left\.$/, key: "bag.onlyLeft", vars: (m) => ({ count: m[1] ?? "" }) },
];

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Turn a stored message key, a legacy Chinese sentence, or a plain string into the active language. */
export function localize(message: string, t: T): string {
  const exact = LEGACY[message];
  if (exact) return t(exact.key, exact.vars);
  for (const pattern of PATTERNS) {
    const match = pattern.re.exec(message);
    if (match) return t(pattern.key, pattern.vars(match));
  }
  const split = message.indexOf("\n");
  const key = (split === -1 ? message : message.slice(0, split)).trim();
  if (!/^[a-z0-9]+(?:\.[A-Za-z0-9_]+)+$/.test(key)) return message;
  let vars: Record<string, string | number> | undefined;
  if (split !== -1) {
    try {
      const parsed = JSON.parse(message.slice(split + 1)) as Record<string, string | number>;
      if (parsed && typeof parsed === "object") vars = parsed;
    } catch {
      vars = undefined;
    }
  }
  return t(key, vars);
}
