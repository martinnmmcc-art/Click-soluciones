"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";

function APedidoAdmin() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    caracteristicas: "",
    precio: "",
    imagen_url: "",
    imagen_url_2: "",
    imagen_url_3: ""
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function cargar() {
    setLoading(true);
    const { data } = await supabase
      .from("Productos")
      .select("*")
      .eq("bajo_pedido", true)
      .order("nombre", { ascending: true });
    setProductos(data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleAgregar(e) {
    e.preventDefault();
    setError("");

    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setGuardando(true);
    try {
      const { error: insertError } = await supabase.from("Productos").insert({
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        caracteristicas: form.caracteristicas.trim(),
        precio: form.precio ? Number(form.precio) : null,
        imagen_url: form.imagen_url.trim(),
        imagen_url_2: form.imagen_url_2.trim(),
        imagen_url_3: form.imagen_url_3.trim(),
        bajo_pedido: true,
        activo: true,
        stock: null,
        categoria: "a-pedido"
      });

      if (insertError) throw new Error(insertError.message);

      setForm({ nombre: "", descripcion: "", caracteristicas: "", precio: "", imagen_url: "", imagen_url_2: "", imagen_url_3: "" });
      setMostrarForm(false);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function sacarDeAPedido(id) {
    if (!confirm("¿Sacar este producto de la sección 'A pedido'? (no se elimina, solo deja de mostrarse ahí)")) return;
    await supabase.from("Productos").update({ bajo_pedido: false }).eq("id", id);
    cargar();
  }

  return (
    <main className="min-h-screen bg-brand-bg pb-16">
      <div className="container-app px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <div className="flex items-center justify-between mt-1 mb-5">
          <h1 className="font-extrabold text-xl text-gray-800">
            A pedido ({productos.length})
          </h1>
          <button
            onClick={() => setMostrarForm(!mostrarForm)}
            className="bg-purple-600 text-white text-xs font-bold px-3 py-2 rounded-xl"
          >
            {mostrarForm ? "Cancelar" : "+ Agregar"}
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Estos productos aparecen en la sección pública "A pedido" de la app, separados del catálogo normal.
          El cliente los consulta por WhatsApp, no se descuenta stock.
        </p>

        {mostrarForm && (
          <form onSubmit={handleAgregar} className="card p-4 mb-4 space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Nombre *</label>
              <input name="nombre" value={form.nombre} onChange={handleChange} className="input-field" placeholder="Nombre del producto" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Descripción</label>
              <textarea name="descripcion" value={form.descripcion} onChange={handleChange} rows={2} className="input-field resize-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Características</label>
              <textarea name="caracteristicas" value={form.caracteristicas} onChange={handleChange} rows={2} className="input-field resize-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Precio aproximado (opcional)</label>
              <input name="precio" value={form.precio} onChange={handleChange} className="input-field" placeholder="Ej: 15000" inputMode="numeric" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Imagen principal (URL)</label>
              <input name="imagen_url" value={form.imagen_url} onChange={handleChange} className="input-field" placeholder="https://..." />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Imagen 2 (opcional)</label>
              <input name="imagen_url_2" value={form.imagen_url_2} onChange={handleChange} className="input-field" placeholder="https://..." />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Imagen 3 (opcional)</label>
              <input name="imagen_url_3" value={form.imagen_url_3} onChange={handleChange} className="input-field" placeholder="https://..." />
            </div>

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

            <button disabled={guardando} className="btn-primary w-full text-sm disabled:opacity-50">
              {guardando ? "Guardando..." : "Guardar producto a pedido"}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : productos.length === 0 ? (
          <div className="card p-6 text-center text-gray-500">
            Todavía no cargaste productos a pedido.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {productos.map((p) => (
              <div key={p.id} className="card p-3 flex gap-3 items-center">
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <span>📦</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.nombre}</p>
                  {p.precio && <p className="text-xs text-purple-700 font-bold">Aprox. ${Number(p.precio).toLocaleString("es-AR")}</p>}
                </div>
                <button onClick={() => sacarDeAPedido(p.id)} className="text-xs font-bold text-red-500 flex-shrink-0">
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function APedidoAdminPage() {
  return (
    <AdminGuard>
      <APedidoAdmin />
    </AdminGuard>
  );
}
