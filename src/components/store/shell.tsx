import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { quoteCart, getChrome } from "@/lib/commerce/fns";
import { ensureSessionKey, useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

type Quote = Awaited<ReturnType<typeof quoteCart>>;

export function StoreShell({ children }: { children: React.ReactNode }) {
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
      <div className="bg-ink px-4 py-2 text-center text-[11px] tracking-[0.16em] text-ivory uppercase">
        {chrome?.announcement || "Complimentary standard shipping on orders over $250"}
      </div>
      <header className="sticky top-0 z-30 border-b border-line bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
          <button className="md:hidden" aria-label="Menu" onClick={() => setMenu(true)}>
            <Menu className="size-5" />
          </button>
          <Link to="/" className="font-display text-2xl tracking-[0.18em]">
            ORRIS
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-sm md:flex">
            <Link to="/shop" className="hover:text-ash">Shop</Link>
            <Link to="/shop" search={{ category: "textiles" }} className="hover:text-ash">Textiles</Link>
            <Link to="/shop" search={{ category: "apparel" }} className="hover:text-ash">Apparel</Link>
            <Link to="/shop" search={{ category: "ceramic" }} className="hover:text-ash">Ceramic</Link>
            <Link to="/about" className="hover:text-ash">The house</Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button className="grid size-11 place-items-center" aria-label="Search" onClick={() => setSearch(true)}>
              <Search className="size-5" />
            </button>
            <Link to="/account" className="hidden px-2 text-sm md:inline">Account</Link>
            <button className="relative grid size-11 place-items-center" aria-label="Bag" onClick={() => setOpen(true)}>
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
            <p className="font-display text-2xl tracking-[0.16em]">{chrome?.brandName || "ORRIS"}</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-ash">
              {chrome?.footerBlurb || "A single-house shop for goods you can reorder, repair and account for."}
            </p>
          </div>
          <div className="text-sm leading-8">
            <Link to="/about" className="block">The house</Link>
            <Link to="/orders" className="block">Find an order</Link>
            <Link to="/shop" className="block">All goods</Link>
          </div>
          <div className="text-sm leading-8">
            <Link to="/admin" className="block">Merchant desk</Link>
            <a href={`mailto:${chrome?.supportEmail || "atelier@orris.example"}`} className="block">{chrome?.supportEmail || "atelier@orris.example"}</a>
          </div>
        </div>
      </footer>

      {menu ? (
        <div className="fixed inset-0 z-40 bg-ivory p-6">
          <button className="grid size-11 place-items-center" aria-label="Close menu" onClick={() => setMenu(false)}>
            <X />
          </button>
          <div className="mt-8 flex flex-col gap-5 font-display text-4xl">
            <Link to="/shop" onClick={() => setMenu(false)}>Shop</Link>
            <Link to="/about" onClick={() => setMenu(false)}>The house</Link>
            <Link to="/account" onClick={() => setMenu(false)}>Account</Link>
            <Link to="/orders" onClick={() => setMenu(false)}>Orders</Link>
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
            <label className="text-xs tracking-[0.16em] text-ash uppercase" htmlFor="site-search">Search the house</label>
            <input
              id="site-search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-3 h-12 w-full border-b border-ink bg-transparent text-lg outline-none"
              placeholder="Cashmere, linen, brass"
            />
          </form>
        </div>
      ) : null}

      <div className={cn("fixed inset-0 z-40 bg-ink/30 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={() => setOpen(false)} />
      <aside className={cn("fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col bg-ivory transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")} aria-hidden={!open}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-2xl">Your bag</h2>
          <button className="grid size-11 place-items-center" aria-label="Close bag" onClick={() => setOpen(false)}><X /></button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4">
          {(quote?.lines.length ?? 0) === 0 ? (
            <p className="text-sm text-ash">The bag is empty. The collection is a short walk away.</p>
          ) : (
            <ul className="space-y-5">
              {quote?.lines.map((line) => (
                <li key={line.variantId} className="flex gap-3">
                  <div className="h-24 w-20 bg-stone">
                    {line.image ? <img src={line.image} alt={line.alt} className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{line.name}</p>
                    <p className="text-xs text-ash">{line.title}</p>
                    <p className="mt-1 text-sm tabular-nums">{money(line.priceCents)}</p>
                    {line.warning ? <p className="mt-1 text-xs text-danger">{line.warning}</p> : null}
                    <div className="mt-2 flex items-center gap-3 text-sm">
                      <button className="grid size-8 place-items-center border border-line" onClick={() => setQty(line.variantId, line.qty - 1)} aria-label="Decrease">–</button>
                      <span className="tabular-nums">{line.qty}</span>
                      <button className="grid size-8 place-items-center border border-line" onClick={() => setQty(line.variantId, line.qty + 1)} aria-label="Increase">+</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-line p-5">
          <div className="mb-4 flex justify-between text-sm">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(quote?.subtotalCents ?? 0)}</span>
          </div>
          <p className="mb-4 text-xs leading-5 text-ash">Shipping is confirmed at checkout. Standard is free over $250.</p>
          <Button className="w-full" onClick={() => { setOpen(false); void navigate({ to: "/checkout" }); }} disabled={!quote?.lines.length}>
            Checkout
          </Button>
        </div>
      </aside>
    </div>
  );
}
