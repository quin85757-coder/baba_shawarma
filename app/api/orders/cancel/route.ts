import { NextRequest, NextResponse } from "next/server";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
    try {
        const { jwt, orderId } = await req.json();
        if (typeof orderId !== "string" || !orderId) throw new HttpError(400, "Missing details");

        const caller = await getCaller(jwt);

        let order: any;
        try {
            order = await adminDb.getDocument({
                databaseId: DB.database,
                collectionId: DB.orders,
                documentId: orderId,
            });
        } catch {
            throw new HttpError(404, "Order not found");
        }

        // Only the customer who placed it can cancel
        if (order.userId !== caller.userDoc.$id) throw new HttpError(403, "Not your order");

        // Only pending orders can be cancelled
        if (order.status !== "pending") {
            throw new HttpError(
                409,
                "This order is already being prepared and can no longer be cancelled. Please call the restaurant."
            );
        }

        await adminDb.updateDocument({
            databaseId: DB.database,
            collectionId: DB.orders,
            documentId: orderId,
            data: { status: "cancelled" },
        });

        return NextResponse.json({ ok: true });
    } catch (e) {
        return fail(e);
    }
}