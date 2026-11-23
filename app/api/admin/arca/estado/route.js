export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";
import {
  configuracion,
  infoCertificado,
  estadoServidores,
  ticketAcceso,
  puntosDeVenta,
  ultimoNumero
} from "@/lib/arca";

// "Probar conexión con ARCA": revisa cada paso por separado y dice cuál falla.
// No emite nada. Protegida por middleware.js (solo administradores).

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function paso(nombre, fn) {
  try {
    const r = await fn();
    return { nombre, ok: true, ...r };
  } catch (e) {
    return { nombre, ok: false, error: e.message, detalle: e.detalle ? String(e.detalle).slice(0, 600) : undefined };
  }
}

export async function GET() {
  const cfg = configuracion();
  const pasos = [];

  pasos.push({
    nombre: "Configuración en Vercel",
    ok: cfg.faltan.length === 0,
    ...(cfg.faltan.length
      ? { error: `Faltan: ${cfg.faltan.join(", ")}` }
      : { texto: `CUIT ${cfg.cuit} · punto de venta ${cfg.puntoVenta} · ${cfg.produccion ? "FACTURAS REALES" : "modo PRUEBA"}` })
  });

  if (cfg.cert) {
    const info = infoCertificado(cfg.cert);
    const vencido = info.vence && new Date(info.vence) < new Date();
    pasos.push({
      nombre: "Certificado",
      ok: !info.error && !vencido && (!info.cuit || info.cuit === cfg.cuit),
      ...(info.error
        ? { error: info.error }
        : vencido
        ? { error: `Vencido el ${info.vence.slice(0, 10)}. Generá uno nuevo en ARCA.` }
        : info.cuit && info.cuit !== cfg.cuit
        ? { error: `El certificado es del CUIT ${info.cuit}, pero ARCA_CUIT dice ${cfg.cuit}.` }
        : { texto: `${info.nombre} · vence ${info.vence.slice(0, 10)}` })
    });
  }

  pasos.push(
    await paso("Servidores de ARCA", async () => {
      const s = await estadoServidores();
      const ok = s.app === "OK" && s.base === "OK" && s.auth === "OK";
      if (!ok) throw new Error(`ARCA informa problemas: app ${s.app}, base ${s.base}, acceso ${s.auth}`);
      return { texto: "Funcionando" };
    })
  );

  if (cfg.faltan.length === 0) {
    let ticket = null;
    pasos.push(
      await paso("Acceso con tu certificado", async () => {
        ticket = await ticketAcceso(supabase, cfg);
        return { texto: "ARCA aceptó el certificado" };
      })
    );
    if (ticket) {
      pasos.push(
        await paso("Punto de venta", async () => {
          const lista = await puntosDeVenta(ticket, cfg);
          const pv = lista.find((p) => p.numero === cfg.puntoVenta);
          // En el modo de prueba de ARCA no hay puntos de venta reales: vale cualquiera
          if (!pv && !cfg.produccion) return { texto: `${cfg.puntoVenta} (en modo prueba vale cualquiera)` };
          if (!pv) {
            const hay = lista.map((p) => `${p.numero} (${p.tipo})`).join(", ") || "ninguno";
            throw new Error(
              `El punto de venta ${cfg.puntoVenta} no está habilitado para web service. Los que hay: ${hay}.`
            );
          }
          if (pv.bloqueado || pv.baja) throw new Error(`El punto de venta ${cfg.puntoVenta} está bloqueado o dado de baja.`);
          return { texto: `${pv.numero} · ${pv.tipo}` };
        })
      );
      pasos.push(
        await paso("Numeración de Factura C", async () => {
          const n = await ultimoNumero(ticket, cfg);
          return { texto: n === 0 ? "Todavía no hay facturas: la próxima es la N° 1" : `Última emitida: N° ${n}` };
        })
      );
    }
  }

  return Response.json({ listo: pasos.every((p) => p.ok), produccion: cfg.produccion, pasos });
}
