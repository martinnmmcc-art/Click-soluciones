import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET() {
  try {
    // Traemos todos los items vendidos con su cantidad
    const { data: items, error } = await supabase
      .from("items_pedido")
      .select("producto_id, cantidad");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sumamos cantidades por producto
    const totales = {};
    (items || []).forEach((item) => {
      if (!item.producto_id) return;
      totales[item.producto_id] = (totales[item.producto_id] || 0) + Number(item.cantidad || 0);
    });

    const idsOrdenados = Object.entries(totales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    if (idsOrdenados.length === 0) {
      return NextResponse.json({ productos: [] });
    }

    const { data: productos, error: prodError } = await supabase
      .from("Productos")
      .select("*")
      .in("id", idsOrdenados)
      .eq("activo", true)
      .or("bajo_pedido.is.null,bajo_pedido.eq.false");

    if (prodError) {
      return NextResponse.json({ error: prodError.message }, { status: 500 });
    }

    // Mantenemos el orden de más vendido a menos vendido
    const productosOrdenados = idsOrdenados
      .map((id) => productos.find((p) => String(p.id) === String(id)))
      .filter(Boolean)
      .map((p) => ({ ...p, vendidos: totales[p.id] }));

    return NextResponse.json({ productos: productosOrdenados });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
