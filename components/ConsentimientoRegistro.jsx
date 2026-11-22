"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Las dos casillas de cualquier formulario que crea una cuenta:
//  1. Términos + privacidad + mayor de 18: obligatoria, NUNCA viene tildada.
//  2. Novedades y ofertas: opcional y separada, tampoco viene tildada.
//     Sin tildarla se puede crear la cuenta igual.

export default function ConsentimientoRegistro({ acepta, setAcepta, novedades, setNovedades, id = "reg" }) {
  return (
    <div className="space-y-2.5 mt-3">
      <label htmlFor={`${id}-terminos`} className="flex items-start gap-2.5 cursor-pointer">
        <input
          id={`${id}-terminos`}
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
          className="mt-0.5 w-5 h-5 flex-shrink-0"
          required
        />
        <span className="text-[12.5px] text-gray-800 leading-snug">
          Soy mayor de 18 años y acepto los{" "}
          <Link href="/terminos" target="_blank" className="text-brand-blue underline underline-offset-2">
            términos y condiciones
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" target="_blank" className="text-brand-blue underline underline-offset-2">
            política de privacidad
          </Link>
          .
        </span>
      </label>
      <label htmlFor={`${id}-novedades`} className="flex items-start gap-2.5 cursor-pointer">
        <input
          id={`${id}-novedades`}
          type="checkbox"
          checked={novedades}
          onChange={(e) => setNovedades(e.target.checked)}
          className="mt-0.5 w-5 h-5 flex-shrink-0"
        />
        <span className="text-[12.5px] text-gray-800 leading-snug">
          📲 Avisame cuando llegue mercadería nueva o haya ofertas (opcional). Me doy de baja cuando quiera desde Mi cuenta.
        </span>
      </label>
    </div>
  );
}

// Deja constancia en la base de cuándo aceptó y si quiere novedades.
// Nunca frena el registro: si falla, la cuenta ya está creada igual.
export async function guardarConsentimientoCliente(clienteId, telefono, novedades) {
  try {
    if (!clienteId || !telefono) return;
    await supabase.rpc("registrar_consentimiento", {
      p_cliente_id: clienteId,
      p_telefono: telefono,
      p_novedades: !!novedades
    });
  } catch (e) {}
}

export const MENSAJE_FALTA_ACEPTAR = "Para crear la cuenta tenés que aceptar los términos y la política de privacidad.";
