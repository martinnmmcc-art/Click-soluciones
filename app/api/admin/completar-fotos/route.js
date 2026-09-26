export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";
import { esAdminRequest } from "@/lib/verificarAdmin";
import {
  buscarFotoEnProveedor,
  copiarAFotosPropias,
  esFotoPropia
} from "@/lib/fotosProveedor";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Completa las fotos de los productos que vienen en camino.
//
// - Si una línea no tiene foto, la busca en el proveedor (con verificación
//   de nombre) y la guarda en nuestro servidor.
// - Si tiene foto pero todavía apunta a la página del proveedor, la copia.
//
// La pantalla del pedido la llama sola al abrirse. Si el proveedor está en
// mantenimiento no pasa nada: lo que no se encuentra se reintenta la
// próxima vez.
export async function POST(request) {
  if (!(await esAdminRequest(request, supabaseAdmin))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: lineas, error } = await supabaseAdmin
    .from("lineas_pedido_proveedor")
    .select("id, nombre, imagen_url, producto_id, pedidos_proveedor!inner(estado), Productos(id, imagen_url)")
    .eq("pedidos_proveedor.estado", "en_camino");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const inicio = Date.now();
  // Cortamos a los 45 segundos para no pasarnos del límite de Vercel.
  // Lo que queda se hace en la siguiente llamada.
  const quedaTiempo = () => Date.now() - inicio < 45000;

  let encontradas = 0;
  let copiadas = 0;
  let sinResultado = 0;

  // Solo las que necesitan algo: sin foto, o con foto todavía del proveedor
  const pendientes = (lineas || []).filter((l) => {
    const actual = l.imagen_url || l.Productos?.imagen_url || null;
    return !esFotoPropia(actual);
  });

  async function procesar(linea) {
    const fotoProducto = linea.Productos?.imagen_url || null;
    let origen = linea.imagen_url || fotoProducto;

    if (!origen) {
      origen = await buscarFotoEnProveedor(linea.nombre);
      if (!origen) {
        sinResultado++;
        return;
      }
      encontradas++;
    }

    const propia = await copiarAFotosPropias(
      supabaseAdmin,
      origen,
      linea.producto_id ? `p${linea.producto_id}-imagen_url` : `linea${linea.id}`
    );

    // Si no se pudo copiar (proveedor caído), guardamos al menos la
    // dirección encontrada: se muestra igual y se copia en otro intento.
    const final = propia || origen;

    await supabaseAdmin
      .from("lineas_pedido_proveedor")
      .update({ imagen_url: final })
      .eq("id", linea.id);

    if (linea.producto_id && (!fotoProducto || propia)) {
      await supabaseAdmin
        .from("Productos")
        .update({ imagen_url: final })
        .eq("id", linea.producto_id);
    }

    if (propia) copiadas++;
  }

  let procesadas = 0;
  for (let i = 0; i < pendientes.length && quedaTiempo(); i += 4) {
    const tanda = pendientes.slice(i, i + 4);
    await Promise.all(tanda.map(procesar));
    procesadas += tanda.length;
  }

  const faltan = pendientes.length - procesadas;

  return Response.json({ encontradas, copiadas, sinResultado, faltan });
}
