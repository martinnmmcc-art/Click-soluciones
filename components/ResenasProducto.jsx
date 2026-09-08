"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { avisarAdmin } from "@/lib/avisarAdmin";

// Reseñas de clientes.
//
// Por qué importan más acá que en una tienda grande: en una compra de
// $20.000 a alguien que no conocés, ver que un vecino de El Bolsón lo
// compró y quedó conforme es lo que destraba la decisión. Es la ventaja
// que tenés sobre comprar a ciegas en una plataforma.
//
// Solo puede opinar quien realmente compró el producto. Una reseña
// inventada se nota enseguida en un pueblo y arruina todas las demás.

function Estrellas({ cantidad, tamano = "text-base", onClick = null }) {
  return (
    <span className={tamano}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={onClick ? () => onClick(n) : undefined}
          className={`${onClick ? "cursor-pointer" : ""} ${
            n <= cantidad ? "text-amber-400" : "text-gray-300"
          }`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default function ResenasProducto({ productoId, nombreProducto = "" }) {
  const [resenas, setResenas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [puedeOpinar, setPuedeOpinar] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [estrellas, setEstrellas] = useState(5);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    const [{ data: lista }, { data: res }] = await Promise.all([
      supabase
        .from("resenas")
        .select("*")
        .eq("producto_id", productoId)
        .eq("aprobada", true)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.rpc("resumen_resenas", { p_producto_id: productoId })
    ]);

    setResenas(lista || []);
    setResumen(res?.[0] || null);

    // ¿Este cliente compró el producto y todavía no opinó?
    try {
      const s = localStorage.getItem("cliente_sesion");
      if (!s) return;
      const tel = JSON.parse(s)?.telefono;
      if (!tel) return;

      const { data: pendientes } = await supabase.rpc("productos_para_resenar", {
        p_telefono: tel
      });

      setPuedeOpinar(
        (pendientes || []).some((p) => Number(p.producto_id) === Number(productoId))
      );
    } catch (e) {}
  }

  useEffect(() => {
    if (productoId) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId]);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setMensaje("");

    try {
      const tel = JSON.parse(localStorage.getItem("cliente_sesion") || "{}")?.telefono;

      const { data, error } = await supabase.rpc("dejar_resena", {
        p_telefono: tel,
        p_producto_id: productoId,
        p_estrellas: estrellas,
        p_comentario: comentario
      });

      const r = data?.[0];

      if (error || !r?.ok) {
        setMensaje(
          r?.motivo === "NO_LO_COMPRO"
            ? "Solo pueden opinar quienes compraron este producto."
            : "No se pudo guardar tu opinión. Probá de nuevo."
        );
        return;
      }

      // Le avisamos al negocio que hay una opinión esperando aprobación
      try {
        const sesion = JSON.parse(localStorage.getItem("cliente_sesion") || "{}");
        avisarAdmin({
          tipo: "resena",
          telefono: sesion.telefono,
          nombre: sesion.nombre,
          detalle: nombreProducto || `producto #${productoId}`
        });
      } catch (err) {}

      setMensaje(
        "✅ ¡Gracias! Tu opinión va a aparecer en cuanto la revisemos."
      );
      setComentario("");
      setEscribiendo(false);
      setPuedeOpinar(false);
      cargar();
    } finally {
      setEnviando(false);
    }
  }

  const cantidad = Number(resumen?.cantidad || 0);
  const promedio = Number(resumen?.promedio || 0);

  // Si no hay reseñas ni puede opinar, no mostramos una sección vacía
  if (cantidad === 0 && !puedeOpinar) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 mt-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-sm text-gray-800">
            {cantidad > 0 ? "Qué dicen los que lo compraron" : "Opiná sobre este producto"}
          </p>

          {cantidad > 0 && (
            <div className="text-right">
              <Estrellas cantidad={Math.round(promedio)} tamano="text-sm" />
              <p className="text-[10px] text-gray-500">
                {promedio} · {cantidad} opinión{cantidad === 1 ? "" : "es"}
              </p>
            </div>
          )}
        </div>

        {puedeOpinar && !escribiendo && (
          <button
            onClick={() => setEscribiendo(true)}
            className="w-full bg-brand-blue text-white text-xs font-bold py-2.5 rounded-xl mb-3"
          >
            ⭐ Contá qué te pareció
          </button>
        )}

        {escribiendo && (
          <form onSubmit={enviar} className="bg-blue-50/60 rounded-xl p-3 mb-3">
            <p className="text-xs font-bold text-gray-700 mb-2">
              ¿Cuántas estrellas le ponés?
            </p>
            <Estrellas cantidad={estrellas} tamano="text-3xl" onClick={setEstrellas} />

            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              maxLength={400}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mt-3"
              placeholder="¿Qué tal salió? Contale a otros vecinos si lo recomendás."
            />

            <div className="flex gap-2 mt-2">
              <button
                disabled={enviando}
                className="flex-1 bg-brand-blue text-white text-xs font-bold py-2 rounded-xl disabled:opacity-50"
              >
                {enviando ? "Guardando..." : "Publicar"}
              </button>
              <button
                type="button"
                onClick={() => setEscribiendo(false)}
                className="px-3 text-xs font-semibold text-gray-500"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {mensaje && (
          <p className="text-xs text-center text-green-700 font-semibold mb-3">
            {mensaje}
          </p>
        )}

        <div className="space-y-3">
          {resenas.map((r) => (
            <div key={r.id} className="border-b border-gray-50 pb-3 last:border-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-800">
                    {r.nombre}
                    {r.localidad && (
                      <span className="font-normal text-gray-400"> · {r.localidad}</span>
                    )}
                  </p>
                  <Estrellas cantidad={r.estrellas} tamano="text-xs" />
                </div>
                <span className="text-[10px] text-gray-400">
                  {new Date(r.created_at).toLocaleDateString("es-AR")}
                </span>
              </div>

              {r.comentario && (
                <p className="text-xs text-gray-600 mt-1 leading-snug">{r.comentario}</p>
              )}

              <p className="text-[10px] text-green-700 font-semibold mt-1">
                ✓ Compra verificada
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
