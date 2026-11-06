"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateUserProfile } from "@/lib/appwrite";
import { cloudinaryEnabled, uploadToCloudinary } from "@/lib/cloudinary";
import { clearFavorites, getUserFavorites, getUserOrders } from "@/lib/ordersService";
import { useAuthStore } from "@/store/auth.store";

export default function ProfilePage() {
    const router = useRouter();
    const { user, loading, fetchUser, logout } = useAuthStore();
    const uid = user?.$id;
    const fileRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({ name: "", phone: "", address1: "", address2: "" });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const [counts, setCounts] = useState({ orders: 0, favs: 0 });

    useEffect(() => {
        if (!loading && !user) router.replace("/sign-in");
    }, [loading, user, router]);

    useEffect(() => {
        if (!user) return;
        setForm({
            name: user.name ?? "",
            phone: user.phone ?? "",
            address1: user.address1 ?? "",
            address2: user.address2 ?? "",
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid]);

    useEffect(() => {
        if (!uid) return;
        Promise.all([getUserOrders(uid), getUserFavorites(uid)])
            .then(([o, f]) => setCounts({ orders: o.length, favs: f.length }))
            .catch(console.error);
    }, [uid]);

    const save = async () => {
        if (!user) return;
        if (!form.name.trim()) {
            setMsg({ type: "err", text: "Name can't be empty." });
            return;
        }
        setSaving(true);
        setMsg(null);
        try {
            await updateUserProfile(user.$id, {
                name: form.name.trim(),
                phone: form.phone.trim(),
                address1: form.address1.trim(),
                address2: form.address2.trim(),
            });
            await fetchUser();
            setMsg({ type: "ok", text: "Profile updated." });
        } catch (e: any) {
            setMsg({ type: "err", text: e?.message ?? "Could not save your profile." });
        } finally {
            setSaving(false);
        }
    };

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !user) return;
        if (file.size > 5 * 1024 * 1024) {
            setMsg({ type: "err", text: "Image must be under 5 MB." });
            return;
        }
        setUploading(true);
        setMsg(null);
        try {
            const up = await uploadToCloudinary(file, "avatars");
            await updateUserProfile(user.$id, { avatar: up.secure_url, avatar_public_id: up.public_id });
            await fetchUser();
            setMsg({ type: "ok", text: "Profile picture updated." });
        } catch (err: any) {
            setMsg({ type: "err", text: err?.message ?? "Upload failed." });
        } finally {
            setUploading(false);
        }
    };

    const clearFavs = async () => {
        if (!user || counts.favs === 0) return;
        if (!window.confirm(`Remove all ${counts.favs} favourites?`)) return;
        try {
            await clearFavorites(user.$id);
            setCounts((c) => ({ ...c, favs: 0 }));
            setMsg({ type: "ok", text: "Favourites cleared." });
        } catch {
            setMsg({ type: "err", text: "Could not clear favourites." });
        }
    };

    const doLogout = async () => {
        await logout();
        router.push("/");
    };

    if (loading || !user) return <p className="text-gray-400">Loading…</p>;

    const input = "w-full rounded-xl border border-gray-200 bg-white p-3 text-sm";
    const label = "mb-1 block text-xs font-semibold text-gray-500";

    return (
        <div className="mx-auto max-w-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center gap-5 rounded-2xl bg-white p-6 shadow-sm">
                <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={user.avatar || "https://ui-avatars.com/api/?name=User&background=FE8C00&color=fff"}
                        alt=""
                        className="h-24 w-24 rounded-full bg-gray-100 object-cover"
                    />
                    {cloudinaryEnabled && (
                        <>
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="absolute bottom-0 right-0 rounded-full bg-[#FE8C00] px-2.5 py-1 text-xs font-bold text-white disabled:opacity-60"
                            >
                                {uploading ? "…" : "Edit"}
                            </button>
                            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                        </>
                    )}
                </div>
                <div>
                    <h1 className="text-xl font-extrabold">{user.name}</h1>
                    <p className="text-sm text-gray-400">{user.email}</p>
                </div>
            </div>

            {msg && (
                <p
                    className={`rounded-xl p-4 text-sm ${
                        msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                    }`}
                >
                    {msg.text}
                </p>
            )}

            {/* Activity */}
            <div className="grid grid-cols-2 gap-4">
                <Link href="/orders" className="rounded-2xl bg-white p-5 shadow-sm hover:ring-1 hover:ring-[#FE8C00]">
                    <p className="text-2xl font-extrabold text-[#FE8C00]">{counts.orders}</p>
                    <p className="text-sm text-gray-500">Order history</p>
                </Link>
                <Link href="/favourites" className="rounded-2xl bg-white p-5 shadow-sm hover:ring-1 hover:ring-[#FE8C00]">
                    <p className="text-2xl font-extrabold text-red-500">{counts.favs}</p>
                    <p className="text-sm text-gray-500">Favourite meals</p>
                </Link>
            </div>

            {/* Edit details */}
            <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="font-bold">Your details</h2>
                <div>
                    <label className={label}>Full name</label>
                    <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                    <label className={label}>Email</label>
                    <input className={`${input} bg-gray-50 text-gray-400`} value={user.email} disabled />
                </div>
                <div>
                    <label className={label}>Phone</label>
                    <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                    <label className={label}>Address 1</label>
                    <input className={input} value={form.address1} onChange={(e) => setForm({ ...form, address1: e.target.value })} />
                </div>
                <div>
                    <label className={label}>Address 2</label>
                    <input className={input} value={form.address2} onChange={(e) => setForm({ ...form, address2: e.target.value })} />
                </div>
                <button
                    onClick={save}
                    disabled={saving}
                    className="w-full rounded-full bg-[#FE8C00] py-3 font-bold text-white disabled:opacity-60"
                >
                    {saving ? "Saving…" : "Save changes"}
                </button>
            </div>

            {/* Danger zone */}
            <div className="space-y-2 rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="font-bold text-gray-500">Account</h2>
                <button
                    onClick={clearFavs}
                    className="w-full rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                    Clear all favourites
                </button>
                <button
                    onClick={doLogout}
                    className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                    Log out
                </button>
            </div>
        </div>
    );
}