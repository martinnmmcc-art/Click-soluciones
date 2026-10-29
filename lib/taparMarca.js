// Tapa la marca del proveedor en sus fotos y pone la de Bolson Click.
//
// Solo del lado del servidor (rutas /api y la copia de fotos).
//
// El proveedor empezó a subir fotos con su plantilla: una franja gris oscura
// arriba a la izquierda con su logo y "NEXT CELL", cortada en diagonal con
// una raya verde. Esa franja delata de dónde compramos, así que en cada foto:
//   1. Miramos esa esquina en una versión chiquita de la foto (100x100).
//   2. Si está la franja (mayoría de gris oscuro + la raya verde al costado),
//      pegamos encima nuestra franja azul con el logo y "BOLSON CLICK".
//   3. Si no está, la foto queda exactamente igual.
// La detección es estricta a propósito: preferimos dejar pasar una foto
// rara antes que tapar el producto de una foto normal.

import { BANDA_PNG, BANDA_ANCHO, BANDA_ALTO } from "./marcaBolsonClick";

async function cargarSharp() {
  try {
    return (await import("sharp")).default;
  } catch (e) {
    return null;
  }
}

// Gris oscuro de la franja (≈ #3E4346): parejo en los tres colores
function esOscuro(r, g, b) {
  return r < 100 && g < 100 && b < 100 && Math.max(r, g, b) - Math.min(r, g, b) < 25;
}

// Verde agua de la raya (≈ #52A28A)
function esVerdeAgua(r, g, b) {
  return g > 125 && g - r > 40 && b > 95 && b <= g + 10;
}

// Devuelve { tiene, oscuro, verde } mirando la esquina de arriba a la izquierda
export async function detectarMarcaProveedor(bytes, sharpOpcional) {
  const sharp = sharpOpcional || (await cargarSharp());
  if (!sharp) return { tiene: false };
  try {
    const { data } = await sharp(bytes)
      .rotate()
      .resize(100, 100, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const px = (x, y) => {
      const i = (y * 100 + x) * 3;
      return [data[i], data[i + 1], data[i + 2]];
    };

    // La franja: de 0 a 38% de ancho y de 0 a 12% de alto
    let oscuros = 0;
    let total = 0;
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 38; x++) {
        total++;
        if (esOscuro(...px(x, y))) oscuros++;
      }
    }
    // La raya verde en diagonal, a la derecha de la franja
    let verdes = 0;
    for (let y = 0; y < 12; y++) {
      for (let x = 36; x < 53; x++) {
        if (esVerdeAgua(...px(x, y))) verdes++;
      }
    }
    // Abajo de la franja, sobre la izquierda, ya no hay gris: confirma que
    // es una franja y no una foto oscura entera
    let oscurosAbajo = 0;
    for (let y = 16; y < 22; y++) {
      for (let x = 0; x < 25; x++) {
        if (esOscuro(...px(x, y))) oscurosAbajo++;
      }
    }

    const oscuro = oscuros / total;
    const tiene = oscuro >= 0.55 && verdes >= 4 && oscurosAbajo / 150 < 0.5;
    return { tiene, oscuro, verdes, oscurosAbajo };
  } catch (e) {
    return { tiene: false };
  }
}

// Si la foto tiene la franja del proveedor, devuelve la foto con la nuestra
// encima. Si no, devuelve los mismos bytes. Nunca rompe: ante cualquier
// error, la foto queda como estaba.
export async function taparMarcaProveedor(bytes, tipo = "") {
  const sharp = await cargarSharp();
  if (!sharp || !bytes) return { bytes, tipo, tapada: false };

  const { tiene } = await detectarMarcaProveedor(bytes, sharp);
  if (!tiene) return { bytes, tipo, tapada: false };

  try {
    const base = sharp(bytes).rotate();
    const meta = await base.metadata();
    // Con .rotate() el ancho/alto pueden venir cruzados en fotos giradas
    const girada = meta.orientation && meta.orientation >= 5;
    const ancho = girada ? meta.height : meta.width;
    const alto = girada ? meta.width : meta.height;
    if (!ancho || !alto) return { bytes, tipo, tapada: false };

    const altoBanda = Math.min(alto, Math.round((ancho * BANDA_ALTO) / BANDA_ANCHO));
    const banda = await sharp(BANDA_PNG)
      .resize(ancho, altoBanda, { fit: "fill" })
      .png()
      .toBuffer();

    let salida = base.composite([{ input: banda, left: 0, top: 0 }]);
    let tipoSalida;
    if (/png/i.test(tipo)) {
      salida = salida.png();
      tipoSalida = "image/png";
    } else if (/webp/i.test(tipo)) {
      salida = salida.webp({ quality: 85 });
      tipoSalida = "image/webp";
    } else {
      salida = salida.jpeg({ quality: 88, mozjpeg: true });
      tipoSalida = "image/jpeg";
    }
    return { bytes: await salida.toBuffer(), tipo: tipoSalida, tapada: true };
  } catch (e) {
    return { bytes, tipo, tapada: false };
  }
}
