"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { useAdmin } from "@/context/AdminContext";
import { supabase } from "@/lib/supabaseClient";

function Dashboard() {
  const { logout } = useAdmin();
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarMetricas() {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const inicioMesISO = inicioMes.toISOString();

      const [pedidosMesRes, pedidosPendientesRes, clientesMesRes, clientesTotalRes, productosRes, itemsMesRes] =
        await Promise.all([
          supabase.from("pedidos").select("total, estado").gte("created_at", inicioMesISO),
          supabase.from("pedidos").select("id", { count: "exact", head: true }).or("estado.is.null,estado.eq.pendiente"),
          supabase.from("clientes").select("id", { count: "exact", head: true }).gte("created_at", inicioMesISO),
          supabase.from("clientes").select("id", { count: "exact", head: true }),
          supabase.from("Productos").select("id, bajo_pedido, activo, stock"),
          supabase.from("items_pedido").select("nombre_producto, cantidad, pedido_id, pedidos!inner(created_at)").gte("pedidos.created_at", inicioMesISO)
        ]);

      const pedidosMes = (pedidosMesRes.data || []).filter((p) => p.estado !== "cancelado");
      const ventasMes = pedidosMes.reduce((acc, p) => acc + Number(p.total || 0), 0);

      const productos = productosRes.data || [];
      const productosActivos = productos.filter((p) => p.activo && !p.bajo_pedido).length;
      const productosAPedido = productos.filter((p) => p.bajo_pedido).length;
      const sinStock = productos.filter((p) => !p.bajo_pedido && p.stock !== null && Number(p.stock) <= 0).length;

      const conteoVendidos = {};
      (itemsMesRes.data || []).forEach((item) => {
        conteoVendidos[item.nombre_producto] = (conteoVendidos[item.nombre_producto] || 0) + Number(item.cantidad || 0);
      });
      const masVendido = Object.entries(conteoVendidos).sort((a, b) => b[1] - a[1])[0];

      setMetricas({
        ventasMes,
        cantidadPedidosMes: pedidosMes.length,
        pedidosPendientes: pedidosPendientesRes.count || 0,
        clientesNuevosMes: clientesMesRes.count || 0,
        clientesTotal: clientesTotalRes.count || 0,
        productosActivos,
        productosAPedido,
        sinStock,
        masVendido: masVendido ? { nombre: masVendido[0], cantidad: masVendido[1] } : null
      });
      setLoading(false);
    }
    cargarMetricas();
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

        {/* DASHBOARD DE MÉTRICAS */}
        {loading ? (
          <div className="card p-6 text-center text-gray-400 text-sm mb-6">Cargando números...</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="card p-4 bg-brand-blue">
              <p className="text-blue-100 text-xs font-semibold">Ventas este mes</p>
              <p className="text-white text-xl font-extrabold mt-1">
                ${metricas.ventasMes.toLocaleString("es-AR")}
              </p>
              <p className="text-blue-100 text-[11px] mt-0.5">{metricas.cantidadPedidosMes} pedidos</p>
            </div>

            <div className="card p-4 bg-yellow-500">
              <p className="text-yellow-50 text-xs font-semibold">Pedidos pendientes</p>
              <p className="text-white text-xl font-extrabold mt-1">{metricas.pedidosPendientes}</p>
              <Link href="/admin/pedidos" className="text-yellow-50 text-[11px] mt-0.5 underline">
                Ver todos →
              </Link>
            </div>

            <div className="card p-4">
              <p className="text-gray-500 text-xs font-semibold">Clientes nuevos (mes)</p>
              <p className="text-gray-800 text-xl font-extrabold mt-1">{metricas.clientesNuevosMes}</p>
              <p className="text-gray-400 text-[11px] mt-0.5">{metricas.clientesTotal} en total</p>
            </div>

            <div className="card p-4">
              <p className="text-gray-500 text-xs font-semibold">Sin stock</p>
              <p className="text-red-600 text-xl font-extrabold mt-1">{metricas.sinStock}</p>
              <p className="text-gray-400 text-[11px] mt-0.5">productos agotados</p>
            </div>

            <div className="card p-4 col-span-2">
              <p className="text-gray-500 text-xs font-semibold">🔥 Más vendido este mes</p>
              {metricas.masVendido ? (
                <p className="text-gray-800 text-sm font-bold mt-1 line-clamp-1">
                  {metricas.masVendido.nombre} <span className="text-gray-400 font-normal">({metricas.masVendido.cantidad} vendidos)</span>
                </p>
              ) : (
                <p className="text-gray-400 text-sm mt-1">Todavía no hay ventas este mes</p>
              )}
            </div>

            <div className="card p-4 col-span-2 flex justify-around text-center">
              <div>
                <p className="text-gray-800 text-lg font-extrabold">{metricas.productosActivos}</p>
                <p className="text-gray-400 text-[11px]">En catálogo</p>
              </div>
              <div>
                <p className="text-gray-800 text-lg font-extrabold">{metricas.productosAPedido}</p>
                <p className="text-gray-400 text-[11px]">A pedido</p>
              </div>
            </div>
          </div>
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
