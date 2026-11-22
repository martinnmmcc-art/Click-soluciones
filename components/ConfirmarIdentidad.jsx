"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { guardarSesion, leerSesion } from "@/lib/sesionCliente";

// "Confirmá que sos vos": para ver pedidos, saldo o cambiar datos de una
// cuenta que ya existía (ver lib/sesionCliente.js).
//
// Dos caminos:
//  - Con su contraseña, si tiene.
//  - Sin contraseña: un botón que te escribe por WhatsApp pidiendo el link
//    de acceso. Vos lo mandás desde el panel (Clientes → link de acceso).
//
// "soloComprar" muestra además la opción de seguir sin confirmar: alcanza
// para mirar la tienda y comprar.

export default function ConfirmarIdentidad({ telefono, titulo, soloComprar = false, onListo }) {
  const [password, setPassword] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function entrarConPassword(e) {
    e.preventDefault();
    setError("");
    if (password.trim().length < 4) {
      setError("Escribí tu contraseña (mínimo 4 caracteres).");
      return;
    }
    setCargando(true);
    try {
      const { data, error: err } = await supabase.rpc("validar_login_cliente", {
        p_telefono: telefono,
        p_password: password.trim()
      });
      if (err || !data?.length) {
        setError("Esa contraseña no es. Si no te acordás, pedí tu acceso por WhatsApp acá abajo.");
        return;
      }
      guardarSesion(data[0]);
      onListo?.(data[0]);
    } catch (e2) {
      setError("No se pudo revisar. Probá de nuevo con señal.");
    } finally {
      setCargando(false);
    }
  }

  function seguirSoloComprando() {
    const actual = leerSesion();
    const datos =
      actual && actual.telefono === telefono
        ? actual
        : { telefono, nombre: "", localidad: "", direccion: "", email: "" };
    guardarSesion(datos);
    onListo?.(datos);
  }

  const linkAcceso = buildWhatsAppLink(
    `Hola! Quiero entrar a mi cuenta de Bolson Click. Mi celular es ${telefono}. ¿Me mandás el link de acceso?`
  );

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
      <h2 className="font-extrabold text-lg text-gray-800">{titulo || "Confirmá que sos vos"}</h2>
      <p className="text-[12.5px] text-gray-600 mt-1">
        Para ver tus pedidos y tus datos necesitamos confirmar que el celular <b>{telefono}</b> es tuyo.
      </p>

      <form onSubmit={entrarConPassword} className="mt-3 flex flex-col gap-2" noValidate>
        <label className="text-sm font-semibold text-gray-700" htmlFor="confirmar-pass">
          Si tenés contraseña
        </label>
        <div className="relative">
          <input
            id="confirmar-pass"
            type={verPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field pr-20"
            placeholder="Tu contraseña"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setVerPass(!verPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-blue"
          >
            {verPass ? "Ocultar" : "Ver"}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
        <button disabled={cargando} className="btn-primary disabled:opacity-50">
          {cargando ? "Revisando..." : "Entrar"}
        </button>
      </form>

      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="text-sm font-semibold text-gray-700">¿No tenés contraseña?</p>
        <p className="text-[12px] text-gray-600 mt-0.5">
          Pedinos tu link de acceso por WhatsApp: lo tocás y entrás directo, sin contraseña.
        </p>
        <a
          href={linkAcceso}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold text-sm rounded-xl py-2.5"
        >
          Pedir mi acceso por WhatsApp
        </a>
      </div>

      {soloComprar && (
        <button
          type="button"
          onClick={seguirSoloComprando}
          className="mt-3 w-full text-sm font-semibold text-brand-blue underline py-1"
        >
          Ahora no, solo quiero mirar y comprar
        </button>
      )}
    </div>
  );
}
