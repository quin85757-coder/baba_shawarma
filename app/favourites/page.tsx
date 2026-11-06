"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAddToCart } from "@/components/AddToCart";
import { clearFavorites, Favorite, getUserFavorites, removeFavorite } from "@/lib/ordersService";
import { useAuthStore } from "@/store/auth.store";

export default function FavouritesPage() {
    const router = useRouter();
    const { user, loading } = useAuthStore();
    const uid = user?.$id;
    const { add, busyId, ui, flash } = useAddToCart();

    const [favs, setFavs] = useState<Favorite[]>([]);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        if (!loading && !user) router.replace("/sign-in");
    }, [loading, user, router]);

    useEffect(() => {
        if (!uid) return;
        getUserFavorites(uid)
            .then(setFavs)
            .catch(console.error)
            .finally(() => setFetching(false));
    }, [uid]);

    const remove = async (f: Favorite) => {
        const before = favs;
        setFavs((p) => p.filter((x) => x.$id !== f.$id));
        try {
            await removeFavorite(f.$id);
        } catch {
            setFavs(before);
            flash("Could not remove favourite.");
        }
    };

    const clearAll = async () => {
        if (!uid || favs.length === 0) return;
        if (!window.confirm(`Remove all ${favs.length} favourites?`)) return;
        const before = favs;
        setFavs([]);
        try {
            await clearFavorites(uid);
        } catch {
            setFavs(before);
            flash("Could not clear favourites.");
        }
    };

    if (loading || !user) return <p className="text-gray-400">Loading…</p>;

    return (
        <div className="mx-auto max-w-3xl">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold">Favourite Meals</h1>
                    {favs.length > 0 && (
                        <p className="text-sm text-gray-400">
                            {favs.length} saved meal{favs.length > 1 ? "s" : ""}
                        </p>
                    )}
                </div>
                {favs.length > 0 && (
                    <button onClick={clearAll} className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
                        Clear all
                    </button>
                )}
            </div>

            {fetching ? (
                <p className="text-gray-400">Loading…</p>
            ) : favs.length === 0 ? (
                <div className="py-16 text-center">
                    <p className="text-4xl">♡</p>
                    <p className="mt-3 font-bold">No favourites yet</p>
                    <p className="mt-1 text-sm text-gray-400">Tap the heart on any meal to save it here.</p>
                    <Link href="/menu" className="mt-5 inline-block rounded-full bg-[#FE8C00] px-6 py-3 font-semibold text-white">
                        Explore menu
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {favs.map((f) => (
                        <div key={f.$id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={f.image_url} alt={f.menuName} className="h-16 w-16 rounded-xl bg-gray-50 object-contain" />
                            <div className="flex-1">
                                <p className="font-bold">{f.menuName}</p>
                                <p className="text-xs text-gray-400">{f.categoryName}</p>
                                <p className="mt-1 font-bold text-[#FE8C00]">From R{Number(f.price).toFixed(2)}</p>
                            </div>
                            <button
                                onClick={() =>
                                    add({ id: f.menuId, name: f.menuName, image_url: f.image_url, price: Number(f.price) })
                                }
                                disabled={busyId === f.menuId}
                                className="rounded-full bg-[#FE8C00] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {busyId === f.menuId ? "…" : "+ Add"}
                            </button>
                            <button onClick={() => remove(f)} className="text-sm text-red-500">
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {ui}
        </div>
    );
}