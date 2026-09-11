"use client";

import { useEffect, useState } from "react";
import { pushSoportado, suscribirPush, estaSuscripto } from "@/lib/push";
import { supabase } from "@/lib/supabaseClient";

// Control para prender y apagar las notificaciones.
//
// Muestra siempre el estado real, porque el permiso vive en el navegador y
// no en nuestra base: alguien puede haberlas bloqueado desde la
// configuración del celular y hay que decírselo, no dejarlo pensando que
// están activas.
export default function ControlNotificaciones({ telefono, esAdmin = false }) {
  const [estado, setEstado] = useState("cargando");
  const [procesando, setProcesando] = useState(false);
  const [probando, setProbando] = useState(false);

  // Envía una notificación de prueba y cuenta qué pasó en cada paso.
  // Sin esto, cuando algo falla no hay forma de saber dónde.
  async function probar() {
    setProbando(true);
    try {
      const res = await fetch("/api/probar-notificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono })
      });
      const d = await res.json();

      let msg = "";

      if (!d.claves_configuradas) {
        msg = "❌ Faltan las claves de notificaciones en el servidor.";
      } else if (d.suscripciones_encontradas === 0) {
        msg =
          "❌ Este celular no está registrado.\n\n" +
          "Desactivá las notificaciones y volvé a activarlas.";
      } else if (d.enviadas > 0) {
        msg =
          `✅ Enviada a ${d.enviadas} dispositivo(s).\n\n` +
          (d.marcado_admin
            ? "Este celular está marcado como administrador, así que vas a recibir cada venta y cada carrito."
            : "⚠️ Pero NO figura como administrador: no vas a recibir los avisos de ventas.") +
          "\n\nSi no te llegó nada en unos segundos, revisá que las notificaciones de la app estén permitidas en la configuración del celular.";
      } else {
        msg = `❌ No se pudo enviar.\n\n${d.errores.join("\n")}`;
      }

      alert(msg);
    } catch (e) {
      alert("No se pudo hacer la prueba: " + e.message);
    } finally {
      setProbando(false);
    }
  }

  async function revisar() {
    if (!pushSoportado()) {
      setEstado("no_soportado");
      return;
    }

    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setEstado("bloqueado");
      return;
    }

    const suscripto = await estaSuscripto();
    setEstado(suscripto ? "activas" : "inactivas");
  }

  useEffect(() => {
    revisar();

    // Si el usuario cambia el permiso desde la configuración del celular,
    // lo detectamos al volver a la app.
    function alVolver() {
      if (document.visibilityState === "visible") revisar();
    }
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function activar() {
    setProcesando(true);
    try {
      const res = await suscribirPush(telefono);
      await revisar();

      // Confirmamos qué quedó guardado: antes fallaba en silencio y no
      // había forma de saber si el registro se había hecho.
      if (res?.ok) {
        if (esAdmin && res.es_admin === false) {
          alert(
            "Las notificaciones quedaron activas, pero este celular no se " +
              "registró como administrador.\n\nRevisá que el teléfono del panel " +
              "sea uno de los del negocio."
          );
        }
      } else if (res?.error) {
        alert("No se pudieron activar: " + res.error);
      }
    } finally {
      setProcesando(false);
    }
  }

  async function desactivar() {
    if (!confirm("¿Desactivar las notificaciones?\n\nNo vas a recibir más avisos en este celular."))
      return;

    setProcesando(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        // Primero la sacamos de nuestra base, después del navegador
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);

        await sub.unsubscribe();
      }

      await revisar();
    } catch (e) {
      alert("No se pudo desactivar: " + e.message);
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
          instalá la app en la pantalla de inicio.
        </p>
      </div>
    );
  }

  if (estado === "bloqueado") {
    return (
      <div className="bg-red-50 border border-red-300 rounded-2xl p-4">
        <p className="text-sm font-bold text-red-800">🔕 Notificaciones bloqueadas</p>
        <p className="text-xs text-red-700 mt-1">
          Las bloqueaste en su momento y el navegador no deja volver a
          preguntar desde acá.
        </p>
        <div className="bg-white rounded-xl p-2.5 mt-2">
          <p className="text-[11px] text-gray-700 font-semibold mb-1">
            Para reactivarlas:
          </p>
          <p className="text-[11px] text-gray-600">
            Tocá el candado 🔒 al lado de la dirección, arriba de la pantalla →
            Permisos → Notificaciones → Permitir. Después recargá.
          </p>
        </div>
      </div>
    );
  }

  const activas = estado === "activas";

  return (
    <div
      className={`rounded-2xl p-4 border-2 ${
        activas ? "bg-green-50 border-green-300" : "bg-white border-brand-blue/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">
            {activas ? "🔔 Notificaciones activas" : "🔕 Notificaciones apagadas"}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {esAdmin
              ? activas
                ? "Te avisamos de cada venta, pedido y comprobante al instante."
                : "Activalas para enterarte de cada venta apenas pasa, sin tener que entrar."
              : activas
              ? "Te avisamos cuando avanza tu pedido y cuando llega mercadería nueva."
              : "Activalas para seguir tu pedido y enterarte de las novedades."}
          </p>
        </div>

        <span className="text-2xl flex-shrink-0">{activas ? "✅" : "📵"}</span>
      </div>

      <button
        onClick={activas ? desactivar : activar}
        disabled={procesando}
        className={`w-full text-xs font-bold py-2.5 rounded-xl mt-3 disabled:opacity-50 ${
          activas
            ? "bg-white border border-gray-300 text-gray-600"
            : "bg-brand-blue text-white"
        }`}
      >
        {procesando
          ? "Un momento..."
          : activas
          ? "Desactivar en este celular"
          : "Activar notificaciones"}
      </button>

      {activas && (
        <button
          onClick={probar}
          disabled={probando}
          className="w-full text-[11px] font-bold text-brand-blue py-2 disabled:opacity-50"
        >
          {probando ? "Probando..." : "🔔 Enviarme una notificación de prueba"}
        </button>
      )}

      {!activas && (
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          Podés desactivarlas cuando quieras desde acá mismo.
        </p>
      )}
    </div>
  );
}
