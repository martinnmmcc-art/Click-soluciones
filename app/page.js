"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import BannerOfertas from "@/components/BannerOfertas";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/context/CartContext";
import { buildWhatsAppLink, whatsappProductMessage } from "@/lib/whatsapp";

export default function HomePage() {
  const { addItem } = useCart();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [masVendidos, setMasVendidos] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [mensajeCarrito, setMensajeCarrito] = useState("");

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

        const { data: catData, error: catError } = await supabase
          .from("Categorias")
          .select("*")
          .order("nombre", { ascending: true });

        if (catError) {
          console.error("Error en Categorias:", catError.message);
        } else if (catData) {
          setCategorias(catData);
        }
      } catch (err) {
        console.error("Error general de red:", err);
      } finally {
        setLoadingData(false);
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
      categoriaSeleccionada === "todas" ||
      prod.categoria_id === categoriaSeleccionada ||
      prod.categoria === categoriaSeleccionada;

    const coincideBusqueda =
      !busqueda.trim() ||
      prod.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      prod.descripcion?.toLowerCase().includes(busqueda.toLowerCase());

    return coincideCategoria && coincideBusqueda;
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

      <BannerOfertas />

      <div className="max-w-md mx-auto px-4 mt-3">
        <Link
          href="/a-pedido"
          className="block bg-purple-50 border border-purple-200 rounded-xl py-2.5 px-3 text-center"
        >
          <span className="text-[12px] text-purple-800 font-bold">
            🛍️ ¿No lo encontrás? Mirá los productos a pedido →
          </span>
        </Link>
      </div>

      <div className="max-w-md mx-auto px-4 mt-3">
        <p className="text-[11px] text-gray-500 text-center bg-gray-100 rounded-full py-1.5 px-3">
          🚚 Envíos a El Bolsón y la Comarca Andina — coordinamos transporte local o punto de encuentro
        </p>
      </div>

      {destacados.length > 0 && (
        <div className="mt-5">
          <div className="max-w-md mx-auto px-4 flex items-center gap-1.5 mb-2">
            <span className="text-lg">⭐</span>
            <h2 className="font-extrabold text-gray-800 text-sm">Destacados</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
            {destacados.map((prod) => {
              const tieneOferta = prod.precio_oferta && Number(prod.precio_oferta) < Number(prod.precio);
              return (
                <Link
                  key={prod.id}
                  href={`/producto/${prod.id}`}
                  className="flex-shrink-0 w-32 bg-white rounded-2xl p-2.5 border border-amber-200 shadow-sm"
                >
                  <div className="relative">
                    {prod.imagen_url ? (
                      <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-24 object-cover rounded-xl mb-1.5 bg-gray-50" />
                    ) : (
                      <div className="w-full h-24 bg-gray-100 rounded-xl mb-1.5 flex items-center justify-center text-gray-400 text-xl">📦</div>
                    )}
                    <span className="absolute top-1 left-1 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                      ⭐ DESTACADO
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-gray-800 line-clamp-2 leading-tight">{prod.nombre}</p>
                  <p className="text-xs font-black text-brand-blue mt-1">
                    ${Number((tieneOferta ? prod.precio_oferta : prod.precio) || 0).toLocaleString("es-AR")}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {masVendidos.length > 0 && (
        <div className="mt-5">
          <div className="max-w-md mx-auto px-4 flex items-center gap-1.5 mb-2">
            <span className="text-lg">🔥</span>
            <h2 className="font-extrabold text-gray-800 text-sm">Los más vendidos</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
            {masVendidos.map((prod) => {
              const tieneOferta = prod.precio_oferta && Number(prod.precio_oferta) < Number(prod.precio);
              return (
                <Link
                  key={prod.id}
                  href={`/producto/${prod.id}`}
                  className="flex-shrink-0 w-32 bg-white rounded-2xl p-2.5 border border-gray-100 shadow-sm"
                >
                  <div className="relative">
                    {prod.imagen_url ? (
                      <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-24 object-cover rounded-xl mb-1.5 bg-gray-50" />
                    ) : (
                      <div className="w-full h-24 bg-gray-100 rounded-xl mb-1.5 flex items-center justify-center text-gray-400 text-xl">📦</div>
                    )}
                    <span className="absolute top-1 left-1 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                      🔥 TOP
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-gray-800 line-clamp-2 leading-tight">{prod.nombre}</p>
                  <p className="text-xs font-black text-brand-blue mt-1">
                    ${Number((tieneOferta ? prod.precio_oferta : prod.precio) || 0).toLocaleString("es-AR")}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 mt-4">
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
                  <Link href={`/producto/${prod.id}`} className="block relative">
                    {prod.imagen_url ? (
                      <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-32 object-cover rounded-xl mb-2 bg-gray-50" />
                    ) : (
