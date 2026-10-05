"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { useRecordarPosicion, useRestaurarAlDibujar } from "@/lib/useRecordarPosicion";
import { formatPrice } from "@/lib/whatsapp";
import { nombreCategoria } from "@/lib/categorias";
import { useActualizarSolo } from "@/lib/datosFrescos";
import { leerProductosPropiosOffline } from "@/lib/catalogoOffline";
import { normalizarTexto, aplicarBusqueda } from "@/lib/buscar";
import { textoRespuesta } from "@/lib/respuestaPrecio";

// Filtros rápidos de la lista. Los de stock solo aplican a "Tengo".
const FILTROS = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "con-stock", etiqueta: "✅ Con stock", soloTengo: true },
  { valor: "sin-stock", etiqueta: "❌ Sin stock", soloTengo: true },
  { valor: "stock-bajo", etiqueta: "⚠️ Stock bajo", soloTengo: true },
  { valor: "inactivos", etiqueta: "🚫 Inactivos" }
];

// Formas de ordenar la lista (se ordena en la base, no solo lo cargado)
const ORDENES = [
  { valor: "nuevos", etiqueta: "Más nuevos primero", campo: "created_at", asc: false },
  { valor: "modificados", etiqueta: "Modificados recientemente", campo: "actualizado_en", asc: false },
  { valor: "precio-alto", etiqueta: "Precio: mayor a menor", campo: "precio", asc: false },
  { valor: "precio-bajo", etiqueta: "Precio: menor a mayor", campo: "precio", asc: true },
  { valor: "mas-stock", etiqueta: "Más stock primero", campo: "stock", asc: false },
  { valor: "menos-stock", etiqueta: "Menos stock primero", campo: "stock", asc: true },
  { valor: "nombre", etiqueta: "Nombre A-Z", campo: "nombre", asc: true },
  { valor: "viejos", etiqueta: "Más viejos primero", campo: "created_at", asc: true }
];

const CLAVE_FILTROS = "admin-productos-filtros";

function leerFiltros() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_FILTROS) || "{}");
  } catch {
    return {};
  }
}

function formatearFecha(iso) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function ListaProductos() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [duplicandoId, setDuplicandoId] = useState(null);
  const [exportando, setExportando] = useState(false);
  const tabInicial = searchParams.get("tab") === "a-pedido" ? "a-pedido" : "tengo";
  const [tab, setTab] = useState(tabInicial); // "tengo" | "a-pedido"
  const [busqueda, setBusqueda] = useState("");
  // Filtros y orden de la lista. "sin-stock" puede venir desde el panel.
  // Se recuerdan mientras la pestaña del navegador esté abierta, así al volver
  // de editar un producto la lista sigue filtrada y ordenada igual.
  const filtrosGuardados = leerFiltros();
  const [mostrar, setMostrar] = useState(
    searchParams.get("filtro") === "sin-stock" ? "sin-stock" : filtrosGuardados.mostrar || "todos"
  ); // todos | con-stock | sin-stock | stock-bajo | inactivos
  const [orden, setOrden] = useState(filtrosGuardados.orden || "nuevos");
  const [categoria, setCategoria] = useState(filtrosGuardados.categoria || "");
  const [categorias, setCategorias] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [totalTab, setTotalTab] = useState(0);

  const POR_TANDA = 100;
  const [conteos, setConteos] = useState({ tengo: 0, aPedido: 0 });

  // Recuerda en qué parte de la lista estaba antes de entrar a editar
  const posicion = useRecordarPosicion("admin-productos", {
    tab,
    busqueda,
    mostrar,
    orden,
    categoria
  });
  const { alSalir } = posicion;

  // Cuando la lista ya está dibujada, volvemos a la posición donde estaba
  useRestaurarAlDibujar(posicion, productos.length);

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
      q = aplicarBusqueda(q, busqueda);
    }

    if (categoria) q = q.eq("categoria", categoria);

    // Qué productos mostrar
    if (mostrar === "con-stock") q = q.gt("stock", 0);
    if (mostrar === "sin-stock") q = q.or("stock.is.null,stock.lte.0");
    if (mostrar === "stock-bajo") q = q.eq("stock_bajo", true);
    if (mostrar === "inactivos") q = q.eq("activo", false);

    // En qué orden
    const o = ORDENES.find((x) => x.valor === orden) || ORDENES[0];
    // En "A pedido", "Más nuevos" = lo último que publicó el proveedor (igual
    // que sus Novedades), no lo último que se importó
    if (tab === "a-pedido" && o.valor === "nuevos") {
      q = q.order("orden_novedad", { ascending: false, nullsFirst: false });
    }
    q = q.order(o.campo, { ascending: o.asc, nullsFirst: false });
    // Desempate fijo para que "Ver más" no repita ni saltee productos
    if (o.campo !== "id") q = q.order("id", { ascending: false });
    return q;
  }

  // SIN SEÑAL: tus productos salen de la copia guardada en el celular, con
  // la misma búsqueda, filtros y orden que la consulta a la base. Así se
  // puede buscar y filtrar aunque esa consulta exacta nunca se haya hecho
  // con señal. (Los "a pedido" son miles y no se guardan completos.)
  const [desdeCopia, setDesdeCopia] = useState(false);

  function productosDeLaCopia() {
    let lista = leerProductosPropiosOffline();
    const q = normalizarTexto(busqueda);
    if (q.length >= 2) lista = lista.filter((p) => normalizarTexto(p.nombre).includes(q));
    if (categoria) lista = lista.filter((p) => p.categoria === categoria);
    if (mostrar === "con-stock") lista = lista.filter((p) => Number(p.stock || 0) > 0);
    if (mostrar === "sin-stock") lista = lista.filter((p) => Number(p.stock || 0) <= 0);
    if (mostrar === "stock-bajo") lista = lista.filter((p) => p.stock_bajo === true);
    if (mostrar === "inactivos") lista = lista.filter((p) => p.activo === false);

    const o = ORDENES.find((x) => x.valor === orden) || ORDENES[0];
    const valor = (p) => {
      const v = p[o.campo];
      if (v === null || v === undefined) return null;
      if (o.campo === "nombre") return normalizarTexto(v);
      if (o.campo.endsWith("_at") || o.campo.endsWith("_en")) return new Date(v).getTime();
      return Number(v);
    };
    return [...lista].sort((a, b) => {
      const x = valor(a), y = valor(b);
      if (x === y) return Number(b.id) - Number(a.id);
      if (x === null) return 1;
      if (y === null) return -1;
      return (x < y ? -1 : 1) * (o.asc ? 1 : -1);
    });
  }

  // "¿Qué precio tiene?": copia la respuesta con el link del producto, lista
  // para pegar en el comentario de Facebook (ver lib/respuestaPrecio.js)
  const [respuestaCopiada, setRespuestaCopiada] = useState(null);
  function copiarRespuesta(p) {
    // Copia y abre las notificaciones de Facebook en el mismo toque (si se
    // espera a que termine de copiar, el celular no deja abrir otra app)
    try {
      navigator.clipboard?.writeText(textoRespuesta(p, "fb")).catch(() => {});
    } catch (e) {}
    window.open("https://www.facebook.com/notifications", "_blank", "noopener");
    setRespuestaCopiada(p.id);
    setTimeout(() => setRespuestaCopiada(null), 4000);
  }


  // ¿Usar la copia? Sin señal, o si la consulta a la base falló
  function usarCopia(error) {
    return tab === "tengo" && (error || (typeof navigator !== "undefined" && !navigator.onLine));
  }

  async function cargarProductos() {
    setLoading(true);
    let respuesta = { data: null, error: null, count: 0 };
    const sinSenal = typeof navigator !== "undefined" && !navigator.onLine;
    const hayCopia = tab === "tengo" && leerProductosPropiosOffline().length > 0;

    // Sin señal: directo a la copia, sin intentar la red. La librería de
    // Supabase reintenta varias veces antes de dar error, y la pantalla se
    // quedaba en "Buscando..." un buen rato.
    if (!(sinSenal && hayCopia)) {
      try {
        // Señal muy débil (el celular cree que hay conexión pero no llega
        // nada): si no contesta en 4 segundos, se usa la copia.
        respuesta = await Promise.race([
          consultaBase().range(0, POR_TANDA - 1),
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: null, error: new Error("sin respuesta"), count: 0 }), hayCopia ? 4000 : 20000)
          )
        ]);
      } catch (e) {
        respuesta.error = e;
      }
    } else {
      respuesta.error = new Error("sin señal");
    }
    const { data, error, count } = respuesta;

    if (usarCopia(error) && leerProductosPropiosOffline().length > 0) {
      const copia = productosDeLaCopia();
      setProductos(copia);
      setTotalTab(copia.length);
      setHayMas(false);
      setDesdeCopia(true);
      setLoading(false);
      return;
    }

    if (error) console.error(error.message || error);
    setDesdeCopia(false);
    setProductos(data || []);
    setTotalTab(count || 0);
    setHayMas((data?.length || 0) === POR_TANDA);
    setLoading(false);
  }

  // Actualización silenciosa: vuelve a traer lo que ya está en pantalla
  // (misma cantidad, mismos filtros) sin mover la lista ni mostrar "cargando".
  async function refrescarEnSilencio() {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const cantidad = Math.max(productos.length, POR_TANDA);
    const { data, error, count } = await consultaBase().range(0, cantidad - 1);
    if (error) throw new Error(error.message);
    setProductos(data || []);
    setTotalTab(count || 0);
    setHayMas((data?.length || 0) === cantidad);
    await contar();
  }

  useActualizarSolo(refrescarEnSilencio);

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
  }, [tab, busqueda, mostrar, orden, categoria]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_FILTROS, JSON.stringify({ mostrar, orden, categoria }));
    } catch {}
  }, [mostrar, orden, categoria]);

  // "Stock bajo" no tiene sentido en los productos a pedido
  useEffect(() => {
    if (tab === "a-pedido" && ["con-stock", "sin-stock", "stock-bajo"].includes(mostrar)) {
      setMostrar("todos");
    }
  }, [tab, mostrar]);

  // Categorías que existen de verdad en la base, para el filtro
  useEffect(() => {
    supabase
      .rpc("categorias_productos")
      .then(({ data, error }) => {
        if (error || !data) throw error || new Error("sin datos");
        setCategorias(data);
      })
      .catch(() => {
        // Sin señal: las categorías de tus productos guardados
        const cats = [...new Set(leerProductosPropiosOffline().map((p) => p.categoria).filter(Boolean))].sort();
        setCategorias(cats.map((c) => ({ categoria: c })));
      });
  }, []);

  // Cuántos productos hay de cada tipo, para mostrar en las pestañas
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
    if (tengo.error || tengo.count == null) {
      // Sin señal: al menos tus productos, contados de la copia
      setConteos((prev) => ({ ...prev, tengo: leerProductosPropiosOffline().length }));
      return;
    }
    setConteos({ tengo: tengo.count || 0, aPedido: aPedido.count || 0 });
  }

  useEffect(() => {
    contar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const productosMostrados = productos;
  const filtrosDeTab = tab === "a-pedido" ? FILTROS.filter((f) => !f.soloTengo) : FILTROS;
  const hayFiltros = mostrar !== "todos" || orden !== "nuevos" || categoria !== "";

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

        <Link
          href={`/admin/porcentajes?tipo=${tab}`}
          className={`flex items-center justify-between rounded-xl px-4 py-3 mb-3 font-semibold text-sm border ${
            tab === "a-pedido"
              ? "bg-purple-50 border-purple-200 text-purple-700"
              : "bg-blue-50 border-blue-200 text-brand-blue"
          }`}
        >
          <span>% Cambiar porcentajes de todos juntos</span>
          <span className="text-xs font-bold">{tab === "a-pedido" ? "A pedido" : "Tengo"} ›</span>
        </Link>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 mb-3"
          placeholder={`Buscar entre ${totalTab} productos...`}
        />

        {/* FILTROS Y ORDEN */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-2 -mx-1 px-1">
          {filtrosDeTab.map((f) => (
            <button
              key={f.valor}
              onClick={() => setMostrar(f.valor)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                mostrar === f.valor
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white"
          >
            {ORDENES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.categoria} value={c.categoria}>
                {nombreCategoria(c.categoria)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 mb-3 px-1">
          <span>
            {loading ? "Buscando..." : `${totalTab} productos`}
            {desdeCopia && !loading && (
              <span className="ml-1.5 font-bold text-brand-blue">· 📴 copia guardada (sin señal)</span>
            )}
          </span>
          {hayFiltros && (
            <button
              onClick={() => {
                setMostrar("todos");
                setOrden("nuevos");
                setCategoria("");
              }}
              className="text-brand-blue font-semibold"
            >
              Quitar filtros
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : productosMostrados.length === 0 ? (
          <div className="card p-6 text-center text-gray-500">
            {hayFiltros || busqueda
              ? "No hay productos con esos filtros."
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
                    {orden === "modificados" && p.actualizado_en && (
                      <p className="text-[11px] text-gray-400">
                        Modificado {formatearFecha(p.actualizado_en)}
                      </p>
                    )}
                    <p className="text-brand-blueDark font-bold text-sm mt-0.5">
                      ${formatPrice(p.precio_oferta || p.precio)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <button
                      onClick={() => copiarRespuesta(p)}
                      className="text-xs font-bold text-[#1877F2]"
                      title="Copia la respuesta de precio y abre Facebook"
                    >
                      {respuestaCopiada === p.id ? "✓ Pegala en FB" : "💬 Responder"}
                    </button>
                    <Link
                      href={`/admin/productos/${p.id}`}
                      onClick={alSalir}
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

            {hayMas && (
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
