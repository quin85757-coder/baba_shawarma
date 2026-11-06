"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addFavorite, getUserFavorites, removeFavorite } from "@/lib/ordersService";
import { useAuthStore } from "@/store/auth.store";
import { useAddToCart } from "@/components/AddToCart";

export default function MenuGrid({ items }: { items: any[] }) {
    const router = useRouter();
    const { user } = useAuthStore();
    const uid = user?.$id;
    const { add, busyId, ui, flash } = useAddToCart();

    // menuId -> favourite document id ("pending" while saving)
    const [favMap, setFavMap] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!uid) {
            setFavMap({});
            return;
        }
        getUserFavorites(uid)
            .then((favs) => {
                const map: Record<string, string> = {};
                favs.forEach((f) => (map[f.menuId] = f.$id));
                setFavMap(map);
            })
            .catch(console.error);
    }, [uid]);

    const toggleFav = async (m: any) => {
        if (!uid) {
            router.push("/sign-in");
            return;
        }
        const existing = favMap[m.$id];
        if (existing === "pending") return;

        if (existing) {
            setFavMap((p) => {
                const n = { ...p };
                delete n[m.$id];
                return n;
            });
            try {
                await removeFavorite(existing);
            } catch {
                setFavMap((p) => ({ ...p, [m.$id]: existing }));
                flash("Could not update favourites.");
            }
        } else {
            setFavMap((p) => ({ ...p, [m.$id]: "pending" }));
            try {
                const doc = await addFavorite(uid, {
                    menuId: m.$id,
                    menuName: m.name,
                    categoryName: m.category_name ?? "",
                    price: Number(m.price),
                    image_url: m.image_url ?? "",
                    rating: Number(m.rating ?? 0),
                });
                setFavMap((p) => ({ ...p, [m.$id]: doc.$id }));
            } catch {
                setFavMap((p) => {
                    const n = { ...p };
                    delete n[m.$id];
                    return n;
                });
                flash("Could not update favourites.");
            }
        }
    };

    if (items.length === 0) {
        return <p className="py-10 text-center text-gray-400">No items found.</p>;
    }

    return (
        <>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
                {items.map((m) => {
                    const isFav = Boolean(favMap[m.$id]);
                    return (
                        <div key={m.$id} className="relative rounded-2xl bg-white p-4 shadow-sm">
                            <button
                                onClick={() => toggleFav(m)}
                                aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
                                className={`absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-lg shadow ${
                                    isFav ? "text-red-500" : "text-gray-300 hover:text-red-400"
                                }`}
                            >
                                {isFav ? "♥" : "♡"}
                            </button>

                            <div className="flex h-36 items-center justify-center overflow-hidden rounded-xl bg-gray-50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={m.image_url} alt={m.name} className="h-full w-full object-contain" />
                            </div>
                            <h3 className="mt-3 font-bold">{m.name}</h3>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="font-bold text-[#FE8C00]">From R{Number(m.price).toFixed(2)}</span>
                                <button
                                    onClick={() =>
                                        add({ id: m.$id, name: m.name, image_url: m.image_url, price: Number(m.price) })
                                    }
                                    disabled={busyId === m.$id}
                                    className="rounded-full bg-[#FE8C00] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                                >
                                    {busyId === m.$id ? "…" : "+ Add"}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {ui}
        </>
    );
}