"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  leerConsentimiento,
  guardarConsentimiento,
  EVENTO_ABRIR_PREFERENCIAS
} from "@/lib/consentimiento";

// Aviso de cookies. Las dos opciones tienen el mismo tamaño y el mismo peso
// visual: rechazar tiene que ser tan fácil como aceptar. Hasta que el cliente
// elige no se guarda nada de medición.

export default function BannerCookies() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname() || "";

  useEffect(() => {
    if (leerConsentimiento() === null) setVisible(true);
    const abrir = () => setVisible(true);
    window.addEventListener(EVENTO_ABRIR_PREFERENCIAS, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_PREFERENCIAS, abrir);
  }, []);

  if (!visible || pathname.startsWith("/admin")) return null;

  function elegir(eleccion) {
    guardarConsentimiento(eleccion);
    setVisible(false);
  }

  return (
    <section
      role="region"
      aria-label="Aviso de cookies"
      className="fixed left-2 right-2 bottom-20 z-[60] max-w-md mx-auto bg-white border border-gray-200 rounded-2xl shadow-2xl p-4"
    >
      <p className="text-sm font-bold text-gray-900">🍪 Tu privacidad</p>
      <p className="text-[13px] text-gray-700 mt-1 leading-snug">
        Guardamos en tu celular lo necesario para que la tienda funcione (sesión, carrito). Con tu permiso, también
        medimos de dónde llegás para mejorar la tienda. No usamos publicidad de terceros.{" "}
        <Link href="/cookies" className="text-brand-blue underline underline-offset-2">
          Más info
        </Link>
      </p>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => elegir("necesarias")}
          className="flex-1 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-gray-800 font-bold text-sm"
        >
          Solo necesarias
        </button>
        <button
          type="button"
          onClick={() => elegir("todas")}
          className="flex-1 py-2.5 rounded-xl border-2 border-brand-blue bg-white text-brand-blue font-bold text-sm"
        >
          Aceptar todo
        </button>
      </div>
    </section>
  );
}
