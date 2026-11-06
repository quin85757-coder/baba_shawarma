import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url: string;
  selectedSize: string;
  quantity: number;
}

// One cart line = one menu item in one size
export const lineKey = (id: string, size: string) => `${id}::${size}`;
const keyOf = (i: CartItem) => lineKey(i.id, i.selectedSize);

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  increase: (key: string) => void;
  decrease: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((s) => {
          const key = lineKey(item.id, item.selectedSize);
          const found = s.items.find((i) => keyOf(i) === key);
          if (found) {
            return {
              items: s.items.map((i) => (keyOf(i) === key ? { ...i, quantity: i.quantity + 1 } : i)),
            };
          }
          return { items: [...s.items, { ...item, quantity: 1 }] };
        }),
      increase: (key) =>
        set((s) => ({
          items: s.items.map((i) => (keyOf(i) === key ? { ...i, quantity: i.quantity + 1 } : i)),
        })),
      decrease: (key) =>
        set((s) => ({
          items: s.items
            .map((i) => (keyOf(i) === key ? { ...i, quantity: i.quantity - 1 } : i))
            .filter((i) => i.quantity > 0),
        })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => keyOf(i) !== key) })),
      clear: () => set({ items: [] }),
    }),
    { name: "baba-cart" }
  )
);