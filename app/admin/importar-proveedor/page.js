"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

function ImportarProveedor() {
  const [categorias, setCategorias] = useState([]);
  const [cargandoCats, setCargandoCats] = useState(true);
  const [errorCats, setErrorCats] = useState("");

  const [catSeleccionada, setCatSeleccionada] = useState("");
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [excluidas, setExcluidas] = useState([]);

  // Las categorías que decidiste no vender no se pueden elegir
  useEffect(() => {
    async function cargarExcluidas() {
      const { data } = await supabase.from("categorias_excluidas").select("categoria");
      setExcluidas((data || []).map((e) => e.categoria));
    }
    cargarExcluidas();
  }, []);

  function alternarCategoria(id) {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setPreview(null);
    setResultado(null);
  }
  const [preview, setPreview] = useState(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);

  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [actualizarPrecios, setActualizarPrecios] = useState(true);

  useEffect(() => {
    async function cargarCategorias() {
      try {
        const res = await fetch("/api/admin/importar-proveedor?accion=categorias");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al conectar con el proveedor");
        setCategorias(data.categorias || []);
      } catch (e) {
        setErrorCats(e.message);
      } finally {
        setCargandoCats(false);
      }
    }
    cargarCategorias();
  }, []);

  async function previsualizar(catId) {
    setCatSeleccionada(catId);
    setPreview(null);
    setResultado(null);
    setCargandoPreview(true);
    try {
      const res = await fetch(
        `/api/admin/importar-proveedor?accion=previsualizar&categoria=${catId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data);
    } catch (e) {
      alert("No se pudo previsualizar: " + e.message);
    } finally {
      setCargandoPreview(false);
    }
  }

  async function importar() {
    const cats = seleccionadas.length > 0 ? seleccionadas : [];
    if (cats.length === 0) return;

    const nombres = categorias
      .filter((c) => cats.includes(c.id))
      .map((c) => c.nombre)
      .join(", ");

    if (
      !confirm(
        `¿Importar ${cats.length} categoría${cats.length === 1 ? "" : "s"}?\n\n` +
          `${nombres}\n\n` +
          `Los productos entran como "a pedido" con stock 0.`
      )
    )
      return;

    setImportando(true);
    setResultado(null);

    const totales = { importados: 0, actualizados: 0, omitidos: 0 };

    try {
      // Vamos categoría por categoría, y dentro de cada una página por página
      for (let n = 0; n < cats.length; n++) {
        const cat = cats[n];
        const nombreCat = categorias.find((c) => c.id === cat)?.nombre || "";

        let pagina = 1;
        let hayMas = true;

        while (hayMas && pagina <= 30) {
          setProgreso(
            `Categoría ${n + 1} de ${cats.length}: ${nombreCat} · página ${pagina}`
          );

          const res = await fetch("/api/admin/importar-proveedor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categoria: cat,
              pagina,
              actualizar_precios: actualizarPrecios
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          totales.importados += data.importados;
          totales.actualizados += data.actualizados;
          totales.omitidos += data.omitidos;

          hayMas = data.hay_mas;
          pagina++;
        }
      }

      setResultado(totales);
      setPreview(null);
      setSeleccionadas([]);
    } catch (e) {
      alert("Se cortó la importación: " + e.message + "\n\nLo que ya se importó quedó guardado.");
      setResultado(totales);
    } finally {
      setImportando(false);
      setProgreso(null);
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg pb-16">
      <div className="container-app px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="font-extrabold text-xl text-gray-800 mt-1 mb-2">
          Importar catálogo de Next Cell
        </h1>
        <p className="text-xs text-gray-500 mb-5">
          Trae los productos del proveedor como <b>&quot;a pedido&quot;</b> (stock 0), con la foto,
          la descripción y el precio ya calculado con tu fórmula: costo + 3% + 5% + 80% + 14,5% de flete.
        </p>

        {cargandoCats && (
          <div className="card p-6 text-center text-gray-400 text-sm">
            Conectando con el proveedor...
          </div>
        )}

        {errorCats && (
          <div className="card p-4 bg-red-50 border border-red-200">
            <p className="text-sm font-bold text-red-700 mb-1">No se pudo conectar</p>
            <p className="text-xs text-red-600">{errorCats}</p>
            <p className="text-xs text-gray-600 mt-2">
              Puede ser que la web del proveedor esté caída, o que no permita leer su catálogo
              de forma automática. En ese caso habría que cargar los productos a mano.
            </p>
          </div>
        )}

        {!cargandoCats && !errorCats && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Elegí una o varias categorías
              </p>
              {seleccionadas.length > 0 && (
                <button
                  onClick={() => setSeleccionadas([])}
                  className="text-[11px] font-bold text-red-500"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 mb-4">
              {categorias.map((c) => {
                const excluida = excluidas.some(
                  (e) => c.nombre.toLowerCase().includes(e.toLowerCase())
                );
                const elegida = seleccionadas.includes(c.id);

                return (
                  <label
                    key={c.id}
                    className={`card p-3 flex items-center gap-3 ${
                      excluida
                        ? "opacity-40"
                        : elegida
                        ? "border-2 border-brand-blue bg-blue-50"
                        : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={elegida}
                      disabled={excluida || importando}
                      onChange={() => alternarCategoria(c.id)}
                      className="w-5 h-5 flex-shrink-0"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700 font-medium block line-clamp-1">
                        {c.nombre}
                      </span>
                      {excluida && (
                        <span className="text-[10px] text-red-600 font-bold">
                          Excluida: no la querés en la tienda
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-bold text-gray-400 whitespace-nowrap">
                      {c.cantidad}
                    </span>
                  </label>
                );
              })}
            </div>

            {seleccionadas.length > 0 && (
              <div className="card p-4 mb-4 border-2 border-brand-blue">
                <p className="text-sm font-bold text-gray-800">
                  {seleccionadas.length} categoría
                  {seleccionadas.length === 1 ? "" : "s"} elegida
                  {seleccionadas.length === 1 ? "" : "s"}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
                  {categorias
                    .filter((c) => seleccionadas.includes(c.id))
                    .reduce((a, c) => a + c.cantidad, 0)}{" "}
                  productos en total. Los que ya tengas no se duplican.
                </p>

                <label className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                  <input
                    type="checkbox"
                    checked={actualizarPrecios}
                    onChange={(e) => setActualizarPrecios(e.target.checked)}
                  />
                  Actualizar el precio de los que ya tengo
                </label>

                <button
                  onClick={importar}
                  disabled={importando}
                  className="btn-primary w-full text-sm disabled:opacity-50"
                >
                  {importando ? progreso || "Importando..." : "Importar"}
                </button>

                {importando && (
                  <p className="text-[10px] text-gray-400 mt-2 text-center">
                    Puede tardar varios minutos. No cierres la app.
                  </p>
                )}
              </div>
            )}

            {cargandoPreview && (
              <div className="card p-5 text-center text-gray-400 text-sm">Revisando productos...</div>
            )}

            {preview && (
              <div className="card p-4 mb-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  2. Vista previa
                </p>

                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-extrabold text-green-700">{preview.nuevos}</p>
                    <p className="text-[11px] text-green-800">Nuevos a importar</p>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-extrabold text-gray-600">{preview.ya_importados}</p>
                    <p className="text-[11px] text-gray-600">Ya los tenés</p>
                  </div>
                </div>

                {preview.total_paginas > 1 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
                    Esta categoría tiene {preview.total_paginas} páginas de productos.
                    Se van a importar todas, puede tardar un rato.
                  </p>
                )}

                <p className="text-xs font-bold text-gray-600 mb-2">Ejemplos de cómo quedarían:</p>
                <div className="space-y-1.5 mb-4">
                  {preview.muestra.map((m, i) => (
                    <div key={i} className="flex justify-between items-center text-xs border-b border-gray-100 pb-1.5">
                      <span className="flex-1 text-gray-700 line-clamp-1 pr-2">
                        {m.nombre}
                        {m.ya_importado && (
                          <span className="text-[10px] text-gray-400"> (ya lo tenés)</span>
                        )}
                      </span>
                      <span className="text-gray-400 whitespace-nowrap">
                        ${formatPrice(m.costo)} →{" "}
                        <b className="text-green-700">${formatPrice(m.precio_venta)}</b>
                      </span>
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                  <input
                    type="checkbox"
                    checked={actualizarPrecios}
                    onChange={(e) => setActualizarPrecios(e.target.checked)}
                  />
                  Actualizar el precio de los que ya tengo si el proveedor lo cambió
                </label>

                <button
                  onClick={importar}
                  disabled={importando}
                  className="btn-primary w-full text-sm disabled:opacity-50"
                >
                  {importando ? progreso || "Importando..." : "Importar esta categoría"}
                </button>
              </div>
            )}

            {resultado && (
              <div className="card p-4 bg-green-50 border border-green-200">
                <p className="font-bold text-green-800 text-sm mb-2">✅ Importación terminada</p>
                <div className="text-xs text-gray-700 space-y-1">
                  <p>
                    <b>{resultado.importados}</b> productos nuevos agregados
                  </p>
                  <p>
                    <b>{resultado.actualizados}</b> precios actualizados
                  </p>
                  <p>
                    <b>{resultado.omitidos}</b> omitidos (ya estaban igual o sin precio)
                  </p>
                </div>
                <Link
                  href="/admin/productos?tab=a-pedido"
                  className="block text-center bg-white border border-green-300 text-green-800 text-xs font-bold py-2 rounded-xl mt-3"
                >
                  Ver los productos importados →
                </Link>
              </div>
            )}
          </>
        )}

        <div className="card p-4 mt-6 bg-blue-50/50 border border-blue-200">
          <p className="text-xs font-bold text-gray-700 mb-1">Cosas a tener en cuenta</p>
          <ul className="text-[11px] text-gray-600 space-y-1 list-disc pl-4">
            <li>Los productos entran como <b>a pedido</b>, con stock 0: no se venden como disponibles.</li>
            <li>Nunca se duplica nada: si ya importaste un producto, lo reconoce.</li>
            <li>Las fotos se muestran desde la web del proveedor. Si él las borra, se dejan de ver.</li>
            <li>El flete es estimado (14,5%). Cuando pidas el producto de verdad, ajustá el costo real.</li>
            <li>Conviene repetir la importación cada tanto para mantener los precios al día.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

export default function ImportarProveedorPage() {
  return (
    <AdminGuard>
      <ImportarProveedor />
    </AdminGuard>
  );
}
