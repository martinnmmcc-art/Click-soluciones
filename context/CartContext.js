"use client";

import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "clic_soluciones_cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [nota, setNota] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Cargar carrito guardado
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setItems(parsed.items || []);
        setNota(parsed.nota || "");
      }
    } catch (e) {
      console.warn("No se pudo leer el carrito guardado", e);
    }
    setLoaded(true);
  }, []);

  // Persistir carrito
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, nota }));
  }, [items, nota, loaded]);

  function addItem(producto, cantidad = 1) {
    const stockDisponible =
      producto.stock !== null && producto.stock !== undefined ? Number(producto.stock) : null;

    setItems((prev) => {
      const existe = prev.find((i) => i.id === producto.id);
      if (existe) {
        const nuevaCantidad = existe.cantidad + cantidad;
        const cantidadFinal =
          stockDisponible !== null ? Math.min(nuevaCantidad, stockDisponible) : nuevaCantidad;
        return prev.map((i) =>
          i.id === producto.id ? { ...i, cantidad: cantidadFinal, stock: stockDisponible } : i
        );
      }
      const cantidadInicial =
        stockDisponible !== null ? Math.min(cantidad, stockDisponible) : cantidad;
      return [
        ...prev,
        {
          id: producto.id,
          nombre: producto.nombre,
          precio: producto.precio_oferta || producto.precio,
          imagen_url: producto.imagen_url,
          stock: stockDisponible,
          cantidad: cantidadInicial
        }
      ];
    });
  }

  function updateQuantity(id, cantidad) {
    if (cantidad <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const cantidadFinal =
          i.stock !== null && i.stock !== undefined ? Math.min(cantidad, Number(i.stock)) : cantidad;
        return { ...i, cantidad: cantidadFinal };
      })
    );
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function clearCart() {
    setItems([]);
    setNota("");
  }

  const total = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const cantidadTotal = items.reduce((acc, i) => acc + i.cantidad, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        nota,
        setNota,
        total,
        cantidadTotal
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
