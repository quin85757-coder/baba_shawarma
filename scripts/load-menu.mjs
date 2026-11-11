import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline/promises";
import { Client, Databases, ID, Query } from "node-appwrite";

// ─── Options ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const WIPE_OLD = args.includes("--wipe-old");
const dirAt = args.indexOf("--images");
const IMAGE_DIR = dirAt >= 0 ? args[dirAt + 1] : null;

const DATABASE_ID = "699faaaa00273107e6fa";
const IMAGE_WIDTH = 900; // pixels. Cloudinary shrinks each picture to this width on delivery
const CACHE_FILE = path.join("scripts", "menu-images.json");
const env = process.env;

for (const k of [
    "NEXT_PUBLIC_APPWRITE_ENDPOINT",
    "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
    "APPWRITE_ADMIN_KEY",
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
    "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET",
]) {
    if (!env[k]) {
        console.error(`Missing ${k} in .env.local`);
        process.exit(1);
    }
}
if (!IMAGE_DIR || !fs.existsSync(IMAGE_DIR)) {
    console.error('Usage: node --env-file=.env.local scripts/load-menu.mjs --images "C:\\path\\to\\pictures" [--apply] [--wipe-old]');
    process.exit(1);
}

// ─── THE MENU (edit prices, names and sizes here) ─────────────────────────────
const SHAWARMA_NOTE =
    "Wrap: salad, chips and sauce. Laffa Wrap: salad and sauce in soft laffa bread. Meal: adds a drink. Platter: salad, chips, sauce and bread.";
const GRILL_NOTE = "Served with salad, chips, sauce and bread.";
const shawarma = (wrap, laffa, meal, platter) => [
    ["Wrap", wrap],
    ["Laffa Wrap", laffa],
    ["Meal", meal],
    ["Platter", platter],
];
const KEBAB_SIZES = [["Plain (150g meat only)", 50], ["Laffa Wrap", 80], ["Meal", 150]];
const JUICE = (a, b, c) => [["350ml", a], ["500ml", b], ["1L", c]];
const SHAKE = [["350ml", 35], ["500ml", 45]];

// Existing Cloudinary uploads from the old app. Placeholders until real drink photos exist.
const CLD = "https://res.cloudinary.com/ddzf7aoym/image/upload";
const OLD = {
    avocado: `${CLD}/v1772077367/restaurant-menu/juice_avocado.png`,
    strawberry: `${CLD}/v1772077375/restaurant-menu/juice_strawberry.png`,
    orange: `${CLD}/v1772077384/restaurant-menu/juice_orange.png`,
    vanilla: `${CLD}/v1772077387/restaurant-menu/drink_1.gif`,
    chocolate: `${CLD}/v1772077402/restaurant-menu/drink_2.gif`,
    oreo: `${CLD}/v1772077413/restaurant-menu/drink_3.gif`,
    strawberryShake: `${CLD}/v1772077422/restaurant-menu/drink_4.gif`,
    mangoShake: `${CLD}/v1772077430/restaurant-menu/drink_5.gif`,
};

// Items use either image (a local file name) or url (a picture that is already on Cloudinary)
const MENU = [
    {
        category: "Shawarma",
        description: "Spit-roasted beef and chicken, wrapped fresh to order.",
        items: [
            {
                name: "Beef Shawarma",
                image: "Beef_Shawarma",
                description: `Slow-roasted beef, carved thin and wrapped with fresh salad and signature sauce. ${SHAWARMA_NOTE}`,
                sizes: shawarma(55, 80, 140, 145),
            },
            {
                name: "Mexican Beef Shawarma",
                image: "Mexican_Beef_Shawarma",
                description: `Juicy shaved beef in bold Mexican-style spices, with salad and sauce. ${SHAWARMA_NOTE}`,
                sizes: shawarma(60, 85, 150, 155),
            },
            {
                name: "Chicken Shawarma",
                image: "Chicken Shawarma",
                description: `Tender spit-roasted chicken, shaved fresh and rolled with crisp salad and creamy garlic sauce. ${SHAWARMA_NOTE}`,
                sizes: shawarma(45, 70, 130, 135),
            },
            {
                name: "Mexican Chicken Shawarma",
                image: "Mexican_Chicken_Shawarma",
                description: `Chicken shawarma with a spicy Mexican-style kick, wrapped with salad and sauce. ${SHAWARMA_NOTE}`,
                sizes: shawarma(50, 75, 130, 145), // CONFIRM: the old menu had the Meal at 140
            },
        ],
    },
    {
        category: "Kebabs",
        description: "Flame-grilled minced meat skewers.",
        items: [
            {
                name: "Shish Kebab",
                image: "Shish_Kebab",
                description: "Marinated minced meat skewers, flame-grilled and juicy.",
                sizes: KEBAB_SIZES,
            },
            {
                name: "Spicy Shish Kebab",
                image: "Spicy_Shish_Kebab",
                description: "Our shish kebab with an extra spicy marinade.",
                sizes: KEBAB_SIZES,
            },
            // Shish Taouk has a picture (Shish_Taouk.PNG). The old menu priced it Plain 45 / Laffa Wrap 75 / Meal 140.
        ],
    },
    {
        category: "Grilled Chicken",
        description: "Flame-grilled chicken with salad, chips, sauce and bread.",
        items: [
            {
                name: "Full Chicken",
                image: "Full_Chicken",
                description: `A whole flame-grilled chicken, perfect for sharing. ${GRILL_NOTE}`,
                sizes: [["Full", 160]],
            },
            {
                name: "Half Chicken",
                image: "Half_Chicken",
                description: `Half a chicken, grilled and juicy. ${GRILL_NOTE}`,
                sizes: [["Half", 85]],
            },
            {
                name: "Quarter Chicken",
                image: "Quarter_Chicken",
                description: `A quarter portion, with a choice of leg or breast. ${GRILL_NOTE}`,
                sizes: [["Leg", 45], ["Breast", 50]],
            },
        ],
    },
    {
        category: "Family Meals",
        description: "Big sharing meals for the whole family.",
        items: [
            {
                name: "Shawarma Family Meal",
                image: "Shawarma_Family_Meal",
                description: "4 wraps, 4 laffa wraps, large chips, sauce, salad and a 2L cold drink. Serves 5–7.",
                sizes: [["Family", 550]],
            },
            {
                name: "Mix Grill Family Meal",
                image: "Mix_Grill_Family_Meal",
                description: "2 shish kebab, 2 spicy shish kebab, 2 shish taouk, ½ chicken and 1 T-bone steak. Serves 5–7.",
                sizes: [["Family", 550]],
            },
        ],
    },
    {
        category: "Vegetarian",
        description: "Crispy chickpea falafel.",
        items: [
            {
                name: "Falafel",
                image: "Vegetarian",
                description:
                    "Crispy chickpea falafel with fresh salad and sauce, served as a wrap, in laffa bread, or as a platter with chips and bread.",
                sizes: [["Wrap", 45], ["Laffa Wrap", 60], ["Platter", 100]],
            },
            {
                name: "Falafel Pieces",
                image: "Vegetarian",
                description: "Golden, crunchy falafel balls, herby and soft inside.",
                sizes: [["Each", 7], ["Dozen", 75]],
            },
        ],
    },
    {
        category: "Juices",
        description: "Freshly blended juices.",
        items: [
            { name: "Avocado", url: OLD.avocado, description: "A creamy, rich avocado blend with smooth natural flavour.", sizes: JUICE(35, 45, 80) },
            { name: "Avocado & Dates", url: OLD.avocado, description: "A naturally sweet, creamy fusion of ripe avocado and soft dates.", sizes: JUICE(40, 50, 95) },
            { name: "Strawberry", url: OLD.strawberry, description: "Fresh, juicy strawberries blended into a refreshing, lightly sweet drink.", sizes: JUICE(35, 45, 80) },
            { name: "Mango", url: OLD.orange, description: "Smooth tropical mango, blended sweet and vibrant.", sizes: JUICE(35, 45, 80) },
            { name: "Apple", url: OLD.orange, description: "Crisp, refreshing apple juice with natural sweetness and a clean finish.", sizes: JUICE(30, 40, 75) },
            { name: "Pineapple", url: OLD.orange, description: "Bright, tropical pineapple juice with a tangy-sweet balance.", sizes: JUICE(30, 40, 75) },
            { name: "Strawberry Banana Milk", url: OLD.strawberry, description: "A smooth, creamy blend of ripe bananas, fresh strawberries and milk.", sizes: JUICE(30, 40, 75) },
            { name: "Banana Milk", url: OLD.avocado, description: "Creamy milk blended with ripe bananas for a rich, naturally sweet drink.", sizes: JUICE(30, 40, 75) },
            { name: "Lemon Mint", url: OLD.orange, description: "A refreshing burst of fresh lemon and cooling mint, perfect for hot days.", sizes: JUICE(30, 40, 75) },
            { name: "Orange", url: OLD.orange, description: "Freshly squeezed orange juice with natural citrus sweetness.", sizes: JUICE(30, 40, 75) },
            { name: "Fruit Cocktail", url: OLD.strawberry, description: "A vibrant mix of seasonal fruits blended into one refreshing tropical drink.", sizes: JUICE(35, 45, 80) },
        ],
    },
    {
        category: "Milkshakes",
        description: "Thick, creamy milkshakes.",
        items: [
            { name: "Vanilla Milkshake", url: OLD.vanilla, description: "A classic, smooth vanilla milkshake. Thick, creamy and perfectly sweet.", sizes: SHAKE },
            { name: "Chocolate Milkshake", url: OLD.chocolate, description: "Rich, velvety chocolate blended into a thick, creamy shake.", sizes: SHAKE },
            { name: "Oreo Milkshake", url: OLD.oreo, description: "Crushed Oreo cookies blended with creamy milk into a thick cookies-and-cream shake.", sizes: SHAKE },
            { name: "Strawberry Milkshake", url: OLD.strawberryShake, description: "Fresh strawberries blended with creamy milk into a smooth, fruity shake.", sizes: SHAKE },
            { name: "Mango Milkshake", url: OLD.mangoShake, description: "Ripe mango blended with creamy milk for a thick, fruity, naturally sweet shake.", sizes: SHAKE },
        ],
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const files = new Map(
    fs
        .readdirSync(IMAGE_DIR)
        .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
        .map((f) => [norm(path.parse(f).name), path.join(IMAGE_DIR, f)])
);
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

// A light, still, modern-format copy of a picture that is already on Cloudinary.
// For animated GIFs, pg_1 asks for the first frame only.
const still = (url) => {
    const frame = /\.gif$/i.test(url) ? "pg_1," : "";
    return url
        .replace("/upload/", `/upload/${frame}q_auto,w_${IMAGE_WIDTH}/`)
        .replace(/\.(png|gif|jpe?g)$/i, ".webp");
};
const deliver = (url) => url.replace("/upload/", `/upload/f_auto,q_auto,w_${IMAGE_WIDTH}/`);

const db = new Databases(
    new Client()
        .setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
        .setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
        .setKey(env.APPWRITE_ADMIN_KEY)
);
const findByName = async (collectionId, name) => {
    const r = await db.listDocuments({
        databaseId: DATABASE_ID,
        collectionId,
        queries: [Query.equal("name", name), Query.limit(1)],
    });
    return r.documents[0] ?? null;
};

// ─── Check the plan ───────────────────────────────────────────────────────────
const used = new Set();
const problems = [];
const status = new Map();

for (const cat of MENU) {
    for (const it of cat.items) {
        if (it.url) {
            if (!/^https:\/\//.test(it.url)) problems.push(`"${it.name}": bad picture address`);
        } else if (files.has(norm(it.image))) {
            used.add(norm(it.image));
        } else {
            problems.push(`No picture found for "${it.name}" (looking for "${it.image}")`);
        }
        for (const [label, price] of it.sizes) {
            if (!(price >= 1)) problems.push(`${it.name}: invalid price for ${label}`);
        }
        status.set(it.name, WIPE_OLD ? "new" : (await findByName("menu", it.name)) ? "exists" : "new");
    }
}

console.log(APPLY ? "\n=== APPLYING ===\n" : "\n=== DRY RUN (nothing will be changed) ===\n");
console.log("+ = will be added     = = already exists, skipped\n");
for (const cat of MENU) {
    console.log(cat.category);
    for (const it of cat.items) {
        const sizes = it.sizes.map(([l, p]) => `${l} R${p}`).join(" | ");
        console.log(`  ${status.get(it.name) === "new" ? "+" : "="} ${it.name.padEnd(26)} ${sizes}`);
    }
}

const hashOf = new Map([...used].map((k) => [k, sha(files.get(k))]));
console.log(`\n${used.size} local pictures are used, ${new Set(hashOf.values()).size} different images (identical files upload once).`);
const unused = [...files.keys()].filter((k) => !used.has(k));
if (unused.length) console.log("Pictures not used by any card:", unused.join(", "));
const sample = MENU.flatMap((c) => c.items).find((i) => i.url);
if (sample) console.log("\nSample drink picture, open it in a browser to check it:\n  " + still(sample.url));

if (problems.length) {
    console.error("\nPROBLEMS:\n - " + problems.join("\n - "));
    process.exit(1);
}

if (!APPLY) {
    console.log("\nLooks good? Run again with --apply to add the new items.");
    console.log("To delete the existing menu first and reload everything from this file, add --wipe-old.\n");
    process.exit(0);
}

// ─── Apply ────────────────────────────────────────────────────────────────────
if (WIPE_OLD) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
        "\nThis deletes ALL existing menu items, sizes and categories, then reloads the menu from this file.\nType DELETE to continue: "
    );
    rl.close();
    if (answer.trim() !== "DELETE") {
        console.log("Cancelled. Nothing was changed.");
        process.exit(0);
    }
}

const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) : {};

async function upload(file) {
    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(file)]), path.basename(file));
    form.append("upload_preset", env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
    form.append("folder", "menu");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message ?? `Cloudinary error ${res.status}`);
    return data.secure_url;
}

try {
    // 1. Pictures that are not on Cloudinary yet
    for (const [key, hash] of hashOf) {
        if (cache[hash]) continue;
        console.log(`Uploading ${path.basename(files.get(key))} ...`);
        cache[hash] = await upload(files.get(key));
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    }

    // 2. Optionally clear the old menu
    const wipe = async (collectionId) => {
        let total = 0;
        while (true) {
            const res = await db.listDocuments({ databaseId: DATABASE_ID, collectionId, queries: [Query.limit(100)] });
            if (res.documents.length === 0) break;
            for (const d of res.documents) {
                try {
                    await db.deleteDocument({ databaseId: DATABASE_ID, collectionId, documentId: d.$id });
                    total++;
                } catch (e) {
                    if (e.code !== 404) throw e; // already removed by a cascade
                }
            }
        }
        console.log(`  removed ${total} from ${collectionId}`);
    };

    if (WIPE_OLD) {
        console.log("\nRemoving the old menu ...");
        await wipe("size");
        await wipe("menu");
        await wipe("categories");
    }

    // 3. Add what is missing
    console.log("\nAdding to the menu ...");
    let added = 0;
    for (const cat of MENU) {
        let category = WIPE_OLD ? null : await findByName("categories", cat.category);
        if (!category) {
            category = await db.createDocument({
                databaseId: DATABASE_ID,
                collectionId: "categories",
                documentId: ID.unique(),
                data: { name: cat.category, description: cat.description },
            });
        }

        for (const it of cat.items) {
            if (status.get(it.name) === "exists") {
                console.log(`  = ${it.name} (already there)`);
                continue;
            }
            const imageUrl = it.url ? still(it.url) : deliver(cache[hashOf.get(norm(it.image))]);

            let menu;
            try {
                menu = await db.createDocument({
                    databaseId: DATABASE_ID,
                    collectionId: "menu",
                    documentId: ID.unique(),
                    data: {
                        name: it.name,
                        price: Math.min(...it.sizes.map(([, p]) => p)),
                        description: it.description,
                        image_url: imageUrl,
                        category_name: cat.category,
                        categories: category.$id,
                    },
                });
            } catch (e) {
                console.error(`\nCould not create "${it.name}": ${e.message}`);
                if (/rating|calories|protein/i.test(e.message)) {
                    console.error("Make rating, calories and protein optional in the Appwrite Console (table menu, Columns), then run again.");
                }
                process.exit(1);
            }

            for (const [label, price] of it.sizes) {
                await db.createDocument({
                    databaseId: DATABASE_ID,
                    collectionId: "size",
                    documentId: ID.unique(),
                    data: { label, price, menu: menu.$id },
                });
            }
            added++;
            console.log(`  + ${it.name}`);
        }
    }
    console.log(`\nDone. ${added} items added.\n`);
} catch (e) {
    console.error("\nStopped:", e.message);
    process.exit(1);
}