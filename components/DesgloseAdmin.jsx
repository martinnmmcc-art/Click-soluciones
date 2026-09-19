"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/context/AdminContext";
import { formatPrice } from "@/lib/whatsapp";

// Panel que SOLO ve el administrador en la ficha de un producto.
// Muestra cuánto le cuesta de verdad el producto (costo del proveedor +
// transferencia + dólar + transporte), cuánto gana, y deja probar un
// descuento para ver si todavía conviene. Se puede mostrar u ocultar, y
// recuerda la elección para los próximos productos.

const CLAVE = "bolson-desglose-admin-visible";

function redondear(n) {
  return Math.round(Number(n) || 0);
}

export default function DesgloseAdmin({ producto }) {
  const { isAdmin } = useAdmin();
  const [visible, setVisible] = useState(true);
  const [descuento, setDescuento] = useState("");

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE);
      if (guardado !== null) setVisible(guardado === "1");
    } catch {}
  }, []);

  function alternar() {
    const nuevo = !visible;
    setVisible(nuevo);
    try {
      localStorage.setItem(CLAVE, nuevo ? "1" : "0");
    } catch {}
  }

  if (!isAdmin || !producto) return null;

  const costo = Number(producto.costo) || 0;
  const pct = {
    transferencia: Number(producto.pct_transferencia ?? 3),
    dolar: Number(producto.pct_dolar ?? 5),
    transporte: Number(producto.pct_transporte ?? 15),
    ganancia: Number(producto.pct_ganancia ?? 80)
  };

  // Mismo orden que la fórmula de precios de toda la app
  const conTransferencia = costo * (1 + pct.transferencia / 100);
  const conDolar = conTransferencia * (1 + pct.dolar / 100);
  const costoReal = conDolar * (1 + pct.transporte / 100);

  const tieneOferta = producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio);
  const precioVenta = Number(tieneOferta ? producto.precio_oferta : producto.precio) || 0;
  const ganancia = precioVenta - costoReal;
  const margen = costoReal > 0 ? (ganancia / costoReal) * 100 : 0;

  // Simulador de descuento
  const pctDesc = Number(descuento) || 0;
  const precioConDesc = Math.round((precioVenta * (1 - pctDesc / 100)) / 50) * 50;
  const gananciaConDesc = precioConDesc - costoReal;
  const margenConDesc = costoReal > 0 ? (gananciaConDesc / costoReal) * 100 : 0;
  // Hasta cuánto se puede descontar sin perder plata
  const descuentoMaximo = precioVenta > 0 ? Math.max(0, (1 - costoReal / precioVenta) * 100) : 0;

  const filas = [
    { etiqueta: "Costo del proveedor", valor: costo },
    { etiqueta: `+ Transferencia ${pct.transferencia}%`, valor: conTransferencia - costo },
    { etiqueta: `+ Dólar ${pct.dolar}%`, valor: conDolar - conTransferencia },
    { etiqueta: `+ Transporte ${pct.transporte}%`, valor: costoReal - conDolar }
  ];

  return (
    <div className="mt-4 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 overflow-hidden">
      <button
        onClick={alternar}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-amber-800">🔒 Mi costo y ganancia (solo admin)</span>
        <span className="text-xs font-semibold text-amber-700">{visible ? "Ocultar ▲" : "Mostrar ▼"}</span>
      </button>

      {visible && (
        <div className="px-4 pb-4">
          {costo <= 0 ? (
            <p className="text-sm text-amber-800">
              Este producto no tiene costo cargado.{" "}
              <Link href={`/admin/productos/${producto.id}`} className="underline font-semibold">
                Cargalo acá
              </Link>
              .
            </p>
          ) : (
            <>
              <div className="bg-white rounded-xl p-3 text-sm">
                {filas.map((f) => (
                  <div key={f.etiqueta} className="flex justify-between py-0.5 text-gray-600">
                    <span>{f.etiqueta}</span>
                    <span>${formatPrice(redondear(f.valor))}</span>
                  </div>
                ))}
                <div className="flex justify-between py-1 mt-1 border-t border-gray-100 font-bold text-gray-800">
                  <span>Te cuesta a vos</span>
                  <span>${formatPrice(redondear(costoReal))}</span>
                </div>
                <div className="flex justify-between py-0.5 text-green-700 font-semibold">
                  <span>+ Ganancia ({Math.round(margen)}%)</span>
                  <span>${formatPrice(redondear(ganancia))}</span>
                </div>
                <div className="flex justify-between py-1 border-t border-gray-100 font-extrabold text-gray-900">
                  <span>Precio de venta{tieneOferta ? " (oferta)" : ""}</span>
                  <span>${formatPrice(precioVenta)}</span>
                </div>
              </div>

              {/* Probar un descuento */}
              <div className="mt-3">
                <p className="text-xs font-bold text-amber-800 mb-2">¿Y si le hago descuento?</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[5, 10, 15, 20].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDescuento(String(d))}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        Number(descuento) === d
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-white text-amber-800 border-amber-300"
                      }`}
                    >
                      {d}%
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={descuento}
                      onChange={(e) => setDescuento(e.target.value)}
                      placeholder="otro"
                      className="w-16 text-center border border-amber-300 rounded-lg py-1 text-sm font-bold"
                    />
                    <span className="text-xs font-bold text-amber-800">%</span>
                  </div>
                </div>

                {pctDesc > 0 && (
                  <div
                    className={`mt-2 rounded-xl p-3 text-sm ${
                      gananciaConDesc > 0 ? "bg-white" : "bg-red-100 border border-red-300"
                    }`}
                  >
                    <div className="flex justify-between font-bold text-gray-800">
                      <span>Precio con {pctDesc}% off</span>
                      <span>${formatPrice(precioConDesc)}</span>
                    </div>
                    <div
                      className={`flex justify-between font-semibold ${
                        gananciaConDesc > 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      <span>{gananciaConDesc > 0 ? "Te queda de ganancia" : "Perdés"}</span>
                      <span>
                        ${formatPrice(Math.abs(redondear(gananciaConDesc)))} ({Math.round(margenConDesc)}%)
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-amber-700 mt-2">
                  Podés descontar hasta {Math.floor(descuentoMaximo)}% sin perder plata.
                </p>
              </div>

              <Link
                href={`/admin/productos/${producto.id}`}
                className="block text-center text-xs font-semibold text-amber-800 underline mt-3"
              >
                Editar este producto
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
