"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { buscarClientes, normalizarTexto } from "@/lib/buscar";

// Pasa las ventas de un teléfono (uno de relleno como "0000000000", o uno
// equivocado) a un cliente registrado. Así no quedan dos "Javier" con
// compras separadas y lo que compró cada uno suma bien.

// ¿Parece un teléfono real de Argentina? (10 dígitos y no todo ceros)
export function telefonoDudoso(tel) {
  const d = String(tel || "").replace(/\D/g, "");
  if (d.length < 10) return true;
  if (/^0+$/.test(d) || /0{5,}/.test(d)) return true;
  return false;
}

export default function AsociarCliente({ telefonoOrigen, nombreOrigen, cantidadVentas, onListo }) {
  const [abierto, setAbierto] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [moviendo, setMoviendo] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!abierto || clientes.length) return;
    supabase
      .from("clientes")
      .select("id, nombre, telefono, localidad")
      .order("nombre")
      .then(({ data }) => setClientes((data || []).filter((c) => c.telefono !== telefonoOrigen)));
  }, [abierto, clientes.length, telefonoOrigen]);

  // Sugerencias: registrados con el mismo nombre (primera palabra)
  const primerNombre = normalizarTexto(nombreOrigen).split(" ")[0];
  const sugeridos =
    primerNombre.length >= 3
      ? clientes.filter((c) => normalizarTexto(c.nombre).split(" ")[0] === primerNombre).slice(0, 4)
      : [];
  const resultados = busqueda.trim().length >= 2 ? buscarClientes(clientes, busqueda, 8) : sugeridos;

  async function asociar(cliente) {
    if (
      !confirm(
        `¿Pasar ${cantidadVentas === 1 ? "la venta" : `las ${cantidadVentas} ventas`} de "${nombreOrigen}" (${telefonoOrigen}) ` +
          `a ${cliente.nombre} (${cliente.telefono})?\n\nTambién se pasan sus cupones, favoritos y opiniones.`
      )
    )
      return;
    setMoviendo(true);
    setAviso("");
    try {
      const { data, error } = await supabase.rpc("pasar_ventas_a_cliente", {
        p_telefono_origen: telefonoOrigen,
        p_cliente_id: cliente.id
      });
      if (error) throw new Error(error.message);
      const r = data?.[0] || {};
      setAviso(`✓ ${r.ventas_movidas || 0} venta(s) pasadas a ${cliente.nombre}.`);
      setAbierto(false);
      onListo?.();
    } catch (e) {
      setAviso("No se pudo: " + e.message);
    } finally {
      setMoviendo(false);
    }
  }

  const dudoso = telefonoDudoso(telefonoOrigen);

  return (
    <div className="mt-2">
      {!abierto ? (
        <button
          onClick={() => setAbierto(true)}
          className={`text-[11px] font-bold rounded-lg px-2.5 py-1.5 ${
            dudoso ? "bg-amber-50 text-amber-900 border border-amber-300" : "text-gray-500 underline"
          }`}
        >
          {dudoso ? "⚠️ Teléfono no válido · asociar a un cliente registrado" : "🔗 Asociar a otro cliente"}
        </button>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5">
          <p className="text-[11px] font-bold text-gray-700 mb-1.5">
            ¿A qué cliente registrado le pertenecen estas ventas?
          </p>
          <input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o celular..."
            className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white"
          />

          {!busqueda.trim() && sugeridos.length > 0 && (
            <p className="text-[10px] text-gray-500 mt-1.5">Con el mismo nombre:</p>
          )}

          <div className="mt-1 space-y-1 max-h-56 overflow-y-auto">
            {resultados.map((c) => (
              <button
                key={c.id}
                onClick={() => asociar(c)}
                disabled={moviendo}
                className="w-full text-left bg-white border border-gray-100 rounded-lg px-2.5 py-2 disabled:opacity-50"
              >
                <span className="block text-xs font-bold text-gray-800">{c.nombre}</span>
                <span className="block text-[10px] text-gray-500">
                  📱 {c.telefono}
                  {c.localidad ? ` · ${c.localidad}` : ""}
                </span>
              </button>
            ))}
            {busqueda.trim().length >= 2 && resultados.length === 0 && (
              <p className="text-[11px] text-gray-500 py-1">
                No hay un cliente así. Registralo en Clientes y volvé.
              </p>
            )}
          </div>

          <button onClick={() => setAbierto(false)} className="text-[11px] text-gray-500 mt-1.5">
            Cancelar
          </button>
        </div>
      )}
      {aviso && (
        <p className={`text-[11px] font-semibold mt-1.5 ${aviso.startsWith("✓") ? "text-green-700" : "text-amber-800"}`}>
          {aviso}
        </p>
      )}
    </div>
  );
}
