"use client";

import { useEffect } from "react";
import { aceptaMedicion } from "@/lib/consentimiento";

// Recuerda por qué canal llegó el cliente, para poder medir después si la
// venta vino de WhatsApp, de Facebook o de que entró directo.
//
// Se guarda al llegar y se usa recién al comprar: entre una cosa y la otra
// pueden pasar días, así que no alcanza con mirarlo en el momento.

const CLAVE = "bolsonclick_origen";
const DIAS_VALIDO = 7;

const MAPA = {
  wa: "whatsapp",
  fb: "facebook",
  ig: "instagram",
  promo: "catalogo"
};

export default function RegistrarOrigen() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const de = params.get("de");
      if (!de) return;

      const origen = MAPA[de] || de;

      const valor = JSON.stringify({ origen, fecha: new Date().toISOString() });
      // Es medición: se recuerda entre visitas solo si el cliente lo aceptó.
      // Mientras tanto queda en esta pestaña (sirve si compra ahora mismo).
      sessionStorage.setItem(CLAVE, valor);
      if (aceptaMedicion()) localStorage.setItem(CLAVE, valor);
    } catch (e) {}
  }, []);

  return null;
}

// Devuelve de dónde vino el cliente, si la visita es reciente
export function leerOrigen() {
  try {
    const g = (aceptaMedicion() && localStorage.getItem(CLAVE)) || sessionStorage.getItem(CLAVE);
    if (!g) return null;

    const { origen, fecha } = JSON.parse(g);
    const dias = (Date.now() - new Date(fecha).getTime()) / 86400000;

    // Después de una semana ya no es razonable atribuirle la venta
    return dias <= DIAS_VALIDO ? origen : null;
  } catch (e) {
    return null;
  }
}
