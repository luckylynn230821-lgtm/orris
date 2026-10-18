import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = { variantId: string; qty: number };

type CartState = {
  lines: CartLine[];
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (variantId: string, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      open: false,
      setOpen: (open) => set({ open }),
      add: (variantId, qty = 1) => {
        const lines = get().lines.map((line) => ({ ...line }));
        const found = lines.find((line) => line.variantId === variantId);
        if (found) found.qty = Math.min(10, found.qty + qty);
        else lines.push({ variantId, qty: Math.min(10, qty) });
        set({ lines, open: true });
      },
      setQty: (variantId, qty) =>
        set({
          lines:
            qty <= 0
              ? get().lines.filter((line) => line.variantId !== variantId)
              : get().lines.map((line) => (line.variantId === variantId ? { variantId, qty: Math.min(10, qty) } : line)),
        }),
      clear: () => set({ lines: [] }),
    }),
    { name: "orris-cart", partialize: (state) => ({ lines: state.lines }), skipHydration: true },
  ),
);

export function useSessionKey() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem("orris-session") || "";
}

export function ensureSessionKey() {
  if (typeof window === "undefined") return "";
  let key = window.localStorage.getItem("orris-session");
  if (!key) {
    key = crypto.randomUUID();
    window.localStorage.setItem("orris-session", key);
  }
  return key;
}
