"use client";

import { useEffect, useState } from "react";

// Invita a instalar la app en la pantalla de inicio.
//
// En Android usamos el diálogo nativo del navegador: es un toque y listo.
// Sin esto hay que explicarle al cliente "andá al menú de los tres puntitos,
// buscá Instalar app..." y casi nadie lo hace.
//
// En iPhone no existe ese diálogo (Apple no lo permite), así que mostramos
// los pasos con los íconos que el cliente ve en pantalla.
//
// Instalar la app no es un capricho: es lo que hace que funcione sin señal,
// que reciba notificaciones y que abra al instante.

const CLAVE_CERRADO = "bolsonclick_instalar_cerrado";
const DIAS_ESPERA = 5;
const SEGUNDOS_HASTA_APARECER = 20;

function yaEstaInstalada() {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  } catch (e) {
    return false;
  }
}

function esIPhone() {
  try {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  } catch (e) {
    return false;
  }
}

function fueCerradoHacePoco() {
  try {
    const g = localStorage.getItem(CLAVE_CERRADO);
    if (!g) return false;
    const dias = (Date.now() - new Date(g).getTime()) / (1000 * 60 * 60 * 24);
    return dias < DIAS_ESPERA;
  } catch (e) {
    return false;
  }
}

export default function InstalarApp() {
  const [promptGuardado, setPromptGuardado] = useState(null);
  const [mostrar, setMostrar] = useState(false);
  const [mostrarPasosIPhone, setMostrarPasosIPhone] = useState(false);
  const [instalando, setInstalando] = useState(false);

  useEffect(() => {
    if (yaEstaInstalada() || fueCerradoHacePoco()) return;

    // Chrome nos avisa cuando la app se puede instalar. Guardamos ese aviso
    // para dispararlo nosotros cuando el cliente toque nuestro botón.
    function alPoderInstalar(e) {
      e.preventDefault();
      setPromptGuardado(e);
      setTimeout(() => setMostrar(true), SEGUNDOS_HASTA_APARECER * 1000);
    }

    window.addEventListener("beforeinstallprompt", alPoderInstalar);

    // En iPhone no hay aviso: mostramos los pasos si detectamos que es Safari
    if (esIPhone()) {
      const t = setTimeout(() => setMostrar(true), SEGUNDOS_HASTA_APARECER * 1000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", alPoderInstalar);
  }, []);

  async function instalar() {
    if (esIPhone()) {
      setMostrarPasosIPhone(true);
      return;
    }
    if (!promptGuardado) return;

    setInstalando(true);
    try {
      promptGuardado.prompt();
      const { outcome } = await promptGuardado.userChoice;
      if (outcome === "accepted") {
        setMostrar(false);
      } else {
        cerrar();
      }
      setPromptGuardado(null);
    } finally {
      setInstalando(false);
    }
  }

  function cerrar() {
    setMostrar(false);
    setMostrarPasosIPhone(false);
    try {
      localStorage.setItem(CLAVE_CERRADO, new Date().toISOString());
    } catch (e) {}
  }

  if (!mostrar) return null;

  // Pasos para iPhone, con los íconos tal como los ve en pantalla
  if (mostrarPasosIPhone) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/50 flex items-end" onClick={cerrar}>
        <div
          className="bg-white rounded-t-3xl w-full p-5 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

          <p className="font-extrabold text-gray-800 text-base text-center">
            Instalar Bolson Click
          </p>
          <p className="text-xs text-gray-500 text-center mt-1 mb-4">
            Son dos toques y la tenés como una app más
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <span className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                1
              </span>
              <p className="text-xs text-gray-700">
                Tocá el botón de compartir <b>⬆️</b> abajo en el medio de la pantalla
              </p>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <span className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                2
              </span>
              <p className="text-xs text-gray-700">
                Bajá y elegí <b>&quot;Agregar a pantalla de inicio&quot;</b>
              </p>
            </div>

            <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3">
              <span className="bg-green-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                ✓
              </span>
              <p className="text-xs text-gray-700">
                Listo, ya la tenés en tu celular
              </p>
            </div>
          </div>

          <button
            onClick={cerrar}
            className="w-full bg-gray-100 text-gray-700 text-sm font-bold py-3 rounded-xl mt-4"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[55] md:bottom-6 md:left-auto md:right-6 md:max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-3 flex items-center gap-3">
        <img
          src="/icons/icon-192.png"
          alt=""
          className="w-11 h-11 rounded-xl flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <p className="font-bold text-xs text-gray-800">Tené la app en tu celular</p>
          <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
            Funciona sin señal y te avisamos de las novedades
          </p>
        </div>

        <button
          onClick={instalar}
          disabled={instalando}
          className="bg-brand-blue text-white text-xs font-bold px-3.5 py-2 rounded-xl whitespace-nowrap flex-shrink-0 disabled:opacity-50"
        >
          {instalando ? "..." : "Instalar"}
        </button>

        <button
          onClick={cerrar}
          aria-label="Ahora no"
          className="text-gray-300 text-lg leading-none px-1 flex-shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}
