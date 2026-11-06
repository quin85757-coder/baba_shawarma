"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import MenuGrid from "@/components/MenuGrid";
import { getCategories, getMenu } from "@/lib/ordersService";
import { RESTAURANT } from "@/lib/restaurant";

export default function Home() {
  const [categories, setCategories] = useState<any[]>([]);
  const [popular, setPopular] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
    getMenu({ limit: 8 })
        .then(setPopular)
        .catch(console.error)
        .finally(() => setLoading(false));
  }, []);

  return (
      <div className="space-y-10">
        {/* Hero */}
        <section className="rounded-3xl bg-gradient-to-br from-[#FE8C00] to-[#F97316] px-8 py-14 text-white md:px-14">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-100">
            Arcadia · Pretoria
          </p>
          <h1 className="mt-3 max-w-xl text-4xl font-extrabold leading-tight md:text-5xl">
            Fresh shawarma, hot and fast.
          </h1>
          <p className="mt-4 max-w-lg text-orange-50">
            Order online for delivery or collect it yourself. Pay securely with PayFast.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/menu" className="rounded-full bg-white px-7 py-3 font-bold text-[#FE8C00]">
              Order now
            </Link>
            <a
                href={`tel:${RESTAURANT.phoneTel}`}
                className="rounded-full border border-white/60 px-7 py-3 font-bold text-white"
            >
              Call {RESTAURANT.phone}
            </a>
          </div>
        </section>

        {/* Info strip */}
        <section className="grid gap-4 md:grid-cols-3">
          {[
            { title: "Delivery or pick-up", text: "Choose what suits you at checkout." },
            { title: "Find us", text: RESTAURANT.address },
            { title: "Track your order", text: "Follow its status from My Orders." },
          ].map((c) => (
              <div key={c.title} className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="font-bold">{c.title}</p>
                <p className="mt-1 text-sm text-gray-500">{c.text}</p>
              </div>
          ))}
        </section>

        {/* Categories */}
        {categories.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-extrabold">Browse by category</h2>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                    <Link
                        key={c.$id}
                        href={`/menu?category=${encodeURIComponent(c.name)}`}
                        className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:text-[#FE8C00]"
                    >
                      {c.name}
                    </Link>
                ))}
              </div>
            </section>
        )}

        {/* Popular */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">Popular right now</h2>
            <Link href="/menu" className="text-sm font-semibold text-[#FE8C00]">
              See full menu →
            </Link>
          </div>
          {loading ? <p className="text-gray-400">Loading…</p> : <MenuGrid items={popular} />}
        </section>
      </div>
  );
}