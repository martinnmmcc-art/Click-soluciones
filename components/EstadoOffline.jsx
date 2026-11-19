"use client";

import { useEffect, useState } from "react";
import { catalogoLocal, fechaCatalogo } from "@/lib/cajaOffline";
import {
  cantidadPendiente,
  conProblemas,
  reintentar,
  descartar,
  enviarCola,
  EVENTO_COLA
} from "@/lib/colaOffline";

const NOMBRE_TIPO = {
  venta_caja: "Venta de caja",
  pedido_nuevo: "Pedido nuevo",
  cambio_estado: "Cambio de estado o pago",
  agregar_items: "Productos agregados a un pedido"
};

function resumenAccion(r) {
  const d = r.datos || {};
  if (r.tipo === "venta_caja") return `$${Number(d.total || 0).toLocaleString("es-AR")}${d.nombre_cliente ? " · " + d.nombre_cliente : ""}`;
  if (r.tipo === "pedido_nuevo") return `${d.pedido?.nombre_cliente || "Cliente"} · $${Number(d.pedido?.total || 0).toLocaleString("es-AR")}`;
  if (d.pedido_id) return `Pedido id ${d.pedido_id}`;
  return "";
}
import { leerPedidosOffline, fechaPedidosOffline } from "@/lib/catalogoOffline";
import { espacioLocalUsado } from "@/lib/almacenLocal";

function mb(bytes) {
  return (bytes / 1048576).toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

// Muestra si la app está lista para trabajar sin señal, y deja forzar la
// descarga. En la Comarca la señal se corta seguido: conviene poder
// verificar antes de salir, no descubrirlo cuando no hay internet.
export default function EstadoOffline() {
  const [productos, setProductos] = useState(0);
  const [fecha, setFecha] = useState(null);
  const [paginas, setPaginas] = useState(0);
  const [pendientes, setPendientes] = useState(0);
  const [problemas, setProblemas] = useState([]);
  const [descargando, setDescargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [pedidosGuardados, setPedidosGuardados] = useState(0);
  const [fechaPedidos, setFechaPedidos] = useState(null);
  const [espacio, setEspacio] = useState(null);
  const [localUsado, setLocalUsado] = useState(0);

  async function revisar() {
    setProductos(catalogoLocal().length);
    setFecha(fechaCatalogo());
    setPendientes(cantidadPendiente());
    setProblemas(conProblemas());
    setPedidosGuardados((await leerPedidosOffline()).length);
    setFechaPedidos(await fechaPedidosOffline());
    setLocalUsado(espacioLocalUsado());

    // Cuánto lugar ocupa la app en el celular y cuánto le da el navegador.
    // Si se llena, el navegador deja de guardar las copias nuevas.
    try {
      if (navigator.storage?.estimate) {
        const e = await navigator.storage.estimate();
        setEspacio({ usado: e.usage || 0, cuota: e.quota || 0 });
      }
      // Pedimos que no borre lo guardado por su cuenta cuando le falta lugar
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    } catch (e) {}

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
    window.addEventListener(EVENTO_COLA, revisar);
    return () => window.removeEventListener(EVENTO_COLA, revisar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <p>
          {pedidosGuardados > 0 ? "✓" : "✗"} {pedidosGuardados} pedidos guardados
          {fechaPedidos &&
            ` · ${fechaPedidos.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
        </p>
        {espacio && espacio.cuota > 0 && (
          <p className={espacio.usado / espacio.cuota > 0.85 ? "text-red-700 font-bold" : ""}>
            💾 Espacio usado: {mb(espacio.usado)} MB de {mb(espacio.cuota)} MB
            {espacio.usado / espacio.cuota > 0.85 ? " · casi lleno" : ""}
          </p>
        )}
        <p className={localUsado > 4500000 ? "text-red-700 font-bold" : ""}>
          🗂️ Datos de trabajo: {Math.min(100, Math.round((localUsado / 5000000) * 100))}% del lugar disponible
        </p>
        {pendientes > 0 && (
          <p className="text-amber-800 font-bold">
            📤 {pendientes} cosa(s) hecha(s) sin señal esperando enviarse (se mandan solas)
          </p>
        )}
      </div>

      {/* Lo que el servidor no aceptó: no se borra solo, decidís vos */}
      {problemas.length > 0 && (
        <div className="mt-2 bg-white border-2 border-red-300 rounded-xl p-2.5 space-y-2" role="alert">
          <p className="text-xs font-bold text-red-800">
            ⚠️ {problemas.length} cosa(s) hecha(s) sin señal que el servidor no aceptó
          </p>
          {problemas.map((r) => (
            <div key={r.clave} className="border-t border-red-100 pt-2">
              <p className="text-[11px] font-semibold text-gray-800">
                {NOMBRE_TIPO[r.tipo] || r.tipo} · {resumenAccion(r)} ·{" "}
                {new Date(r.creada_en).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-[11px] text-red-700">{r.problema}</p>
              <div className="flex gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    reintentar(r.clave);
                    await enviarCola();
                    revisar();
                  }}
                  className="flex-1 text-[11px] font-bold border border-gray-300 rounded-lg py-1.5"
                >
                  Reintentar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("¿Descartar esto? No se va a enviar nunca.")) {
                      descartar(r.clave);
                      revisar();
                    }
                  }}
                  className="flex-1 text-[11px] font-bold border border-red-300 text-red-700 rounded-lg py-1.5"
                >
                  Descartar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
