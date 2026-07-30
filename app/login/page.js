"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { user, solicitarCodigo, verificarCodigo, logout } = useAuth();
  const router = useRouter();

  const [paso, setPaso] = useState(1); // 1: datos, 2: código
  const [form, setForm] = useState({ nombre: "", telefono: "", localidad: "" });
  const [codigo, setCodigo] = useState("");
  const [codigoDemo, setCodigoDemo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSolicitar(e) {
    e.preventDefault();
    setError("");

    if (!form.nombre.trim() || !form.telefono.trim()) {
      setError("Completá tu nombre y tu número de celular.");
      return;
    }

    setLoading(true);
    try {
      const codigoGenerado = await solicitarCodigo(form);
      // MOCK: en producción esto se envía por SMS. Acá lo mostramos
      // en pantalla para poder probar el flujo completo sin costo.
      setCodigoDemo(codigoGenerado);
      setPaso(2);
    } catch (err) {
      setError(err.message || "No pudimos procesar tu solicitud.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificar(e) {
    e.preventDefault();
    setError("");

    if (!codigo.trim()) {
      setError("Ingresá el código que te enviamos.");
      return;
    }

    setLoading(true);
    try {
      await verificarCodigo({ telefono: form.telefono, codigo: codigo.trim() });
      router.push("/");
    } catch (err) {
      setError(err.message || "El código no es correcto.");
    } finally {
      setLoading(false);
    }
  }

  if (user) {
    return (
      <main className="pb-6">
        <Header showSearch={false} />
        <div className="px-4 mt-6">
          <div className="card p-6 text-center">
            <p className="text-3xl mb-2">👋</p>
            <h1 className="font-bold text-lg text-gray-800">
              Hola, {user.nombre}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{user.telefono}</p>
            {user.localidad && (
              <p className="text-sm text-gray-500">{user.localidad}</p>
            )}
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="btn-secondary w-full mt-5"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-6">
      <Header showSearch={false} />
      <div className="px-4 mt-6">
        <h1 className="font-bold text-xl text-gray-800 mb-1">
          {paso === 1 ? "Ingresá o registrate" : "Verificá tu celular"}
        </h1>
        <p className="text-sm text-gray-500 mb-5">
          {paso === 1
            ? "Usamos tu número de celular para identificarte y avisarte sobre tus pedidos."
            : `Te enviamos un código a ${form.telefono}.`}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        {paso === 1 ? (
          <form onSubmit={handleSolicitar} className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Nombre y apellido
              </label>
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                className="input-field"
                placeholder="Ej: Martín Cáceres"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Número de celular
              </label>
              <input
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                className="input-field"
                placeholder="Ej: 2944123456"
                inputMode="tel"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Localidad
              </label>
              <input
                name="localidad"
                value={form.localidad}
                onChange={handleChange}
                className="input-field"
                placeholder="Ej: El Bolsón, Río Negro"
              />
            </div>
            <button disabled={loading} className="btn-primary mt-2">
              {loading ? "Enviando..." : "Enviar código"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerificar} className="flex flex-col gap-3">
            {codigoDemo && (
              <div className="bg-blue-50 border border-blue-200 text-brand-blueDark text-sm rounded-xl p-3">
                Modo demo: tu código es <strong>{codigoDemo}</strong> (en
                producción se envía por SMS).
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Código de verificación
              </label>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="input-field tracking-widest text-center text-lg"
                placeholder="0000"
                inputMode="numeric"
                maxLength={4}
              />
            </div>
            <button disabled={loading} className="btn-primary mt-2">
              {loading ? "Verificando..." : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => setPaso(1)}
              className="text-sm text-gray-500 mt-1"
            >
              ← Cambiar datos
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
