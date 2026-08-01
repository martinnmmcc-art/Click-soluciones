"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import AdminGuard from "@/components/AdminGuard";
import { formatPrice } from "@/lib/whatsapp";

const OPCIONES_ENTREGA = [
  { value: "pendiente", label: "Pendiente" },
  { value: "entregado", label: "Entregado" },
  { value: "demorado", label: "Demorado" },
  { value: "rechazado", label: "Rechazado" },
];

const OPCIONES_PAGO = [
  { value: "falta_pagar", label: "Falta pagar" },
  { value: "pagado", label: "Pagado" },
  { value: "deuda_parcial", label: "Deuda parcial" },
  { value: "a_favor", label: "A favor" },
];

const COLOR_ENTREGA = {
  pendiente: "bg-yellow-50 text-yellow-700 border-yellow-200",
  entregado: "bg-green-50 text-green-700 border-green-200",
  demorado: "bg-orange-50 text-orange-700 border-orange-200",
  rechazado: "bg-red-50 text-red-700 border-red-200",
};

const COLOR_PAGO = {
  falta_pagar: "bg-red-50 text-red-700 border-red-200",
  pagado: "bg-green-50 text-green-700 border-green-200",
  deuda_parcial: "bg-orange-50 text-orange-700 border-orange-200",
  a_favor: "bg-blue-50 text-blue-700 border-blue-200",
};

function PanelVentas() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardandoId, setGuardandoId] = useState(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

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

  async function actualizarEstado(pedidoId, campo, valor) {
    setPedidos((prev) =>
      prev.map((p) => (p.id === pedidoId ? { ...p, [campo]: valor } : p))
    );
    setGuardandoId(pedidoId);

    try {
      const res = await fetch("/api/admin/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pedidoId, [campo]: valor }),
      });
      const result = await res.json();

      if (!res.ok) {
        alert("No se pudo guardar el cambio: " + result.error);
      }
    } catch (e) {
      alert("Error de conexión al guardar el cambio.");
    }
    setGuardandoId(null);
  }

  // Agrupa los pedidos por teléfono de cliente y suma los saldos
  function calcularResumenClientes(lista) {
    const grupos = {};
    lista.forEach((p) => {
      const clave = p.telefono_cliente || "sin_telefono_" + p.id;
      if (!grupos[clave]) {
        grupos[clave] = {
          telefono: p.telefono_cliente || "Sin teléfono",
          nombre: p.nombre_cliente || "Sin nombre",
          cantidadPedidos: 0,
          saldoNeto: 0,
        };
      }
      grupos[clave].cantidadPedidos += 1;
      grupos[clave].saldoNeto += Number(p.total || 0) - Number(p.monto_pagado || 0);
    });
    return Object.values(grupos).sort((a, b) => b.saldoNeto - a.saldoNeto);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header showSearch={false} />
        <div className="text-center py-20 text-gray-500">Cargando panel de ventas...</div>
      </main>
    );
  }

  const resumenClientes = calcularResumenClientes(pedidos);
  const pedidosMostrados = clienteSeleccionado
    ? pedidos.filter((p) => (p.telefono_cliente || "Sin teléfono") === clienteSeleccionado)
    : pedidos;

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <Header showSearch={false} />

      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold text-gray-800">Panel de Ventas (Admin)</h1>
          <span className="text-sm font-bold text-brand-blue bg-blue-50 px-3 py-1.5 rounded-full">
            Tenés {pedidos.length} pedido{pedidos.length === 1 ? "" : "s"}
          </span>
        </div>

        {resumenClientes.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Resumen por cliente
            </p>
            <div className="space-y-2">
              {resumenClientes.map((c) => (
                <button
                  key={c.telefono}
                  onClick={() =>
                    setClienteSeleccionado(
                      clienteSeleccionado === c.telefono ? null : c.telefono
                    )
                  }
                  className={`w-full flex justify-between items-center text-sm text-left p-2 rounded-xl transition-colors ${
                    clienteSeleccionado === c.telefono ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="text-gray-700 font-medium">
                    {c.nombre} ({c.telefono}){" "}
                    <span className="text-gray-400 font-normal">
                      · {c.cantidadPedidos} pedido{c.cantidadPedidos === 1 ? "" : "s"}
                    </span>
                  </span>
                  {c.saldoNeto > 0 && (
                    <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                      Debe ${formatPrice(c.saldoNeto)}
                    </span>
                  )}
                  {c.saldoNeto < 0 && (
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                      A favor ${formatPrice(Math.abs(c.saldoNeto))}
                    </span>
                  )}
                  {c.saldoNeto === 0 && (
                    <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg">
                      Saldado
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {clienteSeleccionado && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              Mostrando pedidos de <span className="font-semibold text-gray-700">{clienteSeleccionado}</span>
            </p>
            <button
              onClick={() => setClienteSeleccionado(null)}
              className="text-xs font-bold text-brand-blue bg-blue-50 px-3 py-1.5 rounded-full"
            >
              Ver todos
            </button>
          </div>
        )}

        {pedidosMostrados.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-500">
              {clienteSeleccionado ? "Este cliente no tiene pedidos." : "Todavía no hay pedidos registrados."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pedidosMostrados.map((pedido) => (
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

                {/* Selectores de estado */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                      Entrega
                    </label>
                    <select
                      value={pedido.estado || "pendiente"}
                      onChange={(e) => actualizarEstado(pedido.id, "estado", e.target.value)}
                      disabled={guardandoId === pedido.id}
                      className={`text-xs font-semibold border rounded-lg px-2 py-1.5 ${COLOR_ENTREGA[pedido.estado] || "bg-gray-50 text-gray-700 border-gray-200"}`}
                    >
                      {OPCIONES_ENTREGA.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                      Pago
                    </label>
                    <select
                      value={pedido.estado_pago || "falta_pagar"}
                      onChange={(e) => actualizarEstado(pedido.id, "estado_pago", e.target.value)}
                      disabled={guardandoId === pedido.id}
                      className={`text-xs font-semibold border rounded-lg px-2 py-1.5 ${COLOR_PAGO[pedido.estado_pago] || "bg-gray-50 text-gray-700 border-gray-200"}`}
                    >
                      {OPCIONES_PAGO.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Monto pagado y saldo */}
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                      Monto pagado
                    </label>
                    <input
                      key={pedido.id + "-" + pedido.monto_pagado}
                      type="number"
                      step="0.01"
                      defaultValue={pedido.monto_pagado || 0}
                      disabled={guardandoId === pedido.id}
                      onBlur={(e) => {
                        const valor = parseFloat(e.target.value) || 0;
                        if (valor !== (pedido.monto_pagado || 0)) {
                          actualizarEstado(pedido.id, "monto_pagado", valor);
                        }
                      }}
                      className="text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1.5 w-28"
                    />
                  </div>

                  {(() => {
                    const saldo = Number(pedido.total || 0) - Number(pedido.monto_pagado || 0);
                    if (saldo > 0) {
                      return (
                        <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                          Debe ${formatPrice(saldo)}
                        </span>
                      );
                    }
                    if (saldo < 0) {
                      return (
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                          A favor ${formatPrice(Math.abs(saldo))}
                        </span>
                      );
                    }
                    return (
                      <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                        Saldado
                      </span>
                    );
                  })()}
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
