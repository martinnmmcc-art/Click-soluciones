"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { correoGuardado } from "@/lib/sesionGuardada";
import { EVENTO_REGISTRO } from "@/components/MuroRegistro";

// Tarjeta del inicio que invita a crear la cuenta y muestra que son 3 pasos
// cortos. Saber de antemano cuánto lleva es lo que hace que la gente empiece.
// Solo la ve quien todavía no tiene cuenta.
export default function GuiaRegistro() {
  const [ver, setVer] = useState(false);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("cliente_sesion") || "null");
      setVer(!s?.telefono && !correoGuardado());
    } catch {
      setVer(true);
    }
  }, []);

  if (!ver) return null;

  const pasos = [
    { titulo: "Tu nombre", detalle: "para saber cómo llamarte" },
    { titulo: "Tu celular", detalle: "para coordinar la entrega" },
    { titulo: "Tu localidad", detalle: "y listo, sin contraseña" }
  ];

  return (
    <section className="max-w-md md:max-w-none mx-auto px-4 mt-6" aria-labelledby="titulo-guia-registro">
      <div className="rounded-3xl bg-white border-2 border-brand-blue/20 p-4 shadow-sm">
        <h2 id="titulo-guia-registro" className="font-black text-gray-800 text-[17px] leading-tight">
          Creá tu cuenta en 3 pasos
        </h2>
        <p className="text-[12px] text-gray-500 mt-0.5">
          Seguís tus pedidos, guardás favoritos y te avisamos cuando llega lo que te interesa.
        </p>

        <ol className="mt-3 space-y-2">
          {pasos.map((p, i) => (
            <li key={p.titulo} className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-brand-blue text-white text-sm font-black flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <span className="text-[13px] leading-tight">
                <b className="text-gray-800">{p.titulo}</b>{" "}
                <span className="text-gray-500">{p.detalle}</span>
              </span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(EVENTO_REGISTRO))}
          className="btn-primary w-full mt-4"
        >
          Crear mi cuenta gratis
        </button>
        <p className="text-center text-[11px] text-gray-500 mt-2">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login?entrar=1" className="text-brand-blue font-semibold underline">
            Entrá acá
          </Link>
        </p>
      </div>
    </section>
  );
}
