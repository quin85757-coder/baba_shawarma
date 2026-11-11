import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { HttpError } from "@/lib/server/auth";

export const SETTINGS_TABLE = "settings";
export const SETTINGS_ID = "main";

export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_NAMES: Record<Day, string> = {
    sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday",
};

export interface DayHours { open: string; close: string; closed: boolean }
export interface FeeBand { upToKm: number; fee: number }
export interface Settings {
    isOpen: boolean;
    closedMessage: string;
    banner: string;
    prepMinutes: number;
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    deliveryRadiusKm: number;
    deliveryFeeBands: FeeBand[];
    freeDeliveryOver: number; // 0 = off
    minOrderDelivery: number; // 0 = none
    hours: Record<Day, DayHours>;
}

// Until real hours are saved the restaurant counts as always open
const allDay: DayHours = { open: "00:00", close: "23:59", closed: false };
export const DEFAULT_SETTINGS: Settings = {
    isOpen: true,
    closedMessage: "",
    banner: "",
    prepMinutes: 25,
    deliveryEnabled: true,
    pickupEnabled: true,
    deliveryRadiusKm: 15,
    deliveryFeeBands: [{ upToKm: 15, fee: 50 }],
    freeDeliveryOver: 0,
    minOrderDelivery: 0,
    hours: { sun: allDay, mon: allDay, tue: allDay, wed: allDay, thu: allDay, fri: allDay, sat: allDay },
};

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const json = <T,>(v: unknown, d: T): T => {
    if (typeof v !== "string" || !v) return d;
    try { return JSON.parse(v) as T; } catch { return d; }
};

function normalise(raw: any): Settings {
    const d = DEFAULT_SETTINGS;
    const saved = json<Partial<Record<Day, Partial<DayHours>>>>(raw?.hours, {});
    const bands = json<FeeBand[]>(raw?.deliveryFeeBands, []).filter(
        (b) => Number.isFinite(b?.upToKm) && Number.isFinite(b?.fee)
    );
    return {
        isOpen: bool(raw?.isOpen, d.isOpen),
        closedMessage: str(raw?.closedMessage),
        banner: str(raw?.banner),
        prepMinutes: num(raw?.prepMinutes, d.prepMinutes),
        deliveryEnabled: bool(raw?.deliveryEnabled, d.deliveryEnabled),
        pickupEnabled: bool(raw?.pickupEnabled, d.pickupEnabled),
        deliveryRadiusKm: num(raw?.deliveryRadiusKm, d.deliveryRadiusKm),
        deliveryFeeBands: bands.length ? bands.sort((a, b) => a.upToKm - b.upToKm) : d.deliveryFeeBands,
        freeDeliveryOver: num(raw?.freeDeliveryOver, 0),
        minOrderDelivery: num(raw?.minOrderDelivery, 0),
        hours: Object.fromEntries(
            DAYS.map((k) => [k, { ...d.hours[k], ...(saved[k] ?? {}) }])
        ) as Record<Day, DayHours>,
    };
}

export async function getSettings(): Promise<Settings> {
    try {
        const doc = await adminDb.getDocument({
            databaseId: DB.database,
            collectionId: SETTINGS_TABLE,
            documentId: SETTINGS_ID,
        });
        return normalise(doc);
    } catch {
        return DEFAULT_SETTINGS; // no row yet, or the table isn't there yet
    }
}

export function validateSettings(i: any): Settings {
    const n = (v: unknown, min: number, max: number, label: string) => {
        const x = Number(v);
        if (!Number.isFinite(x) || x < min || x > max) throw new HttpError(400, `${label} must be between ${min} and ${max}.`);
        return x;
    };
    const time = (v: unknown, label: string) => {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) throw new HttpError(400, `${label} must look like 09:30.`);
        return String(v);
    };

    const hours = {} as Record<Day, DayHours>;
    for (const k of DAYS) {
        const h = i?.hours?.[k];
        hours[k] = {
            open: time(h?.open, `${DAY_NAMES[k]} opening time`),
            close: time(h?.close, `${DAY_NAMES[k]} closing time`),
            closed: h?.closed === true,
        };
    }

    const rawBands = Array.isArray(i?.deliveryFeeBands) ? i.deliveryFeeBands : [];
    if (rawBands.length < 1 || rawBands.length > 8) throw new HttpError(400, "Add between 1 and 8 delivery fee bands.");
    const bands: FeeBand[] = rawBands
        .map((b: any) => ({ upToKm: n(b?.upToKm, 0.5, 200, "Band distance"), fee: n(b?.fee, 0, 1000, "Delivery fee") }))
        .sort((a: FeeBand, b: FeeBand) => a.upToKm - b.upToKm);

    return {
        isOpen: i?.isOpen !== false,
        closedMessage: String(i?.closedMessage ?? "").trim().slice(0, 200),
        banner: String(i?.banner ?? "").trim().slice(0, 300),
        prepMinutes: Math.round(n(i?.prepMinutes, 5, 240, "Preparation time")),
        deliveryEnabled: i?.deliveryEnabled !== false,
        pickupEnabled: i?.pickupEnabled !== false,
        deliveryRadiusKm: n(i?.deliveryRadiusKm, 1, 200, "Delivery radius"),
        deliveryFeeBands: bands,
        freeDeliveryOver: n(i?.freeDeliveryOver ?? 0, 0, 100000, "Free delivery threshold"),
        minOrderDelivery: n(i?.minOrderDelivery ?? 0, 0, 100000, "Minimum order"),
        hours,
    };
}

// ─── Opening hours (South Africa is UTC+2 all year) ───────────────────────────
const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
};
const sastNow = () => {
    const t = new Date(Date.now() + 2 * 3600 * 1000);
    return { idx: t.getUTCDay(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
};

function nextOpening(s: Settings): string {
    const { idx, minutes } = sastNow();
    for (let i = 0; i < 8; i++) {
        const k = DAYS[(idx + i) % 7];
        const h = s.hours[k];
        if (h.closed) continue;
        if (i === 0 && toMin(h.open) <= minutes) continue;
        if (i === 0) return `Opens today at ${h.open}.`;
        if (i === 1) return `Opens tomorrow at ${h.open}.`;
        return `Opens ${DAY_NAMES[k]} at ${h.open}.`;
    }
    return "";
}

export function openStatus(s: Settings): { open: boolean; reason: string; today: string } {
    const { idx, minutes } = sastNow();
    const today = s.hours[DAYS[idx]];
    const label = today.closed ? "Closed today" : `${today.open} – ${today.close}`;

    if (!s.isOpen) {
        return { open: false, reason: s.closedMessage || "We're not taking orders right now.", today: label };
    }

    const o = toMin(today.open);
    const c = toMin(today.close);
    const openToday = !today.closed && (c > o ? minutes >= o && minutes < c : minutes >= o);

    // Hours that run past midnight carry into the next morning
    const y = s.hours[DAYS[(idx + 6) % 7]];
    const fromYesterday = !y.closed && toMin(y.close) <= toMin(y.open) && minutes < toMin(y.close);

    if (openToday || fromYesterday) return { open: true, reason: "", today: label };
    return { open: false, reason: `We're closed right now. ${nextOpening(s)}`.trim(), today: label };
}

// ─── Delivery fee ─────────────────────────────────────────────────────────────
export function deliveryFeeFor(s: Settings, km: number | null, subtotal: number) {
    if (km !== null && km > s.deliveryRadiusKm) return { ok: false, fee: 0 };
    const bands = s.deliveryFeeBands;
    const band = km === null ? bands[bands.length - 1] : bands.find((b) => km <= b.upToKm) ?? bands[bands.length - 1];
    const free = s.freeDeliveryOver > 0 && subtotal >= s.freeDeliveryOver;
    return { ok: true, fee: free ? 0 : band.fee };
}