import { NextRequest, NextResponse } from "next/server";
import { ID, Permission, Role } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { RESTAURANT_COORDS } from "@/lib/server/geo";
import { PAYFAST, Pairs, sign } from "@/lib/server/payfast";
import { buildQuote } from "@/lib/server/pricing";

export async function POST(req: NextRequest) {
    try {
        const { jwt, items, deliveryType, address, notes, lat, lng } = await req.json();
        const caller = await getCaller(jwt);
        if (caller.isStaff) {
            throw new HttpError(403, "Staff and admin accounts can't place orders. Please use a customer account.");
        }

        // The same function the checkout screen used to show the price
        const q = await buildQuote({ items, deliveryType, address, lat, lng });
        if (q.blocked) throw new HttpError(409, q.blocked);
        if (q.total < 1) throw new HttpError(400, "Invalid total");

        // The customer may READ their own order. Nobody can edit it.
        const ownerRead = [Permission.read(Role.user(caller.accountId))];

        const orderNumber = `#ORD${Date.now().toString().slice(-6)}`;
        const order = await adminDb.createDocument({
            databaseId: DB.database,
            collectionId: DB.orders,
            documentId: ID.unique(),
            data: {
                userId: caller.userDoc.$id,
                orderNumber,
                status: "awaiting_payment",
                total: q.total,
                subtotal: q.subtotal,
                deliveryFee: q.deliveryFee,
                discount: q.discount,
                itemCount: q.itemCount,
                deliveryAddress:
                    deliveryType === "delivery" ? String(address ?? "").trim().slice(0, 300) : RESTAURANT_COORDS.address,
                deliveryType,
                deliveryLat: q.drop?.lat ?? null,
                deliveryLng: q.drop?.lng ?? null,
                specialInstructions: String(notes ?? "").slice(0, 300),
            },
            permissions: ownerRead,
        });

        for (const l of q.lines) {
            await adminDb.createDocument({
                databaseId: DB.database,
                collectionId: DB.orderItems,
                documentId: ID.unique(),
                data: {
                    orderId: order.$id,
                    menuId: l.menuId,
                    menuName: l.menuName,
                    selectedSize: l.selectedSize,
                    sizePrice: l.sizePrice,
                    quantity: l.quantity,
                    customizations: "",
                    subtotal: l.sizePrice * l.quantity,
                },
                permissions: ownerRead,
            });
        }

        // Build the signed PayFast form
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
        const notifyBase = process.env.PAYFAST_NOTIFY_BASE_URL || siteUrl;

        const pairs: Pairs = ([
            ["merchant_id", PAYFAST.merchantId],
            ["merchant_key", PAYFAST.merchantKey],
            ["return_url", `${siteUrl}/checkout/success?order=${order.$id}`],
            ["cancel_url", `${siteUrl}/checkout`],
            ["notify_url", `${notifyBase}/api/payfast/notify`],
            ["name_first", (caller.name ?? "Customer").split(" ")[0]],
            ["email_address", caller.email],
            ["m_payment_id", order.$id],
            ["amount", q.total.toFixed(2)],
            ["item_name", `Baba Shawarma Order ${orderNumber}`],
        ] as Pairs).filter(([, v]) => v !== "");

        return NextResponse.json({
            url: PAYFAST.processUrl,
            fields: [...pairs, ["signature", sign(pairs, PAYFAST.passphrase)]],
        });
    } catch (e) {
        return fail(e);
    }
}