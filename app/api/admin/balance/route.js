export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Recargos que paga Bolson Click sobre el precio de lista del proveedor
const MULT_COSTO = 1.03 * 1.05;

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function rangoMes(desplazamiento = 0) {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() + desplazamiento, 1);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + desplazamiento + 1, 1);
  return { inicio, fin };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    // 0 = mes actual, -1 = mes pasado
    const mes = Number(searchParams.get("mes") || 0);

    const { inicio, fin } = rangoMes(mes);
    const anterior = rangoMes(mes - 1);

    const [pedidosRes, productosRes, comprasRes, gastosRes, clientesRes] =
      await Promise.all([
        supabase
          .from("pedidos")
          .select(
            "id, total, monto_pagado, estado, estado_pago, created_at, telefono_cliente, nombre_cliente, items_pedido(producto_id, nombre_producto, cantidad, precio_unitario)"
          )
          .gte("created_at", anterior.inicio.toISOString())
          .lt("created_at", fin.toISOString()),
        supabase
          .from("Productos")
          .select("id, nombre, costo, costo_envio, stock, precio")
          .or("bajo_pedido.is.null,bajo_pedido.eq.false")
          .eq("activo", true),
        supabase
          .from("compras_proveedor")
          .select("fecha, subtotal, flete")
          .gte("fecha", anterior.inicio.toISOString().slice(0, 10))
          .lt("fecha", fin.toISOString().slice(0, 10)),
        supabase
          .from("gastos_generales")
          .select("fecha, concepto, monto")
          .gte("fecha", anterior.inicio.toISOString().slice(0, 10))
          .lt("fecha", fin.toISOString().slice(0, 10)),
        supabase.from("clientes").select("telefono, nombre, created_at")
      ]);

    const todos = (pedidosRes.data || []).filter((p) => p.estado !== "cancelado");
    const productos = productosRes.data || [];

    // Costo real de cada producto, para saber cuánto se gana en cada venta
    const costoPorProducto = {};
    productos.forEach((p) => {
      costoPorProducto[p.id] =
        Number(p.costo || 0) * MULT_COSTO + Number(p.costo_envio || 0);
    });

    function dentro(fechaTexto, desde, hasta) {
      const f = new Date(fechaTexto);
      return f >= desde && f < hasta;
    }

    const delMes = todos.filter((p) => dentro(p.created_at, inicio, fin));
    const delAnterior = todos.filter((p) =>
      dentro(p.created_at, anterior.inicio, anterior.fin)
    );

    // ---------- VENTAS ----------
    function resumirVentas(lista) {
      const total = lista.reduce((a, p) => a + Number(p.total || 0), 0);
      const cobrado = lista.reduce((a, p) => a + Number(p.monto_pagado || 0), 0);

      let costoVendido = 0;
      let unidades = 0;
      lista.forEach((p) => {
        (p.items_pedido || []).forEach((i) => {
          const cant = Number(i.cantidad || 0);
          unidades += cant;
          costoVendido += (costoPorProducto[i.producto_id] || 0) * cant;
        });
      });

      return {
        pedidos: lista.length,
        total,
        cobrado,
        pendiente: total - cobrado,
        costoVendido,
        gananciaBruta: total - costoVendido,
        unidades,
        ticketPromedio: lista.length ? Math.round(total / lista.length) : 0
      };
    }

    const ventas = resumirVentas(delMes);
    const ventasAnterior = resumirVentas(delAnterior);

    // ---------- GASTOS ----------
    const comprasMes = (comprasRes.data || []).filter((c) =>
      dentro(c.fecha + "T12:00:00", inicio, fin)
    );
    const gastosMes = (gastosRes.data || []).filter((g) =>
      dentro(g.fecha + "T12:00:00", inicio, fin)
    );

    const compradoMercaderia = comprasMes.reduce((a, c) => a + Number(c.subtotal || 0), 0);
    const compradoFlete = comprasMes.reduce((a, c) => a + Number(c.flete || 0), 0);
    const otrosGastos = gastosMes.reduce((a, g) => a + Number(g.monto || 0), 0);

    // Plata real en el bolsillo: lo que entró menos todo lo que salió
    const plataEnBolsillo =
      ventas.cobrado - compradoMercaderia - compradoFlete - otrosGastos;

    // Ganancia sobre lo vendido, descontando los gastos del mes
    const gananciaNeta = ventas.gananciaBruta - otrosGastos;

    // ---------- DÍAS CON MÁS VENTA ----------
    const porDia = {};
    const porFecha = {};
    delMes.forEach((p) => {
      const f = new Date(p.created_at);
      const dia = DIAS[f.getDay()];
      porDia[dia] = (porDia[dia] || 0) + Number(p.total || 0);

      const clave = f.toISOString().slice(0, 10);
      if (!porFecha[clave]) porFecha[clave] = { fecha: clave, total: 0, pedidos: 0 };
      porFecha[clave].total += Number(p.total || 0);
      porFecha[clave].pedidos += 1;
    });

    const diasSemana = Object.entries(porDia)
      .map(([dia, total]) => ({ dia, total }))
      .sort((a, b) => b.total - a.total);

    const mejoresFechas = Object.values(porFecha)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // ---------- PRODUCTOS ----------
    const vendidoPorProducto = {};
    delMes.forEach((p) => {
      (p.items_pedido || []).forEach((i) => {
        const id = i.producto_id;
        if (!vendidoPorProducto[id]) {
          vendidoPorProducto[id] = {
            id,
            nombre: i.nombre_producto,
            unidades: 0,
            facturado: 0,
            ganancia: 0
          };
        }
        const cant = Number(i.cantidad || 0);
        const v = vendidoPorProducto[id];
        v.unidades += cant;
        v.facturado += Number(i.precio_unitario || 0) * cant;
        v.ganancia += (Number(i.precio_unitario || 0) - (costoPorProducto[id] || 0)) * cant;
      });
    });

    const masVendidos = Object.values(vendidoPorProducto)
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 10);

    const masRentables = Object.values(vendidoPorProducto)
      .sort((a, b) => b.ganancia - a.ganancia)
      .slice(0, 5);

    // Los que tienen stock y no se movieron en el mes
    const vendidosIds = new Set(Object.keys(vendidoPorProducto).map(Number));
    const sinRotacion = productos
      .filter((p) => Number(p.stock || 0) > 0 && !vendidosIds.has(p.id))
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        stock: p.stock,
        plataParada: Math.round((costoPorProducto[p.id] || 0) * Number(p.stock || 0))
      }))
      .sort((a, b) => b.plataParada - a.plataParada)
      .slice(0, 10);

    const plataParadaTotal = productos
      .filter((p) => Number(p.stock || 0) > 0 && !vendidosIds.has(p.id))
      .reduce((a, p) => a + (costoPorProducto[p.id] || 0) * Number(p.stock || 0), 0);

    // ---------- CLIENTES ----------
    const porCliente = {};
    delMes.forEach((p) => {
      const tel = p.telefono_cliente || "sin-tel";
      if (!porCliente[tel]) {
        porCliente[tel] = {
          telefono: tel,
          nombre: p.nombre_cliente || "Sin nombre",
          compras: 0,
          gastado: 0
        };
      }
      porCliente[tel].compras += 1;
      porCliente[tel].gastado += Number(p.total || 0);
    });

    const mejoresClientes = Object.values(porCliente)
      .sort((a, b) => b.gastado - a.gastado)
      .slice(0, 8);

    // Cuántos compraron por primera vez este mes
    const telefonosAntes = new Set(
      todos
        .filter((p) => new Date(p.created_at) < inicio)
        .map((p) => p.telefono_cliente)
    );
    const clientesNuevos = Object.keys(porCliente).filter(
      (t) => !telefonosAntes.has(t)
    ).length;
    const clientesQueVolvieron = Object.keys(porCliente).length - clientesNuevos;

    const registradosMes = (clientesRes.data || []).filter((c) =>
      dentro(c.created_at, inicio, fin)
    ).length;

    // ---------- COMPARACIÓN CON EL MES ANTERIOR ----------
    function variacion(actual, previo) {
      if (!previo) return null;
      return Math.round(((actual - previo) / previo) * 100);
    }

    return Response.json(
      {
        periodo: {
          desde: inicio.toISOString(),
          hasta: fin.toISOString(),
          etiqueta: inicio.toLocaleDateString("es-AR", {
            month: "long",
            year: "numeric"
          })
        },
        ventas,
        ventasAnterior,
        variaciones: {
          total: variacion(ventas.total, ventasAnterior.total),
          pedidos: variacion(ventas.pedidos, ventasAnterior.pedidos),
          ticket: variacion(ventas.ticketPromedio, ventasAnterior.ticketPromedio)
        },
        gastos: {
          mercaderia: compradoMercaderia,
          flete: compradoFlete,
          otros: otrosGastos,
          totalGastado: compradoMercaderia + compradoFlete + otrosGastos,
          detalleOtros: gastosMes
        },
        gananciaNeta,
        plataEnBolsillo,
        diasSemana,
        mejoresFechas,
        masVendidos,
        masRentables,
        sinRotacion,
        plataParadaTotal,
        mejoresClientes,
        clientes: {
          compraron: Object.keys(porCliente).length,
          nuevos: clientesNuevos,
          volvieron: clientesQueVolvieron,
          registrados: registradosMes
        }
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
