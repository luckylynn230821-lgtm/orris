/**
 * In-memory point budget, the same idea as
 * github.com/animir/node-rate-limiter-flexible (consume N points per window,
 * then block). That package wants Redis for many servers. This shop runs as
 * one Node process, so the budget lives in memory and resets if the process
 * restarts. It slows a burst from one address. It is not a network firewall.
 */

export type Budget = {
  points: number;
  windowMs: number;
  blockMs: number;
};

type Slot = {
  points: number;
  resetAt: number;
  blockedUntil: number;
};

const slots = new Map<string, Slot>();

export function consume(name: string, key: string, budget: Budget, now = Date.now(), cost = 1) {
  const id = `${name}:${key}`;
  let slot = slots.get(id);
  if (!slot || now >= slot.resetAt) {
    slot = { points: budget.points, resetAt: now + budget.windowMs, blockedUntil: 0 };
  }
  if (slot.blockedUntil > now) {
    slots.set(id, slot);
    return { ok: false as const, retryMs: slot.blockedUntil - now };
  }
  if (slot.points < cost) {
    slot.blockedUntil = now + budget.blockMs;
    slots.set(id, slot);
    return { ok: false as const, retryMs: budget.blockMs };
  }
  slot.points -= cost;
  slots.set(id, slot);
  if (slots.size > 4000) {
    for (const [stored, value] of slots) {
      if (now >= value.resetAt && now >= value.blockedUntil) slots.delete(stored);
      if (slots.size <= 3000) break;
    }
  }
  return { ok: true as const, retryMs: 0 };
}

export const READ_BUDGET: Budget = { points: 180, windowMs: 60_000, blockMs: 20_000 };
export const WRITE_BUDGET: Budget = { points: 40, windowMs: 60_000, blockMs: 60_000 };
export const AUTH_BUDGET: Budget = { points: 12, windowMs: 10 * 60_000, blockMs: 10 * 60_000 };
