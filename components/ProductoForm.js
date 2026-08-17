"use client";

import { useState } from "react";
import { CATEGORIAS } from "@/lib/categorias";

function calcularPrecio(costo, margen, envio) {
  const c = Number(costo) || 0;
  const m = Number(margen) || 0;
  const e = Number(envio) || 0;
  if (c <= 0) return "";
  const precio = c * (1 + m / 100) + e;
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
    margen_porcentaje: initialData?.margen_porcentaje ?? "",
    costo_envio: initialData?.costo_envio ?? "",
  });
  const [precioAutocalculado, setPrecioAutocalculado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, type, checked, value } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  }

  // costo / margen / envío: al tocarlos, recalculamos el precio final solo
  function handleChangeCalculadora(e) {
    const { name, value } = e.target;
    const nuevoForm = { ...form, [name]: value };

    const costo = name === "costo" ? value : nuevoForm.costo;
    const margen = name === "margen_porcentaje" ? value : nuevoForm.margen_porcentaje;
    const envio = name === "costo_envio" ? value : nuevoForm.costo_envio;

    const precioCalculado = calcularPrecio(costo, margen, envio);
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
        costo_envio: form.costo_envio !== "" ? Number(form.costo_envio) : 0,
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
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Costo
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
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Margen %
            </label>
            <input
              name="margen_porcentaje"
              type="number"
              step="0.1"
              value={form.margen_porcentaje}
              onChange={handleChangeCalculadora}
              className="input-field"
              placeholder="%"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Envío
            </label>
            <input
              name="costo_envio"
              type="number"
              step="0.01"
              value={form.costo_envio}
              onChange={handleChangeCalculadora}
              className="input-field"
              placeholder="$"
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Precio final = costo + margen % sobre el costo + envío. Se completa solo abajo, en
          &quot;Precio&quot; — lo podés ajustar a mano si querés.
        </p>
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

      <button disabled={guardando} className="btn-primary mt-2">
        {guardando ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}
