"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminProvider, useAdmin } from "@/context/AdminContext";
import DatosSiempreAlDia from "@/components/DatosSiempreAlDia";
import BotonSinSenal from "@/components/BotonSinSenal";

// Barra fija arriba de todas las pantallas del panel:
//  - El aviso de conexión/actualización ("🟢 Al día · recién"), siempre visible.
//  - El botón para volver al Panel (menos en el Panel mismo).
//  - El botón para preparar la app sin señal, en todas las pantallas.
function BarraAdmin() {
  const pathname = usePathname();
  const { isAdmin } = useAdmin();
  const esPanel = pathname === "/admin";

  if (!isAdmin && esPanel) return null;

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
      {isAdmin && <DatosSiempreAlDia />}
      {/* Volver al panel + preparar sin señal: a mano en todas las pantallas */}
      {(isAdmin || !esPanel) && (
        <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          {!esPanel ? (
            <Link
              href="/admin"
              className="flex items-center gap-2 bg-brand-blue text-white text-sm font-bold px-4 py-2 rounded-xl w-fit"
            >
              🏠 Panel de Bolson Click
            </Link>
          ) : (
            <span className="text-sm font-extrabold text-gray-800">🏠 Panel</span>
          )}
          {isAdmin && <BotonSinSenal />}
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
