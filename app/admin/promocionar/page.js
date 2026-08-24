"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";
import { generarPlaca, generarTextoPromo } from "@/lib/generadorPromo";

const ETIQUETAS = [
  { id: "NOVEDAD", label: "🆕 Novedad" },
  { id: "OFERTA", label: "🔥 Oferta" },
  { id: "REPOSICION", label: "✅ Volvió" },
  { id: "ULTIMAS", label: "⏰ Últimas" }
];

function Promocionar() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState(null);
  const [etiqueta, setEtiqueta] = useState("NOVEDAD");
  const [generando, setGenerando] = useState(false);
  const [placa, setPlaca] = useState(null);
  const [textoPromo, setTextoPromo] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function cargar() {
      // Solo tus productos: son los que podés entregar y los que conviene
      // promocionar. Lo ordenamos por lo último que entró.
      const { data } = await supabase
        .from("Productos")
        .select("id, nombre, precio, precio_oferta, imagen_url, stock, bajo_pedido, descripcion, fecha_ingreso")
        .or("bajo_pedido.is.null,bajo_pedido.eq.false")
        .eq("activo", true)
        .not("imagen_url", "is", null)
        .order("fecha_ingreso", { ascending: false, nullsFirst: false })
        .limit(80);

      setProductos(data || []);
      setLoading(false);
    }
    cargar();
  }, []);

  async function generar(producto) {
    setGenerando(true);
    setPlaca(null);
    setElegido(producto);

    try {
      const blob = await generarPlaca(producto, { etiqueta });
      setPlaca(blob);
      setTextoPromo(generarTextoPromo(producto, { etiqueta }));
    } catch (e) {
      alert("No se pudo armar la promoción: " + e.message);
    } finally {
      setGenerando(false);
    }
  }

  // Comparte imagen y texto juntos: en el celular abre el menú de compartir
  // y con un toque va directo al estado de WhatsApp.
  async function compartir() {
    if (!placa) return;

    const archivo = new File([placa], `bolsonclick-${Date.now()}.jpg`, {
      type: "image/jpeg"
    });

    try {
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        await navigator.share({
          files: [archivo],
          text: textoPromo
        });
        return;
      }
    } catch (e) {
      // Si cancela el menú de compartir, no es un error
      if (e.name === "AbortError") return;
    }

    // Si el celular no permite compartir archivos, la descargamos
    descargar();
  }

  function descargar() {
    if (!placa) return;
    const url = URL.createObjectURL(placa);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bolsonclick-${elegido?.id || "promo"}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(textoPromo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      alert("No se pudo copiar. Seleccionalo a mano.");
    }
  }

  const filtrados = productos.filter(
    (p) => !busqueda.trim() || p.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">
          Promocionar producto
        </h1>
        <p className="text-xs text-gray-500 mb-4">
          Armá la placa lista para subir a tu estado de WhatsApp, Instagram o Facebook.
        </p>

        {/* RESULTADO */}
        {placa && elegido && (
          <div className="bg-white rounded-2xl border-2 border-brand-blue p-4 mb-5">
            <p className="text-xs font-bold text-gray-500 uppercase mb-3">
              Lista para publicar
            </p>

            <img
              src={URL.createObjectURL(placa)}
              alt="Promoción"
              className="w-full max-w-[240px] mx-auto rounded-xl shadow-md mb-3"
            />

            <button
              onClick={compartir}
              className="w-full bg-[#25D366] text-white text-sm font-bold py-3 rounded-xl mb-2"
            >
              📲 Compartir en WhatsApp / Redes
            </button>

            <div className="flex gap-2">
              <button
                onClick={descargar}
                className="flex-1 bg-white border border-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl"
              >
                ⬇️ Descargar imagen
              </button>
              <button
                onClick={copiarTexto}
                className="flex-1 bg-white border border-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl"
              >
                {copiado ? "✓ Copiado" : "📋 Copiar texto"}
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mt-3">
              <p className="text-[11px] text-gray-600 whitespace-pre-line leading-relaxed">
                {textoPromo}
              </p>
            </div>

            <p className="text-[10px] text-gray-400 mt-3">
              En WhatsApp: tocá &quot;Compartir&quot; → Estado. La imagen ya lleva
              tu teléfono y la página, así que sirve igual si alguien la reenvía.
            </p>

            <button
              onClick={() => {
                setPlaca(null);
                setElegido(null);
              }}
              className="w-full text-xs font-semibold text-gray-500 mt-3"
            >
              Armar otra
            </button>
          </div>
        )}

        {!placa && (
          <>
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">
              1. Elegí el tipo de aviso
            </p>
            <div className="flex gap-2 overflow-x-auto pb-3">
              {ETIQUETAS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setEtiqueta(e.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                    etiqueta === e.id
                      ? "bg-brand-blue text-white"
                      : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase mb-2 mt-3">
              2. Elegí el producto
            </p>

            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 mb-3"
              placeholder="Buscar producto..."
            />

            {loading ? (
              <p className="text-center text-gray-400 py-8 text-sm">Cargando...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filtrados.map((p) => {
                  const enOferta =
                    p.precio_oferta && Number(p.precio_oferta) < Number(p.precio);
                  return (
                    <button
                      key={p.id}
                      onClick={() => generar(p)}
                      disabled={generando}
                      className="bg-white rounded-2xl border border-gray-100 p-2 text-left disabled:opacity-50"
                    >
                      <img
                        src={p.imagen_url}
                        alt=""
                        className="w-full h-24 object-cover rounded-xl mb-1.5 bg-gray-50"
                      />
                      <p className="text-[11px] font-semibold text-gray-800 line-clamp-2 leading-tight">
                        {p.nombre}
                      </p>
                      <p className="text-xs font-extrabold text-brand-blue mt-0.5">
                        ${formatPrice(enOferta ? p.precio_oferta : p.precio)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {Number(p.stock || 0) > 0 ? `Stock: ${p.stock}` : "Sin stock"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {generando && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-5 text-center">
                  <p className="text-sm font-bold text-gray-800">Armando la placa...</p>
                  <p className="text-xs text-gray-500 mt-1">Un segundito</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function PromocionarPage() {
  return (
    <AdminGuard>
      <Promocionar />
    </AdminGuard>
  );
}
