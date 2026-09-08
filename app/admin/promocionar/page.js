"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";
import {
  generarPlaca,
  textoWhatsApp,
  textoFacebook,
  generarPlacaMultiple,
  textoMultiple
} from "@/lib/generadorPromo";

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
  const [soloOfertas, setSoloOfertas] = useState(false);
  const [elegido, setElegido] = useState(null);
  const [etiqueta, setEtiqueta] = useState("NOVEDAD");
  const [generando, setGenerando] = useState(false);
  const [placa, setPlaca] = useState(null);
  const [textoPromo, setTextoPromo] = useState("");
  const [textoFb, setTextoFb] = useState("");
  const [red, setRed] = useState("whatsapp");
  const [modo, setModo] = useState("uno"); // uno | varios
  const [varios, setVarios] = useState([]);
  const [yaPromocionados, setYaPromocionados] = useState({});

  // Qué productos ya publicaste en las últimas 2 semanas, para no repetir
  useEffect(() => {
    async function cargarPromos() {
      const { data } = await supabase.rpc("productos_ya_promocionados", {
        p_dias: 14
      });
      const mapa = {};
      (data || []).forEach((r) => {
        mapa[r.producto_id] = {
          veces: r.veces,
          ultima: r.ultima,
          canales: r.canales
        };
      });
      setYaPromocionados(mapa);
    }
    cargarPromos();
  }, []);

  // Guardamos la promoción para saber qué se publicó y medir después
  async function registrarPromo(canal, productos, tipo) {
    try {
      await supabase.from("promociones").insert({
        canal,
        tipo,
        etiqueta,
        producto_ids: productos.map((p) => p.id),
        productos: productos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          precio: p.precio,
          precio_oferta: p.precio_oferta
        }))
      });
      // Refrescamos para que se vea el aviso enseguida
      const { data } = await supabase.rpc("productos_ya_promocionados", { p_dias: 14 });
      const mapa = {};
      (data || []).forEach((r) => {
        mapa[r.producto_id] = { veces: r.veces, ultima: r.ultima, canales: r.canales };
      });
      setYaPromocionados(mapa);
    } catch (e) {}
  }

  function alternarVarios(p) {
    setVarios((prev) =>
      prev.some((x) => x.id === p.id)
        ? prev.filter((x) => x.id !== p.id)
        : prev.length >= 4
        ? prev
        : [...prev, p]
    );
  }

  // Arma una sola imagen con hasta 4 productos, para publicar en Facebook
  // sin saturar el muro con una publicación por producto.
  async function generarVarios() {
    if (varios.length === 0) return;

    setGenerando(true);
    setPlaca(null);

    try {
      const tituloPlaca =
        etiqueta === "OFERTA"
          ? "OFERTAS"
          : etiqueta === "NOVEDAD"
          ? "RECIÉN LLEGADO"
          : etiqueta === "ULTIMAS"
          ? "ÚLTIMAS UNIDADES"
          : "DESTACADOS";

      const blob = await generarPlacaMultiple(varios, {
        titulo: tituloPlaca,
        formato: red === "facebook" ? "facebook" : "whatsapp"
      });
      setPlaca(blob);
      setElegido({ nombre: `${varios.length} productos`, id: "multiple" });

      const texto = textoMultiple(varios, { titulo: tituloPlaca });
      setTextoPromo(texto);
      setTextoFb(texto);
    } catch (e) {
      alert("No se pudo armar la placa: " + e.message);
    } finally {
      setGenerando(false);
    }
  }
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
      setTextoPromo(textoWhatsApp(producto, { etiqueta }));
      setTextoFb(textoFacebook(producto, { etiqueta }));
    } catch (e) {
      alert("No se pudo armar la promoción: " + e.message);
    } finally {
      setGenerando(false);
    }
  }

  // Comparte imagen y texto juntos: en el celular abre el menú de compartir
  // y con un toque va directo al estado de WhatsApp.
  async function compartir(cual = "whatsapp") {
    if (!placa) return;

    registrarPromo(cual, modo === "varios" ? varios : [elegido], modo === "varios" ? "multiple" : "individual");

    const texto = cual === "facebook" ? textoFb : textoPromo;
    const archivo = new File([placa], `bolsonclick-${Date.now()}.jpg`, {
      type: "image/jpeg"
    });

    try {
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        await navigator.share({ files: [archivo], text: texto });
        return;
      }
    } catch (e) {
      if (e.name === "AbortError") return;
    }

    descargar();
  }

  // Para Facebook conviene copiar el texto primero: la app no siempre
  // acepta imagen y texto juntos desde el menú de compartir.
  async function prepararFacebook() {
    registrarPromo("facebook", modo === "varios" ? varios : [elegido], modo === "varios" ? "multiple" : "individual");

    try {
      await navigator.clipboard.writeText(textoFb);
    } catch (e) {}
    descargar();
    alert(
      "✓ Texto copiado y foto descargada.\n\n" +
        "Abrí Facebook, creá una publicación, subí la foto y pegá el texto."
    );
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

  async function copiarTexto(texto) {
    try {
      await navigator.clipboard.writeText(texto || textoPromo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      alert("No se pudo copiar. Seleccionalo a mano.");
    }
  }

  const filtrados = productos.filter((p) => {
    if (busqueda.trim() && !p.nombre?.toLowerCase().includes(busqueda.toLowerCase()))
      return false;
    if (soloOfertas) {
      return p.precio_oferta && Number(p.precio_oferta) < Number(p.precio);
    }
    return true;
  });

  const cuantasOfertas = productos.filter(
    (p) => p.precio_oferta && Number(p.precio_oferta) < Number(p.precio)
  ).length;

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

            {/* Cada red tiene su propio texto: en un estado de WhatsApp la
                gente lee 3 segundos; en Facebook lee más y las etiquetas
                locales hacen que te encuentren vecinos. */}
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setRed("whatsapp")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold ${
                  red === "whatsapp"
                    ? "bg-[#25D366] text-white"
                    : "bg-white border border-gray-200 text-gray-600"
                }`}
              >
                💬 WhatsApp
              </button>
              <button
                onClick={() => setRed("facebook")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold ${
                  red === "facebook"
                    ? "bg-[#1877F2] text-white"
                    : "bg-white border border-gray-200 text-gray-600"
                }`}
              >
                📘 Facebook
              </button>
            </div>

            {red === "whatsapp" ? (
              <button
                onClick={() => compartir("whatsapp")}
                className="w-full bg-[#25D366] text-white text-sm font-bold py-3 rounded-xl mb-2"
              >
                📲 Compartir en Estado de WhatsApp
              </button>
            ) : (
              <button
                onClick={prepararFacebook}
                className="w-full bg-[#1877F2] text-white text-sm font-bold py-3 rounded-xl mb-2"
              >
                📘 Preparar para Facebook
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={descargar}
                className="flex-1 bg-white border border-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl"
              >
                ⬇️ Descargar imagen
              </button>
              <button
                onClick={() => copiarTexto(red === "facebook" ? textoFb : textoPromo)}
                className="flex-1 bg-white border border-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl"
              >
                {copiado ? "✓ Copiado" : "📋 Copiar texto"}
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mt-3">
              <p className="text-[11px] text-gray-600 whitespace-pre-line leading-relaxed">
                {red === "facebook" ? textoFb : textoPromo}
              </p>
            </div>

            <p className="text-[10px] text-gray-400 mt-3">
              {red === "whatsapp"
                ? 'Tocá "Compartir" → Estado. La imagen lleva tu teléfono y la página, así que sirve igual si alguien la reenvía.'
                : "Se copia el texto y se descarga la foto. Abrí Facebook, creá la publicación, subí la foto y pegá el texto."}
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
            {/* Una publicación con varios productos rinde más en Facebook
                que varias seguidas: no satura el muro y muestra surtido. */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => {
                  setModo("uno");
                  setVarios([]);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${
                  modo === "uno"
                    ? "bg-brand-blue text-white"
                    : "bg-white border border-gray-200 text-gray-600"
                }`}
              >
                📄 Un producto
              </button>
              <button
                onClick={() => setModo("varios")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${
                  modo === "varios"
                    ? "bg-brand-blue text-white"
                    : "bg-white border border-gray-200 text-gray-600"
                }`}
              >
                🖼️ Varios juntos
              </button>
            </div>

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
              {modo === "varios"
                ? `2. Elegí hasta 4 productos (${varios.length}/4)`
                : "2. Elegí el producto"}
            </p>

            {modo === "varios" && varios.length > 0 && (
              <div className="bg-blue-50 border border-brand-blue/40 rounded-xl p-3 mb-3">
                <p className="text-[11px] font-bold text-gray-700 mb-1.5">
                  Van a salir en la imagen:
                </p>
                {varios.map((p, i) => (
                  <p key={p.id} className="text-[11px] text-gray-600">
                    {i + 1}. {p.nombre}
                  </p>
                ))}

                {varios.some((p) => yaPromocionados[p.id]) && (
                  <p className="text-[10px] text-amber-800 bg-amber-50 rounded-lg p-2 mt-2">
                    ⚠️ Algunos de estos ya los publicaste hace poco. Repetir en
                    la misma semana cansa a tus seguidores y Facebook les baja
                    el alcance.
                  </p>
                )}

                <button
                  onClick={generarVarios}
                  disabled={generando}
                  className="w-full bg-brand-blue text-white text-xs font-bold py-2.5 rounded-xl mt-2 disabled:opacity-50"
                >
                  {generando ? "Armando..." : `Armar placa con ${varios.length}`}
                </button>
              </div>
            )}

            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 mb-3"
              placeholder="Buscar producto..."
            />

            {cuantasOfertas > 0 && (
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSoloOfertas(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold ${
                    !soloOfertas
                      ? "bg-gray-800 text-white"
                      : "bg-white border border-gray-200 text-gray-600"
                  }`}
                >
                  Todos ({productos.length})
                </button>
                <button
                  onClick={() => setSoloOfertas(true)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold ${
                    soloOfertas
                      ? "bg-red-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600"
                  }`}
                >
                  🏷️ En oferta ({cuantasOfertas})
                </button>
              </div>
            )}

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
                      onClick={() => (modo === "varios" ? alternarVarios(p) : generar(p))}
                      disabled={generando}
                      className={`bg-white rounded-2xl p-2 text-left disabled:opacity-50 border-2 ${
                        modo === "varios" && varios.some((x) => x.id === p.id)
                          ? "border-brand-blue"
                          : "border-gray-100"
                      }`}
                    >
                      <img
                        src={p.imagen_url}
                        alt=""
                        className="w-full h-24 object-cover rounded-xl mb-1.5 bg-gray-50"
                      />
                      <p className="text-[11px] font-semibold text-gray-800 line-clamp-2 leading-tight">
                        {modo === "varios" && varios.some((x) => x.id === p.id) && "✓ "}
                        {p.nombre}
                      </p>
                      {/* Mostramos los dos precios: sin el tachado no se
                          distingue cuál está en oferta y cuál no. */}
                      {enOferta ? (
                        <div className="mt-0.5">
                          <p className="text-[10px] text-gray-400 line-through leading-none">
                            ${formatPrice(p.precio)}
                          </p>
                          <p className="text-sm font-extrabold text-red-600 leading-tight">
                            ${formatPrice(p.precio_oferta)}
                            <span className="text-[9px] font-bold text-red-500 ml-1">
                              OFERTA
                            </span>
                          </p>
                          <p className="text-[9px] font-bold text-green-700 leading-none">
                            ahorra ${formatPrice(Number(p.precio) - Number(p.precio_oferta))}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm font-extrabold text-brand-blue mt-0.5">
                          ${formatPrice(p.precio)}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400">
                        {Number(p.stock || 0) > 0 ? `Stock: ${p.stock}` : "Sin stock"}
                      </p>

                      {/* Aviso de repetido: publicar lo mismo dos veces en
                          la semana cansa a los seguidores y baja el alcance */}
                      {yaPromocionados[p.id] && (
                        <p className="text-[9px] font-bold text-amber-700 bg-amber-50 rounded px-1 py-0.5 mt-1">
                          ⚠️ Ya lo publicaste{" "}
                          {yaPromocionados[p.id].veces > 1
                            ? `${yaPromocionados[p.id].veces} veces`
                            : ""}{" "}
                          hace{" "}
                          {Math.max(
                            0,
                            Math.floor(
                              (Date.now() - new Date(yaPromocionados[p.id].ultima)) /
                                86400000
                            )
                          )}{" "}
                          día(s)
                        </p>
                      )}
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
