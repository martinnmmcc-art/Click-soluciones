"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { ADMIN_EMAILS } from "@/context/AdminContext";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

const OPCIONES_ENTREGA_LABEL = {
  pendiente: "Pendiente",
  entregado: "Entregado",
  demorado: "Demorado",
  rechazado: "Rechazado",
  esperando_stock: "Esperando stock"
};

const OPCIONES_PAGO_LABEL = {
  falta_pagar: "Falta pagar",
  pagado: "Pagado",
  deuda_parcial: "Deuda parcial",
  a_favor: "A favor",
  señado: "Señado"
};

const COLOR_ENTREGA = {
  pendiente: "bg-yellow-50 text-yellow-700 border-yellow-200",
  entregado: "bg-green-50 text-green-700 border-green-200",
  demorado: "bg-orange-50 text-orange-700 border-orange-200",
  rechazado: "bg-red-50 text-red-700 border-red-200",
  esperando_stock: "bg-purple-50 text-purple-700 border-purple-200"
};

const COLOR_PAGO = {
  falta_pagar: "bg-red-50 text-red-700 border-red-200",
  pagado: "bg-green-50 text-green-700 border-green-200",
  deuda_parcial: "bg-orange-50 text-orange-700 border-orange-200",
  a_favor: "bg-blue-50 text-blue-700 border-blue-200",
  señado: "bg-purple-50 text-purple-700 border-purple-200"
};

export default function LoginPage() {
  const { user, logout } = useAuth();

  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [esRegistro, setEsRegistro] = useState(false);

  const [emailPerfil, setEmailPerfil] = useState("");
  const [direccionPerfil, setDireccionPerfil] = useState("");
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [mensajePerfil, setMensajePerfil] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sesionActiva, setSesionActiva] = useState(null);

  const [misPedidos, setMisPedidos] = useState([]);
  const [pedidosLoading, setPedidosLoading] = useState(false);

  const esCorreo = identificador.includes("@");

  useEffect(() => {
    const sesionStr = localStorage.getItem("cliente_sesion");
    if (sesionStr) {
      try {
        const sesion = JSON.parse(sesionStr);
        setSesionActiva(sesion);
        setEmailPerfil(sesion.email || "");
        setDireccionPerfil(sesion.direccion || "");
        setLocalidad(sesion.localidad || "");
        setNombre(sesion.nombre || "");
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    const tel = user?.telefono || sesionActiva?.telefono;
    if (!tel) return;

    async function cargarPedidos() {
      setPedidosLoading(true);
      try {
        const res = await fetch(`/api/mis-pedidos?telefono=${encodeURIComponent(tel)}`);
        const result = await res.json();
        if (res.ok) setMisPedidos(result.pedidos || []);
      } catch (e) {
        console.error(e);
      }
      setPedidosLoading(false);
    }
    cargarPedidos();
  }, [user, sesionActiva]);

  // Login/registro de CLIENTE (celular + contraseña propia, tabla "clientes")
  async function handleLoginCelular() {
    const telLimpio = identificador.trim();
    const passLimpio = password.trim();

    const { data: clienteExistente } = await supabase
      .from("clientes")
      .select("*")
      .eq("telefono", telLimpio)
      .maybeSingle();

    if (clienteExistente && !esRegistro) {
      if (clienteExistente.password !== passLimpio) {
        setError("Contraseña incorrecta.");
        return;
      }
      localStorage.setItem("cliente_sesion", JSON.stringify(clienteExistente));
      setSesionActiva(clienteExistente);
      return;
    }

    if (!nombre.trim()) {
      setError("Ingresá tu nombre y apellido para registrarte.");
      return;
    }
    if (clienteExistente) {
      setError("Este número ya está registrado. Iniciá sesión normalmente.");
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

    const { error: insertError } = await supabase.from("clientes").insert([nuevoCliente]);
    if (insertError) {
      setError(`Error al registrar: ${insertError.message}`);
      return;
    }

    localStorage.setItem("cliente_sesion", JSON.stringify(nuevoCliente));
    setSesionActiva(nuevoCliente);
  }

  // Login de ADMIN (correo + contraseña, Supabase Auth)
  async function handleLoginCorreo() {
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: identificador.trim(),
      password: password.trim(),
    });

    if (loginError) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

    if (ADMIN_EMAILS.includes(identificador.trim())) {
      window.location.href = "/admin/productos";
    } else {
      window.location.href = "/";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!identificador.trim() || !password.trim()) {
      setError("Completá los dos campos.");
      return;
    }

    setLoading(true);
    try {
      if (esCorreo) {
        await handleLoginCorreo();
      } else {
        await handleLoginCelular();
      }
    } catch (err) {
      setError(`Ocurrió un error: ${err.message || "Desconocido"}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleGuardarPerfil(e) {
    e.preventDefault();
    setMensajePerfil("");
    setLoading(true);

    if (!sesionActiva) {
      setLoading(false);
      return;
    }

    const datosActualizados = {
      ...sesionActiva,
      email: emailPerfil.trim(),
      direccion: direccionPerfil.trim(),
      localidad: localidad.trim()
    };

    const { error: updateError } = await supabase
      .from("clientes")
      .update({
        email: emailPerfil.trim(),
        direccion: direccionPerfil.trim(),
        localidad: localidad.trim()
      })
      .eq("telefono", sesionActiva.telefono);

    if (updateError) {
      setMensajePerfil("❌ Error al actualizar el perfil.");
      setLoading(false);
      return;
    }

    localStorage.setItem("cliente_sesion", JSON.stringify(datosActualizados));
    setSesionActiva(datosActualizados);
    setMensajePerfil("✅ ¡Perfil actualizado con éxito!");
    setEditandoPerfil(false);
    setLoading(false);
  }

  if (user || sesionActiva) {
    return (
      <main className="pb-28">
        <Header showSearch={false} />
        <div className="px-4 mt-6 max-w-md mx-auto">
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="flex-1 bg-brand-blue text-white text-center py-2.5 rounded-xl text-xs font-bold shadow-sm"
            >
              🛒 Ir al Catálogo
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = "/carrito"; }}
              className="flex-1 bg-gray-100 text-gray-700 text-center py-2.5 rounded-xl text-xs font-bold shadow-sm"
            >
              🛍️ Ver Carrito
            </button>
          </div>

          <div className="card p-6 text-center space-y-3 mb-4">
            <p className="text-3xl mb-1">👋</p>
            <h1 className="font-bold text-lg text-gray-800">
              Hola, {user?.nombre || sesionActiva?.nombre || user?.email || "Cliente"}
            </h1>
            <p className="text-sm text-gray-500 font-medium">📱 {user?.telefono || sesionActiva?.telefono || "Registrado"}</p>

            <div className="flex flex-wrap justify-center gap-1 pt-1">
              {sesionActiva?.localidad && (
                <span className="text-xs bg-gray-100 text-gray-600 py-1 px-3 rounded-full">
                  📍 {sesionActiva.localidad}
                </span>
              )}
              {sesionActiva?.direccion && (
                <span className="text-xs bg-gray-100 text-gray-600 py-1 px-3 rounded-full">
                  🏠 {sesionActiva.direccion}
                </span>
              )}
              {sesionActiva?.email && (
                <span className="text-xs bg-gray-100 text-gray-600 py-1 px-3 rounded-full w-full">
                  ✉️ {sesionActiva.email}
                </span>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setEditandoPerfil(!editandoPerfil)}
                className="btn-secondary w-full text-xs"
              >
                {editandoPerfil ? "Cancelar edición" : "⚙️ Completar / Editar mis datos opcionales"}
              </button>
            </div>
          </div>

          {editandoPerfil && (
            <div className="card p-5 mb-4 bg-blue-50/50 border border-blue-200">
              <h2 className="font-bold text-sm text-gray-800 mb-3 text-center">Tus datos adicionales (Opcional)</h2>

              {mensajePerfil && (
                <div className="text-xs text-center p-2 mb-3 rounded-lg bg-white border font-medium">
                  {mensajePerfil}
                </div>
              )}

              <form onSubmit={handleGuardarPerfil} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    value={emailPerfil}
                    onChange={(e) => setEmailPerfil(e.target.value)}
                    className="input-field bg-white"
                    placeholder="tucorreo@gmail.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Dirección de entrega</label>
                  <input
                    value={direccionPerfil}
                    onChange={(e) => setDireccionPerfil(e.target.value)}
                    className="input-field bg-white"
                    placeholder="Ej: Av. San Martín 450"
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

                <button disabled={loading} className="btn-primary w-full text-xs py-2 mt-2">
                  {loading ? "Guardando..." : "Guardar mis datos"}
                </button>
              </form>
            </div>
          )}

          <div className="mb-4">
            <h2 className="font-bold text-sm text-gray-800 mb-3">📦 Mis Pedidos</h2>

            {pedidosLoading && (
              <p className="text-xs text-gray-400 text-center py-4">Cargando tus pedidos...</p>
            )}

            {!pedidosLoading && misPedidos.length === 0 && (
              <div className="card p-5 text-center text-gray-400 text-sm">
                Todavía no hiciste ningún pedido.
              </div>
            )}

            {!pedidosLoading && misPedidos.length > 0 && (
              <div className="space-y-3">
                {misPedidos.map((pedido) => {
                  const saldo = Number(pedido.total || 0) - Number(pedido.monto_pagado || 0);
                  return (
                    <div key={pedido.id} className="card p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs font-bold text-brand-blue bg-blue-50 px-2 py-1 rounded-md">
                            Pedido #{pedido.id}
                          </span>
                          <p className="text-xs text-gray-400 mt-1.5">
                            {new Date(pedido.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-base font-extrabold text-gray-900">
                          ${formatPrice(pedido.total)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className={`text-[11px] font-semibold border rounded-lg px-2 py-1 ${COLOR_ENTREGA[pedido.estado] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
                          {OPCIONES_ENTREGA_LABEL[pedido.estado] || "Pendiente"}
                        </span>
                        <span className={`text-[11px] font-semibold border rounded-lg px-2 py-1 ${COLOR_PAGO[pedido.estado_pago] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
                          {OPCIONES_PAGO_LABEL[pedido.estado_pago] || "Falta pagar"}
                        </span>
                      </div>

                      {saldo > 0 && (
                        <p className="text-xs font-bold text-red-700 mb-2">Debés ${formatPrice(saldo)}</p>
                      )}
                      {saldo < 0 && (
                        <p className="text-xs font-bold text-blue-700 mb-2">A favor ${formatPrice(Math.abs(saldo))}</p>
                      )}
                      {saldo === 0 && (
                        <p className="text-xs font-bold text-green-700 mb-2">Saldado ✅</p>
                      )}

                      <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                        {pedido.items_pedido && pedido.items_pedido.map((item) => (
                          <div key={item.id} className="flex justify-between text-xs text-gray-600">
                            <span>{item.cantidad}x {item.nombre_producto}</span>
                            <span className="font-medium">${formatPrice(item.precio_unitario * item.cantidad)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("cliente_sesion");
              setSesionActiva(null);
              logout();
              supabase.auth.signOut();
              window.location.reload();
            }}
            className="text-xs text-red-500 font-medium w-full text-center py-2 hover:underline"
          >
            Cerrar sesión
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-28">
      <Header showSearch={false} />
      <div className="px-4 mt-6 max-w-md mx-auto">
        <h1 className="font-bold text-xl text-gray-800 mb-1 text-center">
          {esRegistro ? "Crear una cuenta nueva" : "Bienvenido a Bolson Click"}
        </h1>
        {!esRegistro && (
          <>
            <p className="text-sm text-brand-orange font-bold mb-1 text-center">
              Tu bazar online en El Bolsón y la Comarca
            </p>
            <p className="text-xs text-gray-400 mb-3 text-center px-2">
              🚚 Envíos a El Bolsón, la Comarca y el lado de Chubut. Coordinamos por transporte local o punto de encuentro.
            </p>
          </>
        )}
        <p className="text-sm text-gray-500 mb-5 text-center">
          Ingresá con tu celular (clientes) o tu correo (administrador).
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Celular o correo electrónico
            </label>
            <input
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              className="input-field"
              placeholder="Ej: 2944123456 o tucorreo@gmail.com"
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
              placeholder="Tu contraseña"
              autoComplete="current-password"
              required
            />
          </div>

          {esRegistro && !esCorreo && (
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
              : esRegistro && !esCorreo
              ? "Completar Registro"
              : "Iniciar Sesión"}
          </button>

          {!esCorreo && (
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
          )}
        </form>
      </div>
    </main>
  );
}
