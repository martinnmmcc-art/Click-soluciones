"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import BannerNovedades from "@/components/BannerNovedades";
import BannerOferta from "@/components/BannerOferta";
import { supabase } from "@/lib/supabaseClient";
import { guardarEstado, leerEstado, limpiarEstado, vieneDeUnProducto, marcarSalidaAProducto, restaurarScroll, limpiarBanderaRestauracion } from "@/lib/estadoNavegacion";
import { useCart } from "@/context/CartContext";
import { buildWhatsAppLink, whatsappProductMessage } from "@/lib/whatsapp";
import BotonFavorito from "@/components/BotonFavorito";
import FotoRotativa from "@/components/FotoRotativa";

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
        const { data: prodData, error: prodError } = await supabase
          .from("Productos")
          .select("*")
          .or("bajo_pedido.is.null,bajo_pedido.eq.false")
          .order("id", { ascending: false });

        if (prodError) {
          console.error("Error en Productos:", prodError.message);
        } else if (prodData) {
          setProductos(prodData);
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

  const productosFiltrados = productos.filter((prod) => {
    const coincideCategoria =
      categoriaSeleccionada === "todas" || prod.categoria === categoriaSeleccionada;

    const coincideBusqueda =
      !busqueda.trim() ||
      prod.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      prod.descripcion?.toLowerCase().includes(busqueda.toLowerCase());

    return coincideCategoria && coincideBusqueda;
  })
  // Primero lo que se puede entregar ya: es lo que más rápido se convierte
  // en venta. Los agotados quedan abajo, para consultar.
  .sort((a, b) => {
    const dispA = Number(a.stock || 0) > 0 ? 1 : 0;
    const dispB = Number(b.stock || 0) > 0 ? 1 : 0;
    if (dispA !== dispB) return dispB - dispA;

    // Entre los disponibles, primero lo que llegó último
    const fa = a.fecha_ingreso ? new Date(a.fecha_ingreso) : 0;
    const fb = b.fecha_ingreso ? new Date(b.fecha_ingreso) : 0;
    return fb - fa;
  });

  const destacados = productos.filter((p) => p.destacado);

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <Header busqueda={busqueda} setBusqueda={setBusqueda} showSearch={true} />

      {mensajeCarrito && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg transition animate-bounce">
          {mensajeCarrito}
        </div>
      )}

      <BannerOferta />
      <BannerNovedades />

      <div className="max-w-md mx-auto px-4 mt-3">
        <Link
          href="/a-pedido"
          className="flex items-center justify-between gap-3 bg-purple-600 hover:bg-purple-700 active:scale-[0.98] transition rounded-2xl py-3.5 px-4 shadow-md shadow-purple-200"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛍️</span>
            <div className="text-left">
              <p className="text-white font-extrabold text-sm leading-tight">¿No lo encontrás?</p>
              <p className="text-purple-100 text-xs font-medium">Mirá los productos a pedido</p>
            </div>
          </div>
          <span className="text-white text-xl font-bold">→</span>
        </Link>
      </div>

      <div className="max-w-md mx-auto px-4 mt-3">
        <p className="text-[11px] text-gray-500 text-center bg-gray-100 rounded-full py-1.5 px-3">
          🚚 Envíos a El Bolsón y la Comarca Andina — coordinamos transporte local o punto de encuentro
        </p>
      </div>

      {/* Cada sección con su propia banda de color: al desplazarse, el
          cliente reconoce que cambió de bloque sin tener que leer el título.
          El subtítulo da la razón para mirar, que es lo que engancha. */}
      {destacados.length > 0 && (
        <div className="mt-6 bg-gradient-to-b from-amber-50 to-transparent py-4">
          <div className="max-w-md mx-auto px-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">⭐</span>
              <h2 className="font-black text-gray-800 text-base leading-none">
                Elegidos para vos
              </h2>
            </div>
            <p className="text-[11px] text-amber-800 mt-1 ml-7">
              Lo que más recomendamos de nuestro stock
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
            {destacados.map((prod) => {
              const tieneOferta = prod.precio_oferta && Number(prod.precio_oferta) < Number(prod.precio);
              return (
                <Link
                  key={prod.id}
                  href={`/producto/${prod.id}`}
                  onClick={salirAProducto}
                  className="flex-shrink-0 w-44 bg-white rounded-2xl p-3 border border-amber-200 shadow-sm"
                >
                  <div className="relative">
                    <FotoRotativa
                      fotos={[prod.imagen_url, prod.imagen_url_2, prod.imagen_url_3]}
                      video={prod.video_url}
                      alt={prod.nombre}
                      className="w-full h-40 object-contain rounded-xl mb-2 bg-white"
                    />
                    <span className="absolute top-1 left-1 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ⭐ DESTACADO
                    </span>
                  </div>
                  <p className="text-[13px] font-bold text-gray-800 line-clamp-2 leading-snug">{prod.nombre}</p>
                  <p className="text-lg font-black text-brand-blue mt-1 leading-tight">
                    ${Number((tieneOferta ? prod.precio_oferta : prod.precio) || 0).toLocaleString("es-AR")}
                  </p>
                  {tieneOferta && (
                    <p className="text-[11px] text-gray-400 line-through leading-none">
                      ${Number(prod.precio || 0).toLocaleString("es-AR")}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Prueba social: saber que otros ya lo compraron es de lo que más
          empuja a decidir, sobre todo en un pueblo donde se conocen. */}
      {masVendidos.length > 0 && (
        <div className="mt-6 bg-gradient-to-b from-red-50 to-transparent py-4">
          <div className="max-w-md mx-auto px-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔥</span>
              <h2 className="font-black text-gray-800 text-base leading-none">
                Lo que más se lleva la gente
              </h2>
            </div>
            <p className="text-[11px] text-red-800 mt-1 ml-7">
              Los favoritos de El Bolsón y la Comarca
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
            {masVendidos.map((prod) => {
              const tieneOferta = prod.precio_oferta && Number(prod.precio_oferta) < Number(prod.precio);
              return (
                <Link
                  key={prod.id}
                  href={`/producto/${prod.id}`}
                  onClick={salirAProducto}
                  className="flex-shrink-0 w-44 bg-white rounded-2xl p-3 border border-gray-100 shadow-sm"
                >
                  <div className="relative">
                    <FotoRotativa
                      fotos={[prod.imagen_url, prod.imagen_url_2, prod.imagen_url_3]}
                      video={prod.video_url}
                      alt={prod.nombre}
                      className="w-full h-40 object-contain rounded-xl mb-2 bg-white"
                    />
                    <span className="absolute top-1 left-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      🔥 TOP
                    </span>
                  </div>
                  <p className="text-[13px] font-bold text-gray-800 line-clamp-2 leading-snug">{prod.nombre}</p>
                  <p className="text-lg font-black text-brand-blue mt-1 leading-tight">
                    ${Number((tieneOferta ? prod.precio_oferta : prod.precio) || 0).toLocaleString("es-AR")}
                  </p>
                  {tieneOferta && (
                    <p className="text-[11px] text-gray-400 line-through leading-none">
                      ${Number(prod.precio || 0).toLocaleString("es-AR")}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 mt-4">
        {/* Corte visual: sin esto, al desplazarse no se nota que terminaron
            los carruseles y empieza el catálogo. */}
        <div className="border-t-4 border-gray-100 -mx-4 mb-4" />

        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🛍️</span>
          <div>
            <h2 className="font-black text-gray-800 text-base leading-none">
              Todos los productos
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Primero lo que tenemos disponible
            </p>
          </div>
        </div>

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
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 font-medium">Cargando catálogo...</p>
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-12 card p-6 bg-white rounded-2xl shadow-sm">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-bold text-gray-700">No hay productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {productosFiltrados.map((prod) => (
              <div key={prod.id} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                <div>
                  <Link href={`/producto/${prod.id}`} onClick={salirAProducto} className="block relative">
                    <FotoRotativa
                      fotos={[prod.imagen_url, prod.imagen_url_2, prod.imagen_url_3]}
                      video={prod.video_url}
                      alt={prod.nombre}
                      className="w-full h-32 object-cover rounded-xl mb-2 bg-gray-50"
                    />
                    {prod.precio_oferta && prod.precio_oferta < prod.precio && (
                      <span className="absolute top-1.5 left-1.5 bg-brand-orange text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        OFERTA
                      </span>
                    )}
                    {!prod.precio_oferta && esNuevo(prod) && (
                      <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        NUEVO
                      </span>
                    )}
                    {prod.stock !== null && prod.stock !== undefined && Number(prod.stock) <= 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-amber-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        Consultar stock
                      </span>
                    )}
                    {prod.stock !== null && prod.stock !== undefined && Number(prod.stock) === 1 && (
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

                  {prod.descripcion && (
                    <p className="text-[12px] text-gray-600 font-medium line-clamp-2 mt-1 leading-snug">{prod.descripcion}</p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-50 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm text-brand-blue">
                      ${Number((prod.precio_oferta && prod.precio_oferta < prod.precio ? prod.precio_oferta : prod.precio) || 0).toLocaleString("es-AR")}
                    </span>
                    {prod.precio_oferta && prod.precio_oferta < prod.precio && (
                      <span className="text-[10px] text-gray-400 line-through">
                        ${Number(prod.precio || 0).toLocaleString("es-AR")}
                      </span>
                    )}
                  </div>
                  {prod.stock !== null && prod.stock !== undefined && Number(prod.stock) <= 0 ? (
                    <a
                      href={buildWhatsAppLink(whatsappProductMessage(prod))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-amber-600 text-white text-[11px] font-bold py-2 rounded-xl shadow-sm hover:opacity-95 active:scale-95 transition text-center"
                    >
                      💬 Consultar stock
                    </a>
                  ) : (
                    <button onClick={() => agregarAlCarrito(prod)} className="w-full bg-brand-blue text-white text-[11px] font-bold py-2 rounded-xl shadow-sm hover:opacity-95 active:scale-95 transition">+ Agregar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
