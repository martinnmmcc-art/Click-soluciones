"use client";

// Botón para imprimir o guardar como PDF (el celular ofrece "Guardar como PDF")
export default function BotonImprimir({ texto = "🖨️ Imprimir / guardar PDF" }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden bg-brand-blue text-white font-bold text-sm rounded-xl px-4 py-2.5"
    >
      {texto}
    </button>
  );
}
