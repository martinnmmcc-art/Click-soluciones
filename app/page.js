"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import BannerNovedades from "@/components/BannerNovedades";
import BannerOferta from "@/components/BannerOferta";
import BannerLlegaPronto from "@/components/BannerLlegaPronto";
import { supabase } from "@/lib/supabaseClient";
import { guardarCopiaTienda, leerCopiaTienda, conLimite } from "@/lib/copiaTienda";
import { guardarEstado, leerEstado, limpiarEstado, vieneDeUnProducto, marcarSalidaAProducto, restaurarScroll, limpiarBanderaRestauracion } from "@/lib/estadoNavegacion";
import { useCart } from "@/context/CartContext";
import { buildWhatsAppLink, whatsappProductMessage, formatPrice } from "@/lib/whatsapp";
import BotonFavorito from "@/components/BotonFavorito";
import FotoRotativa from "@/components/FotoRotativa";
import { fotosDe, urlImagen } from "@/lib/imagenProducto";
import RedesSociales from "@/components/RedesSociales";
import ElegidosParaVos from "@/components/ElegidosParaVos";
import InvitacionAPedido from "@/components/InvitacionAPedido";
import GuiaRegistro from "@/components/GuiaRegistro";
import { coincideBusqueda } from "@/lib/buscar";

export default function HomePage() {
  const { addItem } = useCart();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [masVendidos, setMasVendidos] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [mensajeCarrito, setMensajeCarrito] = useState("");
  const [restaurado, setRestaurado] = useState(false);
  // Guardamos acá la posición que traía al volver, antes de que el guardado
  // automático la pise con el scroll 0 de la página recién montada.
  const estadoInicial = useRef(null);

  useEffect(() => {
    if (typeof history !== "undefined" && "scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    limpiarBanderaRestauracion();

    if (!vieneDeUnProducto("inicio")) {
      limpiarEstado("inicio");
      estadoInicial.current = null;
      setRestaurado(true);
      return;
    }

    const previo = leerEstado("inicio");
    estadoInicial.current = previo;
    if (previo?.categoria) setCategoriaSeleccionada(previo.categoria);
    setRestaurado(true);
  }, []);

  // Guardamos dónde está parado el cliente mientras navega la home
  useEffect(() => {
    if (!restaurado) return;

    function guardarScroll() {
      if (window.__bolsonRestaurando) return;
      guardarEstado("inicio", {
        categoria: categoriaSeleccionada,
        scroll: window.scrollY
      });
    }
    window.addEventListener("scroll", guardarScroll, { passive: true });
    return () => window.removeEventListener("scroll", guardarScroll);
  }, [categoriaSeleccionada, restaurado]);

  // Función que usan los enlaces a productos: deja marcada la posición exacta
  function salirAProducto() {
    guardarEstado("inicio", {
      categoria: categoriaSeleccionada,
      scroll: window.scrollY
    });
    marcarSalidaAProducto("inicio");
  }

  useEffect(() => {
    async function cargarMasVendidos() {
      try {
        const res = await fetch("/api/mas-vendidos");
        const data = await res.json();
        if (res.ok) setMasVendidos(data.productos || []);
      } catch (e) {
        console.error("Error cargando más vendidos:", e);
      }
    }
    cargarMasVendidos();
  }, []);

  useEffect(() => {
    async function cargarDatos() {
      setLoadingData(true);
      try {
        let { data: prodData, error: prodError } = await conLimite(
          supabase
            .from("Productos")
            .select("*")
            .or("bajo_pedido.is.null,bajo_pedido.eq.false")
            .order("id", { ascending: false }),
          navigator.onLine ? 8000 : 1500
        );

        if (prodData?.length) {
          setProductos(prodData);
          guardarCopiaTienda(prodData);
        } else {
          // Sin señal o la base no contesta: la copia guardada en el celular
          if (prodError) console.error("Error en Productos:", prodError.message);
          const copia = leerCopiaTienda();
          if (copia.length) {
            prodData = copia;
            setProductos(copia);
          }
        }

        // Las categorías salen de los propios productos. La tabla "Categorias"
        // usa claves como "hogar-cocina" y los productos guardan el nombre
        // completo, así que nunca coincidían y la lista salía vacía.
        if (prodData) {
          const unicas = [
            ...new Set(prodData.map((p) => p.categoria).filter(Boolean))
          ].sort();
          setCategorias(unicas.map((nombre) => ({ id: nombre, nombre })));
        }
      } catch (err) {
        console.error("Error general de red:", err);
      } finally {
        setLoadingData(false);

        // Devolvemos al cliente a la altura donde estaba mirando
        const scrollGuardado = estadoInicial.current?.scroll;
        if (scrollGuardado) restaurarScroll(scrollGuardado);
      }
    }

    cargarDatos();
  }, []);

  function agregarAlCarrito(producto) {
    addItem(producto, 1);
    setMensajeCarrito(`¡${producto.nombre || "Producto"} agregado!`);
    setTimeout(() => setMensajeCarrito(""), 2500);
  }

  function esNuevo(prod) {
    if (!prod.created_at) return false;
    const dias = (Date.now() - new Date(prod.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return dias <= 7;
  }

  const productosFiltrados = (Array.isArray(productos) ? productos : []).filter((prod) => {
    const coincideCategoria =
      categoriaSeleccionada === "todas" || prod.categoria === categoriaSeleccionada;

    const coincide =
      !busqueda.trim() || coincideBusqueda(prod.nombre, busqueda) || coincideBusqueda(prod.descripcion, busqueda);

    return coincideCategoria && coincide;
  })
  // Primero lo que se puede entregar ya: es lo que más rápido se convierte
  // en venta. Los agotados quedan abajo, para consultar.
  .sort((a, b) => {
    const dispA = Number(a.stock || 0) > 0 ? 1 : 0;
    const dispB = Number(b.stock || 0) > 0 ? 1 : 0;
    if (dispA !== dispB) return dispB - dispA;

    // Entre los disponibles, primero lo que llegó último. Usamos getTime
    // con respaldo: si la fecha viene vacía o inválida, restar daría un
    // valor imposible y el orden quedaría roto.
    const fa = a.fecha_ingreso ? new Date(a.fecha_ingreso).getTime() : 0;
    const fb = b.fecha_ingreso ? new Date(b.fecha_ingreso).getTime() : 0;
    return (isNaN(fb) ? 0 : fb) - (isNaN(fa) ? 0 : fa);
  });

  // ---------- Bienvenida ----------
  // Saludo por el nombre si ya es cliente: se siente atendido, no anónimo
  const [nombreCliente, setNombreCliente] = useState("");
  const [formasDePago, setFormasDePago] = useState("efectivo, transferencia, Mercado Pago o Naranja X");
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("cliente_sesion") || "null");
      const n = String(s?.nombre || "").trim().split(/\s+/)[0];
      if (n) setNombreCliente(n.charAt(0).toUpperCase() + n.slice(1));
    } catch {}
    // Las formas de pago salen de lo que tenés activo en el panel
    supabase
      .from("metodos_pago")
      .select("nombre, activo, orden")
      .order("orden")
      .then(({ data }) => {
        const activos = (data || []).filter((m) => m.activo !== false).map((m) => m.nombre);
        if (activos.length >= 2) {
          const corto = activos.map((n) =>
            /efectivo/i.test(n) ? "efectivo" : /transferencia/i.test(n) ? "transferencia" : n
          );
          setFormasDePago(corto.slice(0, -1).join(", ") + " o " + corto[corto.length - 1]);
        }
      })
      .catch(() => {});
  }, []);

  const enStock = productos.filter((p) => Number(p.stock || 0) > 0);

  // Vidriera por categoría: una foto real de cada rubro, como las historias
  // de Instagram. Se entiende al toque qué vendemos y lleva directo a eso.
  const vidriera = (() => {
    const porCat = {};
    enStock.forEach((p) => {
      if (!p.categoria || !p.imagen_url) return;
      const c = porCat[p.categoria] || (porCat[p.categoria] = { categoria: p.categoria, cantidad: 0, foto: null });
      c.cantidad++;
      if (!c.foto) c.foto = p.imagen_url;
    });
    return Object.values(porCat)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 12);
  })();

  function irACategoria(cat) {
    setCategoriaSeleccionada(cat);
    setBusqueda("");
    setTimeout(() => {
      document.getElementById("todos-los-productos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const nombreCorto = (c) =>
    String(c)
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+y\s+/i, " y ")
      .trim();

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <Header busqueda={busqueda} setBusqueda={setBusqueda} showSearch={true} buscarEnCatalogo />

      {mensajeCarrito && (
        <div
          className="fixed top-28 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg"
          role="status"
        >
          {mensajeCarrito}
        </div>
      )}

      {/* ===== BIENVENIDA ===== */}
      <section className="max-w-md md:max-w-none mx-auto px-4 pt-4" aria-labelledby="titulo-bienvenida">
        <h1 id="titulo-bienvenida" className="text-[22px] font-black text-gray-900 leading-tight">
          {nombreCliente ? `Hola, ${nombreCliente} 👋` : "Todo para tu casa, acá en El Bolsón"}
        </h1>
        <p className="text-[13px] text-gray-600 mt-1">
          {enStock.length > 0
            ? `${enStock.length} productos listos para llevar hoy. Pedís desde acá y coordinamos la entrega.`
            : "Pedís desde acá y coordinamos la entrega por WhatsApp."}
        </p>

        {/* Lo que da confianza a quien no nos conoce */}
        <ul className="flex gap-2 overflow-x-auto scrollbar-none mt-3 -mx-4 px-4 pb-1">
          <li className="flex-shrink-0 flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-2 pr-3 py-1.5 text-[11.5px] font-semibold text-gray-700">
            <span aria-hidden="true">📍</span> Entregamos en toda la Comarca
          </li>
          <li className="flex-shrink-0 flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-2 pr-3 py-1.5 text-[11.5px] font-semibold text-gray-700">
            <span aria-hidden="true">💳</span> Pagás con {formasDePago}
          </li>
          <li className="flex-shrink-0 flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-2 pr-3 py-1.5 text-[11.5px] font-semibold text-gray-700">
            <span aria-hidden="true">💬</span> Te respondemos por WhatsApp
          </li>
        </ul>

        {/* Vidriera por categoría */}
        {vidriera.length > 1 && (
          <nav className="mt-4 -mx-4 px-4 flex gap-3 overflow-x-auto scrollbar-none pb-1" aria-label="Categorías">
            {vidriera.map((c) => {
              const activa = categoriaSeleccionada === c.categoria;
              return (
                <button
                  key={c.categoria}
                  type="button"
                  onClick={() => irACategoria(activa ? "todas" : c.categoria)}
                  className="flex-shrink-0 w-[70px] flex flex-col items-center gap-1 group"
                  aria-pressed={activa}
                >
                  <span
                    className={`p-[3px] rounded-full ${
                      activa ? "bg-brand-blue" : "bg-gradient-to-tr from-[#F2C75C] via-brand-orange to-[#E2427A]"
                    }`}
                  >
                    <span className="block w-[60px] h-[60px] rounded-full bg-white p-[3px]">
                      <img
                        src={urlImagen(c.foto)}
                        alt=""
                        className="w-full h-full rounded-full object-contain bg-white"
                        loading="lazy"
                      />
                    </span>
                  </span>
                  <span
                    className={`text-[10.5px] leading-tight text-center line-clamp-2 ${
                      activa ? "font-extrabold text-brand-blue" : "font-semibold text-gray-700"
                    }`}
                  >
                    {nombreCorto(c.categoria)}
                  </span>
                </button>
              );
            })}
            <Link href="/catalogo" className="flex-shrink-0 w-[70px] flex flex-col items-center gap-1">
              <span className="w-[66px] h-[66px] rounded-full bg-white border-2 border-dashed border-gray-300 flex items-center justify-center text-[11px] font-bold text-gray-500 text-center leading-tight">
                Ver
                <br />
                todo
              </span>
              <span className="text-[10.5px] font-semibold text-gray-700">Catálogo</span>
            </Link>
          </nav>
        )}
      </section>

      <BannerOferta />
      <BannerNovedades />

      <ElegidosParaVos respaldo={productos} onSalir={salirAProducto} />

      <InvitacionAPedido />

      <BannerLlegaPronto />

      <GuiaRegistro />

      {/* Prueba social: saber que otros ya lo compraron es de lo que más
          empuja a decidir, sobre todo en un pueblo donde se conocen. */}
      {masVendidos.length > 0 && (
        <section className="mt-6 bg-gradient-to-b from-red-50 to-transparent py-4" aria-labelledby="titulo-mas-vendidos">
          <div className="max-w-md md:max-w-none mx-auto px-4 mb-3">
            <h2 id="titulo-mas-vendidos" className="font-black text-gray-800 text-base leading-none flex items-center gap-2">
              <span aria-hidden="true">🔥</span>
              Lo que más se lleva la gente
            </h2>
            <p className="text-[11px] text-red-800 mt-1 ml-7">Los favoritos de El Bolsón y la Comarca</p>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none snap-x scroll-px-4">
            {masVendidos.map((prod) => {
              const tieneOferta = prod.precio_oferta && Number(prod.precio_oferta) < Number(prod.precio);
              return (
                <Link
                  key={prod.id}
                  href={`/producto/${prod.id}`}
                  onClick={salirAProducto}
                  className="snap-start flex-shrink-0 w-44 bg-white rounded-2xl p-3 border border-gray-100 shadow-sm"
                >
                  <div className="relative">
                    <FotoRotativa
                      fotos={fotosDe(prod)}
                      video={prod.video_url}
                      alt={prod.nombre}
                      className="w-full h-40 object-contain rounded-xl mb-2 bg-white"
                    />
                    <span className="absolute top-1 left-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      🔥 Más vendido
                    </span>
                  </div>
                  <p className="text-[13px] font-bold text-gray-800 line-clamp-2 leading-snug min-h-[2.2rem]">{prod.nombre}</p>
                  <p className="text-lg font-black text-brand-blue mt-1 leading-tight">
                    ${formatPrice((tieneOferta ? prod.precio_oferta : prod.precio) || 0)}
                  </p>
                  {tieneOferta && (
                    <p className="text-[11px] text-gray-400 line-through leading-none">${formatPrice(prod.precio)}</p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div id="todos-los-productos" className="max-w-md md:max-w-none mx-auto px-4 mt-4 scroll-mt-32">
        {/* Corte visual: sin esto, al desplazarse no se nota que terminaron
            los carruseles y empieza el catálogo. */}
        <div className="border-t-4 border-gray-100 -mx-4 mb-4" />

        <h2 className="font-black text-gray-800 text-base leading-none flex items-center gap-2">
          <span aria-hidden="true">🛍️</span>
          {categoriaSeleccionada === "todas" ? "Todos los productos" : nombreCorto(categoriaSeleccionada)}
        </h2>
        <p className="text-[11px] text-gray-500 mt-1 mb-3 ml-7">Primero lo que tenemos disponible</p>

        {categorias.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
            <button
              onClick={() => setCategoriaSeleccionada("todas")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                categoriaSeleccionada === "todas" ? "bg-brand-blue text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              Todas
            </button>
            {categorias.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoriaSeleccionada(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  categoriaSeleccionada === cat.id ? "bg-brand-blue text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        )}

        {loadingData ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2" aria-label="Cargando productos">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-3 border border-gray-100">
                <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-3 rounded bg-gray-100 animate-pulse mt-3 w-4/5" />
                <div className="h-4 rounded bg-gray-100 animate-pulse mt-2 w-1/2" />
              </div>
            ))}
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm p-6">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-bold text-gray-700">
              {busqueda.trim() ? "No lo tenemos en stock ahora" : "No hay productos disponibles"}
            </p>
            {busqueda.trim().length >= 2 && (
              <Link
                href={`/a-pedido?q=${encodeURIComponent(busqueda.trim())}`}
                className="inline-block mt-3 bg-[#5B2BB5] text-white text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                Buscar &quot;{busqueda.trim()}&quot; entre los productos a pedido
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
            {productosFiltrados.map((prod) => {
              const tieneOferta = prod.precio_oferta && Number(prod.precio_oferta) < Number(prod.precio);
              const final = tieneOferta ? Number(prod.precio_oferta) : Number(prod.precio || 0);
              const pct = tieneOferta ? Math.round((1 - final / Number(prod.precio)) * 100) : 0;
              const sinStock = prod.stock !== null && prod.stock !== undefined && Number(prod.stock) <= 0;
              return (
                <div key={prod.id} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <Link href={`/producto/${prod.id}`} onClick={salirAProducto} className="block relative">
                      <FotoRotativa
                        fotos={fotosDe(prod)}
                        video={prod.video_url}
                        alt={prod.nombre}
                        className={`w-full h-32 object-contain rounded-xl mb-2 bg-white ${sinStock ? "opacity-70" : ""}`}
                      />
                      {tieneOferta && (
                        <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          −{pct}%
                        </span>
                      )}
                      {!tieneOferta && esNuevo(prod) && (
                        <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                          NUEVO
                        </span>
                      )}
                      {sinStock && (
                        <span className="absolute top-1.5 right-1.5 bg-amber-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                          Consultar stock
                        </span>
                      )}
                      {Number(prod.stock) === 1 && (
                        <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                          ¡Última unidad!
                        </span>
                      )}
                      <BotonFavorito productoId={prod.id} className="absolute bottom-3.5 right-1.5 w-7 h-7" />
                    </Link>

                    <h3 className="font-bold text-[13px] text-gray-800 line-clamp-2 leading-snug">
                      <Link href={`/producto/${prod.id}`} onClick={salirAProducto} className="block">
                        {prod.nombre}
                      </Link>
                    </h3>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-50 flex flex-col gap-1.5">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-black text-[17px] text-brand-blue leading-none">${formatPrice(final)}</span>
                      {tieneOferta && (
                        <span className="text-[11px] text-gray-400 line-through">${formatPrice(prod.precio)}</span>
                      )}
                    </div>
                    {sinStock ? (
                      <a
                        href={buildWhatsAppLink(whatsappProductMessage(prod))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-amber-600 text-white text-[12px] font-bold py-2 rounded-xl text-center active:scale-95 transition"
                      >
                        💬 Consultar
                      </a>
                    ) : (
                      <button
                        onClick={() => agregarAlCarrito(prod)}
                        className="w-full bg-brand-blue text-white text-[12px] font-bold py-2 rounded-xl active:scale-95 transition"
                      >
                        + Agregar al carrito
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 mt-8 mb-4 max-w-md md:max-w-none mx-auto">
        <RedesSociales conWhatsApp />
      </div>
    </main>
  );
}
