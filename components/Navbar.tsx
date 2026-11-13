"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";

const STAFF_LINKS = [
  { href: "/staff", label: "Dashboard" },
  { href: "/staff/orders", label: "Orders" },
  { href: "/staff/customers", label: "Customers" },
];
const ADMIN_LINKS = [
  { href: "/admin/people", label: "People" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/promos", label: "Promotions" },
];

export default function Navbar() {
  const { user, isStaff, isAdmin, isDriver, loading, fetchUser } = useAuthStore();
  const count = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (loading) return;
    const staffArea = pathname.startsWith("/staff") || pathname.startsWith("/admin");

    // Staff and admins don't shop. Customers can't open the staff area.
    if (isStaff && !staffArea && pathname !== "/profile") router.replace("/staff");
    else if (!isStaff && staffArea) router.replace(user ? "/" : "/sign-in");
    // Only admins open /admin
    else if (isStaff && !isAdmin && pathname.startsWith("/admin")) router.replace("/staff");
    // Only drivers open /driver
    else if (!isDriver && pathname.startsWith("/driver")) router.replace(user ? "/" : "/sign-in");
  }, [loading, isStaff, isAdmin, isDriver, user, pathname, router]);

  const linkClass = (href: string) =>
    pathname === href || pathname.startsWith(href + "/") ? "text-[#FE8C00]" : "hover:text-[#FE8C00]";

  const profileLink = user && (
    <Link href="/profile" className="flex items-center gap-2 hover:text-[#FE8C00]">
      {user.avatar && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
      )}
      {user.name?.split(" ")[0] ?? "Account"}
    </Link>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
        <Link
          href={isStaff ? "/staff" : "/"}
          className="flex items-center gap-2 text-xl font-extrabold text-[#FE8C00]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
          BABASHAWARMA
          {isStaff && (
            <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {isAdmin ? "Admin" : "Staff"}
            </span>
          )}
        </Link>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-gray-700">
          {isStaff ? (
            <>
              {[...STAFF_LINKS, ...(isAdmin ? ADMIN_LINKS : [])].map((l) => (
                <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                  {l.label}
                </Link>
              ))}
              {profileLink}
            </>
          ) : (
            <>
              <Link href="/" className="hover:text-[#FE8C00]">Menu</Link>
              {isDriver && <Link href="/driver" className={linkClass("/driver")}>Driver</Link>}
              {user && <Link href="/favourites" className="hover:text-[#FE8C00]">Favourites</Link>}
              {user && <Link href="/orders" className="hover:text-[#FE8C00]">My Orders</Link>}
              <Link href="/cart" className="hover:text-[#FE8C00]">
                Cart
                {count > 0 && (
                  <span className="ml-1 rounded-full bg-[#FE8C00] px-2 py-0.5 text-xs text-white">{count}</span>
                )}
              </Link>
              {user ? (
                profileLink
              ) : (
                <Link href="/sign-in" className="rounded-full bg-[#FE8C00] px-4 py-2 text-white">
                  Sign in
                </Link>
              )}
            </>
          )}
        </div>
      </nav>
    </header>
  );
}