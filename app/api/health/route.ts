import { NextResponse } from "next/server";
import { adminDb, DB } from "@/lib/server/appwrite-admin";

export const dynamic = "force-dynamic";

export async function GET() {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const out: Record<string, unknown> = {};

    try {
        const r = await fetch(`${endpoint}/account`, {
            headers: { "X-Appwrite-Project": project ?? "" },
            signal: AbortSignal.timeout(8000),
        });
        out.plainFetch = `reached Appwrite, status ${r.status}`;
    } catch (e: any) {
        out.plainFetch = `FAILED: ${String(e?.message ?? e).slice(0, 140)}`;
    }

    try {
        const res = await adminDb.listDocuments({ databaseId: DB.database, collectionId: DB.menu, queries: [] });
        out.secretKey = `OK (${res.total} menu items)`;
    } catch (e: any) {
        out.secretKey = `PROBLEM: ${e?.code ?? ""} ${String(e?.message ?? e).slice(0, 140)}`;
    }

    return NextResponse.json(out);
}