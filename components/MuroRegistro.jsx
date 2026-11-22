"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { correoGuardado } from "@/lib/sesionGuardada";
import { validarTelefonoArgentino, normalizarTelefono } from "@/lib/telefono";
import { avisarAdmin } from "@/lib/avisarAdmin";
import { guardarSesion } from "@/lib/sesionCliente";
import ConsentimientoRegistro, {
  guardarConsentimientoCliente,
  MENSAJE_FALTA_ACEPTAR
} from "@/components/ConsentimientoRegistro";

// Registro en 2 pasos: celular → nombre y localidad.
//
// Arranca por el celular a propósito: si ese número ya tiene cuenta (por
// ejemplo, un cliente que cambió de celular), entra directo y listo, sin
// contestar nada más. Solo los nuevos completan el paso 2.
// Sin contraseña: cada campo extra hace que se vaya más gente.
//
// Seguridad: a quien entra con un número que YA existía no se le da acceso a
// los pedidos ni a los datos de esa cuenta (cualquiera puede escribir un
// número). Puede mirar y comprar; para ver sus pedidos confirma desde
// "Mi cuenta" (ver lib/sesionCliente.js).
//
// Cuándo aparece:
//  - Primeras 2 visitas sin cuenta: se puede mirar libre. A los 20 segundos
//    se lo invitamos, y esa invitación se puede cerrar.
//  - Desde la 3ª visita: OBLIGATORIO, aparece enseguida y no se cierra.
//    El servidor cuenta las visitas por IP + huella del dispositivo, así que
//    entrar en incógnito o borrar los datos no lo reinicia.
//  - Al tocar "Agregar al carrito" sin cuenta: hay que registrarse para
//    agregar (así sabés quién agrega qué). El producto se agrega solo
//    apenas termina el registro.
//  - Cuando el cliente toca "Crear mi cuenta" (evento "bolsonclick:registrarse").
//
// No aparece solo en los catálogos compartidos: esos links se mandan a
// personas que todavía no son clientes y ahí se las deja mirar libremente.
const SEGUNDOS_ANTES_DE_PEDIR = 20;
const DIAS_SIN_INSISTIR = 7;
const CLAVE_CERRADO = "bolsonclick_registro_cerrado";
export const EVENTO_REGISTRO = "bolsonclick:registrarse";

const LOCALIDADES = ["El Bolsón", "Lago Puelo", "El Hoyo", "Epuyén", "Mallín Ahogado"];

function lacerroHacePoco() {
  try {
    const f = localStorage.getItem(CLAVE_CERRADO);
    return !!f && Date.now() - new Date(f).getTime() < DIAS_SIN_INSISTIR * 86400000;
  } catch (e) {
    return false;
  }
}

// Huella básica del dispositivo. No identifica a la persona, solo ayuda a
// distinguir dos celulares distintos detrás de la misma conexión, algo
// habitual en las redes móviles de la zona. Está informado en la política
// de privacidad y se borra a los 30 días.
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
  // "invitacion": se puede cerrar · "obligatorio": desde la 3ª visita
  // "carrito": quiso agregar algo sin cuenta · "voluntario": tocó "Crear cuenta"
  const [modo, setModo] = useState("invitacion");
  const [productoPendiente, setProductoPendiente] = useState("");
  const [paso, setPaso] = useState(1);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [otraLocalidad, setOtraLocalidad] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  // "nuevo" (creó la cuenta) o "volvio" (el número ya tenía cuenta)
  const [tipoListo, setTipoListo] = useState("nuevo");
  const [error, setError] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [novedades, setNovedades] = useState(false);
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

    // Contamos la visita apenas entra (solo si no tiene cuenta). El muro
    // obligatorio solo aparece si se CONFIRMÓ que hay conexión: sin señal
    // nadie tiene que toparse con un formulario que no podría enviar.
    let obligatorio = false;
    async function contarVisita() {
      if (!navigator.onLine || estaLibre() || tieneSesionCliente()) return;
      if (await esAdminLogueado()) return;
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
        const visita = await res.json();
        if (visita?.exigir_registro && !estaLibre() && !tieneSesionCliente()) {
          obligatorio = true;
          setModo("obligatorio");
          setPaso(1);
          setMostrar(true);
        }
      } catch (e) {}
    }
    contarVisita();

    // Primeras visitas: invitación a los 20 segundos, que se puede cerrar
    async function decidir() {
      if (obligatorio) return;
      if (!navigator.onLine) return;
      if (estaLibre() || tieneSesionCliente() || lacerroHacePoco()) return;
      if (await esAdminLogueado()) return;
      if (estaLibre() || tieneSesionCliente()) return;
      setModo("invitacion");
      setPaso(1);
      setMostrar(true);
    }

    // Pidió registrarse: tocó "Crear mi cuenta" o quiso agregar al carrito
    function alPedirRegistro(e) {
      if (tieneSesionCliente()) return;
      const motivo = e?.detail?.motivo;
      if (!obligatorio) setModo(motivo === "carrito" ? "carrito" : "voluntario");
      setProductoPendiente(e?.detail?.producto || "");
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

  const sePuedeCerrar = modo !== "obligatorio";

  function cerrar() {
    if (!sePuedeCerrar) return;
    setMostrar(false);
    // Si cerró sin registrarse lo que quiso agregar, no queda pendiente
    if (modo === "carrito") {
      try {
        sessionStorage.removeItem("bolsonclick_carrito_pendiente");
      } catch (e) {}
    }
    // Si la invitación se abrió sola y la cerró, no insistimos por una semana
    if (modo === "invitacion") {
      try {
        localStorage.setItem(CLAVE_CERRADO, new Date().toISOString());
      } catch (e) {}
    }
  }

  // Escape cierra, como cualquier ventana (salvo el obligatorio)
  useEffect(() => {
    if (!mostrar || listo || !sePuedeCerrar) return;
    const alTeclear = (e) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  });

  async function siguiente(e) {
    e?.preventDefault();
    setError("");
    if (paso === 1) {
      const chequeo = validarTelefonoArgentino(telefono);
      if (!chequeo.valido) {
        setError(chequeo.motivo);
        return;
      }
      const tel = normalizarTelefono(telefono);
      setEnviando(true);
      try {
        const [{ data: bloqueado }, { data: existe }] = await Promise.all([
          supabase.rpc("telefono_esta_bloqueado", { p_telefono: tel }),
          supabase.rpc("telefono_ya_registrado", { p_telefono: tel })
        ]);
        if (bloqueado) {
          setError("Este número no puede acceder. Escribinos por WhatsApp.");
          return;
        }
        if (existe) {
          // Ya es cliente: entra a mirar y comprar sin más preguntas
          guardarSesion({ telefono: tel, nombre: "", localidad: "", direccion: "", email: "" });
          setTipoListo("volvio");
          setListo(true);
          setTimeout(() => window.location.reload(), 1400);
          return;
        }
        setPaso(2);
      } catch (err) {
        // Sin poder chequear, sigue como cuenta nueva (el servidor decide)
        setPaso(2);
      } finally {
        setEnviando(false);
      }
      return;
    }
    if (nombre.trim().length < 2) {
      setError("Escribí tu nombre para seguir.");
      return;
    }
    if (!acepta) {
      setError(MENSAJE_FALTA_ACEPTAR);
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
          setPaso(1);
        } else {
          setError("No pudimos crear la cuenta. Probá de nuevo en un momento.");
        }
        return;
      }

      const cuenta = data[0];
      if (cuenta.ya_existia) {
        // Se registró desde otro lado mientras tanto: entra como cliente que vuelve
        guardarSesion({ telefono: tel, nombre: "", localidad: "", direccion: "", email: "" });
        setTipoListo("volvio");
      } else {
        await guardarConsentimientoCliente(cuenta.cliente_id, tel, novedades);
        guardarSesion({
          id: cuenta.cliente_id,
          telefono: tel,
          nombre: nombre.trim(),
          localidad: loc,
          direccion: "",
          email: "",
          sesion: cuenta.sesion
        });
        avisarAdmin({ tipo: "registro", telefono: tel, nombre: nombre.trim(), detalle: loc || null });
        setTipoListo("nuevo");
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
    1: "¿Cuál es tu celular?",
    2: "¿Cómo te llamás y dónde estás?"
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
          {!listo && sePuedeCerrar && (
            <button
              type="button"
              onClick={cerrar}
              className="absolute top-3 right-3 w-9 h-9 rounded-full text-gray-600 hover:bg-gray-100 text-xl"
              aria-label="Cerrar"
            >
              ×
            </button>
          )}

          {listo ? (
            <div className="text-center py-6">
              <p className="text-5xl mb-3" aria-hidden="true">🎉</p>
              <h2 id="titulo-registro" className="font-extrabold text-xl text-gray-800">
                {tipoListo === "volvio" ? "¡Hola de nuevo!" : `¡Listo${primerNombre ? `, ${primerNombre}` : ""}!`}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {tipoListo === "volvio"
                  ? "Ese número ya tiene cuenta. Seguí mirando y comprando…"
                  : "Ya tenés tu cuenta. Te llevamos a la tienda…"}
              </p>
            </div>
          ) : (
            <>
              {/* Progreso: se ve cuánto falta */}
              <div className="flex items-center gap-1.5 mb-4 pr-8">
                {[1, 2].map((n) => (
                  <span
                    key={n}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${n <= paso ? "bg-brand-blue" : "bg-gray-200"}`}
                  />
                ))}
                <span className="text-[11px] font-bold text-gray-400 ml-1 whitespace-nowrap">Paso {paso} de 2</span>
              </div>

              {paso === 1 && (
                <div className="flex items-center gap-3 mb-4">
                  <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-2xl flex-shrink-0" />
                  <p className="text-xs text-gray-600 leading-snug">
                    {modo === "obligatorio"
                      ? "Ya miraste varias veces 🙂 Dejanos tu celular para seguir mirando. Si ya sos cliente, entrás directo."
                      : modo === "carrito"
                      ? `Para agregar ${productoPendiente ? `“${productoPendiente}”` : "productos"} al carrito dejanos tu celular. Se agrega solo al terminar.`
                      : "Dejanos tu celular y seguí tus pedidos. Sin contraseñas. Si ya sos cliente, entrás directo."}
                  </p>
                </div>
              )}

              <h2 id="titulo-registro" className="font-extrabold text-xl text-gray-800 leading-tight mb-3">
                {titulos[paso]}
              </h2>

              <form onSubmit={siguiente} noValidate>
                {paso === 1 && (
                  <>
                    <input
                      ref={campo}
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="input-field text-base tracking-wide"
                      placeholder="2944 123456"
                      aria-label="Celular"
                      inputMode="tel"
                      autoComplete="tel"
                      enterKeyHint="next"
                    />
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      Con característica, sin 0 ni 15. Lo usamos para coordinar la entrega y avisarte cómo va tu pedido.
                    </p>
                  </>
                )}

                {paso === 2 && (
                  <>
                    <input
                      ref={campo}
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="input-field text-base mb-3"
                      placeholder="Tu nombre y apellido"
                      aria-label="Nombre y apellido"
                      autoComplete="name"
                      enterKeyHint="done"
                    />
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
                        value={localidad}
                        onChange={(e) => setLocalidad(e.target.value)}
                        className="input-field text-base mt-3"
                        placeholder="Escribí tu localidad"
                        aria-label="Localidad"
                      />
                    )}
                    <p className="text-[11px] text-gray-600 mt-2">
                      Entregamos en El Bolsón y la Comarca Andina. Si no sabés, seguí igual.
                    </p>
                    <ConsentimientoRegistro
                      id="muro"
                      acepta={acepta}
                      setAcepta={setAcepta}
                      novedades={novedades}
                      setNovedades={setNovedades}
                    />
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
                    {enviando ? (paso === 1 ? "Revisando..." : "Creando tu cuenta...") : paso === 1 ? "Seguir" : "Crear mi cuenta"}
                  </button>
                </div>
              </form>

              {sePuedeCerrar && (
                <button
                  type="button"
                  onClick={cerrar}
                  className="w-full mt-3 py-2.5 text-sm font-semibold text-gray-700 underline underline-offset-2"
                >
                  Ahora no, seguir mirando
                </button>
              )}

              <p className="text-[11px] text-gray-600 text-center mt-2">
                Tu celular no se comparte con nadie. Solo lo usamos para coordinar tus pedidos.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
