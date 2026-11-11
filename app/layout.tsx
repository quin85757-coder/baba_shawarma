import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import StatusBanner from "@/components/StatusBanner";

export const metadata: Metadata = {
    title: "Baba Shawarma",
    description: "Order fresh shawarma online",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <body className="bg-[#F9F9F8] text-gray-900">
        <Navbar />
        <StatusBanner />
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </body>
        </html>
    );
}