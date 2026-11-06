"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { appwriteConfig, databases } from "@/lib/appwrite";
import { useCartStore } from "@/store/cart.store";

function SuccessInner() {
    const orderId = useSearchParams().get("order");
    const clear = useCartStore((s) => s.clear);
    const [state, setState] = useState<"checking" | "paid" | "slow">("checking");
    const [orderNumber, setOrderNumber] = useState("");

    useEffect(() => {
        if (!orderId) return;
        let tries = 0;

        const check = async () => {
            tries++;
            try {
                const o: any = await databases.getDocument({
                    databaseId: appwriteConfig.databaseId,
                    collectionId: appwriteConfig.ordersCollectionId,
                    documentId: orderId,
                });
                if (o.status !== "awaiting_payment") {
                    setOrderNumber(o.orderNumber ?? "");
                    clear();
                    setState("paid");
                    return true;
                }
            } catch {}
            if (tries >= 20) setState("slow");
            return false;
        };

        check();
        const t = setInterval(async () => {
            if (await check()) clearInterval(t);
            else if (tries >= 20) clearInterval(t);
        }, 3000);
        return () => clearInterval(t);
    }, [orderId, clear]);

    return (
        <div className="py-20 text-center">
            {state === "checking" && <p className="text-gray-500">Confirming your payment…</p>}
            {state === "paid" && (
                <>
                    <h1 className="text-3xl font-extrabold text-green-600">Payment received! 🎉</h1>
                    <p className="mt-2 text-gray-500">Your order {orderNumber} is confirmed.</p>
                </>
            )}
            {state === "slow" && (
                <p className="text-gray-500">
                    We&apos;re still waiting for PayFast to confirm your payment. Check My Orders in a minute.
                </p>
            )}
            <Link href="/orders" className="mt-6 inline-block rounded-full bg-[#FE8C00] px-6 py-3 font-semibold text-white">
                View my orders
            </Link>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={<p className="py-20 text-center text-gray-400">Loading…</p>}>
            <SuccessInner />
        </Suspense>
    );
}