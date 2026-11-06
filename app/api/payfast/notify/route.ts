import { NextRequest, NextResponse } from "next/server";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { PAYFAST, Pairs, buildQuery, sign } from "@/lib/server/payfast";

// Open https://YOUR-TUNNEL/api/payfast/notify in a browser to test reachability
export async function GET() {
  return new NextResponse("PayFast notify endpoint is reachable.");
}

const reject = (status: number, reason: string) => {
  console.warn(`[ITN] rejected (${status}): ${reason}`);
  return new NextResponse(reason, { status });
};

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  const pairs = [...params.entries()] as Pairs;
  const orderId = params.get("m_payment_id");

  console.log(
    `[ITN] received order=${orderId} status=${params.get("payment_status")} gross=${params.get("amount_gross")}`
  );

  // Check 1: signature must match
  const received = params.get("signature");
  const forSig = pairs.filter(([k]) => k !== "signature");
  if (!received) return reject(400, "No signature");
  if (sign(forSig, PAYFAST.passphrase) !== received) {
    console.warn("[ITN] fields received:", forSig.map(([k]) => k).join(","));
    return reject(400, "Bad signature (does PAYFAST_PASSPHRASE match the PayFast dashboard?)");
  }

  // Check 2: PayFast itself confirms it sent this
  let verdict = "";
  try {
    const validate = await fetch(PAYFAST.validateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildQuery(forSig),
    });
    verdict = (await validate.text()).trim();
  } catch {
    return reject(502, "Could not reach PayFast to validate");
  }
  if (verdict !== "VALID") return reject(400, `PayFast validation said: ${verdict.slice(0, 40)}`);

  if (!orderId) return reject(400, "No order id");

  let order: any;
  try {
    order = await adminDb.getDocument({
      databaseId: DB.database,
      collectionId: DB.orders,
      documentId: orderId,
    });
  } catch {
    return reject(404, "Order not found");
  }

  // Check 3: amount paid must match the order total
  const paid = Number(params.get("amount_gross"));
  if (Math.abs(paid - Number(order.total)) > 0.01) {
    return reject(400, `Amount mismatch: paid ${paid}, order ${order.total}`);
  }

  const payStatus = params.get("payment_status");
  if (payStatus !== "COMPLETE") {
    console.log(`[ITN] payment_status=${payStatus}, nothing to do`);
    return new NextResponse("OK");
  }

  // Mark as paid (only once)
  if (order.status === "awaiting_payment") {
    try {
      await adminDb.updateDocument({
        databaseId: DB.database,
        collectionId: DB.orders,
        documentId: orderId,
        data: { status: "pending" },
      });
      console.log(`[ITN] order ${orderId} marked paid`);
    } catch (e) {
      console.error("[ITN] could not update order:", e);
      return new NextResponse("Update failed", { status: 500 });
    }
  }

  return new NextResponse("OK");
}