"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";

const CAMPOS_CLIENTE = "id, telefono, nombre, localidad, created_at, email, direccion, referido_por";

function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [bloqueados, setBloqueados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nombre: "", telefono: "", password: "", localidad: "", email: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Edición en línea
  const [editandoId, setEditandoId] = useState(null);
  const [formEdit, setFormEdit] = useState({ nombre: "", telefono: "", localidad: "", email: "", direccion: "" });
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState("");

  async function cargarClientes() {
    setLoading(true);
    const [{ data: clientesData }, { data: bloqueadosData }] = await Promise.all([
      supabase.from("clientes").select(CAMPOS_CLIENTE).order("created_at", { ascending: false }),
      supabase.from("telefonos_bloqueados").select("telefono, motivo")
    ]);
    setClientes(clientesData || []);
    setBloqueados(bloqueadosData || []);
    setLoading(false);
  }

  useEffect(() => {
    cargarClientes();
  }, []);

  const telefonosBloqueados = new Set(bloqueados.map((b) => b.telefono));

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

  function empezarEdicion(c) {
    setEditandoId(c.id);
    setErrorEdit("");
    setFormEdit({
      nombre: c.nombre || "",
      telefono: c.telefono || "",
      localidad: c.localidad || "",
      email: c.email || "",
      direccion: c.direccion || ""
    });
  }

  function handleChangeEdit(e) {
    setFormEdit({ ...formEdit, [e.target.name]: e.target.value });
  }

  async function guardarEdicion(id) {
    setErrorEdit("");

    if (!formEdit.nombre.trim() || !formEdit.telefono.trim()) {
      setErrorEdit("El nombre y el celular no pueden quedar vacíos.");
      return;
    }

    setGuardandoEdit(true);
    const { error: updateError } = await supabase
      .from("clientes")
      .update({
        nombre: formEdit.nombre.trim(),
        telefono: formEdit.telefono.trim(),
        localidad: formEdit.localidad.trim(),
        email: formEdit.email.trim(),
        direccion: formEdit.direccion.trim()
      })
      .eq("id", id);

    setGuardandoEdit(false);

    if (updateError) {
      setErrorEdit(
        updateError.message.includes("clientes_telefono_unico")
          ? "Ya existe otro cliente con ese celular."
          : updateError.message
      );
      return;
    }

    setEditandoId(null);
    cargarClientes();
  }

  async function resetearPassword(c) {
    const nueva = prompt(`Nueva contraseña para ${c.nombre || c.telefono}:`);
    if (!nueva || !nueva.trim()) return;

    const { error: updateError } = await supabase
      .from("clientes")
      .update({ password: nueva.trim() })
      .eq("id", c.id);

    if (updateError) {
      alert("No se pudo cambiar la contraseña: " + updateError.message);
      return;
    }
    alert("Contraseña actualizada. Avisale al cliente cuál es su nueva contraseña.");
  }

  async function generarLinkAcceso(c) {
    const { data, error: insertError } = await supabase
      .from("accesos_rapidos")
      .insert({ telefono: c.telefono })
      .select("token")
      .single();

    if (insertError || !data) {
      alert("No se pudo generar el link: " + (insertError?.message || "error desconocido"));
      return;
    }

    const link = `https://www.bolsonclick.com.ar/login?acceso=${data.token}`;
    const mensaje =
      `¡Hola ${c.nombre || ""}! 👋\n\n` +
      `Ya tenés tu cuenta lista en Bolson Click 🛍️\n\n` +
      `Entrá con este link y vas a quedar adentro directamente, sin poner contraseña:\n${link}\n\n` +
      `⚠️ El link es personal y vence en 7 días.\n\n` +
      `Tip: una vez adentro, tocá el menú del navegador y elegí "Instalar app" para tenerla en tu celular como una app más.`;

    const wa = `https://wa.me/${c.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`;
    window.open(wa, "_blank");
  }

  function compartirApp(c) {
    const mensaje =
      `¡Hola${c?.nombre ? " " + c.nombre : ""}! 👋\n\n` +
      `Te comparto Bolson Click 🛍️ Productos importados en El Bolsón y la Comarca Andina.\n\n` +
      `Entrá acá: https://www.bolsonclick.com.ar\n\n` +
      `📲 Para tenerla como app en tu celu:\n` +
      `• Android: menú (⋮) → "Instalar app"\n` +
      `• iPhone: compartir (⬆️) → "Agregar a pantalla de inicio"`;

    const wa = c?.telefono
      ? `https://wa.me/${c.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(wa, "_blank");
  }

  async function eliminarCliente(c) {
    const ok = confirm(
      `¿Eliminar a ${c.nombre || c.telefono}?\n\nEsto borra su cuenta, pero NO borra sus pedidos ya hechos. Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    const { error: deleteError } = await supabase.from("clientes").delete().eq("id", c.id);
    if (deleteError) {
      alert("No se pudo eliminar: " + deleteError.message);
      return;
    }
    cargarClientes();
  }

  async function bloquearTelefono(c) {
    const motivo = prompt(
      `Bloquear el celular ${c.telefono}.\n\nNo va a poder iniciar sesión ni volver a registrarse.\n\nMotivo (opcional):`
    );
    if (motivo === null) return; // canceló

    const { error: insertError } = await supabase.from("telefonos_bloqueados").insert({
      telefono: c.telefono,
      motivo: motivo.trim() || null
    });

    if (insertError) {
      alert("No se pudo bloquear: " + insertError.message);
      return;
    }
    cargarClientes();
  }

  async function desbloquearTelefono(telefono) {
    if (!confirm(`¿Desbloquear el celular ${telefono}?`)) return;

    const { error: deleteError } = await supabase
      .from("telefonos_bloqueados")
      .delete()
      .eq("telefono", telefono);

    if (deleteError) {
      alert("No se pudo desbloquear: " + deleteError.message);
      return;
    }
    cargarClientes();
  }

  async function bloquearNumeroSuelto() {
    const tel = prompt("Celular a bloquear (solo números, sin espacios):");
    if (!tel || !tel.trim()) return;

    const motivo = prompt("Motivo (opcional):");
    if (motivo === null) return;

    const { error: insertError } = await supabase.from("telefonos_bloqueados").insert({
      telefono: tel.trim(),
      motivo: motivo.trim() || null
    });

    if (insertError) {
      alert(
        insertError.message.includes("duplicate")
          ? "Ese celular ya estaba bloqueado."
          : "No se pudo bloquear: " + insertError.message
      );
      return;
    }
    cargarClientes();
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
          <div className="flex gap-2">
            <button
              onClick={() => compartirApp(null)}
              className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl"
            >
              📲 Compartir app
            </button>
            <button
              onClick={() => setMostrarForm(!mostrarForm)}
              className="bg-brand-blue text-white text-xs font-bold px-3 py-2 rounded-xl"
            >
              {mostrarForm ? "Cancelar" : "+ Agregar"}
            </button>
          </div>
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
            {clientesFiltrados.map((c) => {
              const estaBloqueado = telefonosBloqueados.has(c.telefono);

              if (editandoId === c.id) {
                return (
                  <div key={c.id} className="card p-4 border-2 border-brand-blue space-y-3">
                    <p className="font-bold text-sm text-gray-800">Editando cliente</p>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Nombre y apellido *</label>
                      <input name="nombre" value={formEdit.nombre} onChange={handleChangeEdit} className="input-field" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Celular *</label>
                      <input name="telefono" value={formEdit.telefono} onChange={handleChangeEdit} className="input-field" inputMode="tel" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Localidad</label>
                      <input name="localidad" value={formEdit.localidad} onChange={handleChangeEdit} className="input-field" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Email</label>
                      <input name="email" value={formEdit.email} onChange={handleChangeEdit} className="input-field" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Dirección</label>
                      <input name="direccion" value={formEdit.direccion} onChange={handleChangeEdit} className="input-field" />
                    </div>

                    {errorEdit && <p className="text-xs text-red-600 font-medium">{errorEdit}</p>}

                    <div className="flex gap-2">
                      <button
                        onClick={() => guardarEdicion(c.id)}
                        disabled={guardandoEdit}
                        className="btn-primary flex-1 text-xs py-2 disabled:opacity-50"
                      >
                        {guardandoEdit ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        className="flex-1 bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded-xl"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={c.id} className={`card p-3 ${estaBloqueado ? "bg-red-50 border border-red-200" : ""}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-gray-800">
                      {c.nombre || "Sin nombre"}
                      {estaBloqueado && (
                        <span className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">
                          BLOQUEADO
                        </span>
                      )}
                    </p>
                    <span className="text-[10px] text-gray-400">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString("es-AR") : ""}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">📱 {c.telefono}</p>
                  {c.email && <p className="text-xs text-gray-500">✉️ {c.email}</p>}
                  {c.localidad && <p className="text-xs text-gray-500">📍 {c.localidad}</p>}
                  {c.direccion && <p className="text-xs text-gray-500">🏠 {c.direccion}</p>}
                  {c.referido_por && <p className="text-xs text-amber-700 font-semibold">🎁 Invitado por: {c.referido_por}</p>}

                  <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-gray-100">
                    {!estaBloqueado && (
                      <button onClick={() => generarLinkAcceso(c)} className="text-xs font-semibold text-green-600">
                        🔗 Enviar acceso directo
                      </button>
                    )}
                    <button onClick={() => compartirApp(c)} className="text-xs font-semibold text-emerald-700">
                      📲 Compartir app
                    </button>
                    <button onClick={() => empezarEdicion(c)} className="text-xs font-semibold text-brand-blue">
                      ✏️ Editar
                    </button>
                    <button onClick={() => resetearPassword(c)} className="text-xs font-semibold text-gray-600">
                      🔑 Cambiar clave
                    </button>
                    {estaBloqueado ? (
                      <button onClick={() => desbloquearTelefono(c.telefono)} className="text-xs font-semibold text-green-600">
                        ✅ Desbloquear
                      </button>
                    ) : (
                      <button onClick={() => bloquearTelefono(c)} className="text-xs font-semibold text-amber-600">
                        🚫 Bloquear
                      </button>
                    )}
                    <button onClick={() => eliminarCliente(c)} className="text-xs font-semibold text-red-500">
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* NÚMEROS BLOQUEADOS QUE NO SON CLIENTES */}
        <div className="card p-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-gray-800 text-sm">🚫 Celulares bloqueados</p>
            <button onClick={bloquearNumeroSuelto} className="text-xs font-bold text-brand-blue">
              + Bloquear número
            </button>
          </div>

          {bloqueados.length === 0 ? (
            <p className="text-gray-400 text-xs">No hay ningún celular bloqueado.</p>
          ) : (
            <div className="space-y-2">
              {bloqueados.map((b) => (
                <div key={b.telefono} className="flex justify-between items-center text-xs border border-gray-100 rounded-lg p-2">
                  <div>
                    <p className="font-semibold text-gray-800">{b.telefono}</p>
                    {b.motivo && <p className="text-gray-400">{b.motivo}</p>}
                  </div>
                  <button onClick={() => desbloquearTelefono(b.telefono)} className="text-green-600 font-semibold">
                    Desbloquear
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-gray-400 mt-3">
            Un celular bloqueado no puede iniciar sesión ni registrarse de nuevo, aunque tenga la contraseña correcta.
          </p>
        </div>
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
