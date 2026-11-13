"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";

interface Banner {
    id: string;
    title: string;
    description: string;
    code: string;
}

const COLORS = ["#FE8C00", "#E05C00", "#8E44AD", "#16A085"];

export default function PromoBanners() {
    const { isStaff } = useAuthStore();
    const [banners, setBanners] = useState<Banner[]>([]);
    const [copied, setCopied] = useState("");

    useEffect(() => {
        fetch("/api/promos")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d && setBanners(d.banners ?? []))
            .catch(() => {});
    }, []);

    if (isStaff || banners.length === 0) return null;

    const copy = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(code);
            setTimeout(() => setCopied(""), 1500);
        } catch {}
    };

    return (
        <section>
            <h2 className="mb-3 text-xl font-extrabold">Offers</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
                {banners.map((b, i) => (
                    <div
                        key={b.id}
                        className="min-w-[260px] max-w-xs flex-1 rounded-2xl p-5 text-white"
                        style={{ background: COLORS[i % COLORS.length] }}
                    >
                        <p className="text-lg font-extrabold leading-tight">{b.title}</p>
                        {b.description && <p className="mt-1 text-sm opacity-90">{b.description}</p>}
                        {b.code ? (
                            <button
                                onClick={() => copy(b.code)}
                                className="mt-4 rounded-full bg-white/90 px-4 py-1.5 text-sm font-bold text-gray-900"
                            >
                                {copied === b.code ? "Copied!" : `Use code ${b.code}`}
                            </button>
                        ) : (
                            <p className="mt-4 text-xs font-semibold uppercase tracking-wide opacity-90">Applied automatically</p>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}