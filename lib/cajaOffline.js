// Caja sin señal.
//
// En la Comarca hay lugares sin datos, y la venta no puede depender de eso:
// si el cliente está con la plata en la mano, hay que poder cobrar igual.
//
// Cómo funciona:
//  - El catálogo propio se guarda en el celular (son pocos productos).
//  - Las ventas sin señal quedan en una cola local.
//  - Al volver la señal se envían solas y ahí se descuenta el stock.
//
// El stock local se descuenta en el momento para que la caja muestre
// números creíbles, pero el descuento real lo hace el servidor al
// sincronizar: si dos personas venden a la vez, gana el servidor.

const CATALOGO = "bolsonclick_caja_catalogo";
const CATALOGO_FECHA = "bolsonclick_caja_catalogo_fecha";
const COLA = "bolsonclick_caja_cola";
const CLIENTES = "bolsonclick_caja_clientes";
const PEDIDOS = "bolsonclick_caja_pedidos";
const COLA_CAMBIOS = "bolsonclick_caja_cambios";

function leer(clave, porDefecto) {
  try {
    const v = localStorage.getItem(clave);
    return v ? JSON.parse(v) : porDefecto;
  } catch (e) {
    return porDefecto;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (e) {
    // Si no entra, no rompemos la venta
    return false;
  }
}

// ---------- CATÁLOGO ----------

export function catalogoLocal() {
  return leer(CATALOGO, []);
}

export function fechaCatalogo() {
  try {
    const f = localStorage.getItem(CATALOGO_FECHA);
    return f ? new Date(f) : null;
  } catch (e) {
    return null;
  }
}

// Guarda los productos propios para poder cobrar sin señal
export function guardarCatalogo(productos) {
  const limpio = (productos || []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precio: Number(p.precio || 0),
    precio_oferta: p.precio_oferta ? Number(p.precio_oferta) : null,
    stock: Number(p.stock || 0),
    codigo_barras: p.codigo_barras || null,
    bajo_pedido: !!p.bajo_pedido
  }));

  if (guardar(CATALOGO, limpio)) {
    try {
      localStorage.setItem(CATALOGO_FECHA, new Date().toISOString());
    } catch (e) {}
  }
  return limpio.length;
}

export function buscarPorCodigoLocal(codigo) {
  const c = String(codigo || "").trim();
  return catalogoLocal().find((p) => p.codigo_barras === c) || null;
}

export function buscarPorNombreLocal(texto) {
  const q = String(texto || "").trim().toLowerCase();
  if (q.length < 2) return [];
  return catalogoLocal()
    .filter((p) => p.nombre?.toLowerCase().includes(q))
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 8);
}

// Descuenta el stock local para que la caja muestre números creíbles
// mientras no hay señal. El descuento real lo hace el servidor después.
export function descontarLocal(items) {
  const catalogo = catalogoLocal();
  const porId = {};
  items.forEach((i) => {
    porId[i.id] = (porId[i.id] || 0) + Number(i.cantidad || 0);
  });

  const actualizado = catalogo.map((p) =>
    porId[p.id] ? { ...p, stock: Math.max(p.stock - porId[p.id], 0) } : p
  );

  guardar(CATALOGO, actualizado);
}

// ---------- COLA DE VENTAS ----------

export function ventasPendientes() {
  return leer(COLA, []);
}

export function encolarVenta(venta) {
  const cola = ventasPendientes();

  const registro = {
    ...venta,
    id_local: `v${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    creada_en: new Date().toISOString()
  };

  cola.push(registro);
  guardar(COLA, cola);
  descontarLocal(venta.items || []);

  return registro;
}

export function quitarDeCola(idLocal) {
  guardar(
    COLA,
    ventasPendientes().filter((v) => v.id_local !== idLocal)
  );
}

export function editarVentaEnCola(idLocal, cambios) {
  const cola = ventasPendientes().map((v) =>
    v.id_local === idLocal ? { ...v, ...cambios } : v
  );
  guardar(COLA, cola);
}

// Envía al servidor las ventas que quedaron pendientes
export async function sincronizarVentas(supabase) {
  const cola = ventasPendientes();
  if (cola.length === 0) return { enviadas: 0, fallaron: 0 };

  let enviadas = 0;
  let fallaron = 0;

  for (const venta of cola) {
    try {
      const { data, error } = await supabase.rpc("venta_caja", {
        p_items: venta.items,
        p_metodo_pago: venta.metodo_pago,
        p_total: venta.total,
        p_pagado: venta.pagado ?? venta.total,
        p_nombre_cliente: venta.nombre_cliente || null,
        p_telefono: venta.telefono || null
      });

      if (error) {
        fallaron++;
        continue;
      }

      quitarDeCola(venta.id_local);
      enviadas++;
    } catch (e) {
      fallaron++;
    }
  }

  return { enviadas, fallaron };
}

export function hayConexion() {
  try {
    return navigator.onLine !== false;
  } catch (e) {
    return true;
  }
}


// ---------- CLIENTES ----------
// Sin esto, al armar un pedido en zona sin señal no aparece ningún cliente
// y hay que escribir todo a mano.

export function clientesLocales() {
  return leer(CLIENTES, []);
}

export function guardarClientes(clientes) {
  const limpio = (clientes || []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    localidad: c.localidad || "",
    direccion: c.direccion || ""
  }));
  guardar(CLIENTES, limpio);
  return limpio.length;
}

export function buscarClienteLocal(texto) {
  const q = String(texto || "").trim().toLowerCase();
  if (q.length < 2) return [];

  const soloNumeros = q.replace(/\D/g, "");

  return clientesLocales()
    .filter((c) => {
      const porNombre = c.nombre?.toLowerCase().includes(q);
      const porTelefono = soloNumeros.length >= 3 && c.telefono?.includes(soloNumeros);
      return porNombre || porTelefono;
    })
    .slice(0, 8);
}

// ---------- PEDIDOS ----------
// Guardamos los pedidos abiertos para poder verlos y modificarlos sin señal.

export function pedidosLocales() {
  return leer(PEDIDOS, []);
}

export function guardarPedidos(pedidos) {
  const limpio = (pedidos || []).map((p) => ({
    id: p.id,
    numero_pedido: p.numero_pedido,
    nombre_cliente: p.nombre_cliente,
    telefono_cliente: p.telefono_cliente,
    total: Number(p.total || 0),
    monto_pagado: Number(p.monto_pagado || 0),
    estado: p.estado,
    estado_pago: p.estado_pago,
    created_at: p.created_at,
    items: (p.items_pedido || []).map((i) => ({
      producto_id: i.producto_id,
      nombre_producto: i.nombre_producto,
      cantidad: Number(i.cantidad || 0),
      precio_unitario: Number(i.precio_unitario || 0)
    }))
  }));
  guardar(PEDIDOS, limpio);
  return limpio.length;
}

export function pedidoLocal(id) {
  return pedidosLocales().find((p) => Number(p.id) === Number(id)) || null;
}

// ---------- CAMBIOS PENDIENTES ----------
// Cuando modificás un pedido sin señal, el cambio queda acá y se aplica
// al volver la conexión. Sin esto el cambio se perdía en silencio.

export function cambiosPendientes() {
  return leer(COLA_CAMBIOS, []);
}

export function encolarCambio(cambio) {
  const cola = cambiosPendientes();

  const registro = {
    ...cambio,
    id_local: `c${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    creado_en: new Date().toISOString()
  };

  cola.push(registro);
  guardar(COLA_CAMBIOS, cola);

  // Reflejamos el cambio en la copia local, para que se vea aplicado
  if (cambio.pedido_id) {
    const pedidos = pedidosLocales().map((p) =>
      Number(p.id) === Number(cambio.pedido_id)
        ? { ...p, ...(cambio.campos || {}), items: cambio.items || p.items }
        : p
    );
    guardar(PEDIDOS, pedidos);
  }

  return registro;
}

export function quitarCambio(idLocal) {
  guardar(
    COLA_CAMBIOS,
    cambiosPendientes().filter((c) => c.id_local !== idLocal)
  );
}

// Aplica en el servidor los cambios que quedaron pendientes
export async function sincronizarCambios(supabase) {
  const cola = cambiosPendientes();
  if (cola.length === 0) return { aplicados: 0, fallaron: 0 };

  let aplicados = 0;
  let fallaron = 0;

  for (const cambio of cola) {
    try {
      if (cambio.tipo === "estado") {
        const res = await fetch("/api/admin/pedidos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: cambio.pedido_id, ...cambio.campos })
        });
        if (!res.ok) {
          fallaron++;
          continue;
        }
      } else if (cambio.tipo === "agregar_items") {
        const { error } = await supabase.rpc("agregar_items_pedido", {
          p_pedido_id: cambio.pedido_id,
          p_items: cambio.items
        });
        if (error) {
          fallaron++;
          continue;
        }
      }

      quitarCambio(cambio.id_local);
      aplicados++;
    } catch (e) {
      fallaron++;
    }
  }

  return { aplicados, fallaron };
}

// Todo lo que está esperando enviarse
export function totalPendiente() {
  return ventasPendientes().length + cambiosPendientes().length;
}
