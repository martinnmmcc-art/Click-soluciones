"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";

// Cambia los porcentajes de precio de muchos productos a la vez y recalcula
// sus precios. Usa la función recalcular_porcentajes de Supabase, que trabaja
// sobre todo el catálogo de una vez (sin el límite de 1000 filas).
//
// Un campo vacío significa "no cambiar": cada producto conserva el que tenía.
// Los productos con "Poner el precio a mano" guardan los porcentajes nuevos
// pero no se les toca el precio.

const CAMPOS = [
  { clave: "transferencia", etiqueta: "Transferencia", ayuda: "Recargo del proveedor por pagar así", defecto: 3 },
  { clave: "dolar", etiqueta: "Suba del dólar", ayuda: "Colchón entre pedido y venta", defecto: 5 },
  { clave: "transporte", etiqueta: "Transporte", ayuda: "El flete hasta El Bolsón", defecto: 15 },
  { clave: "ganancia", etiqueta: "Ganancia", ayuda: "Lo que te queda a vos", defecto: 80 }
];

const VACIO = { transferencia: "", dolar: "", transporte: "", ganancia: "" };

function Porcentajes() {
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState("");
  const [soloStock, setSoloStock] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [pct, setPct] = useState(VACIO);

  const [simulacion, setSimulacion] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.rpc("categorias_productos").then(({ data }) => setCategorias(data || []));
  }, []);

  // Cualquier cambio invalida la vista previa anterior
  useEffect(() => {
    setSimulacion(null);
    setMensaje("");
  }, [categoria, soloStock, busqueda, pct]);

  function parametros(aplicar) {
    const num = (v) => (v === "" || v === null ? null : Number(v));
    return {
      p_categoria: categoria || null,
      p_solo_stock: soloStock,
      p_busqueda: busqueda.trim() || null,
      p_transferencia: num(pct.transferencia),
      p_dolar: num(pct.dolar),
      p_transporte: num(pct.transporte),
      p_ganancia: num(pct.ganancia),
      p_aplicar: aplicar
    };
  }

  const hayCambios = Object.values(pct).some((v) => v !== "");

  async function verCambios() {
    setError("");
    setCargando(true);
    const { data, error: err } = await supabase.rpc("recalcular_porcentajes", parametros(false));
    setCargando(false);
    if (err) return setError(err.message);
    setSimulacion(data);
  }

  async function aplicar() {
    if (!simulacion) return;
    const ok = window.confirm(
      `Se van a recalcular ${simulacion.productos} productos. ` +
        `${simulacion.suben} suben y ${simulacion.bajan} bajan de precio. ¿Aplicar?`
    );
    if (!ok) return;

    setError("");
    setCargando(true);
    const { data, error: err } = await supabase.rpc("recalcular_porcentajes", parametros(true));
    setCargando(false);
    if (err) return setError(err.message);

    setMensaje(`Listo: ${data.productos} productos recalculados.`);
    setSimulacion(null);
    setPct(VACIO);
  }

  function usarDefecto() {
    setPct(Object.fromEntries(CAMPOS.map((c) => [c.clave, String(c.defecto)])));
  }

  return (
    <main className="min-h-screen bg-brand-bg pb-10">
      <div className="container-app px-4 py-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-extrabold text-xl text-gray-800">Porcentajes de precio</h1>
          <Link href="/admin" className="text-sm text-brand-blue font-medium">
            ← Volver
          </Link>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Cambiá los porcentajes de muchos productos juntos. El precio se recalcula solo.
        </p>

        {/* Qué productos */}
        <div className="card p-4 mb-4">
          <p className="font-bold text-gray-800 text-sm mb-3">¿A qué productos?</p>

          <label className="text-xs font-bold text-gray-700 block mb-1">Categoría</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="input-field mb-3"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.categoria} value={c.categoria}>
                {c.categoria} ({c.cantidad})
              </option>
            ))}
          </select>

          <label className="text-xs font-bold text-gray-700 block mb-1">
            Que el nombre contenga (opcional)
          </label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input-field mb-3"
            placeholder="Ej: vinilo, cargador, balanza"
          />

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={soloStock}
              onChange={(e) => setSoloStock(e.target.checked)}
            />
            Solo los que tengo en stock
          </label>
        </div>

        {/* Porcentajes */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-gray-800 text-sm">Porcentajes nuevos</p>
            <button
              type="button"
              onClick={usarDefecto}
              className="text-xs text-brand-blue font-semibold"
            >
              Poner 3 / 5 / 15 / 80
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mb-3">
            Dejá vacío lo que no quieras cambiar.
          </p>

          {CAMPOS.map((c) => (
            <div key={c.clave} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-700">{c.etiqueta}</p>
                <p className="text-[11px] text-gray-500">{c.ayuda}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <input
                  type="number"
                  inputMode="decimal"
                  value={pct[c.clave]}
                  onChange={(e) => setPct({ ...pct, [c.clave]: e.target.value })}
                  placeholder="—"
                  className="w-16 text-center border border-gray-300 rounded-lg py-1.5 font-bold"
                />
                <span className="text-sm font-bold text-gray-500">%</span>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        {mensaje && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm font-semibold rounded-xl p-3 mb-4">
            {mensaje}
          </div>
        )}

        {simulacion && (
          <div className="card p-4 mb-4 border-2 border-brand-blue/30">
            <p className="text-sm text-gray-700">
              <b>{simulacion.productos}</b> productos:{" "}
              <b className="text-red-600">{simulacion.suben} suben</b>,{" "}
              <b className="text-green-600">{simulacion.bajan} bajan</b>, {simulacion.iguales} quedan igual.
            </p>
            {simulacion.variacion_promedio !== null && (
              <p className="text-xs text-gray-500 mt-1">
                Cambio promedio de precio: {simulacion.variacion_promedio > 0 ? "+" : ""}
                {simulacion.variacion_promedio}%
              </p>
            )}
          </div>
        )}

        {!simulacion ? (
          <button
            onClick={verCambios}
            disabled={cargando || !hayCambios}
            className="btn-primary w-full disabled:opacity-50"
          >
            {cargando ? "Calculando..." : "Ver cuánto cambian los precios"}
          </button>
        ) : (
          <button
            onClick={aplicar}
            disabled={cargando || simulacion.productos === 0}
            className="btn-primary w-full disabled:opacity-50"
          >
            {cargando ? "Aplicando..." : `Aplicar a ${simulacion.productos} productos`}
          </button>
        )}

        <p className="text-[11px] text-gray-400 mt-3">
          Los productos con el precio puesto a mano guardan los porcentajes nuevos, pero su precio no cambia.
        </p>
      </div>
    </main>
  );
}

export default function PorcentajesPage() {
  return (
    <AdminGuard>
      <Porcentajes />
    </AdminGuard>
  );
}
