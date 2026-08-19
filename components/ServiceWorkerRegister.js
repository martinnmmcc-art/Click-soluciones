"use client";

import { useEffect, useState } from "react";

export default function ServiceWorkerRegister() {
  const [hayActualizacion, setHayActualizacion] = useState(false);
  const [registro, setRegistro] = useState(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reg;

    navigator.serviceWorker
      .register("/sw.js")
      .then((r) => {
        reg = r;
        setRegistro(r);

        // Si aparece una versión nueva de la app, avisamos en vez de
        // actualizar de golpe (podría estar armando un pedido).
        r.addEventListener("updatefound", () => {
          const nuevo = r.installing;
          if (!nuevo) return;
          nuevo.addEventListener("statechange", () => {
            if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
              setHayActualizacion(true);
            }
          });
        });
      })
      .catch((err) => console.warn("Error registrando el service worker", err));

    // Buscamos actualizaciones cada vez que se vuelve a la app
    function alVolverAlFrente() {
      if (document.visibilityState === "visible" && reg) reg.update();
    }
    document.addEventListener("visibilitychange", alVolverAlFrente);

    // Cuando el nuevo service worker toma el control, recargamos una sola vez
    let recargando = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recargando) return;
      recargando = true;
      window.location.reload();
    });

    return () => document.removeEventListener("visibilitychange", alVolverAlFrente);
  }, []);

  function actualizarAhora() {
    if (registro?.waiting) {
      registro.waiting.postMessage("actualizar");
    } else {
      window.location.reload();
    }
  }

  if (!hayActualizacion) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[60] bg-brand-blue text-white rounded-xl p-3 shadow-lg flex items-center justify-between gap-3">
      <span className="text-xs font-medium">Hay una versión nueva de la app</span>
      <button
        onClick={actualizarAhora}
        className="bg-white text-brand-blue text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
      >
        Actualizar
      </button>
    </div>
  );
}
