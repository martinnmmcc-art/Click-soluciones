"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// Las rutas del panel ahora exigen la sesión del administrador (ver
// middleware.js). En vez de modificar cada pantalla que las usa, este
// componente hace que la app agregue la sesión sola a todo pedido que vaya
// a una ruta protegida. Así funciona igual en las pantallas actuales, en
// las que se sumen, y en la sincronización sin señal de la caja.
//
// Para los clientes no cambia nada: no tienen sesión de administrador y
// nunca llaman a estas rutas.

const RUTAS_PROTEGIDAS = [
  "/api/admin/",
  "/api/avisar-cupon",
  "/api/avisar-push",
  "/api/avisar-cliente",
  "/api/avisos-stock/notificar",
  "/api/push/enviar",
  "/api/resolver-video",
  "/api/verificacion/"
];

function esProtegida(url) {
  try {
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) return false;
    return RUTAS_PROTEGIDAS.some((r) => u.pathname.startsWith(r));
  } catch (e) {
    return false;
  }
}

// Se instala en el momento en que se carga este archivo, NO dentro de un
// efecto de React: React ejecuta los efectos de las pantallas (hijas) antes
// que los del layout (padre), y las pantallas del panel piden sus datos
// justo al abrirse. Si esperáramos a un efecto, ese primer pedido saldría
// sin la sesión y el panel mostraría un error al entrar.
function instalar() {
  if (typeof window === "undefined" || window.__fetchConSesion) return;
  window.__fetchConSesion = true;

  const fetchOriginal = window.fetch.bind(window);

  window.fetch = async (recurso, opciones = {}) => {
    const url = typeof recurso === "string" ? recurso : recurso?.url;

    if (url && esProtegida(url)) {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;

        if (token) {
          const cabeceras = new Headers(
            opciones.headers || (typeof recurso !== "string" ? recurso.headers : undefined)
          );
          // Si la pantalla ya mandó su propia sesión, la respetamos
          if (!cabeceras.has("Authorization")) {
            cabeceras.set("Authorization", `Bearer ${token}`);
          }
          return fetchOriginal(recurso, { ...opciones, headers: cabeceras });
        }
      } catch (e) {
        // Si falla leer la sesión, el pedido sigue y el servidor decide
      }
    }

    return fetchOriginal(recurso, opciones);
  };
}

instalar();

export default function SesionEnPedidos() {
  // Por si el archivo se cargó antes de que existiera window (no debería)
  useEffect(() => {
    instalar();
  }, []);

  return null;
}
