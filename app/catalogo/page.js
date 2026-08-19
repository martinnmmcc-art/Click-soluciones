"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ProductCard from "@/components/ProductCard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

// Cuántos productos traemos por tanda. Con más de 2000 productos no podemos
// cargarlos todos juntos: el celular del cliente se traba y consume datos de más.
const POR_TANDA = 24;

const DISPONIBILIDADES = [
  { id: "stock", label: "🟢 Disponible ya", ayuda: "Lo tengo acá, entrega rápida" },
  { id: "pedido", label: "📦 A pedido", ayuda: "Lo encargo al proveedor" },
  { id: "todos", label: "Ver todo", ayuda: "" }
];

export default function CatalogoPage() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("todas");
  const [disponibilidad, setDisponibilidad] = useState("stock");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [hayMas, setHayMas] = useState(true);
  const [totalResultados, setTotalResultados] = useState(0);

  // Modo "agregar a un pedido existente": se activa cuando el cliente llega
  // desde Mis pedidos con ?agregar_a=ID
  const [agregarAPedido, setAgregarAPedido] = useState(null);
  const [telefonoCliente, setTelefonoCliente] = useState(null);
  const [agregando, setAgregando] = useState(null);
  const [avisoAgregado, setAvisoAgregado] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pedidoId = params.get("agregar_a");
    if (!pedidoId) return;

    const sesionStr = localStorage.getItem("cliente_sesion");
    if (!sesionStr) return;
    try {
      const sesion = JSON.parse(sesionStr);
      setAgregarAPedido(pedidoId);
      setTelefonoCliente(sesion.telefono);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Categorías reales: las sacamos de los propios productos, así siempre
  // coinciden con lo que hay cargado.
  useEffect(() => {
    async function cargarCategorias() {
      const { data } = await supabase
        .from("Productos")
        .select("categoria")
        .eq("activo", true)
        .not("categoria", "is", null);

      if (!data) return;
      const unicas = [...new Set(data.map((p) => p.categoria).filter(Boolean))].sort();
      setCategorias(unicas);
    }
    cargarCategorias();
  }, []);

  // Arma la consulta según los filtros elegidos. El filtrado lo hace la base
  // de datos, no el navegador: con miles de productos es la única forma
  // de que la tienda cargue rápido.
  const construirConsulta = useCallback(() => {
    let q = supabase
      .from("Productos")
      .select(
        "id, nombre, precio, precio_oferta, imagen_url, stock, bajo_pedido, categoria, descripcion",
        { count: "exact" }
      )
      .eq("activo", true);

    if (disponibilidad === "stock") {
      q = q.or("bajo_pedido.is.null,bajo_pedido.eq.false").gt("stock", 0);
    } else if (disponibilidad === "pedido") {
      q = q.eq("bajo_pedido", true);
    }

    if (categoriaSeleccionada !== "todas") {
      q = q.eq("categoria", categoriaSeleccionada);
    }

    if (busqueda.trim().length >= 2) {
      q = q.ilike("nombre", `%${busqueda.trim()}%`);
    }

    return q;
  }, [disponibilidad, categoriaSeleccionada, busqueda]);

  // Primera tanda: cada vez que cambia un filtro empezamos de cero
  useEffect(() => {
    let cancelado = false;

    async function cargarPrimeraTanda() {
      setLoading(true);
      const { data, count } = await construirConsulta()
        .order("id", { ascending: false })
        .range(0, POR_TANDA - 1);

      if (cancelado) return;
      setProductos(data || []);
      setTotalResultados(count || 0);
      setHayMas((data?.length || 0) === POR_TANDA);
      setLoading(false);
    }

    // Pequeña espera al escribir, para no consultar en cada tecla
    const temporizador = setTimeout(cargarPrimeraTanda, busqueda ? 400 : 0);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [construirConsulta, busqueda]);

  async function cargarMas() {
    setCargandoMas(true);
    const desde = productos.length;
    const { data } = await construirConsulta()
      .order("id", { ascending: false })
      .range(desde, desde + POR_TANDA - 1);

    setProductos((prev) => [...prev, ...(data || [])]);
    setHayMas((data?.length || 0) === POR_TANDA);
    setCargandoMas(false);
  }

  async function agregarAlPedido(prod) {
    setAgregando(prod.id);
    try {
      const res = await fetch("/api/mis-pedidos/agregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido_id: Number(agregarAPedido),
          telefono: telefonoCliente,
          productos: [{ producto_id: prod.id, cantidad: 1 }]
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo agregar el producto.");
        return;
      }
      setAvisoAgregado(`✅ Agregaste ${prod.nombre} al pedido`);
      setTimeout(() => setAvisoAgregado(""), 3000);
    } catch (e) {
      alert("Ocurrió un error al agregar el producto.");
    } finally {
      setAgregando(null);
    }
  }

  const infoDisponibilidad = DISPONIBILIDADES.find((d) => d.id === disponibilidad);

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <Header busqueda={busqueda} setBusqueda={setBusqueda} showSearch={true} />

      <div className="max-w-md mx-auto px-4 mt-4">
        {agregarAPedido && (
          <div className="bg-green-50 border border-green-300 rounded-xl p-3 mb-3 sticky top-0 z-10">
            <p className="text-xs font-bold text-green-800">
              ➕ Estás sumando productos a tu pedido
            </p>
            <p className="text-[11px] text-green-700 mt-0.5">
              Tocá &quot;Agregar al pedido&quot; en el producto que quieras.
            </p>
            <a href="/login" className="text-[11px] font-bold text-brand-blue underline mt-1 inline-block">
              ← Volver a mis pedidos
            </a>
          </div>
        )}

        {avisoAgregado && (
          <div className="bg-green-600 text-white text-xs font-bold rounded-xl p-3 mb-3 text-center">
            {avisoAgregado}
          </div>
        )}

        <h1 className="font-black text-gray-800 text-base mb-3">Catálogo</h1>

        {/* DISPONIBLE AHORA vs A PEDIDO */}
        <div className="flex gap-2 mb-2">
          {DISPONIBILIDADES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDisponibilidad(d.id)}
              className={`flex-1 px-2 py-2 rounded-xl text-xs font-bold transition ${
                disponibilidad === d.id
                  ? "bg-brand-blue text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {infoDisponibilidad?.ayuda && (
          <p className="text-[11px] text-gray-500 mb-3 px-1">{infoDisponibilidad.ayuda}</p>
        )}

        {/* CATEGORÍAS */}
        {categorias.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
            <button
              onClick={() => setCategoriaSeleccionada("todas")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                categoriaSeleccionada === "todas"
                  ? "bg-gray-800 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              Todas
            </button>
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaSeleccionada(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  categoriaSeleccionada === cat
                    ? "bg-gray-800 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {!loading && (
          <p className="text-[11px] text-gray-400 mb-2">
            {totalResultados === 0
              ? "Sin resultados"
              : `${totalResultados} producto${totalResultados === 1 ? "" : "s"}`}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-52 animate-pulse" />
            ))}
          </div>
        ) : productos.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center mt-4">
            <p className="text-sm text-gray-500 mb-1">No encontramos productos con estos filtros.</p>
            {disponibilidad === "stock" && (
              <button
                onClick={() => setDisponibilidad("pedido")}
                className="text-xs font-bold text-brand-blue underline"
              >
                Buscar en los productos a pedido →
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {productos.map((prod) => (
                <div key={prod.id}>
                  <ProductCard producto={prod} />
                  {agregarAPedido && (
                    <button
                      onClick={() => agregarAlPedido(prod)}
                      disabled={agregando === prod.id}
                      className="w-full bg-green-600 text-white text-xs font-bold py-2 rounded-xl mt-1 disabled:opacity-50"
                    >
                      {agregando === prod.id ? "Agregando..." : "➕ Agregar al pedido"}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {hayMas && (
              <button
                onClick={cargarMas}
                disabled={cargandoMas}
                className="w-full bg-white border border-gray-200 text-gray-700 text-sm font-bold py-3 rounded-xl mt-4 disabled:opacity-50"
              >
                {cargandoMas ? "Cargando..." : "Ver más productos"}
              </button>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
