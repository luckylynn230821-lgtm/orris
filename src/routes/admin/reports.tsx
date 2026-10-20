import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { RangeBar, useAnalytics } from "@/components/admin/analytics-view";
import { adminSettings } from "@/lib/commerce/fns";
import { LEDGER_CLASS, LEDGER_CODES, toCsv, type LedgerCode, type RangeKey } from "@/lib/commerce/metrics";
import { growthLabel, money, pct } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translate";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports — Merchant desk" }] }),
});

const BOOKS = ["accounts", "journal", "trial", "balance", "pnl", "sales", "products", "profit", "tax", "cash", "stock"] as const;
type Book = (typeof BOOKS)[number];

function ReportsPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [includeDemo, setIncludeDemo] = useState(false);
  const [book, setBook] = useState<Book>("pnl");
  const { data, error, loading } = useAnalytics(range, includeDemo);
  const { t } = useT();
  const [rates, setRates] = useState<{ vat: number; importTax: number }>({ vat: 0, importTax: 0 });
  useEffect(() => {
    void adminSettings()
      .then((settings) => setRates({ vat: settings.vatRate ?? 0, importTax: settings.importTaxRate ?? 0 }))
      .catch(() => setRates({ vat: 0, importTax: 0 }));
  }, []);

  const download = () => {
    if (!data) return;
    const vat = Math.round(data.kpis.netCents * rates.vat);
    const imported = Math.round(data.kpis.netCents * rates.importTax);
    const posted = data.ledger.lines.map((line) => [
      line.code,
      t(`books.acct${line.code}` as MessageKey),
      line.debitCents ? money(line.debitCents) : "",
      line.creditCents ? money(line.creditCents) : "",
    ]);
    const books = closeBooks(data.ledger);
    const files: Record<Book, { name: string; csv: string }> = {
      accounts: {
        name: "chart-of-accounts.csv",
        csv: toCsv([t("books.code"), t("books.kind"), t("books.debit"), t("books.credit")], posted),
      },
      journal: {
        name: "journal.csv",
        csv: toCsv([t("books.code"), t("books.accounts"), t("books.debit"), t("books.credit")], posted),
      },
      trial: {
        name: "trial-balance.csv",
        csv: toCsv([t("books.code"), t("books.accounts"), t("books.debit"), t("books.credit")], posted),
      },
      balance: {
        name: "balance-sheet.csv",
        csv: toCsv(
          [t("books.balance"), t("desk.net")],
          [
            [t("books.acct1000"), money(books.cash)],
            [t("books.inventoryRelief"), money(books.relieved)],
            [t("books.assets"), money(books.assets)],
            [t("books.acct2100"), money(books.tax)],
            [t("books.acct2110"), money(books.freight)],
            [t("books.liabilities"), money(books.liabilities)],
            [t("books.earnings"), money(books.equity)],
          ],
        ),
      },
      pnl: {
        name: "profit-and-loss.csv",
        csv: toCsv(
          [t("books.pnl"), t("desk.net")],
          [
            [t("books.gross"), money(data.kpis.grossCents)],
            [t("books.discounts"), money(data.kpis.discountCents)],
            [t("books.refunds"), money(data.kpis.refundCents)],
            [t("books.net"), money(data.kpis.netCents)],
            [t("books.cogs"), money(data.kpis.cogsCents)],
            [t("books.grossProfit"), money(data.kpis.profitCents)],
            [t("books.margin"), pct(data.kpis.margin)],
            [t("books.shipping"), money(data.kpis.shippingCents)],
            [t("books.logistics"), money(data.logisticsCostCents)],
            [t("desk.taxCollected"), money(data.kpis.taxCents)],
          ],
        ),
      },
      sales: {
        name: "sales-summary.csv",
        csv: toCsv(
          [t("books.day"), t("books.net"), t("books.orders"), t("books.grossProfit"), t("desk.units")],
          data.series.map((row) => [row.date, money(row.netCents), row.orders, money(row.profitCents), row.units]),
        ),
      },
      products: {
        name: "product-sales.csv",
        csv: toCsv(
          [t("desk.product"), t("desk.sku"), t("books.category"), t("desk.units"), t("desk.net"), t("desk.profit"), t("desk.margin"), t("desk.stock")],
          data.products.map((row) => [row.name, row.sku, row.categoryName, row.units, money(row.netCents), money(row.profitCents), pct(row.margin), row.inventory]),
        ),
      },
      profit: {
        name: "profit.csv",
        csv: toCsv(
          [t("desk.product"), t("books.net"), t("books.cogs"), t("books.grossProfit"), t("books.margin"), t("books.share")],
          data.products.map((row) => [
            row.name,
            money(row.netCents),
            money(row.netCents - row.profitCents),
            money(row.profitCents),
            pct(row.margin),
            data.kpis.profitCents > 0 ? pct(row.profitCents / data.kpis.profitCents) : "",
          ]),
        ),
      },
      tax: {
        name: "tax.csv",
        csv: toCsv(
          [t("desk.taxCollected"), t("books.vat"), t("books.importTax")],
          [[money(data.kpis.taxCents), money(vat), money(imported)]],
        ),
      },
      cash: {
        name: "cash-collected.csv",
        csv: toCsv(
          [t("books.cashIn"), t("books.refunds"), t("books.shipping"), t("desk.taxCollected")],
          [[money(data.kpis.paidTotalCents), money(data.kpis.refundCents), money(data.kpis.shippingCents), money(data.kpis.taxCents)]],
        ),
      },
      stock: {
        name: "inventory.csv",
        csv: toCsv(
          [t("desk.product"), t("desk.sku"), t("books.onHand"), t("desk.cost"), t("books.stockValue")],
          data.products.map((row) => [row.name, row.sku, row.inventory, money(row.costCents), money(row.inventory * row.costCents)]),
        ),
      },
    };
    const file = files[book];
    const blob = new Blob([file.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">{t("admin.reportsTitle")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ash">{t("books.intro")}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ash">{t("books.doubleEntry")}</p>
        </div>
        {data ? (
          <button className="h-11 border border-line bg-paper px-4 text-sm" onClick={download}>
            {t("books.download")}
          </button>
        ) : null}
      </div>
      <div className="mt-6"><RangeBar range={range} setRange={setRange} includeDemo={includeDemo} setIncludeDemo={setIncludeDemo} /></div>
      <div className="mt-4 flex gap-2 overflow-auto pb-1">
        {BOOKS.map((id) => (
          <button
            key={id}
            onClick={() => setBook(id)}
            className={cn(
              "h-11 shrink-0 px-4 text-sm",
              book === id ? "bg-ink text-ivory" : "border border-line bg-paper",
            )}
          >
            {t(`books.${id}` as MessageKey)}
          </button>
        ))}
      </div>
      {loading && !data ? (
        <div className="flex flex-col items-center py-24">
          <div className="relative size-12">
            <span className="absolute inset-0 rounded-full border border-line" />
            <span className="desk-spin absolute inset-0 rounded-full border-2 border-transparent border-t-ink" />
          </div>
          <p className="mt-4 text-sm tracking-[0.18em]">{t("desk.pleaseWait")}</p>
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {data ? <BookView book={book} data={data} rates={rates} /> : null}
    </div>
  );
}

function BookView({
  book,
  data,
  rates,
}: {
  book: Book;
  data: NonNullable<ReturnType<typeof useAnalytics>["data"]>;
  rates: { vat: number; importTax: number };
}) {
  const { t } = useT();
  const k = data.kpis;
  const books = closeBooks(data.ledger);
  if (book === "accounts" || book === "journal" || book === "trial") {
    const rows = LEDGER_CODES.map((code) => data.ledger.lines.find((line) => line.code === code) ?? { code, debitCents: 0, creditCents: 0 });
    const visible = book === "accounts" ? rows : rows.filter((line) => line.debitCents !== 0 || line.creditCents !== 0);
    return (
      <section className="mt-6">
        <h2 className="text-2xl">{t(`books.${book}` as MessageKey)}</h2>
        <p className="mt-2 text-sm text-ash">{t("books.cashBasis")} {t("books.balanced")}</p>
        <div className="mt-4 overflow-auto bg-paper">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-ash uppercase">
              <tr>
                <th className="p-3">{t("books.code")}</th>
                <th className="p-3">{t("books.accounts")}</th>
                {book === "accounts" ? <th className="p-3">{t("books.kind")}</th> : null}
                <th className="p-3">{t("books.debit")}</th>
                <th className="p-3">{t("books.credit")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((line) => (
                <tr key={line.code} className="border-t border-line">
                  <td className="p-3 tabular-nums">{line.code}</td>
                  <td className="p-3">{t(`books.acct${line.code}` as MessageKey)}</td>
                  {book === "accounts" ? <td className="p-3">{t(`books.${LEDGER_CLASS[line.code as LedgerCode]}` as MessageKey)}</td> : null}
                  <td className="p-3 tabular-nums">{line.debitCents ? money(line.debitCents) : "—"}</td>
                  <td className="p-3 tabular-nums">{line.creditCents ? money(line.creditCents) : "—"}</td>
                </tr>
              ))}
              {book !== "accounts" ? (
                <tr className="border-t border-line">
                  <td className="p-3" colSpan={2}>{t("books.total")}</td>
                  <td className="p-3 tabular-nums">{money(data.ledger.debitCents)}</td>
                  <td className="p-3 tabular-nums">{money(data.ledger.creditCents)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
  if (book === "balance") {
    return (
      <section className="mt-6 max-w-xl bg-paper p-5">
        <h2 className="text-2xl">{t("books.balance")}</h2>
        <p className="mt-2 text-sm text-ash">{t("books.cashBasis")}</p>
        <p className="mt-6 text-xs tracking-[0.14em] text-ash uppercase">{t("books.assets")}</p>
        <Row label={t("books.acct1000")} value={money(books.cash)} />
        <Row label={t("books.inventoryRelief")} value={money(books.relieved)} dim />
        {books.suspense > 0 ? <Row label={t("books.acct9990")} value={money(books.suspense)} /> : null}
        <Row label={t("books.total")} value={money(books.assets)} strong />
        <p className="mt-6 text-xs tracking-[0.14em] text-ash uppercase">{t("books.liabilities")}</p>
        <Row label={t("books.acct2100")} value={money(books.tax)} />
        <Row label={t("books.acct2110")} value={money(books.freight)} />
        {books.suspense < 0 ? <Row label={t("books.acct9990")} value={money(-books.suspense)} /> : null}
        <Row label={t("books.total")} value={money(books.liabilities)} strong />
        <p className="mt-6 text-xs tracking-[0.14em] text-ash uppercase">{t("books.equity")}</p>
        <Row label={t("books.acct3200")} value={money(books.equity)} strong />
        <Row label={t("books.liabilities") + " + " + t("books.equity")} value={money(books.liabilities + books.equity)} />
      </section>
    );
  }
  const vat = Math.round(k.netCents * rates.vat);
  const imported = Math.round(k.netCents * rates.importTax);
  const stockUnits = data.products.reduce((sum, row) => sum + row.inventory, 0);
  const stockValue = data.products.reduce((sum, row) => sum + row.inventory * row.costCents, 0);
  const categories = [...data.products.reduce((map, row) => {
    const key = row.categoryName || "—";
    const current = map.get(key) ?? { name: key, units: 0, netCents: 0, profitCents: 0 };
    current.units += row.units;
    current.netCents += row.netCents;
    current.profitCents += row.profitCents;
    map.set(key, current);
    return map;
  }, new Map<string, { name: string; units: number; netCents: number; profitCents: number }>()).values()].sort((a, b) => b.netCents - a.netCents);

  if (book === "pnl") {
    return (
      <section className="mt-6 max-w-xl bg-paper p-5">
        <h2 className="text-2xl">{t("books.pnl")}</h2>
        <div className="mt-4">
          <Row label={t("books.gross")} value={money(k.grossCents)} />
          <Row label={t("books.discounts")} value={money(k.discountCents)} dim />
          <Row label={t("books.refunds")} value={money(k.refundCents)} dim />
          <Row label={t("books.net")} value={money(k.netCents)} strong />
          <Row label={t("books.cogs")} value={money(k.cogsCents)} dim />
          <Row label={t("books.grossProfit")} value={money(k.profitCents)} strong />
          <Row label={t("books.margin")} value={pct(k.margin)} />
        </div>
        <p className="mt-6 text-xs tracking-[0.14em] text-ash uppercase">{t("books.below")}</p>
        <Row label={t("books.shipping")} value={money(k.shippingCents)} />
        <Row label={t("books.logistics")} value={money(data.logisticsCostCents)} />
        <Row label={t("desk.taxCollected")} value={money(k.taxCents)} />
      </section>
    );
  }

  if (book === "sales") {
    return (
      <section className="mt-6">
        <h2 className="text-2xl">{t("books.sales")}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t("books.orders")} value={String(k.orders)} />
          <Stat label={t("books.units")} value={String(k.units)} />
          <Stat label={t("books.aov")} value={k.aovCents === null ? "—" : money(k.aovCents)} />
          <Stat label={t("books.growth")} value={growthLabel(k.growthNet)} />
        </div>
        <div className="mt-4 bg-paper p-4">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-ash)" />
                <Tooltip formatter={(value) => money(Number(value ?? 0))} />
                <Area dataKey="netCents" name={t("books.net")} stroke="var(--color-ink)" fill="var(--color-brass)" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <p className="mt-3 text-sm text-ash">{t("books.previous")} {money(k.previousNetCents)}</p>
      </section>
    );
  }

  if (book === "products") {
    return (
      <section className="mt-6">
        <h2 className="text-2xl">{t("books.products")}</h2>
        <div className="mt-4 overflow-auto bg-paper">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-ash uppercase">
              <tr>
                <th className="p-3">{t("desk.product")}</th>
                <th className="p-3">{t("books.category")}</th>
                <th className="p-3">{t("desk.units")}</th>
                <th className="p-3">{t("desk.net")}</th>
                <th className="p-3">{t("desk.profit")}</th>
                <th className="p-3">{t("desk.margin")}</th>
                <th className="p-3">{t("desk.stock")}</th>
              </tr>
            </thead>
            <tbody>
              {data.products.filter((row) => row.units !== 0 || row.netCents !== 0).map((row) => (
                <tr key={row.productId} className="border-t border-line">
                  <td className="p-3">{row.name}<br /><span className="text-ash">{row.sku}</span></td>
                  <td className="p-3">{row.categoryName || "—"}</td>
                  <td className="p-3 tabular-nums">{row.units}</td>
                  <td className="p-3 tabular-nums">{money(row.netCents)}</td>
                  <td className="p-3 tabular-nums">{money(row.profitCents)}</td>
                  <td className="p-3 tabular-nums">{pct(row.margin)}</td>
                  <td className="p-3 tabular-nums">{row.inventory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {categories.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.filter((row) => row.netCents !== 0 || row.units !== 0).map((row) => (
              <article key={row.name} className="bg-paper p-4">
                <p className="text-xs text-ash uppercase">{row.name}</p>
                <p className="mt-2 text-xl tabular-nums">{money(row.netCents)}</p>
                <p className="mt-1 text-sm text-ash">{row.units} · {money(row.profitCents)}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  if (book === "profit") {
    const ranked = [...data.products].sort((a, b) => b.profitCents - a.profitCents);
    return (
      <section className="mt-6">
        <h2 className="text-2xl">{t("books.profit")}</h2>
        <div className="mt-4 max-w-xl bg-paper p-5">
          <Row label={t("books.net")} value={money(k.netCents)} />
          <Row label={t("books.cogs")} value={money(k.cogsCents)} dim />
          <Row label={t("books.grossProfit")} value={money(k.profitCents)} strong />
          <Row label={t("books.margin")} value={pct(k.margin)} />
        </div>
        <h3 className="mt-8 text-xl">{t("books.contribution")}</h3>
        <div className="mt-3 overflow-auto bg-paper">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-ash uppercase">
              <tr>
                <th className="p-3">{t("desk.product")}</th>
                <th className="p-3">{t("books.net")}</th>
                <th className="p-3">{t("books.grossProfit")}</th>
                <th className="p-3">{t("books.margin")}</th>
                <th className="p-3">{t("books.share")}</th>
              </tr>
            </thead>
            <tbody>
              {ranked.filter((row) => row.netCents !== 0 || row.profitCents !== 0).map((row) => (
                <tr key={row.productId} className="border-t border-line">
                  <td className="p-3">{row.name}</td>
                  <td className="p-3 tabular-nums">{money(row.netCents)}</td>
                  <td className="p-3 tabular-nums">{money(row.profitCents)}</td>
                  <td className="p-3 tabular-nums">{pct(row.margin)}</td>
                  <td className="p-3 tabular-nums">{k.profitCents > 0 ? pct(row.profitCents / k.profitCents) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (book === "tax") {
    return (
      <section className="mt-6 max-w-3xl">
        <h2 className="text-2xl">{t("books.tax")}</h2>
        <p className="mt-2 text-sm leading-6 text-ash">{t("desk.taxNote")}</p>
        <p className="mt-2 text-xs text-ash">{t("books.rateUsed")} · VAT {(rates.vat * 100).toFixed(2)}% · {t("books.importTax")} {(rates.importTax * 100).toFixed(2)}%</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label={t("desk.taxCollected")} value={money(k.taxCents)} />
          <Stat label={t("books.vat")} value={money(vat)} />
          <Stat label={t("books.importTax")} value={money(imported)} />
        </div>
      </section>
    );
  }

  if (book === "cash") {
    return (
      <section className="mt-6 max-w-xl bg-paper p-5">
        <h2 className="text-2xl">{t("books.cash")}</h2>
        <p className="mt-2 text-sm leading-6 text-ash">{t("books.cashNote")}</p>
        <div className="mt-4">
          <Row label={t("books.cashIn")} value={money(k.paidTotalCents)} strong />
          <Row label={t("books.refunds")} value={money(k.refundCents)} dim />
          <Row label={t("books.shipping")} value={money(k.shippingCents)} />
          <Row label={t("desk.taxCollected")} value={money(k.taxCents)} />
          <Row label={t("books.logistics")} value={money(data.logisticsCostCents)} />
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <h2 className="text-2xl">{t("books.stock")}</h2>
      <p className="mt-2 text-sm leading-6 text-ash">{t("books.stockNote")}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label={t("books.onHand")} value={String(stockUnits)} />
        <Stat label={t("books.stockValue")} value={money(stockValue)} />
      </div>
      {data.products.length === 0 ? <p className="mt-4 text-sm text-ash">{t("books.empty")}</p> : null}
    </section>
  );
}

function closeBooks(ledger: { lines: { code: string; debitCents: number; creditCents: number }[] }) {
  const side = (code: string, column: "debitCents" | "creditCents") =>
    ledger.lines.find((line) => line.code === code)?.[column] ?? 0;
  const cash = side("1000", "debitCents") - side("1000", "creditCents");
  const relieved = side("1400", "creditCents") - side("1400", "debitCents");
  const tax = side("2100", "creditCents") - side("2100", "debitCents");
  const freight = side("2110", "creditCents") - side("2110", "debitCents");
  const suspense = side("9990", "debitCents") - side("9990", "creditCents");
  const assets = cash - relieved + Math.max(suspense, 0);
  const liabilities = tax + freight + Math.max(-suspense, 0);
  return { cash, relieved, tax, freight, suspense, assets, liabilities, equity: assets - liabilities };
}

function Row({ label, value, strong, dim }: { label: string; value: string; strong?: boolean; dim?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-6 border-b border-line py-3", strong && "text-base", dim && "text-ash")}>
      <span className="text-sm">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="bg-paper p-4">
      <p className="text-xs tracking-[0.12em] text-ash uppercase">{label}</p>
      <p className="mt-2 text-xl tabular-nums">{value}</p>
    </article>
  );
}
