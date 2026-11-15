"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NEGOCIO } from "@/lib/config";
import { abrirPreferenciasCookies } from "@/lib/consentimiento";

// Pie de página con los datos del negocio y los links legales. El botón de
// arrepentimiento tiene que estar visible y a un toque desde la portada
// (Res. 424/2020), igual que el link a Defensa del Consumidor (Res. 38/2017).

function telefonoLindo(tel) {
  const n = String(tel || "").replace(/\D/g, "");
  return n.length === 10 ? `${n.slice(0, 3)} ${n.slice(3, 6)}-${n.slice(6)}` : n;
}

const enlace = "underline underline-offset-2 hover:text-brand-blue";

export default function PieLegal() {
  const pathname = usePathname() || "";
  if (pathname.startsWith("/admin") || pathname.startsWith("/catalogo-compartir")) return null;

  return (
    <footer className="mt-10 border-t border-gray-200 px-4 pt-5 pb-6 text-[13px] text-gray-700">
      <Link
        href="/arrepentimiento"
        className="block w-full text-center font-bold text-sm border-2 border-gray-800 text-gray-900 rounded-xl py-2.5 mb-4"
      >
        Botón de arrepentimiento
      </Link>

      <p className="font-bold text-gray-900">{NEGOCIO.nombre}</p>
      <p>
        {NEGOCIO.responsable}
        {NEGOCIO.cuit ? ` · CUIT ${NEGOCIO.cuit}` : ""}
      </p>
      <p>{NEGOCIO.domicilio || `${NEGOCIO.localidad}, ${NEGOCIO.provincia}, Argentina`}</p>
      <p>
        WhatsApp:{" "}
        <a href={`https://wa.me/${NEGOCIO.whatsapp}`} className={enlace}>
          {telefonoLindo(NEGOCIO.telefono)}
        </a>
      </p>

      <nav aria-label="Información legal" className="mt-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          <li>
            <Link href="/terminos" className={enlace}>
              Términos y condiciones
            </Link>
          </li>
          <li>
            <Link href="/privacidad" className={enlace}>
              Privacidad
            </Link>
          </li>
          <li>
            <Link href="/reembolsos" className={enlace}>
              Cambios y devoluciones
            </Link>
          </li>
          <li>
            <Link href="/cookies" className={enlace}>
              Cookies
            </Link>
          </li>
          <li>
            <button type="button" onClick={abrirPreferenciasCookies} className={enlace}>
              Preferencias de cookies
            </button>
          </li>
        </ul>
      </nav>

      <p className="mt-3">
        Defensa de las y los consumidores. Para reclamos{" "}
        <a
          href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario"
          className={enlace}
          target="_blank"
          rel="noopener noreferrer"
        >
          ingresá acá
        </a>
        .
      </p>
      <p className="mt-2 text-gray-600">Precios finales en pesos argentinos. Fotos ilustrativas.</p>
    </footer>
  );
}
