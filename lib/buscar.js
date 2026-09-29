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
