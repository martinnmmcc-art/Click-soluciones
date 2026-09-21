"use client";

// Mantiene los datos del panel admin SIEMPRE al día, sin tener que recargar.
//
// Cualquier pantalla que use useActualizarSolo(cargar) vuelve a pedir sus
// datos a Supabase cuando:
//   - Vuelve la señal (o el celular se conecta a wifi).
//   - Volvés a la app después de tenerla en segundo plano.
//   - Cambia algo en la base (stock, pedidos, clientes): llega en vivo.
//   - Pasa un minuto con la pantalla abierta, por las dudas.
//   - Tocás "Actualizar" en el aviso de abajo.
//
// Todos esos disparadores terminan en el mismo evento del navegador:
// "bolson:actualizar". Así cada pantalla solo tiene que escucharlo.

import { useEffect, useRef } from "react";

export const EVENTO_ACTUALIZAR = "bolson:actualizar";
export const EVENTO_ESTADO = "bolson:estado-datos";

// Pide a todas las pantallas abiertas que recarguen sus datos
export function pedirActualizacion(motivo = "manual") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_ACTUALIZAR, { detail: { motivo } }));
}

// Avisa al indicador de abajo cómo quedaron los datos
export function avisarEstadoDatos(estado) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_ESTADO, { detail: estado }));
}

// Hook para las pantallas: `cargar` es la función que trae los datos.
// No se ejecuta al montar (eso lo hace cada pantalla como siempre); solo
// cuando llega un pedido de actualización. Evita pedidos repetidos si
// llegan varios avisos juntos.
export function useActualizarSolo(cargar, { minimoSegundos = 3 } = {}) {
  const ref = useRef(cargar);
  ref.current = cargar;
  const ultima = useRef(0);
  const enCurso = useRef(false);

  useEffect(() => {
    async function alPedido() {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (enCurso.current) return;
      if (Date.now() - ultima.current < minimoSegundos * 1000) return;

      enCurso.current = true;
      ultima.current = Date.now();
      try {
        await ref.current?.();
        avisarEstadoDatos({ ok: true, fecha: Date.now() });
      } catch (e) {
        avisarEstadoDatos({ ok: false, fecha: Date.now() });
      } finally {
        enCurso.current = false;
      }
    }

    window.addEventListener(EVENTO_ACTUALIZAR, alPedido);
    return () => window.removeEventListener(EVENTO_ACTUALIZAR, alPedido);
  }, [minimoSegundos]);
}
