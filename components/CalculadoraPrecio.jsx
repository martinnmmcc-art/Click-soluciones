"use client";

import { useEffect, useState } from "react";

// Desglosa el precio paso a paso, con cada recargo editable.
//
// Sirve para dos cosas: entender de dónde sale el precio final, y poder
// ajustar un recargo puntual sin tocar el resto. Por ejemplo, un producto
// que retirás vos del local no lleva transporte, o uno que querés vender
// más barato para moverlo lleva menos ganancia.

const REDONDEO = 50;

export default function CalculadoraPrecio({
  costo,
  costoEnvio = 0,
  valores = {},
  precioActual,
  precioManual = false,
  onCambio
}) {
  const [pct, setPct] = useState({
    transferencia: valores.pct_transferencia ?? 3,
    dolar: valores.pct_dolar ?? 5,
    transporte: valores.pct_transporte ?? 15,
    ganancia: valores.pct_ganancia ?? 80
  });

  const [manual, setManual] = useState(precioManual);

  const base = Number(costo) || 0;
  const envio = Number(costoEnvio) || 0;

  // Los recargos se aplican uno sobre otro, en orden
  const conTransferencia = base * (1 + Number(pct.transferencia || 0) / 100);
  const conDolar = conTransferencia * (1 + Number(pct.dolar || 0) / 100);
  const conTransporte = conDolar * (1 + Number(pct.transporte || 0) / 100) + envio;
  const ganancia = conTransporte * (Number(pct.ganancia || 0) / 100);
  const sinRedondear = conTransporte + ganancia;
  const precioFinal = Math.ceil(sinRedondear / REDONDEO) * REDONDEO;

  useEffect(() => {
    onCambio?.({
      pct_transferencia: Number(pct.transferencia || 0),
      pct_dolar: Number(pct.dolar || 0),
      pct_transporte: Number(pct.transporte || 0),
      pct_ganancia: Number(pct.ganancia || 0),
      precio_manual: manual,
      precio_calculado: precioFinal
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct, manual, precioFinal]);

  function fmt(n) {
    return Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
  }

  const filas = [
    {
      clave: "transferencia",
      etiqueta: "Transferencia",
      ayuda: "Lo que recarga el proveedor por pagar así",
      resultado: conTransferencia
    },
    {
      clave: "dolar",
      etiqueta: "Suba del dólar",
      ayuda: "Colchón por la variación entre pedido y venta",
      resultado: conDolar
    },
    {
      clave: "transporte",
      etiqueta: "Transporte",
      ayuda: "El flete hasta acá",
      resultado: conTransporte - envio
    },
    {
      clave: "ganancia",
      etiqueta: "Tu ganancia",
      ayuda: "Lo que te queda a vos",
      resultado: null
    }
  ];

  if (!base) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
        <p className="text-xs text-gray-500">
          Cargá el costo del proveedor para ver el desglose del precio.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3">
      <p className="text-sm font-bold text-gray-800 mb-2">💰 Cómo se arma el precio</p>

      {/* Punto de partida */}
      <div className="flex justify-between items-center text-xs py-1.5 border-b border-blue-100">
        <span className="text-gray-600">Costo del proveedor</span>
        <span className="font-bold text-gray-800">${fmt(base)}</span>
      </div>

      {filas.map((f) => (
        <div key={f.clave} className="py-2 border-b border-blue-100">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700">{f.etiqueta}</p>
              <p className="text-[10px] text-gray-500">{f.ayuda}</p>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <input
                type="number"
                value={pct[f.clave]}
                onChange={(e) => setPct({ ...pct, [f.clave]: e.target.value })}
                className="w-14 text-sm text-center border border-gray-300 rounded-lg py-1 font-bold"
                inputMode="decimal"
              />
              <span className="text-xs font-bold text-gray-500">%</span>
            </div>

            <span className="text-xs font-bold text-gray-800 w-20 text-right flex-shrink-0">
              {f.clave === "ganancia"
                ? `+$${fmt(ganancia)}`
                : `$${fmt(f.resultado)}`}
            </span>
          </div>
        </div>
      ))}

      {envio > 0 && (
        <div className="flex justify-between items-center text-xs py-1.5 border-b border-blue-100">
          <span className="text-gray-600">
            Flete repartido
            <span className="block text-[10px] text-gray-400">
              Del pedido en el que vino
            </span>
          </span>
          <span className="font-bold text-gray-800">+${fmt(envio)}</span>
        </div>
      )}

      {/* Resultado */}
      <div className="bg-white rounded-lg p-2.5 mt-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-gray-700">Precio de venta</span>
          <span className="text-xl font-black text-brand-blue">
            ${fmt(precioFinal)}
          </span>
        </div>

        <p className="text-[10px] text-gray-500 mt-1">
          Te queda ${fmt(ganancia)} por unidad · {Math.round((ganancia / precioFinal) * 100)}% del
          precio de venta
        </p>
      </div>

      <label className="flex items-start gap-2 mt-2.5">
        <input
          type="checkbox"
          checked={manual}
          onChange={(e) => setManual(e.target.checked)}
          className="mt-0.5"
        />
        <span className="flex-1">
          <span className="text-xs font-semibold text-gray-700 block">
            Poner el precio a mano
          </span>
          <span className="text-[10px] text-gray-500 block">
            Así ningún cálculo automático lo modifica después
          </span>
        </span>
      </label>

      {!manual && precioActual && Math.abs(Number(precioActual) - precioFinal) > 50 && (
        <p className="text-[10px] text-amber-800 bg-amber-50 rounded-lg p-2 mt-2">
          ⚠️ El precio guardado es ${fmt(precioActual)}. Al guardar se va a
          actualizar a ${fmt(precioFinal)}.
        </p>
      )}
    </div>
  );
}
