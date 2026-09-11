export const dynamic = "force-dynamic";

// Dice qué está bien y qué falta en el sistema de notificaciones.
// No revela ninguna clave, solo si están presentes y con el formato correcto.
export async function GET() {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privada = process.env.VAPID_PRIVATE_KEY || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // La clave pública VAPID tiene 87 u 88 caracteres y empieza con B
  const publicaValida = publica.length >= 85 && publica.startsWith("B");
  const privadaValida = privada.length >= 40;

  const problemas = [];

  if (!publica) {
    problemas.push(
      "FALTA NEXT_PUBLIC_VAPID_PUBLIC_KEY. Sin esta variable el celular no puede registrarse para recibir avisos."
    );
  } else if (!publicaValida) {
    problemas.push(
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY tiene un formato raro (${publica.length} caracteres, empieza con "${publica[0]}"). Debería tener 87 u 88 y empezar con B.`
    );
  }

  if (!privada) {
    problemas.push("FALTA VAPID_PRIVATE_KEY. Sin esta el servidor no puede enviar avisos.");
  } else if (!privadaValida) {
    problemas.push(`VAPID_PRIVATE_KEY parece incompleta (${privada.length} caracteres).`);
  }

  if (!service) {
    problemas.push("FALTA SUPABASE_SERVICE_ROLE_KEY.");
  }

  return Response.json({
    todo_bien: problemas.length === 0,
    clave_publica: publica ? `${publica.length} caracteres` : "AUSENTE",
    clave_privada: privada ? `${privada.length} caracteres` : "AUSENTE",
    clave_servidor: service ? "presente" : "AUSENTE",
    problemas
  });
}
