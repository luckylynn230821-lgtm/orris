# ORRIS

A single-house commerce template: a customer shop and a merchant desk, backed by the same Postgres database.

The shop sells a short catalogue. The desk records products, stock, orders, cost and profit. Sample history is included so the books are not empty, and it is labeled. New checkouts are live rows. Checkout on this template is a **demonstration rail**: the server rechecks price and stock, writes the order, payment and inventory movement, and does not charge a card.

## Two surfaces

- Shop: `/`, `/shop`, `/product/:slug`, `/cart`, `/checkout`, `/orders`
- Merchant desk: `/admin` — the first signed-in account becomes the administrator

Sign in with email or Google / X. Guests can browse and check out. Cost, margin and other customers are not on public responses.

## Books

Amounts are integer cents.

- **Gross sales** — unit price × quantity on paid orders, before discounts and refunds. Shipping and tax are excluded.
- **Net sales** — gross minus discounts and refunds.
- **Gross profit** — net sales minus the cost snapshot of units the customer kept. This is not net profit.
- **Average order value** — paid total after refunds, including shipping and tax, divided by paid orders.

Product intelligence is a set of rules with the thresholds in Settings. It never changes a price or a purchase order by itself.

## Stack

React, TanStack Start, TypeScript, Tailwind, Postgres (Neon when deployed, embedded Postgres in preview), Better Auth. Schema lives in `migrations/`.

## Not in this version

Stripe live charges, multi-store tenancy, a drag-and-drop page builder, and staff roles beyond the single administrator. The payment row is shaped so a processor can replace the demonstration rail later.
