"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/whatsapp";
import { normalizarTelefono } from "@/lib/telefono";

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
  // La imagen ya convertida en archivo, lista para compartir. Se prepara
  // apenas se dibuja: si se convierte recién al tocar "Enviar", el celular
  // considera que el menú de compartir no lo pidió el usuario y lo bloquea.
  const [archivo, setArchivo] = useState(null);
  const [aviso, setAviso] = useState("");

  // Venta cobrada: comprobante de compra. Con saldo pendiente: presupuesto.
  const pagadoTotal = Number(pedido.monto_pagado || 0);
  const saldoTotal = Number(pedido.total || 0) - pagadoTotal;
  const esVentaPagada = Number(pedido.total || 0) > 0 && saldoTotal <= 0;
  const tituloDocumento = esVentaPagada ? "COMPROBANTE DE COMPRA" : "PRESUPUESTO";
  const nombreArchivo = `${esVentaPagada ? "comprobante" : "presupuesto"}-${pedido.numero_pedido || pedido.id}.png`;
  const nombreCliente = (pedido.nombre_cliente || "").trim().split(" ")[0];
  const telefonoCliente = normalizarTelefono(pedido.telefono_cliente || "");

  const mensajeCliente =
    `¡Hola${nombreCliente ? " " + nombreCliente : ""}! ` +
    (esVentaPagada
      ? `Te paso el comprobante de tu compra${pedido.numero_pedido ? " #" + pedido.numero_pedido : ""}. ¡Muchas gracias por elegirnos! 🙌`
      : `Te paso el detalle de tu pedido${pedido.numero_pedido ? " #" + pedido.numero_pedido : ""}. ` +
        `Total $${formatPrice(pedido.total)}` +
        (pagadoTotal > 0 ? `, pagaste $${formatPrice(pagadoTotal)} y quedan $${formatPrice(saldoTotal)}.` : ".") +
        ` Para pagar podés transferir al alias bolsonclick.`) +
    `\n\nBolson Click · www.bolsonclick.com.ar`;

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
    const alturaFooter = 250;
    const margenes = 100;

    const height =
      alturaHeader +
      alturaClienteInfo +
      alturaTablaHeader +
      alturaItems +
      alturaTotales +
      alturaFooter +
      margenes;

    // Se dibuja dos veces: una de prueba en un lienzo de sobra, para saber
    // exactamente dónde termina el contenido, y otra con ese alto justo.
    // Antes el alto salía de medidas fijas que no contaban el saldo ni el
    // alias, y cuando el cliente debía plata el final se cortaba.
    const pintar = async (ctx, height) => {

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
        `${tituloDocumento} ${pedido.numero_pedido ? "#" + pedido.numero_pedido : ""}`,
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

      // Estado del pago: sin esto el comprobante parecía decir que estaba
      // todo pagado, y el cliente no se enteraba de que debía algo.
      const pagado = Number(pedido.monto_pagado || 0);
      const saldo = Number(pedido.total || 0) - pagado;

      if (saldo > 0) {
        // Si pagó una parte, la mostramos para que quede claro qué falta
        if (pagado > 0) {
          ctx.fillStyle = "#475569";
          ctx.font = "600 15px Arial";
          ctx.fillText("Ya pagaste", pad + 40, y);
          ctx.textAlign = "right";
          ctx.fillStyle = "#16A34A";
          ctx.font = "700 17px Arial";
          ctx.fillText(`$${formatPrice(pagado)}`, width - pad - 40, y);
          ctx.textAlign = "left";
          y += 34;
        }

        drawRoundedRect(ctx, pad + 30, y, width - pad * 2 - 60, 74, 14);
        ctx.fillStyle = "#DC2626";
        ctx.fill();

        ctx.textAlign = "center";
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "700 14px Arial";
        ctx.fillText(
          pagado > 0 ? "SALDO PENDIENTE" : "PENDIENTE DE PAGO",
          width / 2,
          y + 28
        );
        ctx.font = "800 28px Arial";
        ctx.fillText(`$${formatPrice(saldo)}`, width / 2, y + 60);
        ctx.textAlign = "left";

        y += 96;
      } else {
        drawRoundedRect(ctx, pad + 30, y, width - pad * 2 - 60, 58, 14);
        ctx.fillStyle = "#16A34A";
        ctx.fill();

        ctx.textAlign = "center";
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "700 18px Arial";
        ctx.fillText("✓ PAGADO", width / 2, y + 37);
        ctx.textAlign = "left";

        y += 80;
      }

      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad + 30, y);
      ctx.lineTo(width - pad - 30, y);
      ctx.stroke();
      y += 26;

      // Estado de la entrega, para que el comprobante también sirva como
      // constancia de que el pedido se entregó
      const ESTADOS = {
        pendiente: "Pedido recibido",
        preparando: "Preparando tu pedido",
        listo: "Listo para retirar",
        repartiendo: "En camino",
        entregado: "Entregado",
        esperando_stock: "Esperando que llegue",
        demorado: "Demorado",
        cancelado: "Cancelado"
      };
      const textoEstado = ESTADOS[pedido.estado] || "Pedido recibido";

      ctx.fillStyle = "#475569";
      ctx.font = "600 14px Arial";
      ctx.fillText("Estado", pad + 40, y);
      ctx.textAlign = "right";
      ctx.fillStyle = pedido.estado === "entregado" ? "#16A34A" : "#0F2C51";
      ctx.font = "700 15px Arial";
      ctx.fillText(textoEstado, width - pad - 40, y);
      ctx.textAlign = "left";
      y += 34;

      // El alias solo tiene sentido si todavía debe algo
      if (saldo > 0) {
        drawRoundedRect(ctx, pad + 30, y, width - pad * 2 - 60, 95, 14);
        ctx.fillStyle = "#F97316";
        ctx.fill();

        ctx.textAlign = "center";
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "600 13px Arial";
        ctx.fillText("PARA PAGAR · TRANSFERÍ AL ALIAS", width / 2, y + 26);

        ctx.font = "800 30px Arial";
        ctx.fillText("bolsonclick", width / 2, y + 62);

        ctx.font = "600 14px Arial";
        ctx.fillText("Tarjeta Naranja", width / 2, y + 84);
        ctx.textAlign = "left";

        y += 95 + 22;
      } else {
        y += 12;
      }

      ctx.textAlign = "center";

      ctx.fillStyle = "#334155";
      ctx.font = "700 15px Arial";
      ctx.fillText("📱 WhatsApp: 2944 396888", width / 2, y);
      y += 26;

      ctx.fillStyle = "#64748B";
      ctx.font = "600 13px Arial";
      ctx.fillText("🚚 Hacemos envíos  ·  🤝 Entregas en punto de encuentro", width / 2, y);
      y += 22;

      ctx.fillStyle = "#1560D4";
      ctx.font = "700 14px Arial";
      ctx.fillText("🌐 www.bolsonclick.com.ar · Productos importados", width / 2, y);
      y += 22;

      ctx.fillStyle = "#94A3B8";
      ctx.font = "400 13px Arial";
      ctx.fillText(
        esVentaPagada
          ? "¡Gracias por tu compra! Cualquier consulta, escribinos 😊"
          : "Este presupuesto es informativo. Consultanos por cualquier duda 😊",
        width / 2,
        y
      );
      y += 20;
      ctx.font = "700 13px Arial";
      ctx.fillStyle = "#64748B";
      ctx.fillText("Bolson Click · El Bolsón, Río Negro", width / 2, y);
      ctx.textAlign = "left";
      return y;
    };

    const prueba = document.createElement("canvas");
    prueba.width = width;
    prueba.height = height + 900;
    const finContenido = await pintar(prueba.getContext("2d"), height + 900);
    const altoExacto = Math.ceil(finContenido + 50);

    const canvas = canvasRef.current;
    const dpr = 2;
    canvas.width = width * dpr;
    canvas.height = altoExacto * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = altoExacto + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    await pintar(ctx, altoExacto);

    setGenerando(false);

    // Dejamos el archivo listo ya, antes de que toquen "Enviar"
    canvas.toBlob((blob) => {
      if (blob) setArchivo(new File([blob], nombreArchivo, { type: "image/png" }));
      setImagenLista(true);
    }, "image/png");
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
    link.download = nombreArchivo;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // Abre el chat de WhatsApp de ESTE cliente, con el mensaje ya escrito.
  // WhatsApp no deja adjuntar una imagen desde un enlace: en la PC la
  // descargamos para que la arrastres al chat.
  function abrirChatCliente(conDescarga = false) {
    if (conDescarga) descargar();
    const destino = telefonoCliente ? `https://wa.me/549${telefonoCliente}` : "https://wa.me/";
    window.open(`${destino}?text=${encodeURIComponent(mensajeCliente)}`, "_blank", "noopener");
  }

  // Menú de compartir del celular con la imagen y el mensaje: elegís
  // WhatsApp y el chat del cliente. Se llama sin ninguna espera antes, para
  // que el celular lo reconozca como un toque tuyo.
  function compartir() {
    setAviso("");
    if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
      navigator
        .share({ files: [archivo], text: mensajeCliente, title: tituloDocumento })
        .catch((e) => {
          if (e?.name === "AbortError") return; // lo cerraste vos
          // Bloqueado o no disponible: no lo dejamos en silencio
          abrirChatCliente(true);
          setAviso(
            "Tu celular no dejó abrir el menú de compartir. Se descargó la imagen y se abrió el chat del cliente: adjuntala desde la galería."
          );
        });
      return;
    }
    // PC o navegador sin menú de compartir
    abrirChatCliente(true);
    setAviso("Se descargó la imagen y se abrió el chat del cliente: adjuntala con el clip 📎.");
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
          <div className="space-y-2">
            <button
              onClick={compartir}
              className="w-full bg-[#25D366] text-white font-bold text-sm py-3 rounded-xl"
            >
              📲 Enviar {esVentaPagada ? "comprobante" : "presupuesto"}
              {nombreCliente ? ` a ${nombreCliente}` : ""}
            </button>

            <div className="flex gap-2">
              {telefonoCliente && (
                <button
                  onClick={() => abrirChatCliente(false)}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 font-bold text-xs py-2.5 rounded-xl"
                >
                  💬 Abrir su chat
                </button>
              )}
              <button
                onClick={descargar}
                className="flex-1 bg-gray-100 text-gray-700 font-bold text-xs py-2.5 rounded-xl"
              >
                ⬇️ Descargar
              </button>
            </div>

            {aviso && (
              <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2">{aviso}</p>
            )}

            <p className="text-[10px] text-gray-400 text-center">
              "Enviar" abre el menú del celular: elegí WhatsApp y el chat del cliente. La imagen va con el mensaje.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
