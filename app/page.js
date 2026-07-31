"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [autorizado, setAutorizado] = useState(false);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [mensajeCarrito, setMensajeCarrito] = useState("");

  // =================================================================
  // LÓGICA SENIOR DE AUTENTICACIÓN: A PRUEBA DE BUCLES Y BLOQUEOS
  // =================================================================
  useEffect(() => {
    // 1. Buscamos la sesión del celular apenas carga el componente de forma síncrona.
    const sesionCliente = typeof window !== "undefined" ? localStorage.getItem("cliente_sesion") : null;

    // Si el usuario ingresó con celular, le damos luz verde INMEDIATA.
    // No esperamos ni le preguntamos nada a Supabase. Cortamos acá.
    if (sesionCliente) {
      setAutorizado(true);
      return; 
    }

    // 2. Si NO hay sesión de celular, entonces sí dependemos de Supabase (Admin).
    if (!authLoading) {
      if (user) {
        setAutorizado(true);
      } else {
        // Usamos router.replace en lugar de window.location.href para 
        // no generar historial basura en el navegador y evitar bucles al ir atrás.
        router.replace("/login");
      }
    }
  }, [user, authLoading, router]);

  // PARACAÍDAS DE EMERGENCIA: Si Supabase se cuelga y no responde, 
  // no dejamos al usuario trabado en la pantalla en blanco.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!autorizado) {
        const sesion = typeof window !== "undefined" ? localStorage.getItem("cliente_sesion") : null;
        if (!sesion && !user) {
          router.replace("/login");
        }
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [autorizado, user, router]);

  // =================================================================
  // CARGA DE DATOS (Solo se ejecuta si ya pasó la seguridad)
  // =================================================================
  useEffect(() => {
    if (!autorizado) return;

    async function cargarDatos() {
      setLoadingData(true);
      try {
        const { data: prodData, error: prodError } = await supabase
          .from("productos")
          .select("*")
          .order("id", { ascending: true });

        if (!prodError && prodData) {
          setProductos(prodData);
        }

        const { data: catData, error: catError } = await supabase
          .from("categorias")
          .select("*")
          .order("nombre", { ascending: true });

        if (!catError && catData) {
          setCategorias(catData);
        }
      } catch (err) {
        console.error("Error cargando el catálogo:", err);
      } finally {
        setLoadingData(false);
      }
    }

    cargarDatos();
  }, [autorizado]);

  function agregarAlCarrito(producto) {
    try {
      const carritoActual = JSON.parse(localStorage.getItem("carrito") || "[]");
      const index = carritoActual.findIndex((item) => item.id === producto.id);

      if (index >= 0) {
        carritoActual[index].cantidad = (carritoActual[index].cantidad || 1) + 1;
      } else {
        carritoActual.push({ ...producto, cantidad: 1 });
      }

      localStorage.setItem("carrito", JSON.stringify(carritoActual));

      setMensajeCarrito(`¡${producto.nombre || "Producto"} agregado!`);
      setTimeout(() => setMensajeCarrito(""), 2500);
    } catch (e) {
      console.error("Error al guardar en el carrito:", e);
    }
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

  // PANTALLA DE BLOQUEO TEMPORAL
  if (!autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <Header busqueda={busqueda} setBusqueda={setBusqueda} showSearch={true} />

      {mensajeCarrito && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg transition animate-bounce">
          {mensajeCarrito}
        </div>
      )}

      <div className="max-w-md mx-auto px-4 mt-4">
        {categorias.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
            <button
              onClick={() => setCategoriaSeleccionada("todas")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                categoriaSeleccionada === "todas"
                  ? "bg-brand-blue text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              Todas
            </button>
            {categorias.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoriaSeleccionada(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  categoriaSeleccionada === cat.id
                    ? "bg-brand-blue text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200"
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
          <div className="text-center py-12 card p-6">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-bold text-gray-700">No hay productos disponibles</p>
            <p className="text-xs text-gray-500 mt-1">Probá seleccionando otra categoría.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {productosFiltrados.map((prod) => (
              <div
                key={prod.id}
                className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between"
              >
                <div>
                  {prod.imagen_url ? (
                    <img
                      src={prod.imagen_url}
                      alt={prod.nombre}
                      className="w-full h-32 object-cover rounded-xl mb-2 bg-gray-50"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 rounded-xl mb-2 flex items-center justify-center text-gray-400 text-2xl">
                      📦
                    </div>
                  )}
                  <h3 className="font-bold text-xs text-gray-800 line-clamp-2 leading-tight">
                    {prod.nombre}
                  </h3>
                  {prod.descripcion && (
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">
                      {prod.descripcion}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-50 flex flex-col gap-1.5">
                  <span className="font-black text-sm text-brand-blue">
                    ${Number(prod.precio || 0).toLocaleString("es-AR")}
                  </span>
                  <button
                    onClick={() => agregarAlCarrito(prod)}
                    className="w-full bg-brand-blue text-white text-[11px] font-bold py-2 rounded-xl shadow-sm hover:opacity-95 active:scale-95 transition"
                  >
                    + Agregar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <a
        href="https://wa.me/5492944906160"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 right-4 z-40 bg-green-500 text-white p-3.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition flex items-center justify-center"
        aria-label="Contacto por WhatsApp"
      >
        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
        </svg>
      </a>

      <BottomNav />
    </main>
  );
}
