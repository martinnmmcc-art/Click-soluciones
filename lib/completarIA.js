// Completar un producto con IA (Gemini de Google), SIN inventar.
//
// Qué hace:
//  1. Mira las fotos del producto (en la caja suelen venir modelo, watts,
//     medidas, batería y qué trae) y lee el nombre y el texto del proveedor.
//  2. Busca en Google ese modelo exacto.
//  3. Devuelve un BORRADOR: descripción, características y qué incluye.
//     Cada dato dice de dónde salió (caja, proveedor o internet) y si es
//     seguro. Nada se guarda solo: lo revisa el admin en el formulario.
//
// Se usa solo desde el servidor (app/api/admin/completar-ia), porque la clave
// de Gemini no puede llegar al navegador.

const URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
// Si el modelo configurado no existe (Google los renombra), prueba el siguiente.
// Los "lite" responden en menos de un segundo y alcanzan para leer una caja;
// los 2.5 ya no se dan a cuentas nuevas (diagnóstico del 22/11/2026).
const MODELOS_RESPALDO = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.8-flash"];
const MAX_FOTOS = 4;
const LADO_FOTO = 1024;

export const FUENTES = ["caja", "proveedor", "internet"];

function instrucciones({ nombre, nombreProveedor, textoProveedor, categoria, descripcionActual }) {
  return `Sos el redactor de fichas de producto de "Bolson Click", una tienda online de productos para el hogar de El Bolsón (Río Negro, Argentina). Escribís en español de Argentina, con voseo, claro y con gancho, sin exagerar.

PRODUCTO A COMPLETAR
- Nombre en la tienda: ${nombre || "(sin nombre)"}
- Nombre del proveedor: ${nombreProveedor || "(no hay)"}
- Categoría: ${categoria || "(sin categoría)"}
- Texto del proveedor: ${textoProveedor || "(el proveedor no da descripción)"}
- Descripción actual en la tienda: ${descripcionActual || "(vacía)"}
- Te adjunto las fotos del producto (pueden incluir la caja).

TU TRABAJO
1. Mirá las fotos con atención: leé TODO el texto de la caja o del producto (modelo, marca, potencia, voltaje, batería, medidas, peso, material, iconos de funciones, contenido de la caja).
2. Si tenés la herramienta de búsqueda, buscá en Google el modelo exacto (por ejemplo el código de la caja). Usá SOLO resultados que sean claramente ESE mismo producto (mismo modelo y misma apariencia). Si no estás seguro de que sea el mismo, no uses ese dato. Si no tenés búsqueda, trabajá solo con las fotos y el texto del proveedor (no uses lo que "sabés" de memoria sobre productos parecidos).
3. Armá el borrador.

REGLAS QUE NO SE PUEDEN ROMPER
- No inventes nada. Si un dato no está en las fotos, en el texto del proveedor o en una fuente confiable del mismo modelo, NO lo pongas.
- Cada característica lleva su fuente: "caja" (leído en la foto), "proveedor" (dicho en el texto del proveedor) o "internet" (encontrado en una búsqueda; poné la URL).
- "seguro": true solo si el dato se lee claro o coincide en dos fuentes. Si lo dedujiste, si la foto se ve borrosa o si una sola página lo dice: false.
- Si las fotos y el texto del proveedor se contradicen, avisalo en "advertencias".
- No menciones al proveedor ni a otras tiendas. La marca del producto sí, si se ve en la caja.
- No prometas garantías, envíos gratis, tiempos de entrega ni certificaciones que no estén en la caja.
- No uses mayúsculas sostenidas ni más de un emoji por línea.

FICHA TÉCNICA (lo más importante: "caracteristicas")
- Cada característica es un dato técnico con el formato "Etiqueta: valor", por ejemplo "Medidas: 35 x 44 cm", "Potencia: 30 W", "Voltaje: 220 V", "Batería: 1200 mAh", "Capacidad: 40 L", "Material: polipropileno", "Peso: 450 g", "Autonomía: 6 h", "Conexión: USB tipo C".
- Buscá especialmente: medidas, potencia, voltaje, batería y autonomía, capacidad, material, peso, colores, tipo de carga o conexión, modos o niveles.
- Copiá los números y unidades tal como aparecen; no conviertas ni redondees. Si dos fuentes dan números distintos, poné el de la caja y avisalo en "advertencias".
- Los códigos del nombre del proveedor (por ejemplo "CD28631") suelen ser el código del producto: usalos para buscar.
- Mejor 3 datos ciertos que 10 dudosos.

FORMATO DE LA DESCRIPCIÓN (como las demás de la tienda)
- Primera línea: una frase corta con gancho sobre el beneficio principal (se ve en la tarjeta del catálogo).
- Después 3 a 6 líneas que empiecen con "• ", cada una con un beneficio o uso concreto y verdadero.
- Última línea exacta: "📦 Entrega en la Comarca Andina y envíos a todo el país."

RESPONDÉ SOLO CON ESTE JSON (sin texto antes ni después, sin \`\`\`):
{
  "modelo_detectado": "código o modelo leído, o null",
  "marca_detectada": "marca leída en la caja, o null",
  "es_el_mismo_producto": true,
  "descripcion": "texto con saltos de línea \\n",
  "caracteristicas": [
    { "texto": "Medidas: 35 x 44 cm", "fuente": "proveedor", "url": null, "seguro": true }
  ],
  "incluye": [
    { "texto": "Cable USB tipo C", "fuente": "caja", "url": null, "seguro": true }
  ],
  "advertencias": ["cosas que el admin tiene que revisar"]
}
"es_el_mismo_producto" va en false si no pudiste confirmar en internet que la información encontrada sea de este mismo modelo (en ese caso no pongas datos de fuente "internet").`;
}

// Trae una foto y la deja en JPG de hasta 1024 px (menos datos para la IA)
async function fotoParaIA(url, fetchFn) {
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") || "";
    if (!tipo.startsWith("image/") || tipo.includes("svg")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    let salida = bytes;
    try {
      const sharp = (await import("sharp")).default;
      salida = await sharp(bytes)
        .resize(LADO_FOTO, LADO_FOTO, { fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch (e) {
      // Sin sharp, se manda como vino si es un formato que Gemini entiende
      if (!/jpeg|png|webp/.test(tipo)) return null;
      return { inline_data: { mime_type: tipo.split(";")[0], data: bytes.toString("base64") } };
    }
    return { inline_data: { mime_type: "image/jpeg", data: salida.toString("base64") } };
  } catch (e) {
    return null;
  }
}

// Saca el JSON de la respuesta aunque venga con texto o ``` alrededor
export function extraerJSON(texto) {
  if (!texto) throw new Error("La IA no respondió nada");
  const limpio = texto.replace(/```(?:json)?/gi, "");
  const ini = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (ini < 0 || fin <= ini) throw new Error("La IA no respondió en el formato esperado");
  return JSON.parse(limpio.slice(ini, fin + 1));
}

function limpiarItems(lista, fuentesWeb) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((x) => {
      if (typeof x === "string") x = { texto: x };
      const texto = String(x?.texto || "").trim();
      if (!texto) return null;
      const fuente = FUENTES.includes(x?.fuente) ? x.fuente : "internet";
      let url = typeof x?.url === "string" && /^https?:\/\//.test(x.url) ? x.url : null;
      // Un dato "de internet" sin link no se puede revisar: queda como dudoso
      const seguro = !!x?.seguro && !(fuente === "internet" && !url && fuentesWeb.length === 0);
      return { texto: texto.slice(0, 200), fuente, url, seguro };
    })
    .filter(Boolean)
    .slice(0, 25);
}

// Deja la respuesta prolija y sin sorpresas para la pantalla
export function normalizarBorrador(crudo, fuentesWeb = []) {
  const mismo = crudo?.es_el_mismo_producto !== false;
  let caracteristicas = limpiarItems(crudo?.caracteristicas, fuentesWeb);
  let incluye = limpiarItems(crudo?.incluye, fuentesWeb);
  const advertencias = (Array.isArray(crudo?.advertencias) ? crudo.advertencias : [])
    .map((a) => String(a || "").trim())
    .filter(Boolean)
    .slice(0, 10);

  // Si no confirmó que lo de internet sea este mismo modelo, eso se descarta
  if (!mismo) {
    const antes = caracteristicas.length + incluye.length;
    caracteristicas = caracteristicas.filter((c) => c.fuente !== "internet");
    incluye = incluye.filter((c) => c.fuente !== "internet");
    if (caracteristicas.length + incluye.length < antes) {
      advertencias.unshift("Se descartaron datos de internet porque no se pudo confirmar que fueran de este mismo modelo.");
    }
  }

  return {
    modelo: crudo?.modelo_detectado ? String(crudo.modelo_detectado).slice(0, 80) : null,
    marca: crudo?.marca_detectada ? String(crudo.marca_detectada).slice(0, 60) : null,
    mismoProducto: mismo,
    descripcion: String(crudo?.descripcion || "").trim().slice(0, 2000),
    caracteristicas,
    incluye,
    advertencias,
    fuentesWeb
  };
}

// Las páginas que Google usó para la búsqueda
function fuentesDeBusqueda(candidato) {
  const chunks = candidato?.groundingMetadata?.groundingChunks || [];
  const vistas = new Set();
  const lista = [];
  for (const c of chunks) {
    const uri = c?.web?.uri;
    if (!uri || vistas.has(uri)) continue;
    vistas.add(uri);
    lista.push({ url: uri, titulo: c?.web?.title || uri });
  }
  return lista.slice(0, 10);
}

async function llamarGemini({ clave, modelo, cuerpo, fetchFn, espera }) {
  // Los modelos 2.5 "piensan" antes de responder: con un tope chico de
  // pensamiento responde en segundos y alcanza para leer una caja.
  const final = /^gemini-2\.5/.test(modelo)
    ? { ...cuerpo, generationConfig: { ...cuerpo.generationConfig, thinkingConfig: { thinkingBudget: 512 } } }
    : cuerpo;
  const res = await fetchFn(`${URL_GEMINI}/${modelo}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
    body: JSON.stringify(final),
    signal: AbortSignal.timeout(espera)
  });
  const datos = await res.json().catch(() => ({}));
  return { ok: res.ok, estado: res.status, datos };
}

// La búsqueda en Google no está en el uso gratis de Gemini: si Google la
// rechaza, se sigue sin buscar (solo fotos + texto del proveedor) y se
// recuerda un rato para no gastar un pedido de más cada vez.
let sinBusquedaHasta = 0;
const SEIS_HORAS = 6 * 60 * 60 * 1000;

function rechazoDeBusqueda(r) {
  const msg = String(r.datos?.error?.message || "");
  return r.estado === 429 || (r.estado === 400 && /search|ground|tool/i.test(msg)) || (r.estado === 403 && /search|ground/i.test(msg));
}

export async function completarConIA(producto, { clave, modelo, fetchFn = fetch, buscar = true, espera = 45000 } = {}) {
  if (!clave) {
    const e = new Error("Falta la clave de Gemini (GEMINI_API_KEY) en Vercel.");
    e.codigo = "SIN_CLAVE";
    throw e;
  }

  const urls = [
    producto.imagen_url,
    producto.imagen_url_2,
    producto.imagen_url_3,
    producto.imagen_url_4,
    producto.imagen_url_5,
    producto.imagen_url_6
  ]
    .filter(Boolean)
    .slice(0, MAX_FOTOS);
  const fotos = (await Promise.all(urls.map((u) => fotoParaIA(u, fetchFn)))).filter(Boolean);

  const cuerpo = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: instrucciones({
              nombre: producto.nombre,
              nombreProveedor: producto.nombre_proveedor,
              textoProveedor: producto.descripcion_proveedor,
              categoria: producto.categoria,
              descripcionActual: producto.descripcion
            })
          },
          ...fotos
        ]
      }
    ],
    generationConfig: { temperature: 0.2 }
  };
  let conBusqueda = buscar && Date.now() > sinBusquedaHasta;

  const modelos = [...new Set([modelo, ...MODELOS_RESPALDO].filter(Boolean))];
  let ultimo = null;
  for (const m of modelos) {
    let r = await llamarGemini({
      clave,
      modelo: m,
      cuerpo: conBusqueda ? { ...cuerpo, tools: [{ google_search: {} }] } : cuerpo,
      fetchFn,
      espera
    });
    if (conBusqueda && rechazoDeBusqueda(r)) {
      // Sin búsqueda en el plan: mismo pedido, sin buscar
      sinBusquedaHasta = Date.now() + SEIS_HORAS;
      conBusqueda = false;
      r = await llamarGemini({ clave, modelo: m, cuerpo, fetchFn, espera });
    }
    if (r.estado === 404) {
      ultimo = r;
      continue;
    }
    if (!r.ok) {
      const msg = r.datos?.error?.message || `Gemini respondió ${r.estado}`;
      console.error("[completar-ia]", m, r.estado, msg.slice(0, 300));
      const e = new Error(
        r.estado === 429
          ? "Se terminó el uso gratis de Gemini por ahora (por minuto o por día). Probá más tarde."
          : r.estado === 400 && /API key/i.test(msg)
          ? "La clave de Gemini no es válida. Revisala en Vercel."
          : msg
      );
      e.codigo = r.estado === 429 ? "LIMITE" : "GEMINI";
      throw e;
    }
    const candidato = r.datos?.candidates?.[0];
    const texto = (candidato?.content?.parts || []).map((p) => p.text || "").join("");
    const crudo = extraerJSON(texto);
    const borrador = normalizarBorrador(crudo, fuentesDeBusqueda(candidato));
    if (!conBusqueda) {
      // Sin búsqueda no puede haber datos "de internet": serían de memoria
      borrador.caracteristicas = borrador.caracteristicas.filter((c) => c.fuente !== "internet");
      borrador.incluye = borrador.incluye.filter((c) => c.fuente !== "internet");
    }
    return { ...borrador, fotosLeidas: fotos.length, modeloIA: m, conBusqueda };
  }
  const e = new Error(ultimo?.datos?.error?.message || "No se encontró un modelo de Gemini disponible");
  e.codigo = "GEMINI";
  throw e;
}

// Solo lo seguro, en el formato de la ficha ("• Etiqueta: valor"). Es lo que
// el modo automático publica sin que nadie lo revise.
export function lineasSeguras(items) {
  return (items || [])
    .filter((it) => it.seguro && (it.fuente === "caja" || it.fuente === "proveedor" || (it.fuente === "internet" && it.url)))
    .map((it) => `• ${it.texto}`)
    .join("\n");
}
