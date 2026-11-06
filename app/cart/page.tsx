"use client";
import Link from "next/link";
import { lineKey, useCartStore } from "@/store/cart.store";

export default function CartPage() {
  const { items, increase, decrease, remove } = useCartStore();
  const total = items.reduce((n, i) => n + i.price * i.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-gray-500">Your cart is empty.</p>
        <Link href="/" className="rounded-full bg-[#FE8C00] px-6 py-3 font-semibold text-white">Browse menu</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-extrabold">Your Cart</h1>
      <div className="space-y-3">
        {items.map((i) => {
          const key = lineKey(i.id, i.selectedSize);
          return (
            <div key={key} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.image_url} alt={i.name} className="h-16 w-16 rounded-xl bg-gray-50 object-contain" />
              <div className="flex-1">
                <p className="font-bold">{i.name}</p>
                <p className="text-xs text-gray-400">{i.selectedSize}</p>
                <p className="text-sm font-semibold text-[#FE8C00]">R{i.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => decrease(key)} className="h-8 w-8 rounded-full bg-orange-50 font-bold text-[#FE8C00]">−</button>
                <span className="w-5 text-center font-bold">{i.quantity}</span>
                <button onClick={() => increase(key)} className="h-8 w-8 rounded-full bg-orange-50 font-bold text-[#FE8C00]">+</button>
              </div>
              <button onClick={() => remove(key)} className="text-sm text-red-500">Remove</button>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm">
        <span className="font-bold">Subtotal</span>
        <span className="text-lg font-extrabold text-[#FE8C00]">R{total.toFixed(2)}</span>
      </div>
      <Link href="/checkout" className="mt-4 block rounded-full bg-[#FE8C00] py-4 text-center font-bold text-white">
        Go to checkout
      </Link>
    </div>
  );
}