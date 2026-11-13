import { NextResponse } from "next/server";
import { liveNow, listPromos, publicPromo } from "@/lib/server/promos";

export const dynamic = "force-dynamic";

export async function GET() {
    const live = liveNow(await listPromos());
    const welcome = live.find((p) => p.auto && p.firstOrderOnly && !p.code);
    return NextResponse.json(
        {
            banners: live.filter((p) => p.showBanner).map(publicPromo),
            welcome: welcome ? publicPromo(welcome) : null,
        },
        { headers: { "Cache-Control": "public, max-age=60" } }
    );
}