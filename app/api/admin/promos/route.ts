import { NextRequest, NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { logActivity } from "@/lib/server/audit";
import { PROMOS, Promo, countPaidOrders, listPromos } from "@/lib/server/promos";

const KINDS = ["percent", "fixed", "free_delivery"];

// Dates are typed in South African time (UTC+2 all year) and stored as ISO strings
const sastToIso = (v: unknown, label: string) => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) throw new HttpError(400, `${label} isn't a valid date and time.`);
    const t = Date.parse(`${s}:00+02:00`);
    if (!Number.isFinite(t)) throw new HttpError(400, `${label} isn't a valid date and time.`);
    return new Date(t).toISOString();
};
const isoToSast = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? new Date(t + 2 * 3600 * 1000).toISOString().slice(0, 16) : "";
};

function validate(p: any, others: Promo[], selfId?: string) {
    const num = (v: unknown, min: number, max: number, label: string) => {
        const x = Number(v ?? 0);
        if (!Number.isFinite(x) || x < min || x > max) throw new HttpError(400, `${label} must be between ${min} and ${max}.`);
        return x;
    };

    const title = String(p?.title ?? "").trim().slice(0, 100);
    if (!title) throw new HttpError(400, "Give the promotion a title.");

    const kind = String(p?.kind);
    if (!KINDS.includes(kind)) throw new HttpError(400, "Choose a promotion type.");

    const value =
        kind === "free_delivery" ? 0 : kind === "percent" ? num(p?.value, 1, 100, "Percentage") : num(p?.value, 1, 10000, "Amount");

    const auto = p?.auto === true;
    let code = String(p?.code ?? "").trim().toUpperCase();
    if (auto) code = "";
    else if (!code) throw new HttpError(400, "Enter a promo code, or tick Automatic.");
    if (code && !/^[A-Z0-9_-]{3,30}$/.test(code)) {
        throw new HttpError(400, "Codes use 3 to 30 letters, numbers, dashes or underscores.");
    }
    if (code && others.some((o) => o.id !== selfId && o.code === code)) {
        throw new HttpError(409, `The code ${code} is already used by another promotion.`);
    }

    const startsAt = sastToIso(p?.startsAt, "The start");
    const endsAt = sastToIso(p?.endsAt, "The end");
    if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
        throw new HttpError(400, "The end must be after the start.");
    }

    return {
        title,
        description: String(p?.description ?? "").trim().slice(0, 300),
        code,
        kind,
        value,
        maxDiscount: kind === "percent" ? num(p?.maxDiscount, 0, 10000, "Maximum discount") : 0,
        minSubtotal: num(p?.minSubtotal, 0, 100000, "Minimum spend"),
        firstOrderOnly: p?.firstOrderOnly === true,
        auto,
        showBanner: p?.showBanner === true,
        active: p?.active !== false,
        perUserLimit: Math.round(num(p?.perUserLimit, 0, 1000, "Uses per customer")),
        usageLimit: Math.round(num(p?.usageLimit, 0, 1000000, "Total uses")),
        startsAt,
        endsAt,
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const caller = await getCaller(body.jwt);
        if (!caller.isAdmin) throw new HttpError(403, "Admins only");

        const action = String(body.action ?? "list");

        if (action === "list") {
            const promos = (await listPromos()).slice(0, 40);
            const used = await Promise.all(promos.map((p) => countPaidOrders([Query.equal("promoId", p.id)])));
            return NextResponse.json({
                promos: promos.map((p, i) => ({ ...p, startsAt: isoToSast(p.startsAt), endsAt: isoToSast(p.endsAt), used: used[i] })),
            });
        }

        if (action === "save") {
            const promos = await listPromos();
            const id = body.promo?.id ? String(body.promo.id) : undefined;
            const data = validate(body.promo, promos, id);

            if (id) {
                await adminDb.updateDocument({ databaseId: DB.database, collectionId: PROMOS, documentId: id, data });
            } else {
                if (promos.length >= 40) throw new HttpError(400, "That's the maximum number of promotions. Delete an old one first.");
                await adminDb.createDocument({
                    databaseId: DB.database,
                    collectionId: PROMOS,
                    documentId: ID.unique(),
                    data,
                    permissions: [],
                });
            }
            await logActivity(caller, "promo_saved", data.title, data.code || "automatic");
            return NextResponse.json({ ok: true });
        }

        if (action === "delete") {
            const id = String(body.id ?? "");
            if (!id) throw new HttpError(400, "Missing promotion");
            let title = "promotion";
            try {
                const d: any = await adminDb.getDocument({ databaseId: DB.database, collectionId: PROMOS, documentId: id });
                title = d.title ?? title;
            } catch {
                throw new HttpError(404, "Promotion not found");
            }
            await adminDb.deleteDocument({ databaseId: DB.database, collectionId: PROMOS, documentId: id });
            await logActivity(caller, "promo_deleted", title);
            return NextResponse.json({ ok: true });
        }

        throw new HttpError(400, "Unknown action");
    } catch (e) {
        return fail(e);
    }
}