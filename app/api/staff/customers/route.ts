import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { fetchAll } from "@/lib/server/fetchAll";

export async function POST(req: NextRequest) {
  try {
    const { jwt } = await req.json();
    const caller = await getCaller(jwt);
    if (!caller.isStaff) throw new HttpError(403, "Staff only");

    const [users, orders] = await Promise.all([
      fetchAll(DB.users, [Query.orderDesc("$createdAt")], 1000),
      fetchAll(DB.orders, [Query.notEqual("status", "awaiting_payment"), Query.orderDesc("$createdAt")], 3000),
    ]);

    // Per customer: orders (not cancelled), money spent, last order
    const stats = new Map<string, { orders: number; spent: number; last: string }>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const s = stats.get(o.userId) ?? { orders: 0, spent: 0, last: "" };
      s.orders += 1;
      s.spent += Number(o.total || 0);
      if (!s.last || o.$createdAt > s.last) s.last = o.$createdAt;
      stats.set(o.userId, s);
    }

    const customers = users
      .filter((u) => !["staff", "admin", "driver"].includes(String(u.role ?? "customer")))
      .map((u) => {
        const s = stats.get(u.$id);
        return {
          id: u.$id,
          name: u.name ?? "",
          email: u.email ?? "",
          phone: u.phone ?? "",
          address: u.address1 ?? "",
          joined: u.$createdAt,
          orders: s?.orders ?? 0,
          spent: Math.round((s?.spent ?? 0) * 100) / 100,
          lastOrder: s?.last ?? "",
        };
      })
      .sort((a, b) => (b.lastOrder || b.joined).localeCompare(a.lastOrder || a.joined))
      .slice(0, 300);

    return NextResponse.json({ customers });
  } catch (e) {
    return fail(e);
  }
}