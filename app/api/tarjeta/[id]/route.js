import { ImageResponse } from "next/og";

// Tarjeta de vista previa de un producto (1200x630): foto, nombre, precio
// y la marca. Es la imagen que muestran Facebook, WhatsApp e Instagram al
// pegar el link del producto: así, para contestar "¿qué precio tiene?",
// alcanza con pegar el link en el comentario, sin sacar capturas.
//
// Se arma sola con el precio actual: si cambia el precio, cambia la tarjeta.

export const runtime = "edge";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const AZUL = "#1560D4";
const AZUL_OSCURO = "#0E3F91";
const NARANJA = "#FF7A1A";

async function traerProducto(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/Productos?id=eq.${encodeURIComponent(id)}` +
      `&select=id,nombre,precio,precio_oferta,imagen_url,bajo_pedido,stock`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) return null;
  const filas = await res.json();
  return filas?.[0] || null;
}

function precio(valor) {
  return "$" + Math.round(Number(valor || 0)).toLocaleString("es-AR");
}

// Nombres largos: se cortan prolijos en vez de desbordar
function nombreCorto(nombre) {
  const n = String(nombre || "").trim();
  if (n.length <= 64) return n;
  const corte = n.slice(0, 62);
  return corte.slice(0, corte.lastIndexOf(" ")) + "…";
}

export async function GET(request, { params }) {
  const producto = await traerProducto(params.id).catch(() => null);
  const origen = new URL(request.url).origin;

  const [regular, negrita] = await Promise.all([
    fetch(new URL("./Inter-400.woff", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("./Inter-800.woff", import.meta.url)).then((r) => r.arrayBuffer())
  ]);

  const enOferta =
    producto?.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio);
  const precioFinal = enOferta ? producto.precio_oferta : producto?.precio;
  // La foto ya achicada a JPG (las fotos guardadas son WebP, que este
  // generador no lee)
  const foto = producto?.imagen_url ? `${origen}/api/og-imagen/${producto.id}` : null;

  const etiqueta = producto?.bajo_pedido
    ? { texto: "A PEDIDO", fondo: "#7C3AED" }
    : enOferta
    ? { texto: "OFERTA", fondo: "#DC2626" }
    : Number(producto?.stock || 0) > 0 && Number(producto?.stock) <= 2
    ? { texto: "ÚLTIMAS UNIDADES", fondo: NARANJA }
    : null;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", fontFamily: "Inter", background: "#fff" }}>
        {/* Foto */}
        <div
          style={{
            display: "flex",
            width: 560,
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            background: "#F8FAFC"
          }}
        >
          {foto ? (
            <img src={foto} width={500} height={500} style={{ objectFit: "contain" }} />
          ) : (
            <div style={{ display: "flex", fontSize: 40, color: "#94A3B8" }}>Bolson Click</div>
          )}
        </div>

        {/* Datos */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 640,
            height: "100%",
            padding: "48px 52px",
            background: `linear-gradient(160deg, ${AZUL} 0%, ${AZUL_OSCURO} 100%)`,
            color: "#fff"
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>Bolson</div>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: NARANJA, marginLeft: 10 }}>
              Click
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 20, opacity: 0.85, marginTop: 2 }}>
            El Bolsón y la Comarca Andina
          </div>

          {etiqueta && (
            <div style={{ display: "flex", marginTop: 30 }}>
              <div
                style={{
                  display: "flex",
                  background: etiqueta.fondo,
                  padding: "8px 18px",
                  borderRadius: 999,
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: 1
                }}
              >
                {etiqueta.texto}
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              fontSize: 42,
              fontWeight: 800,
              lineHeight: 1.15,
              marginTop: etiqueta ? 20 : 40
            }}
          >
            {producto ? nombreCorto(producto.nombre) : "Productos para el hogar"}
          </div>

          <div style={{ display: "flex", flexGrow: 1 }} />

          {producto && enOferta && (
            <div style={{ display: "flex", fontSize: 30, opacity: 0.75, textDecoration: "line-through" }}>
              {precio(producto.precio)}
            </div>
          )}
          {producto && (
            <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 1 }}>
              {precio(precioFinal)}
            </div>
          )}

          <div
            style={{
              display: "flex",
              marginTop: 26,
              paddingTop: 20,
              borderTop: "2px solid rgba(255,255,255,0.25)",
              justifyContent: "space-between",
              fontSize: 22
            }}
          >
            <div style={{ display: "flex", fontWeight: 800 }}>Pedilo en bolsonclick.com.ar</div>
            <div style={{ display: "flex", opacity: 0.85 }}>Envíos a la Comarca</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: negrita, weight: 800, style: "normal" }
      ],
      headers: {
        // Se renueva sola: el precio cambia y la tarjeta acompaña
        "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=3600"
      }
    }
  );
}
