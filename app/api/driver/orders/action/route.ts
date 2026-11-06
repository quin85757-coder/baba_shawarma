import { NextRequest, NextResponse } from "next/server";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, HttpError } from "@/lib/server/auth";
import { getDriver, LIVE_ORDER } from "@/lib/server/dispatch";

export async function POST(req: NextRequest) {
  try {
    const { jwt, orderId, action } = await req.json();
    const { driver } = await getDriver(jwt);

    if (typeof orderId !== "string") throw new HttpError(400, "Missing order");

    const order: any = await adminDb.getDocument({
      databaseId: DB.database,
      collectionId: DB.orders,
      documentId: orderId,
    });

    if (order.driverId !== driver.$id) throw new HttpError(403, "This order isn't assigned to you.");
    if (!LIVE_ORDER.includes(order.status)) throw new HttpError(409, "This order is no longer active.");

    const ds = order.dispatchStatus || "unassigned";
    let data: Record<string, string>;

    switch (action) {
      case "accept":
        if (ds !== "offered") throw new HttpError(409, "This offer is no longer available.");
        data = { dispatchStatus: "accepted" };
        break;
      case "decline":
        if (ds !== "offered") throw new HttpError(409, "This offer is no longer available.");
        data = { dispatchStatus: "declined" };
        break;
      case "pickup":
        if (ds !== "accepted") throw new HttpError(409, "Accept the order first.");
        data = { dispatchStatus: "picked_up", status: "on_the_way" };
        break;
      case "deliver":
        if (ds !== "picked_up") throw new HttpError(409, "Pick the order up first.");
        data = { dispatchStatus: "delivered", status: "delivered" };
        break;
      default:
        throw new HttpError(400, "Unknown action");
    }

    await adminDb.updateDocument({
      databaseId: DB.database,
      collectionId: DB.orders,
      documentId: orderId,
      data,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}