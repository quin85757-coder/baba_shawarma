import { Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { HttpError } from "@/lib/server/auth";
import { fetchAll } from "@/lib/server/fetchAll";
import { RESTAURANT_COORDS, distanceKm, geocode, inSouthAfrica, round1 } from "@/lib/server/geo";
import { evaluateOffers } from "@/lib/server/promos";
import { deliveryFeeFor, getSettings, openStatus } from "@/lib/server/settings";

export interface Line {
    menuId: string;
    menuName: string;
    selectedSize: string;
    sizePrice: number;
    quantity: number;
}

export interface Quote {
    lines: Line[];
    itemCount: number;
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;
    distanceKm: number | null;
    drop: { lat: number; lng: number } | null;
    open: boolean;
    warnings: string[];
    blocked: string | null; // set when the order can't be placed, with the reason to show
    prepMinutes: number;
    promo: { id: string; code: string; title: string; discount: number } | null;
    promoMessage: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Every size for these menu items, in as few calls as possible
async function sizesByMenu(ids: string[]): Promise<Map<string, any[]>> {
    const out = new Map<string, any[]>(ids.map((id) => [id, []]));
    try {
        const rows = await fetchAll("size", [Query.equal("menu", ids)], 600);
        if (rows.length === 0) throw new Error("empty");
        for (const r of rows) {
            const mid = typeof r.menu === "string" ? r.menu : r.menu?.$id;
            if (mid && out.has(mid)) out.get(mid)!.push(r);
        }
        return out;
    } catch {
        // Fall back to one lookup per item
        for (const id of ids) {
            const r = await adminDb.listDocuments({
                databaseId: DB.database,
                collectionId: "size",
                queries: [Query.equal("menu", id), Query.limit(50)],
            });
            out.set(id, r.documents as any[]);
        }
        return out;
    }
}

export async function buildQuote(input: {
    items: unknown;
    deliveryType: unknown;
    address: unknown;
    lat: unknown;
    lng: unknown;
    userId: string;
    promoCode?: unknown;
}): Promise<Quote> {
    const { items, deliveryType } = input;
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, "Cart is empty");
    if (items.length > 50) throw new HttpError(400, "Too many items");
    if (deliveryType !== "delivery" && deliveryType !== "pickup") throw new HttpError(400, "Invalid delivery type");

    const settings = await getSettings();

    // 1. Re-price every item from the database, by size (never trust the client)
    const ids = [...new Set(items.map((i: any) => String(i?.id ?? "")))].filter(Boolean);
    if (ids.length === 0) throw new HttpError(400, "Invalid cart");

    const [menuRes, sizeMap] = await Promise.all([
        adminDb.listDocuments({
            databaseId: DB.database,
            collectionId: DB.menu,
            queries: [Query.equal("$id", ids), Query.limit(100)],
        }),
        sizesByMenu(ids),
    ]);
    const menuById = new Map<string, any>((menuRes.documents as any[]).map((m) => [m.$id, m]));

    const lines: Line[] = [];
    let subtotal = 0;
    let itemCount = 0;

    for (const it of items) {
        const quantity = Number(it?.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new HttpError(400, "Invalid quantity");

        const menu = menuById.get(String(it?.id));
        if (!menu) throw new HttpError(400, "An item in your cart is no longer on the menu. Please remove it and try again.");

        const sizes = sizeMap.get(menu.$id) ?? [];
        const wanted = String(it?.selectedSize || "Regular");
        const match = sizes.find((s) => String(s.label).toLowerCase() === wanted.toLowerCase());

        let price: number;
        let label = wanted;
        if (match) {
            price = Number(match.price);
            label = String(match.label);
        } else if (sizes.length === 0 || wanted.toLowerCase() === "regular") {
            price = Number(menu.price);
        } else {
            throw new HttpError(400, `Size "${wanted}" is not available for ${menu.name}`);
        }

        subtotal += price * quantity;
        itemCount += quantity;
        lines.push({ menuId: menu.$id, menuName: menu.name, selectedSize: label, sizePrice: price, quantity });
    }
    subtotal = r2(subtotal);

    // 2. Opening hours and availability
    const warnings: string[] = [];
    let blocked: string | null = null;
    const status = openStatus(settings);
    if (!status.open) blocked = status.reason;

    // 3. Delivery fee and area
    let deliveryFee = 0;
    let km: number | null = null;
    let drop: { lat: number; lng: number } | null = null;

    if (deliveryType === "pickup") {
        if (!blocked && !settings.pickupEnabled) blocked = "Pick-up isn't available right now.";
    } else {
        if (!blocked && !settings.deliveryEnabled) blocked = "Delivery isn't available right now. You can still collect your order.";

        const address = String(input.address ?? "").trim().slice(0, 300);
        if (!blocked && !address) blocked = "Please enter your delivery address.";

        const lat = Number(input.lat);
        const lng = Number(input.lng);
        if (inSouthAfrica(lat, lng)) drop = { lat, lng };
        else if (address) drop = await geocode(address);

        if (drop) {
            km = round1(distanceKm(RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng, drop.lat, drop.lng));
        } else if (address) {
            warnings.push("We couldn't find this address on the map, so the highest delivery fee applies. Please check it's complete.");
        }

        const f = deliveryFeeFor(settings, km, subtotal);
        if (!f.ok && !blocked) {
            blocked = `Sorry, that address is ${km} km away. We deliver up to ${settings.deliveryRadiusKm} km from the restaurant.`;
        }
        deliveryFee = f.fee;

        if (!blocked && settings.minOrderDelivery > 0 && subtotal < settings.minOrderDelivery) {
            blocked = `The minimum order for delivery is R${settings.minOrderDelivery.toFixed(2)}.`;
        }
    }

    // 4. Promotions: the best single offer for this customer and basket
    const offers = await evaluateOffers(
        { userId: input.userId, subtotal, deliveryFee, deliveryType },
        String(input.promoCode ?? "")
    );
    const discount = offers.applied?.discount ?? 0;

    return {
        lines,
        itemCount,
        subtotal,
        deliveryFee,
        discount,
        total: r2(subtotal + deliveryFee - discount),
        distanceKm: km,
        drop,
        open: status.open,
        warnings,
        blocked,
        prepMinutes: settings.prepMinutes,
        promo: offers.applied
            ? {
                id: offers.applied.promo.id,
                code: offers.applied.promo.code,
                title: offers.applied.promo.title,
                discount,
            }
            : null,
        promoMessage: offers.message,
    };
}