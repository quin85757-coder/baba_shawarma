import { NextRequest, NextResponse } from "next/server";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { clean, fail, getCaller, HttpError } from "@/lib/server/auth";

const MAX = { name: 100, phone: 30, address1: 300, address2: 300 };

// Avatars must come from our own Cloudinary account
function validAvatar(v: unknown): string {
  let u: URL;
  try {
    u = new URL(String(v));
  } catch {
    throw new HttpError(400, "Invalid image URL");
  }
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const ok =
      u.protocol === "https:" &&
      u.hostname === "res.cloudinary.com" &&
      (!cloud || u.pathname.startsWith(`/${cloud}/`));
  if (!ok) throw new HttpError(400, "Please upload a picture through the app.");
  return u.toString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const caller = await getCaller(body.jwt);

    // Only these fields can ever change. role, email and accountId cannot.
    const data: Record<string, string | boolean> = {};

    if (body.name !== undefined) {
      const name = clean(body.name, MAX.name);
      if (!name) throw new HttpError(400, "Name can't be empty.");
      data.name = name;
    }
    for (const k of ["phone", "address1", "address2"] as const) {
      if (body[k] !== undefined) data[k] = clean(body[k], MAX[k]);
    }
    if (body.avatar !== undefined) {
      data.avatar = validAvatar(body.avatar);
      data.avatar_public_id = clean(body.avatar_public_id, 200);
    }
    // A customer can only ever mark the welcome as seen, never reset it
    if (body.onboarded === true) data.onboarded = true;

    if (Object.keys(data).length === 0) throw new HttpError(400, "Nothing to update.");

    const user = await adminDb.updateDocument({
      databaseId: DB.database,
      collectionId: DB.users,
      documentId: caller.userDoc.$id,
      data,
    });
    return NextResponse.json({ user });
  } catch (e) {
    return fail(e);
  }
}