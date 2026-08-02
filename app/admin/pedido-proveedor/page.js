"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

function PedidoProveedor() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pedido, setPedido] = useState([]); // {producto_id, nombre_producto, cantidad, costo_unitario}
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    async function cargar() {
      const { data, error } = await supabase
        .from("Productos")
        .select("*")
        .order("nombre", { ascending: true });
      if (error) console.error(error.message);
      const lista = data || [];
      setProductos(lista);

      // sugerencia automática: productos con stock <= stock mínimo
      const sugeridos = lista
        .filter((p) => Number(p.stock || 0) <= Number(p.stock_minimo ?? 3))
        .map((p) => {
          const minimo = Number(p.stock_minimo ?? 3);
          const cantidadSugerida = Math.max(minimo * 2 - Number(p.stock || 0), 1);
          return {
            producto_id: p.id,
            nombre_producto: p.nombre,
            cantidad: cantidadSugerida,
            costo_unitario: Number(p.costo || 0),
          };
        });
      setPedido(sugeridos);
      setLoading(false);
    }
    cargar();
  }, []);

  function agregarProducto(producto) {
    setPedido((prev) => {
      if (prev.find((i) => i.producto_id === producto.id)) return prev;
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre_producto: producto.nombre,
          cantidad: 1,
          costo_unitario: Number(producto.costo || 0),
        },
      ];
    });
    setBusqueda("");
  }

  function quitarProducto(producto_id) {
    setPedido((prev) => prev.filter((i) => i.producto_id !== producto_id));
  }

  function cambiarCantidad(producto_id, cantidad) {
    if (cantidad < 1) return;
    setPedido((prev) =>
      prev.map((i) => (i.producto_id === producto_id ? { ...i, cantidad } : i))
    );
  }

  function cambiarCosto(producto_id, costo) {
    setPedido((prev) =>
      prev.map((i) =>
        i.producto_id === producto_id ? { ...i, costo_unitario: Number(costo) || 0 } : i
      )
    );
  }

  const total = pedido.reduce((acc, i) => acc + i.cantidad * i.costo_unitario, 0);

  async function descargarExcel() {
    const XLSX = await import("xlsx");

    const filas = pedido.map((i) => ({
      Producto: i.nombre_producto,
      Cantidad: i.cantidad,
      "Costo unitario": i.costo_unitario,
      Subtotal: i.cantidad * i.costo_unitario,
    }));
    filas.push({ Producto: "", Cantidad: "", "Costo unitario": "TOTAL", Subtotal: total });

    const ws = XLSX.utils.json_to_sheet(filas);
    ws["!cols"] = [{ wch: 35 }, { wch: 10 }, { wch: 15 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedido");

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `pedido-proveedor-${fecha}.xlsx`);
  }

  const productosFiltrados = busqueda.trim()
    ? productos
        .filter((p) => p.nombre?.toLowerCase().includes(busqueda.toLowerCase()))
        .filter((p) => !pedido.find((i) => i.producto_id === p.id))
        .slice(0, 8)
    : [];

  if (loading) {
    return (
      <main className="min-h-screen bg-brand-bg">
        <div className="container-app px-4 py-6 text-center text-gray-400">
          Cargando productos...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-bg pb-20">
      <div className="container-app px-4 py-6">
        <Link href="/admin/productos" className="text-sm text-brand-blue font-medium">
          ← Productos
        </Link>
        <h1 className="font-extrabold text-xl text-gray-800 mt-1 mb-1">
          Pedido a proveedor
        </h1>
        <p className="text-sm text-gray-500 mb-4">
          Sugerido según el stock mínimo de cada producto. Podés sacar, agregar o ajustar
          cantidades antes de descargar.
        </p>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Agregar otro producto por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input-field"
          />
          {productosFiltrados.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {productosFiltrados.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded-lg"
                >
                  <span className="text-gray-700">
                    {p.nombre}{" "}
                    <span className="text-gray-400">
                      (stock: {p.stock ?? 0})
                    </span>
                  </span>
                  <button
                    onClick={() => agregarProducto(p)}
                    className="text-xs font-bold text-white bg-brand-blue px-2.5 py-1 rounded-lg"
                  >
                    + Agregar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {pedido.length === 0 ? (
          <div className="card p-6 text-center text-gray-500">
            No hay productos con stock bajo, y todavía no agregaste ninguno a mano.
          </div>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {pedido.map((item) => (
              <div key={item.producto_id} className="card p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">
                    {item.nombre_producto}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <label className="text-xs text-gray-500">Cant.</label>
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) =>
                        cambiarCantidad(item.producto_id, parseInt(e.target.value) || 1)
                      }
                      className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1"
                    />
                    <label className="text-xs text-gray-500">Costo unit.</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.costo_unitario}
                      onChange={(e) => cambiarCosto(item.producto_id, e.target.value)}
                      className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1"
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800">
                    ${formatPrice(item.cantidad * item.costo_unitario)}
                  </p>
                  <button
                    onClick={() => quitarProducto(item.producto_id)}
                    className="text-xs font-semibold text-red-500 mt-1"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pedido.length > 0 && (
          <>
            <div className="card p-4 flex items-center justify-between mb-4">
              <span className="font-semibold text-gray-700">Total estimado</span>
              <span className="text-lg font-extrabold text-brand-blueDark">
                ${formatPrice(total)}
              </span>
            </div>

            <button onClick={descargarExcel} className="btn-primary w-full">
              ⬇️ Descargar Excel para el proveedor
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function PedidoProveedorPage() {
  return (
    <AdminGuard>
      <PedidoProveedor />
    </AdminGuard>
  );
    }
