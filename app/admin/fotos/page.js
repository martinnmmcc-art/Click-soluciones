"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";

const CAMPOS = [
  "imagen_url",
  "imagen_url_2",
  "imagen_url_3",
  "imagen_url_4",
  "imagen_url_5",
  "imagen_url_6"
];

// Achica la foto antes de subirla: las del celular pesan 4 o 5 MB y en la
// Comarca eso significa que el cliente tarda una eternidad en verla.
function achicarFoto(archivo, maxLado = 1200, calidad = 0.82) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxLado || height > maxLado) {
          const escala = maxLado / Math.max(width, height);
          width = Math.round(width * escala);
          height = Math.round(height * escala);
        }

        const lienzo = document.createElement("canvas");
        lienzo.width = width;
        lienzo.height = height;
        const ctx = lienzo.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        lienzo.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falló"))),
          "image/jpeg",
          calidad
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    lector.onerror = reject;
    lector.readAsDataURL(archivo);
  });
}

function Fotos() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("pocas");
  const [subiendo, setSubiendo] = useState(null);
  const [abierto, setAbierto] = useState(null);

  async function cargar() {
    setLoading(true);
    const { data } = await supabase
      .from("Productos")
      .select(
        "id, nombre, stock, imagen_url, imagen_url_2, imagen_url_3, imagen_url_4, imagen_url_5, imagen_url_6"
      )
      .or("bajo_pedido.is.null,bajo_pedido.eq.false")
      .eq("activo", true)
      .order("stock", { ascending: false });

    setProductos(data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function cantidadFotos(p) {
    return CAMPOS.filter((c) => p[c] && String(p[c]).trim() !== "").length;
  }

  async function subirFotos(producto, archivos) {
    if (!archivos || archivos.length === 0) return;

    setSubiendo(producto.id);
    try {
      // Buscamos los espacios libres de este producto
      const libres = CAMPOS.filter(
        (c) => !producto[c] || String(producto[c]).trim() === ""
      );

      if (libres.length === 0) {
        alert("Este producto ya tiene las 6 fotos. Borrá alguna para agregar otra.");
        return;
      }

      const aSubir = Array.from(archivos).slice(0, libres.length);
      const cambios = {};

      for (let i = 0; i < aSubir.length; i++) {
        const comprimida = await achicarFoto(aSubir[i]);
        const nombre = `p${producto.id}-${Date.now()}-${i}.jpg`;

        const { error: errorSubida } = await supabase.storage
          .from("fotos-productos")
          .upload(nombre, comprimida, { contentType: "image/jpeg" });

        if (errorSubida) throw new Error(errorSubida.message);

        const { data } = supabase.storage.from("fotos-productos").getPublicUrl(nombre);
        cambios[libres[i]] = data.publicUrl;
      }

      const { error } = await supabase
        .from("Productos")
        .update(cambios)
        .eq("id", producto.id);

      if (error) throw new Error(error.message);

      if (archivos.length > libres.length) {
        alert(
          `Se subieron ${libres.length} fotos. Las otras ${
            archivos.length - libres.length
          } no entraron: el producto admite 6 en total.`
        );
      }

      cargar();
    } catch (e) {
      alert("No se pudo subir: " + e.message);
    } finally {
      setSubiendo(null);
    }
  }

  async function borrarFoto(producto, campo) {
    if (!confirm("¿Borrar esta foto?")) return;

    const { error } = await supabase
      .from("Productos")
      .update({ [campo]: null })
      .eq("id", producto.id);

    if (error) {
      alert("No se pudo borrar: " + error.message);
      return;
    }
    cargar();
  }

  const filtrados = productos
    .filter((p) => {
      const q = busqueda.trim().toLowerCase();
      if (q && !p.nombre?.toLowerCase().includes(q)) return false;

      const n = cantidadFotos(p);
      if (filtro === "sin") return n === 0;
      if (filtro === "pocas") return n > 0 && n < 3;
      if (filtro === "stock") return Number(p.stock || 0) > 0;
      return true;
    })
    .sort((a, b) => cantidadFotos(a) - cantidadFotos(b));

  const conPocas = productos.filter((p) => cantidadFotos(p) < 3).length;

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">
          Completar fotos
        </h1>
        <p className="text-xs text-gray-500 mb-4">
          Sacá las fotos con el celular y subilas de a varias. Se achican solas
          para que carguen rápido.
        </p>

        <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-3 mb-4">
          <p className="text-xs text-gray-700">
            <b>{conPocas} productos</b> tienen menos de 3 fotos. Las fotos reales
            —el producto en tu mano, con algo al lado para dar idea del tamaño—
            venden más que las de catálogo: el cliente ve que lo tenés de verdad.
          </p>
        </div>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 mb-3"
          placeholder="🔍 Buscar producto..."
        />

        <div className="flex gap-2 overflow-x-auto pb-3">
          {[
            { id: "pocas", label: "Con pocas fotos" },
            { id: "sin", label: "Sin fotos" },
            { id: "stock", label: "Los que tengo" },
            { id: "todos", label: "Todos" }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                filtro === f.id
                  ? "bg-brand-blue text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-500 text-sm border border-gray-100">
            No hay productos en esta categoría.
          </div>
        ) : (
          <div className="space-y-3">
            {filtrados.map((p) => {
              const n = cantidadFotos(p);
              const estaAbierto = abierto === p.id;

              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {p.imagen_url ? (
                        <img
                          src={p.imagen_url}
                          alt=""
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span className="text-xl">📦</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 line-clamp-2 leading-tight">
                        {p.nombre}
                      </p>
                      <p
                        className={`text-[11px] font-bold mt-0.5 ${
                          n === 0
                            ? "text-red-600"
                            : n < 3
                            ? "text-amber-600"
                            : "text-green-600"
                        }`}
                      >
                        {n} de 6 fotos
                        {Number(p.stock || 0) > 0 && (
                          <span className="text-gray-400 font-normal">
                            {" "}· stock {p.stock}
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={() => setAbierto(estaAbierto ? null : p.id)}
                      className="text-xs font-bold text-brand-blue whitespace-nowrap"
                    >
                      {estaAbierto ? "Cerrar" : "Ver"}
                    </button>
                  </div>

                  {estaAbierto && (
                    <div className="border-t border-gray-100 mt-3 pt-3">
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {CAMPOS.map((campo) => {
                          const url = p[campo];
                          if (!url) return null;
                          return (
                            <div key={campo} className="relative">
                              <div className="w-full aspect-square bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
                                <img
                                  src={url}
                                  alt=""
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                              <button
                                onClick={() => borrarFoto(p, campo)}
                                className="absolute -top-1.5 -right-1.5 bg-red-600 text-white w-5 h-5 rounded-full text-[11px] font-bold shadow"
                                aria-label="Borrar foto"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <label className="block">
                        <span className="block text-[11px] font-bold text-gray-600 mb-1">
                          Agregar fotos ({6 - n} espacios libres)
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          capture="environment"
                          disabled={subiendo === p.id || n >= 6}
                          onChange={(e) => subirFotos(p, e.target.files)}
                          className="text-xs w-full file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-blue file:text-white disabled:opacity-50"
                        />
                      </label>

                      {subiendo === p.id && (
                        <p className="text-xs text-brand-blue font-bold mt-2">
                          Subiendo y achicando las fotos...
                        </p>
                      )}

                      <p className="text-[10px] text-gray-400 mt-2">
                        Podés elegir varias de una vez. Se achican solas antes de
                        subirse, así el cliente las ve rápido aunque tenga poca señal.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function FotosPage() {
  return (
    <AdminGuard>
      <Fotos />
    </AdminGuard>
  );
}
