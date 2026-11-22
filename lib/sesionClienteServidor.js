// Del lado del servidor: confirma que el código de sesión que manda el
// celular sea de ese teléfono (ver lib/sesionCliente.js).
export async function sesionClienteValida(supabaseAdmin, sesion, telefono) {
  if (!sesion || !/^[0-9a-f-]{36}$/i.test(String(sesion))) return false;
  const { data, error } = await supabaseAdmin.rpc("sesion_cliente_valida", {
    p_token: sesion,
    p_telefono: String(telefono || "")
  });
  return !error && data === true;
}
