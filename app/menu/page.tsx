"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MenuGrid from "@/components/MenuGrid";
import { getCategories, getMenu } from "@/lib/ordersService";

function MenuInner() {
    const router = useRouter();
    const params = useSearchParams();
    const active = params.get("category") ?? "";

    const [categories, setCategories] = useState<any[]>([]);
    const [menu, setMenu] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getCategories().then(setCategories).catch(console.error);
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setLoading(true);
        getMenu({ category: active || undefined, search: debounced })
            .then(setMenu)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [active, debounced]);

    const setCategory = (name: string) =>
        router.replace(name ? `/menu?category=${encodeURIComponent(name)}` : "/menu");

    return (
        <div>
            <h1 className="mb-4 text-2xl font-extrabold">Menu</h1>

            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the menu…"
                className="mb-4 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm md:max-w-md"
            />

            <div className="mb-6 flex flex-wrap gap-2">
                <button
                    onClick={() => setCategory("")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        !active ? "bg-[#FE8C00] text-white" : "bg-white text-gray-600"
                    }`}
                >
                    All
                </button>
                {categories.map((c) => (
                    <button
                        key={c.$id}
                        onClick={() => setCategory(c.name)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${
                            active === c.name ? "bg-[#FE8C00] text-white" : "bg-white text-gray-600"
                        }`}
                    >
                        {c.name}
                    </button>
                ))}
            </div>

            {loading ? <p className="text-gray-400">Loading menu…</p> : <MenuGrid items={menu} />}
        </div>
    );
}

export default function MenuPage() {
    return (
        <Suspense fallback={<p className="text-gray-400">Loading menu…</p>}>
            <MenuInner />
        </Suspense>
    );
}