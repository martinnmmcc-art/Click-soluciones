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
          ultimaCompra: null
        };
      }
      const g = grupos[clave];
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
                    className="inline-block bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg mt-2"
                  >
                    💬 WhatsApp
                  </a>
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
