"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // Si ya hay sesión iniciada, redirigir automáticamente al catálogo y no trabar la pantalla
  useEffect(() => {
    const sesionStr = typeof window !== "undefined" ? localStorage.getItem("cliente_sesion") : null;
    if (user || sesionStr) {
      window.location.href = "/";
    }
  }, [user]);

  const [modo, setModo] = useState("celular");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [esRegistro, setEsRegistro] = useState(false);

  const [emailAdmin, setEmailAdmin] = useState("");
  const [passAdmin, setPassAdmin] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Ingreso o Registro de Clientes con Celular y Contraseña
  async function handleCelularSubmit(e) {
    e.preventDefault();
    setError("");

    const telLimpio = telefono.trim();
    const passLimpio = password.trim();

    if (!telLimpio || !passLimpio) {
      setError("Completá tu número de celular y tu contraseña.");
      return;
    }

    setLoading(true);
    try {
      const { data: clienteExistente, error: errBusqueda } = await supabase
        .from("clientes")
        .select("*")
        .eq("telefono", telLimpio)
        .maybeSingle();

      if (clienteExistente && !esRegistro) {
        if (clienteExistente.password !== passLimpio) {
          setError("Contraseña incorrecta.");
          setLoading(false);
          return;
        }

        localStorage.setItem("cliente_sesion", JSON.stringify(clienteExistente));
        window.location.href = "/";
      } else {
        if (!nombre.trim()) {
          setError("Ingresá tu nombre y apellido para registrarte.");
          setLoading(false);
          return;
        }

        if (clienteExistente) {
          setError("Este número ya está registrado. Iniciá sesión normalmente.");
          setLoading(false);
          return;
        }

        const nuevoCliente = {
          telefono: telLimpio,
          password: passLimpio,
          nombre: nombre.trim(),
          localidad: localidad.trim(),
          email: "",
          direccion: ""
        };

        const { error: insertError } = await supabase
          .from("clientes")
          .insert([nuevoCliente]);

        if (insertError) {
          console.error("Detalle del error de Supabase:", insertError);
          setError(`Error al registrar: ${insertError.message}`);
          setLoading(false);
          return;
        }

        localStorage.setItem("cliente_sesion", JSON.stringify(nuevoCliente));
        window.location.href = "/";
      }
    } catch (err) {
      console.error("Excepción en login:", err);
      setError(`Ocurrió un error: ${err.message || "Desconocido"}`);
      setLoading(false);
    }
  }

  // Ingreso como Administrador con Correo
  async function handleLoginEmail(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: emailAdmin,
      password: passAdmin,
    });

    if (error) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
    } else {
      if (emailAdmin === "maricelcanumir@gmail.com") {
        window.location.href = "/admin/pedidos";
      } else {
        window.location.href = "/";
      }
    }
  }

  return (
    <main className="pb-28">
      <Header showSearch={false} />
      <div className="px-4 mt-6 max-w-md mx-auto">
        <h1 className="font-bold text-xl text-gray-800 mb-1 text-center">
          {esRegistro ? "Crear una cuenta nueva" : "Bienvenido a Clic Soluciones"}
        </h1>
        <p className="text-sm text-gray-500 mb-5 text-center">
          {esRegistro 
            ? "Completá tus datos básicos para registrarte." 
            : "Iniciá sesión con tu celular para ver el catálogo y hacer pedidos."}
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
            📱 Ingreso con Celular
          </button>
          <button
            type="button"
            onClick={() => { setModo("email"); setError(""); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              modo === "email" ? "bg-white text-brand-blue shadow-sm" : "text-gray-500"
            }`}
          >
            ✉️ Admin (Correo)
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4 text-center">
            {error}
          </div>
        )}

        {/* FORMULARIO DE CLIENTES */}
        {modo === "celular" && (
          <form onSubmit={handleCelularSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Número de celular
              </label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="input-field"
                placeholder="Ej: 2944123456"
                inputMode="tel"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Tu contraseña secreta"
                autoComplete="current-password"
                required
              />
            </div>

            {esRegistro && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl space-y-3 mt-1">
                <p className="text-xs text-blue-800 font-medium text-center">
                  Completá tus datos básicos:
                </p>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Nombre y apellido</label>
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="input-field bg-white"
                    placeholder="Ej: Martín Cáceres"
                    required={esRegistro}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Localidad</label>
                  <input
                    value={localidad}
                    onChange={(e) => setLocalidad(e.target.value)}
                    className="input-field bg-white"
                    placeholder="Ej: El Bolsón"
                  />
                </div>
              </div>
            )}

            <button disabled={loading} className="btn-primary mt-2">
              {loading
                ? "Procesando..."
                : esRegistro
                ? "Completar Registro"
                : "Iniciar Sesión"}
            </button>

            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => {
                  setEsRegistro(!esRegistro);
                  setError("");
                }}
                className="text-xs font-medium text-brand-blue hover:underline"
              >
                {esRegistro 
                  ? "¿Ya tenés cuenta? Iniciá sesión" 
                  : "¿No tenés cuenta? Registrate acá"}
              </button>
            </div>
          </form>
        )}

        {/* FORMULARIO DE ADMINISTRADOR */}
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
                autoComplete="email"
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
                autoComplete="current-password"
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
