import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail } from "@/lib/server/auth";
import { currentAssignment, DRIVERS, getDriver } from "@/lib/server/dispatch";
import { RESTAURANT_COORDS, distanceKm, inSouthAfrica, round1 } from "@/lib/server/geo";

async function shapeOrder(o: any) {
  const [items, customer] = await Promise.all([
    adminDb.listDocuments({
      databaseId: DB.database,
      collectionId: DB.orderItems,
      queries: [Query.equal("orderId", o.$id), Query.limit(50)],
    }),
    adminDb
      .getDocument({ databaseId: DB.database, collectionId: DB.users, documentId: o.userId })
      .catch(() => null),
  ]);

  const hasDrop = Number.isFinite(o.deliveryLat) && Number.isFinite(o.deliveryLng);
  const accepted = o.dispatchStatus !== "offered";

  return {
    id: o.$id,
    orderNumber: o.orderNumber ?? o.$id,
    dispatchStatus: o.dispatchStatus,
    deliveryAddress: o.deliveryAddress ?? "",
    deliveryLat: hasDrop ? o.deliveryLat : null,
    deliveryLng: hasDrop ? o.deliveryLng : null,
    specialInstructions: o.specialInstructions ?? "",
    customerName: (customer as any)?.name ?? "Customer",
    // The customer's phone number is only shared once the driver accepts
    customerPhone: accepted ? (customer as any)?.phone ?? "" : "",
    items: (items.documents as any[]).map((i) => ({
      name: i.menuName,
      size: i.selectedSize,
      quantity: i.quantity,
    })),
    pickup: RESTAURANT_COORDS,
    tripKm: hasDrop
      ? round1(distanceKm(RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng, o.deliveryLat, o.deliveryLng))
      : null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { driver } = await getDriver(body.jwt);
    const assignment = await currentAssignment(driver.$id);

    const data: Record<string, unknown> = {};

    // A driver can't go offline in the middle of a delivery
    if (typeof body.online === "boolean") data.isOnline = assignment ? true : body.online;

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (inSouthAfrica(lat, lng)) {
      data.lat = lat;
      data.lng = lng;
    }

    const updated: any =
      Object.keys(data).length > 0
        ? await adminDb.updateDocument({
            databaseId: DB.database,
            collectionId: DRIVERS,
            documentId: driver.$id,
            data,
          })
        : driver;

    return NextResponse.json({
      driver: { id: updated.$id, name: updated.name, isOnline: updated.isOnline === true },
      order: assignment ? await shapeOrder(assignment) : null,
    });
  } catch (e) {
    return fail(e);
  }
}