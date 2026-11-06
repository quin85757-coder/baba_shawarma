"use client";
import { useState } from "react";
import { getSizes, MenuSize } from "@/lib/ordersService";
import { useCartStore } from "@/store/cart.store";

export interface Addable {
    id: string;
    name: string;
    image_url: string;
    price: number; // fallback when an item has no size rows
}

export function useAddToCart() {
    const addItem = useCartStore((s) => s.addItem);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [picker, setPicker] = useState<{ item: Addable; sizes: MenuSize[] } | null>(null);
    const [toast, setToast] = useState("");

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(""), 2200);
    };

    const put = (item: Addable, size: { label: string; price: number }) => {
        addItem({
            id: item.id,
            name: item.name,
            price: size.price,
            image_url: item.image_url,
            selectedSize: size.label,
        });
        flash(`Added ${item.name} (${size.label})`);
    };

    const add = async (item: Addable) => {
        setBusyId(item.id);
        try {
            const sizes = await getSizes(item.id);
            if (sizes.length > 1) setPicker({ item, sizes });
            else if (sizes.length === 1) put(item, sizes[0]);
            else put(item, { label: "Regular", price: item.price });
        } catch (e) {
            console.error(e);
            flash("Could not load sizes. Please try again.");
        } finally {
            setBusyId(null);
        }
    };

    const ui = (
        <>
            {picker && (
                <div
                    className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center"
                    onClick={() => setPicker(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={picker.item.image_url}
                                alt={picker.item.name}
                                className="h-14 w-14 rounded-xl bg-gray-50 object-contain"
                            />
                            <div>
                                <h2 className="font-extrabold">{picker.item.name}</h2>
                                <p className="text-sm text-gray-400">Choose a size</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {picker.sizes.map((s) => (
                                <button
                                    key={s.$id}
                                    onClick={() => {
                                        put(picker.item, s);
                                        setPicker(null);
                                    }}
                                    className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-[#FE8C00] hover:bg-orange-50"
                                >
                                    <span className="font-semibold">{s.label}</span>
                                    <span className="font-bold text-[#FE8C00]">R{s.price.toFixed(2)}</span>
                                </button>
                            ))}
                        </div>

                        <button onClick={() => setPicker(null)} className="mt-4 w-full text-sm text-gray-400">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg">
                    {toast}
                </div>
            )}
        </>
    );

    return { add, busyId, ui, flash };
}