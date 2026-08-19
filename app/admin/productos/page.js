"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";
import { nombreCategoria } from "@/lib/categorias";

function ListaProductos() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtro = searchParams.get("filtro"); // "sin-stock" | null
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [duplicandoId, setDuplicandoId] = useState(null);
  const [exportando, setExportando] = useState(false);
  const tabInicial = searchParams.get("tab") === "a-pedido" ? "a-pedido" : "tengo";
  const [tab, setTab] = useState(tabInicial); // "tengo" | "a-pedido"
  const [busqueda, setBusqueda] = useState("");
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [totalTab, setTotalTab] = useState(0);

  const POR_TANDA = 100;
  const [conteos, setConteos] = useState({ tengo: 0, aPedido: 0 });

  // Consulta filtrada en la base. Con casi 3000 productos no se pueden
  // traer todos juntos: Supabase corta en 1000 filas y quedaban productos
  // invisibles (por ejemplo, los propios, que son los más antiguos).
  function consultaBase() {
    let q = supabase.from("Productos").select("*", { count: "exact" });

    if (tab === "tengo") {
      q = q.or("bajo_pedido.is.null,bajo_pedido.eq.false");
    } else {
      q = q.eq("bajo_pedido", true);
    }

    if (busqueda.trim().length >= 2) {
      q = q.ilike("nombre", `%${busqueda.trim()}%`);
    }

    return q.order("created_at", { ascending: false });
  }

  async function cargarProductos() {
    setLoading(true);
    const { data, error, count } = await consultaBase().range(0, POR_TANDA - 1);

    if (error) console.error(error.message);
    setProductos(data || []);
    setTotalTab(count || 0);
    setHayMas((data?.length || 0) === POR_TANDA);
    setLoading(false);
  }

  async function cargarMas() {
    setCargandoMas(true);
    const desde = productos.length;
    const { data } = await consultaBase().range(desde, desde + POR_TANDA - 1);
    setProductos((prev) => [...prev, ...(data || [])]);
    setHayMas((data?.length || 0) === POR_TANDA);
    setCargandoMas(false);
  }

  useEffect(() => {
    const t = setTimeout(cargarProductos, busqueda ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, busqueda]);

  // Cuántos productos hay de cada tipo, para mostrar en las pestañas
  useEffect(() => {
    async function contar() {
      const [tengo, aPedido] = await Promise.all([
        supabase
          .from("Productos")
          .select("id", { count: "exact", head: true })
          .or("bajo_pedido.is.null,bajo_pedido.eq.false"),
        supabase
          .from("Productos")
          .select("id", { count: "exact", head: true })
          .eq("bajo_pedido", true)
      ]);
      setConteos({ tengo: tengo.count || 0, aPedido: aPedido.count || 0 });
    }
    contar();
  }, []);

  async function handleEliminar(id) {
    if (!confirm("¿Seguro que querés eliminar este producto?")) return;
    const { error } = await supabase.from("Productos").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    setProductos((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleDuplicar(producto) {
    setDuplicandoId(producto.id);
    try {
      const copia = { ...producto };
      delete copia.id;
      delete copia.created_at;
      copia.nombre = `${producto.nombre} (copia)`;
      copia.stock = 0;

      const { data, error } = await supabase.from("Productos").insert(copia).select().single();
      if (error) throw new Error(error.message);

      router.push(`/admin/productos/${data.id}`);
    } catch (e) {
      alert("No se pudo duplicar: " + e.message);
    } finally {
      setDuplicandoId(null);
    }
  }

  async function handleExportar() {
    setExportando(true);
    try {
      const XLSX = await import("xlsx");
      const filas = productos.map((p) => ({
        ID: p.id,
        Nombre: p.nombre,
        Categoría: nombreCategoria(p.categoria),
        Precio: p.precio,
        "Precio Oferta": p.precio_oferta || "",
        Costo: p.costo || "",
        Stock: p.stock ?? "",
        "A pedido": p.bajo_pedido ? "Sí" : "No",
        Activo: p.activo ? "Sí" : "No",
        Destacado: p.destacado ? "Sí" : "No"
      }));

      const hoja = XLSX.utils.json_to_sheet(filas);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Productos");
      XLSX.writeFile(libro, `productos-bolson-click-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      alert("No se pudo exportar: " + e.message);
    } finally {
      setExportando(false);
    }
  }

  const conStockBajo = productos.filter(
    (p) => !p.bajo_pedido && Number(p.stock || 0) <= Number(p.stock_minimo ?? 3)
  ).length;

  const productosMostrados =
    filtro === "sin-stock"
      ? productos.filter((p) => !p.bajo_pedido && p.stock !== null && Number(p.stock) <= 0)
      : productos;

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="container-app px-4 py-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <Link href="/admin" className="text-sm text-brand-blue font-medium">
              ← Panel
            </Link>
            <h1 className="font-extrabold text-xl text-gray-800 mt-1">
              Productos
            </h1>
          </div>
          <Link href="/admin/productos/nuevo" className="btn-primary">
            + Nuevo
          </Link>
        </div>

        {/* PESTAÑAS */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setTab("tengo")}
            className={`py-3 rounded-xl text-sm font-bold transition ${
              tab === "tengo" ? "bg-brand-blue text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            📦 Tengo {conteos.tengo > 0 && `(${conteos.tengo})`}
          </button>
          <button
            onClick={() => setTab("a-pedido")}
            className={`py-3 rounded-xl text-sm font-bold transition ${
              tab === "a-pedido" ? "bg-purple-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            🛍️ A pedido {conteos.aPedido > 0 && `(${conteos.aPedido})`}
          </button>
        </div>

        {tab === "tengo" && (
          <>
            <Link
              href="/admin/pedido-proveedor"
              className="flex items-center justify-between bg-orange-50 border border-orange-200 text-orange-700 rounded-xl px-4 py-3 mb-3 font-semibold text-sm"
            >
              📋 Pedido a proveedor
              {conStockBajo > 0 && (
                <span className="bg-orange-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {conStockBajo} con stock bajo
                </span>
              )}
            </Link>

            <button
              onClick={handleExportar}
              disabled={exportando || productos.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 mb-5 font-semibold text-sm disabled:opacity-50"
            >
              📊 {exportando ? "Generando..." : "Exportar catálogo a Excel"}
            </button>
          </>
        )}

        {tab === "a-pedido" && (
          <p className="text-xs text-gray-500 mb-4">
            Estos productos aparecen en la sección pública "A pedido" de la app, separados del catálogo normal.
            Si les cargás stock (más de 0), se pasan solos a la pestaña "Tengo".
          </p>
        )}

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 mb-3"
          placeholder={`Buscar entre ${totalTab} productos...`}
        />

        {filtro === "sin-stock" && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 mb-4 text-sm font-semibold">
            <span>Mostrando solo productos sin stock ({productosMostrados.length})</span>
            <Link href="/admin/productos" className="underline text-xs">
              Ver todos
            </Link>
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : productosMostrados.length === 0 ? (
          <div className="card p-6 text-center text-gray-500">
            {filtro === "sin-stock"
              ? "No tenés productos sin stock 🎉"
              : tab === "a-pedido"
              ? "Todavía no cargaste productos a pedido."
              : "Todavía no hay productos cargados."}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {productosMostrados.map((p) => {
              const stockBajo = !p.bajo_pedido && Number(p.stock || 0) <= Number(p.stock_minimo ?? 3);
              return (
                <div key={p.id} className="card p-3 flex gap-3 items-center">
                  <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {p.imagen_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imagen_url}
                        alt={p.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl">📦</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">
                      {p.nombre}
                    </p>
                    <p className="text-xs text-gray-500">
                      {nombreCategoria(p.categoria)}
                      {!p.bajo_pedido && (
                        <>
                          {" · "}
                          <span className={stockBajo ? "text-orange-600 font-bold" : ""}>
                            Stock: {p.stock}
                            {stockBajo && " ⚠️"}
                          </span>
                        </>
                      )}
                      {!p.activo && " · Inactivo"}
                    </p>
                    <p className="text-brand-blueDark font-bold text-sm mt-0.5">
                      ${formatPrice(p.precio_oferta || p.precio)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Link
                      href={`/admin/productos/${p.id}`}
                      className="text-xs font-semibold text-brand-blue"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => handleDuplicar(p)}
                      disabled={duplicandoId === p.id}
                      className="text-xs font-semibold text-gray-500 disabled:opacity-50"
                    >
                      {duplicandoId === p.id ? "Duplicando..." : "Duplicar"}
                    </button>
                    <button
                      onClick={() => handleEliminar(p.id)}
                      className="text-xs font-semibold text-red-500"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}

            {hayMas && !filtro && (
              <button
                onClick={cargarMas}
                disabled={cargandoMas}
                className="w-full bg-white border border-gray-200 text-gray-700 text-sm font-bold py-3 rounded-xl mt-3 disabled:opacity-50"
              >
                {cargandoMas
                  ? "Cargando..."
                  : `Ver más (${productos.length} de ${totalTab})`}
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function AdminProductosPage() {
  return (
    <AdminGuard>
      <Suspense fallback={<div className="text-center text-gray-400 py-16">Cargando...</div>}>
        <ListaProductos />
      </Suspense>
    </AdminGuard>
  );
}
