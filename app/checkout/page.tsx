"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/appwrite";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";

const RESTAURANT_ADDRESS = "175 Steve Biko Rd, Arcadia, Pretoria, 0007";

interface Quote {
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;
    distanceKm: number | null;
    warnings: string[];
    blocked: string | null;
    prepMinutes: number;
    promo: { id: string; code: string; title: string; discount: number } | null;
    promoMessage: string | null;
}

export default function CheckoutPage() {
    const router = useRouter();
    const { items } = useCartStore();
    const { user, loading } = useAuthStore();

    const [type, setType] = useState<"delivery" | "pickup">("pickup");
    const [address, setAddress] = useState("");
    const [notes, setNotes] = useState("");
    const [promoInput, setPromoInput] = useState("");
    const [promoCode, setPromoCode] = useState("");
    const [quote, setQuote] = useState<Quote | null>(null);
    const [quoteError, setQuoteError] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const cartPayload = () =>
        items.map((i) => ({ id: i.id, quantity: i.quantity, selectedSize: i.selectedSize }));

    useEffect(() => {
        if (loading) return;
        if (!user) router.replace("/sign-in");
        else if (items.length === 0) router.replace("/cart");
    }, [loading, user, items.length, router]);

    // Ask the server what this order costs. It owns prices, fees, opening hours and offers.
    useEffect(() => {
        if (!user || items.length === 0) return;
        let cancelled = false;
        const t = setTimeout(async () => {
            try {
                const q = await apiPost<Quote>("/api/quote", {
                    items: cartPayload(),
                    deliveryType: type,
                    address: type === "delivery" ? address : "",
                    promoCode,
                });
                if (!cancelled) {
                    setQuote(q);
                    setQuoteError("");
                }
            } catch (e: any) {
                if (!cancelled) {
                    setQuote(null);
                    setQuoteError(e?.message ?? "Could not price your order");
                }
            }
        }, 700);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, items, type, address, promoCode]);

    const canPay = !!quote && !quote.blocked && !busy;
    const codeApplied = !!quote?.promo?.code && quote.promo.code === promoCode.trim().toUpperCase();

    const pay = async () => {
        if (!quote) return;
        setBusy(true);
        setError("");
        try {
            const data = await apiPost<{ url: string; fields: [string, string][] }>("/api/checkout", {
                items: cartPayload(),
                deliveryType: type,
                address,
                notes,
                promoCode,
                expectedTotal: quote.total,
            });

            const form = document.createElement("form");
            form.method = "POST";
            form.action = data.url;
            for (const [k, v] of data.fields) {
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

    if (loading || !user || items.length === 0) return <p className="text-gray-400">Loading…</p>;

    const money = (n: number) => `R${n.toFixed(2)}`;

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
                        placeholder="Delivery address (street, suburb, city)"
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
                        <span>{i.quantity}x {i.name}{i.selectedSize ? ` (${i.selectedSize})` : ""}</span>
                        <span className="font-semibold">{money(i.price * i.quantity)}</span>
                    </div>
                ))}

                {/* Promo code */}
                <div className="mt-4 border-t pt-4">
                    {codeApplied ? (
                        <div className="flex items-center justify-between rounded-xl bg-green-50 p-3 text-sm text-green-700">
                            <span>🏷️ {quote?.promo?.code} applied</span>
                            <button
                                onClick={() => { setPromoCode(""); setPromoInput(""); }}
                                className="text-xs font-semibold underline"
                            >
                                Remove
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <input
                                value={promoInput}
                                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                                placeholder="Promo code"
                                className="min-w-0 flex-1 rounded-xl border border-gray-200 p-3 text-sm"
                            />
                            <button
                                onClick={() => setPromoCode(promoInput.trim())}
                                disabled={!promoInput.trim()}
                                className="rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-40"
                            >
                                Apply
                            </button>
                        </div>
                    )}
                    {quote?.promoMessage && <p className="mt-2 text-xs text-amber-700">{quote.promoMessage}</p>}
                </div>

                <div className="mt-4 space-y-1 border-t pt-4 text-sm text-gray-500">
                    <div className="flex justify-between"><span>Subtotal</span><span>{quote ? money(quote.subtotal) : "…"}</span></div>
                    <div className="flex justify-between">
            <span>
              {type === "delivery"
                  ? `Delivery${quote?.distanceKm != null ? ` (${quote.distanceKm} km)` : ""}`
                  : "Pick-up (free)"}
            </span>
                        <span>{quote ? (quote.deliveryFee > 0 ? money(quote.deliveryFee) : "Free") : "…"}</span>
                    </div>
                    {quote && quote.discount > 0 && (
                        <div className="flex justify-between text-green-600">
                            <span>{quote.promo?.title ?? "Discount"}</span>
                            <span>-{money(quote.discount)}</span>
                        </div>
                    )}
                </div>

                <div className="mt-3 flex justify-between border-t pt-3 text-lg font-extrabold">
                    <span>Total</span>
                    <span className="text-[#FE8C00]">{quote ? money(quote.total) : "…"}</span>
                </div>

                {quote && !quote.blocked && (
                    <p className="mt-2 text-xs text-gray-400">Ready in about {quote.prepMinutes} minutes.</p>
                )}
                {quote?.blocked && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">{quote.blocked}</p>}
                {quote?.warnings.map((w) => (
                    <p key={w} className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">{w}</p>
                ))}
                {quoteError && <p className="mt-3 text-sm text-red-500">{quoteError}</p>}
                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

                <button
                    onClick={pay}
                    disabled={!canPay}
                    className="mt-5 w-full rounded-full bg-[#FE8C00] py-4 font-bold text-white disabled:opacity-50"
                >
                    {busy ? "Redirecting to PayFast…" : quote ? `Pay ${money(quote.total)} with PayFast` : "Calculating…"}
                </button>
            </div>
        </div>
    );
}