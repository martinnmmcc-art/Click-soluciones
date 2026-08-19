"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { buildWhatsAppLink } from "@/lib/whatsapp";

function ArmarCatalogo() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [titulo, setTitulo] = useState("Catálogo Bolson Click");
  const [seleccionados, setSeleccionados] = useState([]);
  const [fotos, setFotos] = useState("principal"); // "principal" o "todas"
  const [mostrarPrecio, setMostrarPrecio] = useState(true);
  const [mostrarStock, setMostrarStock] = useState(true);
  const [mostrarDescripcion, setMostrarDescripcion] = useState(true);

  const [linkGenerado, setLinkGenerado] = useState("");
  const [copiado, setCopiado] = useState(false);

  // Filtro por tipo: para armar catálogos separados de lo que tenés en mano
  // y de lo que se trae a pedido.
  const [filtroTipo, setFiltroTipo] = useState("todos");

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from("Productos")
        .select("id, nombre, imagen_url, precio, activo, stock, bajo_pedido")
        .order("nombre", { ascending: true });
      setProductos(data || []);
      setLoading(false);
    }
    cargar();
  }, []);

  function toggleProducto(id) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
    setLinkGenerado("");
  }

  // Un producto "en stock" es el que tenés físicamente disponible ahora.
  // "A pedido" es el del proveedor, que se encarga cuando alguien lo pide.
  function esAPedido(p) {
    return !!p.bajo_pedido;
  }
  function tieneStock(p) {
    return !p.bajo_pedido && p.stock !== null && Number(p.stock) > 0;
  }
  function sinStock(p) {
    return !p.bajo_pedido && (p.stock === null || Number(p.stock) <= 0);
  }

  const productosFiltrados = productos.filter((p) => {
    if (filtroTipo === "stock") return tieneStock(p);
    if (filtroTipo === "pedido") return esAPedido(p);
    if (filtroTipo === "sin_stock") return sinStock(p);
    return true;
  });

  const contadores = {
    todos: productos.length,
    stock: productos.filter(tieneStock).length,
    pedido: productos.filter(esAPedido).length,
    sin_stock: productos.filter(sinStock).length
  };

  function seleccionarTodos() {
    // Selecciona solo los que se ven con el filtro actual
    setSeleccionados(productosFiltrados.map((p) => p.id));
    setLinkGenerado("");
  }

  function limpiarSeleccion() {
    setSeleccionados([]);
    setLinkGenerado("");
  }

  function generarLink() {
    if (seleccionados.length === 0) return;


    const params = new URLSearchParams();
    params.set("ids", seleccionados.join(","));
    params.set("titulo", titulo || "Catálogo Bolson Click");
    params.set("fotos", fotos);
    params.set("precio", mostrarPrecio ? "1" : "0");
    params.set("stock", mostrarStock ? "1" : "0");
    params.set("desc", mostrarDescripcion ? "1" : "0");

    const url = `https://www.bolsonclick.com.ar/catalogo-compartir?${params.toString()}`;
    setLinkGenerado(url);
    setCopiado(false);
  }

  function construirParams() {
    const params = new URLSearchParams();
    params.set("ids", seleccionados.join(","));
    params.set("titulo", titulo || "Catálogo Bolson Click");
    params.set("fotos", fotos);
    params.set("precio", mostrarPrecio ? "1" : "0");
    params.set("stock", mostrarStock ? "1" : "0");
    params.set("desc", mostrarDescripcion ? "1" : "0");
    return params;
  }

  function descargarPdf() {
    if (seleccionados.length === 0) return;
    const params = construirParams();
    window.open(`/api/catalogo-pdf?${params.toString()}`, "_blank");
  }

  async function compartir() {
    if (!linkGenerado) return;
    const texto = `Te comparto nuestro catálogo de Bolson Click 🛍️`;

    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, text: texto, url: linkGenerado });
        return;
      } catch (e) {
        // si cancela el share nativo, no hacemos nada más
        return;
      }
    }
    // fallback: abrir WhatsApp con el link en el texto
    window.open(buildWhatsAppLink(`${texto}\n\n${linkGenerado}`), "_blank");
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkGenerado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <main className="min-h-screen bg-brand-bg pb-16">
      <div className="container-app px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="font-extrabold text-xl text-gray-800 mt-1 mb-5">
          Armar catálogo para compartir
        </h1>

        {/* TÍTULO */}
        <div className="card p-4 mb-4">
          <label className="text-sm font-semibold text-gray-700 block mb-1">
            Título del catálogo
          </label>
          <input
            value={titulo}
            onChange={(e) => { setTitulo(e.target.value); setLinkGenerado(""); }}
            className="input-field"
            placeholder="Ej: Ofertas de agosto"
          />
        </div>

        {/* OPCIONES */}
        <div className="card p-4 mb-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Opciones</p>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">Fotos por producto</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setFotos("principal"); setLinkGenerado(""); }}
                className={`flex-1 text-xs font-bold py-2 rounded-lg border ${fotos === "principal" ? "bg-brand-blue text-white border-brand-blue" : "bg-white text-gray-600 border-gray-200"}`}
              >
                Solo 1 foto
              </button>
              <button
                type="button"
                onClick={() => { setFotos("todas"); setLinkGenerado(""); }}
                className={`flex-1 text-xs font-bold py-2 rounded-lg border ${fotos === "todas" ? "bg-brand-blue text-white border-brand-blue" : "bg-white text-gray-600 border-gray-200"}`}
              >
                Todas las fotos
              </button>
            </div>
          </div>

          <label className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-700">Mostrar precio</span>
            <input
              type="checkbox"
              checked={mostrarPrecio}
              onChange={(e) => { setMostrarPrecio(e.target.checked); setLinkGenerado(""); }}
              className="w-5 h-5"
            />
          </label>
          <label className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-700">Mostrar stock (última unidad / sin stock)</span>
            <input
              type="checkbox"
              checked={mostrarStock}
              onChange={(e) => { setMostrarStock(e.target.checked); setLinkGenerado(""); }}
              className="w-5 h-5"
            />
          </label>
          <label className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-700">Mostrar descripción</span>
            <input
              type="checkbox"
              checked={mostrarDescripcion}
              onChange={(e) => { setMostrarDescripcion(e.target.checked); setLinkGenerado(""); }}
              className="w-5 h-5"
            />
          </label>
        </div>

        {/* SELECCIÓN DE PRODUCTOS */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">
              Productos ({seleccionados.length} seleccionados)
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={seleccionarTodos} className="text-xs font-bold text-brand-blue">
                Todos
              </button>
              <button type="button" onClick={limpiarSeleccion} className="text-xs font-bold text-red-500">
                Ninguno
              </button>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1">
            {[
              { id: "todos", label: `Todos (${contadores.todos})` },
              { id: "stock", label: `Con stock (${contadores.stock})` },
              { id: "pedido", label: `A pedido (${contadores.pedido})` },
              { id: "sin_stock", label: `Sin stock (${contadores.sin_stock})` }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroTipo(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${
                  filtroTipo === f.id
                    ? "bg-brand-blue text-white border-brand-blue"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-center text-gray-400 text-sm py-6">Cargando productos...</p>
          ) : productosFiltrados.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">
              No hay productos en esta categoría.
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {productosFiltrados.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer ${
                    seleccionados.includes(p.id) ? "border-brand-blue bg-blue-50" : "border-gray-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(p.id)}
                    onChange={() => toggleProducto(p.id)}
                    className="w-4 h-4"
                  />
                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm">📦</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-700 line-clamp-2 block">{p.nombre}</span>
                    {esAPedido(p) ? (
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        A pedido
                      </span>
                    ) : tieneStock(p) ? (
                      <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        Stock: {p.stock}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        Sin stock
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={generarLink}
            disabled={seleccionados.length === 0}
            className="btn-primary flex-1 disabled:opacity-40"
          >
            🔗 Generar link
          </button>
          <button
            onClick={descargarPdf}
            disabled={seleccionados.length === 0}
            className="btn-secondary flex-1 disabled:opacity-40"
          >
            📄 Descargar PDF
          </button>
        </div>

        {linkGenerado && (
          <div className="card p-4 mt-4 space-y-3">
            <p className="text-xs text-gray-500 break-all">{linkGenerado}</p>
            <div className="flex gap-2">
              <button onClick={copiarLink} className="btn-secondary flex-1 text-sm">
                {copiado ? "✓ Copiado" : "Copiar link"}
              </button>
              <button onClick={compartir} className="btn-primary flex-1 text-sm">
                📤 Compartir
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function CompartirCatalogoPage() {
  return (
    <AdminGuard>
      <ArmarCatalogo />
    </AdminGuard>
  );
}
