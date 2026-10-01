// Tema de la app: claro, oscuro o automático (sigue la configuración del
// celular). Por defecto claro: a quien no elige nada no le cambia nada.

export const CLAVE_TEMA = "bolsonclick_tema";
const COLOR_BARRA = { claro: "#1560D4", oscuro: "#0f172a" };

export function temaGuardado() {
  try {
    const t = localStorage.getItem(CLAVE_TEMA);
    return t === "oscuro" || t === "sistema" ? t : "claro";
  } catch (e) {
    return "claro";
  }
}

export function temaEfectivo(tema) {
  if (tema === "sistema") {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
    } catch (e) {
      return "claro";
    }
  }
  return tema === "oscuro" ? "oscuro" : "claro";
}

export function aplicarTema(tema, { animar = false } = {}) {
  const raiz = document.documentElement;
  const efectivo = temaEfectivo(tema);

  if (animar) {
    raiz.classList.add("cambiando-tema");
    setTimeout(() => raiz.classList.remove("cambiando-tema"), 300);
  }

  raiz.classList.toggle("dark", efectivo === "oscuro");

  // La barra de estado del celular acompaña al tema
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) =>
    m.setAttribute("content", COLOR_BARRA[efectivo])
  );
}

export function elegirTema(tema) {
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch (e) {}
  aplicarTema(tema, { animar: true });
  window.dispatchEvent(new CustomEvent("tema-cambiado", { detail: tema }));
}

// Se ejecuta en el <head>, ANTES de dibujar la página: así quien eligió
// oscuro no ve un destello blanco cada vez que abre la app.
export const SCRIPT_TEMA_INICIAL = `(function(){try{
var t=localStorage.getItem("${CLAVE_TEMA}");
var o=t==="oscuro"||(t==="sistema"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
if(o){document.documentElement.classList.add("dark");
var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","${COLOR_BARRA.oscuro}");}
}catch(e){}})();`;
