import { NextResponse } from "next/server";
import { Account, Client, Query } from "node-appwrite";
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

// Verifies the caller's Appwrite JWT with Appwrite itself
export async function verifyJwt(jwt: unknown) {
  if (typeof jwt !== "string" || !jwt) throw new HttpError(401, "Not signed in");

  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);

  try {
    return await new Account(client).get();
  } catch {
    throw new HttpError(401, "Session expired. Please sign in again.");
  }
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

export interface Caller {
  accountId: string;
  name: string;
  email: string;
  isStaff: boolean;
  userDoc: any;
  isAdmin: boolean;
}

// Staff status comes from the account LABEL "staff", which users cannot edit.
export async function getCaller(jwt: unknown): Promise<Caller> {
  const acc = await verifyJwt(jwt);
  const userDoc = await findProfile(acc.$id);
  if (!userDoc) throw new HttpError(401, "User profile not found");

  if (userDoc.active === false) {
    throw new HttpError(403, "This account has been disabled. Please contact the restaurant.");
  }

  const labels: string[] = acc.labels ?? [];
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