"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/lib/supabaseClient";
import { guardarEstado, leerEstado, limpiarEstado, vieneDeUnProducto, marcarSalidaAProducto, restaurarScroll } from "@/lib/estadoNavegacion";
import { formatPrice, buildWhatsAppLink } from "@/lib/whatsapp";

export default function APedidoPage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("nombre-asc"); // nombre-asc | precio-asc | precio-desc
  const [categorias, setCategorias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("todas");
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [total, setTotal] = useState(0);

  const POR_TANDA = 24;
  const [restaurado, setRestaurado] = useState(false);
  // Guardamos acá lo que había al volver. Si lo releemos más tarde ya fue
  // pisado por el guardado automático con scroll 0.
  const estadoInicial = useRef(null);
  const [tandasCargadas, setTandasCargadas] = useState(1);

  // Al volver de un producto recuperamos dónde estaba el cliente:
  // qué categoría miraba, qué buscaba y cuánto había bajado.
  useEffect(() => {
    // El navegador también intenta restaurar el scroll por su cuenta y pelea
    // con el nuestro. Lo pasamos a manual para tener el control.
    if (typeof history !== "undefined" && "scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    // Si no viene de un producto, arranca limpio
    if (!vieneDeUnProducto("a-pedido")) {
      limpiarEstado("a-pedido");
      setRestaurado(true);
      return;
    }

    const previo = leerEstado("a-pedido");
    estadoInicial.current = previo;
    if (previo) {
      if (previo.categoria) setCategoriaSeleccionada(previo.categoria);
      if (previo.busqueda) setBusqueda(previo.busqueda);
      if (previo.orden) setOrden(previo.orden);
      if (previo.tandas) setTandasCargadas(previo.tandas);
    }
    setRestaurado(true);
  }, []);

  // Categorías reales de los productos a pedido
  useEffect(() => {
    async function cargarCategorias() {
      const { data } = await supabase
        .from("Productos")
        .select("categoria")
        .eq("bajo_pedido", true)
        .eq("activo", true)
        .not("categoria", "is", null);
      if (!data) return;
      setCategorias([...new Set(data.map((p) => p.categoria).filter(Boolean))].sort());
    }
    cargarCategorias();
  }, []);

  // El filtrado y el orden los hace la base de datos: con miles de productos
  // a pedido no se pueden traer todos al celular del cliente.
  function consultaBase() {
    let q = supabase
      .from("Productos")
      .select("id, nombre, precio, imagen_url, descripcion, categoria", { count: "exact" })
      .eq("bajo_pedido", true)
      .eq("activo", true);

    if (categoriaSeleccionada !== "todas") {
      q = q.eq("categoria", categoriaSeleccionada);
    }
    if (busqueda.trim().length >= 2) {
      q = q.ilike("nombre", `%${busqueda.trim()}%`);
    }

    if (orden === "precio-asc") return q.order("precio", { ascending: true });
    if (orden === "precio-desc") return q.order("precio", { ascending: false });
    return q.order("nombre", { ascending: true });
  }

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setLoading(true);
      // Si el cliente había cargado varias tandas antes de entrar a un
      // producto, las traemos todas de nuevo para dejarlo donde estaba.
      const hasta = POR_TANDA * tandasCargadas - 1;
      const { data, count } = await consultaBase().range(0, hasta);
      if (cancelado) return;
      setProductos(data || []);
      setTotal(count || 0);
      setHayMas((data?.length || 0) === POR_TANDA * tandasCargadas);
      setLoading(false);

      // Devolvemos el scroll a donde estaba, una vez que ya se dibujó la lista
      const scrollGuardado = estadoInicial.current?.scroll;
      if (scrollGuardado) restaurarScroll(scrollGuardado);
    }
    if (!restaurado) return; // evitamos una consulta con los filtros vacíos

    const t = setTimeout(cargar, busqueda ? 400 : 0);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, orden, categoriaSeleccionada, restaurado, tandasCargadas]);

  // Guardamos el estado cada vez que cambia algo, y también al salir
  useEffect(() => {
    if (!restaurado) return;
    guardarEstado("a-pedido", {
      categoria: categoriaSeleccionada,
      busqueda,
      orden,
      tandas: tandasCargadas,
      scroll: window.scrollY
    });
  }, [categoriaSeleccionada, busqueda, orden, tandasCargadas, restaurado]);

  useEffect(() => {
    function guardarScroll() {
      // Mientras se está restaurando la posición, no guardamos: si no,
      // pisaríamos el valor bueno con el scroll intermedio de la animación.
      if (window.__bolsonRestaurando) return;
      if (!restaurado) return;
      guardarEstado("a-pedido", {
        categoria: categoriaSeleccionada,
        busqueda,
        orden,
        tandas: tandasCargadas,
        scroll: window.scrollY
      });
    }
    window.addEventListener("scroll", guardarScroll, { passive: true });
    return () => window.removeEventListener("scroll", guardarScroll);
  }, [categoriaSeleccionada, busqueda, orden, tandasCargadas, restaurado]);

  async function cargarMas() {
    setCargandoMas(true);
    const desde = productos.length;
    const { data } = await consultaBase().range(desde, desde + POR_TANDA - 1);
    setProductos((prev) => [...prev, ...(data || [])]);
    setHayMas((data?.length || 0) === POR_TANDA);
    setTandasCargadas((t) => t + 1);
    setCargandoMas(false);
  }

  function mensajeConsulta(nombre) {
    return buildWhatsAppLink(
      `Hola! 👋 Vi "${nombre}" en la sección de productos a pedido de Bolson Click. ¿Me contás precio final y tiempo de entrega?`
    );
  }

  const productosFiltrados = productos;

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <Header showSearch={false} />

      <div className="max-w-md mx-auto px-4 mt-4">
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-4">
          <h1 className="font-bold text-purple-900">🛍️ Productos a pedido</h1>
          <p className="text-sm text-purple-800 mt-1">
            Estos productos no están en stock ahora mismo, pero los podemos pedir a nuestro proveedor.
            Consultanos por WhatsApp el precio final y el tiempo de entrega estimado.
          </p>
        </div>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="input-field mb-3"
          placeholder="Buscar producto a pedido..."
        />

        {categorias.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
            <button
              onClick={() => {
                setCategoriaSeleccionada("todas");
                setTandasCargadas(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                categoriaSeleccionada === "todas"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              Todas
            </button>
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategoriaSeleccionada(cat);
                  setTandasCargadas(1);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  categoriaSeleccionada === cat
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-3 mb-1 scrollbar-none">
          {[
            { key: "nombre-asc", label: "A-Z" },
            { key: "precio-asc", label: "Más barato" },
            { key: "precio-desc", label: "Más caro" }
          ].map((op) => (
            <button
              key={op.key}
              onClick={() => setOrden(op.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                orden === op.key ? "bg-purple-600 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>

        {!loading && (
          <p className="text-[11px] text-gray-400 mb-2">
            {total} producto{total === 1 ? "" : "s"} a pedido
          </p>
        )}

        {loading ? (
          <p className="text-center text-gray-400 text-sm py-10">Cargando...</p>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-12 card p-6 bg-white rounded-2xl shadow-sm">
            <p className="text-2xl mb-2">📦</p>
            <p className="text-sm font-bold text-gray-700">
              {busqueda ? "No encontramos productos con ese nombre" : "Todavía no hay productos a pedido cargados"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {productosFiltrados.map((prod) => (
              <div key={prod.id} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                <div>
                  <Link href={`/a-pedido/${prod.id}`} onClick={() => {
                      guardarEstado("a-pedido", {
                        categoria: categoriaSeleccionada,
                        busqueda,
                        orden,
                        tandas: tandasCargadas,
                        scroll: window.scrollY
                      });
                      marcarSalidaAProducto("a-pedido");
                    }} className="block relative">
                    {prod.imagen_url ? (
                      <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-32 object-cover rounded-xl mb-2 bg-gray-50" />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 rounded-xl mb-2 flex items-center justify-center text-gray-400 text-2xl">📦</div>
                    )}
                    <span className="absolute top-1.5 left-1.5 bg-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                      A PEDIDO
                    </span>
                  </Link>

                  <h3 className="font-bold text-xs text-gray-800 line-clamp-2 leading-tight">
                    <Link href={`/a-pedido/${prod.id}`} onClick={() => {
                      guardarEstado("a-pedido", {
                        categoria: categoriaSeleccionada,
                        busqueda,
                        orden,
                        tandas: tandasCargadas,
                        scroll: window.scrollY
                      });
                      marcarSalidaAProducto("a-pedido");
                    }}>{prod.nombre}</Link>
                  </h3>

                  {prod.descripcion && (
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{prod.descripcion}</p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-50 flex flex-col gap-1.5">
                  {prod.precio && (
                    <span className="font-black text-sm text-purple-700">
                      Aprox. ${formatPrice(prod.precio)}
                    </span>
                  )}
                  <a
                    href={mensajeConsulta(prod.nombre)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-purple-600 text-white text-[11px] font-bold py-2 rounded-xl shadow-sm text-center"
                  >
                    Consultar y pedir
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && hayMas && (
          <button
            onClick={cargarMas}
            disabled={cargandoMas}
            className="w-full bg-white border border-gray-200 text-gray-700 text-sm font-bold py-3 rounded-xl mt-4 disabled:opacity-50"
          >
            {cargandoMas ? "Cargando..." : "Ver más productos"}
          </button>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
