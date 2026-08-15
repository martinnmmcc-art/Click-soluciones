"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/whatsapp";
import { obtenerTelefonoCliente } from "@/lib/favoritos";

const OPCIONES_ENTREGA_LABEL = {
  pendiente: "Pendiente",
  entregado: "Entregado",
  demorado: "Demorado",
  rechazado: "Rechazado",
  esperando_stock: "Esperando stock",
  cancelado: "Cancelado por vos"
};

const OPCIONES_PAGO_LABEL = {
  falta_pagar: "Falta pagar",
  pagado: "Pagado",
  deuda_parcial: "Deuda parcial",
  a_favor: "A favor",
  señado: "Señado"
};

const COLOR_ENTREGA = {
  pendiente: "bg-yellow-50 text-yellow-700 border-yellow-200",
  entregado: "bg-green-50 text-green-700 border-green-200",
  demorado: "bg-orange-50 text-orange-700 border-orange-200",
  rechazado: "bg-red-50 text-red-700 border-red-200",
  esperando_stock: "bg-purple-50 text-purple-700 border-purple-200",
  cancelado: "bg-gray-100 text-gray-500 border-gray-200"
};

const COLOR_PAGO = {
  falta_pagar: "bg-red-50 text-red-700 border-red-200",
  pagado: "bg-green-50 text-green-700 border-green-200",
  deuda_parcial: "bg-orange-50 text-orange-700 border-orange-200",
  a_favor: "bg-blue-50 text-blue-700 border-blue-200",
  señado: "bg-purple-50 text-purple-700 border-purple-200"
};

export default function CarritoPage() {
  const { items, updateQuantity, removeItem, nota, setNota, total } = useCart();

  const [tab, setTab] = useState("carrito"); // "carrito" | "pedidos"
  const [misPedidos, setMisPedidos] = useState([]);
  const [pedidosLoading, setPedidosLoading] = useState(true);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [telefono, setTelefono] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [itemsEditados, setItemsEditados] = useState({});
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  useEffect(() => {
    const tel = obtenerTelefonoCliente();
    setTelefono(tel);
    if (!tel) {
      setPedidosLoading(false);
      return;
    }
    cargarPedidos(tel);
  }, []);

  async function cargarPedidos(tel) {
    setPedidosLoading(true);
    try {
      const res = await fetch(`/api/mis-pedidos?telefono=${encodeURIComponent(tel)}`);
      const result = await res.json();
      if (res.ok) setMisPedidos(result.pedidos || []);
    } catch (e) {
      console.error(e);
    }
    setPedidosLoading(false);
  }

  async function cancelarPedido(pedidoId) {
    if (!confirm("¿Seguro que querés cancelar este pedido?")) return;
    setCancelandoId(pedidoId);
    try {
      const res = await fetch("/api/mis-pedidos/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: pedidoId, telefono })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo cancelar el pedido.");
        return;
      }
      setMisPedidos((prev) =>
        prev.map((p) => (p.id === pedidoId ? { ...p, estado: "cancelado" } : p))
      );
    } catch (e) {
      alert("Ocurrió un error al cancelar.");
    } finally {
      setCancelandoId(null);
    }
  }

  function empezarEdicion(pedido) {
    setEditandoId(pedido.id);
    const inicial = {};
    (pedido.items_pedido || []).forEach((item) => {
      inicial[item.id] = item.cantidad;
    });
    setItemsEditados(inicial);
  }

  function cambiarCantidadEditada(itemId, delta) {
    setItemsEditados((prev) => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + delta)
    }));
  }

  async function guardarEdicion(pedidoId) {
    setGuardandoEdicion(true);
    try {
      const items = Object.entries(itemsEditados).map(([id, cantidad]) => ({
        id: Number(id),
        cantidad
      }));

      const res = await fetch("/api/mis-pedidos/modificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: pedidoId, telefono, items })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo modificar el pedido.");
        return;
      }
      setEditandoId(null);
      cargarPedidos(telefono);
    } catch (e) {
      alert("Ocurrió un error al guardar los cambios.");
    } finally {
      setGuardandoEdicion(false);
    }
  }

  return (
    <main className="pb-6">
      <Header showSearch={false} />

      <div className="px-4 mt-4">
        {/* PESTAÑAS GRANDES */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={() => setTab("carrito")}
            className={`py-3 rounded-xl text-sm font-bold transition ${
              tab === "carrito" ? "bg-brand-blue text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            🛒 Carrito {items.length > 0 && `(${items.length})`}
          </button>
          <button
            onClick={() => setTab("pedidos")}
            className={`py-3 rounded-xl text-sm font-bold transition ${
              tab === "pedidos" ? "bg-brand-blue text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            📦 Mis Pedidos {misPedidos.length > 0 && `(${misPedidos.length})`}
          </button>
        </div>

        {/* ---------- TAB CARRITO ---------- */}
        {tab === "carrito" && (
          items.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">
              <p className="text-4xl mb-3">🛒</p>
              <p>Tu carrito está vacío.</p>
              <Link href="/catalogo" className="btn-primary inline-block mt-4">
                Ver catálogo
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <div key={item.id} className="card p-3 flex gap-3 items-center">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      {item.imagen_url ? (
                        <Image
                          src={item.imagen_url}
                          alt={item.nombre}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">
                          📦
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 line-clamp-2">
                        {item.nombre}
                      </p>
                      <p className="text-brand-blueDark font-bold text-sm mt-1">
                        ${formatPrice(item.precio)}
                      </p>

                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-50"
                          >
                            −
                          </button>
                          <span className="px-3 text-sm font-semibold">
                            {item.cantidad}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                            disabled={item.stock !== null && item.stock !== undefined && item.cantidad >= Number(item.stock)}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-xs text-red-500 font-medium"
                        >
                          Eliminar
                        </button>
                      </div>
                      {item.stock !== null && item.stock !== undefined && item.cantidad >= Number(item.stock) && (
                        <p className="text-[11px] text-orange-600 font-semibold mt-1">
                          Llegaste al stock disponible ({item.stock})
                        </p>
                      )}
                    </div>

                    <div className="text-sm font-bold text-gray-700 whitespace-nowrap">
                      ${formatPrice(item.precio * item.cantidad)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Nota para tu pedido (opcional)
                </label>
                <textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  rows={3}
                  placeholder="Ej: llamar antes de entregar, color preferido, etc."
                  className="input-field resize-none"
                />
              </div>

              <div className="card p-4 mt-5 flex items-center justify-between">
                <span className="font-semibold text-gray-700">Total</span>
                <span className="text-xl font-extrabold text-brand-blueDark">
                  ${formatPrice(total)}
                </span>
              </div>

              <Link href="/checkout" className="btn-primary block text-center mt-4">
                Continuar con la compra
              </Link>
            </>
          )
        )}

        {/* ---------- TAB MIS PEDIDOS ---------- */}
        {tab === "pedidos" && (
          <>
            {!telefono ? (
              <div className="card p-6 text-center">
                <p className="text-sm text-gray-600 mb-3">Iniciá sesión para ver tus pedidos.</p>
                <Link href="/login" className="btn-primary inline-block">
                  Iniciar sesión
                </Link>
              </div>
            ) : pedidosLoading ? (
              <p className="text-center text-gray-400 text-sm py-10">Cargando tus pedidos...</p>
            ) : misPedidos.length === 0 ? (
              <div className="card p-6 text-center text-gray-400 text-sm">
                Todavía no hiciste ningún pedido.
              </div>
            ) : (
              <div className="space-y-3">
                {misPedidos.map((pedido) => {
                  const saldo = Number(pedido.total || 0) - Number(pedido.monto_pagado || 0);
                  return (
                    <div key={pedido.id} className="card p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs font-bold text-brand-blue bg-blue-50 px-2 py-1 rounded-md">
                            Pedido #{pedido.id}
                          </span>
                          <p className="text-xs text-gray-400 mt-1.5">
                            {new Date(pedido.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-base font-extrabold text-gray-900">
                          ${formatPrice(pedido.total)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className={`text-[11px] font-semibold border rounded-lg px-2 py-1 ${COLOR_ENTREGA[pedido.estado] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
                          {OPCIONES_ENTREGA_LABEL[pedido.estado] || "Pendiente"}
                        </span>
                        <span className={`text-[11px] font-semibold border rounded-lg px-2 py-1 ${COLOR_PAGO[pedido.estado_pago] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
                          {OPCIONES_PAGO_LABEL[pedido.estado_pago] || "Falta pagar"}
                        </span>
                      </div>

                      {saldo > 0 && (
                        <p className="text-xs font-bold text-red-700 mb-2">Debés ${formatPrice(saldo)}</p>
                      )}
                      {saldo < 0 && (
                        <p className="text-xs font-bold text-blue-700 mb-2">A favor ${formatPrice(Math.abs(saldo))}</p>
                      )}
                      {saldo === 0 && (
                        <p className="text-xs font-bold text-green-700 mb-2">Saldado ✅</p>
                      )}

                      {editandoId === pedido.id ? (
                        <div className="border-t border-gray-100 pt-2 mt-2 space-y-2">
                          {(pedido.items_pedido || []).map((item) => {
                            const cantidadActual = itemsEditados[item.id] ?? item.cantidad;
                            return (
                              <div key={item.id} className="flex items-center justify-between gap-2">
                                <span className="text-xs text-gray-700 flex-1 line-clamp-1">
                                  {item.nombre_producto}
                                </span>
                                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden flex-shrink-0">
                                  <button
                                    onClick={() => cambiarCantidadEditada(item.id, -1)}
                                    className="px-2 py-0.5 text-gray-600 hover:bg-gray-50"
                                  >
                                    −
                                  </button>
                                  <span className={`px-2.5 text-xs font-bold ${cantidadActual === 0 ? "text-red-500" : ""}`}>
                                    {cantidadActual}
                                  </span>
                                  <button
                                    onClick={() => cambiarCantidadEditada(item.id, 1)}
                                    className="px-2 py-0.5 text-gray-600 hover:bg-gray-50"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          <p className="text-[11px] text-gray-400">Poné un ítem en 0 para eliminarlo.</p>

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => guardarEdicion(pedido.id)}
                              disabled={guardandoEdicion}
                              className="btn-primary flex-1 text-xs py-2 disabled:opacity-50"
                            >
                              {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                            </button>
                            <button
                              onClick={() => setEditandoId(null)}
                              className="flex-1 bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded-xl"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                          {pedido.items_pedido && pedido.items_pedido.map((item) => (
                            <div key={item.id} className="flex justify-between text-xs text-gray-600">
                              <span>{item.cantidad}x {item.nombre_producto}</span>
                              <span className="font-medium">${formatPrice(item.precio_unitario * item.cantidad)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {pedido.comprobante_url && (
                        <a
                          href={pedido.comprobante_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs font-bold text-green-700 mt-3"
                        >
                          📎 Ver comprobante que subiste
                        </a>
                      )}

                      {(!pedido.estado || pedido.estado === "pendiente") && editandoId !== pedido.id && (
                        <div className="flex gap-3 mt-3">
                          <button
                            onClick={() => empezarEdicion(pedido)}
                            className="text-xs font-semibold text-brand-blue"
                          >
                            ✏️ Modificar pedido
                          </button>
                          <button
                            onClick={() => cancelarPedido(pedido.id)}
                            disabled={cancelandoId === pedido.id}
                            className="text-xs font-semibold text-red-500 disabled:opacity-50"
                          >
                            {cancelandoId === pedido.id ? "Cancelando..." : "Cancelar pedido"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
