"use client";

import { useEffect, useRef, useState } from "react";
import {
  guardarEstado,
  leerEstado,
  limpiarEstado,
  vieneDeUnProducto,
  marcarSalidaAProducto,
  restaurarScroll
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

    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => window.removeEventListener("scroll", alScrollear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, pantalla, JSON.stringify(extras)]);

  // Se llama al tocar un enlace que saca al usuario de la lista
  function alSalir() {
    guardarEstado(pantalla, { ...extras, scroll: window.scrollY });
    marcarSalidaAProducto(pantalla);
  }

  // Se llama cuando la lista ya tiene contenido dibujado
  function listaLista(cantidad) {
    if (yaRestaure.current || !cantidad) return;
    const y = posicionGuardada.current?.scroll;
    if (y) {
      yaRestaure.current = true;
      restaurarScroll(y);
    }
  }

  return {
    listo,
    alSalir,
    listaLista,
    estadoPrevio: posicionGuardada.current
  };
}
