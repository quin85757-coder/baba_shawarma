import { NextResponse } from "next/server";
import { getSettings, openStatus } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export async function GET() {
    const s = await getSettings();
    const st = openStatus(s);
    return NextResponse.json(
        {
            open: st.open,
            reason: st.reason,
            today: st.today,
            banner: s.banner,
            prepMinutes: s.prepMinutes,
            deliveryEnabled: s.deliveryEnabled,
            pickupEnabled: s.pickupEnabled,
            minOrderDelivery: s.minOrderDelivery,
            freeDeliveryOver: s.freeDeliveryOver,
            deliveryRadiusKm: s.deliveryRadiusKm,
            deliveryFeeBands: s.deliveryFeeBands,
        },
        { headers: { "Cache-Control": "public, max-age=30" } }
    );
}