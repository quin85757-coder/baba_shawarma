"use client";
import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/appwrite";
import { useAuthStore } from "@/store/auth.store";

interface Person {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
  joined: string;
  orders?: number;
  spent?: number;
}
interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  active: boolean;
  isOnline: boolean;
  lastSeen: string;
  delivered30: number;
}
interface Data {
  self: string;
  staff: Person[];
  drivers: Driver[];
  customers: Person[];
}

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
};

const Badge = ({ ok, yes, no }: { ok: boolean; yes: string; no: string }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
    {ok ? yes : no}
  </span>
);

export default function PeoplePage() {
  const { isAdmin } = useAuthStore();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"staff" | "drivers" | "customers">("staff");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await apiPost<Data>("/api/admin/people"));
    } catch (e: any) {
      setMsg(e?.message ?? "Could not load people");
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const toggle = async (kind: "user" | "driver", id: string, name: string, active: boolean) => {
    const verb = active ? "enable" : "disable";
    if (!window.confirm(`${verb[0].toUpperCase()}${verb.slice(1)} ${name}?`)) return;
    setBusy(id);
    setMsg("");
    try {
      await apiPost("/api/admin/people/status", { kind, id, active });
      await load();
    } catch (e: any) {
      setMsg(e?.message ?? "Could not update");
    } finally {
      setBusy(null);
    }
  };

  if (!isAdmin) return <p className="text-gray-400">Loading…</p>;

  const q = search.trim().toLowerCase();
  const match = (...v: string[]) => !q || v.some((x) => x.toLowerCase().includes(q));
  const tabs = [
    ["staff", "Staff & admins", data?.staff.length],
    ["drivers", "Drivers", data?.drivers.length],
    ["customers", "Customers", data?.customers.length],
  ] as const;

  const actionBtn = (active: boolean, id: string, onClick: () => void) => (
    <button
      disabled={busy === id}
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50 ${
        active ? "border border-red-200 text-red-600" : "bg-green-600 text-white"
      }`}
    >
      {busy === id ? "…" : active ? "Disable" : "Enable"}
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">People</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
          className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm md:w-80"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([key, label, n]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === key ? "bg-[#FE8C00] text-white" : "bg-white text-gray-600"}`}
          >
            {label} {n !== undefined && <span className="ml-1 opacity-70">{n}</span>}
          </button>
        ))}
      </div>

      <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
        Disabling stops someone using the restaurant&apos;s tools and ordering. To lock someone out of
        signing in completely, also block them in the Appwrite Console (Auth → Users). New accounts are created
        with the scripts or the Console.
      </p>

      {msg && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">{msg}</p>}
      {!data && !msg && <p className="text-gray-400">Loading…</p>}

      {data && tab === "staff" && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-gray-400">
              <tr><th className="p-4">Name</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4" /></tr>
            </thead>
            <tbody>
              {data.staff.filter((p) => match(p.name, p.email, p.phone)).map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-4"><p className="font-semibold">{p.name}</p><p className="text-xs text-gray-400">{p.email}</p></td>
                  <td className="p-4 capitalize">{p.role}</td>
                  <td className="p-4"><Badge ok={p.active} yes="Active" no="Disabled" /></td>
                  <td className="p-4 text-right">
                    {p.role === "admin" || p.id === data.self
                      ? <span className="text-xs text-gray-300">{p.id === data.self ? "You" : "Console only"}</span>
                      : actionBtn(p.active, p.id, () => toggle("user", p.id, p.name, !p.active))}
                  </td>
                </tr>
              ))}
              {data.staff.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400">No staff yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data && tab === "drivers" && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-gray-400">
              <tr><th className="p-4">Driver</th><th className="p-4">Now</th><th className="p-4 text-right">Deliveries (30 days)</th><th className="p-4">Last seen</th><th className="p-4">Status</th><th className="p-4" /></tr>
            </thead>
            <tbody>
              {data.drivers.filter((d) => match(d.name, d.phone, d.vehicle)).map((d) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="p-4"><p className="font-semibold">{d.name}</p><p className="text-xs text-gray-400">{d.phone}{d.vehicle ? ` · ${d.vehicle}` : ""}</p></td>
                  <td className="p-4"><Badge ok={d.isOnline} yes="Online" no="Offline" /></td>
                  <td className="p-4 text-right font-semibold">{d.delivered30}</td>
                  <td className="p-4 text-gray-500">{ago(d.lastSeen)}</td>
                  <td className="p-4"><Badge ok={d.active} yes="Active" no="Disabled" /></td>
                  <td className="p-4 text-right">{actionBtn(d.active, d.id, () => toggle("driver", d.id, d.name, !d.active))}</td>
                </tr>
              ))}
              {data.drivers.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">No drivers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data && tab === "customers" && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-gray-400">
              <tr><th className="p-4">Customer</th><th className="p-4">Phone</th><th className="p-4 text-right">Orders</th><th className="p-4 text-right">Spent</th><th className="p-4">Status</th><th className="p-4" /></tr>
            </thead>
            <tbody>
              {data.customers.filter((c) => match(c.name, c.email, c.phone)).map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-4"><p className="font-semibold">{c.name}</p><p className="text-xs text-gray-400">{c.email}</p></td>
                  <td className="p-4 text-gray-500">{c.phone}</td>
                  <td className="p-4 text-right font-semibold">{c.orders}</td>
                  <td className="p-4 text-right font-semibold text-[#FE8C00]">R{(c.spent ?? 0).toFixed(2)}</td>
                  <td className="p-4"><Badge ok={c.active} yes="Active" no="Disabled" /></td>
                  <td className="p-4 text-right">{actionBtn(c.active, c.id, () => toggle("user", c.id, c.name, !c.active))}</td>
                </tr>
              ))}
              {data.customers.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">No customers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}