"use client";

import { useEffect, useState } from "react";
import {
  leerConsentimiento,
  guardarConsentimiento,
  EVENTO_CONSENTIMIENTO
} from "@/lib/consentimiento";

// Para cambiar la elección del banner de cookies desde la página de cookies
export default function BotonPreferenciasCookies() {
  const [eleccion, setEleccion] = useState(null);

  useEffect(() => {
    setEleccion(leerConsentimiento());
    const alCambiar = (e) => setEleccion(e.detail);
    window.addEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
    return () => window.removeEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
  }, []);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
      <p className="text-sm" role="status">
        Elección actual:{" "}
        <b>
          {eleccion === "todas"
            ? "acepto la medición"
            : eleccion === "necesarias"
            ? "solo necesarias"
            : "todavía no elegiste"}
        </b>
      </p>
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={() => guardarConsentimiento("necesarias")}
          aria-pressed={eleccion === "necesarias"}
          className="flex-1 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-gray-800 font-bold text-sm"
        >
          Solo necesarias
        </button>
        <button
          type="button"
          onClick={() => guardarConsentimiento("todas")}
          aria-pressed={eleccion === "todas"}
          className="flex-1 py-2.5 rounded-xl border-2 border-brand-blue bg-white text-brand-blue font-bold text-sm"
        >
          Aceptar medición
        </button>
      </div>
    </div>
  );
}
