"use client";
import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/appwrite";
import { useAuthStore } from "@/store/auth.store";

type Kind = "percent" | "fixed" | "free_delivery";

interface Form {
    id?: string;
    title: string;
    description: string;
    kind: Kind;
    value: number;
    maxDiscount: number;
    minSubtotal: number;
    code: string;
    auto: boolean;
    firstOrderOnly: boolean;
    perUserLimit: number;
    usageLimit: number;
    startsAt: string;
    endsAt: string;
    showBanner: boolean;
    active: boolean;
}
interface Row extends Form {
    id: string;
    used: number;
}

const EMPTY: Form = {
    title: "", description: "", kind: "percent", value: 10, maxDiscount: 0, minSubtotal: 0, code: "",
    auto: false, firstOrderOnly: false, perUserLimit: 1, usageLimit: 0, startsAt: "", endsAt: "",
    showBanner: true, active: true,
};

const PRESETS: { name: string; form: Partial<Form> }[] = [
    {
        name: "Welcome offer (10% off the first order, max R50)",
        form: { title: "Welcome offer", description: "10% off your first order (up to R50)", kind: "percent", value: 10, maxDiscount: 50, auto: true, firstOrderOnly: true, showBanner: false, perUserLimit: 0 },
    },
    {
        name: "Free delivery over R250",
        form: { title: "Free delivery", description: "Free delivery on orders over R250", kind: "free_delivery", minSubtotal: 250, auto: true, showBanner: true, perUserLimit: 0 },
    },
    {
        name: "Promo code (R20 off, min R100)",
        form: { title: "R20 off", description: "R20 off your order of R100 or more", kind: "fixed", value: 20, minSubtotal: 100, code: "SAVE20", auto: false, showBanner: true, perUserLimit: 1 },
    },
];

const describe = (p: Form) =>
    p.kind === "percent"
        ? `${p.value}% off${p.maxDiscount > 0 ? `, up to R${p.maxDiscount}` : ""}`
        : p.kind === "fixed"
            ? `R${p.value} off`
            : "Free delivery";

const input = "w-full rounded-xl border border-gray-200 bg-white p-3 text-sm";
const label = "mb-1 block text-xs font-semibold text-gray-500";

export default function PromosPage() {
    const { isAdmin } = useAuthStore();
    const [rows, setRows] = useState<Row[] | null>(null);
    const [form, setForm] = useState<Form | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        try {
            const r = await apiPost<{ promos: Row[] }>("/api/admin/promos", { action: "list" });
            setRows(r.promos);
        } catch (e: any) {
            setMsg({ ok: false, text: e?.message ?? "Could not load promotions" });
        }
    }, []);

    useEffect(() => {
        if (isAdmin) load();
    }, [isAdmin, load]);

    const save = async (f: Form) => {
        setBusy(true);
        setMsg(null);
        try {
            await apiPost("/api/admin/promos", { action: "save", promo: f });
            setForm(null);
            setMsg({ ok: true, text: "Saved. It applies to new orders straight away." });
            await load();
        } catch (e: any) {
            setMsg({ ok: false, text: e?.message ?? "Could not save" });
        } finally {
            setBusy(false);
        }
    };

    const remove = async (r: Row) => {
        if (!window.confirm(`Delete "${r.title}"? Orders that used it keep their discount.`)) return;
        try {
            await apiPost("/api/admin/promos", { action: "delete", id: r.id });
            await load();
        } catch (e: any) {
            setMsg({ ok: false, text: e?.message ?? "Could not delete" });
        }
    };

    if (!isAdmin) return <p className="text-gray-400">Loading…</p>;

    const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
    const num = (v: string) => (v === "" ? 0 : Number(v));

    return (
        <div className="mx-auto max-w-3xl space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold">Promotions</h1>
                    <p className="text-xs text-gray-400">One offer applies per order: the one that saves the customer the most.</p>
                </div>
                {!form && (
                    <button onClick={() => setForm({ ...EMPTY })} className="rounded-full bg-[#FE8C00] px-5 py-2.5 text-sm font-bold text-white">
                        + New promotion
                    </button>
                )}
            </div>

            {msg && (
                <p className={`rounded-xl p-4 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>
            )}

            {form && (
                <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-bold">{form.id ? "Edit promotion" : "New promotion"}</h2>
                        {!form.id && (
                            <select
                                className="rounded-xl border border-gray-200 p-2 text-sm"
                                defaultValue=""
                                onChange={(e) => {
                                    const p = PRESETS[Number(e.target.value)];
                                    if (p) setForm({ ...EMPTY, ...p.form });
                                }}
                            >
                                <option value="" disabled>Start from a template…</option>
                                {PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className={label}>Title (customers see this)</label>
                        <input className={input} value={form.title} onChange={(e) => set({ title: e.target.value })} />
                    </div>
                    <div>
                        <label className={label}>Description</label>
                        <input className={input} value={form.description} onChange={(e) => set({ description: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                            <label className={label}>Type</label>
                            <select className={input} value={form.kind} onChange={(e) => set({ kind: e.target.value as Kind })}>
                                <option value="percent">Percentage off</option>
                                <option value="fixed">Rand amount off</option>
                                <option value="free_delivery">Free delivery</option>
                            </select>
                        </div>
                        {form.kind !== "free_delivery" && (
                            <div>
                                <label className={label}>{form.kind === "percent" ? "Percentage" : "Amount (R)"}</label>
                                <input type="number" className={input} value={form.value} onChange={(e) => set({ value: num(e.target.value) })} />
                            </div>
                        )}
                        {form.kind === "percent" && (
                            <div>
                                <label className={label}>Maximum discount (R, 0 = none)</label>
                                <input type="number" className={input} value={form.maxDiscount} onChange={(e) => set({ maxDiscount: num(e.target.value) })} />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                            <label className={label}>Minimum spend (R, 0 = none)</label>
                            <input type="number" className={input} value={form.minSubtotal} onChange={(e) => set({ minSubtotal: num(e.target.value) })} />
                        </div>
                        <div>
                            <label className={label}>Uses per customer (0 = unlimited)</label>
                            <input type="number" className={input} value={form.perUserLimit} onChange={(e) => set({ perUserLimit: num(e.target.value) })} />
                        </div>
                        <div>
                            <label className={label}>Total uses (0 = unlimited)</label>
                            <input type="number" className={input} value={form.usageLimit} onChange={(e) => set({ usageLimit: num(e.target.value) })} />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="flex items-center gap-3 text-sm font-semibold">
                            <input type="checkbox" checked={form.auto} onChange={(e) => set({ auto: e.target.checked, code: e.target.checked ? "" : form.code })} />
                            Automatic (applies without a code)
                        </label>
                        {!form.auto && (
                            <div>
                                <label className={label}>Promo code</label>
                                <input className={input} value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="SAVE20" />
                            </div>
                        )}
                        <label className="flex items-center gap-3 text-sm font-semibold">
                            <input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => set({ firstOrderOnly: e.target.checked })} />
                            First order only
                        </label>
                        <label className="flex items-center gap-3 text-sm font-semibold">
                            <input type="checkbox" checked={form.showBanner} onChange={(e) => set({ showBanner: e.target.checked })} />
                            Show on the home screen
                        </label>
                        <label className="flex items-center gap-3 text-sm font-semibold">
                            <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />
                            Active
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={label}>Starts (SA time, optional)</label>
                            <input type="datetime-local" className={input} value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
                        </div>
                        <div>
                            <label className={label}>Ends (SA time, optional)</label>
                            <input type="datetime-local" className={input} value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => save(form)} disabled={busy} className="rounded-full bg-[#FE8C00] px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                            {busy ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => setForm(null)} className="rounded-full border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {!rows && !msg && <p className="text-gray-400">Loading…</p>}
            {rows?.length === 0 && !form && (
                <p className="rounded-2xl bg-white p-6 text-sm text-gray-500 shadow-sm">
                    No promotions yet. Press <b>New promotion</b> and pick the <b>Welcome offer</b> template to start.
                </p>
            )}

            <div className="space-y-3">
                {rows?.map((r) => (
                    <div key={r.id} className="rounded-2xl bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="font-extrabold">{r.title}</p>
                                <p className="text-sm text-gray-500">{r.description}</p>
                                <p className="mt-1 text-sm font-semibold text-[#FE8C00]">{describe(r)}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className={`rounded-full px-3 py-1 ${r.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {r.active ? "Active" : "Paused"}
                </span>
                                <span className="rounded-full bg-orange-50 px-3 py-1 text-[#FE8C00]">{r.auto ? "Automatic" : `Code ${r.code}`}</span>
                                {r.firstOrderOnly && <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">First order</span>}
                            </div>
                        </div>
                        <p className="mt-3 text-xs text-gray-400">
                            Used {r.used} time{r.used === 1 ? "" : "s"}
                            {r.usageLimit > 0 ? ` of ${r.usageLimit}` : ""}
                            {r.minSubtotal > 0 ? ` · min spend R${r.minSubtotal}` : ""}
                            {r.startsAt ? ` · from ${r.startsAt.replace("T", " ")}` : ""}
                            {r.endsAt ? ` · until ${r.endsAt.replace("T", " ")}` : ""}
                        </p>
                        <div className="mt-3 flex gap-2">
                            <button onClick={() => setForm({ ...r })} className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-semibold">Edit</button>
                            <button onClick={() => save({ ...r, active: !r.active })} className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-semibold">
                                {r.active ? "Pause" : "Resume"}
                            </button>
                            <button onClick={() => remove(r)} className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-600">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}