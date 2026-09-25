"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";

// Carga productos que ya pediste al proveedor y todavía no llegaron, para
// que el cliente los vea sin precio y se anticipe a pedirlos.
function ProximoPedido() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [fechaEstimada, setFechaEstimada] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  async function cargar() {
    setLoading(true);
    const { data } = await supabase
      .from("proximo_pedido")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: false });
    setLista(data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function subirFoto(archivo) {
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const nombreArchivo = `proximo-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("fotos-productos")
        .upload(nombreArchivo, archivo, { contentType: archivo.type });

      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from("fotos-productos").getPublicUrl(nombreArchivo);
      setImagenUrl(data.publicUrl);
    } catch (e) {
      alert("No se pudo subir la foto: " + e.message);
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function agregar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      const { error } = await supabase.from("proximo_pedido").insert({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        imagen_url: imagenUrl || null,
        fecha_estimada: fechaEstimada || null
      });

      if (error) throw new Error(error.message);

      setNombre("");
      setDescripcion("");
      setImagenUrl("");
      setFechaEstimada("");
      cargar();
    } catch (e) {
      alert("No se pudo agregar: " + e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function alternarVisible(item) {
    await supabase
      .from("proximo_pedido")
      .update({ visible: !item.visible })
      .eq("id", item.id);
    cargar();
  }

  async function borrar(item) {
    if (!confirm(`¿Sacar "${item.nombre}" de próximo pedido?`)) return;
    await supabase.from("proximo_pedido").delete().eq("id", item.id);
    cargar();
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">
          🚚 Próximo pedido
        </h1>
        <p className="text-xs text-gray-500 mb-4">
          Mostrale al cliente lo que ya pediste, sin precio, para que se
          anticipe a reservarlo.
        </p>

        {/* Agregar uno nuevo */}
        <div className="bg-white rounded-2xl border-2 border-amber-300 p-4 mb-4">
          <p className="text-sm font-bold text-gray-800 mb-2">Agregar producto</p>

          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
            placeholder="Nombre del producto"
          />

          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
            placeholder="Descripción breve (opcional)"
            rows={2}
          />

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[11px] font-bold text-gray-600 block mb-1">
                Foto
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => subirFoto(e.target.files?.[0])}
                disabled={subiendoFoto}
                className="text-[11px] w-full"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 block mb-1">
                Llega aprox.
              </label>
              <input
                type="date"
                value={fechaEstimada}
                onChange={(e) => setFechaEstimada(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
          </div>

          {imagenUrl && (
            <div className="w-16 h-16 bg-gray-50 rounded-lg overflow-hidden mb-2">
              <img src={imagenUrl} alt="" className="w-full h-full object-contain" />
            </div>
          )}

          <button
            onClick={agregar}
            disabled={guardando || !nombre.trim() || subiendoFoto}
            className="w-full bg-brand-blue text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50"
          >
            {guardando ? "Agregando..." : "Agregar a próximo pedido"}
          </button>
        </div>

        {/* Lista actual */}
        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : lista.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
            <p className="text-sm text-gray-600">No hay nada cargado todavía.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-3 flex items-center gap-3 ${
                  item.visible ? "border-gray-100" : "border-gray-200 opacity-60"
                }`}
              >
                <div className="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {item.imagen_url ? (
                    <img src={item.imagen_url} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-lg">📦</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 line-clamp-1">
                    {item.nombre}
                  </p>
                  {item.fecha_estimada && (
                    <p className="text-[10px] text-amber-700">
                      Llega: {new Date(item.fecha_estimada).toLocaleDateString("es-AR")}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => alternarVisible(item)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap ${
                    item.visible ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {item.visible ? "Visible" : "Oculto"}
                </button>

                <button
                  onClick={() => borrar(item)}
                  className="text-red-500 text-xs font-bold px-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ProximoPedidoPage() {
  return (
    <AdminGuard>
      <ProximoPedido />
    </AdminGuard>
  );
}
