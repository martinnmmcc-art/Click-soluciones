"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";

// Cambia los porcentajes de precio de muchos productos a la vez y recalcula
// sus precios. Tiene las mismas dos solapas que la lista de productos:
// "Tengo" (lo que ya compraste) y "A pedido" (lo que se pide bajo consulta).
//
// Usa la función recalcular_porcentajes de Supabase, que trabaja sobre todo
// el catálogo de una vez (sin el límite de 1000 filas).
//
// Un campo vacío significa "no cambiar": cada producto conserva el que tenía.
// Los productos con "Poner el precio a mano" guardan los porcentajes nuevos
// pero no se les toca el precio.

const CAMPOS = [
  { clave: "transferencia", etiqueta: "Transferencia", ayuda: "Recargo del proveedor por pagar así" },
  { clave: "dolar", etiqueta: "Suba del dólar", ayuda: "Colchón entre pedido y venta" },
  { clave: "transporte", etiqueta: "Transporte", ayuda: "El flete hasta El Bolsón" },
  { clave: "ganancia", etiqueta: "Ganancia", ayuda: "Lo que te queda a vos" }
];

const SOLAPAS = [
  { valor: "tengo", etiqueta: "📦 Tengo", activa: "bg-brand-blue text-white shadow-sm" },
  { valor: "a-pedido", etiqueta: "🛍️ A pedido", activa: "bg-purple-600 text-white shadow-sm" },
  { valor: "todos", etiqueta: "Todos", activa: "bg-gray-800 text-white shadow-sm" }
];

const VACIO = { transferencia: "", dolar: "", transporte: "", ganancia: "" };

function Porcentajes() {
  const [tipo, setTipo] = useState("tengo");
  const [resumen, setResumen] = useState({});
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pct, setPct] = useState(VACIO);

  const [simulacion, setSimulacion] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function cargarResumen() {
    const { data } = await supabase.rpc("resumen_porcentajes");
    const mapa = {};
    (data || []).forEach((r) => {
      mapa[r.tipo] = r;
    });
    setResumen(mapa);
  }

  useEffect(() => {
    // Si venís desde la lista de productos, abre en la misma solapa
    const desdeUrl = new URLSearchParams(window.location.search).get("tipo");
    if (SOLAPAS.some((s) => s.valor === desdeUrl)) setTipo(desdeUrl);

    cargarResumen();
    supabase.rpc("categorias_productos").then(({ data }) => setCategorias(data || []));
  }, []);

  // Cualquier cambio invalida la vista previa anterior
  useEffect(() => {
    setSimulacion(null);
    setMensaje("");
  }, [tipo, categoria, busqueda, pct]);

  function cantidadSolapa(valor) {
    if (valor === "todos") {
      return Number(resumen.tengo?.productos || 0) + Number(resumen["a-pedido"]?.productos || 0);
    }
    return Number(resumen[valor]?.productos || 0);
  }

  // Porcentajes que usa hoy la solapa elegida, para mostrarlos de referencia
  const actual = tipo === "todos" ? null : resumen[tipo];

  function parametros(aplicar) {
    const num = (v) => (v === "" || v === null ? null : Number(v));
    return {
      p_tipo: tipo,
      p_categoria: categoria || null,
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
    cargarResumen();
  }

  function usarDefecto() {
    setPct({ transferencia: "3", dolar: "5", transporte: "15", ganancia: "80" });
  }

  return (
    <main className="min-h-screen bg-brand-bg pb-10">
      <div className="container-app px-4 py-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-extrabold text-xl text-gray-800">Porcentajes de precio</h1>
          <Link href="/admin/productos" className="text-sm text-brand-blue font-medium">
            ← Productos
          </Link>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Cambiá los porcentajes de muchos productos juntos. El precio se recalcula solo.
        </p>

        {/* SOLAPAS */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {SOLAPAS.map((s) => (
            <button
              key={s.valor}
              onClick={() => setTipo(s.valor)}
              className={`py-3 rounded-xl text-sm font-bold transition ${
                tipo === s.valor ? s.activa : "bg-white border border-gray-200 text-gray-600"
              }`}
            >
              {s.etiqueta}
              <span className="block text-[11px] font-semibold opacity-80">
                {cantidadSolapa(s.valor)}
              </span>
            </button>
          ))}
        </div>

        {actual && (
          <p className="text-xs text-gray-600 bg-white border border-gray-200 rounded-xl px-3 py-2 mb-4">
            Hoy usan: transferencia {Number(actual.transferencia)}% · dólar {Number(actual.dolar)}% ·
            transporte {Number(actual.transporte)}% · ganancia {Number(actual.ganancia)}%
            {actual.mezclados && " (algunos tienen otros valores)"}
          </p>
        )}

        {/* Filtros opcionales */}
        <div className="card p-4 mb-4">
          <p className="font-bold text-gray-800 text-sm mb-3">Achicar la selección (opcional)</p>

          <label className="text-xs font-bold text-gray-700 block mb-1">Categoría</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="input-field mb-3"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.categoria} value={c.categoria}>
                {c.categoria}
              </option>
            ))}
          </select>

          <label className="text-xs font-bold text-gray-700 block mb-1">Que el nombre contenga</label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input-field"
            placeholder="Ej: vinilo, cargador, balanza"
          />
        </div>

        {/* Porcentajes */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-gray-800 text-sm">Porcentajes nuevos</p>
            <button type="button" onClick={usarDefecto} className="text-xs text-brand-blue font-semibold">
              Poner 3 / 5 / 15 / 80
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mb-3">Dejá vacío lo que no quieras cambiar.</p>

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
                  placeholder={actual ? String(Number(actual[c.clave])) : "—"}
                  className="w-16 text-center border border-gray-300 rounded-lg py-1.5 font-bold placeholder:text-gray-300 placeholder:font-normal"
                />
                <span className="text-sm font-bold text-gray-500">%</span>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4">{error}</div>
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
