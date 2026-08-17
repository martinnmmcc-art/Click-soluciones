"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

function GastosGenerales() {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const hoy = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    fecha: hoy,
    concepto: "",
    monto: ""
  });

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("gastos_generales")
      .select("*")
      .order("fecha", { ascending: false });
    if (error) setError(error.message);
    setGastos(data || []);
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

    if (!form.fecha || !form.concepto.trim() || !form.monto) {
      setError("Completá fecha, concepto y monto.");
      return;
    }

    setGuardando(true);
    const { error: insertError } = await supabase.from("gastos_generales").insert({
      fecha: form.fecha,
      concepto: form.concepto.trim(),
      monto: Number(form.monto) || 0
    });

    if (insertError) {
      setError(insertError.message);
      setGuardando(false);
      return;
    }

    setForm({ fecha: hoy, concepto: "", monto: "" });
    setGuardando(false);
    cargar();
  }

  async function handleEliminar(id) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await supabase.from("gastos_generales").delete().eq("id", id);
    cargar();
  }

  const inicioMes = hoy.slice(0, 7);
  const gastosMes = gastos.filter((g) => g.fecha.startsWith(inicioMes));
  const totalMes = gastosMes.reduce((acc, g) => acc + Number(g.monto || 0), 0);

  return (
    <main className="min-h-screen bg-brand-bg pb-10">
      <div className="container-app px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-extrabold text-xl text-gray-800">Otros gastos</h1>
          <Link href="/admin" className="text-sm text-brand-blue font-medium">
            ← Volver
          </Link>
        </div>

        <div className="card p-4 mb-4">
          <p className="text-gray-500 text-xs font-semibold">Total gastado este mes</p>
          <p className="text-red-600 text-xl font-extrabold mt-1">
            ${formatPrice(totalMes)}
          </p>
          <p className="text-gray-400 text-[11px] mt-0.5">{gastosMes.length} gasto(s) cargado(s)</p>
        </div>

        <div className="card p-4 mb-4">
          <p className="font-bold text-gray-800 text-sm mb-3">Cargar nuevo gasto</p>

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
              <label className="text-xs font-bold text-gray-700 block mb-1">Concepto</label>
              <input
                type="text"
                name="concepto"
                value={form.concepto}
                onChange={handleChange}
                className="input-field"
                placeholder="Ej: Bolsas, alquiler showroom, publicidad"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Monto</label>
              <input
                type="number"
                name="monto"
                value={form.monto}
                onChange={handleChange}
                className="input-field"
                placeholder="Ej: 5000"
                required
              />
            </div>

            <button disabled={guardando} className="btn-primary w-full disabled:opacity-50">
              {guardando ? "Guardando..." : "Guardar gasto"}
            </button>
          </form>
        </div>

        <div className="card p-4">
          <p className="font-bold text-gray-800 text-sm mb-3">Historial</p>
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-4">Cargando...</p>
          ) : gastos.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Todavía no cargaste ningún gasto.</p>
          ) : (
            <div className="space-y-2">
              {gastos.map((g) => (
                <div key={g.id} className="flex justify-between items-center border border-gray-100 rounded-xl p-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{g.concepto}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(g.fecha + "T00:00:00").toLocaleDateString("es-AR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-red-600 text-sm">${formatPrice(g.monto)}</span>
                    <button
                      onClick={() => handleEliminar(g.id)}
                      className="text-xs text-red-500 font-medium"
                    >
                      Eliminar
                    </button>
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

export default function GastosGeneralesPage() {
  return (
    <AdminGuard>
      <GastosGenerales />
    </AdminGuard>
  );
}
