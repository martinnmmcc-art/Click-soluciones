"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";
import { urlImagen } from "@/lib/imagenProducto";
import { aplicarBusqueda } from "@/lib/buscar";

// "Elegidos para vos" del inicio.
//  - Tus elegidos: los que marcás acá (columna "destacado"). Siempre entran
//    en la rotación.
//  - Rotativos: el resto se completa solo con productos con stock y foto,
//    cambiando cada 6 horas y alternando categorías.
// Solo se muestran los que tienen stock y foto: si un elegido se queda sin
// stock, se avisa acá y deja de aparecer hasta que vuelva a entrar.

const MODOS = [
  { id: "mixto", titulo: "Mitad míos, mitad rotativos", detalle: "Lo recomendado: lo tuyo siempre está y el resto va cambiando" },
  { id: "mios", titulo: "Solo los míos", detalle: "Se muestran únicamente los que elegís, rotando el orden" },
  { id: "auto", titulo: "Solo rotativos", detalle: "La app elige sola entre todo lo que tenés en stock" }
];

function ElegidosAdmin() {
  const [ajuste, setAjuste] = useState({ modo: "mixto", cantidad: 10 });
  const [mios, setMios] = useState([]);
  const [vistaPrevia, setVistaPrevia] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  async function cargar() {
    setCargando(true);
    const [{ data: aj }, { data: dest }, { data: previa }] = await Promise.all([
      supabase.from("ajustes_app").select("valor").eq("clave", "elegidos").maybeSingle(),
      supabase
        .from("Productos")
        .select("id, nombre, precio, precio_oferta, stock, imagen_url, bajo_pedido, activo")
        .eq("destacado", true)
        .order("nombre"),
      supabase.rpc("elegidos_para_vos")
    ]);
    if (aj?.valor) setAjuste({ modo: aj.valor.modo || "mixto", cantidad: Number(aj.valor.cantidad) || 10 });
    setMios(dest || []);
    setVistaPrevia(previa || []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  // Buscador para sumar productos (solo los tuyos, no los a pedido)
  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      let consulta = supabase
        .from("Productos")
        .select("id, nombre, precio, stock, imagen_url, destacado")
        .or("bajo_pedido.is.null,bajo_pedido.eq.false")
        .eq("activo", true)
        .limit(12);
      consulta = aplicarBusqueda(consulta, q);
      const { data } = await consulta;
      setResultados(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  function mostrarAviso(t) {
    setAviso(t);
    setTimeout(() => setAviso(""), 2500);
  }

  async function marcar(producto, valor) {
    const { error } = await supabase.from("Productos").update({ destacado: valor }).eq("id", producto.id);
    if (error) {
      alert("No se pudo guardar: " + error.message);
      return;
    }
    mostrarAviso(valor ? `✓ "${producto.nombre}" agregado a tus elegidos` : "Sacado de tus elegidos");
    setResultados((prev) => prev.map((r) => (r.id === producto.id ? { ...r, destacado: valor } : r)));
    cargar();
  }

  async function guardarAjuste(nuevo) {
    const valor = { ...ajuste, ...nuevo };
    setAjuste(valor);
    setGuardando(true);
    const { error } = await supabase.from("ajustes_app").upsert({ clave: "elegidos", valor, actualizado_en: new Date().toISOString() });
    setGuardando(false);
    if (error) {
      alert("No se pudo guardar: " + error.message);
      return;
    }
    mostrarAviso("✓ Guardado");
    const { data } = await supabase.rpc("elegidos_para_vos");
    setVistaPrevia(data || []);
  }

  const visibles = mios.filter((p) => p.activo && !p.bajo_pedido && Number(p.stock) > 0 && p.imagen_url);
  const ocultos = mios.filter((p) => !visibles.includes(p));

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1">★ Elegidos para vos</h1>
        <p className="text-xs text-gray-500 mb-4">
          La sección del inicio. Cambia sola cada 6 horas para que el que entra seguido vea cosas nuevas.
        </p>

        {aviso && (
          <p className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">
            {aviso}
          </p>
        )}

        {/* Cómo se arma */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <p className="text-sm font-bold text-gray-800 mb-2">Cómo se arma</p>
          <div className="space-y-2">
            {MODOS.map((m) => (
              <label
                key={m.id}
                className={`flex items-start gap-2 rounded-xl border p-2.5 cursor-pointer ${
                  ajuste.modo === m.id ? "border-brand-blue bg-blue-50" : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="modo"
                  checked={ajuste.modo === m.id}
                  onChange={() => guardarAjuste({ modo: m.id })}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">{m.titulo}</span>
                  <span className="block text-[11px] text-gray-500">{m.detalle}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-gray-700 flex-1">Cuántos productos se muestran</span>
            {[6, 8, 10, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => guardarAjuste({ cantidad: n })}
                disabled={guardando}
                className={`w-10 h-9 rounded-lg text-sm font-bold border ${
                  ajuste.cantidad === n ? "bg-brand-blue text-white border-brand-blue" : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        {/* Tus elegidos */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <p className="text-sm font-bold text-gray-800">Tus elegidos ({visibles.length})</p>
          <p className="text-[11px] text-gray-500 mb-2">Siempre entran en la rotación mientras tengan stock y foto.</p>

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar un producto tuyo para sumarlo..."
            className="input-field text-sm"
          />
          {resultados.length > 0 && (
            <div className="border border-gray-200 rounded-xl mt-2 divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {resultados.map((r) => (
                <div key={r.id} className="flex items-center gap-2 p-2">
                  <img src={urlImagen(r.imagen_url) || "/icons/icon-192.png"} alt="" className="w-10 h-10 rounded object-contain bg-gray-50" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 line-clamp-1">{r.nombre}</p>
                    <p className="text-[10px] text-gray-500">
                      ${formatPrice(r.precio)} · stock {r.stock || 0}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => marcar(r, !r.destacado)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                      r.destacado ? "bg-amber-100 text-amber-800" : "bg-brand-blue text-white"
                    }`}
                  >
                    {r.destacado ? "★ Elegido" : "+ Sumar"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {cargando ? (
            <p className="text-center text-gray-400 text-sm py-4">Cargando...</p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {visibles.map((p) => (
                <div key={p.id} className="flex items-center gap-2 border border-gray-100 rounded-xl p-2">
                  <img src={urlImagen(p.imagen_url)} alt="" className="w-10 h-10 rounded object-contain bg-gray-50" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 line-clamp-1">{p.nombre}</p>
                    <p className="text-[10px] text-gray-500">
                      ${formatPrice(p.precio)} · stock {p.stock}
                    </p>
                  </div>
                  <button type="button" onClick={() => marcar(p, false)} className="text-xs font-bold text-red-500 px-2">
                    Sacar
                  </button>
                </div>
              ))}
              {visibles.length === 0 && (
                <p className="text-[12px] text-gray-500 py-2">
                  Todavía no elegiste ninguno con stock. Buscá arriba y tocá “+ Sumar”.
                </p>
              )}
            </div>
          )}

          {ocultos.length > 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              <p className="text-[11px] font-bold text-amber-800">
                ⚠️ {ocultos.length} elegido{ocultos.length > 1 ? "s" : ""} no se muestra{ocultos.length > 1 ? "n" : ""} (sin stock, sin foto o a pedido)
              </p>
              <div className="mt-1.5 space-y-1">
                {ocultos.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <p className="flex-1 min-w-0 text-[11px] text-amber-900 line-clamp-1">
                      {p.nombre}{" "}
                      <span className="text-amber-700">
                        ({p.bajo_pedido ? "a pedido" : !p.imagen_url ? "sin foto" : "sin stock"})
                      </span>
                    </p>
                    <button type="button" onClick={() => marcar(p, false)} className="text-[11px] font-bold text-red-500">
                      Sacar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Lo que ve el cliente ahora */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-800">Así se ve ahora en el inicio</p>
          <p className="text-[11px] text-gray-500 mb-2">★ = elegido por vos. Cambia sola en unas horas.</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {vistaPrevia.map((p) => (
              <div key={p.id} className="w-24 flex-shrink-0">
                <img src={urlImagen(p.imagen_url)} alt="" className="w-24 h-24 rounded-xl object-contain bg-gray-50" />
                <p className="text-[10px] font-semibold text-gray-700 line-clamp-2 mt-1">
                  {p.es_tuyo && <span className="text-amber-600">★ </span>}
                  {p.nombre}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ElegidosPage() {
  return (
    <AdminGuard>
      <ElegidosAdmin />
    </AdminGuard>
  );
}
