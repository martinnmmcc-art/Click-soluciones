"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EscanerCodigo from "@/components/EscanerCodigo";

// Asocia el código de barras de un producto.
//
// Se hace una sola vez por producto: después alcanza con pasarlo por la
// caja y aparece solo.
export default function CodigoBarras({ productoId, codigoActual, onGuardado }) {
  const [codigo, setCodigo] = useState(codigoActual || "");
  const [escaneando, setEscaneando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(valor) {
    const codigoFinal = (valor || codigo).trim();
    if (!codigoFinal) return;

    setGuardando(true);
    setMensaje("");

    try {
      const { data, error } = await supabase.rpc("asociar_codigo", {
        p_producto_id: productoId,
        p_codigo: codigoFinal
      });

      const r = data?.[0];

      if (error || !r?.ok) {
        setMensaje(
          r?.motivo === "YA_EN_USO"
            ? `⚠️ Ese código ya está en "${r.producto_en_uso}"`
            : r?.motivo === "CODIGO_CORTO"
            ? "⚠️ El código es demasiado corto"
            : "⚠️ No se pudo guardar"
        );
        return;
      }

      setCodigo(codigoFinal);
      setMensaje("✓ Código guardado. Ya podés cobrarlo escaneando.");
      onGuardado?.(codigoFinal);
      setTimeout(() => setMensaje(""), 3500);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 mt-3">
      <p className="text-sm font-bold text-gray-800">
        📷 Código de barras
        {codigoActual && <span className="text-green-700 text-xs"> · ya tiene</span>}
      </p>
      <p className="text-[11px] text-gray-600 mt-0.5 mb-2">
        Escanealo una vez y después en la Caja aparece solo.
      </p>

      <EscanerCodigo
        abierto={escaneando}
        onCerrar={() => setEscaneando(false)}
        onLeer={(valor) => {
          setEscaneando(false);
          guardar(valor);
        }}
      />

      <button
        type="button"
        onClick={() => setEscaneando(true)}
        className="w-full bg-brand-blue text-white text-sm font-bold py-3 rounded-xl mb-2"
      >
        📷 Escanear con la cámara
      </button>

      <div className="flex gap-2">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2"
          placeholder="O escribilo: 7791234567890"
          inputMode="numeric"
        />
        <button
          type="button"
          onClick={() => guardar()}
          disabled={guardando || !codigo.trim()}
          className="bg-green-600 text-white text-xs font-bold px-4 rounded-lg disabled:opacity-40"
        >
          {guardando ? "..." : "Guardar"}
        </button>
      </div>

      {mensaje && (
        <p className="text-[11px] font-semibold text-gray-700 mt-2">{mensaje}</p>
      )}
    </div>
  );
}
