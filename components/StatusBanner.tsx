"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";

interface PublicSettings {
    open: boolean;
    reason: string;
    today: string;
    banner: string;
}

export default function StatusBanner() {
    const { isStaff } = useAuthStore();
    const [s, setS] = useState<PublicSettings | null>(null);

    useEffect(() => {
        const load = () =>
            fetch("/api/settings")
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => d && setS(d))
                .catch(() => {});
        load();
        const t = setInterval(load, 60000);
        return () => clearInterval(t);
    }, []);

    if (!s || isStaff) return null;

    return (
        <>
            {!s.open && (
                <div className="bg-red-600 px-6 py-2 text-center text-sm font-semibold text-white">
                    {s.reason || "We're closed right now."}
                </div>
            )}
            {s.banner && (
                <div className="bg-[#FE8C00] px-6 py-2 text-center text-sm font-semibold text-white">{s.banner}</div>
            )}
        </>
    );
}