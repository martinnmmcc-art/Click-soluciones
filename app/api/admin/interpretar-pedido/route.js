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
// Solo vincula automáticamente a un producto que ya tenés cuando hay
// coincidencia exacta o el mismo código del proveedor. Con familias de
// productos parecidos (varios "Reflector...", varios "Cesto de Ropa...")
// adivinar cuál es cuál puede terminar actualizando el producto equivocado
// al recibir el pedido. Ante la duda, no vincula: lo marca para que el
// admin decida a mano.

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
    .replace(/×/g, "x") // el símbolo de multiplicación y la letra "x" se
                         // usan indistintamente entre el proveedor y lo
                         // que ya tenemos guardado (ej: "60×200cm" vs "60x200cm")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// El código del proveedor suele ser el último token con letras y números
// mezclados (MELECH-721, WMA-087, CD29203/CD29191). Es lo más específico
// del nombre y lo que realmente distingue una variante de otra.
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
      const normItem = normalizar(item.nombre);
      const codigoItem = extraerCodigo(item.nombre);
      const primeraPalabra = normItem.split(" ")[0];

      // Traemos candidatos con un filtro amplio (por la primera palabra),
      // y la decisión de si vincular o no la tomamos acá, no en la base.
      const { data: candidatos } = await supabase
        .from("Productos")
        .select("id, nombre, nombre_proveedor, imagen_url")
        .ilike("nombre_proveedor", `%${primeraPalabra}%`)
        .limit(15);

      let encontrado = null;
      let sugerido = null;

      for (const c of candidatos || []) {
        const normCand = normalizar(c.nombre_proveedor || c.nombre);

        // Coincidencia exacta del nombre completo del proveedor
        if (normCand === normItem) {
          encontrado = c;
          break;
        }

        // Mismo código de proveedor: es lo que distingue variantes
        // idénticas en nombre (dos "Reflector Lampara Solar..." con
        // distinto código son productos distintos aunque se llamen igual)
        if (codigoItem && normCand.includes(codigoItem)) {
          encontrado = c;
          break;
        }
      }

      // Sin coincidencia exacta pero con candidatos parecidos: lo dejamos
      // como sugerencia para que el admin confirme, sin vincular solo
      if (!encontrado && candidatos?.length > 0) {
        const parecido = candidatos.find((c) => {
          const normCand = normalizar(c.nombre_proveedor || c.nombre);
          const palabrasItem = normItem.split(" ").slice(0, 3).join(" ");
          const palabrasCand = normCand.split(" ").slice(0, 3).join(" ");
          return palabrasItem === palabrasCand;
        });
        if (parecido) {
          sugerido = { id: parecido.id, nombre: parecido.nombre };
        }
      }

      let imagenUrl = encontrado?.imagen_url || null;

      if (!imagenUrl) {
        try {
          const q = encodeURIComponent(item.nombre.split(" ").slice(0, 4).join(" "));
          const res = await fetch(
            `https://nextcell.com.ar/wp-json/wc/store/v1/products?search=${q}&per_page=3`,
            { signal: AbortSignal.timeout(6000) }
          );
          if (res.ok) {
            const datos = await res.json();
            if (datos?.[0]?.images?.[0]?.src) {
              imagenUrl = datos[0].images[0].src;
            }
          }
        } catch (e) {
          // Sin foto no es grave: se puede cargar después a mano
        }
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
