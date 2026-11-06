import { ID } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import type { Caller } from "@/lib/server/auth";

export const ACTIVITY = "activity";

// Best effort: a logging problem must never block the real action
export async function logActivity(
  caller: Pick<Caller, "accountId" | "name" | "isAdmin">,
  action: string,
  target: string,
  detail = ""
) {
  try {
    await adminDb.createDocument({
      databaseId: DB.database,
      collectionId: ACTIVITY,
      documentId: ID.unique(),
      data: {
        actorId: caller.accountId,
        actorName: String(caller.name ?? "").slice(0, 100),
        actorRole: caller.isAdmin ? "admin" : "staff",
        action: action.slice(0, 60),
        target: String(target ?? "").slice(0, 100),
        detail: String(detail ?? "").slice(0, 500),
      },
      permissions: [],
    });
  } catch (e) {
    console.warn("[audit] could not write log entry:", e);
  }
}