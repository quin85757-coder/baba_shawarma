import { NextRequest, NextResponse } from "next/server";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { logActivity } from "@/lib/server/audit";

// The only steps an order can move through, in order
const FLOW_DELIVERY = ["pending", "confirmed", "preparing", "on_the_way", "delivered"];
const FLOW_PICKUP = ["pending", "confirmed", "preparing", "on_the_way", "collected"];
const FINAL = ["delivered", "collected", "cancelled"];

export async function POST(req: NextRequest) {
    try {
        const { jwt, orderId, status } = await req.json();

        const caller = await getCaller(jwt);
        if (!caller.isStaff) throw new HttpError(403, "Staff only");

        if (typeof orderId !== "string" || typeof status !== "string")
            throw new HttpError(400, "Missing details");

        const order: any = await adminDb.getDocument({
            databaseId: DB.database,
            collectionId: DB.orders,
            documentId: orderId,
        });

        // Old orders may still say "processing"
        const current = order.status === "processing" ? "preparing" : String(order.status);

        if (current === "awaiting_payment") throw new HttpError(409, "This order hasn't been paid yet.");
        if (FINAL.includes(current)) throw new HttpError(409, "This order is already finished.");

        if (status !== "cancelled") {
            const flow = order.deliveryType === "pickup" ? FLOW_PICKUP : FLOW_DELIVERY;
            const to = flow.indexOf(status);
            const from = flow.indexOf(current);
            if (to === -1) throw new HttpError(400, `"${status}" isn't a valid step for this order.`);
            if (to <= from) throw new HttpError(409, "Orders can only move forward.");
        }

        await adminDb.updateDocument({
            databaseId: DB.database,
            collectionId: DB.orders,
            documentId: orderId,
            data: { status },
        });

        await logActivity(
          caller,
          status === "cancelled" ? "order_cancelled" : "order_status",
          order.orderNumber ?? orderId,
          `${current} → ${status}`
        );

        return NextResponse.json({ ok: true, status });
    } catch (e) {
        return fail(e);
    }
}