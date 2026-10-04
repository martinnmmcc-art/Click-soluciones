// La sesión del administrador guardada en el celular, leída SIN internet.
//
// Supabase guarda la sesión en el celular y la renueva cada hora por
// internet. Sin señal no la puede renovar y responde "no hay sesión": la app
// dejaba de reconocer al administrador (le pedía registrarse, no lo dejaba
// entrar al panel). Pero Supabase solo BORRA la sesión guardada si se cierra
// sesión o si el servidor rechaza la renovación (que necesita internet): si
// sigue guardada, la persona sigue siendo la misma.
//
// Esto decide solo qué se MUESTRA. Lo que se puede hacer en la base lo sigue
// controlando el servidor con sus propias reglas.

function claveSesion() {
  try {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
    return `sb-${ref}-auth-token`;
  } catch (e) {
    return null;
  }
}

export function correoGuardado() {
  if (typeof window === "undefined") return null;
  try {
    const clave = claveSesion();
    const crudo = clave && localStorage.getItem(clave);
    if (!crudo) return null;
    const s = JSON.parse(crudo);
    return s?.user?.email || s?.currentSession?.user?.email || null;
  } catch (e) {
    return null;
  }
}
