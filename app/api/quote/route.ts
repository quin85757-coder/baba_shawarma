import { NextRequest, NextResponse } from "next/server";
import { fail, getCaller } from "@/lib/server/auth";
import { buildQuote } from "@/lib/server/pricing";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        await getCaller(body.jwt);
        const q = await buildQuote(body);
        return NextResponse.json({ ...q, drop: undefined }); // the app doesn't need the coordinates
    } catch (e) {
        return fail(e);
    }
}