"use client";

import { useEffect, useState } from "react";
import { aplicarTema, elegirTema, temaGuardado, temaEfectivo } from "@/lib/tema";

// Dos formas de elegir el tema:
//  - "boton": un botoncito ☀️/🌙 para el encabezado, alterna claro/oscuro.
//  - "completo": las tres opciones (Claro, Oscuro, Automático), para la
//    pantalla de Cuenta y el panel.
export default function SelectorTema({ variante = "boton" }) {
  const [tema, setTema] = useState("claro");
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const guardado = temaGuardado();
    setTema(guardado);
    setListo(true);
    // Sincroniza la barra de estado del celular (la etiqueta la pone Next.js
    // y puede cargarse después del script inicial)
    aplicarTema(guardado);

    // Si eligió "Automático", seguimos los cambios del celular en vivo
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiarSistema = () => {
      if (temaGuardado() === "sistema") aplicarTema("sistema", { animar: true });
    };
    const alCambiarTema = (e) => setTema(e.detail);

    media.addEventListener?.("change", alCambiarSistema);
    window.addEventListener("tema-cambiado", alCambiarTema);
    return () => {
      media.removeEventListener?.("change", alCambiarSistema);
      window.removeEventListener("tema-cambiado", alCambiarTema);
    };
  }, []);

  function elegir(t) {
    setTema(t);
    elegirTema(t);
  }

  // Evitamos mostrar un ícono equivocado durante el primer instante
  if (!listo) return variante === "boton" ? <span className="w-9 h-9" /> : null;

  if (variante === "boton") {
    const oscuro = temaEfectivo(tema) === "oscuro";
    return (
      <button
        type="button"
        onClick={() => elegir(oscuro ? "claro" : "oscuro")}
        aria-label={oscuro ? "Pasar a modo claro" : "Pasar a modo oscuro"}
        title={oscuro ? "Modo claro" : "Modo oscuro"}
        className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100 text-lg"
      >
        {oscuro ? "☀️" : "🌙"}
      </button>
    );
  }

  const opciones = [
    { id: "claro", icono: "☀️", texto: "Claro" },
    { id: "oscuro", icono: "🌙", texto: "Oscuro" },
    { id: "sistema", icono: "📱", texto: "Automático" }
  ];

  return (
    <div>
      <p className="text-sm font-bold text-gray-800 mb-1">Apariencia</p>
      <p className="text-xs text-gray-500 mb-2">
        El modo oscuro cansa menos la vista de noche y gasta menos batería.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => elegir(o.id)}
            className={`rounded-xl py-2.5 text-xs font-bold border-2 ${
              tema === o.id
                ? "border-brand-blue bg-blue-50 text-brand-blue"
                : "border-gray-200 bg-white text-gray-600"
            }`}
          >
            <span className="block text-lg">{o.icono}</span>
            {o.texto}
          </button>
        ))}
      </div>
      {tema === "sistema" && (
        <p className="text-[11px] text-gray-500 mt-1.5">
          Sigue la configuración de tu celular: claro de día, oscuro si lo tenés así.
        </p>
      )}
    </div>
  );
}
