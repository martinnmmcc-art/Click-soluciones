"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import Header from "@/components/Header";
import { formatPrice } from "@/lib/whatsapp";

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

  // Una venta está cerrada cuando ya se entregó Y está pagada.
  // Todo lo demás sigue en el panel de ventas, para no perderlo de vista.
  const cerradas = pedidos.filter(
    (p) => p.estado === "entregado" && p.estado_pago === "pagado"
  );

  // Agrupamos por cliente
  const porCliente = {};
  cerradas.forEach((p) => {
    const clave = p.telefono_cliente || `sin-tel-${p.id}`;
    if (!porCliente[clave]) {
      porCliente[clave] = {
        telefono: p.telefono_cliente || "Sin teléfono",
        nombre: p.nombre_cliente || "Sin nombre",
        pedidos: [],
        totalComprado: 0,
        ultimaCompra: null
      };
    }
    porCliente[clave].pedidos.push(p);
    porCliente[clave].totalComprado += Number(p.total || 0);
    const fecha = p.created_at ? new Date(p.created_at) : null;
    if (fecha && (!porCliente[clave].ultimaCompra || fecha > porCliente[clave].ultimaCompra)) {
      porCliente[clave].ultimaCompra = fecha;
    }
  });

  const clientes = Object.values(porCliente)
    .filter((c) => {
      const q = busqueda.toLowerCase().trim();
      return !q || c.nombre.toLowerCase().includes(q) || c.telefono.includes(q);
    })
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
              const abierto = clienteAbierto === c.telefono;
              return (
                <div key={c.telefono} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => setClienteAbierto(abierto ? null : c.telefono)}
                    className="w-full p-4 text-left flex justify-between items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-800">{c.nombre}</p>
                      <p className="text-xs text-gray-500">{c.telefono}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {c.pedidos.length} compra{c.pedidos.length === 1 ? "" : "s"}
                        {c.ultimaCompra && ` · última: ${c.ultimaCompra.toLocaleDateString("es-AR")}`}
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
                      {c.telefono !== "Sin teléfono" && (
                        <a
                          href={`https://wa.me/${telefonoParaWhatsapp(c.telefono)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                        >
                          💬 Escribirle por WhatsApp
                        </a>
                      )}

                      {c.pedidos.map((p) => (
                        <div key={p.id} className="bg-white rounded-xl p-3 border border-gray-100">
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
                            <span className="font-extrabold text-gray-800 text-sm">
                              ${formatPrice(p.total)}
                            </span>
                          </div>

                          {p.items_pedido?.length > 0 && (
                            <div className="border-t border-gray-100 pt-1.5 mt-1.5 space-y-0.5">
                              {p.items_pedido.map((item) => (
                                <div key={item.id} className="flex justify-between text-[11px] text-gray-600">
                                  <span>
                                    {item.cantidad}x {item.nombre_producto}
                                  </span>
                                  <span>${formatPrice(item.precio_unitario * item.cantidad)}</span>
                                </div>
                              ))}
                            </div>
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
