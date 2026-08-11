"use client";

import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { useAdmin } from "@/context/AdminContext";

function Dashboard() {
  const { logout } = useAdmin();

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="container-app px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-extrabold text-xl text-gray-800">
            Panel de Bolson Click
          </h1>
          <button onClick={logout} className="text-sm text-red-500 font-medium">
            Salir
          </button>
        </div>

        <div className="grid gap-3">
          <Link href="/admin/productos" className="card p-5 flex items-center justify-between hover:shadow-md">
            <div>
              <p className="font-semibold text-gray-800">Productos</p>
              <p className="text-sm text-gray-500">
                Crear, editar y eliminar productos del catálogo
              </p>
            </div>
            <span className="text-2xl">📦</span>
          </Link>

          <Link href="/admin/clientes" className="card p-5 flex items-center justify-between hover:shadow-md">
            <div>
              <p className="font-semibold text-gray-800">Clientes</p>
              <p className="text-sm text-gray-500">
                Ver quién se registró y agregar clientes a mano
              </p>
            </div>
            <span className="text-2xl">👥</span>
          </Link>

          <Link href="/admin/compartir-catalogo" className="card p-5 flex items-center justify-between hover:shadow-md">
            <div>
              <p className="font-semibold text-gray-800">Compartir catálogo</p>
              <p className="text-sm text-gray-500">
                Armá un catálogo con los productos que quieras y compartilo por WhatsApp
              </p>
            </div>
            <span className="text-2xl">📤</span>
          </Link>

          <Link href="/admin/notificaciones" className="card p-5 flex items-center justify-between hover:shadow-md">
            <div>
              <p className="font-semibold text-gray-800">Notificaciones</p>
              <p className="text-sm text-gray-500">
                Avisar a tus clientes de ofertas, novedades o recordatorios
              </p>
            </div>
            <span className="text-2xl">🔔</span>
          </Link>

          <Link href="/" className="card p-5 flex items-center justify-between hover:shadow-md">
            <div>
              <p className="font-semibold text-gray-800">Ver tienda</p>
              <p className="text-sm text-gray-500">Ir a la vista pública</p>
            </div>
            <span className="text-2xl">🏠</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <Dashboard />
    </AdminGuard>
  );
}
