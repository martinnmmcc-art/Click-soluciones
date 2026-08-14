"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/whatsapp";

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(" ");
  const lines = [];
  let linea = "";
  words.forEach((palabra) => {
    const test = linea ? linea + " " + palabra : palabra;
    if (ctx.measureText(test).width > maxWidth && linea) {
      lines.push(linea);
      linea = palabra;
    } else {
      linea = test;
    }
  });
  if (linea) lines.push(linea);
  return lines;
}

export default function ComprobantePedido({ pedido, onClose }) {
  const canvasRef = useRef(null);
  const [imagenLista, setImagenLista] = useState(false);
  const [generando, setGenerando] = useState(true);

  const items = pedido.items_pedido || pedido.items || [];
  const tieneDescuento = pedido.descuento_tipo && Number(pedido.descuento_valor) > 0;
  const subtotal =
    pedido.subtotal !== null && pedido.subtotal !== undefined
      ? Number(pedido.subtotal)
      : Number(pedido.total);
  const montoDescuento = tieneDescuento ? subtotal - Number(pedido.total) : 0;

  useEffect(() => {
    dibujarComprobante();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function dibujarComprobante() {
    setGenerando(true);
    const width = 800;

    const canvasMedidor = document.createElement("canvas");
    const ctxMedidor = canvasMedidor.getContext("2d");
    ctxMedidor.font = "600 20px Arial";
    let lineasProductos = 0;
    items.forEach((it) => {
      const lineas = wrapText(ctxMedidor, `${it.cantidad}x ${it.nombre_producto}`, 480);
      lineasProductos += lineas.length;
    });

    const alturaHeader = 200;
    const alturaClienteInfo = 150;
    const alturaTablaHeader = 50;
    const alturaItems = Math.max(items.length * 46, lineasProductos * 30 + items.length * 16);
    const alturaTotales = tieneDescuento ? 160 : 110;
    const alturaFooter = 175;
    const margenes = 100;

    const height =
      alturaHeader +
      alturaClienteInfo +
      alturaTablaHeader +
      alturaItems +
      alturaTotales +
      alturaFooter +
      margenes;

    const canvas = canvasRef.current;
    const dpr = 2;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#F1F5F9";
    ctx.fillRect(0, 0, width, height);

    const pad = 24;
    drawRoundedRect(ctx, pad, pad, width - pad * 2, height - pad * 2, 20);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    let y = pad;

    ctx.save();
    drawRoundedRect(ctx, pad, pad, width - pad * 2, alturaHeader, 20);
    ctx.clip();
    ctx.fillStyle = "#0F2C51";
    ctx.fillRect(pad, pad, width - pad * 2, alturaHeader);
    ctx.restore();

    try {
      const logo = await cargarImagen("/logo.png");
      const logoSize = 100;
      ctx.save();
      drawRoundedRect(ctx, width / 2 - logoSize / 2, pad + 24, logoSize, logoSize, 18);
      ctx.clip();
      ctx.drawImage(logo, width / 2 - logoSize / 2, pad + 24, logoSize, logoSize);
      ctx.restore();
    } catch (e) {
      console.error("No se pudo cargar el logo", e);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 30px Arial";
    ctx.fillText("Bolson Click", width / 2, pad + 165);

    y = pad + alturaHeader + 30;

    ctx.textAlign = "left";
    ctx.fillStyle = "#1560D4";
    ctx.font = "700 15px Arial";
    ctx.fillText(
      `PRESUPUESTO ${pedido.numero_pedido ? "#" + pedido.numero_pedido : ""}`,
      pad + 30,
      y
    );

    ctx.fillStyle = "#94A3B8";
    ctx.font = "400 14px Arial";
    const fecha = pedido.created_at ? new Date(pedido.created_at) : new Date();
    ctx.fillText(fecha.toLocaleDateString("es-AR"), pad + 30, y + 22);

    y += 55;

    ctx.fillStyle = "#0F172A";
    ctx.font = "700 18px Arial";
    ctx.fillText(pedido.nombre_cliente || "Cliente", pad + 30, y);
    y += 26;

    ctx.fillStyle = "#475569";
    ctx.font = "400 15px Arial";
    if (pedido.telefono_cliente) {
      ctx.fillText(`📱 ${pedido.telefono_cliente}`, pad + 30, y);
      y += 22;
    }
    if (pedido.localidad) {
      ctx.fillText(`📍 ${pedido.localidad}`, pad + 30, y);
      y += 22;
    }
    if (pedido.metodo_entrega === "envio" && pedido.direccion_envio) {
      ctx.fillText(`🏠 ${pedido.direccion_envio}`, pad + 30, y);
      y += 22;
    } else if (pedido.metodo_entrega) {
      ctx.fillText(
        pedido.metodo_entrega === "envio" ? "🚚 Envío a domicilio" : "🏬 Retiro en showroom",
        pad + 30,
        y
      );
      y += 22;
    }

    y += 15;

    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad + 30, y);
    ctx.lineTo(width - pad - 30, y);
    ctx.stroke();
    y += 30;

    ctx.fillStyle = "#94A3B8";
    ctx.font = "700 13px Arial";
    ctx.fillText("PRODUCTO", pad + 30, y);
    ctx.textAlign = "right";
    ctx.fillText("SUBTOTAL", width - pad - 30, y);
    ctx.textAlign = "left";
    y += 24;

    ctx.font = "600 16px Arial";
    items.forEach((item) => {
      ctx.fillStyle = "#1E293B";
      const lineas = wrapText(ctx, `${item.cantidad}x ${item.nombre_producto}`, 480);
      lineas.forEach((linea, idx) => {
        ctx.fillText(linea, pad + 30, y + idx * 22);
      });

      ctx.textAlign = "right";
      ctx.fillStyle = "#0F172A";
      ctx.font = "700 16px Arial";
      ctx.fillText(
        `$${formatPrice(item.precio_unitario * item.cantidad)}`,
        width - pad - 30,
        y
      );
      ctx.textAlign = "left";
      ctx.font = "600 16px Arial";

      y += Math.max(lineas.length * 22, 22) + 16;
    });

    y += 10;

    // si hay descuento, mostramos subtotal + descuento antes del total
    if (tieneDescuento) {
      ctx.font = "600 15px Arial";
      ctx.fillStyle = "#64748B";
      ctx.fillText("Subtotal", pad + 30, y);
      ctx.textAlign = "right";
      ctx.fillText(`$${formatPrice(subtotal)}`, width - pad - 30, y);
      ctx.textAlign = "left";
      y += 24;

      const etiquetaDescuento =
        pedido.descuento_tipo === "porcentaje"
          ? `Descuento (${pedido.descuento_valor}%)`
          : "Descuento";
      ctx.fillStyle = "#DC2626";
      ctx.fillText(etiquetaDescuento, pad + 30, y);
      ctx.textAlign = "right";
      ctx.fillText(`-$${formatPrice(montoDescuento)}`, width - pad - 30, y);
      ctx.textAlign = "left";
      y += 30;
    }

    drawRoundedRect(ctx, pad + 30, y, width - pad * 2 - 60, 70, 14);
    ctx.fillStyle = "#EFF6FF";
    ctx.fill();

    ctx.fillStyle = "#1E293B";
    ctx.font = "700 18px Arial";
    ctx.fillText("TOTAL", pad + 55, y + 43);

    ctx.textAlign = "right";
    ctx.fillStyle = "#0F2C51";
    ctx.font = "800 26px Arial";
    ctx.fillText(`$${formatPrice(pedido.total)}`, width - pad - 55, y + 46);
    ctx.textAlign = "left";

    y += 100;

    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad + 30, y);
    ctx.lineTo(width - pad - 30, y);
    ctx.stroke();
    y += 26;

    drawRoundedRect(ctx, pad + 30, y, width - pad * 2 - 60, 76, 14);
    ctx.fillStyle = "#F0FDF4";
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = "#166534";
    ctx.font = "700 15px Arial";
    ctx.fillText("💳 Transferencia · Alias: bolsonclick (Tarjeta Naranja)", pad + 50, y + 30);
    ctx.font = "400 14px Arial";
    ctx.fillStyle = "#15803D";
    ctx.fillText("📱 WhatsApp: 2944 396888", pad + 50, y + 56);

    y += 76 + 24;

    ctx.textAlign = "center";
    ctx.fillStyle = "#64748B";
    ctx.font = "600 13px Arial";
    ctx.fillText("🚚 Hacemos envíos  ·  🤝 Entregas en punto de encuentro", width / 2, y);
    y += 20;

    ctx.fillStyle = "#94A3B8";
    ctx.font = "400 13px Arial";
    ctx.fillText(
      "Este presupuesto es informativo. Consultanos por cualquier duda 😊",
      width / 2,
      y
    );
    y += 20;
    ctx.font = "700 13px Arial";
    ctx.fillStyle = "#64748B";
    ctx.fillText("Bolson Click · El Bolsón, Río Negro", width / 2, y);
    ctx.textAlign = "left";

    setGenerando(false);
    setImagenLista(true);
  }

  function cargarImagen(src) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function descargar() {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = `presupuesto-${pedido.numero_pedido || pedido.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function compartir() {
    const canvas = canvasRef.current;
    canvas.toBlob(async (blob) => {
      const file = new File([blob], `presupuesto-${pedido.numero_pedido || pedido.id}.png`, {
        type: "image/png",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Presupuesto Bolson Click",
          });
        } catch (e) {
          // el usuario canceló
        }
      } else {
        descargar();
        alert("Tu navegador no permite compartir directo. Se descargó la imagen, podés enviarla desde tu galería.");
      }
    }, "image/png");
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-4 max-w-md w-full">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-800">Comprobante</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none px-2">
            ×
          </button>
        </div>

        <div className="border border-gray-100 rounded-xl overflow-hidden mb-4 max-h-[60vh] overflow-y-auto">
          {generando && (
            <p className="text-center text-sm text-gray-400 py-10">Generando comprobante...</p>
          )}
          <canvas ref={canvasRef} className={`w-full ${generando ? "hidden" : ""}`} />
        </div>

        {imagenLista && (
          <div className="flex gap-2">
            <button
              onClick={compartir}
              className="flex-1 bg-brand-blue text-white font-bold text-sm py-2.5 rounded-xl"
            >
              📤 Compartir
            </button>
            <button
              onClick={descargar}
              className="flex-1 bg-gray-100 text-gray-700 font-bold text-sm py-2.5 rounded-xl"
            >
              ⬇️ Descargar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
