"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/lib/supabaseClient";
import { correoGuardado } from "@/lib/sesionGuardada";
import Link from "next/link";
import ControlNotificaciones from "@/components/ControlNotificaciones";
import { avisarAdmin } from "@/lib/avisarAdmin";

// Novedades: el link de baja. Un toque y listo, sin preguntas.
function PreferenciasCliente({ datos }) {
  const [novedades, setNovedades] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [pidiendoBorrar, setPidiendoBorrar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [borradoPedido, setBorradoPedido] = useState(false);

  useEffect(() => {
    if (!datos?.id || !datos?.telefono) return;
    supabase
      .rpc("estado_novedades", { p_cliente_id: datos.id, p_telefono: datos.telefono })
      .then(({ data }) => setNovedades(!!data))
      .catch(() => {});
  }, [datos]);

  async function cambiar(valor) {
    setGuardando(true);
    setAviso("");
    const { data, error } = await supabase.rpc("cambiar_novedades", {
      p_cliente_id: datos.id,
      p_telefono: datos.telefono,
      p_novedades: valor
    });
    setGuardando(false);
    if (error || !data) {
      setAviso("No se pudo guardar. Probá de nuevo o escribinos por WhatsApp.");
      return;
    }
    setNovedades(valor);
    setAviso(valor ? "Listo: te vamos a avisar las novedades." : "Listo: te diste de baja. No te mandamos más novedades.");
  }

  async function pedirBorrado() {
    setGuardando(true);
    setAviso("");
    const { error } = await supabase.rpc("solicitar_eliminacion_datos", {
      p_cliente_id: datos.id,
      p_telefono: datos.telefono,
      p_motivo: motivo
    });
    setGuardando(false);
    if (error) {
      setAviso("No se pudo enviar el pedido. Escribinos por WhatsApp y lo hacemos a mano.");
      return;
    }
    avisarAdmin({ tipo: "eliminar_datos", telefono: datos.telefono, nombre: datos.nombre });
    setBorradoPedido(true);
    setPidiendoBorrar(false);
  }

  return (
    <div className="space-y-3 border-t border-gray-100 pt-4">
      <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
        <p className="text-sm font-bold text-gray-800">📣 Novedades y ofertas</p>
        <p className="text-xs text-gray-700 mt-0.5">
          {novedades === null
            ? "Cargando…"
            : novedades
            ? "Estás suscripto. Podés darte de baja cuando quieras."
            : "No estás suscripto."}
        </p>
        {novedades !== null && (
          <button
            type="button"
            disabled={guardando}
            onClick={() => cambiar(!novedades)}
            className="mt-2 w-full py-2.5 rounded-xl border-2 border-gray-300 bg-white text-sm font-bold text-gray-800 disabled:opacity-50"
          >
            {novedades ? "Darme de baja de las novedades" : "Quiero recibir novedades"}
          </button>
        )}
      </div>

      <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
        <p className="text-sm font-bold text-gray-800 mb-1">🔔 Notificaciones en este celular</p>
        <ControlNotificaciones telefono={datos?.telefono} />
      </div>

      <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
        <p className="text-sm font-bold text-gray-800">🗑️ Eliminar mi cuenta y mis datos</p>
        {borradoPedido ? (
          <p className="text-xs text-gray-800 mt-1" role="status">
            Recibimos tu pedido. Borramos tus datos dentro de los 5 días hábiles y te avisamos por WhatsApp. Tus pedidos
            anteriores quedan guardados sin tu nombre ni tu celular, porque la ley nos obliga a conservar las ventas.
          </p>
        ) : pidiendoBorrar ? (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-gray-800">
              Se borran tu cuenta, favoritos y avisos. Si tenés un pedido sin entregar o sin pagar, primero lo
              cerramos. No se puede deshacer.
            </p>
            <label htmlFor="motivo-borrar" className="text-xs font-semibold text-gray-800 block">
              ¿Nos contás por qué? (opcional)
            </label>
            <textarea
              id="motivo-borrar"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              className="input-field text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPidiendoBorrar(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={pedirBorrado}
                className="flex-1 py-2.5 rounded-xl bg-red-700 text-white text-sm font-bold disabled:opacity-50"
              >
                {guardando ? "Enviando..." : "Sí, borrar mis datos"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPidiendoBorrar(true)}
            className="mt-2 w-full py-2.5 rounded-xl border-2 border-red-300 bg-white text-sm font-bold text-red-700"
          >
            Eliminar mi cuenta y mis datos
          </button>
        )}
      </div>

      {aviso && (
        <p className="text-xs bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-2.5" role="status">
          {aviso}
        </p>
      )}
    </div>
  );
}

export default function CuentaPage() {
  const [tipoUsuario, setTipoUsuario] = useState(null); // 'admin' o 'cliente'
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      // 1. Verificamos si entró como cliente por celular en localStorage
      const clienteSesion = localStorage.getItem("cliente_sesion");
      if (clienteSesion) {
        setTipoUsuario("cliente");
        setDatos(JSON.parse(clienteSesion));
        setLoading(false);
        return;
      }

      // 2. Si no es cliente local, verificamos si es admin en Supabase
      // Sin señal la sesión no se puede renovar y Supabase dice "no hay
      // sesión": se usa la guardada en el celular antes de mandar a login.
      const correo = correoGuardado();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setTipoUsuario("admin");
          setDatos(session.user);
        } else if (correo) {
          setTipoUsuario("admin");
          setDatos({ email: correo });
        } else {
          router.replace("/login");
        }
      }).catch(() => {
        if (correo) {
          setTipoUsuario("admin");
          setDatos({ email: correo });
        } else {
          router.replace("/login");
        }
      }).finally(() => {
        setLoading(false);
      });
    } catch (e) {
      console.error("Error al leer sesión:", e);
      setLoading(false);
    }
  }, [router]);

  function cerrarSesion() {
    try {
      localStorage.removeItem("cliente_sesion");
      localStorage.removeItem("carrito");
      supabase.auth.signOut();
    } catch (e) {
      console.error("Error al cerrar sesión:", e);
    }
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pb-28">
        <Header showSearch={false} />
        <div className="text-center py-20 text-gray-500 font-medium text-xs">Cargando perfil...</div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <Header showSearch={false} />

      <div className="max-w-md mx-auto px-4 mt-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="w-12 h-12 bg-brand-blue/10 rounded-full flex items-center justify-center text-brand-blue text-xl font-bold">
              {tipoUsuario === "admin" ? "🛡️" : "📱"}
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">
                {tipoUsuario === "admin" ? "Panel de Administrador" : "Mi Cuenta"}
              </h2>
              <p className="text-xs text-gray-500">
                {tipoUsuario === "admin" ? "Sesión oficial de Supabase" : "Acceso por número de celular"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">Identificador de sesión:</p>
            <p className="text-sm font-bold text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-100 break-all">
              {tipoUsuario === "admin" ? datos?.email : (datos?.telefono || datos?.phone || "Usuario Conectado")}
            </p>
          </div>

          {tipoUsuario === "cliente" && (
            <Link
              href="/opinar"
              className="flex items-center justify-between w-full bg-amber-50 border border-amber-300 rounded-xl p-3"
            >
              <span>
                <span className="block text-sm font-bold text-amber-800">⭐ Opiná sobre Bolson Click</span>
                <span className="block text-[11px] text-amber-700">
                  Contanos cómo fue tu compra, la atención y la app
                </span>
              </span>
              <span className="text-amber-700 font-bold">›</span>
            </Link>
          )}

          {tipoUsuario === "cliente" && <PreferenciasCliente datos={datos} />}

          <button
            onClick={cerrarSesion}
            className="w-full bg-red-50 text-red-600 border border-red-100 text-xs font-bold py-3 rounded-xl hover:bg-red-100 active:scale-95 transition mt-4"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
