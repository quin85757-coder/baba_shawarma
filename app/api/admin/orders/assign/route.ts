import { NextRequest, NextResponse } from "next/server";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { currentAssignment, DRIVERS } from "@/lib/server/dispatch";
import { logActivity } from "@/lib/server/audit";

export async function POST(req: NextRequest) {
  try {
    const { jwt, orderId, driverId } = await req.json();
    const caller = await getCaller(jwt);
    if (!caller.isStaff) throw new HttpError(403, "Staff only");

    if (typeof orderId !== "string" || typeof driverId !== "string")
      throw new HttpError(400, "Missing details");

    const order: any = await adminDb.getDocument({
      databaseId: DB.database,
      collectionId: DB.orders,
      documentId: orderId,
    });

    if (order.deliveryType !== "delivery")
      throw new HttpError(400, "Only delivery orders need a driver.");

    const status = order.status === "processing" ? "preparing" : order.status;
    if (!["confirmed", "preparing"].includes(status))
      throw new HttpError(409, "Confirm the order first. Drivers can't be assigned after pickup.");

    const ds = order.dispatchStatus || "unassigned";
    if (["accepted", "picked_up", "delivered"].includes(ds))
      throw new HttpError(409, "A driver already has this order.");

    let driver: any;
    try {
      driver = await adminDb.getDocument({
        databaseId: DB.database,
        collectionId: DRIVERS,
        documentId: driverId,
      });
    } catch {
      throw new HttpError(404, "Driver not found.");
    }
    if (driver.active === false) throw new HttpError(409, "That driver is disabled.");
    if (driver.isOnline !== true) throw new HttpError(409, "That driver is offline.");
    if (await currentAssignment(driver.$id, order.$id))
      throw new HttpError(409, "That driver already has an order.");

    await adminDb.updateDocument({
      databaseId: DB.database,
      collectionId: DB.orders,
      documentId: orderId,
      data: {
        driverId: driver.$id,
        driverName: driver.name,
        driverPhone: driver.phone,
        dispatchStatus: "offered",
      },
    });

    await logActivity(caller, "driver_assigned", order.orderNumber ?? orderId, driver.name);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}