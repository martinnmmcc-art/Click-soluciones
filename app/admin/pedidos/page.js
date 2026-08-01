"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import AdminGuard from "@/components/AdminGuard";
import { formatPrice } from "@/lib/whatsapp";

function PanelVentas() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarPedidos() {
      try {
        const res = await fetch("/api/admin/pedidos");
        const result = await res.json();
        if (res.ok) setPedidos(result.pedidos || []);
      } catch (e) {
        console.error(e.message);
      }
      setLoading(false);
    }
    cargarPedidos();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header showSearch={false} />
        <div className="text-center py-20 text-gray-500">Cargando panel de ventas...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <Header showSearch={false} />

      <div className="max-w-4xl mx-auto px-4 mt-6">
        <h1 className="text-2xl font-extrabold text-gray-800 mb-6">Panel de Ventas (Admin)</h1>

        {pedidos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-500">Todavía no hay pedidos registrados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pedidos.map((pedido) => (
              <div key={pedido.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-3">
                  <div>
                    <span className="text-xs font-bold text-brand-blue bg-blue-50 px-2 py-1 rounded-md">
                      Pedido #{pedido.id}
                    </span>
                    <p className="text-sm font-semibold text-gray-800 mt-2">
                      Cliente: {pedido.nombre_cliente || "Sin nombre"} ({pedido.telefono_cliente || "Sin teléfono"})
                    </p>
                    <p className="text-xs text-gray-400">
                      Fecha: {new Date(pedido.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 block">Total Venta</span>
                    <span className="text-lg font-extrabold text-gray-900">${formatPrice(pedido.total)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Productos del carrito:</p>
                  {pedido.items_pedido && pedido.items_pedido.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 p-2.5 rounded-xl">
                      <span className="text-gray-700 font-medium">
                        {item.cantidad}x {item.nombre_producto}
                      </span>
                      <span className="text-gray-900 font-semibold">${formatPrice(item.precio_unitario * item.cantidad)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function AdminPedidosPage() {
  return (
    <AdminGuard>
      <PanelVentas />
    </AdminGuard>
  );
}
