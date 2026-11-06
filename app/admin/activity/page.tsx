"use client";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/appwrite";
import { useAuthStore } from "@/store/auth.store";

interface Entry {
  id: string;
  at: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  detail: string;
}

const LABELS: Record<string, string> = {
  order_status: "Changed an order's status",
  order_cancelled: "Cancelled an order",
  driver_assigned: "Assigned a driver",
  account_disabled: "Disabled an account",
  account_enabled: "Enabled an account",
};

export default function ActivityPage() {
  const { isAdmin } = useAuthStore();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    apiPost<{ entries: Entry[] }>("/api/admin/activity")
      .then((r) => setEntries(r.entries))
      .catch((e) => setError(e?.message ?? "Could not load activity"));
  }, [isAdmin]);

  if (!isAdmin) return <p className="text-gray-400">Loading…</p>;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Activity</h1>
      <p className="mb-5 text-sm text-gray-400">The last 100 actions by staff and admins.</p>

      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</p>}
      {!entries && !error && <p className="text-gray-400">Loading…</p>}

      {entries && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-gray-400">
              <tr><th className="p-4">When</th><th className="p-4">Who</th><th className="p-4">What</th><th className="p-4">On</th><th className="p-4">Detail</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap p-4 text-gray-500">
                    {new Date(e.at).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="p-4"><span className="font-semibold">{e.actor}</span> <span className="text-xs capitalize text-gray-400">{e.role}</span></td>
                  <td className="p-4">{LABELS[e.action] ?? e.action}</td>
                  <td className="p-4 font-semibold">{e.target}</td>
                  <td className="p-4 text-gray-500">{e.detail}</td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nothing yet. Actions appear here as staff work.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}