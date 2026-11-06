"use client";
import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/appwrite";
import { useAuthStore } from "@/store/auth.store";

interface StaffOrder {
  id: string;
  orderNumber: string;
  status: string;
  deliveryType: string;
  total: number;
  itemCount: number;
  deliveryAddress: string;
  specialInstructions: string;
  createdAt: string;
  dispatchStatus: string;
  driverName: string;
  driverPhone: string;
  customerName: string;
  customerPhone: string;
  items: { name: string; size: string; quantity: number }[];
}

interface DriverRow {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  isOnline: boolean;
  busy: boolean;
  busyWith: string | null;
  distanceKm: number | null;
  stale: boolean;
}

const norm = (s: string) => (s === "processing" ? "preparing" : s);
const FLOW: Record<string, string[]> = {
  delivery: ["pending", "confirmed", "preparing", "on_the_way", "delivered"],
  pickup: ["pending", "confirmed", "preparing", "on_the_way", "collected"],
};
const LABEL = (s: string, pickup: boolean) =>
  s === "on_the_way" && pickup
    ? "Ready for pick-up"
    : ({
        pending: "Pending",
        confirmed: "Confirmed",
        preparing: "Preparing",
        on_the_way: "On the way",
        delivered: "Delivered",
        collected: "Collected",
        cancelled: "Cancelled",
      } as Record<string, string>)[s] ?? s;
const TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-violet-50 text-violet-700",
  preparing: "bg-blue-50 text-blue-700",
  on_the_way: "bg-cyan-50 text-cyan-700",
  delivered: "bg-green-50 text-green-700",
  collected: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};
const FILTERS: [string, string][] = [
  ["all", "All"],
  ["pending", "Pending"],
  ["confirmed", "Confirmed"],
  ["preparing", "Preparing"],
  ["on_the_way", "On the way"],
  ["done", "Completed"],
  ["cancelled", "Cancelled"],
];
const isDone = (s: string) => s === "delivered" || s === "collected";

function AssignModal({
  order,
  onClose,
  onDone,
}: {
  order: StaffOrder;
  onClose: () => void;
  onDone: () => void;
}) {
  const [drivers, setDrivers] = useState<DriverRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiPost<{ drivers: DriverRow[] }>("/api/admin/drivers")
      .then((r) => setDrivers(r.drivers))
      .catch((e) => setError(e?.message ?? "Could not load drivers"));
  }, []);

  const assign = async (d: DriverRow) => {
    setBusy(d.id);
    setError("");
    try {
      await apiPost("/api/admin/orders/assign", { orderId: order.id, driverId: d.id });
      onDone();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Could not assign");
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-extrabold">Assign a driver</h2>
        <p className="mb-4 text-sm text-gray-400">{order.orderNumber} · nearest first</p>
        {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        {!drivers && !error && <p className="text-gray-400">Loading…</p>}
        {drivers?.length === 0 && <p className="text-gray-400">No drivers yet.</p>}
        <div className="space-y-2">
          {drivers?.map((d) => {
            const ok = d.isOnline && !d.busy;
            return (
              <div key={d.id} className={`flex items-center gap-3 rounded-xl border p-3 ${ok ? "" : "opacity-60"}`}>
                <div className="flex-1">
                  <p className="font-bold">{d.name}</p>
                  <p className="text-xs text-gray-400">
                    {!d.isOnline ? "Offline" : d.busy ? `Busy · ${d.busyWith}` : "Available"}
                    {d.distanceKm != null && ` · ${d.distanceKm} km away`}
                    {d.stale && d.isOnline ? " · location may be old" : ""}
                  </p>
                </div>
                <button
                  disabled={!ok || busy !== null}
                  onClick={() => assign(d)}
                  className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {busy === d.id ? "…" : "Assign"}
                </button>
              </div>
            );
          })}
        </div>
        <button onClick={onClose} className="mt-4 w-full text-sm text-gray-400">Close</button>
      </div>
    </div>
  );
}

export default function StaffOrders() {
  const { isStaff } = useAuthStore();
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [assignFor, setAssignFor] = useState<StaffOrder | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiPost<{ orders: StaffOrder[] }>("/api/staff/orders");
      setOrders(res.orders);
    } catch (e: any) {
      setMsg(e?.message ?? "Could not load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isStaff) return;
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [isStaff, load]);

  const setStatus = async (o: StaffOrder, status: string) => {
    if (status === "cancelled" && !window.confirm(`Cancel ${o.orderNumber}? If the customer already paid, refund them from PayFast.`)) return;
    setBusy(o.id);
    setMsg("");
    try {
      await apiPost("/api/admin/orders/status", { orderId: o.id, status });
      await load();
    } catch (e: any) {
      setMsg(e?.message ?? "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const matches = (o: StaffOrder, f: string) =>
    f === "all" ? true : f === "done" ? isDone(norm(o.status)) : norm(o.status) === f;
  const shown = orders.filter((o) => matches(o, filter));

  if (!isStaff) return <p className="text-gray-400">Loading…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Orders</h1>
        <button onClick={load} className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-[#FE8C00]">Refresh</button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => {
          const n = orders.filter((o) => matches(o, key)).length;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                filter === key ? "bg-[#FE8C00] text-white" : "bg-white text-gray-600"
              }`}
            >
              {label} {n > 0 && <span className="ml-1 opacity-70">{n}</span>}
            </button>
          );
        })}
      </div>

      {msg && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">{msg}</p>}
      {loading && <p className="text-gray-400">Loading orders…</p>}
      {!loading && shown.length === 0 && <p className="py-10 text-center text-gray-400">No orders here.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((o) => {
          const pickup = o.deliveryType === "pickup";
          const s = norm(o.status);
          const flow = FLOW[pickup ? "pickup" : "delivery"];
          const next = flow[flow.indexOf(s) + 1];
          const finished = isDone(s) || s === "cancelled";
          const canAssign =
            !pickup &&
            ["confirmed", "preparing"].includes(s) &&
            ["unassigned", "offered", "declined"].includes(o.dispatchStatus);

          return (
            <div key={o.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-extrabold">{o.orderNumber}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(o.createdAt).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${TONE[s] ?? "bg-gray-100"}`}>{LABEL(s, pickup)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pickup ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                    {pickup ? "Pick-up" : "Delivery"}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm font-semibold">
                {o.customerName}
                {o.customerPhone && (
                  <a href={`tel:${o.customerPhone}`} className="ml-2 font-normal text-[#FE8C00]">{o.customerPhone}</a>
                )}
              </p>
              <ul className="mt-2 space-y-0.5 text-sm text-gray-500">
                {o.items.map((i, k) => (
                  <li key={k}>· {i.quantity}x {i.name}{i.size ? ` (${i.size})` : ""}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-400">📍 {o.deliveryAddress || "N/A"}</p>
              {o.specialInstructions && <p className="mt-1 text-xs text-gray-400">📝 {o.specialInstructions}</p>}

              {!pickup && o.driverName && o.dispatchStatus !== "unassigned" && (
                <p className={`mt-3 rounded-xl p-2 text-xs ${o.dispatchStatus === "declined" ? "bg-red-50 text-red-600" : "bg-violet-50 text-violet-700"}`}>
                  🛵 {o.driverName} · {{ offered: "waiting for reply", accepted: "heading to the restaurant", picked_up: "out for delivery", declined: "declined, assign another", delivered: "delivered" }[o.dispatchStatus] ?? o.dispatchStatus}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between">
                <p className="text-lg font-extrabold text-[#FE8C00]">R{Number(o.total).toFixed(2)}</p>
                <div className="flex gap-2">
                  {canAssign && (
                    <button onClick={() => setAssignFor(o)} className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white">
                      {o.dispatchStatus === "offered" ? "Reassign" : "Assign driver"}
                    </button>
                  )}
                  {!finished && next && (
                    <button
                      disabled={busy === o.id}
                      onClick={() => setStatus(o, next)}
                      className="rounded-full bg-[#FE8C00] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {busy === o.id ? "…" : `Mark ${LABEL(next, pickup).toLowerCase()}`}
                    </button>
                  )}
                  {!finished && (
                    <button disabled={busy === o.id} onClick={() => setStatus(o, "cancelled")} className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {assignFor && <AssignModal order={assignFor} onClose={() => setAssignFor(null)} onDone={load} />}
    </div>
  );
}