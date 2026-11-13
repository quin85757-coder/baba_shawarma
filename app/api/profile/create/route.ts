import { NextRequest, NextResponse } from "next/server";
import { Permission, Role } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { clean, fail, findProfile, roleFromLabels, verifyJwt } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const acc = await verifyJwt(body.jwt);

    // Already has a profile? Return it.
    const existing = await findProfile(acc.$id);
    if (existing) return NextResponse.json({ user: existing });

    const name = clean(body.name, 100) || clean(acc.name, 100) || "Customer";
    const role = roleFromLabels(acc.labels ?? []);

    try {
      const user = await adminDb.createDocument({
        databaseId: DB.database,
        collectionId: DB.users,
        documentId: acc.$id,
        data: {
          name,
          email: acc.email,
          accountId: acc.$id,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=FE8C00&color=fff`,
          phone: clean(body.phone, 30),
          address1: clean(body.address1, 300),
          address2: clean(body.address2, 300),
          role,
          // Customers see the welcome screens once. Staff and drivers don't need them.
          onboarded: role !== "customer",
        },
        // The owner can READ their row. They cannot edit or delete it.
        permissions: [Permission.read(Role.user(acc.$id))],
      });
      return NextResponse.json({ user });
    } catch (e: any) {
      // Two requests raced: the row now exists, so return it
      if (e?.code === 409) {
        const again = await findProfile(acc.$id);
        if (again) return NextResponse.json({ user: again });
      }
      throw e;
    }
  } catch (e) {
    return fail(e);
  }
}