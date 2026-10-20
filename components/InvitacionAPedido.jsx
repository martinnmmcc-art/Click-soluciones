"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { urlImagen } from "@/lib/imagenProducto";

// Invitación a la sección "A pedido". Un botón que dice "¿No lo encontrás?"
// solo lo toca quien ya buscó y no encontró. Mostrar CUÁNTOS productos hay,
// fotos de algunos y un buscador ahí mismo despierta la curiosidad de todos:
// la mayoría no sabe que puede pedir miles de cosas más.
export default function InvitacionAPedido() {
  const router = useRouter();
  const [total, setTotal] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data, count } = await supabase
          .from("Productos")
          .select("id, nombre, imagen_url", { count: "exact" })
          .eq("bajo_pedido", true)
          .eq("activo", true)
          .not("imagen_url", "is", null)
          .order("orden_novedad", { ascending: false, nullsFirst: false })
          .limit(4);
        if (!vivo) return;
        setTotal(count || null);
        setFotos((data || []).filter((p) => p.imagen_url));
      } catch {}
    })();
    return () => {
      vivo = false;
    };
  }, []);

  function buscar(e) {
    e.preventDefault();
    const q = texto.trim();
    router.push(q ? `/a-pedido?q=${encodeURIComponent(q)}` : "/a-pedido");
  }

  const cantidad = total ? Number(total).toLocaleString("es-AR") : "miles de";

  return (
    <section className="max-w-md md:max-w-none mx-auto px-4 mt-6" aria-labelledby="titulo-a-pedido">
      <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-[#3B1C7A] via-[#5B2BB5] to-[#7C3AED] text-white shadow-lg shadow-purple-200 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 id="titulo-a-pedido" className="font-black text-[19px] leading-tight">
              Si no está acá, lo traemos
            </h2>
            <p className="text-[12.5px] text-purple-100 mt-1 leading-snug">
              Tenemos <b className="text-white">{cantidad} productos más</b> para pedir: tecnología,
              cocina, belleza, herramientas, juguetes y mucho más. Lo sumamos a nuestro próximo pedido.
            </p>
          </div>
        </div>

        {fotos.length > 0 && (
          <Link href="/a-pedido" className="flex items-center mt-3" aria-label="Ver productos a pedido">
            {fotos.map((f, i) => (
              <span
                key={f.id}
                className="w-14 h-14 rounded-2xl bg-white border-2 border-white/80 overflow-hidden shadow-md flex-shrink-0"
                style={{ marginLeft: i === 0 ? 0 : -10, transform: `rotate(${[-6, 3, -2, 5][i] || 0}deg)` }}
              >
                <img src={urlImagen(f.imagen_url)} alt="" className="w-full h-full object-contain" loading="lazy" />
              </span>
            ))}
            {total > fotos.length && (
              <span className="ml-2 text-[12px] font-bold text-purple-100 leading-tight">
                y {(total - fotos.length).toLocaleString("es-AR")}
                <br />
                más
              </span>
            )}
          </Link>
        )}

        <form onSubmit={buscar} className="mt-3 flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            type="search"
            enterKeyHint="search"
            placeholder="Probá: freidora, auriculares, termo..."
            className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F2C75C]"
            aria-label="Buscar entre los productos a pedido"
          />
          <button type="submit" className="bg-[#F2C75C] text-[#2B1660] font-extrabold text-sm px-3.5 rounded-xl active:scale-95 transition">
            Buscar
          </button>
        </form>

        <Link
          href="/a-pedido"
          className="mt-2.5 block text-center bg-white/10 hover:bg-white/15 border border-white/25 rounded-xl py-2.5 text-sm font-bold"
        >
          Ver todos los productos a pedido
        </Link>
      </div>
    </section>
  );
}
