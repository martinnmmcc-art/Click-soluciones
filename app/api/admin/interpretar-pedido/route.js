export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Interpreta el texto de un pedido pegado tal cual como aparece en la web
// del proveedor (Producto \t Total) y busca cada uno en el catálogo del
// proveedor para traer su foto.
//
// La búsqueda de "¿ya lo tenés?" va directo al grano: primero por el
// nombre completo exacto, después por el código del proveedor. Ninguna
// de las dos depende de traer una lista corta de candidatos filtrada por
// la primera palabra del nombre — con catálogos grandes, esa primera
// palabra suele ser genérica ("Set", "Organizador", "Soporte") y el
// producto correcto quedaba afuera de esa lista corta sin que nada lo
// avisara.

function parsearLinea(linea) {
  const m = linea.match(/^(.+?)\s*[×x]\s*(\d+)\s*\t?\s*\$?\s*([\d.,]+)\s*$/i);
  if (!m) return null;

  const nombre = m[1].trim();
  const cantidad = parseInt(m[2], 10);
  const totalTexto = m[3].replace(/\./g, "").replace(",", ".");
  const total = parseFloat(totalTexto);

  if (!nombre || !cantidad || !total) return null;

  return {
    nombre,
    cantidad,
    precioUnitario: Math.round((total / cantidad) * 100) / 100,
    total
  };
}

function normalizar(texto) {
  return String(texto || "")
    .replace(/×/g, "x")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "y", "con", "para", "en", "a",
  "un", "una", "por", "set", "kit", "pack"
]);

function palabrasSignificativas(texto) {
  return normalizar(texto)
    .split(" ")
    .filter((p) => p.length >= 3 && !STOPWORDS.has(p));
}

// El código del proveedor: el último token con letras y números mezclados
// (MELECH-721, WMA-087, CD29203/CD29191). Es lo más específico del nombre.
function extraerCodigo(nombre) {
  const tokens = nombre.split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (/[A-Za-z]/.test(t) && /[0-9]/.test(t) && t.length >= 4) {
      return t.toLowerCase();
    }
  }
  return null;
}

// Busca en NUESTRA base, directo por el nombre completo o por el código,
// sin pasar por una lista corta de candidatos que se puede quedar afuera
// justo del que buscamos.
async function buscarProductoPropio(nombreItem, codigoItem) {
  // 1. Nombre exacto (case-insensitive). Probamos también la variante con
  //    "×" en vez de "x" entre números: algunos productos quedaron
  //    guardados con el símbolo de multiplicación en las medidas
  //    (26×11.5×7.5) y el proveedor en su web usa la letra "x" (26x11.5x7.5).
  const variantes = [nombreItem, nombreItem.replace(/(\d)x(\d)/gi, "$1×$2")];

  for (const variante of variantes) {
    const { data: exacto } = await supabase
      .from("Productos")
      .select("id, nombre, nombre_proveedor, imagen_url")
      .ilike("nombre_proveedor", variante)
      .limit(1);

    if (exacto?.[0]) return { encontrado: exacto[0], sugerido: null };
  }

  // 2. El código del proveedor. Es lo que distingue variantes que se
  //    llaman igual pero son distintas (dos "Reflector Lampara..." con
  //    código diferente, por ejemplo).
  if (codigoItem) {
    const { data: porCodigo } = await supabase
      .from("Productos")
      .select("id, nombre, nombre_proveedor, imagen_url")
      .ilike("nombre_proveedor", `%${codigoItem}%`)
      .limit(5);

    if (porCodigo?.length === 1) {
      return { encontrado: porCodigo[0], sugerido: null };
    }
    if (porCodigo?.length > 1) {
      // Varios productos comparten ese código: no adivinamos cuál es
      const normItem = normalizar(nombreItem);
      const exactoEntreVarios = porCodigo.find(
        (p) => normalizar(p.nombre_proveedor || p.nombre) === normItem
      );
      if (exactoEntreVarios) return { encontrado: exactoEntreVarios, sugerido: null };
    }
  }

  // 3. Sin coincidencia exacta ni por código: probamos una búsqueda
  //    amplia solo para ofrecer una sugerencia, nunca para vincular solo.
  const palabras = palabrasSignificativas(nombreItem).slice(0, 3);
  if (palabras.length >= 2) {
    const patron = palabras.map((p) => `nombre_proveedor.ilike.%${p}%`).join(",");
    const { data: parecidos } = await supabase
      .from("Productos")
      .select("id, nombre, nombre_proveedor")
      .or(patron)
      .limit(30);

    // De los parecidos, nos quedamos con el que comparte más palabras
    let mejor = null;
    let mejorPuntaje = 0;
    for (const p of parecidos || []) {
      const palabrasCand = new Set(palabrasSignificativas(p.nombre_proveedor || p.nombre));
      const comunes = palabras.filter((pi) => palabrasCand.has(pi)).length;
      if (comunes > mejorPuntaje) {
        mejorPuntaje = comunes;
        mejor = p;
      }
    }

    // Solo lo sugerimos si comparte casi todas las palabras relevantes
    if (mejor && mejorPuntaje >= Math.min(2, palabras.length)) {
      return { encontrado: null, sugerido: { id: mejor.id, nombre: mejor.nombre } };
    }
  }

  return { encontrado: null, sugerido: null };
}

// Busca la foto en la web del proveedor, pero solo la acepta si el
// resultado realmente se parece al producto pedido. Antes se tomaba el
// primer resultado de una búsqueda genérica sin comparar nada, y podía
// traer la foto de un producto completamente distinto.
async function buscarFotoProveedor(nombreItem, codigoItem) {
  const palabrasItem = new Set(palabrasSignificativas(nombreItem));
  if (palabrasItem.size === 0) return null;

  try {
    const terminos = [...palabrasItem].slice(0, 5).join(" ");
    const res = await fetch(
      `https://nextcell.com.ar/wp-json/wc/store/v1/products?search=${encodeURIComponent(terminos)}&per_page=5`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;

    const datos = await res.json();
    if (!Array.isArray(datos)) return null;

    for (const p of datos) {
      if (!p?.images?.[0]?.src || !p?.name) continue;

      const nombreResultado = normalizar(p.name);

      // Aceptamos la foto solo si aparece el código exacto, o si
      // comparten la mayoría de las palabras significativas.
      if (codigoItem && nombreResultado.includes(codigoItem)) {
        return p.images[0].src;
      }

      const palabrasResultado = new Set(palabrasSignificativas(p.name));
      const comunes = [...palabrasItem].filter((w) => palabrasResultado.has(w)).length;
      const proporcion = comunes / palabrasItem.size;

      if (proporcion >= 0.6) {
        return p.images[0].src;
      }
    }
  } catch (e) {
    // Sin foto no es grave: se puede cargar después a mano
  }

  return null;
}

export async function POST(request) {
  try {
    const { texto } = await request.json();
    if (!texto?.trim()) {
      return Response.json({ error: "Pegá el texto del pedido" }, { status: 400 });
    }

    const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
    const items = [];

    for (const linea of lineas) {
      const parseada = parsearLinea(linea);
      if (parseada) items.push(parseada);
    }

    if (items.length === 0) {
      return Response.json(
        { error: "No pude reconocer ningún producto. Fijate que el formato sea el de la web del proveedor." },
        { status: 400 }
      );
    }

    const resultado = [];

    for (const item of items) {
      const codigoItem = extraerCodigo(item.nombre);
      const { encontrado, sugerido } = await buscarProductoPropio(item.nombre, codigoItem);

      let imagenUrl = encontrado?.imagen_url || null;
      if (!imagenUrl) {
        imagenUrl = await buscarFotoProveedor(item.nombre, codigoItem);
      }

      resultado.push({
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        producto_id: encontrado?.id || null,
        sugerido,
        imagen_url: imagenUrl
      });
    }

    const subtotal = items.reduce((a, i) => a + i.total, 0);

    return Response.json({ items: resultado, subtotal, cantidad: resultado.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
