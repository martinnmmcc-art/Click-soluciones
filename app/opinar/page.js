"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Estrellas from "@/components/Estrellas";
import { supabase } from "@/lib/supabaseClient";
import { avisarAdmin } from "@/lib/avisarAdmin";
import { ASPECTOS, TEXTO_ESTRELLAS, sesionCliente, marcarQueOpino } from "@/lib/opiniones";

// Pantalla para que el cliente opine sobre su compra y la tienda en general.
// Se llega desde: el aviso que aparece después de recibir un pedido, el botón
// "Opinar" en Mis pedidos, la sección de opiniones del inicio y Mi cuenta.
// Las opiniones quedan pendientes hasta que un admin las revisa y publica.

function FormularioOpinion() {
  const params = useSearchParams();
  const pedidoId = Number(params.get("pedido")) || null;

  const [estrellas, setEstrellas] = useState(Number(params.get("estrellas")) || 0);
  const [aspectos, setAspectos] = useState([]);
  const [texto, setTexto] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [logueado, setLogueado] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const s = sesionCliente();
    if (s?.telefono) {
      setLogueado(true);
      setNombre(s.nombre || "");
      setTelefono(s.telefono || "");
      setLocalidad(s.localidad || "");
    }
  }, []);

  function alternarAspecto(clave) {
    setAspectos((prev) => (prev.includes(clave) ? prev.filter((a) => a !== clave) : [...prev, clave]));
  }

  async function enviar() {
    setError("");
    if (!estrellas) return setError("Tocá las estrellas para puntuar.");
    if (!nombre.trim()) return setError("Poné tu nombre.");

    setEnviando(true);
    const { data, error: err } = await supabase.rpc("dejar_opinion_tienda", {
      p_nombre: nombre,
      p_telefono: telefono,
      p_estrellas: estrellas,
      p_texto: texto,
      p_aspectos: aspectos,
      p_pedido_id: pedidoId,
      p_localidad: localidad
    });
    setEnviando(false);

    const r = data?.[0];
    if (err || !r?.ok) {
      setError(
        r?.motivo === "MUCHAS"
          ? "Ya recibimos tus opiniones de hoy. ¡Gracias!"
          : "No se pudo enviar. Probá de nuevo en un rato."
      );
      return;
    }

    marcarQueOpino();
    avisarAdmin({
      tipo: "opinion_tienda",
      telefono,
      nombre,
      detalle: `${estrellas} estrella${estrellas > 1 ? "s" : ""}${texto ? `: "${texto.slice(0, 60)}"` : ""}`
    });
    setListo(true);
  }

  if (listo) {
    return (
      <div className="max-w-md mx-auto px-4 py-10 text-center">
        <p className="text-5xl mb-3">🙌</p>
        <h1 className="text-xl font-extrabold text-gray-800">¡Gracias por tu opinión!</h1>
        <p className="text-sm text-gray-600 mt-2">
          Nos ayuda un montón a mejorar y a que otros vecinos se animen a comprar.
          La vamos a revisar y publicar en la app.
        </p>
        <Link href="/" className="btn-primary inline-block mt-6 px-6">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <h1 className="text-xl font-extrabold text-gray-800">¿Cómo fue tu experiencia?</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">
        {pedidoId
          ? "Contanos qué te pareció tu compra: la atención, la entrega y la app."
          : "Contanos qué te pareció comprar en Bolson Click."}
      </p>

      {/* Estrellas */}
      <div className="card p-5 text-center mb-4">
        <Estrellas valor={estrellas} tamano="text-4xl" onElegir={setEstrellas} />
        <p className="text-sm font-bold text-gray-700 mt-2 h-5">{TEXTO_ESTRELLAS[estrellas] || ""}</p>
      </div>

      {/* Qué le gustó */}
      <div className="card p-4 mb-4">
        <p className="text-sm font-bold text-gray-800 mb-2">
          {estrellas && estrellas <= 3 ? "¿Qué podemos mejorar?" : "¿Qué fue lo mejor?"}{" "}
          <span className="font-normal text-gray-400">(opcional)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {ASPECTOS.map((a) => (
            <button
              key={a.clave}
              type="button"
              onClick={() => alternarAspecto(a.clave)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                aspectos.includes(a.clave)
                  ? "bg-brand-blue text-white border-brand-blue"
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {a.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {/* Comentario */}
      <div className="card p-4 mb-4">
        <label className="text-sm font-bold text-gray-800 block mb-2">
          Contanos un poco más <span className="font-normal text-gray-400">(opcional)</span>
        </label>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, 1000))}
          rows={4}
          className="input-field"
          placeholder="Ej: Me llegó rapidísimo y me explicaron todo por WhatsApp..."
        />
        <p className="text-[11px] text-gray-400 text-right mt-1">{texto.length}/1000</p>
      </div>

      {/* Datos (si no está logueado) */}
      <div className="card p-4 mb-4">
        {logueado ? (
          <p className="text-xs text-gray-500">
            Opinás como <b className="text-gray-700">{nombre}</b>. En la app se va a ver solo tu
            nombre y la inicial del apellido.
          </p>
        ) : (
          <>
            <label className="text-xs font-bold text-gray-700 block mb-1">Tu nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="input-field mb-3"
              placeholder="Ej: Angela Quilodrán"
            />
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Tu celular <span className="font-normal text-gray-400">(no se publica)</span>
            </label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              inputMode="tel"
              className="input-field mb-3"
              placeholder="2944 123456"
            />
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Localidad <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              value={localidad}
              onChange={(e) => setLocalidad(e.target.value)}
              className="input-field"
              placeholder="El Bolsón"
            />
            <p className="text-[11px] text-gray-400 mt-2">
              En la app se ve solo tu nombre y la inicial del apellido.
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4">{error}</div>
      )}

      <button onClick={enviar} disabled={enviando} className="btn-primary w-full disabled:opacity-50">
        {enviando ? "Enviando..." : "Enviar mi opinión"}
      </button>
    </div>
  );
}

export default function OpinarPage() {
  return (
    <main className="min-h-screen bg-brand-bg pb-24">
      <Header showSearch={false} />
      <Suspense fallback={<p className="text-center text-gray-400 py-10">Cargando...</p>}>
        <FormularioOpinion />
      </Suspense>
    </main>
  );
}
