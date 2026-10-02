// Genera la lista de TODAS las pantallas del panel a partir de las carpetas
// de app/admin. Corre solo antes de cada compilación ("prebuild"), así una
// pantalla nueva queda incluida para usarse sin señal sin tocar nada.
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..", "app");
const rutas = [];

function recorrer(carpeta) {
  for (const e of fs.readdirSync(carpeta, { withFileTypes: true })) {
    const completa = path.join(carpeta, e.name);
    if (e.isDirectory()) {
      // Las pantallas con datos variables ([id]) no se pueden recorrer solas
      if (!e.name.startsWith("[") && !e.name.startsWith("(") && e.name !== "api") recorrer(completa);
    } else if (e.name === "page.js" || e.name === "page.jsx") {
      const ruta = "/" + path.relative(raiz, path.dirname(completa)).split(path.sep).join("/");
      rutas.push(ruta === "/." || ruta === "/" ? "/" : ruta);
    }
  }
}
recorrer(path.join(raiz, "admin"));

// Pantallas de la tienda que el panel también usa sin señal
const extra = ["/", "/catalogo", "/carrito", "/login", "/a-pedido"];
const todas = [...new Set([...rutas.filter((r) => r !== "/admin/login"), ...extra])].sort();

const salida = `// ARCHIVO GENERADO por scripts/generar-rutas.js antes de cada compilación.
// No editar a mano: se vuelve a escribir solo.
export const RUTAS_SIN_SENAL = ${JSON.stringify(todas, null, 2)};
`;
fs.writeFileSync(path.join(__dirname, "..", "lib", "rutasSinSenal.js"), salida);
console.log(`Pantallas para usar sin señal: ${todas.length}`);
