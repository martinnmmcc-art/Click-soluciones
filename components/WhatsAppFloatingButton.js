"use client";

import { useEffect, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";

// Botón flotante de WhatsApp con un mensajito que aparece solo.
//
// Por qué el mensajito y no solo el botón: el botón por sí mismo no invita,
// la gente lo ve como "publicidad" y lo ignora. Una frase corta que da a
// entender que hay una persona atenta del otro lado es lo que hace que
// alguien con una duda se anime a escribir en vez de irse de la app.
//
// Cuidados para que no moleste:
//  - Aparece unos segundos después de entrar, no de entrada.
//  - Se puede cerrar, y si lo cierran no vuelve a aparecer en el día.
//  - Se esconde solo al rato, dejando el botón.

const CLAVE_CERRADO = "bolsonclick_wa_burbuja_cerrada";
const SEGUNDOS_HASTA_APARECER = 6;
const SEGUNDOS_VISIBLE = 14;

const SALUDOS = [
  "¿Alguna duda? Escribime, te respondo al toque 👋",
  "¿Buscás algo puntual? Preguntame sin problema 🙂",
  "¿Consultás precio o stock? Escribime nomás 👋"
];

function fueCerradaHoy() {
  try {
    const guardado = localStorage.getItem(CLAVE_CERRADO);
    if (!guardado) return false;
    const horas = (Date.now() - new Date(guardado).getTime()) / (1000 * 60 * 60);
    return horas < 24;
  } catch (e) {
    return false;
  }
}

export default function WhatsAppFloatingButton() {
  const telefono = "5492944396888";
  const [mostrarBurbuja, setMostrarBurbuja] = useState(false);
  const [saludo, setSaludo] = useState(SALUDOS[0]);

  useEffect(() => {
    if (fueCerradaHoy()) return;

    setSaludo(SALUDOS[Math.floor(Math.random() * SALUDOS.length)]);

    const aparecer = setTimeout(() => {
      setMostrarBurbuja(true);

      // Se esconde sola: si queda fija, molesta y tapa productos
      const esconder = setTimeout(() => setMostrarBurbuja(false), SEGUNDOS_VISIBLE * 1000);
      return () => clearTimeout(esconder);
    }, SEGUNDOS_HASTA_APARECER * 1000);

    return () => clearTimeout(aparecer);
  }, []);

  function cerrar(e) {
    e.preventDefault();
    e.stopPropagation();
    setMostrarBurbuja(false);
    try {
      localStorage.setItem(CLAVE_CERRADO, new Date().toISOString());
    } catch (err) {}
  }

  const mensaje = encodeURIComponent(
`Hola! 👋

Te escribo desde la app de *Bolson Click*.

Quisiera hacerte una consulta.

Gracias 🙌`
  );

  const link = `https://wa.me/${telefono}?text=${mensaje}`;

  return (
    <div className="fixed bottom-20 right-4 z-40 md:bottom-6 flex items-end gap-2">
      {mostrarBurbuja && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="relative bg-white rounded-2xl rounded-br-sm shadow-lg border border-gray-100 px-3 py-2.5 max-w-[190px] animate-[fadeIn_0.3s_ease-out] mb-1"
        >
          <button
            onClick={cerrar}
            aria-label="Cerrar mensaje"
            className="absolute -top-2 -left-2 bg-gray-200 text-gray-600 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shadow-sm"
          >
            ×
          </button>

          <p className="text-[11px] text-gray-700 leading-snug font-medium">{saludo}</p>

          <span className="flex items-center gap-1 mt-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span className="text-[9px] text-green-700 font-bold">En línea</span>
          </span>
        </a>
      )}

      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="relative bg-[#25D366] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-110 hover:shadow-xl transition-all duration-300 flex-shrink-0"
        aria-label="Consultar por WhatsApp"
      >
        <FaWhatsapp size={28} />

        {/* Puntito verde que late: da la sensación de que hay alguien atento */}
        {!mostrarBurbuja && (
          <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 border-2 border-white" />
          </span>
        )}
      </a>
    </div>
  );
}
