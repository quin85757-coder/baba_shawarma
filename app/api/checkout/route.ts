import { NextRequest, NextResponse } from "next/server";
import { ID, Permission, Role, Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";
import { fail, getCaller, HttpError } from "@/lib/server/auth";
import { PAYFAST, Pairs, sign } from "@/lib/server/payfast";
import { geocode, inSouthAfrica } from "@/lib/server/geo";

const DELIVERY_FEE = 50;
const DISCOUNT = 10;
const RESTAURANT_ADDRESS = "175 Steve Biko Rd, Arcadia, Pretoria, 0007";
const SIZE_COLLECTION = "size";

export async function POST(req: NextRequest) {
    try {
            const { jwt, items, deliveryType, address, notes, lat, lng } = await req.json();
        const caller = await getCaller(jwt);

        if (caller.isStaff) {
            throw new HttpError(403, "Staff and admin accounts can't place orders. Please use a customer account.");
        }

        // Validate input
        if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, "Cart is empty");
        if (items.length > 50) throw new HttpError(400, "Too many items");
        if (deliveryType !== "delivery" && deliveryType !== "pickup")
            throw new HttpError(400, "Invalid delivery type");
        const cleanAddress = String(address ?? "").trim().slice(0, 300);
        if (deliveryType === "delivery" && !cleanAddress)
            throw new HttpError(400, "Delivery address required");

        // Where is the drop-off? Use the pin if it looks right, otherwise look the address up.
        let dropLat: number | null = null;
        let dropLng: number | null = null;
        if (deliveryType === "delivery") {
          const pinLat = Number(lat);
          const pinLng = Number(lng);
          if (inSouthAfrica(pinLat, pinLng)) {
            dropLat = pinLat;
            dropLng = pinLng;
          } else {
            const found = await geocode(cleanAddress);
            if (found) {
              dropLat = found.lat;
              dropLng = found.lng;
            }
          }
        }
        // Re-price every item from the database, by size (never trust the client)
        let subtotal = 0;
        let itemCount = 0;
        const lines: {
            menuId: string; menuName: string; selectedSize: string; sizePrice: number; quantity: number;
        }[] = [];

        for (const it of items) {
            const quantity = Number(it.quantity);
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50)
                throw new HttpError(400, "Invalid quantity");

            const menu = await adminDb.getDocument({
                databaseId: DB.database,
                collectionId: DB.menu,
                documentId: String(it.id),
            });

            const sizes = await adminDb.listDocuments({
                databaseId: DB.database,
                collectionId: SIZE_COLLECTION,
                queries: [Query.equal("menu", menu.$id), Query.limit(50)],
            });

            const wanted = String(it.selectedSize || "Regular");
            const match = sizes.documents.find(
                (s: any) => String(s.label).toLowerCase() === wanted.toLowerCase()
            );

            let price: number;
            let sizeLabel = wanted;
            if (match) {
                price = Number(match.price);
                sizeLabel = String(match.label);
            } else if (sizes.documents.length === 0 || wanted.toLowerCase() === "regular") {
                price = Number(menu.price);
            } else {
                throw new HttpError(400, `Size "${wanted}" is not available for ${menu.name}`);
            }

            subtotal += price * quantity;
            itemCount += quantity;
            lines.push({
                menuId: menu.$id,
                menuName: menu.name,
                selectedSize: sizeLabel,
                sizePrice: price,
                quantity,
            });
        }

        const deliveryFee = deliveryType === "delivery" ? DELIVERY_FEE : 0;
        const total = subtotal + deliveryFee - DISCOUNT;
        if (total < 1) throw new HttpError(400, "Invalid total");

        // The customer may READ their own order and its items. Nobody can edit them.
        // (Staff read everything through the table-level "staff" label permission.)
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
                total,
                subtotal,
                deliveryFee,
                discount: DISCOUNT,
                itemCount,
                deliveryAddress: deliveryType === "delivery" ? cleanAddress : RESTAURANT_ADDRESS,
                deliveryType,
                deliveryLat: dropLat,
                deliveryLng: dropLng,
                specialInstructions: String(notes ?? "").slice(0, 300),
            },
            permissions: ownerRead,
        });

        for (const l of lines) {
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
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
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
            ["amount", total.toFixed(2)],
            ["item_name", `Baba Shawarma Order ${orderNumber}`],
        ] as Pairs).filter(([, v]) => v !== "");

        const signature = sign(pairs, PAYFAST.passphrase);

        return NextResponse.json({
            url: PAYFAST.processUrl,
            fields: [...pairs, ["signature", signature]],
        });
    } catch (e) {
        return fail(e);
    }
}