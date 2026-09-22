"use client";

// Estrellas para mostrar (solo lectura) o para elegir (con onElegir)
export default function Estrellas({ valor = 0, tamano = "text-base", onElegir }) {
  return (
    <span className={`inline-flex ${onElegir ? "gap-1" : "gap-0.5"} ${tamano} leading-none`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onElegir ? (
          <button
            key={n}
            type="button"
            onClick={() => onElegir(n)}
            aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
            className={`transition active:scale-90 ${n <= valor ? "" : "grayscale opacity-30"}`}
          >
            ⭐
          </button>
        ) : (
          <span key={n} className={n <= Math.round(valor) ? "" : "grayscale opacity-30"}>
            ⭐
          </span>
        )
      )}
    </span>
  );
}
