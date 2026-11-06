import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { ACTIVITY } from "@/lib/server/audit";

export async function POST(req: NextRequest) {
  try {
    const { jwt } = await req.json();
    const caller = await getCaller(jwt);
    if (!caller.isAdmin) throw new HttpError(403, "Admins only");

    const res = await adminDb.listDocuments({
      databaseId: DB.database,
      collectionId: ACTIVITY,
      queries: [Query.orderDesc("$createdAt"), Query.limit(100)],
    });

    return NextResponse.json({
      entries: (res.documents as any[]).map((d) => ({
        id: d.$id,
        at: d.$createdAt,
        actor: d.actorName,
        role: d.actorRole,
        action: d.action,
        target: d.target,
        detail: d.detail,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}