import { Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { HttpError, verifyJwt } from "@/lib/server/auth";

export const DRIVERS = "drivers";
export const ACTIVE_DISPATCH = ["offered", "accepted", "picked_up"];
export const LIVE_ORDER = ["confirmed", "preparing", "on_the_way"];

// Verifies the caller is a driver (account label "driver") with an active driver row.
// The driver row's ID is the driver's Appwrite account ID.
export async function getDriver(jwt: unknown) {
  const acc = await verifyJwt(jwt);
  if (!(acc.labels ?? []).includes("driver")) throw new HttpError(403, "Drivers only");

  try {
    const driver: any = await adminDb.getDocument({
      databaseId: DB.database,
      collectionId: DRIVERS,
      documentId: acc.$id,
    });
    if (driver.active === false) throw new HttpError(403, "This driver account is disabled.");
    return { acc, driver };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "No driver profile found for this account.");
  }
}

// The live order currently assigned to a driver (offered, accepted or picked up)
export async function currentAssignment(driverId: string, exceptOrderId?: string): Promise<any | null> {
  const res = await adminDb.listDocuments({
    databaseId: DB.database,
    collectionId: DB.orders,
    queries: [
      Query.equal("driverId", driverId),
      Query.equal("dispatchStatus", ACTIVE_DISPATCH),
      Query.equal("status", LIVE_ORDER),
      Query.limit(5),
    ],
  });
  const docs = (res.documents as any[]).filter((o) => o.$id !== exceptOrderId);
  return docs[0] ?? null;
}