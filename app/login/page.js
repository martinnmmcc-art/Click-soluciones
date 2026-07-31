"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // 'celular' para clientes, 'email' para el admin
  const [modo, setModo] = useState("celular");

  // Estados para modo celular (con contraseña y modo registro manual)
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [esRegistro, setEsRegistro] = useState(false);

  // Estados para modo email/admin
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
      // 1. Verificamos si el cliente ya existe en la base de datos
      const { data: clienteExistente } = await supabase
        .from("clientes")
        .select("*")
        .eq("telefono", telLimpio)
        .maybeSingle();

      if (clienteExistente && !esRegistro) {
        // CLIENTE EXISTENTE: Validamos su contraseña
        if (clienteExistente.password !== passLimpio) {
          setError("Contraseña incorrecta.");
          setLoading(false);
          return;
        }

        // Guardamos la sesión de forma permanente en el dispositivo
        localStorage.setItem("cliente_sesion", JSON.stringify(clienteExistente));
        window.location.href = "/";
      } else {
        // MODO REGISTRO: Si eligió registrarse o el cliente no existe
        if (!nombre.trim()) {
          setError("Ingresá tu nombre y apellido para registrarte.");
          setLoading(false);
          return;
        }

        // Validamos si ya existía para no duplicar
        if (clienteExistente) {
          setError("Este número ya está registrado. Iniciá sesión normalmente.");
          setLoading(false);
          return;
        }

        // Creamos el nuevo cliente en la tabla
        const nuevoCliente = {
          telefono: telLimpio,
          password: passLimpio,
          nombre: nombre.trim(),
          localidad: localidad.trim()
        };

        const { error: insertError } = await supabase
          .from("clientes")
          .insert([nuevoCliente]);

        if (insertError) {
          setError("No se pudo completar el registro. Intentá nuevamente.");
          setLoading(false);
          return;
        }

        localStorage.setItem("cliente_sesion", JSON.stringify(nuevoCliente));
        window.location.href = "/";
      }
    } catch (err) {
      setError("Ocurrió un error inesperado.");
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
        router.push("/admin/pedidos");
      } else {
        router.push("/");
      }
      router.refresh();
    }
  }

  if (user || (typeof window !== "undefined" && localStorage.getItem("cliente_sesion"))) {
    const sesionCliente = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("cliente_sesion") || "{}") : {};
    return (
      <main className="pb-6">
        <Header showSearch={false} />
        <div className="px-4 mt-6">
          <div className="card p-6 text-center max-w-md mx-auto">
            <p className="text-3xl mb-2">👋</p>
            <h1 className="font-bold text-lg text-gray-800">
              Hola, {user?.nombre || sesionCliente.nombre || user?.email}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{user?.telefono || sesionCliente.telefono || user?.email}</p>
            <button
              onClick={() => {
                localStorage.removeItem("cliente_sesion");
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
          {esRegistro ? "Crear una cuenta nueva" : "Bienvenido a Clic Soluciones"}
        </h1>
        <p className="text-sm text-gray-500 mb-5 text-center">
          {esRegistro 
            ? "Completá tus datos para registrarte por primera vez." 
            : "Iniciá sesión con tu celular o correo para ver el catálogo y hacer pedidos."}
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

        {/* FORMULARIO DE CLIENTES (CELULAR Y CONTRASEÑA) */}
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

            {/* Campos de registro que se despliegan si el usuario elige registrarse */}
            {esRegistro && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl space-y-3 mt-1">
                <p className="text-xs text-blue-800 font-medium text-center">
                  Completá tus datos para dar de alta tu cuenta:
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
                    placeholder="Ej: El Bolsón, Río Negro"
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

            {/* Botón para alternar entre Iniciar Sesión y Registrarse */}
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

        {/* FORMULARIO DE ADMINISTRADOR (CORREO) */}
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
