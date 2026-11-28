// Cobro con tarjeta por Ualá Bis (API Cobros Online v2).
// Documentación: https://developers.ualabis.com.ar/v2/ambientes
//
// Se usa SOLO en el servidor: las claves nunca llegan al celular del cliente.
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   UALA_USERNAME        usuario de la cuenta Ualá
//   UALA_CLIENT_ID       client_id
//   UALA_CLIENT_SECRET   client_secret_id
//   UALA_PRUEBA          "1" para usar el entorno de test (pagos simulados).
//                        Sin cargar, o en "0", cobra de verdad.

import { createClient } from "@supabase/supabase-js";
import { NEGOCIO } from "@/lib/config";

const PRUEBA = process.env.UALA_PRUEBA === "1";
const AUTH = PRUEBA
  ? "https://auth.stage.developers.ar.ua.la/v2/api"
  : "https://auth.developers.ar.ua.la/v2/api";
const CHECKOUT = PRUEBA
  ? "https://checkout.stage.developers.ar.ua.la/v2/api"
  : "https://checkout.developers.ar.ua.la/v2/api";

export const METODO_UALA = "uala_bis";

export function ualaConfigurado() {
  return Boolean(process.env.UALA_USERNAME && process.env.UALA_CLIENT_ID && process.env.UALA_CLIENT_SECRET);
}

export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// El token dura 24 hs: lo guardamos en memoria y lo renovamos un rato antes.
let tokenGuardado = null;
let tokenVence = 0;

async function token() {
  if (tokenGuardado && Date.now() < tokenVence) return tokenGuardado;
  const res = await fetch(`${AUTH}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      username: process.env.UALA_USERNAME,
      client_id: process.env.UALA_CLIENT_ID,
      client_secret_id: process.env.UALA_CLIENT_SECRET,
      grant_type: "client_credentials"
    }),
    cache: "no-store"
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error("Ualá no aceptó las credenciales" + (data.message ? `: ${data.message}` : ""));
  }
  tokenGuardado = data.access_token;
  tokenVence = Date.now() + (Number(data.expires_in || 86400) - 600) * 1000;
  return tokenGuardado;
}

// Lo que falta pagar del pedido (el total menos lo que ya pagó)
export function saldoPedido(pedido) {
  return Math.max(0, Number(pedido?.total || 0) - Number(pedido?.monto_pagado || 0));
}

// Crea la orden de pago en Ualá y devuelve { uuid, link }
export async function crearOrdenUala(pedido) {
  const monto = saldoPedido(pedido);
  if (monto < 100) throw new Error("Ualá acepta cobros desde $100");

  const base = NEGOCIO.sitio.replace(/\/$/, "");
  const numero = encodeURIComponent(pedido.numero_pedido);
  const res = await fetch(`${CHECKOUT}/checkout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      amount: monto.toFixed(2),
      description: `${NEGOCIO.nombre} - Pedido ${pedido.numero_pedido}`,
      callback_success: `${base}/confirmacion?numero=${numero}&pago=ok`,
      callback_fail: `${base}/confirmacion?numero=${numero}&pago=fallo`,
      notification_url: `${base}/api/pagos/uala/webhook`,
      external_reference: String(pedido.numero_pedido)
    }),
    cache: "no-store"
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.links?.checkout_link) {
    throw new Error("Ualá no pudo crear el cobro" + (data.message ? `: ${data.message}` : ""));
  }
  return { uuid: data.uuid, link: data.links.checkout_link };
}

// Consulta la orden directo a Ualá. El aviso (webhook) no viene firmado, así
// que nunca le creemos al aviso: siempre preguntamos a Ualá.
export async function consultarOrdenUala(uuid) {
  const res = await fetch(`${CHECKOUT}/orders/${encodeURIComponent(uuid)}`, {
    headers: { Authorization: `Bearer ${await token()}`, Accept: "application/json" },
    cache: "no-store"
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

// APPROVED: cobrado y acreditado. PROCESSED: cobrado, falta que Ualá lo acredite.
export function ordenPagada(orden) {
  return orden?.status === "APPROVED" || orden?.status === "PROCESSED";
}

// Si Ualá confirma el pago, marca el pedido como pagado. Devuelve el estado.
export async function sincronizarPagoUala(db, pedido) {
  if (!pedido?.pago_uala_uuid) return { estado: "sin_orden" };
  if (pedido.estado_pago === "pagado") return { estado: "pagado" };

  const orden = await consultarOrdenUala(pedido.pago_uala_uuid);
  if (!orden) return { estado: "desconocido" };
  if (String(orden.external_reference || "") !== String(pedido.numero_pedido)) {
    return { estado: "desconocido" };
  }

  if (ordenPagada(orden)) {
    // Sumamos lo que se cobró en Ualá (guardado al crear la orden). Si
    // mientras tanto le agregaste productos al pedido, queda debiendo la
    // diferencia en vez de figurar pagado de más.
    const cobrado = Number(pedido.pago_uala_monto || 0) || saldoPedido(pedido);
    const nuevoPagado = Number(pedido.monto_pagado || 0) + cobrado;
    const total = Number(pedido.total || 0);
    await db
      .from("pedidos")
      .update({
        estado_pago: nuevoPagado >= total ? "pagado" : "deuda_parcial",
        monto_pagado: nuevoPagado,
        // La orden ya se usó: así un segundo aviso no la vuelve a sumar
        pago_uala_uuid: null,
        pago_uala_monto: null
      })
      .eq("id", pedido.id)
      .eq("pago_uala_uuid", pedido.pago_uala_uuid);
    return { estado: "pagado" };
  }
  if (orden.status === "REJECTED") return { estado: "rechazado" };
  return { estado: "pendiente" };
}
