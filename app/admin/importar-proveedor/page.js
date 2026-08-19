"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { formatPrice } from "@/lib/whatsapp";

function ImportarProveedor() {
  const [categorias, setCategorias] = useState([]);
  const [cargandoCats, setCargandoCats] = useState(true);
  const [errorCats, setErrorCats] = useState("");

  const [catSeleccionada, setCatSeleccionada] = useState("");
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
    if (!catSeleccionada) return;
    if (!confirm("¿Importar esta categoría? Los productos entran como 'a pedido' con stock 0.")) return;

    setImportando(true);
    setResultado(null);

    let totales = { importados: 0, actualizados: 0, omitidos: 0 };
    let pagina = 1;
    let hayMas = true;

    try {
      // El proveedor entrega de a 100 productos, así que vamos página por página
      while (hayMas && pagina <= 30) {
        setProgreso(`Procesando página ${pagina}...`);

        const res = await fetch("/api/admin/importar-proveedor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoria: catSeleccionada,
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

      setResultado(totales);
      setPreview(null);
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
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              1. Elegí una categoría
            </p>
            <div className="flex flex-col gap-2 mb-5">
              {categorias.map((c) => (
                <button
                  key={c.id}
                  onClick={() => previsualizar(c.id)}
                  disabled={importando}
                  className={`card p-3 text-left flex justify-between items-center ${
                    catSeleccionada === c.id ? "border-2 border-brand-blue" : ""
                  }`}
                >
                  <span className="text-sm text-gray-700 font-medium flex-1 pr-2">{c.nombre}</span>
                  <span className="text-xs font-bold text-gray-400 whitespace-nowrap">
                    {c.cantidad} prod.
                  </span>
                </button>
              ))}
            </div>

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
