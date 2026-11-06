import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { fetchAll } from "@/lib/server/fetchAll";

export async function POST(req: NextRequest) {
  try {
    const { jwt } = await req.json();
    const caller = await getCaller(jwt);
    if (!caller.isStaff) throw new HttpError(403, "Staff only");

    const res = await adminDb.listDocuments({
      databaseId: DB.database,
      collectionId: DB.orders,
      queries: [Query.notEqual("status", "awaiting_payment"), Query.orderDesc("$createdAt"), Query.limit(100)],
    });
    const docs = res.documents as any[];
    const orderIds = docs.map((o) => o.$id);
    const userIds = [...new Set(docs.map((o) => o.userId).filter(Boolean))] as string[];

    const [items, customers] = await Promise.all([
      orderIds.length ? fetchAll(DB.orderItems, [Query.equal("orderId", orderIds)], 2000) : [],
      userIds.length
        ? adminDb.listDocuments({
            databaseId: DB.database,
            collectionId: DB.users,
            queries: [Query.equal("$id", userIds), Query.limit(100)],
          })
        : { documents: [] as any[] },
    ]);

    const byOrder = new Map<string, any[]>();
    for (const i of items) {
      const list = byOrder.get(i.orderId) ?? [];
      list.push({ name: i.menuName, size: i.selectedSize, quantity: i.quantity });
      byOrder.set(i.orderId, list);
    }
    const byUser = new Map<string, any>((customers.documents as any[]).map((u) => [u.$id, u]));

    return NextResponse.json({
      orders: docs.map((o) => ({
        id: o.$id,
        orderNumber: o.orderNumber ?? o.$id,
        status: o.status,
        deliveryType: o.deliveryType ?? "delivery",
        total: o.total,
        itemCount: o.itemCount,
        deliveryAddress: o.deliveryAddress ?? "",
        specialInstructions: o.specialInstructions ?? "",
        createdAt: o.$createdAt,
        dispatchStatus: o.dispatchStatus ?? "unassigned",
        driverName: o.driverName ?? "",
        driverPhone: o.driverPhone ?? "",
        customerName: byUser.get(o.userId)?.name ?? "Customer",
        customerPhone: byUser.get(o.userId)?.phone ?? "",
        items: byOrder.get(o.$id) ?? [],
      })),
    });
  } catch (e) {
    return fail(e);
  }
}