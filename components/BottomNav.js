"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";

const TABS = [
  { href: "/", icon: "🏠", label: "Inicio" },
  { href: "/catalogo", icon: "🗂️", label: "Catálogo" },
  { href: "/carrito", icon: "🛒", label: "Carrito" },
  { href: "/login", icon: "👤", label: "Cuenta" }
];

export default function BottomNav() {
  const pathname = usePathname();
  const { cantidadTotal } = useCart();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex justify-around py-2 md:hidden">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex flex-col items-center px-3 py-1 text-xs font-medium ${
              active ? "text-brand-blue" : "text-gray-400"
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            {tab.href === "/carrito" && cantidadTotal > 0 && (
              <span className="absolute top-0 right-1 bg-brand-orange text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {cantidadTotal}
              </span>
            )}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
