"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import ActivarNotificaciones from "@/components/ActivarNotificaciones";
import { useAuth } from "@/context/AuthContext";
import { ADMIN_EMAILS } from "@/context/AdminContext";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";
import { suscribirPush } from "@/lib/push";
import { avisarAdmin } from "@/lib/avisarAdmin";

const OPCIONES_ENTREGA_LABEL = {
  pendiente: "Pendiente",
  entregado: "Entregado",
  demorado: "Demorado",
  rechazado: "Rechazado",
  esperando_stock: "Esperando stock",
  cancelado: "Cancelado por vos"
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
  esperando_stock: "bg-purple-50 text-purple-700 border-purple-200",
  cancelado: "bg-gray-100 text-gray-500 border-gray-200"
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
  const [cancelandoId, setCancelandoId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [itemsEditados, setItemsEditados] = useState({});
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const [refCode, setRefCode] = useState("");
  const [refNombre, setRefNombre] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);

  const esCorreo = identificador.includes("@");

  function validarCelular(tel) {
    const limpio = (tel || "").replace(/[\s\-()]/g, "");
    // Celular argentino: solo números, entre 10 y 13 dígitos (con o sin 54/9 adelante)
    return /^\d{10,13}$/.test(limpio);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref) return;
    setRefCode(ref);
    setEsRegistro(true);

    async function buscarNombreReferente() {
      const { data } = await supabase.rpc("nombre_de_referente", { p_telefono: ref });
      if (data) setRefNombre(data);
    }
    buscarNombreReferente();
  }, []);

  // Acceso rápido: si el link trae ?acceso=TOKEN, loguea directo sin escribir nada
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("acceso");
    if (!token) return;

    async function canjearAcceso() {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc("canjear_acceso_rapido", {
        p_token: token
      });

      if (rpcError || !data || data.length === 0) {
        setError("Este link de acceso ya fue usado o venció. Ingresá con tu celular y contraseña.");
        setLoading(false);
        window.history.replaceState({}, "", "/login");
        return;
      }

      const cliente = data[0];
      localStorage.setItem("cliente_sesion", JSON.stringify(cliente));
      setSesionActiva(cliente);
      setLoading(false);
      window.history.replaceState({}, "", "/login");
      suscribirPush(cliente.telefono).catch(() => {});
    }
    canjearAcceso();
  }, []);

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
    // Por seguridad: si quedó una sesión de admin activa de antes, la cerramos
    // antes de loguear como cliente, para que nunca se mezclen los dos accesos.
    await supabase.auth.signOut();

    // Dejamos el teléfono siempre en el mismo formato (2944636224): sin +54,
    // sin el 9 de celular, sin espacios. Si cada uno lo escribe distinto, después
    // no coinciden los pedidos con la cuenta y "Mis pedidos" aparece vacío.
    const telLimpio = (() => {
      let limpio = identificador.trim().replace(/\D/g, "");
      if (limpio.startsWith("54")) limpio = limpio.slice(2);
      if (limpio.startsWith("9")) limpio = limpio.slice(1);
      return limpio;
    })();
    const passLimpio = password.trim();

    if (esRegistro && !validarCelular(telLimpio)) {
      setError("Ingresá un celular válido, solo números (ej: 2944123456).");
      return;
    }

    // Un celular bloqueado por el admin no puede registrarse ni iniciar sesión
    const { data: estaBloqueado } = await supabase.rpc("telefono_esta_bloqueado", {
      p_telefono: telLimpio
    });
    if (estaBloqueado) {
      setError("Este número no puede acceder. Contactate con Bolson Click por WhatsApp.");
      return;
    }

    const { data: clienteExistente } = await supabase.rpc("telefono_ya_registrado", {
      p_telefono: telLimpio
    });

    if (clienteExistente && !esRegistro) {
      // La verificación de contraseña se hace en una función segura de la base
      // de datos (RPC), que nunca expone la contraseña al navegador.
      const { data: loginData, error: loginError } = await supabase.rpc(
        "validar_login_cliente",
        { p_telefono: telLimpio, p_password: passLimpio }
      );

      if (loginError || !loginData || loginData.length === 0) {
        setError("Contraseña incorrecta.");
        return;
      }

      const clienteLogueado = loginData[0];
      localStorage.setItem("cliente_sesion", JSON.stringify(clienteLogueado));
      setSesionActiva(clienteLogueado);
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
      direccion: "",
      referido_por: refCode || null
    };

    const { error: insertError } = await supabase.from("clientes").insert([nuevoCliente]);
    if (insertError) {
      let mensaje = `Error al registrar: ${insertError.message}`;
      if (insertError.message.includes("TELEFONO_BLOQUEADO")) {
        mensaje = "Este número no puede acceder. Contactate con Bolson Click por WhatsApp.";
      } else if (insertError.message.includes("clientes_telefono")) {
        mensaje = "Este número ya está registrado. Iniciá sesión normalmente.";
      }
      setError(mensaje);
      return;
    }

    // No guardamos la contraseña en la sesión local (por seguridad)
    const { password: _omit, ...clienteSinPassword } = nuevoCliente;
    localStorage.setItem("cliente_sesion", JSON.stringify(clienteSinPassword));
    setSesionActiva(clienteSinPassword);

    // Le avisamos al negocio que se sumó alguien nuevo
    avisarAdmin({
      tipo: "registro",
      telefono: telLimpio,
      nombre: nombre.trim(),
      detalle: localidad.trim() || null
    });

    // Apenas se registra, le pedimos el permiso de notificaciones una sola vez (no bloqueante)
    suscribirPush(telLimpio).catch(() => {});
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

  async function cancelarPedido(pedidoId) {
    if (!confirm("¿Seguro que querés cancelar este pedido?")) return;
    setCancelandoId(pedidoId);
    try {
      const tel = user?.telefono || sesionActiva?.telefono;
      const res = await fetch("/api/mis-pedidos/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: pedidoId, telefono: tel })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo cancelar el pedido.");
        return;
      }
      // El aviso al negocio lo manda la propia ruta /api/mis-pedidos/cancelar,
      // que tiene los datos reales del pedido aunque se cancele apenas creado.
      setMisPedidos((prev) =>
        prev.map((p) => (p.id === pedidoId ? { ...p, estado: "cancelado" } : p))
      );
    } catch (e) {
      alert("Ocurrió un error al cancelar.");
    } finally {
      setCancelandoId(null);
    }
  }

  // --- Agregar productos a un pedido ya hecho ---
  const [agregandoAId, setAgregandoAId] = useState(null);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [resultadosProducto, setResultadosProducto] = useState([]);
  const [buscandoProducto, setBuscandoProducto] = useState(false);
  const [agregandoProducto, setAgregandoProducto] = useState(false);

  async function buscarProductos(texto) {
    setBusquedaProducto(texto);
    if (!texto || texto.trim().length < 2) {
      setResultadosProducto([]);
      return;
    }
    setBuscandoProducto(true);
    const { data } = await supabase
      .from("Productos")
      .select("id, nombre, precio, precio_oferta, imagen_url")
      .ilike("nombre", `%${texto.trim()}%`)
      .eq("activo", true)
      .limit(8);
    setResultadosProducto(data || []);
    setBuscandoProducto(false);
  }

  async function agregarProductoAPedido(pedidoId, producto) {
    setAgregandoProducto(true);
    try {
      const tel = user?.telefono || sesionActiva?.telefono;
      const res = await fetch("/api/mis-pedidos/agregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido_id: pedidoId,
          telefono: tel,
          productos: [{ producto_id: producto.id, cantidad: 1 }]
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo agregar el producto.");
        return;
      }

      // Refrescamos los pedidos para ver el cambio
      const resPedidos = await fetch(`/api/mis-pedidos?telefono=${encodeURIComponent(tel)}`);
      const result = await resPedidos.json();
      if (resPedidos.ok) setMisPedidos(result.pedidos || []);

      setBusquedaProducto("");
      setResultadosProducto([]);
      setAgregandoAId(null);
      alert(`✅ Agregado: ${data.agregados.join(", ")}`);
    } catch (e) {
      alert("Ocurrió un error al agregar el producto.");
    } finally {
      setAgregandoProducto(false);
    }
  }

  function empezarEdicion(pedido) {
    setEditandoId(pedido.id);
    const inicial = {};
    (pedido.items_pedido || []).forEach((item) => {
      inicial[item.id] = item.cantidad;
    });
    setItemsEditados(inicial);
  }

  function cambiarCantidadEditada(itemId, delta) {
    setItemsEditados((prev) => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + delta)
    }));
  }

  async function guardarEdicion(pedidoId) {
    setGuardandoEdicion(true);
    try {
      const tel = user?.telefono || sesionActiva?.telefono;
      const items = Object.entries(itemsEditados).map(([id, cantidad]) => ({
        id: Number(id),
        cantidad
      }));

      const res = await fetch("/api/mis-pedidos/modificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: pedidoId, telefono: tel, items })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo modificar el pedido.");
        return;
      }

      avisarAdmin({
        tipo: "pedido_modificado",
        telefono: tel,
        nombre: user?.nombre || sesionActiva?.nombre,
        monto: data.total
      });

      setMisPedidos((prev) =>
        prev.map((p) => {
          if (p.id !== pedidoId) return p;
          const nuevosItems = (p.items_pedido || [])
            .map((item) => ({ ...item, cantidad: itemsEditados[item.id] ?? item.cantidad }))
            .filter((item) => item.cantidad > 0);
          return { ...p, items_pedido: nuevosItems, total: data.total };
        })
      );
      setEditandoId(null);
    } catch (e) {
      alert("Ocurrió un error al guardar los cambios.");
    } finally {
      setGuardandoEdicion(false);
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

    const { data: actualizado, error: updateError } = await supabase.rpc(
      "actualizar_perfil_cliente",
      {
        p_id: sesionActiva.id,
        p_telefono: sesionActiva.telefono,
        p_email: emailPerfil.trim(),
        p_direccion: direccionPerfil.trim(),
        p_localidad: localidad.trim()
      }
    );

    if (updateError || !actualizado) {
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

          <button
            type="button"
            onClick={() => { window.location.href = "/favoritos"; }}
            className="w-full bg-white border border-gray-200 text-gray-700 text-center py-2.5 rounded-xl text-xs font-bold shadow-sm mb-4"
          >
            ❤️ Mis Favoritos
          </button>

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
            <ActivarNotificaciones telefono={user?.telefono || sesionActiva?.telefono} />
          </div>

          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="font-bold text-amber-900 text-sm">🎁 Invitá a tus amigos</p>
            <p className="text-xs text-amber-800 mt-1 mb-3">
              Compartí tu link y avisale a Bolson Click cuando alguien se registre gracias a vos.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `https://www.bolsonclick.com.ar/login?ref=${encodeURIComponent(user?.telefono || sesionActiva?.telefono)}`
                  );
                  setLinkCopiado(true);
                  setTimeout(() => setLinkCopiado(false), 2000);
                }}
                className="flex-1 bg-white border border-amber-300 text-amber-800 text-xs font-bold py-2 rounded-xl"
              >
                {linkCopiado ? "✓ Copiado" : "Copiar link"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `¡Mirá Bolson Click! Productos importados en El Bolsón y la Comarca Andina 🛍️ Entrá con mi link: https://www.bolsonclick.com.ar/login?ref=${user?.telefono || sesionActiva?.telefono}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-amber-500 text-white text-xs font-bold py-2 rounded-xl text-center"
              >
                Compartir
              </a>
            </div>
          </div>

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

                      {editandoId === pedido.id ? (
                        <div className="border-t border-gray-100 pt-2 mt-2 space-y-2">
                          {(pedido.items_pedido || []).map((item) => {
                            const cantidadActual = itemsEditados[item.id] ?? item.cantidad;
                            return (
                              <div key={item.id} className="flex items-center justify-between gap-2">
                                <span className="text-xs text-gray-700 flex-1 line-clamp-1">
                                  {item.nombre_producto}
                                </span>
                                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden flex-shrink-0">
                                  <button
                                    onClick={() => cambiarCantidadEditada(item.id, -1)}
                                    className="px-2 py-0.5 text-gray-600 hover:bg-gray-50"
                                  >
                                    −
                                  </button>
                                  <span className={`px-2.5 text-xs font-bold ${cantidadActual === 0 ? "text-red-500" : ""}`}>
                                    {cantidadActual}
                                  </span>
                                  <button
                                    onClick={() => cambiarCantidadEditada(item.id, 1)}
                                    className="px-2 py-0.5 text-gray-600 hover:bg-gray-50"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          <p className="text-[11px] text-gray-400">Poné un ítem en 0 para eliminarlo.</p>

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => guardarEdicion(pedido.id)}
                              disabled={guardandoEdicion}
                              className="btn-primary flex-1 text-xs py-2 disabled:opacity-50"
                            >
                              {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                            </button>
                            <button
                              onClick={() => setEditandoId(null)}
                              className="flex-1 bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded-xl"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                          {pedido.items_pedido && pedido.items_pedido.map((item) => (
                            <div key={item.id} className="flex justify-between text-xs text-gray-600">
                              <span>{item.cantidad}x {item.nombre_producto}</span>
                              <span className="font-medium">${formatPrice(item.precio_unitario * item.cantidad)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(!pedido.estado || pedido.estado === "pendiente") && editandoId !== pedido.id && (
                        <>
                          <div className="flex flex-wrap gap-3 mt-3">
                            <button
                              onClick={() => {
                                setAgregandoAId(agregandoAId === pedido.id ? null : pedido.id);
                                setBusquedaProducto("");
                                setResultadosProducto([]);
                              }}
                              className="text-xs font-semibold text-green-600"
                            >
                              {agregandoAId === pedido.id ? "✕ Cerrar" : "➕ Agregar producto"}
                            </button>
                            <button
                              onClick={() => empezarEdicion(pedido)}
                              className="text-xs font-semibold text-brand-blue"
                            >
                              ✏️ Modificar pedido
                            </button>
                            <button
                              onClick={() => cancelarPedido(pedido.id)}
                              disabled={cancelandoId === pedido.id}
                              className="text-xs font-semibold text-red-500 disabled:opacity-50"
                            >
                              {cancelandoId === pedido.id ? "Cancelando..." : "Cancelar pedido"}
                            </button>
                          </div>

                          {agregandoAId === pedido.id && (
                            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3">
                              <p className="text-xs font-bold text-green-800 mb-2">
                                Buscá el producto que querés sumar a este pedido
                              </p>
                              <input
                                value={busquedaProducto}
                                onChange={(e) => buscarProductos(e.target.value)}
                                className="input-field bg-white text-sm"
                                placeholder="Ej: luz led, termo, organizador..."
                                autoFocus
                              />

                              {buscandoProducto && (
                                <p className="text-xs text-gray-400 mt-2">Buscando...</p>
                              )}

                              {!buscandoProducto && busquedaProducto.length >= 2 && resultadosProducto.length === 0 && (
                                <p className="text-xs text-gray-500 mt-2">
                                  No encontramos nada con ese nombre.
                                </p>
                              )}

                              <div className="space-y-2 mt-2">
                                {resultadosProducto.map((prod) => {
                                  const precioFinal =
                                    Number(prod.precio_oferta) > 0 ? prod.precio_oferta : prod.precio;
                                  return (
                                    <div
                                      key={prod.id}
                                      className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-100"
                                    >
                                      {prod.imagen_url && (
                                        <img
                                          src={prod.imagen_url}
                                          alt=""
                                          className="w-10 h-10 object-cover rounded-md flex-shrink-0"
                                        />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-800 line-clamp-2">{prod.nombre}</p>
                                        <p className="text-xs font-bold text-brand-blue">
                                          ${formatPrice(precioFinal)}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => agregarProductoAPedido(pedido.id, prod)}
                                        disabled={agregandoProducto}
                                        className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-50"
                                      >
                                        {agregandoProducto ? "..." : "Agregar"}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>

                              <a
                                href={`/catalogo?agregar_a=${pedido.id}`}
                                className="block text-center text-xs font-semibold text-brand-blue mt-3 underline"
                              >
                                O buscá en todo el catálogo →
                              </a>
                            </div>
                          )}
                        </>
                      )}
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
        {esRegistro && !esCorreo && (
          <p className="text-xs text-gray-400 mb-3 text-center">
            El registro de clientes es solo con número de celular.
          </p>
        )}
        {refCode && esRegistro && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-center">
            <p className="text-sm text-amber-800 font-semibold">
              🎁 {refNombre ? `${refNombre} te invitó` : "Te invitaron"} a Bolson Click
            </p>
          </div>
        )}
        {!esRegistro && (
          <>
            <p className="text-sm text-brand-orange font-bold mb-1 text-center">
              Productos importados en El Bolsón y la Comarca Andina
            </p>
            <p className="text-xs text-gray-400 mb-3 text-center px-2">
              🚚 Envíos a El Bolsón y la Comarca Andina. Coordinamos por transporte local o punto de encuentro.
            </p>
          </>
        )}
        <p className="text-sm text-gray-500 mb-5 text-center">
          Ingresá con tu celular.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Celular
            </label>
            <input
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              className="input-field"
              placeholder="Ej: 2944123456"
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

          <button
            disabled={loading}
            className="btn-primary mt-2 disabled:opacity-50"
          >
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
