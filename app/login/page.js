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

  // 1. Verificación unificada y robusta de sesión (Celular o Admin)
  useEffect(() => {
    // Si estamos en la página de login, mostramos el formulario sin bloquear
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/login")) {
      setAutorizado(true);
      return;
    }

    const sesionCliente = typeof window !== "undefined" 
      ? (localStorage.getItem("cliente_sesion") || localStorage.getItem("clic_soluciones_user") || localStorage.getItem("usuario"))
      : null;

    // Si hay sesión local de celular, autorizamos al instante sin esperar a Supabase
    if (sesionCliente) {
      setAutorizado(true);
      return;
    }

    if (!authLoading) {
      if (!user) {
        window.location.href = "/login";
      } else {
        setAutorizado(true);
      }
    }
  }, [user, authLoading]);

  // 2. Cargar productos y categorías desde Supabase una vez verificado el acceso
  useEffect(() => {
    if (!autorizado) return;

    async function cargarDatos() {
      setLoadingData(true);
      try {
        const { data: prodData, error: prodError } = await supabase
          .from("Productos") // Tabla con mayúscula como definimos antes
          .select("*")
          .order("id", { ascending: true });

        if (!prodError && prodData) {
          setProductos(prodData);
        }

        const { data: catData, error: catError } = await supabase
          .from("Categorias") // Tabla con mayúscula como definimos antes
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

  // Función para agregar productos al carrito local
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

  // Filtrar productos según búsqueda y categoría seleccionada
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

  // Pantalla de carga mientras se comprueba el acceso (solo si realmente es necesario)
  if (!autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <Header
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        showSearch={true}
      />

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
            <p className="text-sm text-gray-500 font-medium">Cargando productos...</p>
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-12 card p-6 bg-white rounded-2xl shadow-sm">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-bold text-gray-700">No hay productos disponibles</p>
            <p className="text-xs text-gray-500 mt-1">Probá seleccionando otra categoría o limpiando la búsqueda.</p>
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
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.[...]"></path>
        </svg>
      </a>

      <BottomNav />
    </main>
  );
}
