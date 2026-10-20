"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import ControlNotificaciones from "@/components/ControlNotificaciones";
import SelectorTema from "@/components/SelectorTema";
import RedesSociales from "@/components/RedesSociales";
import PedirNotificaciones from "@/components/PedirNotificaciones";
import DescargarOffline from "@/components/DescargarOffline";
import { useAuth } from "@/context/AuthContext";
import { ADMIN_EMAILS } from "@/context/AdminContext";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";
import { suscribirPush } from "@/lib/push";
import { avisarAdmin } from "@/lib/avisarAdmin";
import { estadoEntrega, estadoPago, textoPago, PASOS_SEGUIMIENTO, pasoActual } from "@/lib/estadosPedido";
import { aplicarBusqueda } from "@/lib/buscar";


export default function LoginPage() {
  const { user, logout } = useAuth();

  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [localidad, setLocalidad] = useState("");
  // Quien llega sin sesión casi siempre es nuevo: arrancamos por "Crear cuenta"
  const [esRegistro, setEsRegistro] = useState(true);
  // Registro guiado: 1 celular → 2 nombre → 3 localidad → 4 contraseña
  const [pasoRegistro, setPasoRegistro] = useState(1);
  const [verPass, setVerPass] = useState(false);
  const [aviso, setAviso] = useState("");
  const [chequeando, setChequeando] = useState(false);

  const [emailPerfil, setEmailPerfil] = useState("");
  const [direccionPerfil, setDireccionPerfil] = useState("");
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [cambiandoPass, setCambiandoPass] = useState(false);
  const [aliasCopiado, setAliasCopiado] = useState(false);
  const [paraResenar, setParaResenar] = useState([]);
  const [misResenas, setMisResenas] = useState([]);

  // Copiar el alias con un toque: escribirlo a mano es donde la gente se
  // equivoca o directamente abandona la transferencia.
  async function copiarAlias() {
    try {
      await navigator.clipboard.writeText("bolsonclick");
      setAliasCopiado(true);
      setTimeout(() => setAliasCopiado(false), 2500);
    } catch (e) {
      alert("Alias para transferir: bolsonclick");
    }
  }
  const [passActual, setPassActual] = useState("");
  const [passNueva, setPassNueva] = useState("");
  const [passRepetir, setPassRepetir] = useState("");
  const [tienePassPropia, setTienePassPropia] = useState(true);
  const [msgPass, setMsgPass] = useState("");
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [mensajePerfil, setMensajePerfil] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sesionActiva, setSesionActiva] = useState(null);

  // Productos que recibió y todavía no opinó. Ponerlo acá es clave: en la
  // ficha del producto hay que buscarlo, acá lo ve al entrar a sus pedidos.
  useEffect(() => {
    const tel = user?.telefono || sesionActiva?.telefono;
    if (!tel) return;

    async function cargarResenas() {
      const [{ data: pendientes }, { data: mias }] = await Promise.all([
        supabase.rpc("productos_para_resenar", { p_telefono: tel }),
        supabase.rpc("mis_resenas", { p_telefono: tel })
      ]);
      setParaResenar(pendientes || []);
      setMisResenas(mias || []);
    }
    cargarResenas();
  }, [user, sesionActiva]);


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
    // Si llega desde un catálogo compartido, le abrimos el registro directo
    if (params.get("registro") === "1") {
      setEsRegistro(true);
    }
    // "Ya tengo cuenta" desde otras pantallas
    if (params.get("entrar") === "1") {
      setEsRegistro(false);
    }

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

  // Si la cuenta se creó al comprar, el cliente nunca eligió contraseña:
  // en ese caso le pedimos que defina una, no la anterior.
  useEffect(() => {
    const tel = user?.telefono || sesionActiva?.telefono;
    if (!tel) return;

    async function chequear() {
      const { data } = await supabase.rpc("tiene_password_propia", { p_telefono: tel });
      setTienePassPropia(data !== false);
    }
    chequear();
  }, [user, sesionActiva]);

  async function cambiarPassword(e) {
    e.preventDefault();
    setMsgPass("");

    if (passNueva.length < 4) {
      setMsgPass("❌ La contraseña nueva tiene que tener al menos 4 caracteres.");
      return;
    }
    if (passNueva !== passRepetir) {
      setMsgPass("❌ Las dos contraseñas nuevas no coinciden.");
      return;
    }

    setGuardandoPass(true);
    try {
      const tel = user?.telefono || sesionActiva?.telefono;
      const { data, error } = await supabase.rpc("cambiar_password_cliente", {
        p_telefono: tel,
        p_password_actual: passActual,
        p_password_nueva: passNueva
      });

      const r = data?.[0];

      if (error || !r?.ok) {
        const motivo = r?.motivo;
        setMsgPass(
          motivo === "ACTUAL_INCORRECTA"
            ? "❌ La contraseña actual no es correcta."
            : motivo === "CORTA"
            ? "❌ La contraseña nueva es muy corta."
            : "❌ No se pudo cambiar. Probá de nuevo."
        );
        return;
      }

      setMsgPass("✅ ¡Listo! Tu contraseña quedó cambiada.");
      setPassActual("");
      setPassNueva("");
      setPassRepetir("");
      setTienePassPropia(true);
      setTimeout(() => {
        setCambiandoPass(false);
        setMsgPass("");
      }, 2500);
    } catch (err) {
      setMsgPass("❌ Ocurrió un error. Intentá de nuevo.");
    } finally {
      setGuardandoPass(false);
    }
  }

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
        setError(
          "Contraseña incorrecta. Si te equivocaste varias veces, esperá 15 minutos " +
          "o escribinos por WhatsApp para que te la restablezcamos."
        );
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

    // El registro pasa por una función del servidor que cifra la contraseña
    // antes de guardarla. La contraseña real nunca queda almacenada.
    const { data: nuevoCliente, error: insertError } = await supabase.rpc("registrar_cliente", {
      p_telefono: telLimpio,
      p_password: passLimpio,
      p_nombre: nombre.trim(),
      p_localidad: localidad.trim(),
      p_referido_por: refCode || null
    });

    if (insertError || !nuevoCliente || nuevoCliente.length === 0) {
      const msg = insertError?.message || "";
      let mensaje = "No se pudo completar el registro. Intentá de nuevo.";
      if (msg.includes("TELEFONO_BLOQUEADO")) {
        mensaje = "Este número no puede acceder. Contactate con Bolson Click por WhatsApp.";
      } else if (msg.includes("TELEFONO_YA_REGISTRADO")) {
        mensaje = "Este número ya está registrado. Iniciá sesión normalmente.";
      } else if (msg.includes("TELEFONO_INVALIDO")) {
        mensaje = "El celular debe tener 10 números (ej: 2944123456).";
      } else if (msg.includes("PASSWORD_CORTA")) {
        mensaje = "La contraseña tiene que tener al menos 4 caracteres.";
      } else if (msg.includes("NOMBRE_INVALIDO")) {
        mensaje = "Ingresá tu nombre y apellido.";
      }
      setError(mensaje);
      return;
    }

    const clienteRegistrado = nuevoCliente[0];
    localStorage.setItem("cliente_sesion", JSON.stringify(clienteRegistrado));
    setSesionActiva(clienteRegistrado);

    // Le avisamos al negocio que se sumó alguien nuevo
    avisarAdmin({
      tipo: "registro",
      telefono: telLimpio,
      nombre: clienteRegistrado.nombre,
      detalle: clienteRegistrado.localidad || null
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
      // Al panel, no a productos: ahí están las ventas del día, los pedidos
      // abiertos y el balance, que es lo primero que querés ver al entrar.
      window.location.href = "/admin";
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
    const { data } = await aplicarBusqueda(
      supabase.from("Productos").select("id, nombre, precio, precio_oferta, imagen_url"),
      texto
    )
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

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => setEditandoPerfil(!editandoPerfil)}
                className="btn-secondary w-full text-xs"
              >
                {editandoPerfil ? "Cancelar edición" : "⚙️ Completar / Editar mis datos opcionales"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCambiandoPass(!cambiandoPass);
                  setMsgPass("");
                }}
                className="btn-secondary w-full text-xs"
              >
                {cambiandoPass
                  ? "Cancelar"
                  : tienePassPropia
                  ? "🔑 Cambiar mi contraseña"
                  : "🔑 Ponerle una contraseña a mi cuenta"}
              </button>
            </div>
          </div>

          {cambiandoPass && (
            <div className="card p-5 mb-4 bg-blue-50/50 border border-blue-200">
              <h2 className="font-bold text-sm text-gray-800 mb-1 text-center">
                {tienePassPropia ? "Cambiar contraseña" : "Elegí tu contraseña"}
              </h2>

              {!tienePassPropia && (
                <p className="text-[11px] text-gray-600 text-center mb-3">
                  Tu cuenta se creó automáticamente al comprar, así que todavía
                  no tenés una contraseña propia. Elegí una ahora.
                </p>
              )}

              {msgPass && (
                <div className="text-xs text-center p-2 mb-3 rounded-lg bg-white border font-medium">
                  {msgPass}
                </div>
              )}

              <form onSubmit={cambiarPassword} className="space-y-3">
                {tienePassPropia && (
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Contraseña actual
                    </label>
                    <input
                      type="password"
                      value={passActual}
                      onChange={(e) => setPassActual(e.target.value)}
                      className="input-field bg-white"
                      placeholder="La que usás ahora"
                      autoComplete="current-password"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Contraseña nueva
                  </label>
                  <input
                    type="password"
                    value={passNueva}
                    onChange={(e) => setPassNueva(e.target.value)}
                    className="input-field bg-white"
                    placeholder="Al menos 4 caracteres"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Repetila
                  </label>
                  <input
                    type="password"
                    value={passRepetir}
                    onChange={(e) => setPassRepetir(e.target.value)}
                    className="input-field bg-white"
                    placeholder="Escribila de nuevo"
                    autoComplete="new-password"
                  />
                </div>

                <button
                  disabled={guardandoPass}
                  className="btn-primary w-full text-xs py-2 disabled:opacity-50"
                >
                  {guardandoPass ? "Guardando..." : "Guardar contraseña"}
                </button>
              </form>

              <p className="text-[10px] text-gray-400 text-center mt-3">
                Si te la olvidás, escribinos por WhatsApp y te la restablecemos.
              </p>
            </div>
          )}

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
            <ControlNotificaciones telefono={user?.telefono || sesionActiva?.telefono} />
          </div>

          <div className="card p-4 mb-4">
            <SelectorTema variante="completo" />
          </div>

          <div className="mb-4">
            <RedesSociales />
          </div>

          <div className="mb-4">
            <DescargarOffline telefono={user?.telefono || sesionActiva?.telefono} />
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

          {misPedidos.some((p) => !p.estado || p.estado === "pendiente") && (
            <div className="mb-4">
              <PedirNotificaciones
                telefono={user?.telefono || sesionActiva?.telefono}
                motivo="compra"
              />
            </div>
          )}

          {/* Total de deuda: si tiene varios pedidos impagos, verlo junto
              es más claro que sumar de a uno */}
          {(() => {
            const deudaTotal = misPedidos
              .filter((p) => p.estado !== "cancelado")
              .reduce(
                (a, p) =>
                  a + Math.max(Number(p.total || 0) - Number(p.monto_pagado || 0), 0),
                0
              );

            if (deudaTotal <= 0) return null;

            return (
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-4 mb-4 text-white">
                <p className="text-[11px] font-bold opacity-90">TOTAL PENDIENTE</p>
                <p className="text-3xl font-black leading-none mt-1">
                  ${formatPrice(deudaTotal)}
                </p>

                <button
                  type="button"
                  onClick={copiarAlias}
                  className="w-full bg-white rounded-xl py-2 mt-3"
                >
                  <span className="block text-[10px] text-amber-700 font-semibold">
                    Transferí al alias
                  </span>
                  <span className="block text-lg font-black text-amber-900 leading-tight">
                    bolsonclick
                  </span>
                  <span className="block text-[10px] text-amber-700">
                    {aliasCopiado ? "✓ Copiado, pegalo en tu banco" : "Tocá para copiar"}
                  </span>
                </button>

                <p className="text-[10px] opacity-90 mt-2 text-center">
                  Después mandanos el comprobante por WhatsApp 🙌
                </p>
              </div>
            );
          })()}

          {/* OPINAR SOBRE LO QUE RECIBIÓ */}
          {paraResenar.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-4">
              <p className="font-bold text-sm text-gray-800">
                ⭐ ¿Cómo te fue con lo que compraste?
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5 mb-3">
                Tu opinión ayuda a otros vecinos que están dudando.
              </p>

              <div className="space-y-2">
                {paraResenar.slice(0, 4).map((p) => (
                  <a
                    key={p.producto_id}
                    href={`/producto/${p.producto_id}`}
                    className="flex items-center gap-2.5 bg-white rounded-xl p-2.5"
                  >
                    <div className="w-11 h-11 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {p.imagen_url ? (
                        <img
                          src={p.imagen_url}
                          alt=""
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span className="text-lg">📦</span>
                      )}
                    </div>

                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] font-semibold text-gray-800 line-clamp-2 leading-tight">
                        {p.nombre}
                      </span>
                      <span className="block text-[10px] text-brand-blue font-bold mt-0.5">
                        Dejar mi opinión →
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ESTADO DE LAS QUE YA DEJÓ */}
          {misResenas.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
              <p className="font-bold text-sm text-gray-800 mb-2">Mis opiniones</p>
              <div className="space-y-2">
                {misResenas.map((r) => (
                  <div key={r.producto_id} className="flex items-start gap-2">
                    <span className="text-amber-400 text-xs flex-shrink-0">
                      {"★".repeat(r.estrellas)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] text-gray-700 line-clamp-1">
                        {r.producto}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          r.aprobada ? "text-green-700" : "text-amber-700"
                        }`}
                      >
                        {r.aprobada ? "✓ Publicada" : "🕐 En revisión"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
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

                      {(() => {
                        const entrega = estadoEntrega(pedido.estado);
                        const pago = estadoPago(pedido.estado_pago);
                        const cancelado =
                          pedido.estado === "cancelado" || pedido.estado === "rechazado";

                        return (
                          <>
                            <div className="flex flex-wrap gap-2 mb-2">
                              <span
                                className={`text-[11px] font-semibold border rounded-lg px-2 py-1 ${entrega.color}`}
                              >
                                {entrega.icono} {entrega.labelCliente}
                              </span>
                              <span
                                className={`text-[11px] font-semibold border rounded-lg px-2 py-1 ${pago.color}`}
                              >
                                {pago.icono} {pago.labelCliente}
                              </span>
                            </div>

                            {/* Explicación en palabras: evita que tenga que preguntar */}
                            {(() => {
                              const texto = textoPago(
                                pedido.estado_pago,
                                pedido.estado,
                                saldo
                              );
                              return texto ? (
                                <p className="text-[11px] text-gray-500 mb-1">{texto}</p>
                              ) : null;
                            })()}

                            {/* Barra de seguimiento, como la de una encomienda */}
                            {!cancelado && (
                              <div className="flex items-center gap-1 my-2.5">
                                {PASOS_SEGUIMIENTO.map((paso, i) => {
                                  const actual = pasoActual(pedido.estado);
                                  const alcanzado = i <= actual;
                                  return (
                                    <div key={paso} className="flex-1 flex items-center gap-1">
                                      <div
                                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                                          alcanzado ? "bg-brand-blue" : "bg-gray-200"
                                        }`}
                                      />
                                      {i === PASOS_SEGUIMIENTO.length - 1 && (
                                        <span className="text-[10px]">
                                          {alcanzado ? "🎉" : "🏁"}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {!cancelado && entrega.ayuda && (
                              <p className="text-[11px] text-gray-600 font-medium mb-2">
                                {entrega.ayuda}
                              </p>
                            )}
                          </>
                        );
                      })()}

                      {saldo > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-amber-900">
                              Falta pagar
                            </span>
                            <span className="text-base font-extrabold text-amber-900">
                              ${formatPrice(saldo)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={copiarAlias}
                            className="w-full bg-white border border-amber-300 rounded-lg py-1.5 mt-2"
                          >
                            <span className="block text-[9px] text-amber-700">
                              Transferí al alias
                            </span>
                            <span className="block text-sm font-black text-amber-900">
                              bolsonclick
                            </span>
                            <span className="block text-[9px] text-amber-700">
                              {aliasCopiado ? "✓ Copiado" : "Tocá para copiar"}
                            </span>
                          </button>
                        </div>
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

  // ---------- Registro guiado ----------
  const LOCALIDADES = ["El Bolsón", "Lago Puelo", "El Hoyo", "Epuyén", "Mallín Ahogado"];
  const TOTAL_PASOS = 4;

  function celularLimpio() {
    let limpio = identificador.trim().replace(/\D/g, "");
    if (limpio.startsWith("54")) limpio = limpio.slice(2);
    if (limpio.startsWith("9")) limpio = limpio.slice(1);
    return limpio;
  }

  function cambiarModo(registro) {
    setEsRegistro(registro);
    setPasoRegistro(1);
    setError("");
    setAviso("");
  }

  async function avanzarRegistro(e) {
    e.preventDefault();
    setError("");
    setAviso("");

    if (pasoRegistro === 1) {
      const tel = celularLimpio();
      if (!validarCelular(tel) || tel.length !== 10) {
        setError("Escribí tu celular con característica, sin 0 ni 15. Ej: 2944123456");
        return;
      }
      setChequeando(true);
      try {
        const [{ data: bloqueado }, { data: existe }] = await Promise.all([
          supabase.rpc("telefono_esta_bloqueado", { p_telefono: tel }),
          supabase.rpc("telefono_ya_registrado", { p_telefono: tel })
        ]);
        if (bloqueado) {
          setError("Este número no puede acceder. Contactate con Bolson Click por WhatsApp.");
          return;
        }
        if (existe) {
          // Ya es cliente: lo mandamos directo a entrar, con el celular puesto
          setEsRegistro(false);
          setAviso("¡Ese celular ya tiene cuenta! Poné tu contraseña para entrar.");
          return;
        }
        setPasoRegistro(2);
      } catch {
        setPasoRegistro(2);
      } finally {
        setChequeando(false);
      }
      return;
    }
    if (pasoRegistro === 2) {
      if (nombre.trim().length < 2) {
        setError("Escribí tu nombre y apellido.");
        return;
      }
      setPasoRegistro(3);
      return;
    }
    if (pasoRegistro === 3) {
      setPasoRegistro(4);
      return;
    }
    if (password.trim().length < 4) {
      setError("La contraseña tiene que tener al menos 4 caracteres.");
      return;
    }
    await handleSubmit(e);
  }

  const primerNombre = nombre.trim().split(/\s+/)[0] || "";
  const titulosRegistro = {
    1: "¿Cuál es tu celular?",
    2: "¿Cómo te llamás?",
    3: `${primerNombre ? primerNombre + ", ¿" : "¿"}dónde te lo entregamos?`,
    4: "Elegí una contraseña"
  };

  return (
    <main className="pb-28">
      <Header showSearch={false} />
      <div className="px-4 pt-5 max-w-md mx-auto">
        {/* Bienvenida: quién somos y qué gana registrándose */}
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="w-14 h-14 rounded-2xl shadow-sm flex-shrink-0" />
          <div>
            <h1 className="font-black text-[21px] text-gray-900 leading-tight">Bienvenido a Bolson Click</h1>
            <p className="text-[12.5px] text-gray-600 leading-snug">
              Productos para tu casa, con entrega en El Bolsón y la Comarca.
            </p>
          </div>
        </div>

        {refCode && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3 text-center">
            <p className="text-sm text-amber-800 font-semibold">
              🎁 {refNombre ? `${refNombre} te invitó` : "Te invitaron"} a Bolson Click
            </p>
          </div>
        )}

        {/* Nuevo / ya tengo cuenta */}
        <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-2xl p-1 mt-4" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={esRegistro}
            onClick={() => cambiarModo(true)}
            className={`py-2.5 rounded-xl text-sm font-bold transition ${esRegistro ? "bg-white text-brand-blue shadow-sm" : "text-gray-500"}`}
          >
            Soy nuevo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!esRegistro}
            onClick={() => cambiarModo(false)}
            className={`py-2.5 rounded-xl text-sm font-bold transition ${!esRegistro ? "bg-white text-brand-blue shadow-sm" : "text-gray-500"}`}
          >
            Ya tengo cuenta
          </button>
        </div>

        {esRegistro && pasoRegistro === 1 && (
          <ul className="mt-4 space-y-1.5">
            {[
              ["📦", "Seguís tus pedidos sin tener que preguntar"],
              ["🔔", "Te avisamos cuando llega lo que te interesa"],
              ["⭐", "Guardás tus favoritos y comprás más rápido"]
            ].map(([ic, t]) => (
              <li key={t} className="flex items-center gap-2 text-[12.5px] text-gray-700">
                <span aria-hidden="true">{ic}</span>
                {t}
              </li>
            ))}
          </ul>
        )}

        {aviso && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-xl p-3 mt-4 text-center" role="status">
            {aviso}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mt-4 text-center" role="alert">
            {error}
          </div>
        )}

        {esRegistro ? (
          <form onSubmit={avanzarRegistro} noValidate className="mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-3">
              {Array.from({ length: TOTAL_PASOS }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${i < pasoRegistro ? "bg-brand-blue" : "bg-gray-200"}`}
                />
              ))}
              <span className="text-[11px] font-bold text-gray-400 ml-1 whitespace-nowrap">
                Paso {pasoRegistro} de {TOTAL_PASOS}
              </span>
            </div>

            <h2 className="font-extrabold text-lg text-gray-800 mb-3">{titulosRegistro[pasoRegistro]}</h2>

            {pasoRegistro === 1 && (
              <>
                <input
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  className="input-field text-base tracking-wide"
                  placeholder="2944 123456"
                  inputMode="tel"
                  autoComplete="tel"
                  autoFocus
                />
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Con característica, sin 0 ni 15. Con tu celular entrás a tu cuenta y coordinamos las entregas.
                </p>
              </>
            )}

            {pasoRegistro === 2 && (
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="input-field text-base"
                placeholder="Nombre y apellido"
                autoComplete="name"
                autoFocus
              />
            )}

            {pasoRegistro === 3 && (
              <>
                <div className="flex flex-wrap gap-2">
                  {LOCALIDADES.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLocalidad(l)}
                      aria-pressed={localidad === l}
                      className={`px-3 py-2 rounded-full text-sm font-semibold border transition ${
                        localidad === l ? "bg-brand-blue text-white border-brand-blue" : "bg-white text-gray-700 border-gray-300"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <input
                  value={LOCALIDADES.includes(localidad) ? "" : localidad}
                  onChange={(e) => setLocalidad(e.target.value)}
                  className="input-field text-sm mt-3"
                  placeholder="¿Otra? Escribila acá"
                />
                <p className="text-[11px] text-gray-500 mt-1.5">Si no sabés, tocá Siguiente igual.</p>
              </>
            )}

            {pasoRegistro === 4 && (
              <>
                <div className="relative">
                  <input
                    type={verPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field text-base pr-20"
                    placeholder="Mínimo 4 caracteres"
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setVerPass(!verPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-blue"
                  >
                    {verPass ? "Ocultar" : "Ver"}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  La vas a usar para entrar desde otro celular. Anotala en un lugar seguro.
                </p>
              </>
            )}

            <div className="flex gap-2 mt-4">
              {pasoRegistro > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setPasoRegistro(pasoRegistro - 1);
                  }}
                  className="px-4 rounded-xl border border-gray-300 text-gray-600 font-semibold text-sm"
                >
                  Atrás
                </button>
              )}
              <button disabled={loading || chequeando} className="btn-primary flex-1 disabled:opacity-50">
                {loading
                  ? "Creando tu cuenta..."
                  : chequeando
                  ? "Revisando..."
                  : pasoRegistro < TOTAL_PASOS
                  ? "Siguiente"
                  : "Crear mi cuenta"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Celular</label>
              <input
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                className="input-field"
                placeholder="Ej: 2944123456"
                autoComplete="username"
                inputMode={esCorreo ? "email" : "tel"}
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Contraseña</label>
              <div className="relative">
                <input
                  type={verPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-20"
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  autoFocus={!!aviso}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVerPass(!verPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-blue"
                >
                  {verPass ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>
            <button disabled={loading} className="btn-primary mt-1 disabled:opacity-50">
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <p className="text-[11px] text-gray-500 text-center">
              ¿Te olvidaste la contraseña? Escribinos por WhatsApp y te la restablecemos.
            </p>
          </form>
        )}

        <div className="mt-6">
          <RedesSociales titulo="Mientras tanto, seguinos" compacto conWhatsApp />
        </div>
      </div>
    </main>
  );
}
