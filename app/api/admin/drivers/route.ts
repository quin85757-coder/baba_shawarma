import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { ACTIVE_DISPATCH, DRIVERS, LIVE_ORDER } from "@/lib/server/dispatch";
import { RESTAURANT_COORDS, distanceKm, round1 } from "@/lib/server/geo";

const STALE_SECONDS = 120;

export async function POST(req: NextRequest) {
  try {
    const { jwt } = await req.json();
    const caller = await getCaller(jwt);
    if (!caller.isStaff) throw new HttpError(403, "Staff only");

    const [driversRes, busyRes] = await Promise.all([
      adminDb.listDocuments({
        databaseId: DB.database,
        collectionId: DRIVERS,
        queries: [Query.limit(100)],
      }),
      adminDb.listDocuments({
        databaseId: DB.database,
        collectionId: DB.orders,
        queries: [
          Query.equal("dispatchStatus", ACTIVE_DISPATCH),
          Query.equal("status", LIVE_ORDER),
          Query.limit(100),
        ],
      }),
    ]);

    const busyWith = new Map<string, string>();
    for (const o of busyRes.documents as any[]) {
      if (o.driverId) busyWith.set(o.driverId, o.orderNumber ?? o.$id);
    }

    const now = Date.now();
    const rows = (driversRes.documents as any[])
      .filter((d) => d.active !== false)
      .map((d) => {
        const hasPos = Number.isFinite(d.lat) && Number.isFinite(d.lng);
        // The row's last-updated time is the driver's last ping
        const lastSeenSec = Math.max(0, Math.round((now - new Date(d.$updatedAt).getTime()) / 1000));
        return {
          id: d.$id as string,
          name: d.name as string,
          phone: d.phone as string,
          vehicle: (d.vehicle ?? "") as string,
          isOnline: d.isOnline === true,
          busy: busyWith.has(d.$id),
          busyWith: busyWith.get(d.$id) ?? null,
          distanceKm: hasPos
            ? round1(distanceKm(RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng, d.lat, d.lng))
            : null,
          lastSeenSec,
          stale: lastSeenSec > STALE_SECONDS,
        };
      });

    type Row = (typeof rows)[number];
    const rank = (r: Row) => (r.isOnline ? (r.busy ? 1 : 0) : 2);
    rows.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(a.stale) - Number(b.stale) ||
        (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)
    );

    return NextResponse.json({ drivers: rows });
  } catch (e) {
    return fail(e);
  }
}