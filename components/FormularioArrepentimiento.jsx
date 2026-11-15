"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { avisarAdmin, clienteActual } from "@/lib/avisarAdmin";

// Botón de arrepentimiento (Res. 424/2020 de la Secretaría de Comercio
// Interior): el cliente cancela la compra sin registrarse y recibe en el
// momento un código de identificación del trámite.

export default function FormularioArrepentimiento() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [pedido, setPedido] = useState("");
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [codigo, setCodigo] = useState("");

  // Si ya tiene cuenta, completamos lo que sabemos
  useEffect(() => {
    const c = clienteActual();
    if (c) {
      setNombre(c.nombre || "");
      setTelefono(c.telefono || "");
      setEmail(c.email || "");
    }
  }, []);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (nombre.trim().length < 2) return setError("Escribí tu nombre y apellido.");
    if (telefono.replace(/\D/g, "").length < 8) return setError("Escribí un celular válido para contactarte.");
    setEnviando(true);
    try {
      const { data, error: err } = await supabase.rpc("solicitar_arrepentimiento", {
        p_nombre: nombre.trim(),
        p_telefono: telefono,
        p_email: email.trim(),
        p_numero_pedido: pedido.trim(),
        p_detalle: detalle.trim()
      });
      if (err) throw err;
      setCodigo(data);
      avisarAdmin({
        tipo: "arrepentimiento",
        telefono: telefono.replace(/\D/g, ""),
        nombre: nombre.trim(),
        detalle: `${data}${pedido.trim() ? " · pedido " + pedido.trim() : ""}`
      });
    } catch (err) {
      const m = err?.message || "";
      setError(
        m.includes("DEMASIADAS")
          ? "Ya recibimos varias solicitudes de este celular hoy. Escribinos por WhatsApp."
          : "No se pudo enviar. Revisá la conexión y probá de nuevo, o escribinos por WhatsApp."
      );
    } finally {
      setEnviando(false);
    }
  }

  if (codigo) {
    return (
      <div className="bg-green-50 border border-green-300 rounded-xl p-4" role="status">
        <p className="font-bold text-green-900">✅ Recibimos tu pedido de cancelación</p>
        <p className="mt-2 text-sm text-green-900">Tu código de trámite es:</p>
        <p className="text-2xl font-black tracking-wider text-green-900 mt-1">{codigo}</p>
        <p className="mt-2 text-sm text-green-900">
          Guardalo (sacale captura). Te escribimos dentro de las 24 horas para coordinar el retiro del producto y la
          devolución del dinero.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-3" noValidate>
      <div>
        <label htmlFor="arr-nombre" className="text-sm font-semibold text-gray-800 block mb-1">
          Nombre y apellido *
        </label>
        <input id="arr-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="input-field" autoComplete="name" required />
      </div>
      <div>
        <label htmlFor="arr-tel" className="text-sm font-semibold text-gray-800 block mb-1">
          Celular *
        </label>
        <input id="arr-tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input-field" inputMode="tel" autoComplete="tel" required />
      </div>
      <div>
        <label htmlFor="arr-email" className="text-sm font-semibold text-gray-800 block mb-1">
          Correo (opcional)
        </label>
        <input id="arr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" autoComplete="email" />
      </div>
      <div>
        <label htmlFor="arr-pedido" className="text-sm font-semibold text-gray-800 block mb-1">
          Número de pedido (si lo tenés)
        </label>
        <input id="arr-pedido" value={pedido} onChange={(e) => setPedido(e.target.value)} className="input-field" />
      </div>
      <div>
        <label htmlFor="arr-detalle" className="text-sm font-semibold text-gray-800 block mb-1">
          ¿Qué querés cancelar? (opcional)
        </label>
        <textarea id="arr-detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)} className="input-field" rows={3} />
      </div>
      {error && (
        <p className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3" role="alert">
          {error}
        </p>
      )}
      <button disabled={enviando} className="btn-primary w-full">
        {enviando ? "Enviando..." : "Cancelar mi compra"}
      </button>
      <p className="text-xs text-gray-600">
        Usamos estos datos solo para gestionar la cancelación. No hace falta tener cuenta.
      </p>
    </form>
  );
}
