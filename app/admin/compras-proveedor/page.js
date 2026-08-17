"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

function ComprasProveedor() {
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const hoy = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    fecha: hoy,
    subtotal: "",
    flete: "",
    nota: ""
  });

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("compras_proveedor")
      .select("*")
      .order("fecha", { ascending: false });
    if (error) setError(error.message);
    setCompras(data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.fecha || !form.subtotal) {
      setError("Completá al menos la fecha y el subtotal.");
      return;
    }

    setGuardando(true);
    const { error: insertError } = await supabase.from("compras_proveedor").insert({
      fecha: form.fecha,
      subtotal: Number(form.subtotal) || 0,
      flete: Number(form.flete) || 0,
      nota: form.nota || null
    });

    if (insertError) {
      setError(insertError.message);
      setGuardando(false);
      return;
    }

    setForm({ fecha: hoy, subtotal: "", flete: "", nota: "" });
    setGuardando(false);
    cargar();
  }

  async function handleEliminar(id) {
    if (!confirm("¿Eliminar esta compra?")) return;
    await supabase.from("compras_proveedor").delete().eq("id", id);
    cargar();
  }

  const inicioMes = hoy.slice(0, 7); // "YYYY-MM"
  const comprasMes = compras.filter((c) => c.fecha.startsWith(inicioMes));
  const fleteTotalMes = comprasMes.reduce((acc, c) => acc + Number(c.flete || 0), 0);
  const subtotalTotalMes = comprasMes.reduce((acc, c) => acc + Number(c.subtotal || 0), 0);

  return (
    <main className="min-h-screen bg-brand-bg pb-10">
      <div className="container-app px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-extrabold text-xl text-gray-800">Compras a proveedor</h1>
          <Link href="/admin" className="text-sm text-brand-blue font-medium">
            ← Volver
          </Link>
        </div>

        <div className="card p-4 mb-4">
          <p className="text-gray-500 text-xs font-semibold">Flete pagado este mes</p>
          <p className="text-amber-600 text-xl font-extrabold mt-1">
            ${formatPrice(fleteTotalMes)}
          </p>
          <p className="text-gray-400 text-[11px] mt-0.5">
            Subtotal comprado: ${formatPrice(subtotalTotalMes)} en {comprasMes.length} pedido(s)
          </p>
        </div>

        <div className="card p-4 mb-4">
          <p className="font-bold text-gray-800 text-sm mb-3">Cargar nueva compra</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg p-2 mb-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Fecha</label>
              <input
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Subtotal (mercadería)</label>
              <input
                type="number"
                name="subtotal"
                value={form.subtotal}
                onChange={handleChange}
                className="input-field"
                placeholder="Ej: 245300"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Flete pagado</label>
              <input
                type="number"
                name="flete"
                value={form.flete}
                onChange={handleChange}
                className="input-field"
                placeholder="Ej: 35721"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Nota (opcional)</label>
              <input
                type="text"
                name="nota"
                value={form.nota}
                onChange={handleChange}
                className="input-field"
                placeholder="Ej: Pedido #100796 Next Cell"
              />
            </div>

            <button disabled={guardando} className="btn-primary w-full disabled:opacity-50">
              {guardando ? "Guardando..." : "Guardar compra"}
            </button>
          </form>
        </div>

        <div className="card p-4">
          <p className="font-bold text-gray-800 text-sm mb-3">Historial</p>
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-4">Cargando...</p>
          ) : compras.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Todavía no cargaste ninguna compra.</p>
          ) : (
            <div className="space-y-3">
              {compras.map((c) => (
                <div key={c.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-gray-800">
                        {new Date(c.fecha + "T00:00:00").toLocaleDateString("es-AR")}
                      </p>
                      {c.nota && <p className="text-xs text-gray-500 mt-0.5">{c.nota}</p>}
                    </div>
                    <button
                      onClick={() => handleEliminar(c.id)}
                      className="text-xs text-red-500 font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="flex justify-between text-xs mt-2">
                    <span className="text-gray-500">Subtotal: <b className="text-gray-700">${formatPrice(c.subtotal)}</b></span>
                    <span className="text-gray-500">Flete: <b className="text-amber-600">${formatPrice(c.flete)}</b></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ComprasProveedorPage() {
  return (
    <AdminGuard>
      <ComprasProveedor />
    </AdminGuard>
  );
}
