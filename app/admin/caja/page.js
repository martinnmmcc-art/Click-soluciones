"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";
import EscanerCodigo from "@/components/EscanerCodigo";
import { useActualizarSolo } from "@/lib/datosFrescos";
import {
  catalogoLocal, guardarCatalogo, fechaCatalogo,
  buscarPorCodigoLocal, buscarPorNombreLocal,
  encolarVenta, ventasPendientes, sincronizarVentas, hayConexion,
  guardarClientes, buscarClienteLocal,
  guardarPedidos, pedidosLocales, encolarCambio,
  cambiosPendientes, sincronizarCambios, totalPendiente
} from "@/lib/cajaOffline";

// Caja: para cobrar en el mostrador.
//
// Escanea el código con la cámara del celular, arma la venta, calcula el
// vuelto y descuenta el stock. Pensada para usarla con una mano mientras
// se atiende: botones grandes y pocos pasos.

// Billetes que más circulan, para calcular el vuelto de un toque
const BILLETES = [1000, 2000, 5000, 10000, 20000];

function Caja() {
  const [items, setItems] = useState([]);
  const [escaneando, setEscaneando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [cobrando, setCobrando] = useState(false);
  const [metodo, setMetodo] = useState("efectivo");
  const [recibido, setRecibido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ultimaVenta, setUltimaVenta] = useState(null);
  const [conexion, setConexion] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [productosGuardados, setProductosGuardados] = useState(0);

  // Datos del cliente: opcionales. En el mostrador muchas veces no hace
  // falta, pero si el cliente quiere que le quede registrado, se carga.
  const [conCliente, setConCliente] = useState(false);
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [sugerenciasCliente, setSugerenciasCliente] = useState([]);

  // Para agregar productos a un pedido que ya existe
  const [modo, setModo] = useState("venta"); // venta | agregar
  const [pedidosAbiertos, setPedidosAbiertos] = useState([]);
  const [pedidoElegido, setPedidoElegido] = useState(null);
  const [buscandoPedido, setBuscandoPedido] = useState("");

  // Buscamos clientes: primero en el celular, así funciona sin señal
  async function buscarCliente(texto) {
    setNombreCliente(texto);
    if (texto.trim().length < 2) {
      setSugerenciasCliente([]);
      return;
    }

    const locales = buscarClienteLocal(texto);
    if (locales.length > 0 || !hayConexion()) {
      setSugerenciasCliente(locales);
      return;
    }

    const { data } = await supabase
      .from("clientes")
      .select("id, nombre, telefono, localidad")
      .or(`nombre.ilike.%${texto.trim()}%,telefono.ilike.%${texto.replace(/\D/g, "")}%`)
      .limit(8);

    setSugerenciasCliente(data || []);
  }

  async function cargarPedidosAbiertos() {
    if (!hayConexion()) {
      setPedidosAbiertos(pedidosLocales());
      return;
    }

    const { data } = await supabase.rpc("pedidos_abiertos");
    setPedidosAbiertos(data || []);
  }

  // Guardamos el catálogo propio para poder cobrar sin señal
  async function actualizarCatalogo() {
    if (!hayConexion()) return;
    try {
      const { data } = await supabase
        .from("Productos")
        .select("id, nombre, precio, precio_oferta, stock, codigo_barras, bajo_pedido")
        .or("bajo_pedido.is.null,bajo_pedido.eq.false")
        .eq("activo", true);

      if (data) setProductosGuardados(guardarCatalogo(data));

      // Clientes: sin esto, al armar un pedido sin señal no aparece ninguno
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, nombre, telefono, localidad, direccion");
      if (clientes) guardarClientes(clientes);

      // Pedidos abiertos, para poder modificarlos sin señal
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("id, numero_pedido, nombre_cliente, telefono_cliente, total, monto_pagado, estado, estado_pago, created_at, items_pedido(producto_id, nombre_producto, cantidad, precio_unitario)")
        .neq("estado", "cancelado")
        .order("created_at", { ascending: false })
        .limit(50);
      if (pedidos) guardarPedidos(pedidos);
    } catch (e) {}
  }

  // El catálogo del mostrador (precios y stock) se mantiene al día solo
  useActualizarSolo(async () => {
    await enviarPendientes();
    await actualizarCatalogo();
  });

  async function enviarPendientes() {
    if (!hayConexion() || totalPendiente() === 0) return;

    setSincronizando(true);
    try {
      const r = await sincronizarVentas(supabase);
      const c = await sincronizarCambios(supabase);

      setPendientes(totalPendiente());

      if (r.enviadas > 0 || c.aplicados > 0) {
        const partes = [];
        if (r.enviadas > 0) partes.push(`${r.enviadas} venta(s)`);
        if (c.aplicados > 0) partes.push(`${c.aplicados} cambio(s)`);
        avisar(`✓ Se enviaron ${partes.join(" y ")}`, 4000);
        actualizarCatalogo();
        cargarPedidosAbiertos();
      }

      if (r.fallaron > 0 || c.fallaron > 0) {
        avisar("Algunos cambios no se pudieron enviar. Se reintentan solos.", 5000);
      }
    } finally {
      setSincronizando(false);
    }
  }

  useEffect(() => {
    setConexion(hayConexion());
    setPendientes(totalPendiente());
    setProductosGuardados(catalogoLocal().length);
    cargarPedidosAbiertos();

    actualizarCatalogo();
    enviarPendientes();

    // Cuando vuelve la señal, mandamos lo que quedó pendiente
    function alVolver() {
      setConexion(true);
      enviarPendientes();
      actualizarCatalogo();
    }
    function alCortarse() {
      setConexion(false);
    }

    window.addEventListener("online", alVolver);
    window.addEventListener("offline", alCortarse);
    return () => {
      window.removeEventListener("online", alVolver);
      window.removeEventListener("offline", alCortarse);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = items.reduce(
    (a, i) => a + Number(i.precio) * Number(i.cantidad),
    0
  );
  const vuelto = Math.max(Number(recibido || 0) - total, 0);

  function avisar(texto, ms = 2500) {
    setMensaje(texto);
    setTimeout(() => setMensaje(""), ms);
  }

  function sumarProducto(p) {
    setItems((prev) => {
      const existe = prev.find((x) => x.id === p.id);
      if (existe) {
        return prev.map((x) =>
          x.id === p.id ? { ...x, cantidad: x.cantidad + 1 } : x
        );
      }
      const precio =
        p.precio_oferta && Number(p.precio_oferta) < Number(p.precio)
          ? Number(p.precio_oferta)
          : Number(p.precio);

      return [...prev, { id: p.id, nombre: p.nombre, precio, cantidad: 1, stock: p.stock }];
    });
  }

  async function porCodigo(codigo) {
    setEscaneando(false);

    // Buscamos primero en el celular: es instantáneo y funciona sin señal
    let p = buscarPorCodigoLocal(codigo);

    if (!p && hayConexion()) {
      const { data } = await supabase.rpc("buscar_por_codigo", { p_codigo: codigo });
      p = data?.[0];
    }

    if (!p) {
      avisar(`❌ Código ${codigo} sin producto asociado`, 4000);
      return;
    }

    sumarProducto(p);
    avisar(`✓ ${p.nombre}`);
  }

  async function buscar(texto) {
    setBusqueda(texto);
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }

    if (!hayConexion()) {
      setResultados(buscarPorNombreLocal(texto));
      return;
    }

    const { data } = await supabase
      .from("Productos")
      .select("id, nombre, precio, precio_oferta, stock, imagen_url, bajo_pedido")
      .ilike("nombre", `%${texto.trim()}%`)
      .eq("activo", true)
      .order("stock", { ascending: false })
      .limit(8);

    setResultados(data?.length ? data : buscarPorNombreLocal(texto));
  }

  function cambiarCantidad(id, delta) {
    setItems((prev) =>
      prev
        .map((x) => (x.id === id ? { ...x, cantidad: x.cantidad + delta } : x))
        .filter((x) => x.cantidad > 0)
    );
  }

  // Suma los productos del carrito a un pedido que ya existe
  async function agregarAlPedido() {
    if (!pedidoElegido || items.length === 0) return;

    setGuardando(true);

    const productos = items.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      precio: i.precio
    }));

    try {
      if (!hayConexion()) {
        encolarCambio({
          tipo: "agregar_items",
          pedido_id: pedidoElegido.id,
          items: productos
        });

        setPendientes(totalPendiente());
        avisar(
          `📴 Sin señal: se van a agregar ${productos.length} producto(s) al pedido ` +
            `${pedidoElegido.numero_pedido} cuando vuelva la conexión.`,
          5000
        );
      } else {
        const { data, error } = await supabase.rpc("agregar_items_pedido", {
          p_pedido_id: pedidoElegido.id,
          p_items: productos
        });

        if (error) {
          // No perdemos el cambio: queda guardado para reintentar
          encolarCambio({
            tipo: "agregar_items",
            pedido_id: pedidoElegido.id,
            items: productos
          });
          setPendientes(totalPendiente());
          avisar("Se guardó para enviar: " + error.message, 5000);
        } else {
          avisar(
            `✓ Agregado al pedido ${pedidoElegido.numero_pedido}. ` +
              `Nuevo total: $${formatPrice(data?.[0]?.nuevo_total || 0)}`,
            5000
          );
          cargarPedidosAbiertos();
          actualizarCatalogo();
        }
      }

      setItems([]);
      setPedidoElegido(null);
      setModo("venta");
    } finally {
      setGuardando(false);
    }
  }

  async function cobrar() {
    if (items.length === 0) return;

    if (metodo === "efectivo" && Number(recibido || 0) < total) {
      avisar("El monto recibido es menor al total");
      return;
    }

    setGuardando(true);

    const productos = items.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      precio: i.precio
    }));

    const datosVenta = {
      items: productos,
      metodo_pago: metodo,
      total,
      pagado: total,
      nombre_cliente: conCliente ? nombreCliente.trim() : null,
      telefono: conCliente ? telefonoCliente.trim() : null
    };

    try {
      // Sin señal la venta igual se cobra: queda guardada y se envía sola
      // cuando vuelva la conexión.
      if (!hayConexion()) {
        const guardada = encolarVenta(datosVenta);
        setPendientes(ventasPendientes().length);

        setUltimaVenta({
          numero: "Pendiente de enviar",
          total,
          vuelto: metodo === "efectivo" ? vuelto : 0,
          recibido: Number(recibido || 0),
          metodo,
          sinSenal: true
        });

        setItems([]);
        setRecibido("");
        setCobrando(false);
        setConCliente(false);
        setNombreCliente("");
        setTelefonoCliente("");
        return;
      }

      const { data, error } = await supabase.rpc("venta_caja", {
        p_items: productos,
        p_metodo_pago: metodo,
        p_total: total,
        p_pagado: total,
        p_nombre_cliente: datosVenta.nombre_cliente,
        p_telefono: datosVenta.telefono
      });

      if (error) {
        // Si falla el envío, no perdemos la venta: la guardamos igual
        encolarVenta(datosVenta);
        setPendientes(ventasPendientes().length);

        setUltimaVenta({
          numero: "Guardada para enviar",
          total,
          vuelto: metodo === "efectivo" ? vuelto : 0,
          recibido: Number(recibido || 0),
          metodo,
          sinSenal: true
        });
      } else {
        setUltimaVenta({
          numero: data?.[0]?.numero,
          total,
          vuelto: metodo === "efectivo" ? vuelto : 0,
          recibido: Number(recibido || 0),
          metodo
        });
        actualizarCatalogo();
      }

      setItems([]);
      setRecibido("");
      setCobrando(false);
      setConCliente(false);
      setNombreCliente("");
      setTelefonoCliente("");
    } finally {
      setGuardando(false);
    }
  }

  // Pantalla de venta terminada
  if (ultimaVenta) {
    return (
      <main className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-lg">
          <p className="text-5xl mb-2">✅</p>
          <p className="font-extrabold text-lg text-gray-800">Venta cobrada</p>
          <p className="text-xs text-gray-500">{ultimaVenta.numero}</p>

          <p className="text-3xl font-black text-gray-800 mt-4">
            ${formatPrice(ultimaVenta.total)}
          </p>

          {ultimaVenta.metodo === "efectivo" && ultimaVenta.vuelto > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mt-4">
              <p className="text-xs font-bold text-amber-800">DAR DE VUELTO</p>
              <p className="text-4xl font-black text-amber-900 leading-tight">
                ${formatPrice(ultimaVenta.vuelto)}
              </p>
              <p className="text-[11px] text-amber-700 mt-1">
                Recibiste ${formatPrice(ultimaVenta.recibido)}
              </p>
            </div>
          )}

          {ultimaVenta.sinSenal && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded-xl p-3 mt-4">
              📴 Sin señal: la venta quedó guardada en el celular. Se envía
              sola cuando vuelvas a tener conexión y ahí se descuenta el stock.
            </p>
          )}

          {ultimaVenta.metodo === "transferencia" && (
            <p className="text-xs text-gray-600 bg-blue-50 rounded-xl p-3 mt-4">
              Acordate de verificar que la transferencia haya entrado.
            </p>
          )}

          <button
            onClick={() => setUltimaVenta(null)}
            className="w-full bg-brand-blue text-white text-sm font-bold py-3.5 rounded-xl mt-5"
          >
            Nueva venta
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-40">
      <EscanerCodigo
        abierto={escaneando}
        onLeer={porCodigo}
        onCerrar={() => setEscaneando(false)}
      />

      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-extrabold text-gray-800">🧾 Caja</h1>
          <Link href="/admin" className="text-xs text-brand-blue font-bold">
            Ir al panel →
          </Link>
        </div>

        {/* Estado de la conexión: importante saberlo antes de cobrar */}
        {(!conexion || pendientes > 0) && (
          <div
            className={`rounded-xl p-3 mb-3 border-2 ${
              conexion
                ? "bg-blue-50 border-blue-300"
                : "bg-amber-50 border-amber-400"
            }`}
          >
            <p className="text-sm font-bold text-gray-800">
              {conexion ? "📤 Ventas por enviar" : "📴 Estás sin señal"}
            </p>
            <p className="text-[11px] text-gray-700 mt-0.5">
              {!conexion
                ? `Podés cobrar igual: se guarda y se envía sola cuando vuelva la señal. Tenés ${productosGuardados} productos guardados.`
                : `Hay ${pendientes} venta(s) esperando enviarse.`}
            </p>

            {conexion && pendientes > 0 && (
              <button
                onClick={enviarPendientes}
                disabled={sincronizando}
                className="w-full bg-brand-blue text-white text-xs font-bold py-2 rounded-lg mt-2 disabled:opacity-50"
              >
                {sincronizando ? "Enviando..." : "Enviar ahora"}
              </button>
            )}
          </div>
        )}

        {mensaje && (
          <div className="bg-white border-2 border-brand-blue rounded-xl p-3 mb-3">
            <p className="text-sm font-bold text-gray-800">{mensaje}</p>
          </div>
        )}

        {/* Venta nueva o sumar a un pedido que ya existe */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => {
              setModo("venta");
              setPedidoElegido(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${
              modo === "venta"
                ? "bg-brand-blue text-white"
                : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            🧾 Venta nueva
          </button>
          <button
            onClick={() => {
              setModo("agregar");
              cargarPedidosAbiertos();
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${
              modo === "agregar"
                ? "bg-brand-blue text-white"
                : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            ➕ Sumar a un pedido
          </button>
        </div>

        {/* Elegir a qué pedido sumarle */}
        {modo === "agregar" && !pedidoElegido && (
          <div className="bg-white rounded-2xl border-2 border-brand-blue p-3 mb-3">
            <p className="text-xs font-bold text-gray-800 mb-2">
              ¿A qué pedido le agregás?
            </p>

            <input
              value={buscandoPedido}
              onChange={(e) => setBuscandoPedido(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
              placeholder="Buscar por nombre o número..."
            />

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {pedidosAbiertos
                .filter((p) => {
                  const q = buscandoPedido.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    p.nombre_cliente?.toLowerCase().includes(q) ||
                    p.numero_pedido?.toLowerCase().includes(q)
                  );
                })
                .slice(0, 12)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPedidoElegido(p)}
                    className="w-full text-left border border-gray-100 rounded-lg p-2.5"
                  >
                    <p className="text-xs font-bold text-gray-800">
                      {p.nombre_cliente || "Sin nombre"}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {p.numero_pedido} · ${formatPrice(p.total)}
                      {Number(p.total) > Number(p.monto_pagado || 0) && (
                        <span className="text-red-600 font-bold">
                          {" "}· debe ${formatPrice(Number(p.total) - Number(p.monto_pagado || 0))}
                        </span>
                      )}
                    </p>
                  </button>
                ))}

              {pedidosAbiertos.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  No hay pedidos abiertos.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Pedido elegido */}
        {modo === "agregar" && pedidoElegido && (
          <div className="bg-blue-50 border-2 border-brand-blue rounded-xl p-3 mb-3 flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-800">
                Sumando a: {pedidoElegido.nombre_cliente}
              </p>
              <p className="text-[11px] text-gray-600">
                {pedidoElegido.numero_pedido} · actual ${formatPrice(pedidoElegido.total)}
              </p>
            </div>
            <button
              onClick={() => setPedidoElegido(null)}
              className="text-[11px] font-bold text-gray-500"
            >
              Cambiar
            </button>
          </div>
        )}

        <button
          onClick={() => setEscaneando(true)}
          className="w-full bg-brand-blue text-white text-base font-bold py-5 rounded-2xl mb-3 shadow-sm"
        >
          📷 Escanear producto
        </button>

        <input
          value={busqueda}
          onChange={(e) => buscar(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2"
          placeholder="🔍 O buscalo por nombre..."
        />

        {resultados.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 mb-3 overflow-hidden">
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  sumarProducto(p);
                  setBusqueda("");
                  setResultados([]);
                }}
                className="w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-0 flex justify-between items-center"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-gray-800 line-clamp-1">
                    {p.nombre}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Stock: {p.stock ?? 0}
                  </span>
                </span>
                <span className="text-sm font-bold text-brand-blue whitespace-nowrap ml-2">
                  ${formatPrice(
                    p.precio_oferta && p.precio_oferta < p.precio
                      ? p.precio_oferta
                      : p.precio
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* PRODUCTOS DE LA VENTA */}
        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-4xl mb-2">🛒</p>
            <p className="text-sm text-gray-500">
              Escaneá o buscá los productos que se lleva el cliente.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((i) => (
              <div
                key={i.id}
                className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 line-clamp-2 leading-tight">
                    {i.nombre}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    ${formatPrice(i.precio)} c/u
                    {Number(i.stock || 0) < i.cantidad && (
                      <span className="text-red-600 font-bold">
                        {" "}· ¡solo hay {i.stock}!
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => cambiarCantidad(i.id, -1)}
                    className="w-9 h-9 bg-gray-100 rounded-lg text-lg font-bold text-gray-600"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{i.cantidad}</span>
                  <button
                    onClick={() => cambiarCantidad(i.id, 1)}
                    className="w-9 h-9 bg-gray-100 rounded-lg text-lg font-bold text-gray-600"
                  >
                    +
                  </button>
                </div>

                <span className="text-sm font-extrabold text-gray-800 w-20 text-right">
                  ${formatPrice(i.precio * i.cantidad)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BARRA DE COBRO */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 z-40">
          <div className="max-w-2xl mx-auto">
            {!cobrando ? (
              <>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600">
                    {items.reduce((a, i) => a + i.cantidad, 0)} producto(s)
                  </span>
                  <span className="text-2xl font-black text-gray-800">
                    ${formatPrice(total)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setItems([])}
                    className="px-4 text-xs font-bold text-red-500"
                  >
                    Vaciar
                  </button>
                  {modo === "agregar" ? (
                    <button
                      onClick={agregarAlPedido}
                      disabled={!pedidoElegido || guardando}
                      className="flex-1 bg-brand-blue text-white text-base font-bold py-4 rounded-xl disabled:opacity-40"
                    >
                      {guardando
                        ? "Agregando..."
                        : pedidoElegido
                        ? `Agregar al pedido`
                        : "Elegí un pedido primero"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setCobrando(true)}
                      className="flex-1 bg-green-600 text-white text-base font-bold py-4 rounded-xl"
                    >
                      Cobrar ${formatPrice(total)}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setMetodo("efectivo")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${
                      metodo === "efectivo"
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    💵 Efectivo
                  </button>
                  <button
                    onClick={() => setMetodo("transferencia")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${
                      metodo === "transferencia"
                        ? "bg-brand-blue text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    🏦 Transferencia
                  </button>
                </div>

                {metodo === "efectivo" && (
                  <>
                    <p className="text-xs font-bold text-gray-600 mb-1">
                      ¿Con cuánto paga?
                    </p>

                    <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                      <button
                        onClick={() => setRecibido(String(total))}
                        className="px-3 py-2 bg-gray-100 rounded-lg text-xs font-bold whitespace-nowrap"
                      >
                        Justo
                      </button>
                      {BILLETES.filter((b) => b >= total).slice(0, 3).map((b) => (
                        <button
                          key={b}
                          onClick={() => setRecibido(String(b))}
                          className="px-3 py-2 bg-gray-100 rounded-lg text-xs font-bold whitespace-nowrap"
                        >
                          ${formatPrice(b)}
                        </button>
                      ))}
                    </div>

                    <input
                      type="number"
                      value={recibido}
                      onChange={(e) => setRecibido(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl font-bold text-center mb-2"
                      placeholder="0"
                      inputMode="numeric"
                    />

                    {Number(recibido || 0) >= total && (
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mb-2 text-center">
                        <p className="text-[11px] font-bold text-amber-800">VUELTO</p>
                        <p className="text-3xl font-black text-amber-900 leading-none">
                          ${formatPrice(vuelto)}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Cliente: opcional. En el mostrador casi nunca hace falta,
                    pero si quiere que le quede registrado, se carga. */}
                <label className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                  <input
                    type="checkbox"
                    checked={conCliente}
                    onChange={(e) => setConCliente(e.target.checked)}
                  />
                  Anotar a nombre de un cliente
                </label>

                {conCliente && (
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1 relative">
                      <input
                        value={nombreCliente}
                        onChange={(e) => buscarCliente(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Nombre"
                      />

                      {sugerenciasCliente.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto">
                          {sugerenciasCliente.map((c) => (
                            <button
                              key={c.telefono}
                              type="button"
                              onClick={() => {
                                setNombreCliente(c.nombre);
                                setTelefonoCliente(c.telefono);
                                setSugerenciasCliente([]);
                              }}
                              className="w-full text-left px-3 py-2 border-b border-gray-50 last:border-0"
                            >
                              <span className="block text-xs font-semibold text-gray-800">
                                {c.nombre}
                              </span>
                              <span className="block text-[11px] text-gray-500">
                                {c.telefono}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      value={telefonoCliente}
                      onChange={(e) => setTelefonoCliente(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="Celular"
                      inputMode="numeric"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setCobrando(false)}
                    className="px-4 text-xs font-bold text-gray-500"
                  >
                    Volver
                  </button>
                  <button
                    onClick={cobrar}
                    disabled={
                      guardando ||
                      (metodo === "efectivo" && Number(recibido || 0) < total)
                    }
                    className="flex-1 bg-green-600 text-white text-base font-bold py-4 rounded-xl disabled:opacity-40"
                  >
                    {guardando ? "Cobrando..." : "Confirmar cobro"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function CajaPage() {
  return (
    <AdminGuard>
      <Caja />
    </AdminGuard>
  );
}
