"use client";

import { useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";
import EscanerCodigo from "@/components/EscanerCodigo";

// Caja: para cobrar en el mostrador.
//
// Escanea el código con la cámara del celular, arma la venta, calcula el
// vuelto y descuenta el stock. Pensada para usarla con una mano mientras
// se atiende: botones grandes y pocos pasos.

// Billetes que más circulan, para calcular el vuelto de un toque
const BILLETES = [1000, 2000, 5000, 10000, 20000];

function Caja() {
  const [items, setItems] = useState([]);
  const [escaneando, setEscaneando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [cobrando, setCobrando] = useState(false);
  const [metodo, setMetodo] = useState("efectivo");
  const [recibido, setRecibido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ultimaVenta, setUltimaVenta] = useState(null);

  const total = items.reduce(
    (a, i) => a + Number(i.precio) * Number(i.cantidad),
    0
  );
  const vuelto = Math.max(Number(recibido || 0) - total, 0);

  function avisar(texto, ms = 2500) {
    setMensaje(texto);
    setTimeout(() => setMensaje(""), ms);
  }

  function sumarProducto(p) {
    setItems((prev) => {
      const existe = prev.find((x) => x.id === p.id);
      if (existe) {
        return prev.map((x) =>
          x.id === p.id ? { ...x, cantidad: x.cantidad + 1 } : x
        );
      }
      const precio =
        p.precio_oferta && Number(p.precio_oferta) < Number(p.precio)
          ? Number(p.precio_oferta)
          : Number(p.precio);

      return [...prev, { id: p.id, nombre: p.nombre, precio, cantidad: 1, stock: p.stock }];
    });
  }

  async function porCodigo(codigo) {
    setEscaneando(false);

    const { data } = await supabase.rpc("buscar_por_codigo", { p_codigo: codigo });
    const p = data?.[0];

    if (!p) {
      avisar(`❌ Código ${codigo} sin producto asociado`, 4000);
      return;
    }

    sumarProducto(p);
    avisar(`✓ ${p.nombre}`);
  }

  async function buscar(texto) {
    setBusqueda(texto);
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }

    const { data } = await supabase
      .from("Productos")
      .select("id, nombre, precio, precio_oferta, stock, imagen_url, bajo_pedido")
      .ilike("nombre", `%${texto.trim()}%`)
      .eq("activo", true)
      .order("stock", { ascending: false })
      .limit(8);

    setResultados(data || []);
  }

  function cambiarCantidad(id, delta) {
    setItems((prev) =>
      prev
        .map((x) => (x.id === id ? { ...x, cantidad: x.cantidad + delta } : x))
        .filter((x) => x.cantidad > 0)
    );
  }

  async function cobrar() {
    if (items.length === 0) return;

    if (metodo === "efectivo" && Number(recibido || 0) < total) {
      avisar("El monto recibido es menor al total");
      return;
    }

    setGuardando(true);
    try {
      const { data, error } = await supabase.rpc("venta_caja", {
        p_items: items.map((i) => ({
          id: i.id,
          nombre: i.nombre,
          cantidad: i.cantidad,
          precio: i.precio
        })),
        p_metodo_pago: metodo,
        p_total: total,
        p_pagado: total
      });

      if (error) {
        avisar("No se pudo cobrar: " + error.message, 5000);
        return;
      }

      setUltimaVenta({
        numero: data?.[0]?.numero,
        total,
        vuelto: metodo === "efectivo" ? vuelto : 0,
        recibido: Number(recibido || 0),
        metodo
      });

      setItems([]);
      setRecibido("");
      setCobrando(false);
    } finally {
      setGuardando(false);
    }
  }

  // Pantalla de venta terminada
  if (ultimaVenta) {
    return (
      <main className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-lg">
          <p className="text-5xl mb-2">✅</p>
          <p className="font-extrabold text-lg text-gray-800">Venta cobrada</p>
          <p className="text-xs text-gray-500">{ultimaVenta.numero}</p>

          <p className="text-3xl font-black text-gray-800 mt-4">
            ${formatPrice(ultimaVenta.total)}
          </p>

          {ultimaVenta.metodo === "efectivo" && ultimaVenta.vuelto > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mt-4">
              <p className="text-xs font-bold text-amber-800">DAR DE VUELTO</p>
              <p className="text-4xl font-black text-amber-900 leading-tight">
                ${formatPrice(ultimaVenta.vuelto)}
              </p>
              <p className="text-[11px] text-amber-700 mt-1">
                Recibiste ${formatPrice(ultimaVenta.recibido)}
              </p>
            </div>
          )}

          {ultimaVenta.metodo === "transferencia" && (
            <p className="text-xs text-gray-600 bg-blue-50 rounded-xl p-3 mt-4">
              Acordate de verificar que la transferencia haya entrado.
            </p>
          )}

          <button
            onClick={() => setUltimaVenta(null)}
            className="w-full bg-brand-blue text-white text-sm font-bold py-3.5 rounded-xl mt-5"
          >
            Nueva venta
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-40">
      <EscanerCodigo
        abierto={escaneando}
        onLeer={porCodigo}
        onCerrar={() => setEscaneando(false)}
      />

      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-extrabold text-gray-800">🧾 Caja</h1>
          <Link href="/admin" className="text-xs text-brand-blue font-bold">
            Ir al panel →
          </Link>
        </div>

        {mensaje && (
          <div className="bg-white border-2 border-brand-blue rounded-xl p-3 mb-3">
            <p className="text-sm font-bold text-gray-800">{mensaje}</p>
          </div>
        )}

        <button
          onClick={() => setEscaneando(true)}
          className="w-full bg-brand-blue text-white text-base font-bold py-5 rounded-2xl mb-3 shadow-sm"
        >
          📷 Escanear producto
        </button>

        <input
          value={busqueda}
          onChange={(e) => buscar(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2"
          placeholder="🔍 O buscalo por nombre..."
        />

        {resultados.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 mb-3 overflow-hidden">
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  sumarProducto(p);
                  setBusqueda("");
                  setResultados([]);
                }}
                className="w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-0 flex justify-between items-center"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-gray-800 line-clamp-1">
                    {p.nombre}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Stock: {p.stock ?? 0}
                  </span>
                </span>
                <span className="text-sm font-bold text-brand-blue whitespace-nowrap ml-2">
                  ${formatPrice(
                    p.precio_oferta && p.precio_oferta < p.precio
                      ? p.precio_oferta
                      : p.precio
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* PRODUCTOS DE LA VENTA */}
        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-4xl mb-2">🛒</p>
            <p className="text-sm text-gray-500">
              Escaneá o buscá los productos que se lleva el cliente.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((i) => (
              <div
                key={i.id}
                className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 line-clamp-2 leading-tight">
                    {i.nombre}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    ${formatPrice(i.precio)} c/u
                    {Number(i.stock || 0) < i.cantidad && (
                      <span className="text-red-600 font-bold">
                        {" "}· ¡solo hay {i.stock}!
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => cambiarCantidad(i.id, -1)}
                    className="w-9 h-9 bg-gray-100 rounded-lg text-lg font-bold text-gray-600"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{i.cantidad}</span>
                  <button
                    onClick={() => cambiarCantidad(i.id, 1)}
                    className="w-9 h-9 bg-gray-100 rounded-lg text-lg font-bold text-gray-600"
                  >
                    +
                  </button>
                </div>

                <span className="text-sm font-extrabold text-gray-800 w-20 text-right">
                  ${formatPrice(i.precio * i.cantidad)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BARRA DE COBRO */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 z-40">
          <div className="max-w-2xl mx-auto">
            {!cobrando ? (
              <>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600">
                    {items.reduce((a, i) => a + i.cantidad, 0)} producto(s)
                  </span>
                  <span className="text-2xl font-black text-gray-800">
                    ${formatPrice(total)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setItems([])}
                    className="px-4 text-xs font-bold text-red-500"
                  >
                    Vaciar
                  </button>
                  <button
                    onClick={() => setCobrando(true)}
                    className="flex-1 bg-green-600 text-white text-base font-bold py-4 rounded-xl"
                  >
                    Cobrar ${formatPrice(total)}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setMetodo("efectivo")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${
                      metodo === "efectivo"
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    💵 Efectivo
                  </button>
                  <button
                    onClick={() => setMetodo("transferencia")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${
                      metodo === "transferencia"
                        ? "bg-brand-blue text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    🏦 Transferencia
                  </button>
                </div>

                {metodo === "efectivo" && (
                  <>
                    <p className="text-xs font-bold text-gray-600 mb-1">
                      ¿Con cuánto paga?
                    </p>

                    <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                      <button
                        onClick={() => setRecibido(String(total))}
                        className="px-3 py-2 bg-gray-100 rounded-lg text-xs font-bold whitespace-nowrap"
                      >
                        Justo
                      </button>
                      {BILLETES.filter((b) => b >= total).slice(0, 3).map((b) => (
                        <button
                          key={b}
                          onClick={() => setRecibido(String(b))}
                          className="px-3 py-2 bg-gray-100 rounded-lg text-xs font-bold whitespace-nowrap"
                        >
                          ${formatPrice(b)}
                        </button>
                      ))}
                    </div>

                    <input
                      type="number"
                      value={recibido}
                      onChange={(e) => setRecibido(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl font-bold text-center mb-2"
                      placeholder="0"
                      inputMode="numeric"
                    />

                    {Number(recibido || 0) >= total && (
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mb-2 text-center">
                        <p className="text-[11px] font-bold text-amber-800">VUELTO</p>
                        <p className="text-3xl font-black text-amber-900 leading-none">
                          ${formatPrice(vuelto)}
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setCobrando(false)}
                    className="px-4 text-xs font-bold text-gray-500"
                  >
                    Volver
                  </button>
                  <button
                    onClick={cobrar}
                    disabled={
                      guardando ||
                      (metodo === "efectivo" && Number(recibido || 0) < total)
                    }
                    className="flex-1 bg-green-600 text-white text-base font-bold py-4 rounded-xl disabled:opacity-40"
                  >
                    {guardando ? "Cobrando..." : "Confirmar cobro"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function CajaPage() {
  return (
    <AdminGuard>
      <Caja />
    </AdminGuard>
  );
}
