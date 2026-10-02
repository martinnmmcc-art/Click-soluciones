"use client";

import { useEffect, useState } from "react";
import { prepararSinSenal, estadoSinSenal, haceCuanto } from "@/lib/prepararSinSenal";

// Botón en la barra fija de arriba del panel: visible en TODAS las
// pantallas del panel, para preparar la app antes de salir a una zona sin
// señal con un solo toque.
export default function BotonSinSenal() {
  const [estado, setEstado] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [paso, setPaso] = useState("");
  const [resultado, setResultado] = useState("");

  function refrescar() {
    setEstado(estadoSinSenal());
  }

  useEffect(() => {
    refrescar();
    window.addEventListener("sin-senal-actualizado", refrescar);
    // El "hace X min" se actualiza solo
    const t = setInterval(refrescar, 60000);
    return () => {
      window.removeEventListener("sin-senal-actualizado", refrescar);
      clearInterval(t);
    };
  }, []);

  async function preparar() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setResultado("Ahora no hay señal. Preparalo cuando tengas wifi o datos.");
      return;
    }
    setTrabajando(true);
    setResultado("");
    try {
      const r = await prepararSinSenal(setPaso);
      setResultado(
        `✓ Listo para trabajar sin señal: ${r.productos} productos, ${r.clientes} clientes, ` +
          `${r.pedidos} pedidos y ${r.pantallas} pantallas.` +
          (r.errores.length ? ` No se pudo: ${r.errores.join(", ")}.` : "")
      );
      setTimeout(() => setResultado(""), 8000);
    } catch (e) {
      setResultado("No se pudo preparar: " + e.message);
    } finally {
      setTrabajando(false);
      setPaso("");
      refrescar();
    }
  }

  if (!estado) return null;

  return (
    <>
      <button
        onClick={preparar}
        disabled={trabajando}
        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border-2 disabled:opacity-80 ${
          estado.alDia
            ? "bg-green-50 border-green-300 text-green-800"
            : "bg-amber-50 border-amber-400 text-amber-900"
        }`}
      >
        <span>📴</span>
        <span className="text-left leading-tight">
          {trabajando ? (
            "Guardando..."
          ) : (
            <>
              {estado.alDia ? "Listo sin señal" : "Preparar sin señal"}
              <span className="block text-[10px] font-semibold opacity-80">
                {estado.fecha ? haceCuanto(estado.fecha) : "tocá antes de salir"}
              </span>
            </>
          )}
        </span>
      </button>

      {(paso || resultado) && (
        <div className="basis-full">
          <p
            className={`text-[11px] font-semibold rounded-lg px-2.5 py-1.5 mt-1.5 ${
              resultado.startsWith("✓")
                ? "bg-green-50 text-green-800"
                : resultado
                ? "bg-amber-50 text-amber-900"
                : "bg-blue-50 text-brand-blue"
            }`}
          >
            {resultado || paso}
          </p>
        </div>
      )}
    </>
  );
}
