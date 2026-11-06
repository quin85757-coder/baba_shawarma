"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/appwrite";
import { useAuthStore } from "@/store/auth.store";

export default function SignInPage() {
    const router = useRouter();
    const fetchUser = useAuthStore((s) => s.fetchUser);
    const [mode, setMode] = useState<"in" | "up">("in");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        setError("");
        try {
            if (mode === "in") await signIn(email, password);
            else await signUp(name, email, password);
            await fetchUser();
            router.push("/");
        } catch (e: any) {
            setError(e?.message ?? "Something went wrong");
        } finally {
            setBusy(false);
        }
    };

    const input = "w-full rounded-xl border border-gray-200 bg-white p-3 text-sm";

    return (
        <div className="mx-auto max-w-sm space-y-3 pt-10">
            <h1 className="text-2xl font-extrabold">{mode === "in" ? "Sign in" : "Create account"}</h1>
            {mode === "up" && <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />}
            <input className={input} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={input} placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={submit} disabled={busy} className="w-full rounded-full bg-[#FE8C00] py-3 font-bold text-white disabled:opacity-60">
                {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}
            </button>
            <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-sm text-gray-500">
                {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
            </button>
        </div>
    );
}