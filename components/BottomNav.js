"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";

// Menú de abajo en el celular. El carrito vive acá (arriba el lugar es para
// los envíos, el WhatsApp y las redes) y "A pedido" tiene su propio botón:
// son miles de productos que mucha gente ni sabía que podía pedir.
const TABS = [
  { href: "/", icon: "🏠", label: "Inicio" },
  { href: "/catalogo", icon: "🗂️", label: "Catálogo" },
  { href: "/a-pedido", icon: "🛍️", label: "A pedido" },
  { href: "/carrito", icon: "🛒", label: "Carrito", carrito: true },
  { href: "/login", icon: "👤", label: "Cuenta" }
];

export default function BottomNav() {
  const pathname = usePathname();
  const { cantidadTotal } = useCart();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex justify-around pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Menú"
    >
      {TABS.map((tab) => {
        // exacto para "/" y startsWith para el resto (soporta rutas anidadas)
        const active = tab.href === "/" ? pathname === "/" : pathname?.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex flex-col items-center px-2 py-0.5 text-[11px] font-semibold ${
              active ? "text-brand-blue" : "text-gray-500"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span className="text-lg leading-tight">{tab.icon}</span>
            {tab.label}
            {tab.carrito && cantidadTotal > 0 && (
              <span className="absolute -top-0.5 right-0 bg-brand-orange text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                {cantidadTotal}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
