import { NextRequest, NextResponse } from "next/server";
import { Account, Client, Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";

export async function POST(req: NextRequest) {
    try {
        const { jwt, orderId } = await req.json();
        if (!jwt || !orderId) {
            return NextResponse.json({ error: "Missing details" }, { status: 400 });
        }

        // Who is asking? Verify with Appwrite
        const userClient = new Client()
            .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
            .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
            .setJWT(jwt);
        const acc = await new Account(userClient).get();

        const found = await adminDb.listDocuments({
            databaseId: DB.database,
            collectionId: DB.users,
            queries: [Query.equal("accountId", acc.$id)],
        });
        const userDoc = found.documents[0];
        if (!userDoc) return NextResponse.json({ error: "User not found" }, { status: 401 });

        // Does this order belong to them?
        const order: any = await adminDb.getDocument({
            databaseId: DB.database,
            collectionId: DB.orders,
            documentId: String(orderId),
        });
        if (order.userId !== userDoc.$id) {
            return NextResponse.json({ error: "Not your order" }, { status: 403 });
        }

        // Only pending orders can be cancelled
        if (order.status !== "pending") {
            return NextResponse.json(
                { error: "This order is already being prepared and can no longer be cancelled. Please call the restaurant." },
                { status: 409 }
            );
        }

        await adminDb.updateDocument({
            databaseId: DB.database,
            collectionId: DB.orders,
            documentId: order.$id,
            data: { status: "cancelled" },
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("cancel error:", e);
        return NextResponse.json({ error: e?.message ?? "Could not cancel" }, { status: 500 });
    }
}