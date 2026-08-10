import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PAGE_W = 595.28; // A4 en puntos
const PAGE_H = 841.89;
const MARGIN = 36;
const COLS = 2;
const GAP = 14;
const CARD_W = (PAGE_W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
const IMG_H = 150;
const CARD_H = 250;

const AZUL = rgb(0.12, 0.32, 0.62);
const NARANJA = rgb(0.93, 0.49, 0.13);
const GRIS = rgb(0.45, 0.45, 0.45);
const NEGRO = rgb(0.15, 0.15, 0.15);
const ROJO = rgb(0.8, 0.15, 0.15);

function money(n) {
  return "$" + Math.round(Number(n || 0)).toLocaleString("es-AR");
}

// Convierte cualquier imagen (webp/jpg/png) a PNG y la reduce, para poder incrustarla siempre igual
async function bajarComoPng(url, maxWidth = 500) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const png = await sharp(buffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .png()
      .toBuffer();
    return png;
  } catch (e) {
    return null;
  }
}

function envolverTexto(font, texto, size, maxWidth) {
  const palabras = (texto || "").split(/\s+/);
  const lineas = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? actual + " " + palabra : palabra;
    if (font.widthOfTextAtSize(prueba, size) > maxWidth && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids") || "";
  const titulo = searchParams.get("titulo") || "Catálogo Bolson Click";
  const fotos = searchParams.get("fotos") || "principal";
  const mostrarPrecio = searchParams.get("precio") !== "0";
  const mostrarStock = searchParams.get("stock") !== "0";
  const mostrarDescripcion = searchParams.get("desc") !== "0";

  const ids = idsParam.split(",").map((i) => i.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No hay productos seleccionados" }, { status: 400 });
  }

  const { data: productosData, error } = await supabase
    .from("Productos")
    .select("*")
    .in("id", ids);

  if (error || !productosData) {
    return NextResponse.json({ error: "Error al buscar productos" }, { status: 500 });
  }

  const productos = ids
    .map((id) => productosData.find((p) => String(p.id) === String(id)))
    .filter(Boolean);

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let cursorY = PAGE_H - MARGIN;

  function nuevaPagina() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    cursorY = PAGE_H - MARGIN;
  }

  // ---------- ENCABEZADO (solo primera página) ----------
  page.drawRectangle({ x: 0, y: PAGE_H - 110, width: PAGE_W, height: 110, color: AZUL });

  page.drawText(titulo, {
    x: MARGIN,
    y: PAGE_H - 45,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1)
  });
  page.drawText("Productos importados en El Bolson y la Comarca Andina", {
    x: MARGIN,
    y: PAGE_H - 65,
    size: 10,
    font: fontRegular,
    color: rgb(0.85, 0.9, 1)
  });

  cursorY = PAGE_H - 130;

  const intro = [
    "Somos de El Bolson y vendemos en toda la Comarca Andina. Productos importados de hogar, cocina, tecnologia y mas.",
    "Envios a El Bolson y la Comarca Andina, coordinamos transporte local o punto de encuentro.",
    "Como comprar: escribinos por WhatsApp o entra a www.bolsonclick.com.ar"
  ];
  for (const linea of intro) {
    const lineasEnvueltas = envolverTexto(fontRegular, linea, 9, PAGE_W - MARGIN * 2);
    for (const l of lineasEnvueltas) {
      page.drawText(l, { x: MARGIN, y: cursorY, size: 9, font: fontRegular, color: GRIS });
      cursorY -= 12;
    }
  }
  cursorY -= 10;

  // ---------- PRODUCTOS ----------
  let col = 0;
  let filaY = cursorY;

  for (const prod of productos) {
    if (col === 0) {
      if (filaY - CARD_H < MARGIN) {
        nuevaPagina();
        filaY = cursorY;
      }
    }

    const x = MARGIN + col * (CARD_W + GAP);
    const y = filaY;

    // marco de la tarjeta
    page.drawRectangle({
      x, y: y - CARD_H, width: CARD_W, height: CARD_H,
      borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 1
    });

    // imagen
    const imagenUrl = fotos === "todas" ? (prod.imagen_url || prod.imagen_url_2) : prod.imagen_url;
    if (imagenUrl) {
      const png = await bajarComoPng(imagenUrl);
      if (png) {
        try {
          const img = await pdfDoc.embedPng(png);
          const escala = Math.min((CARD_W - 10) / img.width, (IMG_H - 10) / img.height);
          const w = img.width * escala;
          const h = img.height * escala;
          page.drawImage(img, {
            x: x + (CARD_W - w) / 2,
            y: y - 5 - h,
            width: w,
            height: h
          });
        } catch (e) {
          // si falla la imagen puntual, seguimos sin romper el resto del PDF
        }
      }
    }

    let textY = y - IMG_H - 15;

    // nombre (hasta 2 lineas)
    const nombreLineas = envolverTexto(fontBold, prod.nombre || "", 9, CARD_W - 10).slice(0, 2);
    for (const l of nombreLineas) {
      page.drawText(l, { x: x + 5, y: textY, size: 9, font: fontBold, color: NEGRO });
      textY -= 11;
    }

    // descripcion (hasta 2 lineas)
    if (mostrarDescripcion && prod.descripcion) {
      const descLineas = envolverTexto(fontRegular, prod.descripcion, 7.5, CARD_W - 10).slice(0, 2);
      for (const l of descLineas) {
        page.drawText(l, { x: x + 5, y: textY, size: 7.5, font: fontRegular, color: GRIS });
        textY -= 9;
      }
    }

    // stock
    if (mostrarStock) {
      const stock = prod.stock !== null && prod.stock !== undefined ? Number(prod.stock) : null;
      if (stock !== null && stock <= 0) {
        page.drawText("Sin stock - consultar", { x: x + 5, y: y - CARD_H + 22, size: 7.5, font: fontBold, color: GRIS });
      } else if (stock !== null && stock === 1) {
        page.drawText("Ultima unidad", { x: x + 5, y: y - CARD_H + 22, size: 7.5, font: fontBold, color: ROJO });
      }
    }

    // precio
    if (mostrarPrecio) {
      const tieneOferta = prod.precio_oferta && prod.precio_oferta < prod.precio;
      const precioTexto = money(tieneOferta ? prod.precio_oferta : prod.precio);
      page.drawText(precioTexto, {
        x: x + 5,
        y: y - CARD_H + 8,
        size: 11,
        font: fontBold,
        color: AZUL
      });
    }

    col++;
    if (col >= COLS) {
      col = 0;
      filaY -= CARD_H + GAP;
    }
  }

  // ---------- PIE en la ultima pagina ----------
  const piePosY = 30;
  page.drawText("www.bolsonclick.com.ar", {
    x: MARGIN, y: piePosY, size: 9, font: fontBold, color: AZUL
  });

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="catalogo-bolson-click.pdf"`
    }
  });
}
