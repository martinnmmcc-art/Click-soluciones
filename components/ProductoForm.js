"use client";

import { useState } from "react";
import { CATEGORIAS } from "@/lib/categorias";

export default function ProductoForm({ initialData, onSubmit, submitLabel }) {
  const [form, setForm] = useState({
    nombre: initialData?.nombre || "",
    descripcion: initialData?.descripcion || "",
    precio: initialData?.precio ?? "",
    precio_oferta: initialData?.precio_oferta ?? "",
    imagen_url: initialData?.imagen_url || "",
    categoria: initialData?.categoria || "hogar",
    destacado: initialData?.destacado ?? false,
    activo: initialData?.activo ?? true,
    stock: initialData?.stock ?? 0
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, type, checked, value } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
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
      await onSubmit({
        ...form,
        precio: Number(form.precio),
        precio_oferta: form.precio_oferta ? Number(form.precio_oferta) : null,
        stock: Number(form.stock) || 0
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Precio
          </label>
          <input
            name="precio"
            type="number"
            step="0.01"
            value={form.precio}
            onChange={handleChange}
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

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          URL de la imagen
        </label>
        <input
          name="imagen_url"
          value={form.imagen_url}
          onChange={handleChange}
          className="input-field"
          placeholder="https://..."
        />
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
