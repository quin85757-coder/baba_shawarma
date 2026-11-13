"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/appwrite";
import { getMenu } from "@/lib/ordersService";
import { useAuthStore } from "@/store/auth.store";

interface PublicSettings {
    open: boolean;
    reason: string;
    today: string;
    prepMinutes: number;
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    minOrderDelivery: number;
    freeDeliveryOver: number;
    deliveryRadiusKm: number;
    deliveryFeeBands: { upToKm: number; fee: number }[];
}
interface Welcome {
    title: string;
    description: string;
    minSubtotal: number;
}

const STEPS = 3;
const input = "w-full rounded-xl border border-gray-200 bg-white p-3 text-sm";

export default function WelcomePage() {
    const router = useRouter();
    const { user, loading, fetchUser } = useAuthStore();

    const [step, setStep] = useState(0);
    const [settings, setSettings] = useState<PublicSettings | null>(null);
    const [welcome, setWelcome] = useState<Welcome | null>(null);
    const [dishes, setDishes] = useState<any[]>([]);
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");

    // Only a signed-in customer who hasn't seen this yet belongs here
    useEffect(() => {
        if (loading) return;
        if (!user) router.replace("/sign-in");
        else if (user.onboarded !== false) router.replace("/");
    }, [loading, user, router]);

    useEffect(() => {
        fetch("/api/settings").then((r) => (r.ok ? r.json() : null)).then((d) => d && setSettings(d)).catch(() => {});
        fetch("/api/promos").then((r) => (r.ok ? r.json() : null)).then((d) => d && setWelcome(d.welcome ?? null)).catch(() => {});
        getMenu({ limit: 3 }).then((m) => setDishes(m.slice(0, 3))).catch(() => {});
    }, []);

    useEffect(() => {
        if (user) {
            setPhone(user.phone ?? "");
            setAddress(user.address1 ?? "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.$id]);

    const finish = async () => {
        setBusy(true);
        try {
            await apiPost("/api/profile/update", { onboarded: true });
            await fetchUser();
        } catch {
            // Never trap anyone here: remember the skip for this session instead
            sessionStorage.setItem("welcomeSkipped", "1");
        }
        router.replace("/");
    };

    const saveDetails = async () => {
        const p = phone.trim();
        const a = address.trim();
        if (p && !/^[0-9+\-\s()]{9,20}$/.test(p)) {
            setMsg("That phone number doesn't look right.");
            return;
        }
        if (!p && !a) {
            setStep(2);
            return;
        }
        setBusy(true);
        setMsg("");
        try {
            await apiPost("/api/profile/update", { ...(p ? { phone: p } : {}), ...(a ? { address1: a } : {}) });
            setStep(2);
        } catch (e: any) {
            setMsg(e?.message ?? "We couldn't save that. You can add it later in your profile.");
        } finally {
            setBusy(false);
        }
    };

    if (loading || !user || user.onboarded !== false) return <p className="text-gray-400">Loading…</p>;

    const firstName = user.name?.split(" ")[0] ?? "there";
    const lowestFee = settings?.deliveryFeeBands?.length
        ? Math.min(...settings.deliveryFeeBands.map((b) => b.fee))
        : null;

    return (
        <div className="mx-auto max-w-xl">
            <div className="mb-6 flex items-center justify-between">
                <div className="flex gap-2">
                    {Array.from({ length: STEPS }).map((_, i) => (
                        <span key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-8 bg-[#FE8C00]" : "w-2 bg-gray-300"}`} />
                    ))}
                </div>
                <button onClick={finish} disabled={busy} className="text-sm font-semibold text-gray-400 hover:text-gray-600">
                    Skip
                </button>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm">
                {step === 0 && (
                    <div className="space-y-5">
                        <div>
                            <h1 className="text-3xl font-extrabold">Welcome, {firstName}! 👋</h1>
                            <p className="mt-2 text-gray-500">Fresh shawarma, grilled chicken and more, made to order in Arcadia, Pretoria.</p>
                        </div>

                        {dishes.length > 0 && (
                            <div className="grid grid-cols-3 gap-3">
                                {dishes.map((d) => (
                                    <div key={d.$id} className="overflow-hidden rounded-2xl bg-gray-50">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={d.image_url} alt={d.name} className="h-24 w-full object-cover" />
                                        <p className="truncate px-2 py-1.5 text-xs font-semibold">{d.name}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {settings && (
                            <div className="space-y-2 rounded-2xl bg-orange-50 p-4 text-sm">
                                <p className="font-bold">
                                    {settings.open ? "🟢 Open now" : "🔴 Closed right now"} · Today {settings.today}
                                </p>
                                {!settings.open && settings.reason && <p className="text-gray-500">{settings.reason}</p>}
                                <ul className="space-y-1 text-gray-600">
                                    <li>⏱️ Ready in about {settings.prepMinutes} minutes</li>
                                    {settings.pickupEnabled && <li>🏪 Pick-up is free</li>}
                                    {settings.deliveryEnabled && (
                                        <li>
                                            🛵 Delivery{lowestFee !== null ? ` from R${lowestFee}` : ""} within {settings.deliveryRadiusKm} km
                                        </li>
                                    )}
                                    {settings.deliveryEnabled && settings.freeDeliveryOver > 0 && (
                                        <li>🎁 Free delivery on orders over R{settings.freeDeliveryOver}</li>
                                    )}
                                    {settings.deliveryEnabled && settings.minOrderDelivery > 0 && (
                                        <li>🧾 Minimum delivery order R{settings.minOrderDelivery}</li>
                                    )}
                                </ul>
                            </div>
                        )}

                        <button onClick={() => setStep(1)} className="w-full rounded-full bg-[#FE8C00] py-3.5 font-bold text-white">
                            Continue
                        </button>
                    </div>
                )}

                {step === 1 && (
                    <div className="space-y-4">
                        <div>
                            <h1 className="text-2xl font-extrabold">Your details</h1>
                            <p className="mt-1 text-sm text-gray-500">Optional, but it makes checkout quicker. You can change these any time in your profile.</p>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-500">Phone number</label>
                            <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 082 123 4567" inputMode="tel" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-500">Delivery address</label>
                            <textarea className={input} rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, suburb, city" />
                        </div>
                        {msg && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{msg}</p>}
                        <div className="flex gap-3">
                            <button onClick={() => setStep(0)} className="rounded-full border border-gray-200 px-6 py-3.5 font-semibold text-gray-600">
                                Back
                            </button>
                            <button onClick={saveDetails} disabled={busy} className="flex-1 rounded-full bg-[#FE8C00] py-3.5 font-bold text-white disabled:opacity-60">
                                {busy ? "Saving…" : phone.trim() || address.trim() ? "Save and continue" : "Skip for now"}
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-5 text-center">
                        <div className="text-6xl">🎁</div>
                        {welcome ? (
                            <>
                                <h1 className="text-2xl font-extrabold">{welcome.title}</h1>
                                <p className="text-gray-500">{welcome.description}</p>
                                <p className="rounded-2xl bg-orange-50 p-4 text-sm font-semibold text-[#E05C00]">
                                    It's applied automatically at checkout
                                    {welcome.minSubtotal > 0 ? ` on orders of R${welcome.minSubtotal} or more` : ""}. Nothing to enter.
                                </p>
                            </>
                        ) : (
                            <>
                                <h1 className="text-2xl font-extrabold">You're all set!</h1>
                                <p className="text-gray-500">Browse the menu, add your favourites and check out in a few taps.</p>
                            </>
                        )}
                        <button onClick={finish} disabled={busy} className="w-full rounded-full bg-[#FE8C00] py-3.5 font-bold text-white disabled:opacity-60">
                            {busy ? "One moment…" : "Start ordering"}
                        </button>
                        <button onClick={() => setStep(1)} className="text-sm text-gray-400">Back</button>
                    </div>
                )}
            </div>
        </div>
    );
}