import { NextRequest, NextResponse } from "next/server";
import { fail, getCaller } from "@/lib/server/auth";
import { buildQuote } from "@/lib/server/pricing";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const caller = await getCaller(body.jwt);
        const q = await buildQuote({ ...body, userId: caller.userDoc.$id });
        return NextResponse.json({ ...q, drop: undefined, lines: undefined });
    } catch (e) {
        return fail(e);
    }
}