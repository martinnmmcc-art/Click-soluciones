"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { correoGuardado } from "@/lib/sesionGuardada";
import { validarTelefonoArgentino, normalizarTelefono } from "@/lib/telefono";
import { avisarAdmin } from "@/lib/avisarAdmin";

// Registro guiado, de a un paso por pantalla: nombre → celular → localidad.
//
// Una sola pregunta por vez se completa mucho más que un formulario con
// todo junto: cada paso es fácil, se ve cuánto falta y nadie se traba.
// Sin contraseña: cada campo extra hace que se vaya más gente.
//
// Se abre de dos formas:
//  - Sola, a los 20 segundos (o enseguida si ya miró varias veces sin
//    registrarse). Esa es obligatoria para seguir.
//  - Cuando el cliente toca "Crear mi cuenta" (evento "bolsonclick:registrarse").
//    Esa se puede cerrar.
//
// No aparece en los catálogos compartidos: esos links se mandan a personas
// que todavía no son clientes y ahí sí hay que dejarlas mirar libremente.

const SEGUNDOS_ANTES_DE_PEDIR = 20;
export const EVENTO_REGISTRO = "bolsonclick:registrarse";

const LOCALIDADES = ["El Bolsón", "Lago Puelo", "El Hoyo", "Epuyén", "Mallín Ahogado"];

// Huella básica del dispositivo. No identifica a la persona, solo ayuda a
// distinguir dos celulares distintos detrás de la misma conexión, algo
// habitual en las redes móviles de la zona.
function huellaDispositivo() {
  try {
    const partes = [
      navigator.userAgent || "",
      navigator.language || "",
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset()
    ].join("|");

    let h = 0;
    for (let i = 0; i < partes.length; i++) {
      h = (h << 5) - h + partes.charCodeAt(i);
      h |= 0;
    }
    return "d" + Math.abs(h).toString(36);
  } catch (e) {
    return null;
  }
}

// Pantallas donde nunca molestamos
const RUTAS_LIBRES = ["/login", "/catalogo-compartir", "/offline", "/admin"];

function tieneSesionCliente() {
  try {
    const s = localStorage.getItem("cliente_sesion");
    if (!s) return false;
    return !!JSON.parse(s)?.telefono;
  } catch (e) {
    return false;
  }
}

export default function MuroRegistro() {
  const [mostrar, setMostrar] = useState(false);
  const [voluntario, setVoluntario] = useState(false);
  const [paso, setPaso] = useState(1);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [otraLocalidad, setOtraLocalidad] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  const [yaMiroAntes, setYaMiroAntes] = useState(false);
  const campo = useRef(null);

  useEffect(() => {
    function estaLibre() {
      const ruta = window.location.pathname;
      return RUTAS_LIBRES.some((r) => ruta.startsWith(r));
    }

    // El admin entra con correo y contraseña (Supabase Auth), no con la
    // sesión de cliente. Se mira la sesión GUARDADA en el celular, sin
    // internet: sin señal Supabase respondía "no hay sesión" y al admin le
    // aparecía el muro.
    async function esAdminLogueado() {
      return !!correoGuardado();
    }

    // Contamos la visita apenas entra. El servidor lleva la cuenta por IP,
    // así que entrar en incógnito o borrar los datos no la reinicia.
    let visitaPrevia = null;
    // El muro solo aparece si se CONFIRMÓ que hay conexión (el servidor
    // contestó). Sin señal nadie tiene que toparse con un formulario que
    // tampoco podría enviar: se deja mirar el catálogo.
    let hayConexion = false;
    async function contarVisita() {
      if (!navigator.onLine) return;
      try {
        const res = await Promise.race([
          fetch("/api/visita", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ huella: huellaDispositivo() })
          }),
          new Promise((_, no) => setTimeout(() => no(new Error("sin respuesta")), 8000))
        ]);
        if (!res.ok) return;
        visitaPrevia = await res.json();
        hayConexion = true;

        // Si ya miró varias veces sin registrarse, no esperamos los
        // 20 segundos: se lo pedimos enseguida.
        if (visitaPrevia?.exigir_registro && !estaLibre() && !tieneSesionCliente()) {
          if (!(await esAdminLogueado())) {
            setYaMiroAntes(true);
            setVoluntario(false);
            setMostrar(true);
          }
        }
      } catch (e) {}
    }
    contarVisita();

    async function decidir() {
      if (!hayConexion || !navigator.onLine) return;
      if (estaLibre() || tieneSesionCliente()) return;
      if (await esAdminLogueado()) return;
      // Volvemos a revisar recién al momento de mostrar: en esos 20 segundos
      // el usuario pudo haberse registrado o iniciado sesión.
      if (estaLibre() || tieneSesionCliente()) return;
      setVoluntario(false);
      setMostrar(true);
    }

    // El cliente pidió registrarse (tarjeta del inicio, botones de la app)
    function alPedirRegistro() {
      if (tieneSesionCliente()) return;
      setVoluntario(true);
      setPaso(1);
      setError("");
      setMostrar(true);
    }
    window.addEventListener(EVENTO_REGISTRO, alPedirRegistro);

    const t = setTimeout(decidir, SEGUNDOS_ANTES_DE_PEDIR * 1000);
    return () => {
      clearTimeout(t);
      window.removeEventListener(EVENTO_REGISTRO, alPedirRegistro);
    };
  }, []);

  // Si mientras el muro está abierto aparece una sesión (por ejemplo, el
  // admin entró en otra pestaña), lo cerramos solo en vez de dejarlo trabado.
  useEffect(() => {
    if (!mostrar || listo) return;
    const revisar = setInterval(async () => {
      try {
        if (tieneSesionCliente()) {
          setMostrar(false);
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) setMostrar(false);
      } catch (e) {}
    }, 3000);
    return () => clearInterval(revisar);
  }, [mostrar, listo]);

  // Mientras está el muro, no se puede desplazar la página de atrás
  useEffect(() => {
    if (!mostrar) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [mostrar]);

  // Cada paso arranca con el teclado listo en su campo
  useEffect(() => {
    if (mostrar) setTimeout(() => campo.current?.focus(), 80);
  }, [paso, mostrar, otraLocalidad]);

  function siguiente(e) {
    e?.preventDefault();
    setError("");
    if (paso === 1) {
      if (nombre.trim().length < 2) {
        setError("Escribí tu nombre para seguir.");
        return;
      }
      setPaso(2);
      return;
    }
    if (paso === 2) {
      const chequeo = validarTelefonoArgentino(telefono);
      if (!chequeo.valido) {
        setError(chequeo.motivo);
        return;
      }
      setPaso(3);
      return;
    }
    registrarse();
  }

  async function registrarse() {
    setEnviando(true);
    setError("");
    try {
      const tel = normalizarTelefono(telefono);
      const loc = localidad.trim();

      // Usamos la misma función que al comprar: crea la cuenta sin
      // contraseña y devuelve un acceso para el celular.
      const { data, error: errorRpc } = await supabase.rpc("crear_cuenta_al_comprar", {
        p_telefono: tel,
        p_nombre: nombre.trim(),
        p_localidad: loc,
        p_direccion: ""
      });

      if (errorRpc || !data || data.length === 0) {
        const msg = errorRpc?.message || "";
        if (msg.includes("TELEFONO_BLOQUEADO")) {
          setError("Este número no puede acceder. Escribinos por WhatsApp.");
        } else if (msg.includes("TELEFONO_INVALIDO")) {
          setError("Revisá el número de celular.");
          setPaso(2);
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
          localidad: loc,
          direccion: "",
          email: ""
        })
      );

      if (!cuenta.ya_existia) {
        avisarAdmin({ tipo: "registro", telefono: tel, nombre: nombre.trim(), detalle: loc || null });
      }

      setListo(true);
      setTimeout(() => window.location.reload(), 1400);
    } catch (err) {
      setError("Ocurrió un error. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!mostrar) return null;

  const primerNombre = nombre.trim().split(/\s+/)[0] || "";
  const titulos = {
    1: yaMiroAntes && !voluntario ? "Creá tu cuenta para seguir mirando" : "¿Cómo te llamás?",
    2: `${primerNombre ? primerNombre + ", ¿" : "¿"}cuál es tu celular?`,
    3: "¿Dónde te lo entregamos?"
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#13284F]/95 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-registro"
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
          {voluntario && !listo && (
            <button
              type="button"
              onClick={() => setMostrar(false)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full text-gray-400 hover:bg-gray-100 text-xl"
              aria-label="Cerrar"
            >
              ×
            </button>
          )}

          {listo ? (
            <div className="text-center py-6">
              <p className="text-5xl mb-3" aria-hidden="true">🎉</p>
              <h2 id="titulo-registro" className="font-extrabold text-xl text-gray-800">
                ¡Listo{primerNombre ? `, ${primerNombre}` : ""}!
              </h2>
              <p className="text-sm text-gray-500 mt-1">Ya tenés tu cuenta. Te llevamos a la tienda…</p>
            </div>
          ) : (
            <>
              {/* Progreso: se ve cuánto falta */}
              <div className="flex items-center gap-1.5 mb-4 pr-8">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${n <= paso ? "bg-brand-blue" : "bg-gray-200"}`}
                  />
                ))}
                <span className="text-[11px] font-bold text-gray-400 ml-1 whitespace-nowrap">Paso {paso} de 3</span>
              </div>

              {paso === 1 && (
                <div className="flex items-center gap-3 mb-4">
                  <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-2xl flex-shrink-0" />
                  <p className="text-xs text-gray-600 leading-snug">
                    {yaMiroAntes && !voluntario
                      ? "Ya miraste varias veces 🙂 Creá tu cuenta gratis y seguí sin límite."
                      : "Creá tu cuenta gratis en 3 pasos. No necesitás contraseña."}
                  </p>
                </div>
              )}

              <h2 id="titulo-registro" className="font-extrabold text-xl text-gray-800 leading-tight mb-3">
                {titulos[paso]}
              </h2>

              <form onSubmit={siguiente} noValidate>
                {paso === 1 && (
                  <input
                    ref={campo}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="input-field text-base"
                    placeholder="Tu nombre y apellido"
                    autoComplete="name"
                    enterKeyHint="next"
                  />
                )}

                {paso === 2 && (
                  <>
                    <input
                      ref={campo}
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="input-field text-base tracking-wide"
                      placeholder="2944 123456"
                      inputMode="tel"
                      autoComplete="tel"
                      enterKeyHint="next"
                    />
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      Con característica, sin 0 ni 15. Lo usamos para coordinar la entrega y avisarte cómo va tu pedido.
                    </p>
                  </>
                )}

                {paso === 3 && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {LOCALIDADES.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => {
                            setLocalidad(l);
                            setOtraLocalidad(false);
                          }}
                          className={`px-3 py-2 rounded-full text-sm font-semibold border transition ${
                            localidad === l && !otraLocalidad
                              ? "bg-brand-blue text-white border-brand-blue"
                              : "bg-white text-gray-700 border-gray-300"
                          }`}
                          aria-pressed={localidad === l && !otraLocalidad}
                        >
                          {l}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setOtraLocalidad(true);
                          setLocalidad("");
                        }}
                        className={`px-3 py-2 rounded-full text-sm font-semibold border transition ${
                          otraLocalidad ? "bg-brand-blue text-white border-brand-blue" : "bg-white text-gray-700 border-gray-300"
                        }`}
                        aria-pressed={otraLocalidad}
                      >
                        Otra
                      </button>
                    </div>
                    {otraLocalidad && (
                      <input
                        ref={campo}
                        value={localidad}
                        onChange={(e) => setLocalidad(e.target.value)}
                        className="input-field text-base mt-3"
                        placeholder="Escribí tu localidad"
                      />
                    )}
                    <p className="text-[11px] text-gray-500 mt-2">
                      Entregamos en El Bolsón y la Comarca Andina. Si no sabés, seguí igual.
                    </p>
                  </>
                )}

                {error && (
                  <p className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl p-2.5 mt-3" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex gap-2 mt-4">
                  {paso > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setPaso(paso - 1);
                      }}
                      className="px-4 rounded-xl border border-gray-300 text-gray-600 font-semibold text-sm"
                    >
                      Atrás
                    </button>
                  )}
                  <button disabled={enviando} className="btn-primary flex-1 disabled:opacity-50">
                    {enviando ? "Creando tu cuenta..." : paso < 3 ? "Siguiente" : "Crear mi cuenta"}
                  </button>
                </div>
              </form>

              <p className="text-[10px] text-gray-400 text-center mt-4">
                ¿Ya tenés cuenta?{" "}
                <a href="/login?entrar=1" className="text-brand-blue font-semibold underline">
                  Entrá acá
                </a>
                . Tu celular no se comparte con nadie.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
