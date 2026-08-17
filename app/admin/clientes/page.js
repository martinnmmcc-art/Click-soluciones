"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";

function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nombre: "", telefono: "", password: "", localidad: "", email: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function cargarClientes() {
    setLoading(true);
    const { data } = await supabase
      .from("clientes")
      .select("id, telefono, nombre, localidad, created_at, email, direccion, referido_por")
      .order("created_at", { ascending: false });
    setClientes(data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargarClientes();
  }, []);

  const clientesFiltrados = clientes.filter((c) => {
    const q = busqueda.toLowerCase();
    return (
      !q ||
      c.nombre?.toLowerCase().includes(q) ||
      c.telefono?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleAgregar(e) {
    e.preventDefault();
    setError("");

    if (!form.nombre.trim() || !form.telefono.trim() || !form.password.trim()) {
      setError("Nombre, celular y contraseña son obligatorios.");
      return;
    }

    setGuardando(true);
    try {
      const { data: existente } = await supabase
        .from("clientes")
        .select("id")
        .eq("telefono", form.telefono.trim())
        .maybeSingle();

      if (existente) {
        setError("Ya existe un cliente con ese celular.");
        setGuardando(false);
        return;
      }

      const { error: insertError } = await supabase.from("clientes").insert({
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim(),
        password: form.password.trim(),
        localidad: form.localidad.trim(),
        email: form.email.trim()
      });

      if (insertError) throw new Error(insertError.message);

      setForm({ nombre: "", telefono: "", password: "", localidad: "", email: "" });
      setMostrarForm(false);
      cargarClientes();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg pb-16">
      <div className="container-app px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <div className="flex items-center justify-between mt-1 mb-5">
          <h1 className="font-extrabold text-xl text-gray-800">
            Clientes ({clientes.length})
          </h1>
          <button
            onClick={() => setMostrarForm(!mostrarForm)}
            className="bg-brand-blue text-white text-xs font-bold px-3 py-2 rounded-xl"
          >
            {mostrarForm ? "Cancelar" : "+ Agregar"}
          </button>
        </div>

        {mostrarForm && (
          <form onSubmit={handleAgregar} className="card p-4 mb-4 space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Nombre y apellido *</label>
              <input name="nombre" value={form.nombre} onChange={handleChange} className="input-field" placeholder="Ej: Juan Pérez" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Celular *</label>
              <input name="telefono" value={form.telefono} onChange={handleChange} className="input-field" placeholder="Ej: 2944123456" inputMode="tel" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Contraseña *</label>
              <input name="password" value={form.password} onChange={handleChange} className="input-field" placeholder="La va a usar para entrar" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Localidad</label>
              <input name="localidad" value={form.localidad} onChange={handleChange} className="input-field" placeholder="Ej: El Bolsón" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Email (opcional)</label>
              <input name="email" value={form.email} onChange={handleChange} className="input-field" placeholder="tucorreo@gmail.com" />
            </div>

            {error && (
              <p className="text-xs text-red-600 font-medium">{error}</p>
            )}

            <button disabled={guardando} className="btn-primary w-full text-sm disabled:opacity-50">
              {guardando ? "Guardando..." : "Guardar cliente"}
            </button>

            <p className="text-[11px] text-gray-400 text-center">
              Este cliente queda registrado directo (sin pasar por el código de verificación por mail).
            </p>
          </form>
        )}

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="input-field mb-4"
          placeholder="Buscar por nombre, celular o correo..."
        />

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : clientesFiltrados.length === 0 ? (
          <div className="card p-6 text-center text-gray-500">
            No hay clientes {busqueda && "que coincidan con la búsqueda"}.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {clientesFiltrados.map((c) => (
              <div key={c.id} className="card p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-gray-800">{c.nombre || "Sin nombre"}</p>
                  <span className="text-[10px] text-gray-400">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString("es-AR") : ""}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">📱 {c.telefono}</p>
                {c.email && <p className="text-xs text-gray-500">✉️ {c.email}</p>}
                {c.localidad && <p className="text-xs text-gray-500">📍 {c.localidad}</p>}
                {c.referido_por && <p className="text-xs text-amber-700 font-semibold">🎁 Invitado por: {c.referido_por}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ClientesPage() {
  return (
    <AdminGuard>
      <Clientes />
    </AdminGuard>
  );
}
