import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { DRIVERS } from "@/lib/server/dispatch";
import { fetchAll } from "@/lib/server/fetchAll";

const DAY = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { jwt } = await req.json();
    const caller = await getCaller(jwt);
    if (!caller.isAdmin) throw new HttpError(403, "Admins only");

    const [users, drivers, orders] = await Promise.all([
      fetchAll(DB.users, [Query.orderDesc("$createdAt")], 1000),
      fetchAll(DRIVERS, [], 200),
      fetchAll(DB.orders, [Query.notEqual("status", "awaiting_payment"), Query.orderDesc("$createdAt")], 3000),
    ]);

    const since = Date.now() - 30 * DAY;
    const spent = new Map<string, { orders: number; spent: number }>();
    const delivered = new Map<string, number>();

    for (const o of orders) {
      if (o.status !== "cancelled") {
        const s = spent.get(o.userId) ?? { orders: 0, spent: 0 };
        s.orders += 1;
        s.spent += Number(o.total || 0);
        spent.set(o.userId, s);
      }
      if (o.dispatchStatus === "delivered" && o.driverId && new Date(o.$createdAt).getTime() >= since) {
        delivered.set(o.driverId, (delivered.get(o.driverId) ?? 0) + 1);
      }
    }

    const role = (u: any) => String(u.role ?? "customer");
    const person = (u: any) => ({
      id: u.$id,
      name: u.name ?? "",
      email: u.email ?? "",
      phone: u.phone ?? "",
      role: role(u),
      active: u.active !== false,
      joined: u.$createdAt,
    });

    return NextResponse.json({
      self: caller.userDoc.$id,
      staff: users.filter((u) => ["staff", "admin"].includes(role(u))).map(person),
      drivers: drivers.map((d) => ({
        id: d.$id,
        name: d.name,
        phone: d.phone,
        vehicle: d.vehicle ?? "",
        active: d.active !== false,
        isOnline: d.isOnline === true,
        lastSeen: d.$updatedAt,
        delivered30: delivered.get(d.$id) ?? 0,
      })),
      customers: users
        .filter((u) => !["staff", "admin", "driver"].includes(role(u)))
        .slice(0, 300)
        .map((u) => ({
          ...person(u),
          orders: spent.get(u.$id)?.orders ?? 0,
          spent: Math.round((spent.get(u.$id)?.spent ?? 0) * 100) / 100,
        })),
    });
  } catch (e) {
    return fail(e);
  }
}