// Búsqueda de clientes, igual en toda la app.
//
// Antes cada pantalla buscaba a su manera, y había tres errores:
//  1. Al buscar por nombre ("Juan"), se le sacaban las letras para buscar en
//     el teléfono y quedaba un texto vacío. Todo texto "contiene" uno vacío,
//     así que TODOS los clientes coincidían y la lista mostraba cualquiera.
//  2. Los acentos: "Jose" no encontraba a "José".
//  3. Si un registro no tenía nombre o teléfono (una venta de mostrador),
//     la pantalla se rompía al escribir en el buscador.

// Minúsculas y sin acentos: "Núñez" → "nunez"
export function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ¿Este cliente coincide con lo que se escribió?
//  - Por nombre: cada palabra escrita tiene que aparecer ("juan per"
//    encuentra a "Juan Pérez" y a "Pérez, Juan").
//  - Por teléfono: solo si se escribieron al menos 3 números, así una
//    búsqueda por nombre nunca se confunde con una por teléfono.
export function coincideCliente(cliente, busqueda) {
  const q = normalizarTexto(busqueda);
  if (!q) return true;

  const nombre = normalizarTexto(cliente?.nombre ?? cliente?.nombre_cliente);
  const palabras = q.split(/\s+/).filter(Boolean);
  if (palabras.length > 0 && palabras.every((p) => nombre.includes(p))) return true;

  const digitos = String(busqueda || "").replace(/\D/g, "");
  if (digitos.length >= 3) {
    const telefono = String(cliente?.telefono ?? cliente?.telefono_cliente ?? "").replace(/\D/g, "");
    if (telefono.includes(digitos)) return true;
  }

  return false;
}

// Filtra y ordena: primero los que empiezan con lo buscado
export function buscarClientes(lista, busqueda, limite = 20) {
  const q = normalizarTexto(busqueda);
  const resultado = (lista || []).filter((c) => coincideCliente(c, busqueda));

  resultado.sort((a, b) => {
    const na = normalizarTexto(a?.nombre ?? a?.nombre_cliente);
    const nb = normalizarTexto(b?.nombre ?? b?.nombre_cliente);
    const ea = na.startsWith(q) ? 0 : 1;
    const eb = nb.startsWith(q) ? 0 : 1;
    return ea - eb || na.localeCompare(nb);
  });

  return limite ? resultado.slice(0, limite) : resultado;
}

// ---------- BÚSQUEDA DE PRODUCTOS ----------
// Antes se buscaba el texto literal: "unas" no encontraba "Uñas", "uñas
// torno" no encontraba "Torno de Uñas", y "torno" traía también "Contorno de
// ojos". Ahora: palabra por palabra, en cualquier orden, sin tildes, desde el
// comienzo de cada palabra, y "tornos" encuentra "torno".

// Las palabras que se buscan (mismo criterio en la base y en el celular)
export function palabrasDeBusqueda(texto) {
  return normalizarTexto(texto)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2)
    // Plural simple: "tornos" → "torno", "lamparas" → "lampara"
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w))
    .slice(0, 6);
}

// Le agrega la búsqueda a una consulta de Supabase. Usa la columna
// nombre_busqueda (el nombre en minúsculas y sin tildes, la calcula la base).
// "\m" = comienzo de palabra.
export function aplicarBusqueda(consulta, texto) {
  let q = consulta;
  for (const w of palabrasDeBusqueda(texto)) {
    q = q.filter("nombre_busqueda", "imatch", "\\m" + w);
  }
  return q;
}

// La misma búsqueda, sobre una lista guardada en el celular (sin señal)
export function coincideBusqueda(nombre, texto) {
  const palabras = palabrasDeBusqueda(texto);
  if (!palabras.length) return true;
  const n = " " + normalizarTexto(nombre).replace(/[^a-z0-9]+/g, " ");
  return palabras.every((w) => n.includes(" " + w));
}
