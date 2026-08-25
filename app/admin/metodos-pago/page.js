"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";

function MetodosPago() {
  const [metodos, setMetodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLoading(true);
    const { data } = await supabase.from("metodos_pago").select("*").order("orden");
    setMetodos(data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function alternarActivo(m) {
    const { error } = await supabase
      .from("metodos_pago")
      .update({ activo: !m.activo })
      .eq("id", m.id);

    if (error) {
      alert("No se pudo cambiar: " + error.message);
      return;
    }
    cargar();
  }

  function abrirEdicion(m) {
    setEditando(m.id);
    setForm({
      titular: m.titular || "",
      alias: m.alias || "",
      cvu: m.cvu || "",
      banco: m.banco || "",
      cuit: m.cuit || "",
      link_pago: m.link_pago || "",
      instrucciones: m.instrucciones || ""
    });
  }

  async function guardar(id) {
    setGuardando(true);
    const { error } = await supabase.from("metodos_pago").update(form).eq("id", id);
    setGuardando(false);

    if (error) {
      alert("No se pudo guardar: " + error.message);
      return;
    }
    setEditando(null);
    cargar();
  }

  const necesitaCuit = (clave) => clave === "naranja_x" || clave === "mercado_pago";

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">Formas de pago</h1>
        <p className="text-xs text-gray-500 mb-4">
          Lo que ve el cliente al confirmar su compra.
        </p>

        {loading ? (
          <p className="text-center text-gray-400 py-8">Cargando...</p>
        ) : (
          <div className="space-y-3">
            {metodos.map((m) => (
              <div
                key={m.id}
                className={`bg-white rounded-2xl border p-4 ${
                  m.activo ? "border-green-300" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-800">
                      {m.icono} {m.nombre}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.descripcion}</p>

                    {m.clave === "transferencia" && m.alias && (
                      <p className="text-[11px] text-gray-600 mt-1">
                        Alias: <b>{m.alias}</b>
                        {m.titular && ` · ${m.titular}`}
                      </p>
                    )}

                    {necesitaCuit(m.clave) && !m.activo && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-2 inline-block">
                        Necesita CUIT activo para habilitarlo
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => alternarActivo(m)}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${
                      m.activo
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {m.activo ? "✓ Activo" : "Desactivado"}
                  </button>
                </div>

                {editando === m.id ? (
                  <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
                    {m.clave === "transferencia" && (
                      <>
                        <div>
                          <label className="text-[11px] font-bold text-gray-600 block mb-0.5">
                            Titular de la cuenta
                          </label>
                          <input
                            value={form.titular}
                            onChange={(e) => setForm({ ...form, titular: e.target.value })}
                            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2"
                            placeholder="Ej: Marcelo Alejandro Cáceres"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-600 block mb-0.5">
                            Alias
                          </label>
                          <input
                            value={form.alias}
                            onChange={(e) => setForm({ ...form, alias: e.target.value })}
                            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2"
                            placeholder="Ej: bolson.click.mp"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-600 block mb-0.5">
                            CBU / CVU
                          </label>
                          <input
                            value={form.cvu}
                            onChange={(e) => setForm({ ...form, cvu: e.target.value })}
                            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2"
                            placeholder="22 dígitos"
                            inputMode="numeric"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-600 block mb-0.5">
                            Banco o billetera
                          </label>
                          <input
                            value={form.banco}
                            onChange={(e) => setForm({ ...form, banco: e.target.value })}
                            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2"
                            placeholder="Ej: Mercado Pago, Banco Nación"
                          />
                        </div>
                      </>
                    )}

                    {necesitaCuit(m.clave) && (
                      <div>
                        <label className="text-[11px] font-bold text-gray-600 block mb-0.5">
                          Link de pago (opcional)
                        </label>
                        <input
                          value={form.link_pago}
                          onChange={(e) => setForm({ ...form, link_pago: e.target.value })}
                          className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2"
                          placeholder="https://..."
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                          Si lo dejás vacío, le decimos al cliente que le pasás el
                          link por WhatsApp.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-0.5">
                        Aclaración para el cliente
                      </label>
                      <textarea
                        value={form.instrucciones}
                        onChange={(e) => setForm({ ...form, instrucciones: e.target.value })}
                        rows={2}
                        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => guardar(m.id)}
                        disabled={guardando}
                        className="flex-1 bg-brand-blue text-white text-xs font-bold py-2 rounded-xl disabled:opacity-50"
                      >
                        {guardando ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        className="px-3 text-xs font-semibold text-gray-500"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => abrirEdicion(m)}
                    className="text-xs font-semibold text-brand-blue mt-2"
                  >
                    ✏️ Configurar datos
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 mt-6">
          <p className="text-xs font-bold text-gray-700 mb-1">
            Sobre Naranja X y Mercado Pago
          </p>
          <p className="text-[11px] text-gray-600">
            Para habilitarlos hace falta CUIT activo, porque se adhieren como
            comercio. Cuando lo tengas, completás el link de pago acá y los
            activás: el resto ya está listo. Cobrar con tarjeta y en cuotas
            suele levantar bastante las ventas en compras grandes.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function MetodosPagoPage() {
  return (
    <AdminGuard>
      <MetodosPago />
    </AdminGuard>
  );
}
