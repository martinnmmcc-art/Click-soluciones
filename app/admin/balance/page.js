"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { formatPrice } from "@/lib/whatsapp";

function telefonoWhatsapp(tel) {
  let n = (tel || "").replace(/\D/g, "");
  if (n.startsWith("54")) n = n.slice(2);
  if (n.startsWith("9")) n = n.slice(1);
  return `549${n}`;
}

function Variacion({ valor }) {
  if (valor === null || valor === undefined) return null;
  const sube = valor >= 0;
  return (
    <span
      className={`text-[10px] font-bold ${sube ? "text-green-600" : "text-red-600"}`}
    >
      {sube ? "▲" : "▼"} {Math.abs(valor)}% vs mes anterior
    </span>
  );
}

function Balance() {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(0);

  useEffect(() => {
    async function cargar() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/balance?mes=${mes}`, { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setDatos(data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    cargar();
  }, [mes]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <p className="text-center text-gray-400 py-10">Calculando el balance...</p>
      </main>
    );
  }

  if (!datos) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <p className="text-center text-gray-500">No se pudo cargar el balance.</p>
      </main>
    );
  }

  const v = datos.ventas;
  const g = datos.gastos;
  const maxDia = datos.diasSemana[0]?.total || 1;

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin/pedidos" className="text-sm text-brand-blue font-medium">
          ← Panel de ventas
        </Link>

        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 capitalize">
          Balance de {datos.periodo.etiqueta}
        </h1>

        <div className="flex gap-2 mt-3 mb-4">
          {[
            { v: 0, l: "Este mes" },
            { v: -1, l: "Mes pasado" },
            { v: -2, l: "Hace 2 meses" }
          ].map((op) => (
            <button
              key={op.v}
              onClick={() => setMes(op.v)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                mes === op.v
                  ? "bg-brand-blue text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {op.l}
            </button>
          ))}
        </div>

        {/* LO MÁS IMPORTANTE */}
        <div
          className={`rounded-2xl p-5 text-white mb-4 ${
            datos.plataEnBolsillo >= 0
              ? "bg-gradient-to-br from-green-600 to-green-700"
              : "bg-gradient-to-br from-orange-500 to-orange-700"
          }`}
        >
          <p className="text-xs font-bold opacity-90">PLATA EN EL BOLSILLO</p>
          <p className="text-3xl font-black mt-1">
            ${formatPrice(datos.plataEnBolsillo)}
          </p>
          <p className="text-[11px] opacity-90 mt-1">
            Lo que cobraste menos todo lo que gastaste este mes
          </p>
          {datos.plataEnBolsillo < 0 && (
            <p className="text-[11px] bg-white/20 rounded-lg p-2 mt-2">
              Da negativo porque compraste más de lo que vendiste. No es
              pérdida: esa plata está en mercadería sin vender.
            </p>
          )}
        </div>

        {/* VENTAS */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <p className="font-bold text-sm text-gray-800 mb-3">📈 Ventas</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-gray-500">Vendido</p>
              <p className="text-xl font-extrabold text-gray-800">
                ${formatPrice(v.total)}
              </p>
              <Variacion valor={datos.variaciones.total} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500">Pedidos</p>
              <p className="text-xl font-extrabold text-gray-800">{v.pedidos}</p>
              <Variacion valor={datos.variaciones.pedidos} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500">Ticket promedio</p>
              <p className="text-base font-bold text-gray-800">
                ${formatPrice(v.ticketPromedio)}
              </p>
              <Variacion valor={datos.variaciones.ticket} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500">Unidades vendidas</p>
              <p className="text-base font-bold text-gray-800">{v.unidades}</p>
            </div>
          </div>

          {v.pendiente > 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2 mt-3">
              Te deben ${formatPrice(v.pendiente)} de estas ventas
            </p>
          )}
        </div>

        {/* GANANCIA */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <p className="font-bold text-sm text-gray-800 mb-1">💰 Ganancia sobre lo vendido</p>
          <p className="text-[11px] text-gray-500 mb-3">
            Cuánto te quedó de lo que efectivamente vendiste
          </p>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Vendido</span>
              <span className="font-bold">${formatPrice(v.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Costo de lo vendido</span>
              <span className="font-bold text-gray-700">
                -${formatPrice(v.costoVendido)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Otros gastos</span>
              <span className="font-bold text-gray-700">-${formatPrice(g.otros)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="font-semibold text-gray-800">Ganancia neta</span>
              <span
                className={`font-extrabold ${
                  datos.gananciaNeta >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ${formatPrice(datos.gananciaNeta)}
              </span>
            </div>
          </div>

          {v.total > 0 && (
            <p className="text-[11px] text-gray-500 mt-2">
              Margen: {Math.round((datos.gananciaNeta / v.total) * 100)}% de lo vendido
            </p>
          )}
        </div>

        {/* COMPRAS */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <p className="font-bold text-sm text-gray-800 mb-3">🚚 Lo que compraste</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Mercadería</span>
              <span className="font-bold">${formatPrice(g.mercaderia)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Flete</span>
              <span className="font-bold">${formatPrice(g.flete)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Otros gastos</span>
              <span className="font-bold">${formatPrice(g.otros)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="font-semibold text-gray-800">Total gastado</span>
              <span className="font-extrabold text-gray-800">
                ${formatPrice(g.totalGastado)}
              </span>
            </div>
          </div>
        </div>

        {/* DÍAS */}
        {datos.diasSemana.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <p className="font-bold text-sm text-gray-800 mb-3">📅 Qué días vendés más</p>
            <div className="space-y-2">
              {datos.diasSemana.map((d) => (
                <div key={d.dia} className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-600 w-20 flex-shrink-0">
                    {d.dia}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-brand-blue h-full rounded-full"
                      style={{ width: `${(d.total / maxDia) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-gray-700 w-20 text-right">
                    ${formatPrice(d.total)}
                  </span>
                </div>
              ))}
            </div>

            {datos.mejoresFechas.length > 0 && (
              <div className="border-t border-gray-100 mt-3 pt-3">
                <p className="text-[11px] font-bold text-gray-600 mb-1">
                  Mejores días del mes
                </p>
                {datos.mejoresFechas.map((f) => (
                  <div key={f.fecha} className="flex justify-between text-[11px] text-gray-600">
                    <span>
                      {new Date(f.fecha + "T12:00:00").toLocaleDateString("es-AR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short"
                      })}
                    </span>
                    <span className="font-bold">
                      ${formatPrice(f.total)} · {f.pedidos} pedido
                      {f.pedidos === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CLIENTES */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <p className="font-bold text-sm text-gray-800 mb-3">👥 Clientes</p>

          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div className="bg-gray-50 rounded-xl p-2">
              <p className="text-lg font-extrabold text-gray-800">
                {datos.clientes.compraron}
              </p>
              <p className="text-[10px] text-gray-500">compraron</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-2">
              <p className="text-lg font-extrabold text-blue-700">
                {datos.clientes.nuevos}
              </p>
              <p className="text-[10px] text-blue-700">nuevos</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2">
              <p className="text-lg font-extrabold text-green-700">
                {datos.clientes.volvieron}
              </p>
              <p className="text-[10px] text-green-700">volvieron</p>
            </div>
          </div>

          <p className="text-[11px] font-bold text-gray-600 mb-1">
            Los que más compraron
          </p>
          <div className="space-y-1.5">
            {datos.mejoresClientes.map((c, i) => (
              <div key={c.telefono} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-400 w-4">
                  {i + 1}°
                </span>
                <span className="flex-1 text-xs text-gray-700 line-clamp-1">
                  {c.nombre}
                  <span className="text-gray-400"> · {c.compras}x</span>
                </span>
                <span className="text-xs font-bold text-gray-800 whitespace-nowrap">
                  ${formatPrice(c.gastado)}
                </span>
                {c.telefono !== "sin-tel" && (
                  <a
                    href={`https://wa.me/${telefonoWhatsapp(c.telefono)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm"
                  >
                    💬
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* PRODUCTOS */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <p className="font-bold text-sm text-gray-800 mb-3">🔥 Lo que más se vendió</p>
          <div className="space-y-1.5">
            {datos.masVendidos.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-400 w-4">{i + 1}°</span>
                <span className="flex-1 text-xs text-gray-700 line-clamp-1">
                  {p.nombre}
                </span>
                <span className="text-[11px] text-gray-500 whitespace-nowrap">
                  {p.unidades}u · ${formatPrice(p.facturado)}
                </span>
              </div>
            ))}
          </div>

          {datos.masRentables.length > 0 && (
            <div className="border-t border-gray-100 mt-3 pt-3">
              <p className="text-[11px] font-bold text-gray-600 mb-1">
                Los que más ganancia dejaron
              </p>
              {datos.masRentables.map((p) => (
                <div key={p.id} className="flex justify-between text-[11px]">
                  <span className="text-gray-600 line-clamp-1 flex-1 pr-2">
                    {p.nombre}
                  </span>
                  <span className="font-bold text-green-700 whitespace-nowrap">
                    +${formatPrice(p.ganancia)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SIN ROTACIÓN */}
        {datos.sinRotacion.length > 0 && (
          <div className="bg-white rounded-2xl border-2 border-amber-200 p-4 mb-4">
            <p className="font-bold text-sm text-gray-800">😴 No se vendieron este mes</p>
            <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2 my-2">
              Tenés <b>${formatPrice(datos.plataParadaTotal)}</b> inmovilizados en
              mercadería que no rotó.
            </p>

            <div className="space-y-1.5">
              {datos.sinRotacion.map((p) => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span className="text-gray-700 line-clamp-1 flex-1 pr-2">
                    {p.nombre}
                    <span className="text-gray-400"> ({p.stock}u)</span>
                  </span>
                  <span className="font-bold text-amber-700 whitespace-nowrap">
                    ${formatPrice(p.plataParada)}
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/admin/ofertas"
              className="block text-center bg-amber-600 text-white text-xs font-bold py-2 rounded-xl mt-3"
            >
              🏷️ Ponerlos en oferta para moverlos
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function BalancePage() {
  return (
    <AdminGuard>
      <Balance />
    </AdminGuard>
  );
}
