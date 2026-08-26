"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { validarTelefonoArgentino, normalizarTelefono } from "@/lib/telefono";
import { avisarAdmin, idVisitante } from "@/lib/avisarAdmin";

// Pide registrarse para seguir usando la app.
//
// Como la barrera es obligatoria, el formulario tiene que ser lo más corto
// posible: solo nombre y celular, sin contraseña. Cada campo extra hace que
// se vaya más gente.
//
// No aparece en los catálogos compartidos: esos links se mandan a personas
// que todavía no son clientes y ahí sí hay que dejarlas mirar libremente.

const SEGUNDOS_ANTES_DE_PEDIR = 20;

// Pantallas donde nunca molestamos
const RUTAS_LIBRES = ["/login", "/catalogo-compartir", "/offline", "/admin"];

export default function MuroRegistro() {
  const [mostrar, setMostrar] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function estaLibre() {
      const ruta = window.location.pathname;
      return RUTAS_LIBRES.some((r) => ruta.startsWith(r));
    }

    function yaTieneCuenta() {
      try {
        const s = localStorage.getItem("cliente_sesion");
        if (!s) return false;
        return !!JSON.parse(s)?.telefono;
      } catch (e) {
        return false;
      }
    }

    if (estaLibre() || yaTieneCuenta()) return;

    const t = setTimeout(() => {
      // Revisamos de nuevo: puede haberse registrado mientras tanto
      if (!estaLibre() && !yaTieneCuenta()) setMostrar(true);
    }, SEGUNDOS_ANTES_DE_PEDIR * 1000);

    return () => clearTimeout(t);
  }, []);

  // Mientras está el muro, no se puede desplazar la página de atrás
  useEffect(() => {
    if (!mostrar) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [mostrar]);

  async function registrarse(e) {
    e.preventDefault();
    setError("");

    if (nombre.trim().length < 2) {
      setError("Escribí tu nombre para continuar.");
      return;
    }

    const chequeo = validarTelefonoArgentino(telefono);
    if (!chequeo.valido) {
      setError(chequeo.motivo);
      return;
    }

    setEnviando(true);
    try {
      const tel = normalizarTelefono(telefono);

      // Usamos la misma función que al comprar: crea la cuenta sin
      // contraseña y devuelve un acceso para el celular.
      const { data, error: errorRpc } = await supabase.rpc("crear_cuenta_al_comprar", {
        p_telefono: tel,
        p_nombre: nombre.trim(),
        p_localidad: localidad.trim(),
        p_direccion: ""
      });

      if (errorRpc || !data || data.length === 0) {
        const msg = errorRpc?.message || "";
        if (msg.includes("TELEFONO_BLOQUEADO")) {
          setError("Este número no puede acceder. Escribinos por WhatsApp.");
        } else if (msg.includes("TELEFONO_INVALIDO")) {
          setError("Revisá el número de celular.");
        } else {
          setError("No pudimos crear la cuenta. Probá de nuevo en un momento.");
        }
        return;
      }

      const cuenta = data[0];

      localStorage.setItem(
        "cliente_sesion",
        JSON.stringify({
          id: cuenta.cliente_id,
          telefono: tel,
          nombre: nombre.trim(),
          localidad: localidad.trim(),
          direccion: "",
          email: ""
        })
      );

      if (!cuenta.ya_existia) {
        avisarAdmin({
          tipo: "registro",
          telefono: tel,
          nombre: nombre.trim(),
          detalle: localidad.trim() || null
        });
      }

      setMostrar(false);
      window.location.reload();
    } catch (err) {
      setError("Ocurrió un error. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!mostrar) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-brand-blueDark/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
          <div className="text-center mb-5">
            <img
              src="/icons/icon-192.png"
              alt=""
              className="w-16 h-16 rounded-2xl mx-auto mb-3"
            />
            <h2 className="font-extrabold text-lg text-gray-800 leading-tight">
              Seguí mirando con tu cuenta
            </h2>
            <p className="text-xs text-gray-500 mt-1.5">
              Es gratis, son 10 segundos y <b>no necesitás contraseña</b>.
            </p>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 mb-4 space-y-1.5">
            <p className="text-[11px] text-gray-700 flex items-start gap-1.5">
              <span>📦</span>
              <span>Seguí tus pedidos sin tener que preguntar</span>
            </p>
            <p className="text-[11px] text-gray-700 flex items-start gap-1.5">
              <span>✨</span>
              <span>Te avisamos cuando llega mercadería nueva</span>
            </p>
            <p className="text-[11px] text-gray-700 flex items-start gap-1.5">
              <span>🚚</span>
              <span>Entrega en El Bolsón y toda la Comarca</span>
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl p-2.5 mb-3 text-center">
              {error}
            </div>
          )}

          <form onSubmit={registrarse} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Tu nombre
              </label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="input-field"
                placeholder="Ej: Juan Pérez"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Tu celular
              </label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="input-field"
                placeholder="Ej: 2944123456"
                inputMode="tel"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Localidad <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                className="input-field"
                placeholder="Ej: El Bolsón"
              />
            </div>

            <button
              disabled={enviando}
              className="btn-primary w-full disabled:opacity-50"
            >
              {enviando ? "Creando tu cuenta..." : "Entrar"}
            </button>
          </form>

          <p className="text-[10px] text-gray-400 text-center mt-3">
            Solo usamos tu celular para coordinar entregas y avisarte de
            novedades. No lo compartimos con nadie.
          </p>
        </div>
      </div>
    </div>
  );
}
