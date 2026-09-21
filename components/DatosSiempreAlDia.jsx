"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sincronizarCambios } from "@/lib/descargaOffline";
import { EVENTO_ESTADO, pedirActualizacion } from "@/lib/datosFrescos";

// Va dentro del panel admin (AdminGuard). Hace dos cosas:
//
// 1) Dispara la actualización de datos en todos los momentos en que pueden
//    haber quedado viejos: al volver la señal, al pasar a wifi, al volver a
//    la app, cuando la base avisa que algo cambió, y cada un minuto.
//    También actualiza la copia guardada en el celular (para usar sin señal).
//
// 2) Muestra un renglón chico con el estado, fijo arriba de todas las
//    pantallas del panel (va dentro de la barra de app/admin/layout.js): si los datos están al día
//    o si estás viendo la copia guardada porque no hay señal.

// Revisión "por las dudas" (los cambios de la base ya llegan en vivo):
// cada 1 minuto con wifi, cada 5 minutos con datos móviles para no gastarlos.
const SEGUNDOS_CON_WIFI = 60;
const SEGUNDOS_CON_DATOS = 300;

function conWifi() {
  const con = typeof navigator !== "undefined" ? navigator.connection : null;
  // Si el celular no informa el tipo de conexión, lo tratamos como wifi
  if (!con || !con.type) return true;
  return con.type === "wifi" || con.type === "ethernet";
}

function hace(fecha) {
  if (!fecha) return "";
  const seg = Math.round((Date.now() - fecha) / 1000);
  if (seg < 10) return "recién";
  if (seg < 60) return `hace ${seg} s`;
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  return new Date(fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export default function DatosSiempreAlDia() {
  const [online, setOnline] = useState(true);
  const [ultima, setUltima] = useState(Date.now());
  const [desdeCopia, setDesdeCopia] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [, forzarRender] = useState(0);
  const demora = useRef(null);

  async function actualizarTodo(motivo) {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setActualizando(true);
    // Las pantallas abiertas recargan sus datos
    pedirActualizacion(motivo);
    // Y la copia del celular (sirve para trabajar sin señal). Si responde
    // bien, los datos están al día aunque la pantalla no tenga nada que
    // recargar (por ejemplo en la tienda).
    try {
      const res = await sincronizarCambios();
      if (!res?.error) {
        setUltima(Date.now());
        setDesdeCopia(false);
      }
    } catch (e) {}
    setTimeout(() => setActualizando(false), 600);
  }

  // Varios avisos juntos (por ejemplo al guardar un pedido cambian el
  // pedido, sus productos y el stock) se juntan en una sola actualización.
  function actualizarEnUnRato(motivo) {
    clearTimeout(demora.current);
    demora.current = setTimeout(() => actualizarTodo(motivo), 800);
  }

  // Señal, wifi y volver a la app
  useEffect(() => {
    setOnline(navigator.onLine);

    function alVolverSenal() {
      setOnline(true);
      actualizarTodo("volvio-la-senal");
    }
    function alPerderSenal() {
      setOnline(false);
    }
    function alVolverALaApp() {
      if (document.visibilityState === "visible") actualizarTodo("volvio-a-la-app");
    }
    function alCambiarConexion() {
      const con = navigator.connection;
      if (navigator.onLine && con && (con.type === "wifi" || con.type === "ethernet")) {
        actualizarTodo("conectado-a-wifi");
      }
    }

    window.addEventListener("online", alVolverSenal);
    window.addEventListener("offline", alPerderSenal);
    document.addEventListener("visibilitychange", alVolverALaApp);
    navigator.connection?.addEventListener?.("change", alCambiarConexion);

    return () => {
      window.removeEventListener("online", alVolverSenal);
      window.removeEventListener("offline", alPerderSenal);
      document.removeEventListener("visibilitychange", alVolverALaApp);
      navigator.connection?.removeEventListener?.("change", alCambiarConexion);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revisión periódica mientras la pantalla está a la vista
  const ultimaRevision = useRef(Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      forzarRender((n) => n + 1); // refresca el "hace X min"
      if (document.visibilityState !== "visible") return;
      const cada = (conWifi() ? SEGUNDOS_CON_WIFI : SEGUNDOS_CON_DATOS) * 1000;
      if (Date.now() - ultimaRevision.current >= cada) {
        ultimaRevision.current = Date.now();
        actualizarTodo("revision-periodica");
      }
    }, 20 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambios en vivo desde la base: stock, pedidos y clientes
  useEffect(() => {
    const canal = supabase
      .channel("admin-datos-en-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "Productos" }, () =>
        actualizarEnUnRato("cambio-productos")
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () =>
        actualizarEnUnRato("cambio-pedidos")
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "items_pedido" }, () =>
        actualizarEnUnRato("cambio-items")
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () =>
        actualizarEnUnRato("cambio-clientes")
      )
      .subscribe((estado) => {
        // Al reconectarse el canal (después de un corte) puede haberse
        // perdido algún cambio: se actualiza todo por las dudas.
        if (estado === "SUBSCRIBED") actualizarEnUnRato("reconectado");
      });

    return () => {
      clearTimeout(demora.current);
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Estado que informan las pantallas y el service worker
  useEffect(() => {
    function alEstado(e) {
      if (e.detail?.ok) {
        setUltima(e.detail.fecha || Date.now());
        setDesdeCopia(false);
      }
    }
    function alMensajeSW(e) {
      if (e.data?.tipo === "datos-desde-copia") setDesdeCopia(true);
    }
    window.addEventListener(EVENTO_ESTADO, alEstado);
    navigator.serviceWorker?.addEventListener?.("message", alMensajeSW);
    return () => {
      window.removeEventListener(EVENTO_ESTADO, alEstado);
      navigator.serviceWorker?.removeEventListener?.("message", alMensajeSW);
    };
  }, []);

  const problema = !online || desdeCopia;

  return (
    <div
      className={`w-full flex justify-center border-b ${
        problema ? "bg-orange-100 border-orange-200" : "bg-gray-50 border-gray-100"
      }`}
    >
      <button
        onClick={() => actualizarTodo("manual")}
        className={`w-full py-1 text-[11px] font-semibold ${
          problema ? "text-orange-800" : "text-gray-500"
        }`}
      >
        {!online ? (
          <>🟠 Sin señal · datos guardados</>
        ) : desdeCopia ? (
          <>🟠 Señal débil · tocá para actualizar</>
        ) : (
          <>
            {actualizando ? "🔄 Actualizando..." : `🟢 Al día · ${hace(ultima)}`}
          </>
        )}
      </button>
    </div>
  );
}
