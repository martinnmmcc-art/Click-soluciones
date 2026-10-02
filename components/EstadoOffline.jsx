"use client";

import { useEffect, useState } from "react";
import { catalogoLocal, fechaCatalogo, ventasPendientes } from "@/lib/cajaOffline";

// Muestra si la app está lista para trabajar sin señal, y deja forzar la
// descarga. En la Comarca la señal se corta seguido: conviene poder
// verificar antes de salir, no descubrirlo cuando no hay internet.
export default function EstadoOffline() {
  const [productos, setProductos] = useState(0);
  const [fecha, setFecha] = useState(null);
  const [paginas, setPaginas] = useState(0);
  const [pendientes, setPendientes] = useState(0);
  const [descargando, setDescargando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  async function revisar() {
    setProductos(catalogoLocal().length);
    setFecha(fechaCatalogo());
    setPendientes(ventasPendientes().length);

    // Cuántas pantallas quedaron guardadas
    try {
      const nombres = await caches.keys();
      let total = 0;
      for (const n of nombres) {
        const c = await caches.open(n);
        const claves = await c.keys();
        total += claves.filter((k) => {
          try {
            const u = new URL(k.url);
            return u.origin === window.location.origin && !u.pathname.startsWith("/_next");
          } catch (e) {
            return false;
          }
        }).length;
      }
      setPaginas(total);
    } catch (e) {}
  }

  useEffect(() => {
    revisar();
  }, []);

  // La app se prepara sola (AutoSinSenal). Este botón le pide al mismo
  // trabajador que lo haga ya, así nunca corren dos preparaciones juntas.
  function descargarTodo() {
    setMensaje("");
    window.dispatchEvent(new CustomEvent("sin-senal-forzar"));
  }

  // Mostramos lo que va haciendo el trabajador automático
  useEffect(() => {
    const alCambiarEstado = (e) => {
      setDescargando(!!e.detail?.trabajando);
      if (e.detail?.trabajando) setMensaje(e.detail.paso || "Guardando...");
      else setMensaje("");
    };
    window.addEventListener("sin-senal-estado", alCambiarEstado);
    return () => window.removeEventListener("sin-senal-estado", alCambiarEstado);
  }, []);

  // Al preparar desde la barra de arriba, este bloque se actualiza
  useEffect(() => {
    window.addEventListener("sin-senal-actualizado", revisar);
    return () => window.removeEventListener("sin-senal-actualizado", revisar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listo = productos > 0 && paginas > 5;

  return (
    <div
      className={`rounded-2xl p-4 border-2 ${
        listo ? "bg-green-50 border-green-300" : "bg-amber-50 border-amber-300"
      }`}
    >
      <p className="text-sm font-bold text-gray-800">
        {listo ? "📴 Listo para trabajar sin señal" : "⚠️ Falta descargar para usar sin señal"}
      </p>

      <div className="text-[11px] text-gray-600 mt-1.5 space-y-0.5">
        <p>
          {productos > 0 ? "✓" : "✗"} {productos} productos guardados
          {fecha && ` · ${fecha.toLocaleDateString("es-AR")}`}
        </p>
        <p>
          {paginas > 5 ? "✓" : "✗"} {paginas} pantallas guardadas
        </p>
        {pendientes > 0 && (
          <p className="text-amber-800 font-bold">
            📤 {pendientes} venta(s) esperando enviarse
          </p>
        )}
      </div>

      {mensaje && (
        <p className="text-[11px] font-semibold text-gray-700 bg-white rounded-lg p-2 mt-2">
          {mensaje}
        </p>
      )}

      <button
        onClick={descargarTodo}
        disabled={descargando}
        className="w-full bg-brand-blue text-white text-xs font-bold py-2.5 rounded-xl mt-3 disabled:opacity-50"
      >
        {descargando ? "Guardando..." : "Actualizar ahora (se hace solo)"}
      </button>

      <p className="text-[10px] text-gray-500 mt-2">
        Se actualiza sola cada 15 minutos y apenas vuelve la señal. No hace falta tocar nada.
      </p>
    </div>
  );
}
