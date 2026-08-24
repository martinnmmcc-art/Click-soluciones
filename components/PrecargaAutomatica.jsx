"use client";

import { useEffect } from "react";
import { descargarTodoOffline, fechaDescargaOffline, sincronizarCambios } from "@/lib/descargaOffline";

// Guarda automáticamente los productos y sus fotos en el celular, sin que
// nadie tenga que apretar nada. Un botón de "descargar" no lo usa casi nadie,
// y en la Comarca la señal se corta seguido: la app tiene que estar lista
// antes de que haga falta.
//
// Reglas para no gastar los datos del cliente:
//  - Solo con wifi o buena señal, nunca con ahorro de datos activado.
//  - Una vez por día como máximo.
//  - Espera unos segundos después de abrir, para no competir con la carga
//    de la pantalla que el cliente está mirando.
//  - Si falla, no molesta: se reintenta la próxima vez.

const HORAS_ENTRE_DESCARGAS = 20;
const SEGUNDOS_DE_ESPERA = 8;

function conexionBuena() {
  try {
    if (typeof navigator === "undefined" || !navigator.onLine) return false;

    const con = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    // Sin datos de la conexión no arriesgamos: puede ser una red medida
    if (!con) return false;

    // Respetamos el ahorro de datos del celular
    if (con.saveData) return false;

    // Wifi siempre, o 4g que en general es plano
    if (con.type === "wifi" || con.type === "ethernet") return true;
    return con.effectiveType === "4g";
  } catch (e) {
    return false;
  }
}

function tocaDescargar() {
  const ultima = fechaDescargaOffline();
  if (!ultima) return true;
  const horas = (Date.now() - ultima.getTime()) / (1000 * 60 * 60);
  return horas >= HORAS_ENTRE_DESCARGAS;
}

export default function PrecargaAutomatica({ telefono = null, alSincronizar = null }) {
  // Pedimos permiso para que la app se actualice sola aunque esté cerrada.
  // Solo Android lo permite (y con la app instalada); en iPhone se ignora
  // sin dar error, y todo sigue funcionando al abrir la app.
  useEffect(() => {
    async function pedirActualizacionEnSegundoPlano() {
      try {
        if (!("serviceWorker" in navigator)) return;
        const reg = await navigator.serviceWorker.ready;

        // Actualización periódica (el navegador elige el momento, en general
        // con wifi y el celular cargando)
        if ("periodicSync" in reg) {
          const permiso = await navigator.permissions.query({
            name: "periodic-background-sync"
          });
          if (permiso.state === "granted") {
            await reg.periodicSync.register("actualizar-catalogo", {
              minInterval: 12 * 60 * 60 * 1000 // como mucho, dos veces al día
            });
          }
        }

        // Y una sincronización apenas vuelva la señal, aunque esté cerrada
        if ("sync" in reg) {
          await reg.sync.register("sincronizar-al-volver");
        }
      } catch (e) {
        // Si el celular no lo soporta seguimos igual: la app se actualiza
        // al abrirse, que es el comportamiento de siempre.
      }
    }

    pedirActualizacionEnSegundoPlano();
  }, []);

  // Cuando vuelve la señal, actualizamos lo que cambió mientras no había:
  // precios nuevos, productos que llegaron, cosas que se agotaron.
  useEffect(() => {
    async function alVolverLaSeñal() {
      try {
        const res = await sincronizarCambios();
        if (res?.cambios > 0 && alSincronizar) alSincronizar(res);
      } catch (e) {
        // En silencio: se reintenta la próxima vez
      }
    }

    window.addEventListener("online", alVolverLaSeñal);

    // También al abrir la app: puede haber cambiado algo desde la última vez
    if (typeof navigator !== "undefined" && navigator.onLine) {
      const t = setTimeout(alVolverLaSeñal, 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("online", alVolverLaSeñal);
      };
    }

    return () => window.removeEventListener("online", alVolverLaSeñal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!conexionBuena() || !tocaDescargar()) return;

    let cancelado = false;

    const temporizador = setTimeout(async () => {
      if (cancelado) return;

      try {
        // Solo los productos propios: son los que se entregan al momento
        // y los que más se consultan. Los "a pedido" quedan para la
        // descarga manual, porque son miles y llenarían el celular.
        await descargarTodoOffline({
          soloPropios: true,
          incluirFotos: true,
          telefono
        });
      } catch (e) {
        // En silencio: es una mejora, no algo que el cliente pidió.
        // Si falla, se reintenta la próxima vez que abra la app.
      }
    }, SEGUNDOS_DE_ESPERA * 1000);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [telefono]);

  return null;
}
