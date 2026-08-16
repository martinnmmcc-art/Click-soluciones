"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { useAdmin } from "@/context/AdminContext";

function Dashboard() {
  const { logout } = useAdmin();
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch("/api/admin/estadisticas");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar estadísticas");
        setM(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

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

        {loading ? (
          <div className="card p-6 text-center text-gray-400 text-sm mb-6">Cargando números...</div>
        ) : error ? (
          <div className="card p-4 text-center text-red-500 text-sm mb-6 bg-red-50 border border-red-200">{error}</div>
        ) : (
          <>
            {/* RESUMEN RÁPIDO */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="card p-4 bg-brand-blue">
                <p className="text-blue-100 text-xs font-semibold">Ventas este mes</p>
                <p className="text-white text-xl font-extrabold mt-1">
                  ${m.ventasMes.toLocaleString("es-AR")}
                </p>
                <p className="text-blue-100 text-[11px] mt-0.5">{m.cantidadPedidosMes} pedidos</p>
              </div>

              <div className="card p-4 bg-white border-2 border-amber-400">
                <p className="text-amber-700 text-xs font-semibold">Pedidos pendientes</p>
                <p className="text-amber-600 text-xl font-extrabold mt-1">{m.pedidosPendientes}</p>
                <Link href="/admin/pedidos" className="text-brand-blue text-[11px] mt-0.5 underline font-semibold">
                  Ver todos →
                </Link>
              </div>

              <div className="card p-4">
                <p className="text-gray-500 text-xs font-semibold">Clientes nuevos (mes)</p>
                <p className="text-gray-800 text-xl font-extrabold mt-1">{m.clientesNuevosMes}</p>
                <p className="text-gray-400 text-[11px] mt-0.5">{m.clientesTotal} en total</p>
              </div>

              <div className="card p-4">
                <p className="text-gray-500 text-xs font-semibold">Sin stock</p>
                <p className="text-red-600 text-xl font-extrabold mt-1">{m.sinStock}</p>
                <p className="text-gray-400 text-[11px] mt-0.5">productos agotados</p>
              </div>
            </div>

            {/* ESTADÍSTICAS DEL MES: PLATA */}
            <div className="card p-4 mb-4">
              <p className="font-bold text-gray-800 text-sm mb-3">💰 Estadísticas del mes</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Ventas totales</span>
                  <span className="font-bold text-gray-800">${m.ventasMes.toLocaleString("es-AR")}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Gastado en materiales</span>
                  <span className="font-bold text-gray-700">-${m.costoMateriales.toLocaleString("es-AR")}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Gastado en fletes</span>
                  <span className="font-bold text-gray-700">-${m.gastoFletes.toLocaleString("es-AR")}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2 mt-1">
                  <span className="text-gray-800 font-semibold">Ganancia estimada</span>
                  <span className={`font-extrabold ${m.ganancia >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${m.ganancia.toLocaleString("es-AR")}
                  </span>
                </div>
              </div>
            </div>

            {/* RANKING DE VENTAS */}
            <div className="card p-4 mb-4">
              <p className="font-bold text-gray-800 text-sm mb-3">🔥 Más vendidos este mes</p>
              {m.rankingVendidos.length === 0 ? (
                <p className="text-gray-400 text-sm">Todavía no hay ventas este mes</p>
              ) : (
                <div className="space-y-2">
                  {m.rankingVendidos.map((item, i) => (
                    <div key={item.nombre} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 font-bold w-4">{i + 1}°</span>
                      <span className="flex-1 text-gray-700 line-clamp-1">{item.nombre}</span>
                      <span className="font-bold text-brand-blue">{item.cantidad}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-4 mb-6 flex justify-around text-center">
              <div>
                <p className="text-gray-800 text-lg font-extrabold">{m.productosActivos}</p>
                <p className="text-gray-400 text-[11px]">En catálogo</p>
              </div>
              <div>
                <p className="text-gray-800 text-lg font-extrabold">{m.productosAPedido}</p>
                <p className="text-gray-400 text-[11px]">A pedido</p>
              </div>
            </div>
          </>
        )}

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

          <Link href="/admin/pedidos" className="card p-5 flex items-center justify-between hover:shadow-md">
            <div>
              <p className="font-semibold text-gray-800">Ventas</p>
              <p className="text-sm text-gray-500">
                Gestionar pedidos, pagos y comprobantes
              </p>
            </div>
            <span className="text-2xl">📊</span>
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

          <Link href="/admin/a-pedido" className="card p-5 flex items-center justify-between hover:shadow-md">
            <div>
              <p className="font-semibold text-gray-800">A pedido</p>
              <p className="text-sm text-gray-500">
                Productos del proveedor que no tenés en stock, para pedir bajo consulta
              </p>
            </div>
            <span className="text-2xl">🛍️</span>
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
