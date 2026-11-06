export const RESTAURANT_COORDS = {
  lat: -25.7444099,
  lng: 28.203544,
  address: "175 Steve Biko Rd, Arcadia, Pretoria, 0007",
};

// Straight-line distance in km (good enough for ranking drivers)
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

// Rough bounding box for South Africa, so junk coordinates are ignored
export function inSouthAfrica(lat: number, lng: number) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -35.5 && lat <= -21.5 && lng >= 16 && lng <= 33.5
  );
}

// Looks an address up on OpenStreetMap. Returns null if nothing sensible comes back.
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=za`,
      {
        headers: {
          "User-Agent": `BabaShawarma/1.0 (${process.env.NEXT_PUBLIC_SITE_URL ?? "restaurant ordering"})`,
          "Accept-Language": "en",
        },
        signal: ctrl.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const rows = await res.json();
    const lat = Number(rows?.[0]?.lat);
    const lng = Number(rows?.[0]?.lon);
    return inSouthAfrica(lat, lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}