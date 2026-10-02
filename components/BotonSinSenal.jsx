"use client";

import { useEffect, useState } from "react";
import { estadoSinSenal, haceCuanto } from "@/lib/prepararSinSenal";

// Indicador en la barra fija del panel. La app se prepara SOLA para
// trabajar sin señal (ver AutoSinSenal): esto solo muestra cómo está.
// Tocarlo es opcional, para forzar una actualización completa ya.
export default function BotonSinSenal() {
  const [estado, setEstado] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [paso, setPaso] = useState("");
  const [enLinea, setEnLinea] = useState(true);

  useEffect(() => {
    const refrescar = () => setEstado(estadoSinSenal());
    const alCambiarEstado = (e) => {
      setTrabajando(!!e.detail?.trabajando);
      setPaso(e.detail?.paso || "");
      if (!e.detail?.trabajando) refrescar();
    };
    const alCambiarConexion = () => setEnLinea(navigator.onLine);

    refrescar();
    alCambiarConexion();
    window.addEventListener("sin-senal-actualizado", refrescar);
    window.addEventListener("sin-senal-estado", alCambiarEstado);
    window.addEventListener("online", alCambiarConexion);
    window.addEventListener("offline", alCambiarConexion);
    const t = setInterval(refrescar, 60000);
    return () => {
      window.removeEventListener("sin-senal-actualizado", refrescar);
      window.removeEventListener("sin-senal-estado", alCambiarEstado);
      window.removeEventListener("online", alCambiarConexion);
      window.removeEventListener("offline", alCambiarConexion);
      clearInterval(t);
    };
  }, []);

  if (!estado) return null;

  const cuando = haceCuanto(estado.fecha);

  // Sin señal: se está trabajando con lo guardado
  if (!enLinea) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border-2 bg-blue-50 border-blue-300 text-brand-blue">
        📴
        <span className="leading-tight">
          Sin señal
          <span className="block text-[10px] font-semibold opacity-80">datos de {cuando}</span>
        </span>
      </span>
    );
  }

  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("sin-senal-forzar"))}
      disabled={trabajando}
      title="Se actualiza solo. Tocá para forzarlo ahora."
      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border-2 ${
        trabajando
          ? "bg-blue-50 border-blue-300 text-brand-blue"
          : estado.alDia
          ? "bg-green-50 border-green-300 text-green-800"
          : "bg-amber-50 border-amber-400 text-amber-900"
      }`}
    >
      <span className={trabajando ? "animate-spin" : ""}>{trabajando ? "🔄" : "📴"}</span>
      <span className="text-left leading-tight">
        {trabajando ? "Guardando para sin señal" : estado.alDia ? "Listo sin señal" : "Preparando sin señal"}
        <span className="block text-[10px] font-semibold opacity-80">
          {trabajando ? paso.replace("Guardando ", "").replace("...", "") || "un momento" : `actualizado ${cuando}`}
        </span>
      </span>
    </button>
  );
}
