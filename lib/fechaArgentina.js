// Fechas en horario de Argentina, para usar en el SERVIDOR.
//
// El servidor (Vercel) funciona en horario universal, 3 horas adelante de
// Argentina. Si se calcula "este mes" o "qué día fue" con su reloj, a las
// 21 hs del último día del mes el servidor ya cree que es el mes siguiente
// (y el panel muestra todo en $0), y una venta de un lunes a las 22 hs
// queda contada como del martes.
//
// Argentina está en UTC-3 todo el año (no tiene horario de verano desde 2009).

const DESFASE_MS = 3 * 60 * 60 * 1000;

// Devuelve una fecha "corrida" para leerla con getUTC*: así se obtienen el
// año, mes, día y día de la semana tal como son en Argentina.
function corrida(fecha = new Date()) {
  return new Date(new Date(fecha).getTime() - DESFASE_MS);
}

// Comienzo y fin de un mes argentino. 0 = el mes actual, -1 = el anterior.
//  - inicio / fin: instantes exactos, para comparar con created_at
//  - fechaInicio / fechaFin: "AAAA-MM-DD", para columnas de tipo fecha
export function rangoMesArgentina(desplazamiento = 0, ahora = new Date()) {
  const a = corrida(ahora);
  const anio = a.getUTCFullYear();
  const mes = a.getUTCMonth() + desplazamiento;

  const comienzo = Date.UTC(anio, mes, 1);
  const siguiente = Date.UTC(anio, mes + 1, 1);

  return {
    inicio: new Date(comienzo + DESFASE_MS),
    fin: new Date(siguiente + DESFASE_MS),
    fechaInicio: new Date(comienzo).toISOString().slice(0, 10),
    fechaFin: new Date(siguiente).toISOString().slice(0, 10)
  };
}

// 0 = domingo ... 6 = sábado, según el día en Argentina
export function diaSemanaArgentina(fecha) {
  return corrida(fecha).getUTCDay();
}

// "AAAA-MM-DD" del día en Argentina
export function fechaArgentina(fecha) {
  return corrida(fecha).toISOString().slice(0, 10);
}

export const ZONA_ARGENTINA = "America/Argentina/Buenos_Aires";
