import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Trim and cap text that arrives from a client
export const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export interface AppwriteAccount {
  $id: string;
  name: string;
  email: string;
  labels?: string[];
}

// Asks Appwrite who owns this login token. Plain fetch, so the real failure is visible.
export async function verifyJwt(jwt: unknown): Promise<AppwriteAccount> {
  if (typeof jwt !== "string" || !jwt) throw new HttpError(401, "Not signed in");

  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  if (!endpoint || !project) {
    console.error("[auth] NEXT_PUBLIC_APPWRITE_ENDPOINT or PROJECT_ID is missing on the server");
    throw new HttpError(500, "The server is missing its Appwrite settings.");
  }

  let res: Response;
  try {
    res = await fetch(`${endpoint.replace(/\/+$/, "")}/account`, {
      headers: {
        "X-Appwrite-Project": project,
        "X-Appwrite-JWT": jwt,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error("[auth] could not reach Appwrite:", e);
    throw new HttpError(502, "The server couldn't reach the login service. Please try again.");
  }

  if (res.status === 401) {
    console.warn("[auth] Appwrite rejected the login token (401)");
    throw new HttpError(401, "Session expired. Please sign in again.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[auth] Appwrite answered ${res.status}:`, body.slice(0, 300));
    throw new HttpError(502, `The login service answered with an error (${res.status}).`);
  }

  return (await res.json()) as AppwriteAccount;
}

// Finds the profile row for an account (prefers the row that account owns)
export async function findProfile(accountId: string): Promise<any | undefined> {
  const found = await adminDb.listDocuments({
    databaseId: DB.database,
    collectionId: DB.users,
    queries: [Query.equal("accountId", accountId), Query.limit(5)],
  });
  const docs = found.documents as any[];
  return (
      docs.find((d) => (d.$permissions ?? []).some((p: string) => p.includes(`user:${accountId}`))) ??
      docs[0]
  );
}

export const roleFromLabels = (labels: string[]) =>
    labels.includes("admin") ? "admin"
        : labels.includes("staff") ? "staff"
            : labels.includes("driver") ? "driver"
                : "customer";

export interface Caller {
  accountId: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isStaff: boolean;
  userDoc: any;
}

// Roles come from the account LABELS, which users cannot edit.
export async function getCaller(jwt: unknown): Promise<Caller> {
  const acc = await verifyJwt(jwt);
  const userDoc = await findProfile(acc.$id);
  if (!userDoc) throw new HttpError(401, "User profile not found");
  if (userDoc.active === false) {
    throw new HttpError(403, "This account has been disabled. Please contact the restaurant.");
  }

  const labels = acc.labels ?? [];

  // Keep the visible `role` text in step with the labels (the labels are the real authority)
  const role = roleFromLabels(labels);
  if (userDoc.role !== role) {
    try {
      await adminDb.updateDocument({
        databaseId: DB.database,
        collectionId: DB.users,
        documentId: userDoc.$id,
        data: { role },
      });
      userDoc.role = role;
    } catch (e) {
      console.warn("[auth] could not sync the role text:", e);
    }
  }

  return {
    accountId: acc.$id,
    name: acc.name,
    email: acc.email,
    isAdmin: labels.includes("admin"),
    isStaff: labels.includes("staff") || labels.includes("admin"),
    userDoc,
  };
}

export function fail(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}