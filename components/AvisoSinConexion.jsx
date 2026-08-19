"use client";

import { useEffect, useState } from "react";

// Barra fija que avisa cuando el celular se queda sin señal, así el usuario
// entiende por qué algunas cosas no se actualizan.
export default function AvisoSinConexion() {
  const [sinConexion, setSinConexion] = useState(false);
  const [recuperada, setRecuperada] = useState(false);

  useEffect(() => {
    function offline() {
      setSinConexion(true);
      setRecuperada(false);
    }
    function online() {
      setSinConexion(false);
      setRecuperada(true);
      setTimeout(() => setRecuperada(false), 3000);
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) setSinConexion(true);

    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  if (!sinConexion && !recuperada) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] text-center text-xs font-bold py-2 px-3 ${
        sinConexion ? "bg-gray-800 text-white" : "bg-green-600 text-white"
      }`}
    >
      {sinConexion
        ? "📡 Sin internet — podés seguir navegando lo ya visto"
        : "✓ Volvió la conexión"}
    </div>
  );
}
