import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { Mark } from "@/components/store/mark";
import { quoteCart, getChrome } from "@/lib/commerce/fns";
import { ensureSessionKey, useCart } from "@/lib/cart";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";
import { money } from "@/lib/format";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

type Quote = Awaited<ReturnType<typeof quoteCart>>;

export function StoreShell({ children }: { children: React.ReactNode }) {
  const { t, tx, copy } = useT();
  const lines = useCart((state) => state.lines);
  const open = useCart((state) => state.open);
  const setOpen = useCart((state) => state.setOpen);
  const setQty = useCart((state) => state.setQty);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [chrome, setChrome] = useState<{ announcement: string; brandName: string; footerBlurb: string; supportEmail: string } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const lineKey = lines.map((line) => `${line.variantId}:${line.qty}`).join("|");

  useEffect(() => {
    void useCart.persist.rehydrate();
    ensureSessionKey();
    void getChrome().then(setChrome);
  }, []);

  useEffect(() => {
    let live = true;
    void quoteCart({ data: { lines } }).then((next) => {
      if (live) setQuote(next);
    });
    return () => {
      live = false;
    };
  }, [lineKey, lines]);

  return (
    <div className="min-h-screen bg-ivory text-ink">
      <div className="bg-butter px-4 py-2 text-center text-[12px] text-ink">
        {copy(chrome?.announcement || t("nav.announcement"))}
      </div>
      <header className="sticky top-0 z-30 border-b border-line bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
          <button className="md:hidden" aria-label={t("nav.menu")} onClick={() => setMenu(true)}>
            <Menu className="size-5" />
          </button>
          <Link to="/" aria-label={chrome?.brandName || "MU"}>
            <Mark name={chrome?.brandName || "MU"} />
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-sm md:flex">
            <Link to="/shop" className="hover:text-ash">{t("nav.shop")}</Link>
            <Link to="/shop" search={{ pet: "dog" }} className="hover:text-ash">{t("nav.dogs")}</Link>
            <Link to="/shop" search={{ pet: "cat" }} className="hover:text-ash">{t("nav.cats")}</Link>
            <Link to="/collections" className="hover:text-ash">{t("nav.collections")}</Link>
            <Link to="/about" className="hover:text-ash">{t("nav.house")}</Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitch className="hidden md:inline-flex" />
            <button className="grid size-11 place-items-center" aria-label={t("nav.search")} onClick={() => setSearch(true)}>
              <Search className="size-5" />
            </button>
            {user ? (
              <Link to="/account" className="hidden px-2 text-sm md:inline">{t("nav.account")}</Link>
            ) : (
              <Link to="/login" search={{ next: "account" }} className="hidden px-2 text-sm md:inline">{t("nav.account")}</Link>
            )}
            <Link to="/admin" className="hidden px-2 text-sm md:inline">{t("nav.merchant")}</Link>
            <button className="relative grid size-11 place-items-center" aria-label={t("nav.bag")} onClick={() => setOpen(true)}>
              <ShoppingBag className="size-5" />
              {count > 0 ? (
                <span className="absolute top-2 right-1 min-w-4 bg-ink px-1 text-center text-[10px] text-ivory tabular-nums">{count}</span>
              ) : null}
            </button>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-4 md:px-6">
          <div className="md:col-span-2">
            <Mark name={chrome?.brandName || "MU"} />
            <p className="mt-3 max-w-sm text-sm leading-6 text-ash">
              {copy(chrome?.footerBlurb || t("nav.footer"))}
            </p>
          </div>
          <div className="text-sm leading-8">
            <p className="text-xs tracking-[0.16em] text-ash uppercase">{t("nav.shop")}</p>
            <Link to="/shop" search={{ pet: "dog" }} className="block">{t("nav.dogs")}</Link>
            <Link to="/shop" search={{ pet: "cat" }} className="block">{t("nav.cats")}</Link>
            <Link to="/collections" className="block">{t("nav.collections")}</Link>
            <Link to="/about" className="block">{t("nav.house")}</Link>
          </div>
          <div className="text-sm leading-8">
            <p className="text-xs tracking-[0.16em] text-ash uppercase">{t("account.title")}</p>
            <Link to="/login" search={{ next: "account" }} className="block">{t("login.customerTitle")}</Link>
            <Link to="/orders" className="block">{t("nav.findOrder")}</Link>
            <Link to="/admin" className="block">{t("nav.merchant")}</Link>
            <Link to="/privacy" className="block">{t("nav.privacy")}</Link>
            <Link to="/refunds" className="block">{t("nav.refunds")}</Link>
            <LanguageSwitch />
            <a href={`mailto:${chrome?.supportEmail || "studio@mu.example"}`} className="block">{chrome?.supportEmail || "studio@mu.example"}</a>
          </div>
        </div>
      </footer>

      {menu ? (
        <div className="fixed inset-0 z-40 bg-ivory p-6">
          <button className="grid size-11 place-items-center" aria-label={t("nav.closeMenu")} onClick={() => setMenu(false)}>
            <X />
          </button>
          <LanguageSwitch className="mt-4" />
          <div className="mt-8 flex flex-col gap-5 font-display text-4xl tracking-[-0.04em]">
            <Link to="/shop" onClick={() => setMenu(false)}>{t("nav.shop")}</Link>
            <Link to="/shop" search={{ pet: "dog" }} onClick={() => setMenu(false)}>{t("nav.dogs")}</Link>
            <Link to="/shop" search={{ pet: "cat" }} onClick={() => setMenu(false)}>{t("nav.cats")}</Link>
            <Link to="/collections" onClick={() => setMenu(false)}>{t("nav.collections")}</Link>
            <Link to="/about" onClick={() => setMenu(false)}>{t("nav.house")}</Link>
            {user ? (
              <Link to="/account" onClick={() => setMenu(false)}>{t("nav.account")}</Link>
            ) : (
              <Link to="/login" search={{ next: "account" }} onClick={() => setMenu(false)}>{t("nav.account")}</Link>
            )}
            <Link to="/orders" onClick={() => setMenu(false)}>{t("nav.orders")}</Link>
            <Link to="/admin" onClick={() => setMenu(false)}>{t("nav.merchant")}</Link>
          </div>
        </div>
      ) : null}

      {search ? (
        <div className="fixed inset-0 z-40 grid place-items-start bg-ink/40 p-4 pt-24" onClick={() => setSearch(false)}>
          <form
            className="mx-auto w-full max-w-xl bg-ivory p-4"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(false);
              void navigate({ to: "/shop", search: { q: query } });
            }}
          >
            <label className="text-xs tracking-[0.16em] text-ash uppercase" htmlFor="site-search">{t("nav.searchLabel")}</label>
            <input
              id="site-search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-3 h-12 w-full border-b border-ink bg-transparent text-lg outline-none"
              placeholder={t("nav.searchPlaceholder")}
            />
          </form>
        </div>
      ) : null}

      <div className={cn("fixed inset-0 z-40 bg-ink/30 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={() => setOpen(false)} />
      <aside className={cn("fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col bg-ivory transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")} aria-hidden={!open}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-2xl">{t("bag.title")}</h2>
          <button className="grid size-11 place-items-center" aria-label={t("nav.closeBag")} onClick={() => setOpen(false)}><X /></button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4">
          {(quote?.lines.length ?? 0) === 0 ? (
            <p className="text-sm text-ash">{t("bag.empty")}</p>
          ) : (
            <ul className="space-y-5">
              {quote?.lines.map((line) => (
                <li key={line.variantId} className="flex gap-3">
                  <div className="h-24 w-20 overflow-hidden rounded-2xl bg-butter">
                    {line.image ? <img src={line.image} alt={copy(line.alt)} className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{copy(line.name)}</p>
                    <p className="text-xs text-ash">{copy(line.title)}</p>
                    <p className="mt-1 text-sm tabular-nums">{money(line.priceCents)}</p>
                    {line.warning ? <p className="mt-1 text-xs text-danger">{localize(line.warning, tx)}</p> : null}
                    <div className="mt-2 flex items-center gap-3 text-sm">
                      <button className="grid size-8 place-items-center border border-line" onClick={() => setQty(line.variantId, line.qty - 1)} aria-label={t("bag.decrease")}>–</button>
                      <span className="tabular-nums">{line.qty}</span>
                      <button className="grid size-8 place-items-center border border-line" onClick={() => setQty(line.variantId, line.qty + 1)} aria-label={t("bag.increase")}>+</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-line p-5">
          <div className="mb-4 flex justify-between text-sm">
            <span>{t("bag.subtotal")}</span>
            <span className="tabular-nums">{money(quote?.subtotalCents ?? 0)}</span>
          </div>
          <p className="mb-4 text-xs leading-5 text-ash">{t("bag.shippingNote")}</p>
          <Button variant="coral" className="w-full" onClick={() => { setOpen(false); void navigate({ to: "/checkout" }); }} disabled={!quote?.lines.length}>
            {t("bag.checkout")}
          </Button>
        </div>
      </aside>
    </div>
  );
}
