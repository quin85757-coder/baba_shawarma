import { NextRequest, NextResponse } from "next/server";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { logActivity } from "@/lib/server/audit";
import { SETTINGS_ID, SETTINGS_TABLE, getSettings, validateSettings } from "@/lib/server/settings";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const caller = await getCaller(body.jwt);
        if (!caller.isAdmin) throw new HttpError(403, "Admins only");

        // No settings sent: just return the current ones
        if (!body.settings) return NextResponse.json({ settings: await getSettings() });

        const s = validateSettings(body.settings);
        const data = {
            isOpen: s.isOpen,
            closedMessage: s.closedMessage,
            banner: s.banner,
            prepMinutes: s.prepMinutes,
            deliveryEnabled: s.deliveryEnabled,
            pickupEnabled: s.pickupEnabled,
            deliveryRadiusKm: s.deliveryRadiusKm,
            deliveryFeeBands: JSON.stringify(s.deliveryFeeBands),
            freeDeliveryOver: s.freeDeliveryOver,
            minOrderDelivery: s.minOrderDelivery,
            hours: JSON.stringify(s.hours),
        };

        try {
            await adminDb.updateDocument({
                databaseId: DB.database,
                collectionId: SETTINGS_TABLE,
                documentId: SETTINGS_ID,
                data,
            });
        } catch (e: any) {
            if (e?.code !== 404) throw e;
            await adminDb.createDocument({
                databaseId: DB.database,
                collectionId: SETTINGS_TABLE,
                documentId: SETTINGS_ID,
                data,
                permissions: [],
            });
        }

        await logActivity(caller, "settings_updated", "Restaurant settings", s.isOpen ? "orders on" : "orders paused");
        return NextResponse.json({ settings: s });
    } catch (e) {
        return fail(e);
    }
}