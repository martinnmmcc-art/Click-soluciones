import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROVEEDOR = "nextcell";
const BASE = "https://nextcell.com.ar/wp-json/wc/store/v1";

// --- Fórmula de precios de Bolson Click ---
// costo crudo del proveedor
//   + 3% que cobra el proveedor por transferencia
//   + 5% por variación del dólar
//   + 80% de ganancia
//   + flete estimado (14,5% del costo, el mismo % que salió el último pedido)
const RECARGO_TRANSFERENCIA = 0.03;
const RECARGO_DOLAR = 0.05;
const MARKUP = 0.8;
const FLETE_ESTIMADO = 0.145;

function calcularPrecios(costoCrudo) {
  const costo = Number(costoCrudo) || 0;
  const flete = costo * FLETE_ESTIMADO;
  const bruto = costo * (1 + RECARGO_TRANSFERENCIA) * (1 + RECARGO_DOLAR) * (1 + MARKUP) + flete;
  // Redondeo a $50 hacia arriba, como el resto del catálogo
  const precio = Math.ceil(bruto / 50) * 50;
  return { costo, flete: Math.round(flete * 100) / 100, precio };
}

// Los precios de la Store API vienen en la unidad mínima (centavos).
function precioDesdeApi(valor, decimales) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  const div = Math.pow(10, Number(decimales) || 0);
  return n / div;
}

// El proveedor nombra sus categorías como "C. Hogar 家居，厨房用品".
// Las traducimos a categorías simples y en castellano para la tienda.
const MAPA_CATEGORIAS = {
  A: "Juguetes y Niños",
  B: "Belleza y Cuidado Personal",
  C: "Hogar y Cocina",
  D: "Audio y Sonido",
  E: "Accesorios Celular",
  F: "Computación y Gaming",
  G: "Tecnología y Smart TV",
  H: "Herramientas y Cargadores",
  I: "Oficina y Memorias",
  J: "Seguridad y Drones",
  K: "Redes y Conectividad",
  L: "Regalería y Extras",
  M: "Hidrogel y Accesorios",
  N: "Mascotas"
};

// Deja solo el texto en castellano, sin la letra inicial ni los caracteres chinos.
function limpiarNombreCategoria(nombre) {
  if (!nombre) return "Otros";
  return nombre
    .replace(/^[A-Z]\.\s*/, "")
    .replace(/[\u4e00-\u9fff\uff00-\uffef\u3000-\u303f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function categoriaDeProducto(p) {
  const original = p.categories?.[0]?.name || "";
  const letra = original.match(/^([A-Z])\./)?.[1];
  if (letra && MAPA_CATEGORIAS[letra]) return MAPA_CATEGORIAS[letra];
  const limpia = limpiarNombreCategoria(original);
  return limpia || "Otros";
}

// Limpia las etiquetas HTML de la descripción del proveedor.
function limpiarHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);
}

async function traerPagina(pagina, categoria) {
  const params = new URLSearchParams({
    per_page: "100",
    page: String(pagina),
    catalog_visibility: "visible"
  });
  if (categoria) params.set("category", categoria);

  const res = await fetch(`${BASE}/products?${params.toString()}`, {
    headers: { "User-Agent": "BolsonClick/1.0 (importador de catálogo)" },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`El proveedor respondió ${res.status}. Puede que su web esté caída o que haya cambiado.`);
  }

  const totalPaginas = Number(res.headers.get("x-wp-totalpages") || 1);
  const productos = await res.json();
  return { productos, totalPaginas };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const accion = searchParams.get("accion") || "categorias";

  try {
    // Lista de categorías del proveedor, con cuántos productos tiene cada una
    if (accion === "categorias") {
      const res = await fetch(`${BASE}/products/categories?per_page=100`, {
        headers: { "User-Agent": "BolsonClick/1.0 (importador de catálogo)" },
        cache: "no-store"
      });
      if (!res.ok) {
        throw new Error(`El proveedor respondió ${res.status} al pedir las categorías.`);
      }
      const cats = await res.json();
      return NextResponse.json({
        ok: true,
        categorias: (cats || [])
          .filter((c) => c.count > 0)
          .map((c) => ({ id: c.id, nombre: c.name, cantidad: c.count }))
      });
    }

    // Vista previa: qué se importaría de una categoría, sin tocar nada
    if (accion === "previsualizar") {
      const categoria = searchParams.get("categoria") || "";
      const { productos, totalPaginas } = await traerPagina(1, categoria);

      const refs = productos.map((p) => String(p.id));
      const { data: existentes } = await supabase
        .from("Productos")
        .select("proveedor_ref")
        .eq("proveedor", PROVEEDOR)
        .in("proveedor_ref", refs.length ? refs : ["_"]);

      const yaEstan = new Set((existentes || []).map((e) => e.proveedor_ref));

      const muestra = productos.slice(0, 10).map((p) => {
        const costo = precioDesdeApi(p.prices?.price, p.prices?.currency_minor_unit);
        const { precio } = calcularPrecios(costo);
        return {
          nombre: p.name,
          costo,
          precio_venta: precio,
          ya_importado: yaEstan.has(String(p.id))
        };
      });

      return NextResponse.json({
        ok: true,
        total_en_pagina: productos.length,
        total_paginas: totalPaginas,
        nuevos: productos.filter((p) => !yaEstan.has(String(p.id))).length,
        ya_importados: productos.filter((p) => yaEstan.has(String(p.id))).length,
        muestra
      });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { categoria, pagina = 1, actualizar_precios = false } = await request.json();

    const { productos, totalPaginas } = await traerPagina(pagina, categoria);

    // Categorías que decidiste no tener en la tienda: si no las filtramos,
    // los productos que borraste vuelven a aparecer en cada importación.
    const { data: excluidas } = await supabase.from("categorias_excluidas").select("categoria");
    const listaExcluidas = new Set((excluidas || []).map((e) => e.categoria));

    if (!productos.length) {
      return NextResponse.json({ ok: true, importados: 0, actualizados: 0, omitidos: 0, total_paginas: totalPaginas });
    }

    // Vemos cuáles ya tenemos, para no duplicar
    const refs = productos.map((p) => String(p.id));
    const { data: existentes } = await supabase
      .from("Productos")
      .select("id, proveedor_ref, costo, categoria")
      .eq("proveedor", PROVEEDOR)
      .in("proveedor_ref", refs);

    const mapaExistentes = new Map((existentes || []).map((e) => [e.proveedor_ref, e]));

    // También comparamos por nombre: si el producto ya está cargado a mano
    // (con stock y precio propio), no queremos crear una copia importada.
    const nombresProveedor = productos.map((p) => p.name).filter(Boolean);
    const { data: porNombre } = await supabase
      .from("Productos")
      .select("id, nombre")
      .in("nombre", nombresProveedor.length ? nombresProveedor : ["_"]);

    const yaExistePorNombre = new Set(
      (porNombre || []).map((p) => (p.nombre || "").trim().toLowerCase())
    );

    const aInsertar = [];
    let actualizados = 0;
    let omitidos = 0;

    for (const p of productos) {
      const ref = String(p.id);
      const costo = precioDesdeApi(p.prices?.price, p.prices?.currency_minor_unit);

      // Sin precio no podemos calcular nada
      if (!costo) {
        omitidos++;
        continue;
      }

      const { flete, precio } = calcularPrecios(costo);
      // Si su categoría está excluida, no lo traemos
      if (listaExcluidas.has(categoriaDeProducto(p))) {
        omitidos++;
        continue;
      }

      // Si ya lo tenés cargado con ese nombre, lo salteamos: tu versión manda
      // (tiene tu stock, tu precio y tus ofertas).
      if (!mapaExistentes.get(ref) && yaExistePorNombre.has((p.name || "").trim().toLowerCase())) {
        omitidos++;
        continue;
      }

      const yaExiste = mapaExistentes.get(ref);

      if (yaExiste) {
        // Solo actualizamos si el precio del proveedor cambió y así lo pidieron
        const cambioPrecio = actualizar_precios && Number(yaExiste.costo) !== costo;
        const categoriaCorrecta = categoriaDeProducto(p);
        const cambioCategoria = yaExiste.categoria !== categoriaCorrecta;

        if (cambioPrecio || cambioCategoria) {
          const cambios = {
            categoria: categoriaCorrecta,
            categoria_proveedor: p.categories?.[0]?.name || null
          };
          if (cambioPrecio) {
            cambios.costo = costo;
            cambios.costo_envio = flete;
            cambios.precio = precio;
            cambios.precio_proveedor_actualizado = new Date().toISOString();
          }
          await supabase.from("Productos").update(cambios).eq("id", yaExiste.id);
          actualizados++;
        } else {
          omitidos++;
        }
        continue;
      }

      aInsertar.push({
        nombre: p.name?.slice(0, 200) || "Sin nombre",
        descripcion: limpiarHtml(p.description || p.short_description),
        imagen_url: p.images?.[0]?.src || null,
        imagen_url_2: p.images?.[1]?.src || null,
        imagen_url_3: p.images?.[2]?.src || null,
        costo,
        costo_envio: flete,
        precio,
        stock: 0,
        bajo_pedido: true,
        activo: true,
        categoria: categoriaDeProducto(p),
        categoria_proveedor: p.categories?.[0]?.name || null,
        proveedor: PROVEEDOR,
        proveedor_ref: ref,
        precio_proveedor_actualizado: new Date().toISOString()
      });
    }

    let importados = 0;
    if (aInsertar.length) {
      const { data, error } = await supabase
        .from("Productos")
        .insert(aInsertar)
        .select("id");
      if (error) throw new Error(error.message);
      importados = data?.length || 0;
    }

    return NextResponse.json({
      ok: true,
      importados,
      actualizados,
      omitidos,
      pagina,
      total_paginas: totalPaginas,
      hay_mas: pagina < totalPaginas
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
