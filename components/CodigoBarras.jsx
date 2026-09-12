"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Asocia el código de barras de un producto, escaneándolo con la cámara.
//
// Se hace una sola vez por producto: después alcanza con pasar el código
// por la caja y aparece solo.
export default function CodigoBarras({ productoId, codigoActual, onGuardado }) {
  const [codigo, setCodigo] = useState(codigoActual || "");
  const [escaneando, setEscaneando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const video = useRef(null);

  useEffect(() => {
    if (!escaneando) return;

    let stream = null;
    let seguir = true;

    async function arrancar() {
      if (!("BarcodeDetector" in window)) {
        setMensaje("Este navegador no puede escanear. Escribí el código a mano.");
        setEscaneando(false);
        return;
      }

      try {
        const detector = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code", "itf"]
        });

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });

        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }

        async function buscar() {
          if (!seguir || !video.current) return;
          try {
            const codigos = await detector.detect(video.current);
            if (codigos.length > 0 && codigos[0].rawValue) {
              try { navigator.vibrate?.(60); } catch (e) {}
              setCodigo(codigos[0].rawValue);
              setEscaneando(false);
              return;
            }
          } catch (e) {}
          if (seguir) setTimeout(buscar, 250);
        }
        buscar();
      } catch (e) {
        setMensaje("No se pudo abrir la cámara: " + e.message);
        setEscaneando(false);
      }
    }

    arrancar();
    return () => {
      seguir = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [escaneando]);

  async function guardar() {
    setGuardando(true);
    setMensaje("");

    try {
      const { data, error } = await supabase.rpc("asociar_codigo", {
        p_producto_id: productoId,
        p_codigo: codigo
      });

      const r = data?.[0];

      if (error || !r?.ok) {
        setMensaje(
          r?.motivo === "YA_EN_USO"
            ? `Ese código ya está en "${r.producto_en_uso}"`
            : r?.motivo === "CODIGO_CORTO"
            ? "El código es demasiado corto"
            : "No se pudo guardar"
        );
        return;
      }

      setMensaje("✓ Código guardado");
      onGuardado?.(codigo);
      setTimeout(() => setMensaje(""), 2500);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs font-bold text-gray-700 mb-1">
        Código de barras
        {codigoActual && <span className="text-green-700"> · ya tiene uno</span>}
      </p>
      <p className="text-[10px] text-gray-500 mb-2">
        Escanealo una vez y después el producto aparece solo en la caja.
      </p>

      {escaneando && (
        <div className="fixed inset-0 z-[85] bg-black flex flex-col">
          <div className="flex justify-between items-center p-4">
            <p className="text-white text-sm font-bold">Apuntá al código</p>
            <button onClick={() => setEscaneando(false)} className="text-white text-2xl px-2">
              ×
            </button>
          </div>
          <div className="flex-1 relative">
            <video ref={video} playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-40 border-4 border-white/80 rounded-2xl" />
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2"
          placeholder="7791234567890"
          inputMode="numeric"
        />
        <button
          type="button"
          onClick={() => setEscaneando(true)}
          className="bg-brand-blue text-white text-xs font-bold px-3 rounded-lg"
        >
          📷
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || !codigo.trim()}
          className="bg-green-600 text-white text-xs font-bold px-3 rounded-lg disabled:opacity-40"
        >
          {guardando ? "..." : "Guardar"}
        </button>
      </div>

      {mensaje && <p className="text-[11px] text-gray-700 mt-1.5">{mensaje}</p>}
    </div>
  );
}
