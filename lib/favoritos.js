import { supabase } from "@/lib/supabaseClient";

export function obtenerTelefonoCliente() {
  if (typeof window === "undefined") return null;
  try {
    const sesion = JSON.parse(localStorage.getItem("cliente_sesion") || "null");
    return sesion?.telefono || null;
  } catch (e) {
    return null;
  }
}

export async function agregarFavorito(telefono, productoId) {
  return supabase.from("favoritos").insert({ telefono, producto_id: productoId });
}

export async function quitarFavorito(telefono, productoId) {
  return supabase.from("favoritos").delete().eq("telefono", telefono).eq("producto_id", productoId);
}

export async function esFavorito(telefono, productoId) {
  if (!telefono) return false;
  const { data } = await supabase
    .from("favoritos")
    .select("id")
    .eq("telefono", telefono)
    .eq("producto_id", productoId)
    .maybeSingle();
  return !!data;
}

export async function listarFavoritos(telefono) {
  const { data } = await supabase
    .from("favoritos")
    .select("producto_id")
    .eq("telefono", telefono);
  return (data || []).map((f) => f.producto_id);
}
