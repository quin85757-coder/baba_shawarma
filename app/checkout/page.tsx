"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { account } from "@/lib/appwrite";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";

const RESTAURANT_ADDRESS = "175 Steve Biko Rd, Arcadia, Pretoria, 0007";
const DELIVERY_FEE = 50;
const DISCOUNT = 10;

export default function CheckoutPage() {
    const router = useRouter();
    const { items } = useCartStore();
    const { user, loading } = useAuthStore();

    const [type, setType] = useState<"delivery" | "pickup">("pickup");
    const [address, setAddress] = useState("");
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
    const deliveryFee = type === "delivery" ? DELIVERY_FEE : 0;
    const total = subtotal + deliveryFee - DISCOUNT;

    if (loading) return <p className="text-gray-400">Loading…</p>;
    if (!user) {
        router.replace("/sign-in");
        return null;
    }
    if (items.length === 0) {
        router.replace("/cart");
        return null;
    }

    const pay = async () => {
        if (type === "delivery" && !address.trim()) {
            setError("Please enter your delivery address.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const { jwt } = await account.createJWT();
            const res = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jwt,
                    items: items.map((i) => ({
                        id: i.id,
                        quantity: i.quantity,
                        selectedSize: i.selectedSize,
                    })),
                    deliveryType: type,
                    address,
                    notes,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Checkout failed");

            // Build and submit the signed PayFast form
            const form = document.createElement("form");
            form.method = "POST";
            form.action = data.url;
            for (const [k, v] of data.fields as [string, string][]) {
                const input = document.createElement("input");
                input.type = "hidden";
                input.name = k;
                input.value = v;
                form.appendChild(input);
            }
            document.body.appendChild(form);
            form.submit();
        } catch (e: any) {
            setError(e?.message ?? "Something went wrong");
            setBusy(false);
        }
    };

    return (
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            <div className="space-y-4">
                <h1 className="text-2xl font-extrabold">Checkout</h1>

                <div className="flex rounded-xl bg-gray-100 p-1">
                    {(["pickup", "delivery"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setType(t)}
                            className={`flex-1 rounded-lg py-3 text-sm font-bold ${type === t ? "bg-white shadow" : "text-gray-400"}`}
                        >
                            {t === "pickup" ? "🏪 Pick-up" : "🛵 Delivery"}
                        </button>
                    ))}
                </div>

                {type === "delivery" ? (
                    <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Delivery address"
                        className="w-full rounded-xl border border-gray-200 bg-white p-4 text-sm"
                        rows={3}
                    />
                ) : (
                    <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
                        <p className="font-bold">Collect from</p>
                        <p className="text-gray-500">{RESTAURANT_ADDRESS}</p>
                    </div>
                )}

                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special instructions (optional)"
                    className="w-full rounded-xl border border-gray-200 bg-white p-4 text-sm"
                    rows={2}
                />
            </div>

            <div className="h-fit rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 font-bold">Order Summary</h2>
                {items.map((i) => (
                    <div key={`${i.id}-${i.selectedSize}`} className="mb-2 flex justify-between text-sm">
                        <span>{i.quantity}x {i.name}</span>
                        <span className="font-semibold">R{(i.price * i.quantity).toFixed(2)}</span>
                    </div>
                ))}
                <div className="mt-4 space-y-1 border-t pt-4 text-sm text-gray-500">
                    <div className="flex justify-between"><span>Subtotal</span><span>R{subtotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>{type === "delivery" ? "Delivery fee" : "Pick-up (free)"}</span><span>R{deliveryFee.toFixed(2)}</span></div>
                    <div className="flex justify-between text-green-600"><span>Discount</span><span>-R{DISCOUNT.toFixed(2)}</span></div>
                </div>
                <div className="mt-3 flex justify-between border-t pt-3 text-lg font-extrabold">
                    <span>Total</span><span className="text-[#FE8C00]">R{total.toFixed(2)}</span>
                </div>
                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
                <button
                    onClick={pay}
                    disabled={busy}
                    className="mt-5 w-full rounded-full bg-[#FE8C00] py-4 font-bold text-white disabled:opacity-60"
                >
                    {busy ? "Redirecting to PayFast…" : `Pay R${total.toFixed(2)} with PayFast`}
                </button>
            </div>
        </div>
    );
}