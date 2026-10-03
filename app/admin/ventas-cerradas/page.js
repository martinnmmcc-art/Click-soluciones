"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import Header from "@/components/Header";
import { formatPrice } from "@/lib/whatsapp";
import { ventaCerrada } from "@/lib/estadosPedido";
import { coincideCliente, normalizarTexto } from "@/lib/buscar";
import { archivoComprobante, datosComprobante } from "@/lib/comprobanteImagen";
import AsociarCliente from "@/components/AsociarCliente";
import { fechaCorta, fechaYHora, ultimaActividad, agregadoDespues } from "@/lib/fechasPedido";

function telefonoParaWhatsapp(tel) {
  let limpio = (tel || "").replace(/\D/g, "");
  if (limpio.startsWith("54")) limpio = limpio.slice(2);
  if (limpio.startsWith("9")) limpio = limpio.slice(1);
  return `549${limpio}`;
}

function VentasCerradas() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [clienteAbierto, setClienteAbierto] = useState(null);
  // Imagen del comprobante de cada venta, preparada apenas se abre la
  // tarjeta del cliente. Tiene que estar lista ANTES del toque: si se arma
  // recién al tocar, el celular bloquea el menú de compartir.
  const [comprobantes, setComprobantes] = useState({});
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!clienteAbierto) return;
    let cancelado = false;
    setAviso("");
    const delCliente = pedidos.filter(
      (p) => ventaCerrada(p) && (p.telefono_cliente || `sin-tel-${p.id}`) === clienteAbierto
    );
    (async () => {
      for (const p of delCliente) {
        if (cancelado) return;
        if (comprobantes[p.id]) continue;
        try {
          const archivo = await archivoComprobante(p);
          if (!cancelado && archivo) setComprobantes((prev) => ({ ...prev, [p.id]: archivo }));
        } catch (e) {}
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteAbierto, pedidos]);

  // Manda la IMAGEN del comprobante (sin texto: si va con texto, WhatsApp
  // en Android se queda solo con el texto). El mensaje queda copiado.
  function enviarComprobante(pedido) {
    setAviso("");
    const archivo = comprobantes[pedido.id];
    const { mensajeCliente, telefonoCliente } = datosComprobante(pedido);

    try {
      navigator.clipboard?.writeText(mensajeCliente).catch(() => {});
    } catch (e) {}

    if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
      navigator
        .share({ files: [archivo] })
        .then(() => setAviso("✓ Comprobante enviado. El mensaje quedó copiado: si querés, pegalo en el chat."))
        .catch((e) => {
          if (e?.name === "AbortError") return;
          descargarYAbrirChat(archivo, telefonoCliente, mensajeCliente);
        });
      return;
    }
    descargarYAbrirChat(archivo, telefonoCliente, mensajeCliente);
  }

  // PC o celular sin menú de compartir: se descarga la imagen y se abre el
  // chat del cliente para adjuntarla.
  function descargarYAbrirChat(archivo, telefono, mensaje) {
    if (archivo) {
      const url = URL.createObjectURL(archivo);
      const a = document.createElement("a");
      a.href = url;
      a.download = archivo.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    const destino = telefono ? `https://wa.me/549${telefono}` : "https://wa.me/";
    window.open(`${destino}?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener");
    setAviso("Se descargó el comprobante y se abrió el chat: adjuntá la imagen con el clip 📎.");
  }

  const [reabriendoId, setReabriendoId] = useState(null);

  // Una venta cerrada por error (por ejemplo, se tocó "Pagado" sin querer)
  // vuelve a Pedidos abiertos: si el cliente pagó una parte queda "Señado",
  // si no pagó nada "Falta pagar". El stock no se toca (el producto ya se
  // entregó); si se cancela después, el stock vuelve solo.
  async function reabrirVenta(pedido) {
    const pagado = Number(pedido.monto_pagado || 0);
    const nuevoEstado = pagado > 0 ? "senado" : "falta_pagar";
    if (
      !confirm(
        `¿Reabrir la venta ${pedido.numero_pedido || ""}?\n\n` +
          `Vuelve a Pedidos abiertos como "${pagado > 0 ? "Señado" : "Falta pagar"}" para que la corrijas.`
      )
    )
      return;

    setReabriendoId(pedido.id);
    try {
      const res = await fetch("/api/admin/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pedido.id, estado_pago: nuevoEstado })
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || "error");
      setPedidos((prev) => prev.map((x) => (x.id === pedido.id ? { ...x, ...r.pedido } : x)));
      setAviso("✓ Venta reabierta: ahora está en Pedidos, para corregirla.");
    } catch (e) {
      setAviso("No se pudo reabrir: " + e.message);
    } finally {
      setReabriendoId(null);
    }
  }

  const [recarga, setRecarga] = useState(0);

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
  }, [recarga]);

  // Una venta está cerrada cuando ya se entregó Y está pagada (o el cliente
  // pagó de más y le quedó saldo a favor). Todo lo demás sigue en el panel
  // de pedidos, para no perderlo de vista.
  const cerradas = pedidos.filter((p) => ventaCerrada(p));

  // Agrupamos por cliente
  const porCliente = {};
  cerradas.forEach((p) => {
    const clave = p.telefono_cliente || `sin-tel-${p.id}`;
    if (!porCliente[clave]) {
      porCliente[clave] = {
        clave,
        telefono: p.telefono_cliente || "Sin teléfono",
        nombre: p.nombre_cliente || "Sin nombre",
        pedidos: [],
        totalComprado: 0,
        ultimaCompra: null
      };
    }
    porCliente[clave].pedidos.push(p);
    porCliente[clave].totalComprado += Number(p.total || 0);
    const fecha = p.created_at ? ultimaActividad(p) : null;
    if (fecha && (!porCliente[clave].ultimaCompra || fecha > porCliente[clave].ultimaCompra)) {
      porCliente[clave].ultimaCompra = fecha;
    }
  });

  // La compra más reciente primero (el botón principal manda esa)
  Object.values(porCliente).forEach((c) =>
    c.pedidos.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  );

  const clientes = Object.values(porCliente)
    // Sin acentos, por palabras, y a prueba de ventas sin nombre o teléfono
    // (una venta de mostrador sin cliente rompía esta pantalla al buscar)
    .filter((c) => coincideCliente(c, busqueda))
    .sort((a, b) => (b.ultimaCompra || 0) - (a.ultimaCompra || 0));

  const totalFacturado = cerradas.reduce((acc, p) => acc + Number(p.total || 0), 0);

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <Header showSearch={false} />

      <div className="max-w-4xl mx-auto px-4 mt-6">
        <Link href="/admin/pedidos" className="text-sm text-brand-blue font-medium">
          ← Panel de ventas
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">Ventas cerradas</h1>
        <p className="text-xs text-gray-500 mb-4">
          Pedidos entregados y cobrados, agrupados por cliente.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-gray-500 text-xs font-semibold">Total facturado</p>
            <p className="text-green-600 text-xl font-extrabold mt-1">
              ${formatPrice(totalFacturado)}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-gray-500 text-xs font-semibold">Ventas cerradas</p>
            <p className="text-gray-800 text-xl font-extrabold mt-1">{cerradas.length}</p>
            <p className="text-gray-400 text-[11px] mt-0.5">{clientes.length} clientes</p>
          </div>
        </div>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 mb-4"
          placeholder="Buscar cliente por nombre o celular..."
        />

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : clientes.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-500 text-sm border border-gray-100">
            Todavía no hay ventas entregadas y pagadas.
          </div>
        ) : (
          <div className="space-y-2">
            {clientes.map((c) => {
              const abierto = clienteAbierto === c.clave;
              return (
                <div key={c.clave} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => setClienteAbierto(abierto ? null : c.clave)}
                    className="w-full p-4 text-left flex justify-between items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-800">{c.nombre}</p>
                      <p className="text-xs text-gray-500">{c.telefono}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {c.pedidos.length} compra{c.pedidos.length === 1 ? "" : "s"}
                        {c.ultimaCompra && ` · última: ${fechaCorta(c.ultimaCompra)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-green-600 text-sm">
                        ${formatPrice(c.totalComprado)}
                      </p>
                      <span className="text-[10px] text-gray-400">{abierto ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {abierto && (
                    <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => enviarComprobante(c.pedidos[0])}
                          disabled={!comprobantes[c.pedidos[0]?.id]}
                          className="bg-[#25D366] text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-60"
                        >
                          {comprobantes[c.pedidos[0]?.id]
                            ? `📲 Enviar comprobante${c.pedidos.length > 1 ? " de la última compra" : ""}`
                            : "Preparando comprobante..."}
                        </button>
                        {c.telefono !== "Sin teléfono" && (
                          <a
                            href={`https://wa.me/${telefonoParaWhatsapp(c.telefono)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-gray-500 underline"
                          >
                            💬 Solo mensaje
                          </a>
                        )}
                      </div>

                      {c.telefono !== "Sin teléfono" && (
                        <AsociarCliente
                          telefonoOrigen={c.telefono}
                          nombreOrigen={c.nombre}
                          cantidadVentas={c.pedidos.length}
                          onListo={() => {
                            setClienteAbierto(null);
                            setRecarga((n) => n + 1);
                          }}
                        />
                      )}

                      {aviso && (
                        <p
                          className={`text-[11px] rounded-lg p-2 ${
                            aviso.startsWith("✓") ? "text-green-800 bg-green-50" : "text-amber-800 bg-amber-50"
                          }`}
                        >
                          {aviso}
                        </p>
                      )}

                      {c.pedidos.map((p) => (
                        <div key={p.id} className="bg-white rounded-xl p-3 border border-gray-100">
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <span className="text-xs font-bold text-brand-blue">
                                {p.numero_pedido || `#${p.id}`}
                              </span>
                              <p className="text-[11px] text-gray-400">{fechaCorta(p.created_at)}</p>
                              {p.modificado_en && (
                                <p className="text-[10px] font-semibold text-amber-700">
                                  ✏️ Modificado {fechaYHora(p.modificado_en)}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-gray-800 text-sm">
                                ${formatPrice(p.total)}
                              </span>
                              {p.estado_pago === "a_favor" &&
                                Number(p.monto_pagado || 0) > Number(p.total || 0) && (
                                  <p className="text-[11px] font-bold text-green-700">
                                    💚 A favor ${formatPrice(Number(p.monto_pagado) - Number(p.total))}
                                  </p>
                                )}
                            </div>
                          </div>

                          {p.items_pedido?.length > 0 && (
                            <div className="border-t border-gray-100 pt-1.5 mt-1.5 space-y-0.5">
                              {p.items_pedido.map((item) => (
                                <div key={item.id} className="flex justify-between text-[11px] text-gray-600">
                                  <span>
                                    {item.cantidad}x {item.nombre_producto}
                                    {agregadoDespues(item, p) && (
                                      <span className="block text-[10px] font-semibold text-amber-700">
                                        + agregado {fechaYHora(item.agregado_en)}
                                      </span>
                                    )}
                                  </span>
                                  <span>${formatPrice(item.precio_unitario * item.cantidad)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <button
                            onClick={() => reabrirVenta(p)}
                            disabled={reabriendoId === p.id}
                            className="mt-2 mr-3 text-[11px] font-bold text-amber-700 disabled:opacity-50"
                          >
                            {reabriendoId === p.id ? "Reabriendo..." : "↩️ Reabrir venta"}
                          </button>

                          {c.pedidos.length > 1 && (
                            <button
                              onClick={() => enviarComprobante(p)}
                              disabled={!comprobantes[p.id]}
                              className="mt-2 mr-3 text-[11px] font-bold text-emerald-700 disabled:opacity-50"
                            >
                              {comprobantes[p.id] ? "📲 Enviar este comprobante" : "Preparando..."}
                            </button>
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
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function VentasCerradasPage() {
  return (
    <AdminGuard>
      <VentasCerradas />
    </AdminGuard>
  );
}
