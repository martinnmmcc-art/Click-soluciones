"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminProvider } from "@/context/AdminContext";

function BarraAdmin() {
  const pathname = usePathname();

  // En el dashboard principal no hace falta mostrar el botón para ir a él mismo
  if (pathname === "/admin") return null;

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="px-3 py-2.5">
        <Link
          href="/admin"
          className="flex items-center gap-2 bg-brand-blue text-white text-sm font-bold px-4 py-2 rounded-xl w-fit"
        >
          🏠 Panel de Bolson Click
        </Link>
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
