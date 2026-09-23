"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { catalogoLocal, guardarCatalogo, fechaCatalogo, ventasPendientes } from "@/lib/cajaOffline";

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

  async function descargarTodo() {
    setDescargando(true);
    setMensaje("");

    try {
      // 1. Productos propios para la caja
      const { data } = await supabase
        .from("Productos")
        .select("id, nombre, precio, precio_oferta, stock, codigo_barras, bajo_pedido")
        .or("bajo_pedido.is.null,bajo_pedido.eq.false")
        .eq("activo", true);

      const cuantos = guardarCatalogo(data || []);

      // 2. Pantallas del panel, en las dos formas que las necesita la app
      const rutas = [
        "/", "/admin", "/admin/caja", "/admin/pedidos", "/admin/productos",
        "/admin/clientes", "/admin/ventas-cerradas", "/admin/resumen-clientes",
        "/admin/balance", "/admin/ofertas", "/admin/cupones", "/admin/resenas",
        "/admin/oportunidades", "/admin/fotos", "/admin/promocionar",
        "/catalogo", "/carrito", "/login"
      ];

      const cache = await caches.open("bolsonclick-app-v9");

      for (const ruta of rutas) {
        try {
          const pagina = await fetch(ruta);
          if (pagina.ok) await cache.put(ruta, pagina.clone());

          const interna = await fetch(ruta, { headers: { RSC: "1" } });
          if (interna.ok) await cache.put(ruta + "?_rsc=1", interna.clone());
        } catch (e) {}
      }

      await revisar();
      setMensaje(`✓ Listo: ${cuantos} productos y ${rutas.length} pantallas guardadas`);
    } catch (e) {
      setMensaje("No se pudo descargar: " + e.message);
    } finally {
      setDescargando(false);
    }
  }

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
        {descargando ? "Descargando..." : "Descargar todo para usar sin señal"}
      </button>

      <p className="text-[10px] text-gray-500 mt-2">
        Hacelo con wifi antes de salir a una zona sin datos.
      </p>
    </div>
  );
}
