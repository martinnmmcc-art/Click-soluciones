"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Control de notificaciones, pensado para que lo use cualquiera.
//
// Un botón grande, y cuando algo falla se explica en palabras qué hacer,
// sin códigos ni términos técnicos. La mayoría de los clientes de la app
// no son gente que vaya a revisar la configuración del navegador.

const ADMINS = {
  "maricelcanumir@gmail.com": { telefono: "2944396888", nombre: "Maricel" },
  "martinnm.mcc@gmail.com": { telefono: "2944636224", nombre: "Martin" },
  "patagoniavolt@gmail.com": { telefono: "2944906160", nombre: "Patagonia Volt" }
};

function soportado() {
  try {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  } catch (e) {
    return false;
  }
}

export default function ControlNotificaciones({ telefono, esAdmin = false }) {
  const [estado, setEstado] = useState("cargando");
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [telefonoReal, setTelefonoReal] = useState(telefono || "");
  const [nombreAdmin, setNombreAdmin] = useState("");
  const [estadoAdmins, setEstadoAdmins] = useState([]);

  // Con qué cuenta entró: cada admin registra su propio celular
  useEffect(() => {
    if (!esAdmin) {
      setTelefonoReal(telefono || "");
      return;
    }
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const admin = ADMINS[data?.session?.user?.email];
        if (admin) {
          setTelefonoReal(admin.telefono);
          setNombreAdmin(admin.nombre);
        }
      } catch (e) {}
    })();
  }, [esAdmin, telefono]);

  async function revisar() {
    if (!soportado()) {
      setEstado("no_soportado");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("bloqueado");
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (!sub) {
        setEstado("inactivas");
        return;
      }

      // Que exista en el navegador no alcanza: tiene que estar en nuestra
      // base, si no, no le llega nada.
      const res = await fetch("/api/estado-suscripcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint })
      });
      const d = await res.json();

      setEstado(d.registrada ? "activas" : "a_medias");
    } catch (e) {
      setEstado("inactivas");
    }
  }

  async function revisarAdmins() {
    if (!esAdmin) return;
    try {
      const { data } = await supabase
        .from("push_subscriptions")
        .select("telefono")
        .eq("es_admin", true);

      const registrados = new Set((data || []).map((s) => s.telefono));
      setEstadoAdmins(
        Object.values(ADMINS).map((a) => ({ ...a, activo: registrados.has(a.telefono) }))
      );
    } catch (e) {}
  }

  useEffect(() => {
    revisar();
    revisarAdmins();

    function alVolver() {
      if (document.visibilityState === "visible") revisar();
    }
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telefonoReal]);

  // Activación en un solo paso, con el motivo claro si algo falla
  async function activar() {
    setProcesando(true);
    setMensaje("");

    try {
      // 1. Revisamos que el servidor esté bien configurado
      const cfg = await (await fetch("/api/diagnostico-push")).json();
      if (!cfg.todo_bien) {
        setMensaje(
          "⚠️ Falta configurar algo en el servidor. Avisale a Martin:\n\n" +
            cfg.problemas.join("\n")
        );
        return;
      }

      // 2. Pedimos permiso
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "inactivas");
        setMensaje("No diste permiso. Sin eso no podemos avisarte nada.");
        return;
      }

      // 3. Registramos el celular
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const bytes = Uint8Array.from(
          atob((clave + "=".repeat((4 - (clave.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0)
        );

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes
        });
      }

      // 4. Lo guardamos
      const res = await fetch("/api/push/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub, telefono: telefonoReal })
      });
      const guardado = await res.json();

      if (!res.ok || guardado?.error) {
        setMensaje("No se pudo guardar: " + (guardado?.error || "error del servidor"));
        return;
      }

      setEstado("activas");
      setMensaje("✅ ¡Listo! Ya vas a recibir los avisos.");
      revisarAdmins();
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) {
      setMensaje("No se pudieron activar: " + e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function desactivar() {
    if (!confirm("¿Desactivar las notificaciones en este celular?")) return;

    setProcesando(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        await fetch("/api/push/suscribir", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }

      setEstado("inactivas");
      revisarAdmins();
    } catch (e) {
      setMensaje("No se pudo desactivar: " + e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function probar() {
    setProcesando(true);
    setMensaje("");
    try {
      const res = await fetch("/api/probar-notificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: telefonoReal })
      });
      const d = await res.json();

      setMensaje(
        d.enviadas > 0
          ? "✅ Enviada. Debería llegarte en unos segundos."
          : `No se pudo enviar.\n${d.errores?.join("\n") || ""}`
      );
    } catch (e) {
      setMensaje("Error en la prueba: " + e.message);
    } finally {
      setProcesando(false);
    }
  }

  if (estado === "cargando") return null;

  if (estado === "no_soportado") {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
        <p className="text-sm font-bold text-gray-700">🔕 Notificaciones</p>
        <p className="text-xs text-gray-500 mt-1">
          Este navegador no las permite. Probá desde Chrome en Android, o
          instalá la app desde el botón de abajo.
        </p>
      </div>
    );
  }

  if (estado === "bloqueado") {
    return (
      <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
        <p className="text-sm font-bold text-red-800">🔕 Están bloqueadas</p>
        <p className="text-xs text-red-700 mt-1">
          En algún momento se eligió &quot;Bloquear&quot; y el navegador ya no
          deja volver a preguntar desde acá.
        </p>
        <div className="bg-white rounded-xl p-3 mt-2">
          <p className="text-[11px] font-bold text-gray-700 mb-1">Para arreglarlo:</p>
          <p className="text-[11px] text-gray-600">
            1. Tocá el candado 🔒 al lado de la dirección, arriba
            <br />
            2. Entrá en Permisos o Configuración del sitio
            <br />
            3. En Notificaciones elegí Permitir
            <br />
            4. Volvé acá y recargá
          </p>
        </div>
      </div>
    );
  }

  const activas = estado === "activas";
  const aMedias = estado === "a_medias";

  return (
    <div
      className={`rounded-2xl p-4 border-2 ${
        activas
          ? "bg-green-50 border-green-300"
          : aMedias
          ? "bg-amber-50 border-amber-300"
          : "bg-white border-brand-blue/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">
            {activas
              ? "🔔 Notificaciones activas"
              : aMedias
              ? "⚠️ Quedaron a medias"
              : "🔕 Notificaciones apagadas"}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {aMedias
              ? "Tu celular dio el permiso pero no quedó registrado. Tocá el botón para completarlo."
              : esAdmin
              ? activas
                ? `Te avisamos de cada venta y cada pedido${nombreAdmin ? ` (celular de ${nombreAdmin})` : ""}.`
                : "Activalas para enterarte de cada venta apenas pasa."
              : activas
              ? "Te avisamos cuando avanza tu pedido y cuando llega mercadería nueva."
              : "Activalas para seguir tu pedido y enterarte de las novedades."}
          </p>
        </div>
        <span className="text-2xl flex-shrink-0">
          {activas ? "✅" : aMedias ? "⚠️" : "📵"}
        </span>
      </div>

      {mensaje && (
        <div className="bg-white border border-gray-200 rounded-xl p-2.5 mt-3">
          <p className="text-[11px] text-gray-700 whitespace-pre-line">{mensaje}</p>
        </div>
      )}

      {esAdmin && estadoAdmins.length > 0 && (
        <div className="bg-white/70 rounded-xl p-2.5 mt-3">
          <p className="text-[10px] font-bold text-gray-600 mb-1.5">
            Celulares del negocio
          </p>
          {estadoAdmins.map((a) => (
            <div key={a.telefono} className="flex justify-between items-center">
              <span className="text-[11px] text-gray-700">
                {a.nombre}
                <span className="text-gray-400"> · {a.telefono}</span>
              </span>
              <span
                className={`text-[10px] font-bold ${
                  a.activo ? "text-green-700" : "text-gray-400"
                }`}
              >
                {a.activo ? "✓ recibe" : "sin activar"}
              </span>
            </div>
          ))}
          <p className="text-[9px] text-gray-400 mt-1.5">
            Cada uno las activa desde su propio celular.
          </p>
        </div>
      )}

      <button
        onClick={activas ? desactivar : activar}
        disabled={procesando}
        className={`w-full text-sm font-bold py-3 rounded-xl mt-3 disabled:opacity-50 ${
          activas
            ? "bg-white border border-gray-300 text-gray-600"
            : "bg-brand-blue text-white"
        }`}
      >
        {procesando
          ? "Un momento..."
          : activas
          ? "Desactivar en este celular"
          : aMedias
          ? "Completar activación"
          : "Activar notificaciones"}
      </button>

      {activas && (
        <button
          onClick={probar}
          disabled={procesando}
          className="w-full text-[11px] font-bold text-brand-blue py-2 disabled:opacity-50"
        >
          🔔 Enviarme una de prueba
        </button>
      )}
    </div>
  );
}
