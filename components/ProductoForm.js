"use client";

import { useState } from "react";
import { CATEGORIAS } from "@/lib/categorias";
import { supabase } from "@/lib/supabaseClient";
import CodigoBarras from "@/components/CodigoBarras";
import CalculadoraPrecio from "@/components/CalculadoraPrecio";
import VideoProducto from "@/components/VideoProducto";
import { normalizarVideoUrl, esLinkCorto, infoVideo } from "@/lib/video";

export { normalizarVideoUrl };

// Convierte el link pegado al reproductor que se ve dentro de la app.
// Los links cortos (vm.tiktok.com, fb.watch, facebook.com/share/...) no
// dicen qué video es: se abren en el servidor para obtener el link completo.
async function prepararVideo(url) {
  if (!url) return null;
  let final = url.trim();
  if (esLinkCorto(final)) {
    try {
      const res = await fetch(`/api/resolver-video?url=${encodeURIComponent(final)}`);
      const data = await res.json();
      if (data?.url) final = data.url;
    } catch {}
  }
  return normalizarVideoUrl(final);
}

function calcularPrecio(costo, margen) {
  const c = Number(costo) || 0;
  const m = Number(margen) || 0;
  if (c <= 0) return "";
  const precio = c * (1 + m / 100);
  return Math.round(precio * 100) / 100;
}

export default function ProductoForm({ initialData, onSubmit, submitLabel }) {
  const [form, setForm] = useState({
    nombre: initialData?.nombre || "",
    descripcion: initialData?.descripcion || "",
    precio: initialData?.precio ?? "",
    precio_oferta: initialData?.precio_oferta ?? "",
    imagen_url: initialData?.imagen_url || "",
    imagen_url_2: initialData?.imagen_url_2 || "",
    imagen_url_3: initialData?.imagen_url_3 || "",
    categoria: initialData?.categoria || "hogar",
    destacado: initialData?.destacado ?? false,
    activo: initialData?.activo ?? true,
    bajo_pedido: initialData?.bajo_pedido ?? false,
    stock: initialData?.stock ?? 0,
    stock_minimo: initialData?.stock_minimo ?? 3,
    costo: initialData?.costo ?? "",
    pct_transferencia: initialData?.pct_transferencia ?? 3,
    pct_dolar: initialData?.pct_dolar ?? 5,
    pct_transporte: initialData?.pct_transporte ?? 15,
    pct_ganancia: initialData?.pct_ganancia ?? 80,
    precio_manual: initialData?.precio_manual ?? false,
    margen_porcentaje: initialData?.margen_porcentaje ?? "",
    video_url: initialData?.video_url || "",
  });
  const [subiendoVideo, setSubiendoVideo] = useState(false);
  const [errorVideo, setErrorVideo] = useState("");
  const [preparandoVideo, setPreparandoVideo] = useState(false);

  // Apenas pegás el link, se convierte y se muestra el video para probarlo
  async function convertirLinkVideo(valor) {
    const texto = String(valor || "").trim();
    if (!texto || texto.startsWith("https://www.youtube.com/embed/")) return;
    setPreparandoVideo(true);
    const listo = await prepararVideo(texto);
    setPreparandoVideo(false);
    if (listo) setForm((prev) => ({ ...prev, video_url: listo }));
  }

  const infoDelVideo = form.video_url ? infoVideo(form.video_url) : null;
  const [precioAutocalculado, setPrecioAutocalculado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function subirVideo(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setErrorVideo("");

    const MAX_MB = 25;
    if (archivo.size > MAX_MB * 1024 * 1024) {
      setErrorVideo(
        `El video pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_MB} MB. ` +
        `Grabá uno más corto o subilo a YouTube y pegá el link acá abajo.`
      );
      e.target.value = "";
      return;
    }

    setSubiendoVideo(true);
    try {
      const extension = archivo.name.split(".").pop();
      const nombreArchivo = `producto-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("videos-productos")
        .upload(nombreArchivo, archivo, { cacheControl: "3600", upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const { data } = supabase.storage
        .from("videos-productos")
        .getPublicUrl(nombreArchivo);

      setForm((prev) => ({ ...prev, video_url: data.publicUrl }));
    } catch (err) {
      setErrorVideo("No se pudo subir el video: " + err.message);
    } finally {
      setSubiendoVideo(false);
      e.target.value = "";
    }
  }

  function handleChange(e) {
    const { name, type, checked, value } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  }

  // La calculadora nos avisa cada vez que cambia un porcentaje, y con eso
  // actualizamos el precio. Si el precio es manual, no lo tocamos.
  function alCambiarCalculo(datos) {
    setForm((prev) => ({
      ...prev,
      pct_transferencia: datos.pct_transferencia,
      pct_dolar: datos.pct_dolar,
      pct_transporte: datos.pct_transporte,
      pct_ganancia: datos.pct_ganancia,
      precio_manual: datos.precio_manual,
      precio: datos.precio_manual ? prev.precio : datos.precio_calculado
    }));
  }

  // costo / margen: al tocarlos, recalculamos el precio final solo
  function handleChangeCalculadora(e) {
    const { name, value } = e.target;
    const nuevoForm = { ...form, [name]: value };

    const costo = name === "costo" ? value : nuevoForm.costo;
    const margen = name === "margen_porcentaje" ? value : nuevoForm.margen_porcentaje;
    const precioCalculado = calcularPrecio(costo, margen);
    if (precioCalculado !== "") {
      nuevoForm.precio = precioCalculado;
      setPrecioAutocalculado(true);
    }

    setForm(nuevoForm);
  }

  function handleChangePrecioManual(e) {
    setPrecioAutocalculado(false);
    handleChange(e);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.nombre.trim() || !form.precio) {
      setError("El nombre y el precio son obligatorios.");
      return;
    }

    setGuardando(true);
    try {
      const stockFinal = Number(form.stock) || 0;
      // Si es un producto "a pedido" pero ya le cargaste stock real, lo pasamos
      // solo a la lista normal de productos (ya no hace falta pedirlo bajo consulta).
      const bajoPedidoFinal = form.bajo_pedido && stockFinal > 0 ? false : form.bajo_pedido;

      await onSubmit({
        ...form,
        precio: Number(form.precio),
        precio_oferta: form.precio_oferta ? Number(form.precio_oferta) : null,
        imagen_url_2: form.imagen_url_2 || null,
        imagen_url_3: form.imagen_url_3 || null,
        bajo_pedido: bajoPedidoFinal,
        stock: stockFinal,
        stock_minimo: Number(form.stock_minimo) || 0,
        costo: form.costo !== "" ? Number(form.costo) : null,
        margen_porcentaje: form.margen_porcentaje !== "" ? Number(form.margen_porcentaje) : null,
        // El flete ya va dentro del % de Transporte: nunca un monto aparte
        costo_envio: 0,
        video_url: await prepararVideo(form.video_url),
      });
    } catch (err) {
      setError(err.message || "Ocurrió un error al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">
          {error}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm bg-purple-50 border border-purple-200 rounded-xl p-3">
        <input
          type="checkbox"
          name="bajo_pedido"
          checked={form.bajo_pedido}
          onChange={handleChange}
        />
        <span className="text-purple-800 font-semibold">
          🛍️ Es "a pedido" (no tengo stock, se pide al proveedor bajo consulta)
        </span>
      </label>
      {form.bajo_pedido && (
        <p className="text-[11px] text-purple-600 -mt-2 ml-1">
          Tip: si le cargás stock (más de 0) y guardás, se va a pasar solo a la lista normal de productos.
        </p>
      )}

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Nombre del producto
        </label>
        <input
          name="nombre"
          value={form.nombre}
          onChange={handleChange}
          className="input-field"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Descripción
        </label>
        <textarea
          name="descripcion"
          value={form.descripcion}
          onChange={handleChange}
          rows={3}
          className="input-field resize-none"
        />
      </div>

      {/* ===== CALCULADORA DE PRECIO ===== */}
      <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-3">
        <p className="text-sm font-bold text-gray-700 mb-2">
          💰 Calculadora de precio
        </p>
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Costo del proveedor
          </label>
          <input
            name="costo"
            type="number"
            step="0.01"
            value={form.costo}
            onChange={handleChangeCalculadora}
            className="input-field"
            placeholder="$"
          />
        </div>

        {/* Desglose con cada recargo editable */}
        <CalculadoraPrecio
          costo={form.costo}
          valores={{
            pct_transferencia: form.pct_transferencia,
            pct_dolar: form.pct_dolar,
            pct_transporte: form.pct_transporte,
            pct_ganancia: form.pct_ganancia
          }}
          precioActual={form.precio}
          precioManual={form.precio_manual}
          onCambio={alCambiarCalculo}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Precio {precioAutocalculado && <span className="text-green-600 font-normal">(calculado)</span>}
          </label>
          <input
            name="precio"
            type="number"
            step="0.01"
            value={form.precio}
            onChange={handleChangePrecioManual}
            className="input-field"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Precio oferta (opcional)
          </label>
          <input
            name="precio_oferta"
            type="number"
            step="0.01"
            value={form.precio_oferta}
            onChange={handleChange}
            className="input-field"
          />
        </div>
      </div>

      {/* ===== IMÁGENES (hasta 3) ===== */}
      <div className="border border-gray-100 bg-gray-50/50 rounded-xl p-3">
        <p className="text-sm font-bold text-gray-700 mb-2">📷 Imágenes (hasta 3)</p>
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Imagen principal
            </label>
            <input
              name="imagen_url"
              value={form.imagen_url}
              onChange={handleChange}
              className="input-field"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Imagen 2 (opcional)
            </label>
            <input
              name="imagen_url_2"
              value={form.imagen_url_2}
              onChange={handleChange}
              className="input-field"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Imagen 3 (opcional)
            </label>
            <input
              name="imagen_url_3"
              value={form.imagen_url_3}
              onChange={handleChange}
              className="input-field"
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* VIDEO DEL PRODUCTO */}
      <div className="border border-gray-200 rounded-xl p-3">
        <p className="text-sm font-semibold text-gray-700 mb-1">🎥 Video (opcional)</p>
        <p className="text-[11px] text-gray-500 mb-3">
          Un video mostrando el producto funcionando vende mucho más que una foto.
        </p>

        <div className="mb-3">
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Subir un video desde el celular (hasta 25 MB)
          </label>
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={subirVideo}
            disabled={subiendoVideo}
            className="text-xs w-full file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-blue file:text-white"
          />
          {subiendoVideo && (
            <p className="text-xs text-brand-blue font-medium mt-1">Subiendo video, esperá...</p>
          )}
          {errorVideo && (
            <p className="text-xs text-red-600 font-medium mt-1">{errorVideo}</p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            O pegá el link del video
          </label>
          <input
            name="video_url"
            value={form.video_url}
            onChange={handleChange}
            onPaste={(e) => {
              const pegado = e.clipboardData.getData("text");
              if (pegado) {
                e.preventDefault();
                setForm((prev) => ({ ...prev, video_url: pegado.trim() }));
                convertirLinkVideo(pegado);
              }
            }}
            onBlur={(e) => convertirLinkVideo(e.target.value)}
            className="input-field"
            placeholder="Link de YouTube, Instagram, TikTok, Facebook..."
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Sirve YouTube, Instagram, TikTok, Facebook o Vimeo. Copiá el link con el botón
            "Compartir" de la app y pegalo acá. El video se reproduce dentro de la tienda,
            sin mandar al cliente afuera. Tiene que ser un video público.
          </p>
        </div>

        {form.video_url && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              {preparandoVideo ? (
                <p className="text-xs font-semibold text-brand-blue">Buscando el video...</p>
              ) : infoDelVideo?.tipo === "invalido" || esLinkCorto(form.video_url) ? (
                <p className="text-xs font-semibold text-red-600">
                  ✗ Este link no se puede reproducir dentro de la app
                </p>
              ) : (
                <p className="text-xs font-semibold text-green-700">
                  ✓ Video de {infoDelVideo?.red} listo. Probalo acá abajo
                </p>
              )}
              <button
                type="button"
                onClick={() => setForm({ ...form, video_url: "" })}
                className="text-xs font-semibold text-red-500"
              >
                Quitar
              </button>
            </div>
            {!preparandoVideo && (infoDelVideo?.tipo === "invalido" || esLinkCorto(form.video_url)) ? (
              <p className="text-[11px] text-red-600">
                Probá abrir el video en la red social y copiar el link desde "Compartir" → "Copiar
                link" otra vez, o descargá el video y subilo con el botón de arriba. Si se guarda
                así, el video no se va a mostrar en la tienda.
              </p>
            ) : (
              !preparandoVideo && (
                <VideoProducto url={form.video_url} titulo="Vista previa" compacto />
              )
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Categoría
          </label>
          <select
            name="categoria"
            value={form.categoria}
            onChange={handleChange}
            className="input-field"
          >
            {CATEGORIAS.filter((c) => c.slug !== "ofertas").map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Stock
          </label>
          <input
            name="stock"
            type="number"
            value={form.stock}
            onChange={handleChange}
            className="input-field"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Stock mínimo (para avisarte cuándo pedirle a tu proveedor)
        </label>
        <input
          name="stock_minimo"
          type="number"
          value={form.stock_minimo}
          onChange={handleChange}
          className="input-field"
        />
      </div>

      <div className="flex gap-6 mt-1">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="destacado"
            checked={form.destacado}
            onChange={handleChange}
          />
          Destacado
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="activo"
            checked={form.activo}
            onChange={handleChange}
          />
          Activo (visible en la tienda)
        </label>
      </div>

      {/* Código de barras: solo tiene sentido en productos ya creados,
          porque hace falta el id para asociarlo. */}
      {initialData?.id && (
        <CodigoBarras
          productoId={initialData.id}
          codigoActual={initialData.codigo_barras}
        />
      )}

      <button disabled={guardando} className="btn-primary mt-2">
        {guardando ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}
