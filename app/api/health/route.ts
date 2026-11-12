import { NextResponse } from "next/server";
import { Account, Client } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";

export const dynamic = "force-dynamic";

const brief = (e: any) =>
    `${e?.name ?? "Error"} ${e?.code ?? ""} ${String(e?.message ?? e).slice(0, 140)}`.trim();

export async function GET() {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

    const out: Record<string, unknown> = {
        env: {
            endpointHost: endpoint ? endpoint.replace(/^https?:\/\//, "").split("/")[0] : null,
            projectIdSet: Boolean(project),
            apiKeySet: Boolean(process.env.APPWRITE_API_KEY),
            payfastMerchantIdSet: Boolean(process.env.PAYFAST_MERCHANT_ID),
            payfastMerchantKeySet: Boolean(process.env.PAYFAST_MERCHANT_KEY),
            payfastSandbox: process.env.PAYFAST_SANDBOX ?? null,
        },
    };

    // 1. A plain fetch to Appwrite, without the SDK. A 401 here is healthy (no login was sent).
    try {
        const r = await fetch(`${endpoint}/account`, {
            headers: { "X-Appwrite-Project": project ?? "" },
            signal: AbortSignal.timeout(8000),
        });
        out.plainFetch = `reached Appwrite, status ${r.status}`;
    } catch (e) {
        out.plainFetch = `FAILED: ${brief(e)}`;
    }

    // 2. The Appwrite SDK without a login. Appwrite answering 401 is the healthy result.
    try {
        await new Account(new Client().setEndpoint(endpoint!).setProject(project!)).get();
        out.sdk = "unexpected success";
    } catch (e: any) {
        out.sdk = e?.code === 401 ? "OK (Appwrite answered 401 as expected)" : `PROBLEM: ${brief(e)}`;
    }

    // 3. The secret key: read one row
    try {
        await adminDb.listDocuments({ databaseId: DB.database, collectionId: DB.menu, queries: [] });
        out.secretKey = "OK";
    } catch (e) {
        out.secretKey = `PROBLEM: ${brief(e)}`;
    }

    return NextResponse.json(out);
}