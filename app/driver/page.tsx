"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiPost } from "@/lib/appwrite";
import { useAuthStore } from "@/store/auth.store";

const PING_MS = 15000;

interface DriverInfo { id: string; name: string; isOnline: boolean }
interface DriverOrder {
  id: string;
  orderNumber: string;
  dispatchStatus: "offered" | "accepted" | "picked_up";
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  specialInstructions: string;
  customerName: string;
  customerPhone: string;
  items: { name: string; size: string; quantity: number }[];
  pickup: { address: string; lat: number; lng: number };
  tripKm: number | null;
}

const getPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This browser can't share location."));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 10000,
    });
  });

const mapsUrl = (lat: number | null, lng: number | null, address: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${
    lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(address)
  }`;

const STAGE = {
  offered: { title: "New delivery request", color: "bg-violet-600" },
  accepted: { title: "Go to the restaurant", color: "bg-blue-600" },
  picked_up: { title: "Deliver to the customer", color: "bg-green-600" },
} as const;

export default function DriverPage() {
  const { isDriver, loading: authLoading } = useAuthStore();
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [order, setOrder] = useState<DriverOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const onlineRef = useRef(false);
  const lastOffer = useRef<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const beep = () => {
    const ctx = audioRef.current;
    if (!ctx) return;
    [0, 0.4, 0.8].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.25);
    });
  };

  // One call: shares my location (when online) and returns my current order
  const sync = useCallback(async (wantOnline?: boolean) => {
    try {
      const body: Record<string, any> = {};
      if (typeof wantOnline === "boolean") body.online = wantOnline;

      if (wantOnline ?? onlineRef.current) {
        try {
          const p = await getPosition();
          body.lat = p.coords.latitude;
          body.lng = p.coords.longitude;
        } catch {
          // keep going without a fresh location
        }
      }

      const res = await apiPost<{ driver: DriverInfo; order: DriverOrder | null }>("/api/driver/sync", body);
      setDriver(res.driver);
      setOrder(res.order);
      onlineRef.current = res.driver.isOnline;
      setError("");

      if (res.order?.dispatchStatus === "offered") {
        if (lastOffer.current !== res.order.id) {
          lastOffer.current = res.order.id;
          beep();
        }
      } else {
        lastOffer.current = null;
      }
    } catch (e: any) {
      setError(e?.message ?? "Connection problem");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isDriver) return;
    sync();
    const timer = setInterval(() => sync(), PING_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isDriver, sync]);

  // Flash the tab title while an offer is waiting
  useEffect(() => {
    const original = document.title;
    if (order?.dispatchStatus === "offered") document.title = "🔔 New delivery request";
    return () => {
      document.title = original;
    };
  }, [order?.dispatchStatus]);

  const toggleOnline = async () => {
    const next = !driver?.isOnline;
    if (next) {
      // Create the audio context from a click so the browser allows alert sounds later
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        audioRef.current = audioRef.current ?? new Ctx();
        await audioRef.current?.resume();
      } catch {}
      try {
        await getPosition();
      } catch {
        setError("Allow location access in your browser so the restaurant can see how far away you are.");
        return;
      }
    }
    setBusy(true);
    await sync(next);
    setBusy(false);
  };

  const act = async (action: "accept" | "decline" | "pickup" | "deliver") => {
    if (!order) return;
    const asks: Record<string, string> = {
      pickup: "Did you collect the order?",
      deliver: "Did you hand the order to the customer?",
    };
    if (asks[action] && !window.confirm(asks[action])) return;

    setBusy(true);
    try {
      await apiPost("/api/driver/orders/action", { orderId: order.id, action });
    } catch (e: any) {
      setError(e?.message ?? "Could not update the order");
    } finally {
      await sync();
      setBusy(false);
    }
  };

  if (authLoading || !ready) return <p className="text-gray-400">Loading…</p>;
  if (!isDriver) return null;

  const online = driver?.isOnline === true;
  const stage = order ? STAGE[order.dispatchStatus] : null;
  const btn = "flex-1 rounded-xl py-3 text-sm font-bold disabled:opacity-50";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Driver</h1>
          <p className="text-sm text-gray-400">{driver?.name}</p>
        </div>
        <button onClick={() => sync()} className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-[#FE8C00]">
          Refresh
        </button>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <p className={`font-bold ${online ? "text-green-600" : "text-gray-500"}`}>
            {online ? "You're online" : "You're offline"}
          </p>
          <p className="text-xs text-gray-400">
            {order
              ? "Finish your delivery before going offline."
              : online
                ? "Sharing your location while this tab stays open."
                : "Go online to receive orders."}
          </p>
        </div>
        <button
          onClick={toggleOnline}
          disabled={busy || !!order}
          className={`rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-50 ${online ? "bg-gray-500" : "bg-green-600"}`}
        >
          {online ? "Go offline" : "Go online"}
        </button>
      </div>

      {online && !order && (
        <p className="text-xs text-gray-400">
          Keep this tab open and visible. Browsers pause background tabs, which stops your location updates and offer alerts.
        </p>
      )}

      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</p>}

      {order && stage ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className={`${stage.color} p-4 text-white`}>
            <p className="font-extrabold">{stage.title}</p>
            <p className="text-xs opacity-80">{order.orderNumber}</p>
          </div>

          <div className="space-y-3 p-5 text-sm">
            <div><p className="text-xs text-gray-400">Pick up</p><p className="font-semibold">{order.pickup.address}</p></div>
            <div>
              <p className="text-xs text-gray-400">Drop off{order.tripKm != null ? ` · ${order.tripKm} km from the restaurant` : ""}</p>
              <p className="font-semibold">{order.deliveryAddress || "N/A"}</p>
            </div>
            {order.dispatchStatus !== "offered" && (
              <div>
                <p className="text-xs text-gray-400">Customer</p>
                <p className="font-semibold">{order.customerName} {order.customerPhone && `· ${order.customerPhone}`}</p>
              </div>
            )}
            {order.specialInstructions && (
              <div><p className="text-xs text-gray-400">Notes</p><p className="font-semibold">{order.specialInstructions}</p></div>
            )}

            <ul className="space-y-0.5 border-t pt-3 text-gray-500">
              {order.items.map((i, k) => (
                <li key={k}>· {i.quantity}x {i.name}{i.size ? ` (${i.size})` : ""}</li>
              ))}
            </ul>

            {order.dispatchStatus === "offered" && (
              <div className="flex gap-3 pt-2">
                <button disabled={busy} onClick={() => act("decline")} className={`${btn} border border-red-200 text-red-600`}>Decline</button>
                <button disabled={busy} onClick={() => act("accept")} className={`${btn} bg-green-600 text-white`}>Accept</button>
              </div>
            )}

            {order.dispatchStatus === "accepted" && (
              <div className="space-y-3 pt-2">
                <a href={mapsUrl(order.pickup.lat, order.pickup.lng, order.pickup.address)} target="_blank" rel="noreferrer"
                   className={`${btn} block border border-blue-200 text-center text-blue-600`}>
                  Navigate to the restaurant
                </a>
                <button disabled={busy} onClick={() => act("pickup")} className={`${btn} w-full bg-blue-600 text-white`}>Picked up</button>
              </div>
            )}

            {order.dispatchStatus === "picked_up" && (
              <div className="space-y-3 pt-2">
                <div className="flex gap-3">
                  <a href={mapsUrl(order.deliveryLat, order.deliveryLng, order.deliveryAddress)} target="_blank" rel="noreferrer"
                     className={`${btn} border border-green-200 text-center text-green-700`}>
                    Navigate
                  </a>
                  {order.customerPhone && (
                    <a href={`tel:${order.customerPhone}`} className={`${btn} border border-green-200 text-center text-green-700`}>
                      Call customer
                    </a>
                  )}
                </div>
                <button disabled={busy} onClick={() => act("deliver")} className={`${btn} w-full bg-green-600 text-white`}>Delivered</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="py-12 text-center text-gray-400">{online ? "Waiting for an order…" : "Go online to start"}</p>
      )}
    </div>
  );
}