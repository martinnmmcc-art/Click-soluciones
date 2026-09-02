"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import Header from "@/components/Header";
import { formatPrice } from "@/lib/whatsapp";
import {
  ESTADOS_ENTREGA,
  ESTADOS_PAGO,
  OPCIONES_ENTREGA as LISTA_ENTREGA,
  OPCIONES_PAGO as LISTA_PAGO
} from "@/lib/estadosPedido";

// Arma el estado de cuenta del cliente para mandarle por WhatsApp:
// qué se llevó, qué está entregado y cuánto debe. Evita las discusiones
// de "yo pensé que había pagado" y las consultas por cada pedido.
function armarEstadoDeCuenta(c) {
  const nombre = (c.nombre || "").split(" ")[0];
  let m = `*BOLSON CLICK* 🛍️\nResumen de tu cuenta\n\n¡Hola ${nombre}! 👋\n\n`;

  const ordenados = c.pedidos
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  ordenados.forEach((p) => {
    const fecha = p.created_at
      ? new Date(p.created_at).toLocaleDateString("es-AR")
      : "";
    const saldo = Number(p.total || 0) - Number(p.monto_pagado || 0);

    const entregado = p.estado === "entregado";
    const enCamino = p.estado === "repartiendo";
    const listo = p.estado === "listo";

    const estadoTexto = entregado
      ? "✅ Entregado"
      : enCamino
      ? "🛵 En camino"
      : listo
      ? "📦 Listo para retirar"
      : "⏳ En preparación";

    m += `📋 *Pedido ${p.numero_pedido || "#" + p.id}* · ${fecha}\n`;
    m += `${estadoTexto}\n`;

    (p.items_pedido || []).forEach((i) => {
      m += `   • ${i.cantidad}x ${i.nombre_producto}\n`;
    });

    m += `   Total: $${Number(p.total || 0).toLocaleString("es-AR")}\n`;

    if (saldo > 0) {
      if (Number(p.monto_pagado || 0) > 0) {
        m += `   Pagaste: $${Number(p.monto_pagado).toLocaleString("es-AR")}\n`;
      }
      m += `   *Falta: $${saldo.toLocaleString("es-AR")}*\n`;
    } else {
      m += `   ✅ Pagado\n`;
    }
    m += `\n`;
  });

  m += `━━━━━━━━━━━━━━\n`;

  if (c.saldoNeto > 0) {
    m += `💰 *TOTAL A PAGAR: $${c.saldoNeto.toLocaleString("es-AR")}*\n\n`;
    m += `Podés transferir al alias *bolsonclick* o pagar en efectivo cuando te lo entregue.\n\n`;
  } else if (c.saldoNeto < 0) {
    m += `💚 Tenés $${Math.abs(c.saldoNeto).toLocaleString("es-AR")} a favor para tu próxima compra.\n\n`;
  } else {
    m += `✅ *Estás al día, no debés nada.* ¡Gracias!\n\n`;
  }

  m += `Cualquier duda escribime por acá 🙌\n🛒 bolsonclick.com.ar`;

  return m;
}

function telefonoParaWhatsapp(tel) {
  let limpio = (tel || "").replace(/\D/g, "");
  if (limpio.startsWith("54")) limpio = limpio.slice(2);
  if (limpio.startsWith("9")) limpio = limpio.slice(1);
  return `549${limpio}`;
}

const OPCIONES_ENTREGA = LISTA_ENTREGA.map((v) => ({
  value: v,
  label: `${ESTADOS_ENTREGA[v].icono} ${ESTADOS_ENTREGA[v].label}`
}));

const OPCIONES_PAGO = LISTA_PAGO.map((v) => ({
  value: v,
  label: `${ESTADOS_PAGO[v].icono} ${ESTADOS_PAGO[v].label}`
}));

const ORDENES = [
  { id: "reciente", label: "Compra más reciente" },
  { id: "deuda", label: "Mayor deuda" },
  { id: "monto", label: "Más compró" }
];

function ResumenClientes() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("reciente");
  const [soloDeudores, setSoloDeudores] = useState(false);
  const [clienteAbierto, setClienteAbierto] = useState(null);
  const [guardandoId, setGuardandoId] = useState(null);

  // Cambia el estado de entrega o de pago de un pedido, sin salir de acá.
  async function actualizarPedido(pedidoId, cambios) {
    setGuardandoId(pedidoId);
    try {
      const res = await fetch("/api/admin/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pedidoId, ...cambios })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo actualizar el pedido.");
        return;
      }

      // Refrescamos con lo que devolvió el servidor, para que el saldo
      // que se ve sea el real y no una cuenta hecha acá.
      setPedidos((prev) =>
        prev.map((p) => (p.id === pedidoId ? { ...p, ...data.pedido } : p))
      );
    } catch (e) {
      alert("Ocurrió un error al actualizar.");
    } finally {
      setGuardandoId(null);
    }
  }

  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch("/api/admin/pedidos", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setPedidos(data.pedidos || []);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    cargar();
  }, []);

  const grupos = {};
  pedidos
    .filter((p) => p.estado !== "cancelado")
    .forEach((p) => {
      const clave = p.telefono_cliente || `sin-tel-${p.id}`;
      if (!grupos[clave]) {
        grupos[clave] = {
          telefono: p.telefono_cliente || "Sin teléfono",
          nombre: p.nombre_cliente || "Sin nombre",
          cantidadPedidos: 0,
          totalComprado: 0,
          saldoNeto: 0,
          pendientes: 0,
          primeraCompra: null,
          ultimaCompra: null,
          pedidos: []
        };
      }
      const g = grupos[clave];
      g.pedidos.push(p);
      g.cantidadPedidos += 1;
      g.totalComprado += Number(p.total || 0);
      g.saldoNeto += Number(p.total || 0) - Number(p.monto_pagado || 0);
      if (!p.estado || p.estado === "pendiente") g.pendientes += 1;

      const fecha = p.created_at ? new Date(p.created_at) : null;
      if (fecha && !isNaN(fecha)) {
        if (!g.primeraCompra || fecha < g.primeraCompra) g.primeraCompra = fecha;
        if (!g.ultimaCompra || fecha > g.ultimaCompra) g.ultimaCompra = fecha;
      }
    });

  const clientes = Object.values(grupos)
    .filter((c) => {
      const q = busqueda.toLowerCase().trim();
      const coincide = !q || c.nombre.toLowerCase().includes(q) || c.telefono.includes(q);
      return coincide && (!soloDeudores || c.saldoNeto > 0);
    })
    .sort((a, b) => {
      if (orden === "deuda") return b.saldoNeto - a.saldoNeto;
      if (orden === "monto") return b.totalComprado - a.totalComprado;
      if (!a.ultimaCompra) return 1;
      if (!b.ultimaCompra) return -1;
      return b.ultimaCompra - a.ultimaCompra;
    });

  const totalPorCobrar = Object.values(grupos).reduce(
    (acc, c) => acc + (c.saldoNeto > 0 ? c.saldoNeto : 0),
    0
  );

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <Header showSearch={false} />

      <div className="max-w-4xl mx-auto px-4 mt-6">
        <Link href="/admin/pedidos" className="text-sm text-brand-blue font-medium">
          ← Panel de ventas
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">Resumen por cliente</h1>
        <p className="text-xs text-gray-500 mb-4">
          Cuánto compró cada uno y cuánto te debe.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-gray-500 text-xs font-semibold">Te deben en total</p>
            <p className="text-amber-600 text-xl font-extrabold mt-1">
              ${formatPrice(totalPorCobrar)}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-gray-500 text-xs font-semibold">Clientes</p>
            <p className="text-gray-800 text-xl font-extrabold mt-1">
              {Object.keys(grupos).length}
            </p>
          </div>
        </div>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 mb-3"
          placeholder="Buscar cliente..."
        />

        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white"
          >
            {ORDENES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={soloDeudores}
              onChange={(e) => setSoloDeudores(e.target.checked)}
            />
            Solo los que me deben
          </label>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : clientes.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-500 text-sm border border-gray-100">
            No hay clientes que coincidan.
          </div>
        ) : (
          <div className="space-y-2">
            {clientes.map((c) => (
              <div key={c.telefono} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-800">{c.nombre}</p>
                    <p className="text-xs text-gray-500">{c.telefono}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {c.cantidadPedidos} pedido{c.cantidadPedidos === 1 ? "" : "s"} · Total: $
                      {formatPrice(c.totalComprado)}
                    </p>
                    {c.ultimaCompra && (
                      <p className="text-[11px] text-gray-400">
                        Última compra: {c.ultimaCompra.toLocaleDateString("es-AR")}
                      </p>
                    )}
                    {c.pendientes > 0 && (
                      <p className="text-[11px] font-bold text-amber-700 mt-0.5">
                        {c.pendientes} pedido{c.pendientes === 1 ? "" : "s"} sin cerrar
                      </p>
                    )}
                  </div>

                  <div className="text-right whitespace-nowrap">
                    {c.saldoNeto > 0 ? (
                      <>
                        <p className="text-[10px] text-gray-400">Debe</p>
                        <p className="font-extrabold text-red-600 text-sm">
                          ${formatPrice(c.saldoNeto)}
                        </p>
                      </>
                    ) : c.saldoNeto < 0 ? (
                      <>
                        <p className="text-[10px] text-gray-400">A favor</p>
                        <p className="font-extrabold text-blue-600 text-sm">
                          ${formatPrice(Math.abs(c.saldoNeto))}
                        </p>
                      </>
                    ) : (
                      <p className="font-bold text-green-600 text-xs">Al día ✓</p>
                    )}
                  </div>
                </div>

                {c.telefono !== "Sin teléfono" && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {/* Resumen completo: qué se llevó, qué está entregado y
                        cuánto debe. Evita el ida y vuelta por cada pedido. */}
                    <a
                      href={`https://wa.me/${telefonoParaWhatsapp(
                        c.telefono
                      )}?text=${encodeURIComponent(armarEstadoDeCuenta(c))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-brand-blue text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                    >
                      📋 Enviar resumen de cuenta
                    </a>

                    <a
                      href={`https://wa.me/${telefonoParaWhatsapp(c.telefono)}${
                        c.saldoNeto > 0
                          ? `?text=${encodeURIComponent(
                              `¡Hola ${c.nombre}! 👋 Te escribo de Bolson Click por el saldo pendiente de $${formatPrice(c.saldoNeto)}. ¿Coordinamos el pago?`
                            )}`
                          : ""
                      }`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                    >
                      💬 WhatsApp
                    </a>
                  </div>
                )}

                <button
                  onClick={() =>
                    setClienteAbierto(clienteAbierto === c.telefono ? null : c.telefono)
                  }
                  className="ml-2 text-xs font-bold text-brand-blue mt-2"
                >
                  {clienteAbierto === c.telefono ? "▲ Ocultar compras" : "▼ Ver qué compró"}
                </button>

                {clienteAbierto === c.telefono && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    {c.pedidos
                      .slice()
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                      .map((p) => {
                        const saldo =
                          Number(p.total || 0) - Number(p.monto_pagado || 0);
                        return (
                          <div key={p.id} className="bg-gray-50 rounded-xl p-3">
                            <div className="flex justify-between items-start mb-1">
                              <div>
                                <span className="text-xs font-bold text-brand-blue">
                                  {p.numero_pedido || `#${p.id}`}
                                </span>
                                <p className="text-[11px] text-gray-400">
                                  {p.created_at
                                    ? new Date(p.created_at).toLocaleDateString("es-AR")
                                    : ""}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-extrabold text-gray-800 text-sm">
                                  ${formatPrice(p.total)}
                                </p>
                                {saldo > 0 ? (
                                  <p className="text-[10px] font-bold text-red-600">
                                    debe ${formatPrice(saldo)}
                                  </p>
                                ) : (
                                  <p className="text-[10px] font-bold text-green-600">pagado</p>
                                )}
                              </div>
                            </div>

                            {p.items_pedido?.length > 0 ? (
                              <div className="border-t border-gray-200 pt-1.5 mt-1.5 space-y-0.5">
                                {p.items_pedido.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex justify-between text-[11px] text-gray-600 gap-2"
                                  >
                                    <span className="flex-1">
                                      {item.cantidad}x {item.nombre_producto}
                                    </span>
                                    <span className="whitespace-nowrap text-gray-500">
                                      ${formatPrice(item.precio_unitario)} c/u
                                    </span>
                                    <span className="whitespace-nowrap font-semibold">
                                      ${formatPrice(item.precio_unitario * item.cantidad)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-gray-400 mt-1">
                                Sin detalle de productos.
                              </p>
                            )}

                            {p.comprobante_url && (
                              <a
                                href={p.comprobante_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-semibold text-brand-blue underline mt-1.5 inline-block"
                              >
                                📎 Ver comprobante
                              </a>
                            )}

                            {/* CAMBIAR ESTADOS SIN SALIR DE ACÁ */}
                            <div className="border-t border-gray-200 pt-2 mt-2 grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                                  Entrega
                                </label>
                                <select
                                  value={p.estado || "pendiente"}
                                  disabled={guardandoId === p.id}
                                  onChange={(e) =>
                                    actualizarPedido(p.id, { estado: e.target.value })
                                  }
                                  className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white disabled:opacity-50"
                                >
                                  {OPCIONES_ENTREGA.map((op) => (
                                    <option key={op.value} value={op.value}>
                                      {op.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                                  Pago
                                </label>
                                <select
                                  value={p.estado_pago || "falta_pagar"}
                                  disabled={guardandoId === p.id}
                                  onChange={(e) =>
                                    actualizarPedido(p.id, { estado_pago: e.target.value })
                                  }
                                  className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white disabled:opacity-50"
                                >
                                  {OPCIONES_PAGO.map((op) => (
                                    <option key={op.value} value={op.value}>
                                      {op.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {(p.estado_pago === "deuda_parcial" ||
                                p.estado_pago === "senado") && (
                                <div className="col-span-2">
                                  <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                                    Cuánto pagó hasta ahora
                                  </label>
                                  <input
                                    type="number"
                                    defaultValue={p.monto_pagado || 0}
                                    disabled={guardandoId === p.id}
                                    onBlur={(e) => {
                                      const valor = Number(e.target.value) || 0;
                                      if (valor !== Number(p.monto_pagado || 0)) {
                                        actualizarPedido(p.id, { monto_pagado: valor });
                                      }
                                    }}
                                    className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 disabled:opacity-50"
                                  />
                                </div>
                              )}
                            </div>

                            {guardandoId === p.id && (
                              <p className="text-[10px] text-brand-blue font-bold mt-1">
                                Guardando...
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ResumenClientesPage() {
  return (
    <AdminGuard>
      <ResumenClientes />
    </AdminGuard>
  );
}
