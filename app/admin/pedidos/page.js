"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import AdminGuard from "@/components/AdminGuard";
import { formatPrice } from "@/lib/whatsapp";
import { supabase } from "@/lib/supabaseClient";
import ComprobantePedido from "@/components/ComprobantePedido";
import { guardarCatalogoOffline, leerCatalogoOffline, fechaCatalogoOffline } from "@/lib/catalogoOffline";
import { encolarPedido, sincronizarCola, cantidadPendientes } from "@/lib/colaPedidos";

const OPCIONES_ENTREGA = [
  { value: "pendiente", label: "Pendiente" },
  { value: "entregado", label: "Entregado" },
  { value: "demorado", label: "Demorado" },
  { value: "rechazado", label: "Rechazado" },
  { value: "esperando_stock", label: "Esperando stock" },
  { value: "cancelado", label: "Cancelado (cliente)" },
];

const OPCIONES_PAGO = [
  { value: "falta_pagar", label: "Falta pagar" },
  { value: "pagado", label: "Pagado" },
  { value: "deuda_parcial", label: "Deuda parcial" },
  { value: "a_favor", label: "A favor" },
  { value: "señado", label: "Señado" },
];

const COLOR_ENTREGA = {
  pendiente: "bg-yellow-50 text-yellow-700 border-yellow-200",
  entregado: "bg-green-50 text-green-700 border-green-200",
  demorado: "bg-orange-50 text-orange-700 border-orange-200",
  rechazado: "bg-red-50 text-red-700 border-red-200",
  esperando_stock: "bg-purple-50 text-purple-700 border-purple-200",
  cancelado: "bg-gray-100 text-gray-500 border-gray-200",
};

const COLOR_PAGO = {
  falta_pagar: "bg-red-50 text-red-700 border-red-200",
  pagado: "bg-green-50 text-green-700 border-green-200",
  deuda_parcial: "bg-orange-50 text-orange-700 border-orange-200",
  a_favor: "bg-blue-50 text-blue-700 border-blue-200",
  señado: "bg-purple-50 text-purple-700 border-purple-200",
};

function generarNumeroPedido() {
  const fecha = new Date();
  const yy = String(fecha.getFullYear()).slice(-2);
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CS-${yy}${mm}${dd}-${random}`;
}

function calcularTotalConDescuento(subtotal, tipo, valor) {
  const v = Number(valor) || 0;
  if (!tipo || v <= 0) return subtotal;
  let total = subtotal;
  if (tipo === "porcentaje") total = subtotal - subtotal * (v / 100);
  if (tipo === "monto") total = subtotal - v;
  return total < 0 ? 0 : total;
}

function PanelVentas() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardandoId, setGuardandoId] = useState(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [productos, setProductos] = useState([]);
  const [agregandoProductoA, setAgregandoProductoA] = useState(null);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [comprobantePedido, setComprobantePedido] = useState(null);

  // --- FILTRO DE FECHAS / BALANCE ---
  const [ordenResumen, setOrdenResumen] = useState("reciente");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // --- NUEVO PEDIDO DESDE ADMIN ---
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false);
  const [nuevoForm, setNuevoForm] = useState({
    nombre_cliente: "",
    telefono_cliente: "",
    localidad: "",
    metodo_entrega: "retiro",
    direccion_envio: "",
    metodo_pago: "transferencia",
    nota_cliente: "",
  });
  const [nuevoItems, setNuevoItems] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [sugerenciasCliente, setSugerenciasCliente] = useState([]);
  const [clienteElegido, setClienteElegido] = useState(null);
  const [filtroStock, setFiltroStock] = useState("stock"); // "stock" | "pedido" | "todos"
  const [sinConexion, setSinConexion] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [guardandoCatalogo, setGuardandoCatalogo] = useState(false);
  const [fechaCatalogo, setFechaCatalogo] = useState(null);
  const [busquedaProductoNuevo, setBusquedaProductoNuevo] = useState("");
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [errorNuevo, setErrorNuevo] = useState("");
  const [nuevoDescuentoTipo, setNuevoDescuentoTipo] = useState("");
  const [nuevoDescuentoValor, setNuevoDescuentoValor] = useState("");

  useEffect(() => {
    async function cargarPedidos() {
      try {
        const res = await fetch("/api/admin/pedidos");
        const result = await res.json();
        if (res.ok) setPedidos(result.pedidos || []);
      } catch (e) {
        console.error(e.message);
      }
      setLoading(false);
    }
    cargarPedidos();
  }, []);

  useEffect(() => {
    async function traerTanda(desde, TANDA) {
      const { data, error } = await supabase
        .from("Productos")
        .select("id, nombre, precio, precio_oferta, stock, bajo_pedido")
        .order("nombre", { ascending: true })
        .range(desde, desde + TANDA - 1);
      if (error) {
        console.error(error.message);
        return [];
      }
      return data || [];
    }

    // Supabase devuelve como máximo 1000 filas por consulta. Con más de 2000
    // productos, pedirlos de una sola vez dejaba afuera todo lo que caía
    // después del corte alfabético (por ejemplo, lo que empieza con Z).
    async function cargarProductos() {
      const TANDA = 1000;
      let todos = [];
      let desde = 0;

      while (true) {
        const tanda = await traerTanda(desde, TANDA);
        todos = todos.concat(tanda);
        if (tanda.length < TANDA) break;
        desde += TANDA;
        if (desde > 20000) break; // freno de seguridad
      }

      if (todos.length > 0) {
        setProductos(todos);
      } else {
        // Sin internet: usamos la copia guardada en el celular
        const guardados = leerCatalogoOffline();
        if (guardados.length > 0) {
          setProductos(guardados);
          setSinConexion(true);
        }
      }
    }
    cargarProductos();

    // Clientes ya registrados o que compraron antes, para autocompletar
    // sus datos y no tener que escribirlos de nuevo en cada venta.
    async function cargarClientes() {
      const { data } = await supabase
        .from("clientes")
        .select("id, nombre, telefono, localidad, direccion, email")
        .order("nombre", { ascending: true });
      if (data) setClientes(data);
    }
    cargarClientes();

    // Cada vez que se registra alguien nuevo, aparece acá sin recargar la app
    const canal = supabase
      .channel("clientes-nuevos")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clientes" },
        () => cargarClientes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };

    setFechaCatalogo(fechaCatalogoOffline());
    setPendientes(cantidadPendientes());
  }, []);

  // Detectamos si hay señal y mandamos los pedidos que quedaron pendientes
  useEffect(() => {
    function actualizarEstado() {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setSinConexion(offline);
      if (!offline) intentarSincronizar();
    }

    async function intentarSincronizar() {
      if (cantidadPendientes() === 0) return;
      const { enviados } = await sincronizarCola();
      setPendientes(cantidadPendientes());
      if (enviados > 0) {
        alert(`Se enviaron ${enviados} pedido(s) que habías armado sin internet.`);
        window.location.reload();
      }
    }

    actualizarEstado();
    window.addEventListener("online", actualizarEstado);
    window.addEventListener("offline", actualizarEstado);
    return () => {
      window.removeEventListener("online", actualizarEstado);
      window.removeEventListener("offline", actualizarEstado);
    };
  }, []);

  async function descargarCatalogo() {
    setGuardandoCatalogo(true);
    try {
      const { total, parcial } = await guardarCatalogoOffline();
      setFechaCatalogo(new Date());
      alert(
        parcial
          ? `Se guardaron ${total} productos (los que tenés en stock). No entró todo el catálogo por espacio del celular.`
          : `Listo: ${total} productos guardados para usar sin internet.`
      );
    } catch (e) {
      alert("No se pudo guardar el catálogo: " + e.message);
    } finally {
      setGuardandoCatalogo(false);
    }
  }

  async function actualizarEstado(pedidoId, campo, valor) {
    setPedidos((prev) =>
      prev.map((p) => (p.id === pedidoId ? { ...p, [campo]: valor } : p))
    );
    setGuardandoId(pedidoId);

    try {
      const res = await fetch("/api/admin/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pedidoId, [campo]: valor }),
      });
      const result = await res.json();

      if (!res.ok) {
        alert("No se pudo guardar el cambio: " + result.error);
      } else if (result.pedido) {
        setPedidos((prev) =>
          prev.map((p) => (p.id === pedidoId ? { ...p, ...result.pedido } : p))
        );
      }
    } catch (e) {
      alert("Error de conexión al guardar el cambio.");
    }
    setGuardandoId(null);
  }

  async function actualizarDescuento(pedidoId, tipo, valor) {
    setGuardandoId(pedidoId);
    try {
      const res = await fetch("/api/admin/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pedidoId,
          descuento_tipo: tipo || null,
          descuento_valor: valor,
        }),
      });
      const result = await res.json();

      if (res.ok && result.pedido) {
        setPedidos((prev) =>
          prev.map((p) => (p.id === pedidoId ? { ...p, ...result.pedido } : p))
        );
      } else {
        alert("No se pudo guardar el descuento: " + result.error);
      }
    } catch (e) {
      alert("Error de conexión al guardar el descuento.");
    }
    setGuardandoId(null);
  }

  async function convertirAVenta(pedidoId) {
    const confirmar = window.confirm(
      "Esto va a descontar el stock de los productos de este pedido y marcarlo como Venta confirmada. ¿Continuar?"
    );
    if (!confirmar) return;

    setGuardandoId(pedidoId);
    try {
      const res = await fetch("/api/admin/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pedidoId, convertir_a_venta: true }),
      });
      const result = await res.json();

      if (res.ok && result.pedido) {
        setPedidos((prev) =>
          prev.map((p) => (p.id === pedidoId ? { ...p, ...result.pedido } : p))
        );
      } else {
        alert("No se pudo convertir a venta: " + result.error);
      }
    } catch (e) {
      alert("Error de conexión al convertir a venta.");
    }
    setGuardandoId(null);
  }

  async function eliminarPedido(pedidoId) {
    const confirmar = window.confirm(
      `¿Seguro que querés eliminar el pedido #${pedidoId}? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setGuardandoId(pedidoId);
    try {
      const res = await fetch(`/api/admin/pedidos?id=${pedidoId}`, {
        method: "DELETE",
      });
      const result = await res.json();

      if (res.ok) {
        setPedidos((prev) => prev.filter((p) => p.id !== pedidoId));
      } else {
        alert("No se pudo eliminar el pedido: " + result.error);
      }
    } catch (e) {
      alert("Error de conexión al eliminar el pedido.");
    }
    setGuardandoId(null);
  }

  async function agregarProductoAPedido(pedidoId, producto) {
    try {
      const precioAUsar =
        producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio)
          ? producto.precio_oferta
          : producto.precio;

      const res = await fetch("/api/admin/pedidos/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido_id: pedidoId,
          producto_id: producto.id,
          nombre_producto: producto.nombre,
          precio_unitario: precioAUsar,
          cantidad: 1,
        }),
      });
      const result = await res.json();

      if (res.ok) {
        setPedidos((prev) =>
          prev.map((p) =>
            p.id === pedidoId
              ? {
                  ...p,
                  items_pedido: [...(p.items_pedido || []), result.item],
                  total: result.total,
                }
              : p
          )
        );
        setAgregandoProductoA(null);
        setBusquedaProducto("");
      } else {
        alert("No se pudo agregar el producto: " + result.error);
      }
    } catch (e) {
      alert("Error de conexión al agregar el producto.");
    }
  }

  async function modificarCantidadItem(pedidoId, itemId, cantidad) {
    if (cantidad < 1) return;
    try {
      const res = await fetch("/api/admin/pedidos/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, pedido_id: pedidoId, cantidad }),
      });
      const result = await res.json();

      if (res.ok) {
        setPedidos((prev) =>
          prev.map((p) =>
            p.id === pedidoId
              ? {
                  ...p,
                  items_pedido: p.items_pedido.map((it) =>
                    it.id === itemId ? result.item : it
                  ),
                  total: result.total,
                }
              : p
          )
        );
      } else {
        alert("No se pudo modificar la cantidad: " + result.error);
      }
    } catch (e) {
      alert("Error de conexión al modificar la cantidad.");
    }
  }

  async function eliminarItem(pedidoId, itemId) {
    const confirmar = window.confirm("¿Eliminar este producto del pedido?");
    if (!confirmar) return;

    try {
      const res = await fetch(
        `/api/admin/pedidos/items?item_id=${itemId}&pedido_id=${pedidoId}`,
        { method: "DELETE" }
      );
      const result = await res.json();

      if (res.ok) {
        setPedidos((prev) =>
          prev.map((p) =>
            p.id === pedidoId
              ? {
                  ...p,
                  items_pedido: p.items_pedido.filter((it) => it.id !== itemId),
                  total: result.total,
                }
              : p
          )
        );
      } else {
        alert("No se pudo eliminar el producto: " + result.error);
      }
    } catch (e) {
      alert("Error de conexión al eliminar el producto.");
    }
  }

  function calcularResumenClientes(lista) {
    const grupos = {};
    lista.forEach((p) => {
      const clave = p.telefono_cliente || "sin_telefono_" + p.id;
      if (!grupos[clave]) {
        grupos[clave] = {
          telefono: p.telefono_cliente || "Sin teléfono",
          nombre: p.nombre_cliente || "Sin nombre",
          cantidadPedidos: 0,
          saldoNeto: 0,
          totalComprado: 0,
          primeraCompra: null,
          ultimaCompra: null,
        };
      }
      grupos[clave].cantidadPedidos += 1;
      grupos[clave].saldoNeto += Number(p.total || 0) - Number(p.monto_pagado || 0);
      grupos[clave].totalComprado += Number(p.total || 0);

      const fecha = p.created_at ? new Date(p.created_at) : null;
      if (fecha && !isNaN(fecha)) {
        if (!grupos[clave].primeraCompra || fecha < grupos[clave].primeraCompra) {
          grupos[clave].primeraCompra = fecha;
        }
        if (!grupos[clave].ultimaCompra || fecha > grupos[clave].ultimaCompra) {
          grupos[clave].ultimaCompra = fecha;
        }
      }
    });

    // Ordenado por última compra: el que compró más recientemente aparece primero
    return Object.values(grupos).sort((a, b) => {
      if (ordenResumen === "deuda") return b.saldoNeto - a.saldoNeto;
      if (ordenResumen === "monto") return b.totalComprado - a.totalComprado;
      if (!a.ultimaCompra) return 1;
      if (!b.ultimaCompra) return -1;
      return b.ultimaCompra - a.ultimaCompra;
    });
  }

  function filtrarPorFecha(lista) {
    if (!fechaDesde && !fechaHasta) return lista;
    return lista.filter((p) => {
      const fechaPedido = new Date(p.created_at);
      if (fechaDesde) {
        const desde = new Date(fechaDesde + "T00:00:00");
        if (fechaPedido < desde) return false;
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta + "T23:59:59");
        if (fechaPedido > hasta) return false;
      }
      return true;
    });
  }

  function setRangoEsteMes() {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    setFechaDesde(primerDia.toISOString().slice(0, 10));
    setFechaHasta(ultimoDia.toISOString().slice(0, 10));
  }

  function limpiarFiltroFecha() {
    setFechaDesde("");
    setFechaHasta("");
  }

  function handleChangeNuevoForm(e) {
    const { name, value } = e.target;
    setNuevoForm({ ...nuevoForm, [name]: value });

    // Al escribir el nombre o el celular, buscamos clientes que ya tengas
    // cargados para no volver a escribir todos los datos.
    if (name === "nombre_cliente" || name === "telefono_cliente") {
      setClienteElegido(null);
      const q = value.trim().toLowerCase();

      if (q.length < 2) {
        setSugerenciasCliente([]);
        return;
      }

      const soloNumeros = q.replace(/\D/g, "");

      setSugerenciasCliente(
        todosLosClientes()
          .filter((c) => {
            const coincideNombre = (c.nombre || "").toLowerCase().includes(q);
            // Solo comparamos teléfonos si el texto tiene números. Sin esto,
            // al buscar por nombre el filtro daba positivo con TODOS los
            // clientes (cualquier texto "contiene" al texto vacío).
            const coincideTelefono =
              soloNumeros.length >= 3 && (c.telefono || "").includes(soloNumeros);
            return coincideNombre || coincideTelefono;
          })
          .slice(0, 6)
      );
    }
  }

  // Junta los clientes registrados con los que compraron sin tener cuenta.
  // Así al escribir un nombre aparecen todos los que ya te compraron alguna vez,
  // estén registrados o no.
  function todosLosClientes() {
    const mapa = new Map();

    clientes.forEach((c) => {
      if (c.telefono) mapa.set(c.telefono, c);
    });

    pedidos.forEach((p) => {
      const tel = p.telefono_cliente;
      if (!tel || mapa.has(tel)) return;
      mapa.set(tel, {
        id: `pedido-${tel}`,
        nombre: p.nombre_cliente || "Sin nombre",
        telefono: tel,
        localidad: p.localidad || "",
        direccion: p.direccion_envio || "",
        sinCuenta: true
      });
    });

    return Array.from(mapa.values());
  }

  // Completa el formulario con los datos guardados de ese cliente.
  function elegirCliente(c) {
    setNuevoForm((prev) => ({
      ...prev,
      nombre_cliente: c.nombre || "",
      telefono_cliente: c.telefono || "",
      localidad: c.localidad || prev.localidad,
      direccion_envio: c.direccion || prev.direccion_envio
    }));
    setClienteElegido(c);
    setSugerenciasCliente([]);
  }

  // Filtra el buscador por disponibilidad: con casi 3000 productos, ver todo
  // junto hace imposible encontrar lo que tenés realmente para vender.
  function filtrarProductos(texto) {
    const q = (texto || "").toLowerCase().trim();
    if (!q) return [];

    return productos.filter((p) => {
      if (!p.nombre?.toLowerCase().includes(q)) return false;
      if (filtroStock === "stock") return !p.bajo_pedido && Number(p.stock || 0) > 0;
      if (filtroStock === "pedido") return !!p.bajo_pedido;
      return true;
    });
  }

  function agregarItemNuevo(producto) {
    const precioAUsar =
      producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio)
        ? producto.precio_oferta
        : producto.precio;

    setNuevoItems((prev) => {
      const existente = prev.find((i) => i.producto_id === producto.id);
      if (existente) {
        return prev.map((i) =>
          i.producto_id === producto.id
            ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_unitario }
            : i
        );
      }
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre_producto: producto.nombre,
          precio_unitario: precioAUsar,
          cantidad: 1,
          subtotal: precioAUsar,
        },
      ];
    });
    setBusquedaProductoNuevo("");
  }

  function cambiarCantidadItemNuevo(producto_id, cantidad) {
    if (cantidad < 1) return;
    setNuevoItems((prev) =>
      prev.map((i) =>
        i.producto_id === producto_id
          ? { ...i, cantidad, subtotal: cantidad * i.precio_unitario }
          : i
      )
    );
  }

  function eliminarItemNuevo(producto_id) {
    setNuevoItems((prev) => prev.filter((i) => i.producto_id !== producto_id));
  }

  const subtotalNuevoPedido = nuevoItems.reduce((acc, i) => acc + i.subtotal, 0);
  const totalNuevoPedido = calcularTotalConDescuento(
    subtotalNuevoPedido,
    nuevoDescuentoTipo,
    nuevoDescuentoValor
  );
  const montoDescuentoNuevo = subtotalNuevoPedido - totalNuevoPedido;

  function resetFormNuevo() {
    setSugerenciasCliente([]);
    setClienteElegido(null);
    setNuevoForm({
      nombre_cliente: "",
      telefono_cliente: "",
      localidad: "",
      metodo_entrega: "retiro",
      direccion_envio: "",
      metodo_pago: "transferencia",
      nota_cliente: "",
    });
    setNuevoItems([]);
    setBusquedaProductoNuevo("");
    setErrorNuevo("");
    setNuevoDescuentoTipo("");
    setNuevoDescuentoValor("");
  }

  async function handleGuardarNuevoPedido() {
    setErrorNuevo("");

    if (!nuevoForm.nombre_cliente.trim() || !nuevoForm.telefono_cliente.trim()) {
      setErrorNuevo("Completá nombre y celular del cliente.");
      return;
    }
    if (nuevoItems.length === 0) {
      setErrorNuevo("Agregá al menos un producto.");
      return;
    }

    setGuardandoNuevo(true);
    try {
      const numero_pedido = generarNumeroPedido();

      const cuerpoPedido = {
        pedido: {
          numero_pedido,
          usuario_id: null,
          nombre_cliente: nuevoForm.nombre_cliente,
          telefono_cliente: nuevoForm.telefono_cliente,
          localidad: nuevoForm.localidad,
          metodo_entrega: nuevoForm.metodo_entrega,
          direccion_envio:
            nuevoForm.metodo_entrega === "envio" ? nuevoForm.direccion_envio : null,
          metodo_pago: nuevoForm.metodo_pago,
          nota_cliente: nuevoForm.nota_cliente || null,
          subtotal: subtotalNuevoPedido,
          descuento_tipo: nuevoDescuentoTipo || null,
          descuento_valor: Number(nuevoDescuentoValor) || 0,
          total: totalNuevoPedido,
          estado: "pendiente"
        },
        items: nuevoItems.map((i) => ({
          producto_id: i.producto_id,
          nombre_producto: i.nombre_producto,
          precio_unitario: i.precio_unitario,
          cantidad: i.cantidad,
          subtotal: i.subtotal
        }))
      };

      // Sin señal: el pedido queda guardado en el celular y se manda solo
      // apenas vuelva el internet. Así no se pierde ninguna venta.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        encolarPedido(cuerpoPedido);
        setPendientes(cantidadPendientes());
        setComprobantePedido({
          ...cuerpoPedido.pedido,
          items_pedido: nuevoItems,
          _pendiente_envio: true
        });
        resetFormNuevo();
        setMostrarFormNuevo(false);
        setGuardandoNuevo(false);
        return;
      }

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpoPedido)
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al crear el pedido");

      const resPedidos = await fetch("/api/admin/pedidos");
      const resultPedidos = await resPedidos.json();
      if (resPedidos.ok) setPedidos(resultPedidos.pedidos || []);

      setComprobantePedido({
        ...result.pedido,
        items_pedido: nuevoItems,
      });
      resetFormNuevo();
      setMostrarFormNuevo(false);
    } catch (err) {
      // Si se cortó el internet justo al guardar, no perdemos el pedido
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setErrorNuevo("Se cortó el internet. El pedido quedó guardado y se envía solo cuando vuelva la señal.");
      } else {
        setErrorNuevo(`Error: ${err.message || "Desconocido"}`);
      }
    } finally {
      setGuardandoNuevo(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header showSearch={false} />
        <div className="text-center py-20 text-gray-500">Cargando panel de ventas...</div>
      </main>
    );
  }

  const pedidosPorCliente = clienteSeleccionado
    ? pedidos.filter((p) => (p.telefono_cliente || "Sin teléfono") === clienteSeleccionado)
    : pedidos;

  // En este panel quedan solo los pedidos que todavía requieren acción:
  // sin entregar o sin cobrar. Los cerrados van a "Ventas cerradas".
  const pedidosAbiertos = pedidosPorCliente.filter(
    (p) => !(p.estado === "entregado" && p.estado_pago === "pagado")
  );
  const pedidosCerradosCount = pedidos.filter(
    (p) => p.estado === "entregado" && p.estado_pago === "pagado"
  ).length;

  // La lista de abajo muestra solo lo que falta atender...
  const pedidosFiltrados = filtrarPorFecha(pedidosAbiertos);

  // ...pero el balance del período tiene que contar TODAS las ventas
  // (abiertas y cerradas), si no los números del negocio quedan incompletos.
  const pedidosDelPeriodo = filtrarPorFecha(
    pedidosPorCliente.filter((p) => p.estado !== "cancelado")
  );

  const balancePeriodo = pedidosDelPeriodo.reduce(
    (acc, p) => {
      acc.totalVendido += Number(p.total || 0);
      acc.totalCobrado += Number(p.monto_pagado || 0);
      return acc;
    },
    { totalVendido: 0, totalCobrado: 0, cantidad: pedidosDelPeriodo.length }
  );
  balancePeriodo.totalPendiente = balancePeriodo.totalVendido - balancePeriodo.totalCobrado;

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <Header showSearch={false} />

      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800">Pedidos abiertos</h1>
            <p className="text-xs text-gray-500">Sin entregar o sin cobrar</p>
          </div>
          <button
            onClick={() => setMostrarFormNuevo(!mostrarFormNuevo)}
            className="text-sm font-bold text-white bg-brand-blue px-4 py-2 rounded-xl shadow-sm"
          >
            {mostrarFormNuevo ? "Cancelar" : "+ Nuevo pedido"}
          </button>
        </div>

        {/* MODO SIN INTERNET */}
        {sinConexion && (
          <div className="bg-gray-800 text-white rounded-2xl p-4 mb-4">
            <p className="font-bold text-sm">📡 Estás sin internet</p>
            <p className="text-xs text-gray-300 mt-1">
              {productos.length > 0
                ? `Podés armar pedidos igual: tenés ${productos.length} productos guardados. Se envían solos cuando vuelva la señal.`
                : "No tenés el catálogo guardado en este celular. Conectate a internet y tocá \"Guardar catálogo\" para poder trabajar sin señal la próxima vez."}
            </p>
          </div>
        )}

        {pendientes > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-amber-900 text-sm">
                {pendientes} pedido{pendientes === 1 ? "" : "s"} esperando enviarse
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Se mandan solos apenas haya internet.
              </p>
            </div>
            {!sinConexion && (
              <button
                onClick={async () => {
                  const { enviados } = await sincronizarCola();
                  setPendientes(cantidadPendientes());
                  if (enviados > 0) window.location.reload();
                }}
                className="text-xs font-bold text-white bg-amber-600 px-3 py-2 rounded-xl whitespace-nowrap"
              >
                Enviar ahora
              </button>
            )}
          </div>
        )}

        {/* GUARDAR CATÁLOGO PARA USAR SIN SEÑAL */}
        {!sinConexion && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800 text-sm">📥 Trabajar sin internet</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {fechaCatalogo
                  ? `Catálogo guardado el ${fechaCatalogo.toLocaleDateString("es-AR")} a las ${fechaCatalogo.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
                  : "Guardá el catálogo en el celular para armar pedidos donde no hay señal"}
              </p>
            </div>
            <button
              onClick={descargarCatalogo}
              disabled={guardandoCatalogo}
              className="text-xs font-bold text-brand-blue border border-brand-blue px-3 py-2 rounded-xl whitespace-nowrap disabled:opacity-50"
            >
              {guardandoCatalogo ? "Guardando..." : fechaCatalogo ? "Actualizar" : "Guardar catálogo"}
            </button>
          </div>
        )}

        {mostrarFormNuevo && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-6">
            <h2 className="font-bold text-gray-800 mb-4">Crear pedido / presupuesto</h2>

            {errorNuevo && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4">
                {errorNuevo}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  Nombre del cliente
                </label>
                <input
                  name="nombre_cliente"
                  value={nuevoForm.nombre_cliente}
                  onChange={handleChangeNuevoForm}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="Escribí el nombre o el celular..."
                  autoComplete="off"
                />

                {clienteElegido && (
                  <p className="text-[11px] text-green-700 font-semibold mt-1">
                    ✓ Cliente ya registrado, datos completados
                  </p>
                )}

                {sugerenciasCliente.length > 0 && (
                  <div className="border border-gray-200 rounded-lg mt-1 bg-white shadow-sm overflow-hidden">
                    {sugerenciasCliente.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => elegirCliente(c)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="text-xs font-semibold text-gray-800">
                          {c.nombre}
                          {c.sinCuenta && (
                            <span className="ml-1 text-[10px] font-normal text-gray-400">
                              (sin cuenta)
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {c.telefono}
                          {c.localidad && ` · ${c.localidad}`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  Celular
                </label>
                <input
                  name="telefono_cliente"
                  value={nuevoForm.telefono_cliente}
                  onChange={handleChangeNuevoForm}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="Ej: 2944123456"
                  inputMode="tel"
                  autoComplete="off"
                />

                {sugerenciasCliente.length > 0 && !clienteElegido && (
                  <div className="border border-gray-200 rounded-lg mt-1 bg-white shadow-sm overflow-hidden">
                    {sugerenciasCliente.map((c) => (
                      <button
                        key={`tel-${c.id}`}
                        type="button"
                        onClick={() => elegirCliente(c)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="text-xs font-semibold text-gray-800">{c.nombre}</p>
                        <p className="text-[11px] text-gray-500">{c.telefono}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  Localidad
                </label>
                <input
                  name="localidad"
                  value={nuevoForm.localidad}
                  onChange={handleChangeNuevoForm}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="Ej: El Bolsón"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  Método de pago
                </label>
                <select
                  name="metodo_pago"
                  value={nuevoForm.metodo_pago}
                  onChange={handleChangeNuevoForm}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  Entrega
                </label>
                <select
                  name="metodo_entrega"
                  value={nuevoForm.metodo_entrega}
                  onChange={handleChangeNuevoForm}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="retiro">Retiro en showroom</option>
                  <option value="envio">Envío a domicilio</option>
                </select>
              </div>
              {nuevoForm.metodo_entrega === "envio" && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                    Dirección de envío
                  </label>
                  <input
                    name="direccion_envio"
                    value={nuevoForm.direccion_envio}
                    onChange={handleChangeNuevoForm}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                    placeholder="Calle, número, barrio"
                  />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  Nota (opcional)
                </label>
                <input
                  name="nota_cliente"
                  value={nuevoForm.nota_cliente}
                  onChange={handleChangeNuevoForm}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="Ej: llamar antes de entregar"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Productos</p>

              <input
                type="text"
                placeholder="Buscar producto por nombre..."
                value={busquedaProductoNuevo}
                onChange={(e) => setBusquedaProductoNuevo(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-2"
              />

              <div className="flex gap-1.5 mb-2">
                {[
                  { id: "stock", label: "🟢 Tengo" },
                  { id: "pedido", label: "📦 A pedido" },
                  { id: "todos", label: "Todo" }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroStock(f.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                      filtroStock === f.id
                        ? "bg-brand-blue text-white border-brand-blue"
                        : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {busquedaProductoNuevo.trim() && (
                <div className="max-h-48 overflow-y-auto space-y-1.5 mb-3">
                  {filtrarProductos(busquedaProductoNuevo)
                    .slice(0, 8)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded-lg"
                      >
                        <span className="text-gray-700">
                          {p.nombre}{" "}
                          <span className="text-gray-400">
                            (${formatPrice(p.precio_oferta && Number(p.precio_oferta) < Number(p.precio) ? p.precio_oferta : p.precio || 0)}
                            {p.precio_oferta && Number(p.precio_oferta) < Number(p.precio) && " · oferta"})
                          </span>
                          {p.bajo_pedido ? (
                            <span className="ml-1 text-[10px] font-bold text-purple-700">a pedido</span>
                          ) : (
                            <span className="ml-1 text-[10px] font-bold text-green-700">stock {p.stock ?? 0}</span>
                          )}
                        </span>
                        <button
                          onClick={() => agregarItemNuevo(p)}
                          className="text-xs font-bold text-white bg-brand-blue px-2.5 py-1 rounded-lg"
                        >
                          + Agregar
                        </button>
                      </div>
                    ))}
                  {filtrarProductos(busquedaProductoNuevo).length === 0 && (
                    <p className="text-xs text-gray-400 py-2">
                      Sin resultados
                      {filtroStock === "stock" && " entre los que tenés en stock"}
                      {filtroStock === "pedido" && " entre los productos a pedido"}.
                      {filtroStock !== "todos" && (
                        <button
                          type="button"
                          onClick={() => setFiltroStock("todos")}
                          className="ml-1 font-bold text-brand-blue underline"
                        >
                          Buscar en todo
                        </button>
                      )}
                    </p>
                  )}
                </div>
              )}

              {nuevoItems.length > 0 && (
                <div className="space-y-2 mb-3">
                  {nuevoItems.map((item) => (
                    <div
                      key={item.producto_id}
                      className="flex justify-between items-center text-sm bg-gray-50 p-2.5 rounded-xl gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            cambiarCantidadItemNuevo(item.producto_id, item.cantidad - 1)
                          }
                          disabled={item.cantidad <= 1}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 font-bold disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="text-gray-700 font-medium min-w-[1.5rem] text-center">
                          {item.cantidad}
                        </span>
                        <button
                          onClick={() =>
                            cambiarCantidadItemNuevo(item.producto_id, item.cantidad + 1)
                          }
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 font-bold"
                        >
                          +
                        </button>
                        <span className="text-gray-700 font-medium">{item.nombre_producto}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-semibold">
                          ${formatPrice(item.subtotal)}
                        </span>
                        <button
                          onClick={() => eliminarItemNuevo(item.producto_id)}
                          className="text-red-500 font-bold text-base leading-none px-1"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-100 pt-3 mb-3">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">
                  Descuento (opcional)
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={nuevoDescuentoTipo}
                    onChange={(e) => setNuevoDescuentoTipo(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-2"
                  >
                    <option value="">Sin descuento</option>
                    <option value="porcentaje">%</option>
                    <option value="monto">$</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!nuevoDescuentoTipo}
                    value={nuevoDescuentoValor}
                    onChange={(e) => setNuevoDescuentoValor(e.target.value)}
                    placeholder="0"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-1.5">
                {montoDescuentoNuevo > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-gray-600">${formatPrice(subtotalNuevoPedido)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-red-600 font-medium">
                        Descuento
                        {nuevoDescuentoTipo === "porcentaje" ? ` (${nuevoDescuentoValor || 0}%)` : ""}
                      </span>
                      <span className="text-red-600 font-medium">
                        -${formatPrice(montoDescuentoNuevo)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold text-gray-700">Total</span>
                  <span className="text-lg font-extrabold text-brand-blueDark">
                    ${formatPrice(totalNuevoPedido)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 mt-2">
                Este pedido se crea como Presupuesto. El stock recién se descuenta cuando lo
                marques como Entregado + Pagado, o lo convertís a venta manualmente.
              </p>

              <button
                onClick={handleGuardarNuevoPedido}
                disabled={guardandoNuevo}
                className="w-full mt-4 text-sm font-bold text-white bg-brand-blue py-2.5 rounded-xl shadow-sm disabled:opacity-50"
              >
                {guardandoNuevo ? "Guardando..." : "Guardar pedido"}
              </button>
            </div>
          </div>
        )}

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Balance por período
          </p>
          <div className="flex flex-wrap gap-2 items-end mb-4">
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                Desde
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              />
            </div>
            <button
              onClick={setRangoEsteMes}
              className="text-xs font-bold text-brand-blue bg-blue-50 px-3 py-2 rounded-lg"
            >
              Este mes
            </button>
            {(fechaDesde || fechaHasta) && (
              <button
                onClick={limpiarFiltroFecha}
                className="text-xs font-semibold text-gray-500 px-3 py-2"
              >
                Ver todo
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] text-gray-500 font-semibold uppercase">Pedidos</p>
              <p className="text-lg font-extrabold text-gray-800">{pedidosDelPeriodo.length}</p>
              <p className="text-[10px] text-gray-400">
                {pedidosFiltrados.length} sin cerrar
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] text-gray-500 font-semibold uppercase">Total vendido</p>
              <p className="text-lg font-extrabold text-gray-800">
                ${formatPrice(balancePeriodo.totalVendido)}
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-[11px] text-green-700 font-semibold uppercase">Cobrado</p>
              <p className="text-lg font-extrabold text-green-700">
                ${formatPrice(balancePeriodo.totalCobrado)}
              </p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-[11px] text-red-700 font-semibold uppercase">Pendiente</p>
              <p className="text-lg font-extrabold text-red-700">
                ${formatPrice(balancePeriodo.totalPendiente)}
              </p>
            </div>
          </div>
        </div>

        {/* ACCESOS A LAS OTRAS VISTAS */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link
            href="/admin/ventas-cerradas"
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md"
          >
            <p className="text-2xl mb-1">✅</p>
            <p className="font-bold text-sm text-gray-800">Ventas cerradas</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {pedidosCerradosCount} entregadas y cobradas
            </p>
          </Link>

          <Link
            href="/admin/resumen-clientes"
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md"
          >
            <p className="text-2xl mb-1">👥</p>
            <p className="font-bold text-sm text-gray-800">Resumen por cliente</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Cuánto compró y cuánto debe</p>
          </Link>
        </div>

        {clienteSeleccionado && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              Mostrando pedidos de <span className="font-semibold text-gray-700">{clienteSeleccionado}</span>
            </p>
            <button
              onClick={() => setClienteSeleccionado(null)}
              className="text-xs font-bold text-brand-blue bg-blue-50 px-3 py-1.5 rounded-full"
            >
              Ver todos
            </button>
          </div>
        )}

        {pedidosFiltrados.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-500">
              {clienteSeleccionado || fechaDesde || fechaHasta
                ? "No hay pedidos para este filtro."
                : "Todavía no hay pedidos registrados."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pedidosFiltrados.map((pedido) => {
              const tieneSubtotal =
                pedido.subtotal !== null && pedido.subtotal !== undefined;
              const subtotalPedido = tieneSubtotal ? Number(pedido.subtotal) : Number(pedido.total);
              const tieneDescuento = pedido.descuento_tipo && Number(pedido.descuento_valor) > 0;
              const esVenta = pedido.tipo_pedido === "venta";

              return (
              <div key={pedido.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-3">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-brand-blue bg-blue-50 px-2 py-1 rounded-md">
                        Pedido #{pedido.id}
                      </span>
                      {esVenta ? (
                        <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-md">
                          ✅ Venta
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-1 rounded-md">
                          📋 Presupuesto
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mt-2">
                      Cliente: {pedido.nombre_cliente || "Sin nombre"} ({pedido.telefono_cliente || "Sin teléfono"})
                    </p>
                    <p className="text-xs text-gray-400">
                      Fecha: {new Date(pedido.created_at).toLocaleString()}
                    </p>
                    {pedido.comprobante_url && (
                      <a
                        href={pedido.comprobante_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-md mt-1.5"
                      >
                        📎 Ver comprobante
                      </a>
                    )}
                  </div>
                  <div className="text-right">
                    {tieneDescuento && (
                      <span className="text-xs text-gray-400 line-through block">
                        ${formatPrice(subtotalPedido)}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 block">Total Venta</span>
                    <span className="text-lg font-extrabold text-gray-900">${formatPrice(pedido.total)}</span>
                    <button
                      onClick={() => setComprobantePedido(pedido)}
                      className="text-xs font-bold text-brand-blue block ml-auto hover:underline mb-1"
                    >
                      🧾 Comprobante
                    </button>
                    <button
                      onClick={() => eliminarPedido(pedido.id)}
                      disabled={guardandoId === pedido.id}
                      className="text-xs font-semibold text-red-600 mt-1.5 block ml-auto hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {!esVenta && (
                  <button
                    onClick={() => convertirAVenta(pedido.id)}
                    disabled={guardandoId === pedido.id}
                    className="w-full mb-4 text-xs font-bold text-white bg-green-600 py-2 rounded-xl shadow-sm disabled:opacity-50"
                  >
                    ✅ Convertir a venta (descuenta stock ahora)
                  </button>
                )}

                <div className="flex flex-wrap gap-3 mb-4">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                      Entrega
                    </label>
                    <select
                      value={pedido.estado || "pendiente"}
                      onChange={(e) => actualizarEstado(pedido.id, "estado", e.target.value)}
                      disabled={guardandoId === pedido.id}
                      className={`text-xs font-semibold border rounded-lg px-2 py-1.5 ${COLOR_ENTREGA[pedido.estado] || "bg-gray-50 text-gray-700 border-gray-200"}`}
                    >
                      {OPCIONES_ENTREGA.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                      Pago
                    </label>
                    <select
                      value={pedido.estado_pago || "falta_pagar"}
                      onChange={(e) => actualizarEstado(pedido.id, "estado_pago", e.target.value)}
                      disabled={guardandoId === pedido.id}
                      className={`text-xs font-semibold border rounded-lg px-2 py-1.5 ${COLOR_PAGO[pedido.estado_pago] || "bg-gray-50 text-gray-700 border-gray-200"}`}
                    >
                      {OPCIONES_PAGO.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                      Monto pagado
                    </label>
                    <input
                      key={pedido.id + "-" + pedido.monto_pagado}
                      type="number"
                      step="0.01"
                      defaultValue={pedido.monto_pagado || 0}
                      disabled={guardandoId === pedido.id}
                      onBlur={(e) => {
                        const valor = parseFloat(e.target.value) || 0;
                        if (valor !== (pedido.monto_pagado || 0)) {
                          actualizarEstado(pedido.id, "monto_pagado", valor);
                        }
                      }}
                      className="text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1.5 w-28"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                      Descuento
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        key={pedido.id + "-tipo-" + pedido.descuento_tipo}
                        defaultValue={pedido.descuento_tipo || ""}
                        disabled={guardandoId === pedido.id}
                        onChange={(e) => {
                          const inputValor = document.getElementById(`descuento-valor-${pedido.id}`);
                          const valor = parseFloat(inputValor?.value) || 0;
                          actualizarDescuento(pedido.id, e.target.value, valor);
                        }}
                        className="text-sm border border-gray-200 rounded-lg px-1.5 py-1.5"
                      >
                        <option value="">Sin desc.</option>
                        <option value="porcentaje">%</option>
                        <option value="monto">$</option>
                      </select>
                      <input
                        id={`descuento-valor-${pedido.id}`}
                        key={pedido.id + "-valor-" + pedido.descuento_valor}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={pedido.descuento_valor || 0}
                        disabled={guardandoId === pedido.id || !pedido.descuento_tipo}
                        onBlur={(e) => {
                          const valor = parseFloat(e.target.value) || 0;
                          if (valor !== Number(pedido.descuento_valor || 0)) {
                            actualizarDescuento(pedido.id, pedido.descuento_tipo, valor);
                          }
                        }}
                        className="text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1.5 w-20 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>
                  </div>

                  {(() => {
                    const saldo = Number(pedido.total || 0) - Number(pedido.monto_pagado || 0);
                    if (saldo > 0) {
                      return (
                        <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                          Debe ${formatPrice(saldo)}
                        </span>
                      );
                    }
                    if (saldo < 0) {
                      return (
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                          A favor ${formatPrice(Math.abs(saldo))}
                        </span>
                      );
                    }
                    return (
                      <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                        Saldado
                      </span>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Productos del carrito:</p>
                  {pedido.items_pedido && pedido.items_pedido.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-sm bg-gray-50 p-2.5 rounded-xl gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => modificarCantidadItem(pedido.id, item.id, item.cantidad - 1)}
                          disabled={item.cantidad <= 1}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 font-bold disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="text-gray-700 font-medium min-w-[1.5rem] text-center">
                          {item.cantidad}
                        </span>
                        <button
                          onClick={() => modificarCantidadItem(pedido.id, item.id, item.cantidad + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 font-bold"
                        >
                          +
                        </button>
                        <span className="text-gray-700 font-medium">{item.nombre_producto}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-semibold">${formatPrice(item.precio_unitario * item.cantidad)}</span>
                        <button
                          onClick={() => eliminarItem(pedido.id, item.id)}
                          className="text-red-500 font-bold text-base leading-none px-1"
                          title="Eliminar producto"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  {agregandoProductoA === pedido.id ? (
                    <div className="border border-gray-200 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Buscar producto por nombre..."
                          value={busquedaProducto}
                          onChange={(e) => setBusquedaProducto(e.target.value)}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5"
                        />
                        <button
                          onClick={() => {
                            setAgregandoProductoA(null);
                            setBusquedaProducto("");
                          }}
                          className="text-xs font-semibold text-gray-500"
                        >
                          Cancelar
                        </button>
                      </div>

                      {busquedaProducto.trim() && (
                        <>
                        <div className="flex gap-1.5 mb-2">
                          {[
                            { id: "stock", label: "🟢 Tengo" },
                            { id: "pedido", label: "📦 A pedido" },
                            { id: "todos", label: "Todo" }
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setFiltroStock(f.id)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                                filtroStock === f.id
                                  ? "bg-brand-blue text-white border-brand-blue"
                                  : "bg-white text-gray-600 border-gray-200"
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1.5">
                          {filtrarProductos(busquedaProducto)
                            .slice(0, 8)
                            .map((p) => (
                              <div
                                key={p.id}
                                className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded-lg"
                              >
                                <span className="text-gray-700">
                                  {p.nombre}{" "}
                                  <span className="text-gray-400">
                                    (${formatPrice(p.precio_oferta && Number(p.precio_oferta) < Number(p.precio) ? p.precio_oferta : p.precio || 0)}
                                    {p.precio_oferta && Number(p.precio_oferta) < Number(p.precio) && " · oferta"})
                                  </span>
                                  {p.bajo_pedido ? (
                                    <span className="ml-1 text-[10px] font-bold text-purple-700">a pedido</span>
                                  ) : (
                                    <span className="ml-1 text-[10px] font-bold text-green-700">stock {p.stock ?? 0}</span>
                                  )}
                                </span>
                                <button
                                  onClick={() => agregarProductoAPedido(pedido.id, p)}
                                  className="text-xs font-bold text-white bg-brand-blue px-2.5 py-1 rounded-lg"
                                >
                                  + Agregar
                                </button>
                              </div>
                            ))}
                          {filtrarProductos(busquedaProducto).length === 0 && (
                            <p className="text-xs text-gray-400 py-2">
                              Sin resultados
                              {filtroStock === "stock" && " entre los que tenés en stock"}
                              {filtroStock === "pedido" && " entre los productos a pedido"}.
                              {filtroStock !== "todos" && (
                                <button
                                  type="button"
                                  onClick={() => setFiltroStock("todos")}
                                  className="ml-1 font-bold text-brand-blue underline"
                                >
                                  Buscar en todo
                                </button>
                              )}
                            </p>
                          )}
                        </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setAgregandoProductoA(pedido.id)}
                      className="text-xs font-bold text-brand-blue bg-blue-50 px-3 py-1.5 rounded-full"
                    >
                      + Agregar producto
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {comprobantePedido && (
        <ComprobantePedido
          pedido={comprobantePedido}
          onClose={() => setComprobantePedido(null)}
        />
      )}
    </main>
  );
}

export default function AdminPedidosPage() {
  return (
    <AdminGuard>
      <PanelVentas />
    </AdminGuard>
  );
}
