"use client";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/appwrite";
import { useAuthStore } from "@/store/auth.store";

type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAYS: [Day, string][] = [
    ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
    ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

interface S {
    isOpen: boolean;
    closedMessage: string;
    banner: string;
    prepMinutes: number;
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    deliveryRadiusKm: number;
    deliveryFeeBands: { upToKm: number; fee: number }[];
    freeDeliveryOver: number;
    minOrderDelivery: number;
    hours: Record<Day, { open: string; close: string; closed: boolean }>;
}

const card = "rounded-2xl bg-white p-6 shadow-sm space-y-4";
const input = "w-full rounded-xl border border-gray-200 bg-white p-3 text-sm";
const label = "mb-1 block text-xs font-semibold text-gray-500";

export default function SettingsPage() {
    const { isAdmin } = useAuthStore();
    const [s, setS] = useState<S | null>(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => {
        if (!isAdmin) return;
        apiPost<{ settings: S }>("/api/admin/settings")
            .then((r) => setS(r.settings))
            .catch((e) => setMsg({ ok: false, text: e?.message ?? "Could not load settings" }));
    }, [isAdmin]);

    if (!isAdmin) return <p className="text-gray-400">Loading…</p>;
    if (!s) return <p className="text-gray-400">{msg ? msg.text : "Loading…"}</p>;

    const set = (patch: Partial<S>) => setS({ ...s, ...patch });
    const setDay = (d: Day, patch: Partial<S["hours"][Day]>) =>
        set({ hours: { ...s.hours, [d]: { ...s.hours[d], ...patch } } });
    const setBand = (i: number, patch: Partial<S["deliveryFeeBands"][number]>) =>
        set({ deliveryFeeBands: s.deliveryFeeBands.map((b, k) => (k === i ? { ...b, ...patch } : b)) });

    const save = async () => {
        setSaving(true);
        setMsg(null);
        try {
            const r = await apiPost<{ settings: S }>("/api/admin/settings", { settings: s });
            setS(r.settings);
            setMsg({ ok: true, text: "Settings saved. They apply to new orders straight away." });
        } catch (e: any) {
            setMsg({ ok: false, text: e?.message ?? "Could not save" });
        } finally {
            setSaving(false);
        }
    };

    const check = (v: boolean, on: (v: boolean) => void, text: string) => (
        <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} className="h-4 w-4" />
            {text}
        </label>
    );

    return (
        <div className="mx-auto max-w-3xl space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-extrabold">Restaurant settings</h1>
                <button onClick={save} disabled={saving} className="rounded-full bg-[#FE8C00] px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                    {saving ? "Saving…" : "Save changes"}
                </button>
            </div>

            {msg && (
                <p className={`rounded-xl p-4 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>
            )}

            <div className={card}>
                <h2 className="font-bold">Taking orders</h2>
                {check(s.isOpen, (v) => set({ isOpen: v }), "Accept orders (untick to pause everything, e.g. when it's too busy)")}
                <div>
                    <label className={label}>Message when paused or closed (optional)</label>
                    <input className={input} value={s.closedMessage} onChange={(e) => set({ closedMessage: e.target.value })} placeholder="Back soon!" />
                </div>
                <div>
                    <label className={label}>Announcement banner shown to customers (optional)</label>
                    <input className={input} value={s.banner} onChange={(e) => set({ banner: e.target.value })} placeholder="Free chips with every family meal this weekend" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {check(s.pickupEnabled, (v) => set({ pickupEnabled: v }), "Pick-up available")}
                    {check(s.deliveryEnabled, (v) => set({ deliveryEnabled: v }), "Delivery available")}
                </div>
                <div>
                    <label className={label}>Preparation time shown to customers (minutes)</label>
                    <input type="number" className={input} value={s.prepMinutes} onChange={(e) => set({ prepMinutes: Number(e.target.value) })} />
                </div>
            </div>

            <div className={card}>
                <h2 className="font-bold">Opening hours (South African time)</h2>
                <p className="text-xs text-gray-400">Until you save real hours, the restaurant counts as open all day. Closing after midnight works, for example 11:00 to 02:00.</p>
                <div className="space-y-2">
                    {DAYS.map(([d, name]) => (
                        <div key={d} className="flex flex-wrap items-center gap-3">
                            <span className="w-24 text-sm font-semibold">{name}</span>
                            <input type="time" disabled={s.hours[d].closed} value={s.hours[d].open} onChange={(e) => setDay(d, { open: e.target.value })} className="rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-40" />
                            <span className="text-gray-400">to</span>
                            <input type="time" disabled={s.hours[d].closed} value={s.hours[d].close} onChange={(e) => setDay(d, { close: e.target.value })} className="rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-40" />
                            <label className="flex items-center gap-2 text-sm text-gray-500">
                                <input type="checkbox" checked={s.hours[d].closed} onChange={(e) => setDay(d, { closed: e.target.checked })} /> Closed
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            <div className={card}>
                <h2 className="font-bold">Delivery</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                        <label className={label}>Furthest we deliver (km)</label>
                        <input type="number" className={input} value={s.deliveryRadiusKm} onChange={(e) => set({ deliveryRadiusKm: Number(e.target.value) })} />
                    </div>
                    <div>
                        <label className={label}>Minimum delivery order (R, 0 = none)</label>
                        <input type="number" className={input} value={s.minOrderDelivery} onChange={(e) => set({ minOrderDelivery: Number(e.target.value) })} />
                    </div>
                    <div>
                        <label className={label}>Free delivery from (R, 0 = off)</label>
                        <input type="number" className={input} value={s.freeDeliveryOver} onChange={(e) => set({ freeDeliveryOver: Number(e.target.value) })} />
                    </div>
                </div>

                <div>
                    <p className={label}>Delivery fee by distance from the restaurant</p>
                    <div className="space-y-2">
                        {s.deliveryFeeBands.map((b, i) => (
                            <div key={i} className="flex flex-wrap items-center gap-3 text-sm">
                                <span className="text-gray-500">Up to</span>
                                <input type="number" className="w-24 rounded-xl border border-gray-200 p-2" value={b.upToKm} onChange={(e) => setBand(i, { upToKm: Number(e.target.value) })} />
                                <span className="text-gray-500">km costs R</span>
                                <input type="number" className="w-24 rounded-xl border border-gray-200 p-2" value={b.fee} onChange={(e) => setBand(i, { fee: Number(e.target.value) })} />
                                {s.deliveryFeeBands.length > 1 && (
                                    <button onClick={() => set({ deliveryFeeBands: s.deliveryFeeBands.filter((_, k) => k !== i) })} className="text-xs text-red-500">Remove</button>
                                )}
                            </div>
                        ))}
                    </div>
                    {s.deliveryFeeBands.length < 8 && (
                        <button
                            onClick={() => set({ deliveryFeeBands: [...s.deliveryFeeBands, { upToKm: s.deliveryRadiusKm, fee: 0 }] })}
                            className="mt-3 text-sm font-semibold text-[#FE8C00]"
                        >
                            + Add a band
                        </button>
                    )}
                    <p className="mt-2 text-xs text-gray-400">Distance is a straight line from the restaurant. Addresses further than the radius can't order delivery.</p>
                </div>
            </div>
        </div>
    );
}