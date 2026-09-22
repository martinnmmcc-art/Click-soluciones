// Opiniones sobre la tienda (la compra, la atención, la entrega, la app).
// Las de cada producto son otra cosa: están en components/ResenasProducto.

export const ASPECTOS = [
  { clave: "atencion", etiqueta: "😊 Atención" },
  { clave: "entrega", etiqueta: "🚚 Rapidez de entrega" },
  { clave: "precios", etiqueta: "💲 Precios" },
  { clave: "calidad", etiqueta: "📦 Calidad de los productos" },
  { clave: "app", etiqueta: "📱 La app" }
];

export function etiquetaAspecto(clave) {
  return ASPECTOS.find((a) => a.clave === clave)?.etiqueta || clave;
}

export const TEXTO_ESTRELLAS = {
  1: "Muy mala",
  2: "Mala",
  3: "Normal",
  4: "Buena",
  5: "¡Excelente!"
};

export function sesionCliente() {
  try {
    return JSON.parse(localStorage.getItem("cliente_sesion") || "null");
  } catch (e) {
    return null;
  }
}

// Recuerda en el celular que ya opinó, para no volver a pedírselo
const CLAVE_YA_OPINO = "bolsonclick_opino_tienda";

export function marcarQueOpino() {
  try {
    localStorage.setItem(CLAVE_YA_OPINO, new Date().toISOString());
  } catch (e) {}
}

export function yaOpinoEnEsteCelular() {
  try {
    return !!localStorage.getItem(CLAVE_YA_OPINO);
  } catch (e) {
    return false;
  }
}
