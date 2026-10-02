"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  actualizarDatos,
  precargarPantallas,
  minutosDesde,
  CLAVES
} from "@/lib/prepararSinSenal";

// Mantiene la app lista para trabajar sin señal, SOLA, sin tocar nada.
// Va montado en el panel (solo para administradores).
//
//  - Datos (caja, clientes, pedidos): al abrir, cada 15 minutos y apenas
//    vuelve la señal.
//  - Recorrida por todas las pantallas: cada 6 horas y con cada versión
//    nueva de la app. Solo con buena conexión (cuida los datos móviles).

const CADA_DATOS_MIN = 15;
const CADA_PANTALLAS_MIN = 6 * 60;

// Un solo trabajo a la vez, aunque se monte en varias pantallas
let ocupado = false;
let cancelarRecorrida = false;

function estado(trabajando, paso = "") {
  window.dispatchEvent(new CustomEvent("sin-senal-estado", { detail: { trabajando, paso } }));
}

// La recorrida es más pesada: no con "ahorro de datos" ni con señal muy débil
function conexionBuena() {
  const c = navigator.connection;
  if (!c) return true;
  if (c.saveData) return false;
  return !["slow-2g", "2g"].includes(c.effectiveType);
}

async function ciclo({ forzarPantallas = false, forzarTodo = false } = {}) {
  if (ocupado || !navigator.onLine) return;
  ocupado = true;
  cancelarRecorrida = false;
  try {
    if (forzarTodo || minutosDesde(CLAVES.datos) >= CADA_DATOS_MIN) {
      estado(true, "Actualizando datos...");
      await actualizarDatos((p) => estado(true, p));
    }
    const tocaRecorrer =
      forzarTodo || forzarPantallas || minutosDesde(CLAVES.pantallas) >= CADA_PANTALLAS_MIN;
    if (tocaRecorrer && conexionBuena()) {
      await precargarPantallas((p) => estado(true, p), { cancelado: () => cancelarRecorrida });
    }
  } catch (e) {
  } finally {
    ocupado = false;
    estado(false);
  }
}

export default function AutoSinSenal() {
  useEffect(() => {
    // Dentro de la ventana invisible de la recorrida no hace nada (si no,
    // cada pantalla visitada empezaría otra recorrida).
    if (window.self !== window.top) return;

    // Al abrir: esperamos a que cargue lo que estás mirando
    const arranque = setTimeout(() => ciclo(), 8000);

    // Cada 15 minutos, si la app está a la vista
    const periodico = setInterval(() => {
      if (document.visibilityState === "visible") ciclo();
    }, CADA_DATOS_MIN * 60 * 1000);

    // Volvió la señal: actualizamos enseguida
    const alVolverSenal = () => setTimeout(() => ciclo(), 3000);
    // Se cortó: frenamos la recorrida
    const alPerderSenal = () => {
      cancelarRecorrida = true;
    };
    // Volviste a la app después de un rato
    const alVolverALaApp = () => {
      if (document.visibilityState === "visible") ciclo();
    };
    // Versión nueva de la app: hay que volver a guardar las pantallas
    const alActualizarseLaApp = () => setTimeout(() => ciclo({ forzarPantallas: true }), 10000);

    window.addEventListener("online", alVolverSenal);
    window.addEventListener("offline", alPerderSenal);
    document.addEventListener("visibilitychange", alVolverALaApp);
    navigator.serviceWorker?.addEventListener("controllerchange", alActualizarseLaApp);

    // Al cerrar sesión, se borran del celular los datos guardados del panel
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") {
        navigator.serviceWorker?.controller?.postMessage({ tipo: "limpiar-datos" });
      }
    });

    // El botón de la barra puede pedir hacerlo ya
    const alPedirAhora = () => ciclo({ forzarTodo: true });
    window.addEventListener("sin-senal-forzar", alPedirAhora);

    return () => {
      clearTimeout(arranque);
      clearInterval(periodico);
      window.removeEventListener("online", alVolverSenal);
      window.removeEventListener("offline", alPerderSenal);
      document.removeEventListener("visibilitychange", alVolverALaApp);
      navigator.serviceWorker?.removeEventListener("controllerchange", alActualizarseLaApp);
      window.removeEventListener("sin-senal-forzar", alPedirAhora);
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return null;
}
