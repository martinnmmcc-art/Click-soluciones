"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const { user, solicitarCodigo, verificarCodigo, logout } = useAuth();
  const router = useRouter();

  // 'celular' para clientes, 'email' para el admin
  const [modo, setModo] = useState("celular");

  // Estados para modo celular
  const [paso, setPaso] = useState(1);
  const [form, setForm] = useState({ nombre: "", telefono: "", localidad: "" });
  const [codigo, setCodigo] = useState("");
  const [codigoDemo, setCodigoDemo] = useState("");

  // Estados para modo email/admin
  const [emailAdmin, setEmailAdmin] = useState("");
  const [passAdmin, setPassAdmin] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Funciones para Celular
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

  // Función para Ingreso con Correo (Admin / Alternativo)
  async function handleLoginEmail(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailAdmin,
      password: passAdmin,
    });

    if (error) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
    } else {
      // Si sos vos, vas directo al panel de pedidos
      if (emailAdmin === "maricelcanumir@gmail.com") {
        router.push("/admin/pedidos");
      } else {
        router.push("/");
      }
      router.refresh();
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
              Hola, {user.nombre || user.email}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{user.telefono || user.email}</p>
            <button
              onClick={() => {
                logout();
                supabase.auth.signOut();
                router.push("/login");
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
      <div className="px-4 mt-6 max-w-md mx-auto">
        <h1 className="font-bold text-xl text-gray-800 mb-1 text-center">
          Bienvenido a Clic Soluciones
        </h1>
        <p className="text-sm text-gray-500 mb-5 text-center">
          Iniciá sesión para poder ver el catálogo y hacer pedidos.
        </p>

        {/* Selector de modo */}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => { setModo("celular"); setError(""); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              modo === "celular" ? "bg-white text-brand-blue shadow-sm" : "text-gray-500"
            }`}
          >
            📱 Con Celular
          </button>
          <button
            type="button"
            onClick={() => { setModo("email"); setError(""); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              modo === "email" ? "bg-white text-brand-blue shadow-sm" : "text-gray-500"
            }`}
          >
            ✉️ Con Correo (Admin)
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4 text-center">
            {error}
          </div>
        )}

        {/* FORMULARIO DE CELULAR */}
        {modo === "celular" && (
          <>
            {paso === 1 ? (
              <form onSubmit={handleSolicitar} className="flex flex-col gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Nombre y apellido</label>
                  <input
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ej: Martín Cáceres"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Número de celular</label>
                  <input
                    name="telefono"
                    value={form.telefono}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ej: 2944123456"
                    inputMode="tel"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Localidad</label>
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
                  <div className="bg-blue-50 border border-blue-200 text-brand-blueDark text-sm rounded-xl p-3 text-center">
                    Modo demo: tu código es <strong>{codigoDemo}</strong>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Código de verificación</label>
                  <input
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    className="input-field tracking-widest text-center text-lg"
                    placeholder="0000"
                    inputMode="numeric"
                    maxLength={4}
                    required
                  />
                </div>
                <button disabled={loading} className="btn-primary mt-2">
                  {loading ? "Verificando..." : "Confirmar"}
                </button>
                <button
                  type="button"
                  onClick={() => setPaso(1)}
                  className="text-sm text-gray-500 mt-1 text-center"
                >
                  ← Cambiar datos
                </button>
              </form>
            )}
          </>
        )}

        {/* FORMULARIO DE CORREO / ADMIN */}
        {modo === "email" && (
          <form onSubmit={handleLoginEmail} className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Correo electrónico</label>
              <input
                type="email"
                value={emailAdmin}
                onChange={(e) => setEmailAdmin(e.target.value)}
                className="input-field"
                placeholder="tucorreo@gmail.com"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Contraseña</label>
              <input
                type="password"
                value={passAdmin}
                onChange={(e) => setPassAdmin(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>
            <button disabled={loading} className="btn-primary mt-2">
              {loading ? "Entrando..." : "Entrar como Administrador"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
