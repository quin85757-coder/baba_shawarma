import { NextRequest, NextResponse } from "next/server";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { logActivity } from "@/lib/server/audit";
import { DRIVERS } from "@/lib/server/dispatch";

async function load(collectionId: string, documentId: string) {
  try {
    return (await adminDb.getDocument({ databaseId: DB.database, collectionId, documentId })) as any;
  } catch {
    throw new HttpError(404, "Not found");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { jwt, kind, id, active } = await req.json();
    const caller = await getCaller(jwt);
    if (!caller.isAdmin) throw new HttpError(403, "Admins only");
    if (typeof id !== "string" || typeof active !== "boolean") throw new HttpError(400, "Missing details");

    let name = "";
    let detail = "";

    if (kind === "driver") {
      const d = await load(DRIVERS, id);
      await adminDb.updateDocument({
        databaseId: DB.database,
        collectionId: DRIVERS,
        documentId: id,
        data: active ? { active: true } : { active: false, isOnline: false },
      });
      name = d.name;
      detail = "driver";
    } else if (kind === "user") {
      if (id === caller.userDoc.$id) throw new HttpError(400, "You can't disable your own account.");
      const u = await load(DB.users, id);
      if (String(u.role) === "admin")
        throw new HttpError(403, "Admin accounts can only be changed in the Console.");
      await adminDb.updateDocument({
        databaseId: DB.database,
        collectionId: DB.users,
        documentId: id,
        data: { active },
      });
      name = u.name || u.email;
      detail = String(u.role ?? "customer");
    } else {
      throw new HttpError(400, "Unknown account type");
    }

    await logActivity(caller, active ? "account_enabled" : "account_disabled", name, detail);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}