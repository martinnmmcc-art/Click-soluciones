"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminProvider } from "@/context/AdminContext";

const SECCIONES = [
  { href: "/admin/productos", label: "📦 Productos" },
  { href: "/admin/pedidos", label: "📊 Ventas" },
  { href: "/admin/clientes", label: "👥 Clientes" },
  { href: "/admin/compartir-catalogo", label: "📤 Catálogo" },
  { href: "/admin/notificaciones", label: "🔔 Avisos" }
];

function BarraAdmin() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 overflow-x-auto">
      <div className="flex gap-1 px-3 py-2 min-w-max">
        <Link
          href="/admin"
          className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap ${
            pathname === "/admin" ? "bg-brand-blue text-white" : "text-gray-500 bg-gray-100"
          }`}
        >
          🏠 Panel
        </Link>
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap ${
              pathname.startsWith(s.href) ? "bg-brand-blue text-white" : "text-gray-500 bg-gray-100"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }) {
  return (
    <AdminProvider>
      <BarraAdmin />
      {children}
    </AdminProvider>
  );
}
