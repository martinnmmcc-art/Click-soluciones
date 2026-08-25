"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";

function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [excluidas, setExcluidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [borrando, setBorrando] = useState(null);

  async function cargar() {
    setLoading(true);

    // Contamos productos por categoría, separando los tuyos de los del proveedor
    const TANDA = 1000;
    let todos = [];
    let desde = 0;

    while (true) {
      const { data } = await supabase
        .from("Productos")
        .select("categoria, bajo_pedido")
        .range(desde, desde + TANDA - 1);

      const tanda = data || [];
      todos = todos.concat(tanda);
      if (tanda.length < TANDA) break;
      desde += TANDA;
      if (desde > 20000) break;
    }

    const conteo = {};
    todos.forEach((p) => {
      const cat = p.categoria || "Sin categoría";
      if (!conteo[cat]) conteo[cat] = { nombre: cat, aPedido: 0, propios: 0 };
      if (p.bajo_pedido) conteo[cat].aPedido += 1;
      else conteo[cat].propios += 1;
    });

    const lista = Object.values(conteo).sort(
      (a, b) => b.aPedido + b.propios - (a.aPedido + a.propios)
    );

    const { data: exc } = await supabase.from("categorias_excluidas").select("*");

    setCategorias(lista);
    setExcluidas(exc || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function eliminar(cat) {
    const texto =
      `¿Eliminar la categoría "${cat.nombre}"?\n\n` +
      `Se van a borrar ${cat.aPedido} productos a pedido.\n` +
      (cat.propios > 0
        ? `\n✓ Tus ${cat.propios} productos propios NO se tocan.\n`
        : "") +
      `\nTampoco se borran los que ya vendiste alguna vez.\n\n` +
      `La categoría queda excluida: no vuelve al importar del proveedor.`;

    if (!confirm(texto)) return;

    setBorrando(cat.nombre);
    try {
      const { data, error } = await supabase.rpc("eliminar_categoria_a_pedido", {
        p_categoria: cat.nombre,
        p_excluir_a_futuro: true
      });

      if (error) throw new Error(error.message);

      const r = data?.[0];
      alert(
        `Listo:\n\n` +
          `• ${r?.eliminados || 0} productos eliminados\n` +
          (r?.propios_conservados > 0
            ? `• ${r.propios_conservados} productos tuyos conservados\n`
            : "") +
          (r?.vendidos_conservados > 0
            ? `• ${r.vendidos_conservados} conservados porque ya se vendieron\n`
            : "")
      );

      cargar();
    } catch (e) {
      alert("No se pudo eliminar: " + e.message);
    } finally {
      setBorrando(null);
    }
  }

  async function volverAPermitir(categoria) {
    if (!confirm(`¿Volver a permitir "${categoria}"?\n\nLos productos van a reaparecer la próxima vez que importes del proveedor.`))
      return;

    const { error } = await supabase
      .from("categorias_excluidas")
      .delete()
      .eq("categoria", categoria);

    if (error) {
      alert("No se pudo: " + error.message);
      return;
    }
    cargar();
  }

  const clavesExcluidas = new Set(excluidas.map((e) => e.categoria));

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">Categorías</h1>
        <p className="text-xs text-gray-500 mb-4">
          Sacá de la tienda las categorías del proveedor que no querés vender.
        </p>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : (
          <>
            <div className="space-y-2">
              {categorias.map((c) => (
                <div
                  key={c.nombre}
                  className="bg-white rounded-2xl border border-gray-100 p-4"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-800">{c.nombre}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {c.aPedido > 0 && (
                          <span className="text-purple-700">{c.aPedido} a pedido</span>
                        )}
                        {c.aPedido > 0 && c.propios > 0 && " · "}
                        {c.propios > 0 && (
                          <span className="text-green-700 font-semibold">
                            {c.propios} tuyos
                          </span>
                        )}
                      </p>
                    </div>

                    {c.aPedido > 0 ? (
                      <button
                        onClick={() => eliminar(c)}
                        disabled={borrando === c.nombre}
                        className="text-xs font-bold text-red-600 border border-red-200 px-3 py-1.5 rounded-xl whitespace-nowrap disabled:opacity-50"
                      >
                        {borrando === c.nombre ? "Borrando..." : "🗑️ Eliminar"}
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        Solo productos tuyos
                      </span>
                    )}
                  </div>

                  {c.propios > 0 && c.aPedido > 0 && (
                    <p className="text-[10px] text-green-700 bg-green-50 rounded-lg px-2 py-1 mt-2">
                      ✓ Al eliminar, tus {c.propios} productos se conservan
                    </p>
                  )}
                </div>
              ))}
            </div>

            {excluidas.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mt-6">
                <p className="font-bold text-sm text-gray-800 mb-1">
                  Categorías excluidas
                </p>
                <p className="text-[11px] text-gray-500 mb-3">
                  No vuelven a aparecer al importar del proveedor.
                </p>

                <div className="space-y-2">
                  {excluidas.map((e) => (
                    <div
                      key={e.categoria}
                      className="flex justify-between items-center text-xs border border-gray-100 rounded-lg p-2"
                    >
                      <span className="text-gray-700">{e.categoria}</span>
                      <button
                        onClick={() => volverAPermitir(e.categoria)}
                        className="text-brand-blue font-semibold text-[11px]"
                      >
                        Volver a permitir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 mt-6">
          <p className="text-xs font-bold text-gray-700 mb-1">Qué pasa al eliminar</p>
          <ul className="text-[11px] text-gray-600 space-y-1 list-disc pl-4">
            <li>Se borran solo los productos <b>a pedido</b> del proveedor.</li>
            <li>Tus productos propios <b>nunca se tocan</b>, aunque estén en esa categoría.</li>
            <li>Los que ya vendiste se conservan, para no romper el historial de ventas.</li>
            <li>La categoría queda excluida y no vuelve al importar de nuevo.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

export default function CategoriasPage() {
  return (
    <AdminGuard>
      <Categorias />
    </AdminGuard>
  );
}
