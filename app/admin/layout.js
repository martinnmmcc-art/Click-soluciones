"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminProvider, useAdmin } from "@/context/AdminContext";
import DatosSiempreAlDia from "@/components/DatosSiempreAlDia";

// Barra fija arriba de todas las pantallas del panel:
//  - El aviso de conexión/actualización ("🟢 Al día · recién"), siempre visible.
//  - El botón para volver al Panel (menos en el Panel mismo).
function BarraAdmin() {
  const pathname = usePathname();
  const { isAdmin } = useAdmin();
  const esPanel = pathname === "/admin";

  if (!isAdmin && esPanel) return null;

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
      {isAdmin && <DatosSiempreAlDia />}
      {!esPanel && (
        <div className="px-3 py-2">
          <Link
            href="/admin"
            className="flex items-center gap-2 bg-brand-blue text-white text-sm font-bold px-4 py-2 rounded-xl w-fit"
          >
            🏠 Panel de Bolson Click
          </Link>
        </div>
      )}
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
