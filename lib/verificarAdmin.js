// Verifica que quien llama a una ruta del servidor sea un administrador.
//
// La app manda el token de la sesión en la cabecera Authorization. Con ese
// token le preguntamos a Supabase quién es, y después confirmamos que su
// correo esté en la tabla de administradores. Sin esto, cualquiera que
// conociera la dirección de la ruta podría ejecutarla.

export async function esAdminRequest(request, supabaseAdmin) {
  try {
    const cabecera = request.headers.get("authorization") || "";
    const token = cabecera.replace(/^Bearer\s+/i, "").trim();
    if (!token) return false;

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    const email = data?.user?.email;
    if (error || !email) return false;

    const { data: admin } = await supabaseAdmin
      .from("administradores")
      .select("email")
      .ilike("email", email)
      .maybeSingle();

    return !!admin;
  } catch (e) {
    return false;
  }
}

// Del lado del navegador: arma la cabecera con el token de la sesión actual
export async function cabeceraAdmin(supabase) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}
