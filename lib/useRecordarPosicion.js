"use client";

import { useEffect, useRef, useState } from "react";
import {
  guardarEstado,
  leerEstado,
  limpiarEstado,
  vieneDeUnProducto,
  marcarSalidaAProducto,
  restaurarScroll,
  limpiarBanderaRestauracion
} from "@/lib/estadoNavegacion";

// Recuerda dónde estaba el usuario en una lista cuando se va a otra pantalla
// (editar un producto, ver un detalle) y lo devuelve al mismo lugar al volver.
//
// Uso:
//   const { alSalir, listaLista } = useRecordarPosicion("admin-productos");
//   ...
//   <Link onClick={alSalir}>Editar</Link>     // marca desde dónde se fue
//   listaLista(productos.length)              // avisar cuando ya se dibujó
//
export function useRecordarPosicion(pantalla, extras = {}) {
  const [listo, setListo] = useState(false);
  const posicionGuardada = useRef(null);
  const yaRestaure = useRef(false);

  useEffect(() => {
    if (typeof history !== "undefined" && "scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    // Si una restauración anterior quedó a medias, la bandera podría estar
    // trabada y bloquearía el guardado. La limpiamos al entrar.
    limpiarBanderaRestauracion();

    // Solo recuperamos la posición si venimos de salir desde acá.
    // Si entró por el menú, corresponde arrancar arriba de todo.
    if (!vieneDeUnProducto(pantalla)) {
      limpiarEstado(pantalla);
      posicionGuardada.current = null;
      setListo(true);
      return;
    }

    posicionGuardada.current = leerEstado(pantalla);
    setListo(true);
  }, [pantalla]);

  // Guarda la posición mientras el usuario se mueve por la lista
  useEffect(() => {
    if (!listo) return;

    function alScrollear() {
      if (window.__bolsonRestaurando) return;
      guardarEstado(pantalla, { ...extras, scroll: window.scrollY });
    }

    // Además del scroll, guardamos justo antes de que la pantalla desaparezca.
    // Si el usuario navega con el botón del celular en vez de tocar un enlace,
    // este es el último momento en que podemos registrar dónde estaba.
    function guardarAhora() {
      guardarEstado(pantalla, { ...extras, scroll: window.scrollY });
    }

    window.addEventListener("scroll", alScrollear, { passive: true });
    window.addEventListener("pagehide", guardarAhora);
    document.addEventListener("visibilitychange", guardarAhora);

    return () => {
      window.removeEventListener("scroll", alScrollear);
      window.removeEventListener("pagehide", guardarAhora);
      document.removeEventListener("visibilitychange", guardarAhora);
      guardarAhora();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, pantalla, JSON.stringify(extras)]);

  // Se llama al tocar un enlace que saca al usuario de la lista
  function alSalir() {
    guardarEstado(pantalla, { ...extras, scroll: window.scrollY });
    marcarSalidaAProducto(pantalla);
  }

  return {
    listo,
    alSalir,
    estadoPrevio: posicionGuardada.current,
    posicionGuardada,
    yaRestaure
  };
}

// Devuelve al usuario a su posición una vez que la lista ya está dibujada.
// Tiene que ser un efecto que dependa de la cantidad de elementos: si se
// llama apenas llegan los datos, React todavía no dibujó nada, la página
// no tiene altura y el salto no tiene a dónde ir.
export function useRestaurarAlDibujar(hook, cantidad) {
  useEffect(() => {
    if (!hook?.listo || hook.yaRestaure.current) return;
    if (!cantidad) return;

    const y = hook.posicionGuardada.current?.scroll;
    if (!y) return;

    hook.yaRestaure.current = true;
    restaurarScroll(y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantidad, hook?.listo]);
}
