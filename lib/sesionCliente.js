// Sesión del cliente guardada en el celular ("cliente_sesion").
//
// Hay dos niveles:
//  - VERIFICADA: trae "sesion", un código secreto que da el servidor solo
//    cuando la cuenta se crea en ese celular, cuando entra con su contraseña
//    o cuando usa un link de acceso. Con ella ve sus pedidos, su saldo y
//    puede cambiar sus datos.
//  - SIMPLE: solo el celular. Alcanza para mirar la tienda y comprar (es lo
//    que pasa cuando alguien que ya tenía cuenta pone su número en otro
//    celular). Para ver pedidos o datos se le pide confirmar que es él.
//
// Antes cualquiera que escribiera un número veía los pedidos de esa persona.

const CLAVE = "cliente_sesion";

export function leerSesion() {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) || "null");
    return s && s.telefono ? s : null;
  } catch (e) {
    return null;
  }
}

export function guardarSesion(datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch (e) {}
}

// Mezcla datos nuevos sin perder el código de sesión
export function actualizarSesion(cambios) {
  const actual = leerSesion() || {};
  guardarSesion({ ...actual, ...cambios });
}

export function tokenSesion() {
  return leerSesion()?.sesion || null;
}

export function sesionVerificada(s = leerSesion()) {
  return !!(s && s.telefono && s.sesion);
}

// Dirección de "mis pedidos" con el código de la sesión
export function urlMisPedidos(telefono) {
  const t = tokenSesion();
  return `/api/mis-pedidos?telefono=${encodeURIComponent(telefono || "")}${t ? `&sesion=${encodeURIComponent(t)}` : ""}`;
}

export function urlSaldoAFavor(telefono) {
  const t = tokenSesion();
  return `/api/saldo-a-favor?telefono=${encodeURIComponent(telefono || "")}${t ? `&sesion=${encodeURIComponent(t)}` : ""}`;
}
