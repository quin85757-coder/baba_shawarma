import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { fetchAll } from "@/lib/server/fetchAll";

const DAY = 24 * 60 * 60 * 1000;
const SAST = 2 * 60 * 60 * 1000; // South Africa is UTC+2 all year round
const dayKey = (t: number) => new Date(t + SAST).toISOString().slice(0, 10);
const norm = (s: string) => (s === "processing" ? "preparing" : s);
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: NextRequest) {
  try {
    const { jwt } = await req.json();
    const caller = await getCaller(jwt);
    if (!caller.isStaff) throw new HttpError(403, "Staff only");

    const now = Date.now();
    const since = new Date(now - 30 * DAY).toISOString();
    const since7 = new Date(now - 7 * DAY).toISOString();
    const dayOf = (iso: string) => dayKey(new Date(iso).getTime());

    const [orders, items, usersAll, usersNew] = await Promise.all([
      fetchAll(DB.orders, [Query.greaterThanEqual("$createdAt", since), Query.orderDesc("$createdAt")], 1500),
      fetchAll(DB.orderItems, [Query.greaterThanEqual("$createdAt", since), Query.orderDesc("$createdAt")], 4000),
      adminDb.listDocuments({ databaseId: DB.database, collectionId: DB.users, queries: [Query.limit(1)] }),
      adminDb.listDocuments({
        databaseId: DB.database,
        collectionId: DB.users,
        queries: [Query.greaterThanEqual("$createdAt", since7), Query.limit(1)],
      }),
    ]);

    const paid = orders.filter((o) => o.status !== "awaiting_payment");
    const real = paid.filter((o) => o.status !== "cancelled");
    const sum = (list: any[]) => list.reduce((n, o) => n + Number(o.total || 0), 0);

    const today = dayKey(now);
    const todayOrders = real.filter((o) => dayOf(o.$createdAt) === today);

    const days = Array.from({ length: 14 }, (_, i) => {
      const key = dayKey(now - (13 - i) * DAY);
      const list = real.filter((o) => dayOf(o.$createdAt) === key);
      return { date: key, orders: list.length, revenue: r2(sum(list)) };
    });

    const statusCounts: Record<string, number> = {};
    for (const o of paid) {
      const s = norm(o.status);
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    }

    const live = ["pending", "confirmed", "preparing", "on_the_way"];
    const active = real.filter((o) => live.includes(norm(o.status)));
    const needsDriver = active.filter(
      (o) =>
        o.deliveryType === "delivery" &&
        ["confirmed", "preparing"].includes(norm(o.status)) &&
        (!o.dispatchStatus || ["unassigned", "declined"].includes(o.dispatchStatus))
    );

    const realIds = new Set(real.map((o) => o.$id));
    const tally = new Map<string, { qty: number; revenue: number }>();
    for (const i of items) {
      if (!realIds.has(i.orderId)) continue;
      const cur = tally.get(i.menuName) ?? { qty: 0, revenue: 0 };
      cur.qty += Number(i.quantity || 0);
      cur.revenue += Number(i.subtotal || 0);
      tally.set(i.menuName, cur);
    }
    const topItems = [...tally.entries()]
      .map(([name, v]) => ({ name, qty: v.qty, revenue: r2(v.revenue) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);

    return NextResponse.json({
      today: { orders: todayOrders.length, revenue: r2(sum(todayOrders)) },
      active: active.length,
      pending: active.filter((o) => norm(o.status) === "pending").length,
      needsDriver: needsDriver.length,
      last30: {
        orders: real.length,
        revenue: r2(sum(real)),
        avgOrder: real.length ? r2(sum(real) / real.length) : 0,
        delivery: real.filter((o) => o.deliveryType !== "pickup").length,
        pickup: real.filter((o) => o.deliveryType === "pickup").length,
      },
      days,
      statusCounts,
      topItems,
      customers: { total: usersAll.total, new7: usersNew.total },
    });
  } catch (e) {
    return fail(e);
  }
}