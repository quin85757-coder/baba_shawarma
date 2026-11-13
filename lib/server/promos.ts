import { Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";

export const PROMOS = "promotions";
export type PromoKind = "percent" | "fixed" | "free_delivery";

export interface Promo {
    id: string;
    title: string;
    description: string;
    code: string; // empty for automatic offers
    kind: PromoKind;
    value: number; // percent, or rand amount
    maxDiscount: number; // cap for percent offers, 0 = no cap
    minSubtotal: number;
    firstOrderOnly: boolean;
    auto: boolean;
    showBanner: boolean;
    active: boolean;
    perUserLimit: number; // 0 = unlimited
    usageLimit: number; // 0 = unlimited
    startsAt: string; // ISO, empty = no start
    endsAt: string;
}

export function toPromo(d: any): Promo {
    return {
        id: d.$id,
        title: d.title ?? "",
        description: d.description ?? "",
        code: String(d.code ?? "").toUpperCase(),
        kind: (["percent", "fixed", "free_delivery"].includes(d.kind) ? d.kind : "fixed") as PromoKind,
        value: Number(d.value ?? 0),
        maxDiscount: Number(d.maxDiscount ?? 0),
        minSubtotal: Number(d.minSubtotal ?? 0),
        firstOrderOnly: d.firstOrderOnly === true,
        auto: d.auto === true,
        showBanner: d.showBanner === true,
        active: d.active !== false,
        perUserLimit: Number(d.perUserLimit ?? 0),
        usageLimit: Number(d.usageLimit ?? 0),
        startsAt: d.startsAt ?? "",
        endsAt: d.endsAt ?? "",
    };
}

export async function listPromos(): Promise<Promo[]> {
    try {
        const r = await adminDb.listDocuments({
            databaseId: DB.database,
            collectionId: PROMOS,
            queries: [Query.limit(100)],
        });
        return (r.documents as any[]).map(toPromo);
    } catch {
        return []; // table missing: no promotions
    }
}

const inWindow = (p: Promo, now = Date.now()) => {
    const s = p.startsAt ? Date.parse(p.startsAt) : NaN;
    const e = p.endsAt ? Date.parse(p.endsAt) : NaN;
    if (Number.isFinite(s) && now < s) return false;
    if (Number.isFinite(e) && now > e) return false;
    return true;
};
export const liveNow = (promos: Promo[]) => promos.filter((p) => p.active && inWindow(p));

// What customers are allowed to see
export const publicPromo = (p: Promo) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    code: p.code,
    auto: p.auto,
    kind: p.kind,
    value: p.value,
    minSubtotal: p.minSubtotal,
    firstOrderOnly: p.firstOrderOnly,
});

// Orders that count as "used": paid and not cancelled
export async function countPaidOrders(extra: string[]): Promise<number> {
    const r = await adminDb.listDocuments({
        databaseId: DB.database,
        collectionId: DB.orders,
        queries: [
            Query.notEqual("status", "cancelled"),
            Query.notEqual("status", "awaiting_payment"),
            ...extra,
            Query.limit(1),
        ],
    });
    return r.total;
}

export interface PromoContext {
    userId: string; // the customer's profile row id
    subtotal: number;
    deliveryFee: number;
    deliveryType: "delivery" | "pickup";
}

export function amountFor(p: Promo, c: PromoContext): number {
    let d = 0;
    if (p.kind === "percent") {
        d = (c.subtotal * Math.min(100, p.value)) / 100;
        if (p.maxDiscount > 0) d = Math.min(d, p.maxDiscount);
    } else if (p.kind === "fixed") {
        d = Math.min(p.value, c.subtotal);
    } else {
        d = c.deliveryType === "delivery" ? c.deliveryFee : 0;
    }
    d = Math.min(d, Math.max(0, c.subtotal + c.deliveryFee - 1)); // the total never drops below R1
    return Math.round(d * 100) / 100;
}

export interface PromoResult {
    promo: Promo;
    discount: number;
}

// One offer per order: the one that saves the customer the most
export async function evaluateOffers(
    ctx: PromoContext,
    codeEntered: string
): Promise<{ applied: PromoResult | null; message: string | null }> {
    const live = liveNow(await listPromos());
    const code = codeEntered.trim().toUpperCase();
    let message: string | null = null;

    const codePromo = code ? live.find((p) => p.code === code) : undefined;
    if (code && !codePromo) message = "That code isn't valid or has expired.";

    const candidates: Promo[] = [];
    if (codePromo) candidates.push(codePromo);
    for (const p of live) if (p.auto && !p.code && p.id !== codePromo?.id) candidates.push(p);
    if (candidates.length === 0) return { applied: null, message };

    let paidOrders: number | null = null;
    const userPaid = async () => {
        if (paidOrders === null) paidOrders = await countPaidOrders([Query.equal("userId", ctx.userId)]);
        return paidOrders;
    };

    const check = async (p: Promo): Promise<{ ok: true; discount: number } | { ok: false; reason: string }> => {
        if (p.minSubtotal > 0 && ctx.subtotal < p.minSubtotal) {
            return { ok: false, reason: `Spend at least R${p.minSubtotal.toFixed(2)} to use this offer.` };
        }
        if (p.kind === "free_delivery") {
            if (ctx.deliveryType !== "delivery") return { ok: false, reason: "This offer is for delivery orders." };
            if (ctx.deliveryFee <= 0) return { ok: false, reason: "Delivery is already free on this order." };
        }
        if (p.firstOrderOnly && (await userPaid()) > 0) {
            return { ok: false, reason: "This offer is for first orders only." };
        }
        if (p.perUserLimit > 0) {
            const mine = await countPaidOrders([Query.equal("userId", ctx.userId), Query.equal("promoId", p.id)]);
            if (mine >= p.perUserLimit) return { ok: false, reason: "You've already used this offer." };
        }
        if (p.usageLimit > 0) {
            const all = await countPaidOrders([Query.equal("promoId", p.id)]);
            if (all >= p.usageLimit) return { ok: false, reason: "This offer has been fully claimed." };
        }
        const discount = amountFor(p, ctx);
        if (discount <= 0) return { ok: false, reason: "This offer doesn't apply to this order." };
        return { ok: true, discount };
    };

    let best: PromoResult | null = null;
    let codeResult: PromoResult | null = null;

    for (const p of candidates) {
        const r = await check(p);
        if (!r.ok) {
            if (p.id === codePromo?.id) message = r.reason;
            continue;
        }
        const res: PromoResult = { promo: p, discount: r.discount };
        if (p.id === codePromo?.id) codeResult = res;
        if (!best || res.discount > best.discount || (p.id === codePromo?.id && res.discount === best.discount)) {
            best = res;
        }
    }

    if (codeResult && best && best.promo.id !== codeResult.promo.id) {
        message = "Your code is valid, but another offer saves you more, so that one was applied.";
    }
    return { applied: best, message };
}