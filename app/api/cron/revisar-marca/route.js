export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";
import { esAdminRequest } from "@/lib/verificarAdmin";
import { taparMarcaProveedor } from "@/lib/taparMarca";
import { copiarAFotosPropias } from "@/lib/fotosProveedor";
import { agregarMarcaDeAgua, yaTieneMarcaDeAgua, MARCA_EN_NOMBRE } from "@/lib/marcaDeAgua";

// Revisa las fotos que YA están copiadas en nuestro almacenamiento: tapa la
// marca del proveedor donde aparezca y les pone nuestra marca de agua a todas (las nuevas ya se tapan al copiarlas y
// las que se muestran desde el proveedor, al pasar por /api/img).
//
// La llama la base de datos cada pocos minutos (pg_cron, con la clave
// "x-cron") hasta revisar todo. Después solo revisa lo nuevo: cuando cambia
// una foto de un producto, ese producto se vuelve a revisar solo.
//
// Cada foto tapada se guarda con un nombre NUEVO (así nadie ve la vieja
// guardada en caché) y la vieja se borra del almacenamiento.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "fotos-productos";
const POR_TANDA = 70;
const LIMITE_MS = 45000;

function rutaEnBucket(url) {
  const m = String(url || "").match(/\/storage\/v1\/object\/public\/fotos-productos\/(.+?)(\?|$)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function autorizado(request) {
  const clave = request.headers.get("x-cron");
  if (clave) {
    const { data } = await supabase.from("secretos_internos").select("valor").eq("clave", "cron").single();
    if (data?.valor && clave === data.valor) return true;
  }
  return esAdminRequest(request, supabase);
}

async function descargar(url) {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") || "";
    if (!tipo.startsWith("image/")) return null;
    return { bytes: Buffer.from(await res.arrayBuffer()), tipo };
  } catch (e) {
    return null;
  }
}

export async function POST(request) {
  if (!(await autorizado(request))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const inicio = Date.now();
  const { data: fotos, error } = await supabase.rpc("fotos_para_marca_agua", { p_limite: POR_TANDA });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const porProducto = new Map();
  for (const f of fotos || []) {
    if (!porProducto.has(f.id)) porProducto.set(f.id, []);
    if (f.url) porProducto.get(f.id).push(f);
  }

  let revisados = 0;
  let tapadas = 0;
  let fallidas = 0;
  let copiadas = 0;
  let marcadas = 0;

  for (const [id, lista] of porProducto) {
    if (Date.now() - inicio > LIMITE_MS) break;

    const cambios = {};
    const viejas = [];

    for (const f of lista) {
      const ruta = rutaEnBucket(f.url);

      // Todavía se muestra desde la página del proveedor: la copiamos a
      // nuestro almacenamiento (la copia ya sale con la marca tapada). Así
      // ninguna pantalla puede mostrar la original, use o no /api/img.
      if (!ruta) {
        if (!/^https:\/\//i.test(f.url || "")) continue;
        const copia = await copiarAFotosPropias(supabase, f.url, `p${id}-${f.columna}`);
        if (copia) {
          cambios[f.columna] = copia;
          copiadas++;
        } else {
          fallidas++;
        }
        continue;
      }

      // Ya tiene nuestra marca de agua (y la del proveedor tapada): nada que hacer
      if (yaTieneMarcaDeAgua(f.url)) continue;

      const foto = await descargar(f.url);
      if (!foto) {
        fallidas++;
        continue;
      }

      // Tapamos la marca del proveedor (si está) y ponemos la nuestra.
      // Vale también para tus fotos propias.
      const tapada = await taparMarcaProveedor(foto.bytes, foto.tipo);
      const r = await agregarMarcaDeAgua(tapada.bytes, "image/webp");
      if (!r.marcada && !tapada.tapada) continue;
      if (tapada.tapada) tapadas++;
      if (r.marcada) marcadas++;

      const extension = r.tipo.includes("png") ? "png" : r.tipo.includes("webp") ? "webp" : "jpg";
      const sufijo = r.marcada ? MARCA_EN_NOMBRE : "-bc";
      const nueva = `espejo/p${id}-${f.columna}${sufijo}${Date.now().toString(36)}.${extension}`;
      const { error: errSubir } = await supabase.storage.from(BUCKET).upload(nueva, r.bytes, {
        contentType: r.tipo,
        upsert: true,
        cacheControl: "31536000"
      });
      if (errSubir) {
        fallidas++;
        continue;
      }
      cambios[f.columna] = supabase.storage.from(BUCKET).getPublicUrl(nueva).data.publicUrl;
      viejas.push(ruta);
    }

    // Una foto que no se puede bajar (rota o borrada) no traba la cola: el
    // producto se da por revisado igual. Si después le cambian la foto, se
    // vuelve a revisar solo.
    const { error: errProd } = await supabase
      .from("Productos")
      .update({ ...cambios, marca_revisada_en: new Date().toISOString(), marca_agua_en: new Date().toISOString() })
      .eq("id", id);

    if (!errProd) {
      revisados++;
      // La foto vieja (sin nuestra marca de agua) ya no la usa nadie
      if (viejas.length) await supabase.storage.from(BUCKET).remove(viejas);
    }
  }

  const { data: estado } = await supabase.rpc("estado_marca_agua");
  return Response.json({
    ok: true,
    revisados,
    tapadas,
    marcadas,
    copiadas,
    fallidas,
    pendientes: estado?.[0]?.pendientes ?? null
  });
}
