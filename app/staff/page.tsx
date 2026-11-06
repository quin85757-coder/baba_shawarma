"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/appwrite";
import { useAuthStore } from "@/store/auth.store";
import { BarChart, HBars, StatCard } from "@/components/staff/Charts";

interface Stats {
  today: { orders: number; revenue: number };
  active: number;
  pending: number;
  needsDriver: number;
  last30: { orders: number; revenue: number; avgOrder: number; delivery: number; pickup: number };
  days: { date: string; orders: number; revenue: number }[];
  statusCounts: Record<string, number>;
  topItems: { name: string; qty: number; revenue: number }[];
  customers: { total: number; new7: number };
}

const R = (n: number) => `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_ROWS: [string, string, string][] = [
  ["pending", "Pending", "#D97706"],
  ["confirmed", "Confirmed", "#7C3AED"],
  ["preparing", "Preparing", "#2563EB"],
  ["on_the_way", "On the way", "#0891B2"],
  ["delivered", "Delivered", "#16A34A"],
  ["collected", "Collected", "#16A34A"],
  ["cancelled", "Cancelled", "#DC2626"],
];

export default function StaffDashboard() {
  const { user, isStaff, isAdmin } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setStats(await apiPost<Stats>("/api/staff/stats"));
      setError("");
    } catch (e: any) {
      setError(e?.message ?? "Could not load the dashboard");
    }
  }, []);

  useEffect(() => {
    if (!isStaff) return;
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [isStaff, load]);

  if (!isStaff) return <p className="text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Dashboard</h1>
          <p className="text-sm text-gray-400">
            Welcome back, {user?.name?.split(" ")[0]} · {isAdmin ? "Admin" : "Staff"}
          </p>
        </div>
        <button onClick={load} className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-[#FE8C00]">
          Refresh
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</p>}
      {!stats && !error && <p className="text-gray-400">Loading numbers…</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Orders today" value={stats.today.orders} />
            <StatCard label="Revenue today" value={R(stats.today.revenue)} />
            <StatCard label="Active orders" value={stats.active} hint={`${stats.pending} waiting to be confirmed`} />
            <StatCard
              label="Need a driver"
              value={stats.needsDriver}
              hint="Delivery orders without a driver"
              warn={stats.needsDriver > 0}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-2">
              <p className="mb-4 font-bold">Revenue, last 14 days</p>
              <BarChart
                data={stats.days.map((d) => ({ label: d.date.slice(8), value: d.revenue }))}
                format={R}
              />
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="mb-4 font-bold">Orders by status (30 days)</p>
              <HBars
                rows={STATUS_ROWS.filter(([k]) => stats.statusCounts[k]).map(([k, label, color]) => ({
                  label,
                  value: stats.statusCounts[k],
                  color,
                }))}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="mb-4 font-bold">Delivery vs pick-up</p>
              <HBars
                rows={[
                  { label: "Delivery", value: stats.last30.delivery, color: "#2563EB" },
                  { label: "Pick-up", value: stats.last30.pickup, color: "#16A34A" },
                ]}
              />
              <div className="mt-5 space-y-1 border-t pt-4 text-sm text-gray-500">
                <div className="flex justify-between"><span>Orders (30 days)</span><b>{stats.last30.orders}</b></div>
                <div className="flex justify-between"><span>Revenue (30 days)</span><b>{R(stats.last30.revenue)}</b></div>
                <div className="flex justify-between"><span>Average order</span><b>{R(stats.last30.avgOrder)}</b></div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="mb-4 font-bold">Top items (30 days)</p>
              {stats.topItems.length === 0 ? (
                <p className="text-sm text-gray-400">No orders yet.</p>
              ) : (
                <ol className="space-y-3">
                  {stats.topItems.map((t, i) => (
                    <li key={t.name} className="flex items-center gap-3 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-[#FE8C00]">
                        {i + 1}
                      </span>
                      <span className="flex-1 font-semibold">{t.name}</span>
                      <span className="text-gray-400">{t.qty} sold</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="mb-4 font-bold">Customers</p>
              <p className="text-3xl font-extrabold">{stats.customers.total}</p>
              <p className="text-sm text-gray-400">registered accounts</p>
              <p className="mt-3 text-sm text-gray-500">
                <b className="text-[#FE8C00]">{stats.customers.new7}</b> joined in the last 7 days
              </p>
              <Link href="/staff/customers" className="mt-5 inline-block text-sm font-semibold text-[#FE8C00]">
                View customers →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}