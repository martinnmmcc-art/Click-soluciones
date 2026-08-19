"use client";

import { useEffect, useState } from "react";

export default function OfflinePage() {
  const [volvio, setVolvio] = useState(false);

  useEffect(() => {
    function alVolver() {
      setVolvio(true);
    }
    window.addEventListener("online", alVolver);
    return () => window.removeEventListener("online", alVolver);
  }, []);

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <p className="text-5xl mb-3">📡</p>
        <h1 className="font-extrabold text-xl text-gray-800 mb-2">Estás sin internet</h1>
        <p className="text-sm text-gray-600 mb-5">
          Podés seguir mirando las pantallas que ya visitaste y armar tu carrito.
          Cuando vuelva la señal, se envía todo.
        </p>

        {volvio ? (
          <button
            onClick={() => window.location.reload()}
            className="btn-primary w-full"
          >
            ¡Volvió el internet! Tocá para recargar
          </button>
        ) : (
          <button
            onClick={() => window.location.reload()}
            className="bg-white border border-gray-200 text-gray-700 font-bold text-sm w-full py-3 rounded-xl"
          >
            Reintentar
          </button>
        )}
      </div>
    </main>
  );
}
