"use client";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/appwrite";
import { useAuthStore } from "@/store/auth.store";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  joined: string;
  orders: number;
  spent: number;
  lastOrder: string;
}

const date = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function StaffCustomers() {
  const { isStaff } = useAuthStore();
  const [list, setList] = useState<Customer[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isStaff) return;
    apiPost<{ customers: Customer[] }>("/api/staff/customers")
      .then((r) => setList(r.customers))
      .catch((e) => setError(e?.message ?? "Could not load customers"));
  }, [isStaff]);

  if (!isStaff) return <p className="text-gray-400">Loading…</p>;

  const q = search.trim().toLowerCase();
  const shown = (list ?? []).filter(
    (c) => !q || [c.name, c.email, c.phone].some((v) => v.toLowerCase().includes(q))
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Customers</h1>
          {list && <p className="text-sm text-gray-400">{list.length} customers</p>}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
          className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm md:w-80"
        />
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</p>}
      {!list && !error && <p className="text-gray-400">Loading…</p>}

      {list && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="p-4">Customer</th>
                <th className="p-4">Contact</th>
                <th className="p-4 text-right">Orders</th>
                <th className="p-4 text-right">Spent</th>
                <th className="p-4">Last order</th>
                <th className="p-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-4">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.address}</p>
                  </td>
                  <td className="p-4 text-gray-500">
                    <p>{c.email}</p>
                    <p>{c.phone}</p>
                  </td>
                  <td className="p-4 text-right font-semibold">{c.orders}</td>
                  <td className="p-4 text-right font-semibold text-[#FE8C00]">R{c.spent.toFixed(2)}</td>
                  <td className="p-4 text-gray-500">{date(c.lastOrder)}</td>
                  <td className="p-4 text-gray-500">{date(c.joined)}</td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No customers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}