"use client";
import { useCallback, useEffect, useState } from "react";
import { account } from "@/lib/appwrite";
import { getUserOrders } from "@/lib/ordersService";
import { useAuthStore } from "@/store/auth.store";

const LABELS: Record<string, string> = {
    awaiting_payment: "Awaiting payment",
    pending: "Pending",
    confirmed: "Confirmed",
    preparing: "Preparing",
    on_the_way: "On the way",
    delivered: "Delivered",
    collected: "Collected",
    cancelled: "Cancelled",
};

const BADGE: Record<string, string> = {
    cancelled: "bg-red-50 text-red-600",
    delivered: "bg-green-50 text-green-600",
    collected: "bg-green-50 text-green-600",
};

export default function OrdersPage() {
    const { user, loading } = useAuthStore();
    const [orders, setOrders] = useState<any[]>([]);
    const [cancelling, setCancelling] = useState<string | null>(null);
    const [message, setMessage] = useState("");

    const load = useCallback(async () => {
        if (!user) return;
        try {
            const all = await getUserOrders(user.$id);
            // Hide unpaid checkouts the customer abandoned
            setOrders(all.filter((o: any) => o.status !== "awaiting_payment"));
        } catch (e) {
            console.error(e);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        load();
        const t = setInterval(load, 15000); // refresh status every 15s
        return () => clearInterval(t);
    }, [user, load]);

    const cancel = async (orderId: string) => {
        if (!window.confirm("Cancel this order?")) return;
        setCancelling(orderId);
        setMessage("");
        try {
            const { jwt } = await account.createJWT();
            const res = await fetch("/api/orders/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jwt, orderId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Could not cancel");
            setMessage("Order cancelled. If you already paid, the restaurant will arrange your refund.");
        } catch (e: any) {
            setMessage(e?.message ?? "Could not cancel");
        } finally {
            setCancelling(null);
            load();
        }
    };

    if (loading) return <p className="text-gray-400">Loading…</p>;
    if (!user) return <p>Please sign in to see your orders.</p>;

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="mb-6 text-2xl font-extrabold">My Orders</h1>
            {message && (
                <p className="mb-4 rounded-xl bg-orange-50 p-4 text-sm text-gray-700">{message}</p>
            )}
            {orders.length === 0 && <p className="text-gray-500">No orders yet.</p>}

            <div className="space-y-3">
                {orders.map((o) => (
                    <div key={o.$id} className="rounded-2xl bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-extrabold">{o.orderNumber}</p>
                                <p className="text-xs text-gray-400">{new Date(o.$createdAt).toLocaleString()}</p>
                                <p className="mt-1 text-sm text-gray-500">
                                    {o.deliveryType === "pickup" ? "Pick-up" : "Delivery"} · {o.itemCount} items
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="font-extrabold text-[#FE8C00]">R{Number(o.total).toFixed(2)}</p>
                                <span
                                    className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                                        BADGE[o.status] ?? "bg-orange-50 text-[#D97706]"
                                    }`}
                                >
                  {LABELS[o.status] ?? o.status}
                </span>
                            </div>
                        </div>

                        {o.status === "pending" && (
                            <button
                                onClick={() => cancel(o.$id)}
                                disabled={cancelling === o.$id}
                                className="mt-4 w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                                {cancelling === o.$id ? "Cancelling…" : "Cancel order"}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}