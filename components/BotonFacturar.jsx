"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cabeceraAdmin } from "@/lib/verificarAdmin";
import { formatPrice } from "@/lib/whatsapp";

// Botón "🧾 Facturar" de cada pedido del panel (Factura C por ARCA).
//
// - Si el pedido ya tiene factura, muestra el número con el link para verla
//   o mandarla por WhatsApp.
// - Si no, abre una ventanita: por defecto "A consumidor final" (lo normal);
//   opcionalmente se cargan los datos del cliente (DNI o CUIT).
//
// Las facturas de todos los pedidos se leen una sola vez y se comparten entre
// todos los botones de la pantalla.

let cache = null;
let pedidoCache = null;
const oyentes = new Set();

async function cargarFacturas(forzar = false) {
  if (cache && !forzar) return cache;
  if (!pedidoCache || forzar) {
    pedidoCache = supabase
      .from("facturas")
      .select("id, pedido_id, numero, punto_venta, codigo, estado, produccion, total, creada_en")
      .not("pedido_id", "is", null)
      .order("creada_en", { ascending: false })
      .limit(2000)
      .then(({ data }) => {
        const mapa = {};
        for (const f of data || []) {
          // Gana la emitida real; si no, la última
          const actual = mapa[f.pedido_id];
          const mejor = (x) => (x.estado === "emitida" ? 2 : 0) + (x.produccion ? 1 : 0);
          if (!actual || mejor(f) > mejor(actual)) mapa[f.pedido_id] = f;
        }
        cache = mapa;
        oyentes.forEach((fn) => fn());
        return mapa;
      });
  }
  return pedidoCache;
}

export function numeroFactura(f) {
  return `${String(f.punto_venta).padStart(5, "0")}-${String(f.numero).padStart(8, "0")}`;
}

export function linkFactura(f) {
  return `${window.location.origin}/factura/${f.codigo}`;
}

function linkWhatsApp(telefono, f) {
  const tel = String(telefono || "").replace(/\D/g, "").replace(/^0/, "");
  const texto = `¡Hola! Te paso la factura de tu compra en Bolson Click 🧾\n${linkFactura(f)}\n\n¡Gracias por elegirnos!`;
  return `https://wa.me/${tel ? "549" + tel.slice(-10) : ""}?text=${encodeURIComponent(texto)}`;
}

export default function BotonFacturar({ pedido }) {
  const [, setVersion] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [masDatos, setMasDatos] = useState(false);
  const [condicion, setCondicion] = useState("consumidor_final");
  const [docNro, setDocNro] = useState("");
  const [nombre, setNombre] = useState("");
  const [emitiendo, setEmitiendo] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fn = () => setVersion((v) => v + 1);
    oyentes.add(fn);
    cargarFacturas();
    return () => oyentes.delete(fn);
  }, []);

  const factura = cache?.[pedido.id];
  const emitida = factura?.estado === "emitida";

  async function emitir() {
    setError("");
    if (condicion !== "consumidor_final" && docNro.replace(/\D/g, "").length !== 11) {
      setError("Para ese tipo de cliente hace falta el CUIT (11 números).");
      return;
    }
    setEmitiendo(true);
    try {
      const res = await fetch("/api/admin/arca/facturar", {
        method: "POST",
        headers: await cabeceraAdmin(supabase),
        body: JSON.stringify({
          pedido_id: pedido.id,
          condicion,
          doc_nro: docNro,
          nombre: nombre || pedido.nombre_cliente || ""
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      await cargarFacturas(true);
      setAbierto(false);
    } catch (e) {
      setError(/Failed to fetch|NetworkError/i.test(e.message) ? "Sin conexión. Probá de nuevo con señal." : e.message);
    } finally {
      setEmitiendo(false);
    }
  }

  if (emitida) {
    return (
      <div className="text-right mb-1">
        <a
          href={`/factura/${factura.codigo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-emerald-700 hover:underline block"
        >
          🧾 Factura C {numeroFactura(factura)}
          {!factura.produccion && " (prueba)"}
        </a>
        <a
          href={linkWhatsApp(pedido.telefono_cliente, factura)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-semibold text-green-600 hover:underline block"
        >
          Mandar por WhatsApp
        </a>
        {!factura.produccion && (
          <button onClick={() => setAbierto(true)} className="text-[11px] text-gray-500 underline block ml-auto">
            Facturar de verdad
          </button>
        )}
        {abierto && ventana()}
      </div>
    );
  }

  function ventana() {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true">
        <div className="bg-white rounded-3xl w-full max-w-sm p-5 text-left">
          <h3 className="font-extrabold text-lg text-gray-800">🧾 Facturar pedido</h3>
          <p className="text-sm text-gray-600 mt-1">
            Factura C por <b>${formatPrice(pedido.total)}</b>
            {pedido.nombre_cliente ? ` · ${pedido.nombre_cliente}` : ""}
          </p>

          {!masDatos ? (
            <div className="mt-3 bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800">A consumidor final</p>
              <p className="text-[11.5px] text-gray-500">
                Lo normal. No hace falta DNI (ARCA lo pide recién desde $10.000.000).
              </p>
              <button type="button" onClick={() => setMasDatos(true)} className="text-xs text-brand-blue underline mt-1">
                El cliente pidió factura con sus datos
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <select value={condicion} onChange={(e) => setCondicion(e.target.value)} className="input-field text-sm">
                <option value="consumidor_final">Consumidor final</option>
                <option value="monotributo">Monotributista</option>
                <option value="responsable_inscripto">Responsable inscripto</option>
                <option value="exento">Exento</option>
              </select>
              <input
                value={docNro}
                onChange={(e) => setDocNro(e.target.value)}
                inputMode="numeric"
                className="input-field text-sm"
                placeholder={condicion === "consumidor_final" ? "DNI o CUIT (opcional)" : "CUIT (11 números)"}
              />
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="input-field text-sm"
                placeholder={pedido.nombre_cliente || "Nombre o razón social"}
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 mt-2" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-semibold text-gray-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={emitir}
              disabled={emitiendo}
              className="flex-1 bg-brand-blue text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {emitiendo ? "Pidiendo CAE..." : "Emitir factura"}
            </button>
          </div>
          <p className="text-[10.5px] text-gray-400 mt-2 text-center">
            Se emite en ARCA al instante y no se puede borrar (se anula con nota de crédito).
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="text-xs font-bold text-emerald-700 block ml-auto hover:underline mb-1"
      >
        🧾 Facturar
        {factura?.estado === "error" && <span className="text-red-600"> (reintentar)</span>}
      </button>
      {abierto && ventana()}
    </>
  );
}
